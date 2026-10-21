// src/ai/process/main.ts
// Main question processing pipeline. Runs consensus or a single streamed answer and applies the result.
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

        const isSilent = silentMode !== '';

        if (!isSilent) {
            window.xdAnswers.createUI();
            window.xdAnswers.attachAndPositionHelper();
        }

        window.xdAnswers.isProcessingAI = true;
        const startTime = Date.now();

        if (!isSilent) I.startWaitingStatus(startTime);

        try {
            let result: XdStreamAnswerResult;
            const _cs = window.xdAnswers.settings.consensus;
            console.log('[xdAnswers] consensus check:', JSON.stringify(_cs));
            const consensusEnabled = _cs && _cs.enabled && _cs.runs && _cs.runs.length >= 1;
            if (consensusEnabled) {
                await I.runConsensusProcess(questionData, startTime, isSilent, silentMode);
                return;
            }
            try {
                result = await window.xdAnswers.streamAnswer(questionData, startTime);
            } catch (streamErr) {
                console.warn('xdAnswers: Streaming failed, falling back:', (streamErr as Error).message);
                const answer = await window.xdAnswers.getAnswer(questionData);
                result = { content: answer, thinking: '' };
            }

            if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }

            const elapsed = I.getProcessElapsed(startTime);
            const parsed = I.parseAIResponse(result.content);
            window.xdAnswers.lastParsedResponse = parsed;

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
            if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
            if (!isSilent && window.xdAnswers.answerContentDiv) {
                const errHtml = I.formatError((error as Error).message);
                window.xdAnswers.answerContentDiv.innerHTML = errHtml;
            }
        } finally {
            window.xdAnswers.isProcessingAI = false;
            window.xdAnswers._oneClickContainer = null;
        }
    };
})();
