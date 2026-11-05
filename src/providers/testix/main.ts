// src/providers/testix/main.ts
// Testix provider entry: watches the active question form and forwards it to
// the shared answer pipeline. Testix renders all questions up front, so the
// watcher keys on the visible form's data-item-id and content.
import type { TestixDomApi, TestixQuestionState } from './dom';
import { applyTestixAnswer } from './autoanswer';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    let lastQuestionKey = '';
    let imageEpoch = 0;

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initTestix();
        }
    }, 50);

    function initTestix(): void {
        const domApi = window.xdAnswers._internal.providerModules?.testix?.dom as TestixDomApi | undefined;
        if (!domApi) {
            console.warn('[xdAnswers] testix: dom module missing');
            return;
        }
        const api: TestixDomApi = domApi;

        window.xdAnswers.onRefresh = () => {
            lastQuestionKey = '';
            imageEpoch++;
            window.xdAnswers._customAutoAnswer = null;
            if (window.xdAnswers.settings.silentMode === 'oneclick') {
                window.xdAnswers.clearOneClickHandlers();
            }
            checkQuestion();
        };

        const observer = new MutationObserver(() => checkQuestion());
        observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

        setInterval(checkQuestion, 800);
        checkQuestion();

        function topic(): string | undefined {
            const header = document.querySelector<HTMLElement>('p.truncate.text-sm.font-medium');
            const headerText = api.cleanText(header?.innerText || header?.textContent);
            if (headerText) return headerText;
            const title = api.cleanText(document.title);
            return title || undefined;
        }

        function optionLetter(index: number): string {
            return String.fromCharCode(65 + index);
        }

        function buildOptionsText(state: TestixQuestionState): string | undefined {
            switch (state.kind) {
                case 'matching': {
                    if (!state.matching) return undefined;
                    const rows = state.matching.lefts.map((left, index) => `${index + 1}. ${left.text}`).join('\n');
                    const rights = state.matching.rights.map(right => `- ${right.text}`).join('\n');
                    return `Рядки:\n${rows}\nВаріанти:\n${rights}`;
                }
                case 'choice':
                case 'multi':
                    return state.options
                        .map((option, index) => `${optionLetter(index)}: ${option.text}`)
                        .join('\n');
                case 'text_multi':
                    return state.textInputs
                        .map((input, index) => `${index + 1}. ${input.label}`)
                        .join('\n');
                case 'ordering':
                    return state.orderingItems
                        .map((item, index) => `${index + 1}. ${item.text}`)
                        .join('\n');
                case 'categorize': {
                    const bins = state.categoryBins.map(bin => `- ${bin.text}`).join('\n');
                    const items = state.orderingItems.map(item => `- ${item.text}`).join('\n');
                    return `Категорії:\n${bins}\nЕлементи:\n${items}`;
                }
                case 'text':
                default:
                    return undefined;
            }
        }

        function questionType(state: TestixQuestionState): string | undefined {
            switch (state.kind) {
                case 'matching': return 'match_pairs';
                case 'ordering': return 'order_words';
                case 'categorize': return 'categorization';
                case 'text': return 'short_text';
                case 'text_multi': return 'text_input_multi';
                case 'choice':
                case 'multi':
                default:
                    return undefined;
            }
        }

        function buildQuestionData(state: TestixQuestionState, images: string[]): XdQuestionData {
            return {
                text: state.text,
                optionsText: buildOptionsText(state),
                base64Images: images,
                topic: topic(),
                questionType: questionType(state),
                isMulti: state.kind === 'multi' ? true : undefined
            };
        }

        function questionKey(state: TestixQuestionState): string {
            return JSON.stringify([
                state.id,
                state.kind,
                state.text,
                state.options.map(option => [option.id, option.text]),
                state.textInputs.map(input => input.label),
                state.matching?.lefts.map(left => [left.id, left.text]) || [],
                state.matching?.rights.map(right => [right.id, right.text]) || [],
                state.orderingItems.map(item => [item.id, item.text]),
                state.categoryBins.map(bin => [bin.id, bin.text])
            ]);
        }

        function installApplier(state: TestixQuestionState): void {
            const expectedKey = questionKey(state);
            window.xdAnswers._customAutoAnswer = (answerText: string): void => {
                const current = api.readQuestion();
                if (!current || questionKey(current) !== expectedKey) return;
                applyTestixAnswer(current, answerText);
            };
        }

        function checkQuestion(): void {
            if (window.xdAnswers.isProcessingAI) return;

            const state = api.readQuestion();
            if (!state) return;

            const key = questionKey(state);
            if (key === lastQuestionKey) return;
            lastQuestionKey = key;
            const epoch = ++imageEpoch;

            api.loadImages(state.imageUrls).then(images => {
                if (epoch !== imageEpoch) return;

                // The student may have moved on while images were loading.
                const current = api.readQuestion();
                if (!current || questionKey(current) !== key) return;

                const questionData = buildQuestionData(current, images);
                installApplier(current);

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    window.xdAnswers.clearOneClickHandlers();
                    window.xdAnswers.setupOneClickHandler(current.container, async () => {
                        const fresh = api.readQuestion() || current;
                        const freshImages = await api.loadImages(fresh.imageUrls);
                        installApplier(fresh);
                        window.xdAnswers._answerContainer = fresh.container;
                        return buildQuestionData(fresh, freshImages);
                    });
                } else {
                    window.xdAnswers._answerContainer = current.container;
                    window.xdAnswers.processQuestion(questionData)
                        .catch(error => console.error('[xdAnswers] testix: processQuestion failed:', error))
                        .finally(() => {
                            if (window.xdAnswers._answerContainer === current.container) {
                                window.xdAnswers._answerContainer = null;
                            }
                        });
                }
            }).catch(error => {
                console.error('[xdAnswers] testix: image load failed:', error);
            });
        }
    }
})();
