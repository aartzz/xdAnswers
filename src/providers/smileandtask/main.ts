// src/providers/smileandtask/main.ts
// S&T School provider entry: watches the question card of the test player and
// forwards it to the shared answer pipeline. The player only keeps one question
// on screen and re-renders it on every click, so the watcher keys on the question
// number, text and options rather than on DOM identity.
import type { SmileAndTaskDomApi, StQuestionState } from './dom';
import { applySmileAndTaskAnswer } from './autoanswer';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    let lastQuestionKey = '';
    let imageEpoch = 0;
    let revealing = false;

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initSmileAndTask();
        }
    }, 50);

    function initSmileAndTask(): void {
        const domApi = window.xdAnswers._internal.providerModules?.smileandtask?.dom as SmileAndTaskDomApi | undefined;
        if (!domApi) {
            console.warn('[xdAnswers] smileandtask: dom module missing');
            return;
        }
        const api: SmileAndTaskDomApi = domApi;

        window.xdAnswers.onRefresh = () => {
            lastQuestionKey = '';
            imageEpoch++;
            window.xdAnswers._customAutoAnswer = null;
            if (window.xdAnswers.settings.silentMode === 'oneclick') {
                window.xdAnswers.clearOneClickHandlers();
            }
            void checkQuestion();
        };

        const observer = new MutationObserver(() => { void checkQuestion(); });
        observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

        setInterval(() => { void checkQuestion(); }, 800);
        void checkQuestion();

        function optionLetter(index: number): string {
            return String.fromCharCode(65 + index);
        }

        function buildOptionsText(state: StQuestionState): string | undefined {
            switch (state.kind) {
                case 'choice':
                case 'multi': {
                    const lines = state.options.map((option, index) => `${optionLetter(index)}: ${option.text}`);
                    if (state.kind === 'multi' && state.limit) {
                        lines.push(`(Потрібно обрати рівно ${state.limit} варіанти(ів).)`);
                    }
                    return lines.join('\n');
                }
                case 'matching': {
                    const rows = state.matchRows.map((row, index) => `${index + 1}. ${row.text}`).join('\n');
                    const rights = state.matchRights.map(right => `- ${right.text}`).join('\n');
                    return `Рядки:\n${rows}\nВаріанти:\n${rights}`;
                }
                case 'ordering':
                    return state.orderItems.map(item => `- ${item.text}`).join('\n');
                case 'multi_text':
                    return state.textInputs
                        .map((input, index) => `${index + 1}. ${input.label || `Поле ${index + 1}`}`)
                        .join('\n');
                case 'text':
                default:
                    return undefined;
            }
        }

        function questionType(state: StQuestionState): string | undefined {
            switch (state.kind) {
                case 'choice': return 'quiz';
                case 'multi': return 'multiquiz';
                case 'matching': return 'match_pairs';
                case 'ordering': return 'ordering';
                case 'multi_text': return 'text_input_multi';
                case 'text': return 'short_text';
                default: return undefined;
            }
        }

        function cacheScope(): string | undefined {
            const testId = api.currentTestId();
            if (testId) return `smileandtask:${testId}`;
            const code = new URLSearchParams(location.search).get('code');
            if (code) return `smileandtask:${code}`;
            const topic = api.currentTopic();
            return topic ? `smileandtask:${topic}` : undefined;
        }

        function buildQuestionData(state: StQuestionState, images: string[]): XdQuestionData {
            return {
                text: state.text,
                optionsText: buildOptionsText(state),
                base64Images: images,
                topic: api.currentTopic(),
                topicDescription: api.currentTopicDescription(),
                questionType: questionType(state),
                isMulti: state.kind === 'multi' ? true : undefined,
                hasImages: images.length > 0 || undefined,
                cacheScope: cacheScope()
            };
        }

        // Options behind hold-to-reveal may not have text until revealed, so they
        // only contribute their count when locked; this keeps the key stable across
        // the reveal step and the re-renders that follow every click.
        function questionKey(state: StQuestionState): string {
            return JSON.stringify([
                state.number,
                state.kind,
                state.text,
                state.options.map(option => (option.lock ? '' : option.text)),
                state.textInputs.map(input => input.label),
                state.matchRows.map(row => row.text),
                state.matchRights.map(right => right.text),
                state.orderItems.map(item => item.text)
            ]);
        }

        // Read the question again and make sure hidden options are revealed.
        async function readReady(expectedKey?: string): Promise<StQuestionState | null> {
            let state = api.readQuestion();
            if (!state) return null;
            if (state.needsReveal) {
                revealing = true;
                try {
                    await api.revealOptions(state);
                } finally {
                    revealing = false;
                }
                state = api.readQuestion();
                if (!state) return null;
            }
            if (expectedKey && questionKey(state) !== expectedKey) return null;
            return state;
        }

        function installApplier(state: StQuestionState): void {
            const expectedKey = questionKey(state);
            window.xdAnswers._customAutoAnswer = (answerText: string): void => {
                const current = api.readQuestion();
                if (!current || questionKey(current) !== expectedKey) return;
                // The revealed texts live in the DOM reader's cache, so a re-read
                // keeps them; the applier re-reads between clicks the same way.
                applySmileAndTaskAnswer(current, answerText, () => api.readQuestion());
            };
        }

        async function checkQuestion(): Promise<void> {
            if (window.xdAnswers.isProcessingAI || revealing) return;

            const state = api.readQuestion();
            if (!state) return;

            const key = questionKey(state);
            if (key === lastQuestionKey) return;
            lastQuestionKey = key;
            const epoch = ++imageEpoch;

            try {
                const ready = await readReady(key);
                if (!ready || epoch !== imageEpoch) return;
                if (ready.options.length > 0 && ready.options.every(option => !option.text)) return;

                const images = await api.loadImages(ready.imageUrls);
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
                        const fresh = (await readReady()) || current;
                        const freshImages = await api.loadImages(fresh.imageUrls);
                        installApplier(fresh);
                        window.xdAnswers._answerContainer = fresh.container;
                        return buildQuestionData(fresh, freshImages);
                    });
                } else {
                    window.xdAnswers._answerContainer = current.container;
                    window.xdAnswers.processQuestion(questionData)
                        .catch(error => console.error('[xdAnswers] smileandtask: processQuestion failed:', error))
                        .finally(() => {
                            if (window.xdAnswers._answerContainer === current.container) {
                                window.xdAnswers._answerContainer = null;
                            }
                        });
                }
            } catch (error) {
                console.error('[xdAnswers] smileandtask: question handling failed:', error);
            }
        }
    }
})();
