// src/providers/lcloud/main.ts
// lcloud.in.ua provider entry: watches for question changes and builds the AI payload.
import type { LcloudDomApi, LcloudQuestionState } from './dom';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initLcloud();
        }
    }, 50);

    function initLcloud() {
        const domApi = window.xdAnswers._internal.providerModules?.lcloud?.dom as LcloudDomApi;
        if (!domApi) {
            console.warn('[xdAnswers] lcloud: dom module missing');
            return;
        }

        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        // Use MutationObserver for dynamic SPA content
        const observer = new MutationObserver(() => checkQuestion());
        observer.observe(document.body, { childList: true, subtree: true });

        // Fallback polling
        setInterval(checkQuestion, 1000);

        function buildQuestionData(state: LcloudQuestionState, images: string[]): XdQuestionData {
            return {
                text: state.text,
                optionsText: state.options.length > 0 ? state.options.join('\n') : undefined,
                base64Images: images,
                questionType: state.questionType
            };
        }

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            const state = domApi.readQuestion();
            if (!state || state.text === lastQuestionText) return;
            lastQuestionText = state.text;

            domApi.loadImages(state.imageUrls).then(images => {
                const questionData = buildQuestionData(state, images);

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const container = state.container;
                    if (container && !container.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.clearOneClickHandlers();
                        window.xdAnswers.setupOneClickHandler(container, async () => questionData);
                    }
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            });
        }
    }
})();
