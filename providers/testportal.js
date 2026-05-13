(function() {
    'use strict';
    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initTestportal();
        }
    }, 50);

    function initTestportal() {
        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        setInterval(checkQuestion, 800);

        function getText(el) {
            return (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
        }

        function detectQuestionType(questionElement) {
            const typeInput = questionElement.querySelector('input[name="givenAnswer.questionType"]');
            if (!typeInput) return 'unknown';
            switch (typeInput.value) {
                case 'TRUE_FALSE': return 'trueFalse';
                case 'SINGLE_ANSWER':
                case 'SURVEY': return 'singleChoice';
                case 'MULTI_ANSWER': return 'multipleChoice';
                case 'SHORT_ANSWER': return 'shortAnswer';
                case 'DESCRIPTIVE': return 'openText';
                default: return 'unknown';
            }
        }

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // TestPortal uses specific question containers
            const questionEl = document.querySelector('.question-content, .question-content-wrapper, [class*="question"]');
            if (!questionEl) return;

            // Extract question text
            const qtextSelectors = ['.question-content .text', '.question-text', '.question-title', 'h3', 'h4'];
            let qtextEl = null;
            for (const sel of qtextSelectors) {
                qtextEl = questionEl.querySelector(sel) || questionEl.closest(sel);
                if (qtextEl) break;
            }
            if (!qtextEl) return;

            const questionText = getText(qtextEl);
            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Detect type
            const type = detectQuestionType(questionEl);
            const isChoice = type === 'singleChoice' || type === 'multipleChoice' || type === 'trueFalse';

            // Extract options
            let options = [];
            if (isChoice) {
                const optionEls = questionEl.querySelectorAll('.answer-variant, [class*="answer"], label.radio, label.checkbox, .option-label');
                optionEls.forEach(el => {
                    const text = getText(el);
                    if (text && text.length < 500) options.push(text);
                });
            }

            // Extract images
            const imgPromises = [];
            qtextEl.querySelectorAll('img').forEach(img => {
                imgPromises.push(window.xdAnswers.imageToBase64(img.src));
            });

            Promise.all(imgPromises).then(images => {
                const questionData = {
                    text: questionText,
                    options: options.length > 0 ? options : undefined,
                    base64Images: images.filter(img => img !== null),
                    questionType: isChoice ? 'choice' : 'text'
                };

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    if (!questionEl.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.setupOneClickHandler(questionEl, async () => questionData);
                    }
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            });
        }
    }
})();
