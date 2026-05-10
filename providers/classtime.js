(function() {
    'use strict';
    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initClasstime();
        }
    }, 50);

    function initClasstime() {
        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        // Use MutationObserver for dynamic SPA content
        const observer = new MutationObserver(() => checkQuestion());
        observer.observe(document.body, { childList: true, subtree: true });

        // Fallback polling
        setInterval(checkQuestion, 1000);

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // Detect question type from DOM
            const isCategorization = !!document.querySelector('[data-testid="student-categorizer-answers-form"]');
            const isDND = !!document.querySelector('[data-testid="draggable-item"], [draggable="true"]');

            // Find question text — try multiple selectors
            const questionSelectors = [
                '[data-p3-hint]',
                '.question-text',
                '[data-testid="question-text"]',
                'h1',
                'h2',
                '.task-title'
            ];

            let questionEl = null;
            for (const sel of questionSelectors) {
                questionEl = document.querySelector(sel);
                if (questionEl) break;
            }

            if (!questionEl) return;

            const questionText = questionEl.innerText.trim();
            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Find options for standard MCQ
            const optionEls = document.querySelectorAll('[data-testid="choice-wrapper"], .answer-option, [data-testid="answer-option"], .choice');
            const options = Array.from(optionEls).map(el => el.innerText.trim()).filter(Boolean);

            // For categorization: extract categories and items
            let categories, items;
            if (isCategorization) {
                const catEls = document.querySelectorAll('[data-testid="category-header"], .category-title');
                categories = Array.from(catEls).map(el => el.innerText.trim()).filter(Boolean);
                const itemEls = document.querySelectorAll('[data-testid="categorizer-item"], .categorizer-item, [data-testid="draggable-item"]');
                items = Array.from(itemEls).map(el => el.innerText.trim()).filter(Boolean);
            }

            // Collect images
            const imgPromises = [];
            const container = questionEl.closest('[data-testid="question"], .question, [class*="question"]') || document.body;
            container.querySelectorAll('img').forEach(img => {
                imgPromises.push(window.xdAnswers.imageToBase64(img.src));
            });

            Promise.all(imgPromises).then(images => {
                let questionType = 'choice';
                if (isCategorization) questionType = 'categorization';
                else if (isDND) questionType = 'dragdrop';
                else if (options.length === 0) questionType = 'text';

                const questionData = {
                    text: questionText,
                    options: options.length > 0 ? options : undefined,
                    base64Images: images.filter(img => img !== null),
                    questionType: questionType
                };

                if (isCategorization) {
                    questionData.categories = categories;
                    questionData.items = items;
                }

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const container = questionEl.closest('[data-testid="question-container"], .question') || questionEl.parentElement;
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
