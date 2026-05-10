(function() {
    'use strict';
    let lastQuestionText = '';

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

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // Find question text — InRoute uses .n-kahoot-p
            const questionEl = document.querySelector('.n-kahoot-p');
            if (!questionEl) return;

            const questionText = questionEl.innerText.trim();
            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Find option buttons — Kahoot uses data-functional-selector for answers
            // Try multiple selector strategies
            let optionEls = document.querySelectorAll('[data-functional-selector^="answer-"], [data-functional-selector*="answer"]');
            if (optionEls.length === 0) {
                optionEls = document.querySelectorAll('.choices__choice, [class*="choice"], button[role="radio"]');
            }

            const options = Array.from(optionEls).map(el => el.innerText.trim()).filter(Boolean);

            // Check for images in the question
            const imgPromises = [];
            const questionContainer = questionEl.closest('[data-testid="question-screen"], [class*="question"], div');
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
                    const container = questionEl.closest('[data-testid="question-screen"]') || questionEl.parentElement;
                    if (container && !container.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.clearOneClickHandlers();
                        window.xdAnswers.setupOneClickHandler(container, async () => questionData);
                    }
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            });
        }
    }
})();
