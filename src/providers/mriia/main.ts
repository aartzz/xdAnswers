// src/providers/mriia/main.ts
// Mriia provider entry: watches test & homework questions, auto-answers choices/inputs.
import type { MriiaDomApi } from './dom';
import { applyMriiaChoiceAnswer, applyMriiaTextAnswer } from './autoanswer';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
    const dom = modules.mriia?.dom as MriiaDomApi | undefined;

    let lastQuestionKey = '';
    let isProcessing = false;

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initMriia();
        }
    }, 50);

    function initMriia() {
        if (!dom) {
            console.warn('[xdAnswers] Mriia: dom module missing');
            return;
        }
        const domApi = dom;

        window.xdAnswers.onRefresh = () => {
            lastQuestionKey = '';
            checkQuestion();
        };

        setInterval(checkQuestion, 800);

        function checkQuestion() {
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
                    questionType: state.questionType,
                    isMulti: state.isMulti
                });

                if (state.questionType === 'choice') {
                    window.xdAnswers._customAutoAnswer = function(answerText) {
                        applyMriiaChoiceAnswer(state.container, answerText);
                        window.xdAnswers._customAutoAnswer = null;
                    };
                } else if (state.questionType === 'text' && state.inputElement) {
                    window.xdAnswers._customAutoAnswer = function(answerText) {
                        if (state.inputElement) {
                            applyMriiaTextAnswer(state.inputElement, answerText);
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
