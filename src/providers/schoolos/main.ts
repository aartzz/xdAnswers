// src/providers/schoolos/main.ts
// SchoolOS INTEGRITY provider entry: watches the exam card, forwards the current
// question to the AI pipeline and applies the answer through the pointerdown
// path the site expects.
import type { SchoolosDomApi, SchoolosQuestionState } from './dom';
import { applySchoolosAnswer } from './autoanswer';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    let lastQuestionKey = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initSchoolos();
        }
    }, 50);

    function initSchoolos(): void {
        const domApi = window.xdAnswers._internal.providerModules?.schoolos?.dom as SchoolosDomApi | undefined;
        if (!domApi) {
            console.warn('[xdAnswers] schoolos: dom module missing');
            return;
        }
        const api: SchoolosDomApi = domApi;

        window.xdAnswers.onRefresh = () => {
            lastQuestionKey = '';
            checkQuestion();
        };

        const observer = new MutationObserver(() => checkQuestion());
        observer.observe(document.body, { childList: true, subtree: true });

        setInterval(checkQuestion, 1000);
        checkQuestion();

        function questionKey(state: SchoolosQuestionState): string {
            const counter = document.querySelector('#barCounter')?.textContent || '';
            return JSON.stringify([counter, state.text, state.options]);
        }

        function buildQuestionData(state: SchoolosQuestionState, images: string[]): XdQuestionData {
            return {
                text: state.text,
                optionsText: state.options.length > 0 ? state.options.join('\n') : undefined,
                base64Images: images,
                questionType: state.questionType,
                isMulti: state.isMultiple
            };
        }

        function installApplier(state: SchoolosQuestionState): void {
            const expectedKey = questionKey(state);
            window.xdAnswers._customAutoAnswer = (answerText: string): void => {
                const current = api.readQuestion();
                if (!current || questionKey(current) !== expectedKey) return;
                applySchoolosAnswer(answerText);
            };
        }

        function checkQuestion(): void {
            if (window.xdAnswers.isProcessingAI) return;

            const state = api.readQuestion();
            if (!state) return;

            const key = questionKey(state);
            if (key === lastQuestionKey) return;
            lastQuestionKey = key;

            api.loadImages(state.imageUrls).then(images => {
                const questionData = buildQuestionData(state, images);
                installApplier(state);

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const container = state.container;
                    if (!container) return;
                    window.xdAnswers.clearOneClickHandlers();
                    window.xdAnswers.setupOneClickHandler(container, async () => {
                        const current = api.readQuestion() || state;
                        installApplier(current);
                        const currentImages = await api.loadImages(current.imageUrls);
                        return buildQuestionData(current, currentImages);
                    });
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            });
        }
    }
})();
