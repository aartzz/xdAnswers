// src/providers/naurok/main.ts
// Naurok provider entry: discovers the test topic via the sessions API and
// feeds question data (text/options/images) into the AI pipeline, either
// automatically or through the one-click handler. DOM extraction lives in
// ./dom.ts; page-world session sniffing lives in ./disabler.ts and posts
// payloads through a window.postMessage bridge.
import type { NaurokDomApi } from './dom';

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    const modules = I.providerModules || (I.providerModules = {});
    const naurokModules = modules.naurok || (modules.naurok = {});
    const dom = naurokModules.dom as NaurokDomApi;

    // naurok exposes the test metadata at GET /api2/test/sessions/{numeric_id}.
    // Topic/session come either from intercepted page traffic (see ./disabler.ts,
    // which posts payloads from the page world) or from a direct API call once
    // the numeric session ID is parsed from ng-init.
    let _naurokTopic: string | null = null;
    let _naurokSessionId: number | null = null;

    window.addEventListener('message', function (event) {
        if (event.source !== window) return;
        const data = event.data as { source?: string; provider?: string; type?: string; payload?: unknown } | null;
        if (!data || data.source !== 'xd-disabler' || data.provider !== 'naurok') return;
        if (data.type === 'beta-session') {
            dom.setBetaSession(data.payload);
            extractTopicFromSessionPayload(data.payload);
            return;
        }
        if (data.type !== 'session-payload') return;
        extractTopicFromSessionPayload(data.payload);
    });

    function extractTopicFromSessionPayload(payload: unknown): void {
        try {
            const p = payload as any;
            if (!p || typeof p !== 'object') return;
            const name = (p.document && p.document.name) ||
                (p.settings && p.settings.name) ||
                (p.session && p.session.name);
            if (name && typeof name === 'string' && name.trim()) {
                _naurokTopic = name.trim();
                console.log('[xdAnswers/naurok] Topic extracted:', _naurokTopic);
            }
            const sid = p.session && p.session.id;
            if (typeof sid === 'number') {
                _naurokSessionId = sid;
                console.log('[xdAnswers/naurok] Session ID:', _naurokSessionId);
            }
        } catch (e) { console.warn('[xdAnswers/naurok] extractTopicFromSessionPayload error:', e); }
    }

    async function fetchNaurokTopic(): Promise<string | null> {
        if (_naurokTopic) {
            console.log('[xdAnswers/naurok] Topic already known:', _naurokTopic);
            return _naurokTopic;
        }
        if (dom.isBetaTest()) {
            const title = document.title.replace(/^(?:тест|результат)\s*:\s*/i, '').trim();
            if (title) {
                _naurokTopic = title;
                console.log('[xdAnswers/naurok] Topic from test-beta title:', _naurokTopic);
                return _naurokTopic;
            }
        }
        try {
            // Strategy 1: Parse numeric session ID from ng-init attribute in DOM
            let sessionId = dom.parseSessionIdFromDOM();

            // Strategy 2: If no ng-init, try extracting from page URL (UUID → may not work for API)
            if (!sessionId) {
                const urlMatch = window.location.pathname.match(/\/test\/testing\/([a-f0-9-]+)/i);
                if (urlMatch) {
                    console.log('[xdAnswers/naurok] Found UUID in URL but need numeric ID — checking DOM more thoroughly');
                    // Try broader search for any element containing the session ID
                    const allNgInit = document.querySelectorAll('[ng-init]');
                    for (const el of allNgInit) {
                        const val = el.getAttribute('ng-init') || '';
                        const m = val.match(/init\s*\([^)]*(\d{7,})[^)]*\)/);
                        if (m) {
                            sessionId = parseInt(m[1], 10);
                            console.log('[xdAnswers/naurok] Session ID found in ng-init (broad search):', sessionId);
                            break;
                        }
                    }
                }
            }

            if (!sessionId) {
                console.log('[xdAnswers/naurok] No session ID found in DOM, skipping topic fetch');
                return _naurokTopic;
            }

            _naurokSessionId = sessionId;

            // Fetch topic directly from API via background proxy (bypasses CSP)
            if (window.xdAnswers && window.xdAnswers.makeRequest) {
                console.log('[xdAnswers/naurok] Fetching session API, sessionId:', sessionId);
                try {
                    const res = await window.xdAnswers.makeRequest({
                        url: 'https://naurok.com.ua/api2/test/sessions/' + sessionId,
                        method: 'GET',
                        timeout: 10000
                    });
                    // makeRequest returns { success: true, data: <string> } from background.js
                    const rawData = (res as any)?.data || res;
                    const json = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                    extractTopicFromSessionPayload(json);
                } catch (e) {
                    console.warn('[xdAnswers/naurok] Session API fetch failed:', (e as any).message || e);
                }
            }
        } catch (e) { console.warn('[xdAnswers/naurok] fetchNaurokTopic error:', e); }
        if (!_naurokTopic) console.log('[xdAnswers/naurok] No topic found');
        return _naurokTopic;
    }

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            // Kick off topic discovery — parse ng-init for session ID, then API fetch
            fetchNaurokTopic();
            initNaurok();
        }
    }, 50);

    function initNaurok(): void {
        let lastStateHash = "";
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        // test-beta can spend a long time loading question images before the AI
        // pipeline starts. Mount the helper now so the answer window is visible
        // immediately, then processQuestion reuses the same container.
        if (dom.isBetaTest() && /^\/test-beta\/play(?:\/|$)/.test(location.pathname) &&
            !window.xdAnswers.settings.silentMode) {
            window.xdAnswers.createUI();
            window.xdAnswers.attachAndPositionHelper();
        }

        window.xdAnswers.onRefresh = () => {
            lastStateHash = "";
            // Skip debounce for user-initiated refresh — question is already rendered
            if (debounceTimer) clearTimeout(debounceTimer);
            checkQuestion(true);
        };

        function processDOM(): void {
            // Використовуємо debounce, щоб не реагувати на кожну дрібну зміну під час рендеру Angular
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => checkQuestion(false), 300);
        }

        function checkQuestion(skipDelay?: boolean): void {
            if (window.xdAnswers.isProcessingAI) return;

            const isBeta = dom.isBetaTest();

            // 0. Перевіряємо, чи зараз йде анімація "Відповідь зараховано" або тест завершено
            // На naurok scene==1 = показує питання, scene==2 = анімація, scene==3 = завершено
            if (!isBeta && dom.getSceneBlocked()) return;

            // 1. Текст запитання + варіанти + картинки (див. ./dom.ts)
            const state = isBeta ? dom.getBetaQuestionState() : dom.getQuestionState();
            if (!state) return;

            // 2. Створюємо підпис стану (текст + варіанти + к-сть картинок + їхні URL).
            // Для test-beta додаємо ключ питання: однаковий текст у сусідніх
            // питаннях не повинен вважатися тим самим станом.
            const questionKey = (state as { questionKey?: string }).questionKey || '';
            const currentStateHash = `${state.questionText}|${state.optionsText}|${state.validImages.join(',')}|${questionKey}`;
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
                        if (!_naurokTopic) { try { await fetchNaurokTopic(); } catch (e) { /* topic fetch failed */ } }
                        return {
                            text: current.questionText,
                            optionsText: current.optionsText,
                            base64Images: images.filter((img): img is string => img !== null),
                            questionType: current.questionType,
                            isMultiQuiz: current.isMultiQuiz,
                            topic: _naurokTopic || undefined
                        };
                    };
                    // setCursor=false — cursor:pointer is set on .test-question-content instead
                    window.xdAnswers.setupOneClickHandler(container as HTMLElement, getQuestionDataFn, false);
                }
            } else {
                // Normal: auto-process after delay (skip for user-initiated refresh)
                const processFn = () => {
                    if (isBeta) {
                        const fresh = dom.getBetaQuestionState();
                        if (!fresh || fresh.questionKey !== questionKey) {
                            console.log('[xdAnswers/naurok] Question changed before AI request, skipping');
                            return;
                        }
                    }
                    const questionData: XdQuestionData = {
                        text: state.questionText,
                        optionsText: state.optionsText,
                        base64Images: [],
                        questionType: state.questionType,
                        isMultiQuiz: state.isMultiQuiz,
                        topic: _naurokTopic || undefined
                    };

                    const imgPromises = state.validImages.map(src => window.xdAnswers.imageToBase64(src));

                    Promise.all(imgPromises).then(images => {
                        // The stage may have moved on while images were loading.
                        // Never send a stale answer into the next question.
                        if (isBeta) {
                            const fresh = dom.getBetaQuestionState();
                            if (!fresh || fresh.questionKey !== questionKey) {
                                console.log('[xdAnswers/naurok] Question changed during image load, skipping stale answer');
                                return;
                            }
                        }
                        questionData.base64Images = images.filter((img): img is string => img !== null);
                        window.xdAnswers.processQuestion(questionData);
                    });
                };

                if (skipDelay) processFn();
                else setTimeout(processFn, 500);
            }
        }

        // MutationObserver стежить за змінами в основному контейнері тесту
        const observer = new MutationObserver(() => {
            if (window.xdAnswers.isExtensionModifyingDOM) return;
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
