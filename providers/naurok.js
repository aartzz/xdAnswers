(function() {
    'use strict';

    // ── Topic extraction ────────────────────────────────────────────────
    // naurok exposes the test metadata at GET /api2/test/sessions/{numeric_id}.
    // The numeric session ID is embedded in the page HTML as:
    //   <div ng-init="init(settings_id, SESSION_ID, account_id)">
    // We parse that ng-init attribute, then call the API directly via makeRequest.
    // We ALSO intercept window.fetch + XMLHttpRequest as a secondary capture path
    // in case the page makes the same API call after our script loads.
    let _naurokTopic = null;      // string | null
    let _naurokSessionId = null;  // number | null

    function extractTopicFromSessionPayload(payload) {
        try {
            if (!payload || typeof payload !== 'object') return;
            const name = payload && payload.settings && payload.settings.name;
            if (name && typeof name === 'string' && name.trim()) {
                _naurokTopic = name.trim();
                console.log('[xdAnswers/naurok] Topic extracted:', _naurokTopic);
            }
            const sid = payload && payload.session && payload.session.id;
            if (typeof sid === 'number') {
                _naurokSessionId = sid;
                console.log('[xdAnswers/naurok] Session ID:', _naurokSessionId);
            }
        } catch (e) { console.warn('[xdAnswers/naurok] extractTopicFromSessionPayload error:', e); }
    }

    // ── Intercept window.fetch ────────────────────────────────────────
    try {
        const origFetch = window.fetch;
        if (origFetch && !window.__xdAnswersNaurokFetchHooked) {
            window.__xdAnswersNaurokFetchHooked = true;
            window.fetch = function(input, init) {
                const url = (typeof input === 'string') ? input : (input && input.url) || '';
                const promise = origFetch.apply(this, arguments);
                if (url && /\/api2\/test\/sessions\//.test(url)) {
                    console.log('[xdAnswers/naurok] Fetch intercepted:', url);
                    promise.then(resp => {
                        try {
                            resp.clone().json().then(json => {
                                extractTopicFromSessionPayload(json);
                            }).catch(() => {});
                        } catch (e) {}
                    }).catch(() => {});
                }
                return promise;
            };
        }
    } catch (e) { /* fetch patch failed */ }

    // ── Intercept XMLHttpRequest (AngularJS $http uses XHR, not fetch) ──
    try {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        if (!window.__xdAnswersNaurokXHRHooked) {
            window.__xdAnswersNaurokXHRHooked = true;
            XMLHttpRequest.prototype.open = function(method, url) {
                this.__xdUrl = url;
                return origOpen.apply(this, arguments);
            };
            XMLHttpRequest.prototype.send = function() {
                if (this.__xdUrl && /\/api2\/test\/sessions\//.test(this.__xdUrl)) {
                    console.log('[xdAnswers/naurok] XHR intercepted:', this.__xdUrl);
                    this.addEventListener('load', function() {
                        try {
                            const json = JSON.parse(this.responseText);
                            extractTopicFromSessionPayload(json);
                        } catch (e) {}
                    });
                }
                return origSend.apply(this, arguments);
            };
        }
    } catch (e) { /* XHR patch failed */ }

    // ── Parse ng-init from page DOM to extract numeric session ID ──────
    function extractSessionIdFromDOM() {
        // Angular puts ng-init="init(settings_id, session_id, account_id)" on the root element
        const el = document.querySelector('[ng-init*="init("]');
        if (!el) return null;
        const ngInit = el.getAttribute('ng-init') || '';
        // Match init(a,B,c) — second argument is the numeric session ID
        const match = ngInit.match(/init\s*\(\s*\d+\s*,\s*(\d+)\s*,/);
        if (match) {
            const sid = parseInt(match[1], 10);
            console.log('[xdAnswers/naurok] Session ID from ng-init:', sid);
            return sid;
        }
        return null;
    }

    async function fetchNaurokTopic() {
        if (_naurokTopic) {
            console.log('[xdAnswers/naurok] Topic already known:', _naurokTopic);
            return _naurokTopic;
        }
        try {
            // Strategy 1: Parse numeric session ID from ng-init attribute in DOM
            let sessionId = extractSessionIdFromDOM();

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
                    const rawData = res?.data || res;
                    const json = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                    extractTopicFromSessionPayload(json);
                } catch (e) {
                    console.warn('[xdAnswers/naurok] Session API fetch failed:', e.message || e);
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

    function initNaurok() {
        let lastStateHash = "";
        let debounceTimer = null;

        window.xdAnswers.onRefresh = () => {
            lastStateHash = "";
            // Skip debounce for user-initiated refresh — question is already rendered
            if (debounceTimer) clearTimeout(debounceTimer);
            checkQuestion(true);
        };

        function processDOM() {
            // Використовуємо debounce, щоб не реагувати на кожну дрібну зміну під час рендеру Angular
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => checkQuestion(false), 300);
        }

        function checkQuestion(skipDelay) {
            if (window.xdAnswers.isProcessingAI) return;

            // 0. Перевіряємо, чи зараз йде анімація "Відповідь зараховано" або тест завершено
            // На naurok scene==1 = показує питання, scene==2 = анімація, scene==3 = завершено
            const scene1 = document.querySelector('[ng-show="test.scene == 1"]');
            const scene2 = document.querySelector('[ng-show="test.scene == 2"]');
            const scene3 = document.querySelector('[ng-show="test.scene == 3"]');
            const isAnimationActive = scene2 && !scene2.classList.contains('ng-hide');
            const isTestEnded = scene3 && !scene3.classList.contains('ng-hide');
            if (isAnimationActive || isTestEnded) return;

            // Якщо scene1 прихований, чекаємо
            if (scene1 && scene1.classList.contains('ng-hide')) return;

            // 1. Отримуємо текст запитання (HTML показує, що він тут)
            const textContainer = document.querySelector('.test-content-text-inner');
            if (!textContainer) return;
            
            const questionText = textContainer.innerText.trim();
            if (!questionText) return; // Чекаємо, поки Angular вставить текст

            // 2. Отримуємо варіанти відповідей — підтримуємо текстові та image-only варіанти
            // На naurok варіанти мають структуру:
            //   .test-option > .question-option-inner > [.question-option-image (background-image)] + [ng-if=v.value текст]
            const optionInners = document.querySelectorAll('.question-option-inner');
            const optionsArr = [];         // текстові варіанти для optionsText
            const optionImageUrls = [];    // URL картинок варіантів
            const optionLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

            optionInners.forEach((inner, idx) => {
                // Текст варіанту (якщо є)
                const textEl = inner.querySelector('.question-option-inner-content');
                const text = textEl ? textEl.innerText.trim() : '';
                
                // Картинка варіанту через background-image (image-only варіанти на naurok)
                const imgEl = inner.querySelector('.question-option-image');
                let bgUrl = '';
                if (imgEl) {
                    const bgStyle = imgEl.style.backgroundImage || '';
                    const match = bgStyle.match(/url\(["']?([^"')]+)["']?\)/);
                    bgUrl = match ? match[1] : '';
                }

                const label = optionLabels[idx] || (idx + 1);
                if (text) {
                    optionsArr.push(label + ': ' + text);
                } else if (bgUrl) {
                    optionsArr.push(label + ': [зображення]');
                    optionImageUrls.push(bgUrl);
                }
            });

            // Також перевіряємо старий селектор .question-option-inner-content як fallback
            if (optionsArr.length === 0) {
                const fallbackEls = document.querySelectorAll('.question-option-inner-content');
                fallbackEls.forEach((el, idx) => {
                    const t = el.innerText.trim();
                    if (t) optionsArr.push((optionLabels[idx] || (idx+1)) + ': ' + t);
                });
            }

            const optionsText = optionsArr.join('\n');

            // Якщо немає жодних варіантів — питання ще не завантажилось або перехід між сценами
            if (optionsArr.length === 0) return;

            // Визначаємо тип питання (quiz / multiquiz)
            const isMultiQuiz = !!document.querySelector('.question-option-inner[ng-click*="multiquiz"], [ng-if="test.question.type == \'multiquiz\'"]:not(.ng-hide)');

            // 3. Збираємо картинку запитання (з <img> та background-image)
            const validImages = [];
            
            // 3a. Картинка запитання через <img>
            const allImages = document.querySelectorAll('img');
            allImages.forEach(img => {
                const isHidden = img.classList.contains('ng-hide') || img.offsetParent === null;
                const hasSrc = img.src && img.src.length > 0 && !img.src.startsWith('data:image/gif');
                const isInQuestion = img.closest('.test-question-content');
                if (!isHidden && hasSrc && isInQuestion && img.width > 40) {
                    validImages.push(img.src);
                }
            });

            // 3b. Картинка запитання через background-image на .test-content-image
            const questionImgDiv = document.querySelector('.test-content-image');
            if (questionImgDiv && !questionImgDiv.classList.contains('ng-hide')) {
                const bgStyle = questionImgDiv.style.backgroundImage || '';
                const match = bgStyle.match(/url\(["']?([^"')]+)["']?\)/);
                if (match && match[1]) validImages.push(match[1]);
                // Також перевіряємо <img> всередині
                const qImg = questionImgDiv.querySelector('img');
                if (qImg && qImg.src && !qImg.classList.contains('ng-hide')) {
                    if (!qImg.src.startsWith('data:image/gif') && qImg.width > 40) {
                        validImages.push(qImg.src);
                    }
                }
            }

            // 3c. Додаємо картинки варіантів до кінця списку
            optionImageUrls.forEach(url => { if (!validImages.includes(url)) validImages.push(url); });

            // 4. Створюємо підпис стану (текст + варіанти + к-сть картинок + їхні URL)
            const currentStateHash = `${questionText}|${optionsText}|${validImages.join(',')}`;

            if (currentStateHash !== lastStateHash) {
                console.log("xdAnswers: New question state detected:", currentStateHash);
                lastStateHash = currentStateHash;

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';

                if (isOneClick) {
                    // One-click mode: register click handler instead of auto-processing
                    const container = document.querySelector('.test-question-content') || document.querySelector('.test-content-text-inner');
                    if (container && !container.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.clearOneClickHandlers();
                        // Save detected data for click-time processing
                        const savedText = questionText;
                        const savedOptionsText = optionsText;
                        const savedImageUrls = validImages;
                        const savedIsMultiQuiz = isMultiQuiz;
                        window.xdAnswers.setupOneClickHandler(container, async () => {
                            const images = await Promise.all(savedImageUrls.map(src => window.xdAnswers.imageToBase64(src)));
                            // Retry topic discovery at click-time if we still don't have it.
                            if (!_naurokTopic) { try { await fetchNaurokTopic(); } catch (e) {} }
                            return {
                                text: savedText,
                                optionsText: savedOptionsText,
                                base64Images: images.filter(img => img !== null),
                                questionType: savedIsMultiQuiz ? 'multiquiz' : 'quiz',
                                isMultiQuiz: savedIsMultiQuiz,
                                topic: _naurokTopic || undefined
                            };
                        });
                    }
                } else {
                    // Normal: auto-process after delay (skip for user-initiated refresh)
                    const processFn = () => {
                        const questionData = {
                            text: questionText,
                            optionsText: optionsText,
                            base64Images: [],
                            questionType: isMultiQuiz ? 'multiquiz' : 'quiz',
                            isMultiQuiz: isMultiQuiz,
                            topic: _naurokTopic || undefined
                        };

                        const imgPromises = validImages.map(src => window.xdAnswers.imageToBase64(src));

                        Promise.all(imgPromises).then(images => {
                            questionData.base64Images = images.filter(img => img !== null);
                            window.xdAnswers.processQuestion(questionData);
                        });
                    };

                    if (skipDelay) processFn();
                    else setTimeout(processFn, 500);
                }
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