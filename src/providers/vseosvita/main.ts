// src/providers/vseosvita/main.ts
// vseosvita provider entry (vseosvita.ua test pages): detects the current question,
// wires the one-click handler or auto-processes it through the AI pipeline.
// Extraction lives in ./dom.ts, answer application in ./apply.ts; the topic
// sniffing fetch/XHR patches live in ./disabler.ts (page world) and post the
// sniffed topic/description through a window.postMessage bridge.
import type { VseosvitaDomApi } from './dom';
import type { VseosvitaApplyApi } from './autoanswer';

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    const modules = I.providerModules || (I.providerModules = {});
    const vseosvitaModules = modules.vseosvita || (modules.vseosvita = {});
    const dom = vseosvitaModules.dom as VseosvitaDomApi;
    const applyApi = vseosvitaModules.apply as VseosvitaApplyApi;

    // Sniffed test topic/description arrive from the page-world disabler.
    let _vseosvitaTopic: string | null = null;
    let _vseosvitaDescription: string | null = null;

    window.addEventListener('message', function (event) {
        if (event.source !== window) return;
        const data = event.data as { source?: string; provider?: string; type?: string; topic?: string | null; description?: string | null } | null;
        if (!data || data.source !== 'xd-disabler' || data.provider !== 'vseosvita' || data.type !== 'topic') return;
        if (typeof data.topic === 'string' && data.topic.trim()) _vseosvitaTopic = data.topic.trim();
        if (typeof data.description === 'string' && data.description.trim()) _vseosvitaDescription = data.description.trim();
    });

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initVseosvita();
        }
    }, 50);

    function initVseosvita(): void {
        let lastProcessedKey = "";
        let debounceTimer: number | undefined;

        window.xdAnswers.onRefresh = () => {
            lastProcessedKey = "";
            checkQuestion(true);
        };

        function checkQuestion(force = false): void {
            if (window.xdAnswers.isProcessingAI && !force) return;
            const questionData = dom.detectQuestionData();
            if (!questionData) return;

            const keyOptions = ['ordering', 'matching'].includes(questionData.questionType)
                ? [...questionData.options].sort((a, b) => a.localeCompare(b, 'uk'))
                : questionData.options;

            const currentKey = JSON.stringify({
                text: questionData.text,
                options: keyOptions,
                type: questionData.questionType,
                images: questionData.base64ImageSources,
                // Include premium format signature so question-change detection fires
                // when the same wrapper hosts a different premium question.
                premium: questionData.vseosvitaMeta
                    ? questionData.vseosvitaMeta.formatType + ':' + (questionData.vseosvitaMeta.dataQuestType || '')
                    : null
            });

            if (!force && currentKey === lastProcessedKey) return;
            lastProcessedKey = currentKey;

            const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';

            if (isOneClick) {
                // One-click mode: register click handler instead of auto-processing.
                // Vseosvita reuses the same container DOM element for each question,
                // so we must always re-register when the question key changes
                const container = questionData.root;
                if (container) {
                    window.xdAnswers.clearOneClickHandlers();
                    // Capture current question data for click-time processing
                    const savedText = questionData.text;
                    const savedOptionsText = questionData.optionsText;
                    const savedImageUrls = questionData.base64ImageSources;
                    const savedQuestionType = questionData.questionType;
                    const savedIsMultiQuiz = questionData.isMultiQuiz;
                    const savedIsMulti = questionData.isMulti;
                    const savedMeta = questionData.vseosvitaMeta;
                    window.xdAnswers.setupOneClickHandler(container as HTMLElement, async () => {
                        // Re-mark options in case DOM changed since last detection
                        dom.markOptionElements(container);
                        // Install custom applier ONLY at click time so it's fresh
                        // and doesn't leak across questions.
                        applyApi.installCustomApplier(savedMeta);
                        const images = await Promise.all(savedImageUrls.map(src => window.xdAnswers.imageToBase64(src)));
                        return {
                            text: savedText,
                            optionsText: savedOptionsText,
                            base64Images: images.filter(Boolean) as string[],
                            questionType: savedQuestionType,
                            isMultiQuiz: savedIsMultiQuiz,
                            isMulti: savedIsMulti,
                            topic: _vseosvitaTopic || undefined,
                            topicDescription: _vseosvitaDescription || undefined
                        };
                    });
                }
                window.xdAnswers.attachAndPositionHelper();
            } else {
                // Normal: auto-process
                // Install custom applier right before processQuestion consumes it.
                applyApi.installCustomApplier(questionData.vseosvitaMeta);
                const imgPromises = questionData.base64ImageSources.map(src => window.xdAnswers.imageToBase64(src));
                Promise.all(imgPromises).then(images => {
                    // Guard against race: isProcessingAI may have flipped since checkQuestion started
                    if (window.xdAnswers.isProcessingAI) {
                        console.log('[xdAnswers vseosvita] Skipping duplicate processQuestion — already processing');
                        return;
                    }
                    window.xdAnswers.processQuestion({
                        text: questionData.text,
                        optionsText: questionData.optionsText,
                        base64Images: images.filter(Boolean) as string[],
                        questionType: questionData.questionType,
                        isMultiQuiz: questionData.isMultiQuiz,
                        isMulti: questionData.isMulti,
                        topic: _vseosvitaTopic || undefined,
                        topicDescription: _vseosvitaDescription || undefined
                    });
                    window.xdAnswers.attachAndPositionHelper();
                });
            }
        }

        const observer = new MutationObserver(() => {
            if (window.xdAnswers.isExtensionModifyingDOM) return;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => checkQuestion(false), 250);
            // Only re-attach if container was removed from DOM (e.g. Vue re-render);
            // do NOT call attachAndPositionHelper unconditionally — it clears transform
            // and resets position, which breaks dragging during AI processing.
            if (window.xdAnswers.helperContainer && !window.xdAnswers.helperContainer.parentNode) {
                window.xdAnswers.attachAndPositionHelper();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        checkQuestion();

        // Polling fallback: vseosvita reuses the same container DOM element (Vue),
        // so MutationObserver may miss subtle question transitions.
        // This ensures new questions are detected within 1 second max.
        setInterval(() => checkQuestion(false), 1000);
    }
})();
