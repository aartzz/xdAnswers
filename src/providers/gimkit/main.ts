// src/providers/gimkit/main.ts
// Gimkit provider entry: polls game questions, auto-inputs text answers and feeds choices to AI.
import type { GimkitDomApi } from './dom';
import { applyGimkitAnswer } from './autoanswer';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
    const dom = modules.gimkit?.dom as GimkitDomApi | undefined;

    let lastQuestionKey = '';
    let isProcessing = false;

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initGimkit();
        }
    }, 50);

    function initGimkit() {
        if (!dom) {
            console.warn('[xdAnswers] Gimkit: dom module missing');
            return;
        }
        const domApi = dom;

        function updateHelperVisibility() {
            if (window.xdAnswers.settings.silentMode) return;
            const q = domApi.readQuestion();
            const isGameActive = !!(q?.text && (q?.options.length > 0 || q?.inputElement));

            if (isGameActive) {
                if (!window.xdAnswers.helperContainer || !document.body.contains(window.xdAnswers.helperContainer)) {
                    window.xdAnswers.createUI();
                    window.xdAnswers.attachAndPositionHelper();
                } else {
                    window.xdAnswers.helperContainer.style.setProperty('display', 'flex', 'important');
                }
            } else if (window.xdAnswers.helperContainer) {
                window.xdAnswers.helperContainer.style.setProperty('display', 'none', 'important');
            }
        }

        updateHelperVisibility();

        window.xdAnswers.onRefresh = () => {
            lastQuestionKey = '';
            checkQuestion();
        };

        const observer = new MutationObserver(() => {
            if (window.xdAnswers.isExtensionModifyingDOM) return;
            updateHelperVisibility();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setInterval(checkQuestion, 700);

        function checkQuestion() {
            updateHelperVisibility();
            if (isProcessing || window.xdAnswers.isProcessingAI) return;

            const state = domApi.readQuestion();
            if (!state || !state.text) return;
            if (state.options.length === 0 && !state.inputElement) return;

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

                if (state.questionType === 'text' && state.inputElement) {
                    window.xdAnswers._customAutoAnswer = function(answerText) {
                        if (state.inputElement) {
                            applyGimkitAnswer(state.inputElement, answerText);
                        }
                        window.xdAnswers._customAutoAnswer = null;
                    };
                } else {
                    window.xdAnswers._customAutoAnswer = null;
                }

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
