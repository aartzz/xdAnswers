// src/providers/classtime/main.ts
// Classtime provider entry: watches the page and forwards questions to the AI pipeline.
import type { ClasstimeDomApi } from './dom';

(function() {
    'use strict';

    const modules = window.xdAnswers._internal.providerModules;
    const domApi = (modules && modules.classtime && modules.classtime.dom) as ClasstimeDomApi;

    let lastQuestionText = '';

    const waitForUtils = setInterval(async function() {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initClasstime();
        }
    }, 50);

    function initClasstime(): void {
        if (!domApi) {
            console.warn('[xdAnswers] Classtime: dom module missing');
            return;
        }

        // Show helper window when session is active
        if (!window.xdAnswers.settings.silentMode) {
            window.xdAnswers.createUI();
            window.xdAnswers.attachAndPositionHelper();
        }

        window.xdAnswers.onRefresh = function() { lastQuestionText = ''; checkQuestion(); };

        const observer = new MutationObserver(function() { checkQuestion(); });
        observer.observe(document.body, { childList: true, subtree: true });
        setInterval(checkQuestion, 1000);

        function checkQuestion(): void {
            if (window.xdAnswers.isProcessingAI) return;

            const state = domApi.readQuestion();
            if (!state) return;
            if (state.text === lastQuestionText) return;
            lastQuestionText = state.text;

            domApi.loadImages(state.imageContainer).then(function(images) {
                let text = state.text;

                const questionData: XdQuestionData = {
                    text: text,
                    optionsText: state.options.length > 0 ? state.options.join('\n') : undefined,
                    base64Images: images,
                    questionType: state.questionType
                };

                if (state.isCategorization) {
                    text = state.text + '\n\nКатегорії: ' + state.categories.join(', ') +
                        '\nЕлементи: ' + state.items.join(', ') +
                        '\n\nВкажи, який елемент до якої категорії належить (формат: "Назва категорії: елемент1, елемент2; Інша категорія: елемент3")';
                    questionData.text = text;
                    window.xdAnswers._customAutoAnswer = function(answerText) {
                        domApi.applyCategorization(answerText);
                        window.xdAnswers._customAutoAnswer = null;
                    };
                } else if (state.isDND) {
                    window.xdAnswers._customAutoAnswer = function() {
                        domApi.applyDndDrag();
                        window.xdAnswers._customAutoAnswer = null;
                    };
                } else {
                    window.xdAnswers._customAutoAnswer = null;
                }

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const cont = state.oneclickContainer;
                    if (cont && !cont.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.clearOneClickHandlers();
                        window.xdAnswers.setupOneClickHandler(cont, async function() { return questionData; });
                    }
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            });
        }
    }
})();
