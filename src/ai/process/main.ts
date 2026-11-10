// src/ai/process/main.ts
// Main question processing pipeline. Runs consensus or a single streamed answer and applies the result.
import { incrementStat } from '../../core/stats';
import { buildAnswerCacheKey, lookupAnswerCache, storeAnswerCache } from '../../core/answer-cache';
import type { XdCachedAnswer } from '../../core/answer-cache';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

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

            let result: XdStreamAnswerResult;
            const _cs = settings.consensus;
            console.log('[xdAnswers] consensus check:', JSON.stringify(_cs));
            const consensusEnabled = _cs && _cs.enabled && _cs.runs && _cs.runs.length >= 1;
            if (!cached) {
                if (consensusEnabled) {
                    const consensusParsed = await I.runConsensusProcess(questionData, startTime, isSilent, silentMode, generation);
                    if (consensusParsed && cacheKey) void storeAnswerCache(cacheKey, consensusParsed, settings, { force: bypassCache }).catch(() => {});
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

            if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
            if (window.xdAnswers._streamTimerInterval) { clearInterval(window.xdAnswers._streamTimerInterval); window.xdAnswers._streamTimerInterval = null; }

            const elapsed = I.getProcessElapsed(startTime);
            const parsed: XdParsedResponse = cached
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
            window.xdAnswers.lastParsedResponse = parsed;
            if (parsed.answer) {
                incrementStat('answered');
                if (!cached && cacheKey) void storeAnswerCache(cacheKey, parsed, settings, { force: bypassCache }).catch(() => {});
            }

            if (isSilent) {
                I.applySilentMode(parsed.answer || parsed.explanation || 'Parse error', parsed);
            } else {
                I.renderSingleResult(result, parsed, elapsed);
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
