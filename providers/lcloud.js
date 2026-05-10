(function() {
    'use strict';
    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initLcloud();
        }
    }, 50);

    function initLcloud() {
        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        // Use MutationObserver for dynamic SPA content
        const observer = new MutationObserver(() => checkQuestion());
        observer.observe(document.body, { childList: true, subtree: true });

        // Fallback polling
        setInterval(checkQuestion, 1000);

        function getText(el) {
            return (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
        }

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // lcloud.in.ua question selectors
            const questionSelectors = [
                '.question-text',
                '.test-question',
                '.task-text',
                '.question-content',
                '.q-text',
                '[data-question-text]',
                'h1',
                'h2',
                'h3'
            ];

            let questionEl = null;
            for (const sel of questionSelectors) {
                questionEl = document.querySelector(sel);
                if (questionEl) break;
            }

            if (!questionEl) return;

            const questionText = getText(questionEl);
            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Detect options
            const optionSelectors = [
                '.answer-option',
                '.option-item',
                '.test-option',
                '.answer-item',
                '.choice',
                '[data-option]',
                'label'
            ];

            const options = [];
            const seen = new Set();
            for (const sel of optionSelectors) {
                document.querySelectorAll(sel).forEach(el => {
                    const text = getText(el);
                    if (!text || seen.has(text)) return;
                    seen.add(text);
                    options.push(text);
                });
            }

            // Detect inputs (text / textarea)
            const textInputs = Array.from(document.querySelectorAll('input[type="text"], textarea'));
            const hasTextInput = textInputs.length > 0;

            // Detect true/false
            const trueFalseButtons = document.querySelectorAll('.true-false-btn, [data-type="true-false"], button[value="true"], button[value="false"]');
            const isTrueFalse = trueFalseButtons.length >= 2;

            // Detect drag-and-drop / categorization
            const dragItems = document.querySelectorAll('[draggable="true"], .draggable, .drag-item');
            const dropZones = document.querySelectorAll('.drop-zone, .drop-target, .category-zone');
            const isDND = dragItems.length > 0 && dropZones.length > 0;

            // Detect matching
            const matchingLeft = document.querySelectorAll('.matching-left, .match-source');
            const matchingRight = document.querySelectorAll('.matching-right, .match-target');
            const isMatching = matchingLeft.length > 0 && matchingRight.length > 0;

            // Collect images
            const imgPromises = [];
            const container = questionEl.closest('.question, .test-item, [class*="question"]') || document.body;
            container.querySelectorAll('img').forEach(img => {
                if (img.src) imgPromises.push(window.xdAnswers.imageToBase64(img.src));
            });

            Promise.all(imgPromises).then(images => {
                let questionType = 'choice';
                if (isTrueFalse) questionType = 'true_false';
                else if (isDND) questionType = 'dragdrop';
                else if (isMatching) questionType = 'matching';
                else if (hasTextInput && options.length === 0) questionType = 'short_text';
                else if (options.length > 1) questionType = 'choice';
                else if (options.length === 0) questionType = 'short_text';

                const questionData = {
                    text: questionText,
                    options: options.length > 0 ? options : undefined,
                    base64Images: images.filter(img => img !== null),
                    questionType: questionType
                };

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const container = questionEl.closest('.question, .test-item, [class*="question"]') || questionEl.parentElement;
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
