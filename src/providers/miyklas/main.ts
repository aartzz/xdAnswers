// src/providers/miyklas/main.ts
// Miyklas provider entry: watches the page and forwards questions to the AI pipeline.
import type { MiyklasDomApi } from './dom';

(function() {
    'use strict';

    const modules = window.xdAnswers._internal.providerModules;
    const domApi = (modules && modules.miyklas && modules.miyklas.dom) as MiyklasDomApi;

    let lastQuestionText = '';

    const waitForUtils = setInterval(async function() {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initMiyklas();
        }
    }, 50);

    function initMiyklas(): void {
        if (!domApi) {
            console.warn('[xdAnswers] Miyklas: dom module missing');
            return;
        }

        window.xdAnswers.onRefresh = function() { lastQuestionText = ''; checkQuestion(); };

        setInterval(checkQuestion, 800);

        function checkQuestion(): void {
            if (window.xdAnswers.isProcessingAI) return;

            const state = domApi.readQuestion();
            if (!state) return;
            if (state.text === lastQuestionText) return;
            lastQuestionText = state.text;

            domApi.loadImages().then(function(images) {
                const questionData: XdQuestionData = {
                    text: state.text,
                    base64Images: images,
                    questionType: state.questionType
                };

                // Install custom applier for dragdrop or text inputs
                if (state.fields.length > 0 && state.options.length > 0) {
                    window.xdAnswers._customAutoAnswer = function(answerText) {
                        domApi.applyDndAnswer(answerText);
                        window.xdAnswers._customAutoAnswer = null;
                    };
                } else if (state.inputIds.length > 0) {
                    window.xdAnswers._customAutoAnswer = function(answerText) {
                        domApi.applyInputsAnswer(answerText);
                        window.xdAnswers._customAutoAnswer = null;
                    };
                } else {
                    window.xdAnswers._customAutoAnswer = null;
                }

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const container = document.getElementById(state.fields[0])?.closest('.question, [data-testid="question"]') as HTMLElement | null
                        || document.body;
                    if (!container.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.clearOneClickHandlers();
                        window.xdAnswers.setupOneClickHandler(container, async function() { return questionData; });
                    }
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            });
        }
    }
})();
