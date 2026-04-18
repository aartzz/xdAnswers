(function() {
    'use strict';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
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
                            return {
                                text: savedText,
                                optionsText: savedOptionsText,
                                base64Images: images.filter(img => img !== null),
                                questionType: savedIsMultiQuiz ? 'multiquiz' : 'quiz',
                                isMultiQuiz: savedIsMultiQuiz
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
                            isMultiQuiz: isMultiQuiz
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
            window.xdAnswers.attachAndPositionHelper();
        });

        // Стежимо за body, бо Angular може перемальовувати великі шматки DOM
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Первинний запуск
        processDOM();
    }
})();