(function() {
    'use strict';
    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initQuizizz();
        }
    }, 50);

    function initQuizizz() {
        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        // Poll for question changes — Quizizz is highly dynamic
        setInterval(checkQuestion, 800);

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // Quizizz uses data-testid attributes
            const questionContainer = document.querySelector('[data-testid="question-container"]');
            const questionTextEl = document.querySelector('#questionText');
            if (!questionContainer || !questionTextEl) return;

            let questionText = questionTextEl.textContent.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Find options
            const quizContainer = questionContainer.closest('.quiz-container');
            let optionEls = [];
            if (quizContainer) {
                optionEls = quizContainer.querySelectorAll('.options-grid .option');
            }
            // Fallback
            if (optionEls.length === 0) {
                optionEls = document.querySelectorAll('.options-grid .option, [data-testid="answer-option"], .option');
            }

            const options = [];
            optionEls.forEach((btn, index) => {
                const optionTextEl = btn.querySelector('#optionText');
                if (optionTextEl) {
                    let optText = optionTextEl.textContent.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                    options.push(optText);
                } else {
                    let optText = btn.textContent.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                    if (optText) options.push(optText);
                }
            });

            // Check for images in the question
            const imgPromises = [];
            if (questionContainer) {
                questionContainer.querySelectorAll('img').forEach(img => {
                    imgPromises.push(window.xdAnswers.imageToBase64(img.src));
                });
            }

            Promise.all(imgPromises).then(images => {
                const questionData = {
                    text: questionText,
                    options: options.length > 0 ? options : undefined,
                    base64Images: images.filter(img => img !== null),
                    questionType: options.length > 0 ? 'choice' : 'text'
                };

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    if (questionContainer && !questionContainer.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.setupOneClickHandler(questionContainer, async () => {
                            return {
                                text: questionText,
                                options: options.length > 0 ? options : undefined,
                                base64Images: images.filter(img => img !== null),
                                questionType: options.length > 0 ? 'choice' : 'text'
                            };
                        });
                    }
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            });
        }
    }
})();
