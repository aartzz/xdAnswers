// src/providers/blooket/main.ts
// Blooket provider entry: watches #app mutations, auto-dismisses feedback and feeds questions to AI.
import type { BlooketDomApi } from './dom';
import { dismissFeedback } from './autoanswer';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
    const dom = modules.blooket?.dom as BlooketDomApi | undefined;

    let lastQuestionKey = '';
    let isProcessing = false;

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initBlooket();
        }
    }, 50);

    function initBlooket() {
        if (!dom) {
            console.warn('[xdAnswers] Blooket: dom module missing');
            return;
        }
        const domApi = dom;

        window.xdAnswers.onRefresh = () => {
            lastQuestionKey = '';
            checkQuestion();
        };

        // MutationObserver on #app or document.body for fast game response
        const target = document.querySelector('#app') || document.body;
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const observer = new MutationObserver(() => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(checkQuestion, 120);
        });

        observer.observe(target, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'disabled']
        });

        setInterval(checkQuestion, 800);

        function checkQuestion() {
            if (isProcessing || window.xdAnswers.isProcessingAI) return;

            const state = domApi.readQuestion();
            if (!state) return;

            // Auto-advance on feedback overlay
            if (state.feedbackEl && window.xdAnswers.settings.autoSubmit) {
                dismissFeedback(state.feedbackEl);
            }

            if (!state.text || state.options.length === 0) return;

            const currentKey = `${state.text}|${state.options.join(',')}`;
            if (currentKey === lastQuestionKey) return;
            lastQuestionKey = currentKey;

            isProcessing = true;

            domApi.loadImages(state.imageUrls).then(images => {
                const buildQuestionData = (): XdQuestionData => ({
                    text: state.text,
                    optionsText: state.options.length > 0 ? state.options.join('\n') : undefined,
                    base64Images: images,
                    questionType: state.questionType
                });

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const container = state.container || document.body;
                    if (!container.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.setupOneClickHandler(container, async () => buildQuestionData());
                    }
                    isProcessing = false;
                } else {
                    window.xdAnswers.processQuestion(buildQuestionData()).finally(() => {
                        isProcessing = false;
                    });
                }
            }).catch(() => {
                isProcessing = false;
            });
        }
    }
})();
