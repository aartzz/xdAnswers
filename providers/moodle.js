(function() {
    'use strict';
    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initMoodle();
        }
    }, 50);

    function initMoodle() {
        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        // Poll for question changes
        setInterval(checkQuestion, 800);

        function getText(el) {
            return (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
        }

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // Moodle uses .que class for questions
            const questionEl = document.querySelector('.que');
            if (!questionEl) return;

            const qtextEl = questionEl.querySelector('.qtext');
            if (!qtextEl) return;

            const questionText = getText(qtextEl);
            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Detect question type
            const isMultiChoice = questionEl.classList.contains('multichoice') || questionEl.classList.contains('calculatedmulti');
            const isTrueFalse = questionEl.classList.contains('truefalse');
            const isMatch = questionEl.classList.contains('match');
            const isShortAnswer = questionEl.classList.contains('shortanswer') || questionEl.classList.contains('essay') || questionEl.classList.contains('numerical') || questionEl.classList.contains('calculated');

            let options = [];
            let questionType = 'text';

            if (isMultiChoice || isTrueFalse) {
                const answerEls = questionEl.querySelectorAll('.answer .r0, .answer .r1, .answer > div');
                answerEls.forEach(el => {
                    const label = el.querySelector('label');
                    if (label) {
                        const text = getText(label);
                        if (text) options.push(text);
                    } else {
                        const text = getText(el);
                        if (text && text.length < 500) options.push(text);
                    }
                });
                questionType = 'choice';
            } else if (isMatch) {
                const matchEls = questionEl.querySelectorAll('.matchtable tr');
                let matchText = questionText + '\n\nMatching pairs:';
                matchEls.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        matchText += '\n- ' + getText(cells[0]) + ' → ' + getText(cells[1]);
                    }
                });
                questionText = matchText;
                questionType = 'text';
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
                    questionType: questionType
                };

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    if (!questionEl.classList.contains('xd-oneclick-ready')) {
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
