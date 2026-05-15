(function() {
    'use strict';
    let lastQuestionText = '';
    let kahootContainer = null;  // scoped container for current question

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initKahoot();
        }
    }, 50);

    function initKahoot() {
        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        // Poll for question changes — Kahoot is highly dynamic
        setInterval(checkQuestion, 800);

        function findInputElement() {
            // Kahoot uses data-functional-selector for answer inputs
            // Numeric input has type="number" or type="text" inside the answer area
            var sel = document.querySelector('[data-functional-selector*="answer"] input[type="number"]')
                   || document.querySelector('[data-functional-selector*="answer"] input[type="text"]')
                   || document.querySelector('[data-functional-selector*="answer"] input')
                   || document.querySelector('input[type="number"]')
                   || document.querySelector('input[data-functional-selector*="answer"]');
            return sel;
        }

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // Find question text — InRoute uses .n-kahoot-p
            const questionEl = document.querySelector('.n-kahoot-p');
            if (!questionEl) return;

            const questionText = questionEl.innerText.trim();
            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Find option buttons — Kahoot uses data-functional-selector for answers
            let optionEls = document.querySelectorAll('[data-functional-selector^="answer-"], [data-functional-selector*="answer"]');
            if (optionEls.length === 0) {
                optionEls = document.querySelectorAll('.choices__choice, [class*="choice"], button[role="radio"]');
            }

            const options = Array.from(optionEls).map(function(el) {
                return el.innerText.trim();
            }).filter(Boolean);

            // Check for images in the question
            const imgPromises = [];
            const questionContainer = questionEl.closest('[data-testid="question-screen"], [class*="question"], div');
            if (questionContainer) {
                questionContainer.querySelectorAll('img').forEach(function(img) {
                    imgPromises.push(window.xdAnswers.imageToBase64(img.src));
                });
            }

            // Store container for answer-time use
            kahootContainer = questionContainer || questionEl.parentElement;

            Promise.all(imgPromises).then(function(images) {
                var questionData = {
                    text: questionText,
                    options: options.length > 0 ? options : undefined,
                    base64Images: images.filter(function(img) { return img !== null; }),
                    questionType: options.length > 0 ? 'choice' : 'text'
                };

                // ── Custom auto-answer: character-by-character input for numeric/text answers ──
                // Kahoot tracks KEYDOWN/KEYUP timing. Direct value assignment is detectable.
                // InRoute uses 15ms/char + 400ms dot animation buffer.
                var inputEl = findInputElement();

                if (inputEl) {
                    // Numeric/text answer question — install character-by-character applier
                    window.xdAnswers._answerContainer = kahootContainer;
                    window.xdAnswers._customAutoAnswer = function(answerText) {
                        var input = findInputElement();
                        if (!input) {
                            // Fallback to default auto-select if input vanished
                            window.xdAnswers._internal.autoSelectAnswer(answerText, true);
                            return;
                        }

                        // Use native value setter to set initial empty state
                        var proto = window.HTMLInputElement.prototype;
                        var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                        if (nativeSetter) nativeSetter.call(input, '');
                        else input.value = '';
                        input.dispatchEvent(new Event('input', { bubbles: true }));

                        // Type character by character at 15ms intervals (matching InRoute)
                        var cleanAnswer = answerText.replace(/[^0-9a-zA-Z\s.,\-]/g, '').trim();
                        var chars = cleanAnswer.split('');
                        var idx = 0;

                        var typeInterval = setInterval(function() {
                            if (idx >= chars.length) {
                                clearInterval(typeInterval);

                                // Dot animation buffer (400ms) — InRoute Kahoot anti-detect
                                // After typing completes, wait before submitting
                                setTimeout(function() {
                                    if (nativeSetter) nativeSetter.call(input, cleanAnswer);
                                    else input.value = cleanAnswer;
                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                    input.dispatchEvent(new Event('change', { bubbles: true }));
                                    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
                                }, 400);

                                return;
                            }

                            var current = chars.slice(0, idx + 1).join('');
                            if (nativeSetter) nativeSetter.call(input, current);
                            else input.value = current;

                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new KeyboardEvent('keydown', {
                                bubbles: true,
                                key: chars[idx],
                                code: 'Key' + chars[idx].toUpperCase()
                            }));
                            input.dispatchEvent(new KeyboardEvent('keyup', {
                                bubbles: true,
                                key: chars[idx],
                                code: 'Key' + chars[idx].toUpperCase()
                            }));

                            idx++;
                        }, 15);
                    };
                } else {
                    // MCQ question — clear any previous custom applier
                    delete window.xdAnswers._customAutoAnswer;
                }

                var isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    var container = questionEl.closest('[data-testid="question-screen"]') || questionEl.parentElement;
                    if (container && !container.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.clearOneClickHandlers();
                        window.xdAnswers.setupOneClickHandler(container, async function() { return questionData; });
                    }
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            });
        }
    }
})();
