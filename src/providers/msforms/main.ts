// src/providers/msforms/main.ts
// Microsoft Forms provider entry: scans question items, injects Solve buttons
// (or one-click handlers) and forwards questions to the AI pipeline.

import type { MsformsDomApi, MsformsQuestionType } from './dom';
import type { MsformsApplyApi } from './apply';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initMSForms();
        }
    }, 50);

    function initMSForms(): void {
        const modules = window.xdAnswers._internal.providerModules || {};
        const domApi = modules.msforms?.dom as MsformsDomApi;
        const applyApi = modules.msforms?.apply as MsformsApplyApi;
        if (!domApi || !applyApi) {
            console.warn('[xdAnswers] MS Forms: provider modules missing');
            return;
        }

        let lastQuestionHash = '';
        let debounceTimer: number | null = null;

        window.xdAnswers.onRefresh = () => {
            lastQuestionHash = '';
            scanQuestions();
        };

        // Listen for URL changes (MS Forms may navigate between pages via history API)
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'msform_url_changed') {
                lastQuestionHash = '';
                setTimeout(scanQuestions, 1500);
            }
            return true; // keep channel open for async responses
        });

        // ── Main scan ──

        function scanQuestions(): void {
            if (window.xdAnswers.isProcessingAI) return;

            const questionItems = document.querySelectorAll('[data-automation-id="questionItem"]');
            if (questionItems.length === 0) return;

            const currentHash = domApi.buildStateHash();
            if (currentHash === lastQuestionHash) return;
            lastQuestionHash = currentHash;

            // Clear old oneclick handlers when questions change
            if (window.xdAnswers.settings.silentMode === 'oneclick') {
                window.xdAnswers.clearOneClickHandlers();
            }

            // Remove old synthetic option spans and ranking badges from previous scan
            document.querySelectorAll('.xd-synthetic-option, .xd-ranking-badge').forEach(el => el.remove());
            // Remove old ranking highlights
            document.querySelectorAll('[role="option"]').forEach(el => {
                (el as HTMLElement).style.removeProperty('outline');
                (el as HTMLElement).style.removeProperty('border-radius');
            });

            const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';

            questionItems.forEach((questionItem) => {
                const item = questionItem as HTMLElement;
                const data = domApi.extractQuestionData(item);
                if (!data) return;

                // Mark option elements for findOptionElements/matchAnswerToOptions
                domApi.markOptionElements(item, data.type);

                if (isOneClick) {
                    // One-click mode: click on question triggers AI → auto-select
                    if (item.classList.contains('xd-oneclick-ready')) return;

                    // Capture data for click-time processing
                    const savedType: MsformsQuestionType = data.type;
                    const savedText = data.text;
                    const savedOptionsText = data.optionsText;
                    const savedImageUrls = data.base64ImageSources;
                    const savedQuestionType = data.questionType;
                    const savedIsMulti = data.isMulti;
                    const savedIsMultiQuiz = data.isMultiQuiz;
                    const savedItem: HTMLElement = data.questionItem;

                    window.xdAnswers.setupOneClickHandler(item, async () => {
                        // Re-mark options in case DOM changed
                        domApi.markOptionElements(savedItem, savedType);
                        // Set custom auto-answer for types that need special handling
                        if (savedType === 'likert' || savedType === 'ranking') {
                            window.xdAnswers._customAutoAnswer = (answerText) => {
                                if (savedType === 'likert') applyApi.autoAnswerLikert(savedItem, answerText);
                                else if (savedType === 'ranking') applyApi.autoAnswerRanking(savedItem, answerText);
                            };
                        }
                        const images = await Promise.all(savedImageUrls.map(src => window.xdAnswers.imageToBase64(src)));
                        return {
                            text: savedText,
                            optionsText: savedOptionsText,
                            base64Images: images.filter((x): x is string => !!x),
                            questionType: savedQuestionType,
                            isMulti: savedIsMulti,
                            isMultiQuiz: savedIsMultiQuiz
                        };
                    });
                } else {
                    // Normal mode: add Solve button per question
                    if (item.querySelector('.xd-solve-btn')) return;

                    const button = document.createElement('button');
                    button.className = 'xd-btn xd-solve-btn';
                    button.innerText = '✨ Solve';
                    button.style.cssText = 'background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.5);color:#6366f1;padding:6px 14px;border-radius:6px;cursor:pointer;margin-top:10px;font-family:system-ui,-apple-system,sans-serif;font-weight:600;font-size:13px;z-index:9999;position:relative;transition:all 0.15s;';

                    // Capture data for button click
                    const savedType: MsformsQuestionType = data.type;
                    const savedText = data.text;
                    const savedOptionsText = data.optionsText;
                    const savedImageUrls = data.base64ImageSources;
                    const savedQuestionType = data.questionType;
                    const savedIsMulti = data.isMulti;
                    const savedIsMultiQuiz = data.isMultiQuiz;
                    const savedItem: HTMLElement = data.questionItem;

                    button.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Scope autoSelectAnswer to this question container
                        window.xdAnswers._answerContainer = savedItem;
                        // Set custom auto-answer for types that need special handling
                        if (savedType === 'likert' || savedType === 'ranking') {
                            window.xdAnswers._customAutoAnswer = (answerText) => {
                                if (savedType === 'likert') applyApi.autoAnswerLikert(savedItem, answerText);
                                else if (savedType === 'ranking') applyApi.autoAnswerRanking(savedItem, answerText);
                            };
                        }
                        Promise.all(savedImageUrls.map(src => window.xdAnswers.imageToBase64(src))).then(images => {
                            window.xdAnswers.processQuestion({
                                text: savedText,
                                optionsText: savedOptionsText,
                                base64Images: images.filter((x): x is string => !!x),
                                questionType: savedQuestionType,
                                isMulti: savedIsMulti,
                                isMultiQuiz: savedIsMultiQuiz
                            });
                        });
                    };

                    item.appendChild(button);
                }
            });
        }

        // ── MutationObserver ──

        const observer = new MutationObserver(() => {
            if (window.xdAnswers.isExtensionModifyingDOM) return;
            if (debounceTimer !== null) clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(scanQuestions, 500);
            if (window.xdAnswers.helperContainer && !document.body.contains(window.xdAnswers.helperContainer)) {
                document.body.appendChild(window.xdAnswers.helperContainer);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Initial scan (delayed to let MS Forms render)
        setTimeout(scanQuestions, 1000);
    }
})();
