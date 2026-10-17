// src/providers/szkolawchmurze/main.ts
// Szkola w Chmurze provider entry: polls for question changes and feeds them to the AI pipeline.
import type { SzkolawchmurzeDomApi } from './dom';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
    const dom = modules.szkolawchmurze?.dom as SzkolawchmurzeDomApi | undefined;

    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initSzkolaWChmurze();
        }
    }, 50);

    function initSzkolaWChmurze() {
        if (!dom) {
            console.warn('[xdAnswers] Szkola w Chmurze: dom module missing');
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
                // The oneclick payload intentionally mirrors the original shape, which omitted isMultiple.
                const buildQuestionData = (includeMultiple: boolean): XdQuestionData => {
                    const data: XdQuestionData = {
                        text: state.text,
                        optionsText: state.options.length > 0 ? state.options.join('\n') : undefined,
                        base64Images: images,
                        questionType: state.questionType
                    };
                    if (includeMultiple) data.isMultiple = state.isMultiple;
                    return data;
                };

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const container = state.container;
                    if (container && !container.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.setupOneClickHandler(container, async () => buildQuestionData(false));
                    }
                } else {
                    window.xdAnswers.processQuestion(buildQuestionData(true));
                }
            });
        }
    }
})();
