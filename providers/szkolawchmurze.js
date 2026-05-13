(function() {
    'use strict';
    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initSzkolaWChmurze();
        }
    }, 50);

    function initSzkolaWChmurze() {
        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        // Poll for question changes
        setInterval(checkQuestion, 800);

        function getText(el) {
            return (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
        }

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // Szkola w Chmurze uses choicegroup element
            const choiceGroup = document.querySelector('choicegroup');
            if (!choiceGroup) return;

            // Find question text - usually in preceding element or parent
            let questionEl = choiceGroup.closest('.que, .question, [class*="question"]');
            if (!questionEl) {
                questionEl = choiceGroup.parentElement;
            }

            // Try to find question text element
            let qtextEl = questionEl.querySelector('.qtext, .question-text, [class*="prompt"]');
            if (!qtextEl && questionEl !== choiceGroup.parentElement) {
                qtextEl = choiceGroup.previousElementSibling;
            }

            const questionText = qtextEl ? getText(qtextEl) : getText(questionEl);
            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Detect type from choicegroup
            const typeAttr = choiceGroup.getAttribute('type')?.trim().toLowerCase();
            let questionType = 'choice';
            let isMultiple = false;

            if (typeAttr === 'multiplechoice') {
                questionType = 'choice';
                isMultiple = false;
            } else if (typeAttr === 'multichoice') {
                questionType = 'choice';
                isMultiple = true;
            }

            // Extract options from mat-radio-button or mat-checkbox
            const optionEls = choiceGroup.querySelectorAll('mat-radio-button, mat-checkbox');
            const options = [];

            optionEls.forEach(el => {
                const label = el.querySelector('label.mdc-label');
                if (label) {
                    const text = getText(label);
                    if (text) options.push(text);
                }
            });

            // Extract images
            const imgPromises = [];
            if (qtextEl) {
                qtextEl.querySelectorAll('img').forEach(img => {
                    imgPromises.push(window.xdAnswers.imageToBase64(img.src));
                });
            }

            Promise.all(imgPromises).then(images => {
                const questionData = {
                    text: questionText,
                    options: options.length > 0 ? options : undefined,
                    base64Images: images.filter(img => img !== null),
                    questionType: questionType,
                    isMultiple: isMultiple
                };

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    if (questionEl && !questionEl.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.setupOneClickHandler(questionEl, async () => {
                            return {
                                text: questionText,
                                options: options.length > 0 ? options : undefined,
                                base64Images: images.filter(img => img !== null),
                                questionType: questionType
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
