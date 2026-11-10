// src/ai/process/main.ts
// Main question processing pipeline. Runs consensus or a single streamed answer and applies the result.
import { incrementStat } from '../../core/stats';
import { buildAnswerCacheKey, isAnswerPlausiblyUsable, isChoiceQuestion, lookupAnswerCache, normalizeAnswerForCache, storeAnswerCache } from '../../core/answer-cache';
import '../../ai/batch/main';
import type { XdCachedAnswer } from '../../core/answer-cache';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function extractAnswerFromParsed(questionData: XdQuestionData, parsed: XdParsedResponse): string | null {
        // The model sometimes puts the correct option only in explanation or
        // solution while answer is empty. Resolve those fields too before
        // spending another request.
        for (const candidate of [parsed.explanation, parsed.solution]) {
            if (!candidate) continue;
            const normalized = normalizeAnswerForCache(questionData, candidate);
            if (normalized && isAnswerPlausiblyUsable(questionData, normalized)) return normalized;
        }
        return null;
    }

    window.xdAnswers.processQuestion = async function(questionData: XdQuestionData): Promise<void> {
        if (window.xdAnswers.isProcessingAI) {
            window.xdAnswers._oneClickUserTriggered = false;
            return;
        }

        const silentMode = window.xdAnswers.settings.silentMode || '';
        const webSearch = window.xdAnswers.settings.webSearchEnabled && I.getActiveSearchProvider(window.xdAnswers.settings);
        console.log('[xdAnswers] processQuestion:', questionData.text?.slice(0, 80) + '...', '| topic=' + (questionData.topic || 'none'), '| webSearch=' + !!webSearch, '| silent=' + silentMode);

        // In oneclick mode, only process when user explicitly clicked (flag set by setupOneClickHandler)
        if (silentMode === 'oneclick' && !window.xdAnswers._oneClickUserTriggered) {
            return;
        }
        window.xdAnswers._oneClickUserTriggered = false;

        // Each run owns a generation. Cancelling or starting a refresh bumps it,
        // so a late reply from the previous question can never render into the panel.
        const generation = (window.xdAnswers._processGeneration = (window.xdAnswers._processGeneration || 0) + 1);
        const isCurrent = () => window.xdAnswers._processGeneration === generation;

        const isSilent = silentMode !== '';

        if (!isSilent) {
            window.xdAnswers.createUI();
            window.xdAnswers.attachAndPositionHelper();
        }

        window.xdAnswers.isProcessingAI = true;
        const startTime = Date.now();

        if (!isSilent) I.startWaitingStatus(startTime);

        try {
            const settings = window.xdAnswers.settings;
            const cacheEnabled = settings.answerCacheEnabled !== false;
            const bypassCache = !!window.xdAnswers._bypassAnswerCacheOnce;
            window.xdAnswers._bypassAnswerCacheOnce = false;
            if (bypassCache) console.log('[xdAnswers] cache bypassed by explicit refresh');

            let cacheKey = '';
            let cached: XdCachedAnswer | null = null;
            if (cacheEnabled) {
                cacheKey = await buildAnswerCacheKey(questionData);
                if (cacheKey && !bypassCache) {
                    if (!isCurrent()) return;
                    cached = await lookupAnswerCache(cacheKey, questionData, settings);
                    if (cached) console.log('[xdAnswers] cache hit:', cacheKey.slice(0, 18) + '...');
                }
            }
            if (!isCurrent()) return;

            // Batch answers also live in a short-lived in-memory index. It
            // bridges small extraction differences between the session view
            // and the rendered question without trusting another test's data.
            if (!cached && !bypassCache && cacheEnabled) {
                let batchAnswer = I.lookupBatchAnswer ? I.lookupBatchAnswer(questionData) : null;

                // The first question can be detected a moment before the
                // provider starts its batch. Give the batch a short head start
                // instead of asking the AI twice.
                if (!batchAnswer && settings.batchEnabled && !(I.isBatchActive && I.isBatchActive())
                    && (questionData.batchKey || questionData.cacheScope)) {
                    await new Promise<void>(resolve => setTimeout(resolve, 700));
                    if (!isCurrent()) return;
                    batchAnswer = I.lookupBatchAnswer ? I.lookupBatchAnswer(questionData) : null;
                }

                if (batchAnswer) {
                    cached = { answer: batchAnswer, at: Date.now() };
                    console.log('[xdAnswers] batch memory hit:', batchAnswer.slice(0, 60));
                } else if (I.isBatchActive && I.isBatchActive() && I.waitForBatchAnswer) {
                    // Let the streaming batch answer this question instead of
                    // starting a duplicate AI request. allowUnplanned covers
                    // the short race before batch computes its question keys.
                    const waited = await I.waitForBatchAnswer(questionData, 10000, true);
                    if (!isCurrent()) return;
                    if (waited) {
                        cached = { answer: waited, at: Date.now() };
                        console.log('[xdAnswers] batch answer arrived while waiting:', waited.slice(0, 60));
                    }
                }
            }

            let result: XdStreamAnswerResult;
            const _cs = settings.consensus;
            console.log('[xdAnswers] consensus check:', JSON.stringify(_cs));
            const consensusEnabled = _cs && _cs.enabled && _cs.runs && _cs.runs.length >= 1;
            if (!cached) {
                if (consensusEnabled) {
                    const consensusParsed = await I.runConsensusProcess(questionData, startTime, isSilent, silentMode, generation);
                    if (consensusParsed && cacheKey) void storeAnswerCache(cacheKey, questionData, consensusParsed, settings, { force: bypassCache }).catch(() => {});
                    return;
                }
                try {
                    result = await window.xdAnswers.streamAnswer(questionData, startTime);
                } catch (streamErr) {
                    if ((streamErr as Error)?.name === 'AbortError') throw streamErr;
                    const s = I.getEffectiveSettings(settings);
                    if (I.isOpenCodeFreeModel && I.isOpenCodeFreeModel(s)) {
                        throw streamErr;
                    }
                    console.warn('xdAnswers: Streaming failed, falling back:', (streamErr as Error).message);
                    const answer = await window.xdAnswers.getAnswer(questionData);
                    result = { content: answer, thinking: '' };
                }
            } else {
                result = { content: '', thinking: '' };
            }

            // A refresh cancelled this request while it was in flight.
            if (!isCurrent()) return;

            let parsed: XdParsedResponse = cached
                ? {
                    answer: cached.answer,
                    explanation: cached.explanation || '',
                    solution: cached.solution || '',
                    confidence: cached.confidence,
                    raw: '',
                    isStructured: true,
                    _cached: true
                }
                : I.parseAIResponse(result.content);

            // Resolve free-form answers to the exact option and reject answers
            // that do not exist among the current options. If only explanation
            // or solution is present, try to recover the option from it.
            let answerValid = !!parsed.answer;
            if (!cached) {
                if (parsed.answer) {
                    const normalized = normalizeAnswerForCache(questionData, parsed.answer);
                    if (normalized) parsed.answer = normalized;
                    answerValid = isAnswerPlausiblyUsable(questionData, parsed.answer);
                    if (!answerValid) {
                        console.warn('[xdAnswers] parsed answer is not usable, looking in explanation:', parsed.answer.slice(0, 80));
                    }
                }
                if (!answerValid) {
                    const recovered = extractAnswerFromParsed(questionData, parsed);
                    if (recovered) {
                        parsed.answer = recovered;
                        answerValid = true;
                        console.log('[xdAnswers] recovered answer from explanation:', recovered.slice(0, 80));
                    }
                }
            }

            // Retry once with the answer-only prompt when the model omitted the
            // answer or produced something that is not a valid option. Without
            // this the helper can stay stuck on explanation-only output.
            if (!cached && !answerValid) {
                console.warn('[xdAnswers] retrying with answer-only prompt');
                try {
                    const retryData: XdQuestionData = {
                        ...questionData,
                        customPromptPrefix: I.ANSWER_ONLY_SYSTEM_PROMPT
                            + '\nНе викликай жодних інструментів і не виводь службові токени. Відповідай лише рядком answer: ...',
                        disableTools: true
                    };
                    const retryResult = await window.xdAnswers.streamAnswer(retryData, startTime);
                    if (!isCurrent()) return;
                    const retryParsed = I.parseAIResponse(retryResult.content);
                    let retryAnswer = retryParsed.answer || '';
                    let retryValid = false;
                    if (retryAnswer) {
                        const normalized = normalizeAnswerForCache(questionData, retryAnswer);
                        if (normalized) retryAnswer = normalized;
                        retryValid = isAnswerPlausiblyUsable(questionData, retryAnswer);
                    }
                    if (!retryValid) {
                        const recovered = extractAnswerFromParsed(questionData, retryParsed);
                        if (recovered) {
                            retryAnswer = recovered;
                            retryValid = true;
                        }
                    }
                    if (retryValid) {
                        retryParsed.answer = retryAnswer;
                        result = retryResult;
                        parsed = retryParsed;
                        answerValid = true;
                    } else {
                        console.warn('[xdAnswers] retry answer is still not usable');
                        if (retryParsed.explanation || retryParsed.solution) {
                            result = retryResult;
                            parsed = retryParsed;
                        }
                    }
                } catch (retryError) {
                    if ((retryError as Error)?.name === 'AbortError') throw retryError;
                    console.warn('xdAnswers: answer-only retry failed:', (retryError as Error)?.message || retryError);
                }
            }

            // Last attempt for choice questions: ask only for option letters.
            // This catches cases where the model insists on a formula or a
            // descriptive fragment that is not one of the rendered options.
            if (!cached && !answerValid && isChoiceQuestion(questionData) && (questionData.optionsText || '').trim()) {
                console.warn('[xdAnswers] retrying with option-letter prompt');
                try {
                    const letterData: XdQuestionData = {
                        ...questionData,
                        customPromptPrefix: 'Ти обираєш правильний варіант. Відповідай ТІЛЬКИ літерою варіанта (A, B, C, D...). '
                            + 'Для кількох правильних — літери через "; ". Не пиши текст варіанта, формули чи пояснення.',
                        disableTools: true
                    };
                    const letterResult = await window.xdAnswers.streamAnswer(letterData, startTime);
                    if (!isCurrent()) return;
                    const letterParsed = I.parseAIResponse(letterResult.content);
                    const letter = String(letterParsed.answer || '').trim();
                    const isLetterAnswer = /^[a-zа-яіїєґ](\s*[;,]\s*[a-zа-яіїєґ])*$/iu.test(letter);
                    if (isLetterAnswer && isAnswerPlausiblyUsable(questionData, letter)) {
                        letterParsed.answer = letter;
                        result = letterResult;
                        parsed = letterParsed;
                        answerValid = true;
                    } else if (letterParsed.explanation || letterParsed.solution) {
                        result = letterResult;
                        parsed = letterParsed;
                    }
                } catch (letterError) {
                    if ((letterError as Error)?.name === 'AbortError') throw letterError;
                    console.warn('xdAnswers: option-letter retry failed:', (letterError as Error)?.message || letterError);
                }
            }

            if (!cached && !answerValid) {
                parsed.answer = '';
                parsed.parseFailed = true;
            }

            if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
            if (window.xdAnswers._streamTimerInterval) { clearInterval(window.xdAnswers._streamTimerInterval); window.xdAnswers._streamTimerInterval = null; }

            const elapsed = I.getProcessElapsed(startTime);
            window.xdAnswers.lastParsedResponse = parsed;
            if (parsed.answer) {
                incrementStat('answered');
                if (!cached && cacheKey) void storeAnswerCache(cacheKey, questionData, parsed, settings, { force: bypassCache }).catch(() => {});
            }

            if (isSilent) {
                I.applySilentMode(parsed.answer || parsed.explanation || 'Parse error', parsed);
            } else {
                I.renderSingleResult(result, parsed, elapsed);
            }

            if (!parsed.answer && !isSilent && window.xdAnswers.answerContentDiv) {
                const note = document.createElement('div');
                note.className = 'xd-error xd-parse-retry-note';
                note.innerHTML = '<strong>Parse error:</strong> AI did not return an answer. Press ↻ to retry.';
                window.xdAnswers.answerContentDiv.prepend(note);
            }

            if (parsed.answer) {
                if (!isSilent) {
                    I.highlightCorrectAnswer(parsed.answer);
                }
                // If provider set a custom auto-answer handler, use it instead of default
                if (window.xdAnswers._customAutoAnswer) {
                    const customFn = window.xdAnswers._customAutoAnswer;
                    window.xdAnswers._customAutoAnswer = null;
                    setTimeout(() => {
                        window.xdAnswers._autoSelecting = true;
                        try { customFn(parsed.answer as string, parsed); } catch (e) { console.error('xdAnswers customAutoAnswer:', e); }
                        window.xdAnswers._oneClickContainer = null;
                        window.xdAnswers._answerContainer = null;
                        window.xdAnswers._autoSelecting = false;
                    }, window.xdAnswers.settings.autoAnswerCooldown);
                } else {
                    // In oneclick mode, always auto-select (bypass autoAnswer setting)
                    I.autoSelectAnswer(parsed.answer, silentMode === 'oneclick');
                }
            }
        } catch (error) {
            if (!isCurrent() || (error as Error)?.name === 'AbortError') return;
            if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
            if (window.xdAnswers._streamTimerInterval) { clearInterval(window.xdAnswers._streamTimerInterval); window.xdAnswers._streamTimerInterval = null; }
            if (!isSilent && window.xdAnswers.answerContentDiv) {
                const errHtml = I.formatError((error as Error).message);
                window.xdAnswers.answerContentDiv.innerHTML = errHtml;
            }
        } finally {
            if (isCurrent()) {
                if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
                if (window.xdAnswers._streamTimerInterval) { clearInterval(window.xdAnswers._streamTimerInterval); window.xdAnswers._streamTimerInterval = null; }
                window.xdAnswers.isProcessingAI = false;
                window.xdAnswers._oneClickContainer = null;
            }
        }
    };

    window.xdAnswers.cancelProcessing = function(): void {
        // Invalidate the run before aborting it so its error/finally handlers stay quiet.
        window.xdAnswers._processGeneration = (window.xdAnswers._processGeneration || 0) + 1;
        const cancel = window.xdAnswers._cancelStream;
        window.xdAnswers._cancelStream = null;
        if (cancel) {
            try { cancel(true); } catch (e) {}
        }
        if (window.xdAnswers._statusInterval) {
            clearInterval(window.xdAnswers._statusInterval);
            window.xdAnswers._statusInterval = null;
        }
        if (window.xdAnswers._streamTimerInterval) {
            clearInterval(window.xdAnswers._streamTimerInterval);
            window.xdAnswers._streamTimerInterval = null;
        }
        window.xdAnswers.isProcessingAI = false;
        window.xdAnswers._oneClickContainer = null;
    };

    // Explicit refresh: cancel the running request, skip the cache for the next
    // run, and let the active provider re-run its question detection.
    window.xdAnswers.forceRefresh = function(): void {
        window.xdAnswers._bypassAnswerCacheOnce = true;
        window.xdAnswers.cancelProcessing();
        if (typeof window.xdAnswers.onRefresh === 'function') {
            window.xdAnswers.onRefresh();
        }
    };
})();
