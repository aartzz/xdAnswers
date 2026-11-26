// src/providers/classtime/main.ts
// Classtime provider entry: detects the active student question, builds the AI
// payload for every Classtime question kind and installs the matching applier.
import type { ClasstimeDomApi, ClasstimeQuestionState } from './dom';

(function() {
    'use strict';

    const modules = window.xdAnswers._internal.providerModules;
    const domApi = (modules && modules.classtime && modules.classtime.dom) as ClasstimeDomApi | undefined;

    let lastQuestionKey = '';
    let lastQuestionSignature = '';
    let isChecking = false;
    let checkScheduled = false;

    const waitForUtils = setInterval(async function() {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initClasstime();
        }
    }, 50);

    function buildQuestionData(state: ClasstimeQuestionState, images: string[]): XdQuestionData {
        return {
            text: state.text,
            optionsText: state.options.length > 0 ? state.options.join('\n') : undefined,
            base64Images: images,
            questionType: state.questionType,
            isMulti: state.isMulti || undefined,
            hasImages: images.length > 0
        };
    }

    function initClasstime(): void {
        if (!domApi) {
            console.warn('[xdAnswers] Classtime: dom module missing');
            return;
        }

        // Show helper window when session is active.
        if (!window.xdAnswers.settings.silentMode) {
            window.xdAnswers.createUI();
            window.xdAnswers.attachAndPositionHelper();
        }

        window.xdAnswers.onRefresh = function() {
            lastQuestionKey = '';
            lastQuestionSignature = '';
            void checkQuestion();
        };

        function scheduleCheck(): void {
            if (checkScheduled) return;
            checkScheduled = true;
            window.setTimeout(function() {
                checkScheduled = false;
                void checkQuestion();
            }, 250);
        }

        const observer = new MutationObserver(scheduleCheck);
        observer.observe(document.body, { childList: true, subtree: true });

        setInterval(scheduleCheck, 1500);
        void checkQuestion();

        async function checkQuestion(): Promise<void> {
            if (!domApi || isChecking || window.xdAnswers.isProcessingAI) return;
            const signature = domApi.readSignature();
            if (!signature || signature === lastQuestionSignature) return;

            isChecking = true;
            try {
                const state = await domApi.readQuestion();
                if (!state) return;
                lastQuestionSignature = signature;
                const questionKey = state.key + '\u0000' + signature;
                if (questionKey === lastQuestionKey) return;
                lastQuestionKey = questionKey;

                const images = await domApi.loadImages(state.imageRoots);
                if (!domApi.isQuestionCurrent(state)) return;
                const questionData = buildQuestionData(state, images);

                // Every custom kind goes through the provider applier so text,
                // essays, sorting, gaps and hotspot clicks use the exact DOM
                // interaction the React components expect.
                window.xdAnswers._customAutoAnswer = function(answerText: string): void {
                    domApi!.applyAnswer(state, answerText);
                };

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const container = state.oneclickContainer || state.root;
                    if (container) {
                        window.xdAnswers.clearOneClickHandlers();
                        window.xdAnswers.setupOneClickHandler(container, async function() { return questionData; });
                    }
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            } catch (error) {
                console.warn('[xdAnswers] Classtime question detection failed:', error);
            } finally {
                isChecking = false;
            }
        }
    }
})();
