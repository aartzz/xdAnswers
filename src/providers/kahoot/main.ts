// src/providers/kahoot/main.ts
// Kahoot provider entry: polling, character-by-character numeric/text input, one-click mode.
import type { KahootDomApi, KahootQuestionState } from './dom';
import { applyKahootAnswer } from './autoanswer';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    let lastQuestionText = '';
    let kahootContainer: HTMLElement | null = null;  // scoped container for current question

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initKahoot();
        }
    }, 50);

    function initKahoot() {
        const domApi = window.xdAnswers._internal.providerModules?.kahoot?.dom as KahootDomApi;
        if (!domApi) {
            console.warn('[xdAnswers] kahoot: dom module missing');
            return;
        }

        // Show helper window when game page is active
        if (!window.xdAnswers.settings.silentMode) {
            window.xdAnswers.createUI();
            window.xdAnswers.attachAndPositionHelper();
        }

        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        // Poll for question changes — Kahoot is highly dynamic
        setInterval(checkQuestion, 800);

        function buildQuestionData(state: KahootQuestionState, images: string[]): XdQuestionData {
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

            // Store container for answer-time use
            kahootContainer = state.container;

            domApi.loadImages(state.imageUrls).then(function(images) {
                const questionData = buildQuestionData(state, images);

                // ── Custom auto-answer: character-by-character input for numeric/text answers ──
                // Kahoot tracks KEYDOWN/KEYUP timing. Direct value assignment is detectable.
                // InRoute uses 15ms/char + 400ms dot animation buffer.
                const inputEl = domApi.findInputElement();

                if (inputEl) {
                    // Numeric/text answer question — install character-by-character applier
                    window.xdAnswers._answerContainer = kahootContainer;
                    window.xdAnswers._customAutoAnswer = function(answerText) {
                        const input = domApi.findInputElement();
                        if (!input) {
                            window.xdAnswers._internal.autoSelectAnswer(answerText, true);
                            return;
                        }
                        applyKahootAnswer(input, answerText);
                    };
                } else {
                    // MCQ question — clear any previous custom applier
                    window.xdAnswers._customAutoAnswer = null;
                }

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const container = state.container;
                    if (container && !container.classList.contains('xd-oneclick-ready')) {
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
