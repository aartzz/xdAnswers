(function() {
    'use strict';
    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initQuizlet();
        }
    }, 50);

    function initQuizlet() {
        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        // Poll for question changes
        setInterval(checkQuestion, 800);

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // Quizlet uses data-testid attributes
            const questionTextEl = document.querySelector('[data-testid="Question Text"] .FormattedText');
            if (!questionTextEl) return;

            const questionText = questionTextEl.innerText.trim();
            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Find MCQ options
            const mcqContainer = document.querySelector('[data-testid="MCQ Answers"]');
            let options = [];
            if (mcqContainer) {
                const answerEls = mcqContainer.querySelectorAll('[data-testid="MCQ Answer"]');
                answerEls.forEach(el => {
                    const textEl = el.querySelector('.FormattedText');
                    if (textEl) {
                        const text = textEl.innerText.trim();
                        if (text) options.push(text);
                    } else {
                        const text = el.innerText.trim();
                        if (text) options.push(text);
                    }
                });
            }

            // Extract images from question
            const imgPromises = [];
            const questionContainer = document.querySelector('[data-testid="Question Text"]');
            if (questionContainer) {
                questionContainer.querySelectorAll('img').forEach(img => {
                    imgPromises.push(window.xdAnswers.imageToBase64(img.src));
                });
                // Also check for background images
                const bgImgEl = questionContainer.querySelector('.Image-image');
                if (bgImgEl && bgImgEl.style.backgroundImage) {
                    const bgUrl = bgImgEl.style.backgroundImage.slice(5, -2);
                    if (bgUrl) imgPromises.push(window.xdAnswers.imageToBase64(bgUrl));
                }
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
                    const container = document.querySelector('[data-testid="question"]') || questionContainer;
                    if (container && !container.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.setupOneClickHandler(container, async () => {
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
