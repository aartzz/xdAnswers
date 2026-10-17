// src/providers/quizlet/main.ts
// Quizlet provider entry: polls for question changes and feeds them to the AI pipeline.
import type { QuizletDomApi } from './dom';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
    const dom = modules.quizlet?.dom as QuizletDomApi | undefined;

    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initQuizlet();
        }
    }, 50);

    function initQuizlet() {
        if (!dom) {
            console.warn('[xdAnswers] Quizlet: dom module missing');
            return;
        }
        const domApi = dom;

        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        // Poll for question changes
        setInterval(checkQuestion, 800);

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            const state = domApi.readQuestion();
            if (!state || !state.text || state.text === lastQuestionText) return;
            lastQuestionText = state.text;

            domApi.loadImages(state.imageUrls).then(images => {
                const buildQuestionData = (): XdQuestionData => ({
                    text: state.text,
                    optionsText: state.options.length > 0 ? state.options.join('\n') : undefined,
                    base64Images: images,
                    questionType: state.questionType
                });

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const container = state.container;
                    if (container && !container.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.setupOneClickHandler(container, async () => buildQuestionData());
                    }
                } else {
                    window.xdAnswers.processQuestion(buildQuestionData());
                }
            });
        }
    }
})();
