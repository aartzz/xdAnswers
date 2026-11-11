// src/providers/amplify/main.ts
// Amplify Classroom provider entry: watches the current Desmos activity screen
// and forwards its question to the shared AI pipeline.
import type { AmplifyDomApi, AmplifyQuestionState } from './dom';
import { applyAmplifyAnswer } from './autoanswer';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    let lastQuestionKey = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initAmplify();
        }
    }, 50);

    function initAmplify(): void {
        const domApi = window.xdAnswers._internal.providerModules?.amplify?.dom as AmplifyDomApi | undefined;
        if (!domApi) {
            console.warn('[xdAnswers] amplify: dom module missing');
            return;
        }
        const api: AmplifyDomApi = domApi;

        window.xdAnswers.onRefresh = () => {
            lastQuestionKey = '';
            checkQuestion();
        };

        const observer = new MutationObserver(() => checkQuestion());
        observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

        setInterval(checkQuestion, 800);
        checkQuestion();

        function questionKey(state: AmplifyQuestionState): string {
            return JSON.stringify([
                state.screenId,
                state.kind,
                state.text,
                state.options,
                state.isMultiple,
                state.imageUrls,
                state.inlineFields.map(field => [field.id, field.kind, field.options]),
                state.hotTexts.map(hot => [hot.id, hot.text]),
                state.reorderItems.length,
                !!state.sliderThumb
            ]);
        }

        function cacheScope(): string | undefined {
            const match = location.pathname.match(/\/instance\/([^/]+)/);
            return match ? `amplify:${match[1]}` : undefined;
        }

        function canvasImages(state: AmplifyQuestionState): string[] {
            const images: string[] = [];
            for (const canvas of state.canvasElements || []) {
                try {
                    const data = canvas.toDataURL('image/png');
                    if (data.startsWith('data:image/')) images.push(data.split(',', 2)[1]);
                } catch (e) { /* tainted or unavailable */ }
            }
            return images;
        }

        function buildQuestionData(state: AmplifyQuestionState, images: string[]): XdQuestionData {
            const allImages = [...canvasImages(state), ...images];
            return {
                text: state.text,
                optionsText: state.options.length > 0 ? state.options.join('\n') : undefined,
                base64Images: allImages,
                questionType: state.questionType,
                isMulti: state.isMultiple || undefined,
                hasImages: allImages.length > 0 || undefined,
                cacheScope: cacheScope(),
                batchKey: state.screenId || undefined
            };
        }

        function installApplier(state: AmplifyQuestionState): void {
            const expectedKey = questionKey(state);
            window.xdAnswers._customAutoAnswer = (answerText: string, parsed: XdParsedResponse): void => {
                const current = api.readQuestion();
                if (!current || questionKey(current) !== expectedKey) return;
                applyAmplifyAnswer(current, answerText, parsed);
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
                const current = api.readQuestion();
                if (!current || questionKey(current) !== key) return;

                const questionData = buildQuestionData(current, images);
                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                const shouldAuto = isOneClick || window.xdAnswers.settings.autoAnswer;
                if (shouldAuto) installApplier(current);

                if (isOneClick) {
                    const container = current.container;
                    if (!container) return;
                    window.xdAnswers.clearOneClickHandlers();
                    window.xdAnswers.setupOneClickHandler(container, async () => {
                        const fresh = api.readQuestion() || current;
                        const freshImages = await api.loadImages(fresh.imageUrls);
                        return buildQuestionData(fresh, freshImages);
                    });
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            });
        }
    }
})();
