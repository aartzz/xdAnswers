// src/providers/naurok/main.ts
// Naurok provider entry: manages question polling, MutationObserver and wiring to the AI pipeline.
import type { NaurokDomApi } from './dom';
import { fetchNaurokTopic, getNaurokTopic, initMessageListener } from './topic';
import { applyNaurokTextAnswer, clickNaurokNextButton } from './autoanswer';

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    const modules = I.providerModules || (I.providerModules = {});
    const naurokModules = modules.naurok || (modules.naurok = {});
    const dom = naurokModules.dom as NaurokDomApi;

    initMessageListener(dom);

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            // Kick off topic discovery — parse ng-init for session ID, then API fetch
            fetchNaurokTopic(dom);
            initNaurok();
        }
    }, 50);

    function initNaurok(): void {
        let lastStateHash = "";
        let currentSolvingText = "";
        let isSolvingNaurok = false;
        let solveEpoch = 0;
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        function updateHelperVisibility(): void {
            if (window.xdAnswers.settings.silentMode) return;
            const isBeta = dom.isBetaTest();
            let isTestActive = false;
            let isTestEnded = false;

            if (!isBeta) {
                const scene3 = document.querySelector('[ng-show="test.scene == 3"]');
                isTestEnded = !!(scene3 && !scene3.classList.contains('ng-hide'));
                const scene1 = document.querySelector('[ng-show="test.scene == 1"]');
                const hasQuestion = !!(scene1 && !scene1.classList.contains('ng-hide')) || !!document.querySelector('.test-question-content, .test-content-text');
                isTestActive = hasQuestion && !isTestEnded;
            } else {
                isTestEnded = /^\/(?:test-beta|test)\/result(?:\/|$)/.test(location.pathname) || !!document.querySelector('.tb-results, .tb-end, .tb-finished');
                isTestActive = (/^\/(?:test-beta|test)\/play(?:\/|$)/.test(location.pathname) || !!document.querySelector('#tb-app, .tb-stagebox, .tb-question, .tb-board')) && !isTestEnded;
            }

            if (isTestActive) {
                if (!window.xdAnswers.helperContainer || !document.body.contains(window.xdAnswers.helperContainer)) {
                    window.xdAnswers.createUI();
                    window.xdAnswers.attachAndPositionHelper();
                } else if (window.xdAnswers.helperContainer.style.display === 'none') {
                    window.xdAnswers.helperContainer.style.setProperty('display', 'flex', 'important');
                }
            } else if (isTestEnded && window.xdAnswers.helperContainer) {
                window.xdAnswers.helperContainer.style.setProperty('display', 'none', 'important');
            }
        }

        // test-beta can spend a long time loading question images before the AI
        // pipeline starts. Mount the helper now so the answer window is visible
        // immediately, then processQuestion reuses the same container.
        if (window.xdAnswers.settings.disablerEnabled && dom.isBetaTest() && /^\/(?:test-beta|test)\/play(?:\/|$)/.test(location.pathname)) {
            window.xdAnswers.addStyle?.('.tb-focus{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}');
            document.querySelectorAll<HTMLButtonElement>('.tb-focus:not(.is-alert) .tb-focus-box .tb-btn-go').forEach(b => {
                if (!/оновити|reload/i.test(b.textContent || '')) {
                    b.click();
                }
            });
        }

        updateHelperVisibility();

        window.xdAnswers.onRefresh = () => {
            // Invalidate the previous solve (including its pending image loads and
            // delayed start) so it cannot finish after the refreshed question starts.
            solveEpoch++;
            isSolvingNaurok = false;
            lastStateHash = "";
            currentSolvingText = "";
            // Skip debounce for user-initiated refresh — question is already rendered
            if (debounceTimer) clearTimeout(debounceTimer);
            checkQuestion(true);
        };

        function processDOM(): void {
            // Використовуємо debounce, щоб не реагувати на кожну дрібну зміну під час рендеру Angular
            if (debounceTimer) clearTimeout(debounceTimer);
            const delay = dom.isBetaTest() ? 50 : 300;
            debounceTimer = setTimeout(() => checkQuestion(false), delay);
        }

        function checkQuestion(skipDelay?: boolean): void {
            updateHelperVisibility();
            if (isSolvingNaurok || window.xdAnswers.isProcessingAI) return;

            // Auto-advance if "Далі" / feedback overlay is present
            if (window.xdAnswers.settings.autoAnswer && clickNaurokNextButton()) {
                return;
            }

            const isBeta = dom.isBetaTest();

            // 0. Перевіряємо, чи завершено тест або йде анімація
            if (!isBeta) {
                const scene3 = document.querySelector('[ng-show="test.scene == 3"]');
                const isTestEnded = scene3 && !scene3.classList.contains('ng-hide');
                if (isTestEnded && window.xdAnswers.helperContainer) {
                    window.xdAnswers.helperContainer.style.setProperty('display', 'none', 'important');
                    return;
                }
                if (dom.getSceneBlocked()) return;
            } else {
                const isTestEnded = /^\/(?:test-beta|test)\/result(?:\/|$)/.test(location.pathname) || !!document.querySelector('.tb-results, .tb-end, .tb-finished');
                if (isTestEnded && window.xdAnswers.helperContainer) {
                    window.xdAnswers.helperContainer.style.setProperty('display', 'none', 'important');
                    return;
                }
            }

            // 1. Текст запитання + варіанти + картинки (див. ./dom.ts)
            const state = isBeta ? dom.getBetaQuestionState() : dom.getQuestionState();
            if (!state) return;

            const questionKey = (state as { questionKey?: string }).questionKey || '';
            const normalizedQuestionText = (state.questionText || (state.validImages && state.validImages.join(',')) || '').trim();
            const currentIdentity = questionKey || normalizedQuestionText;
            if (!skipDelay && currentIdentity && currentIdentity === currentSolvingText) {
                return;
            }

            // 2. Створюємо підпис стану (використовуємо стабільний questionKey або текст+варіанти)
            const currentStateHash = questionKey || `${state.questionText}|${state.optionsText}`;
            if (currentStateHash === lastStateHash) return;

            console.log("xdAnswers: New question state detected:", currentStateHash);
            lastStateHash = currentStateHash;
            naurokModules.currentQuestionKey = questionKey;

            const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';

            if (isOneClick) {
                // One-click mode: register click handler instead of auto-processing.
                // .test-container-inner encompasses BOTH .test-question-content and
                // .test-question-options, so autoSelectAnswer's scoped container check
                // includes option elements that are siblings of the question.
                const container = isBeta ? dom.betaQuestionContainer() : document.querySelector('.test-container-inner');
                // Also set cursor:pointer on the question text area to hint clickability
                const questionContent = isBeta ? document.querySelector('.tb-question') : document.querySelector('.test-question-content');
                if (questionContent) (questionContent as HTMLElement).style.cursor = 'pointer';
                if (container) {
                    // Always clear and re-register so the closure captures fresh data
                    // (Angular may re-render the container, losing the old handler)
                    window.xdAnswers.clearOneClickHandlers();
                    const getQuestionDataFn = async (): Promise<XdQuestionData | null> => {
                        // Re-read current question data from DOM at click time
                        const current = isBeta ? dom.getBetaQuestionState() : dom.getQuestionState();
                        if (!current) return null;
                        naurokModules.currentQuestionKey = (current as { questionKey?: string }).questionKey || '';

                        const images = await Promise.all(current.validImages.map(src => window.xdAnswers.imageToBase64(src)));
                        let topic = getNaurokTopic();
                        if (!topic) { try { topic = await fetchNaurokTopic(dom); } catch (e) { /* topic fetch failed */ } }
                        return {
                            text: current.questionText,
                            optionsText: current.optionsText,
                            base64Images: images.filter((img): img is string => img !== null),
                            questionType: current.questionType,
                            isMultiQuiz: current.isMultiQuiz,
                            topic: topic || undefined
                        };
                    };
                    // setCursor=false — cursor:pointer is set on .test-question-content instead
                    window.xdAnswers.setupOneClickHandler(container as HTMLElement, getQuestionDataFn, false);
                }
            } else {
                currentSolvingText = currentIdentity;
                isSolvingNaurok = true;
                const solveStartTime = Date.now();

                // Immediately switch from 'Waiting for question...' to 'Connecting...' / spinner
                if (!window.xdAnswers.settings.silentMode) {
                    I.startWaitingStatus(solveStartTime);
                }

                // Normal: auto-process after delay (skip for user-initiated refresh or test-beta)
                const epochAtStart = solveEpoch;
                const processFn = () => {
                    if (epochAtStart !== solveEpoch) return;
                    if (isBeta) {
                        const fresh = dom.getBetaQuestionState();
                        if (fresh && fresh.questionKey && fresh.questionKey !== state.questionKey) {
                            console.log('[xdAnswers/naurok] Question changed before AI request, re-evaluating');
                            lastStateHash = "";
                            currentSolvingText = "";
                            isSolvingNaurok = false;
                            checkQuestion(true);
                            return;
                        }
                    }
                    const questionData: XdQuestionData = {
                        text: state.questionText,
                        optionsText: state.optionsText,
                        base64Images: [],
                        questionType: state.questionType,
                        isMultiQuiz: state.isMultiQuiz,
                        topic: getNaurokTopic() || undefined
                    };

                    const imgPromises = state.validImages.map(src => window.xdAnswers.imageToBase64(src));

                    Promise.all(imgPromises).then(images => {
                        if (epochAtStart !== solveEpoch) return;
                        // The stage may have moved on while images were loading.
                        // Never send a stale answer into the next question.
                        if (isBeta) {
                            const fresh = dom.getBetaQuestionState();
                            if (fresh && fresh.questionKey && fresh.questionKey !== state.questionKey) {
                                console.log('[xdAnswers/naurok] Question changed during image load, re-evaluating');
                                lastStateHash = "";
                                currentSolvingText = "";
                                isSolvingNaurok = false;
                                checkQuestion(true);
                                return;
                            }
                        }
                        questionData.base64Images = images.filter((img): img is string => img !== null);

                        if (state.questionType === 'text') {
                            window.xdAnswers._customAutoAnswer = function(answerText) {
                                applyNaurokTextAnswer((state as any).inputElement, answerText);
                                window.xdAnswers._customAutoAnswer = null;
                            };
                        } else {
                            window.xdAnswers._customAutoAnswer = null;
                        }

                        window.xdAnswers.processQuestion(questionData).finally(() => {
                            if (epochAtStart === solveEpoch) isSolvingNaurok = false;
                        });
                    }).catch(() => {
                        if (epochAtStart === solveEpoch) isSolvingNaurok = false;
                    });
                };

                if (skipDelay || isBeta) processFn();
                else setTimeout(processFn, 500);
            }
        }

        // MutationObserver стежить за змінами в основному контейнері тесту
        const observer = new MutationObserver(() => {
            if (window.xdAnswers.isExtensionModifyingDOM) return;

            // Auto-advance if feedback overlay or next button appeared
            if (window.xdAnswers.settings.autoAnswer) {
                const feedback = document.querySelector('.tb-feedback, .tb-board-foot, .tb-team-foot');
                if (feedback) {
                    setTimeout(clickNaurokNextButton, 120);
                }
            }

            updateHelperVisibility();
            processDOM();
            // Only re-attach if container was removed from DOM (e.g. Angular re-render);
            // do NOT call attachAndPositionHelper unconditionally — it clears transform
            // and resets position, which breaks dragging during AI processing.
            if (window.xdAnswers.helperContainer && !window.xdAnswers.helperContainer.parentNode) {
                window.xdAnswers.attachAndPositionHelper();
            }
        });

        // Стежимо за body, бо Angular може перемальовувати великі шматки DOM
        observer.observe(document.body, { childList: true, subtree: true });

        // Первинний запуск
        processDOM();
    }
})();
