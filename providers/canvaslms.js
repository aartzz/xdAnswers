(function() {
    'use strict';
    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initCanvasLms();
        }
    }, 50);

    function initCanvasLms() {
        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        // Poll for question changes
        setInterval(checkQuestion, 800);

        function getText(el) {
            return (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
        }

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // Canvas LMS uses .display_question.question
            const questionEl = document.querySelector('.display_question.question');
            if (!questionEl) return;

            const qtextEl = questionEl.querySelector('.question_text, .text');
            if (!qtextEl) return;

            const questionText = getText(qtextEl);
            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Detect question type
            const isMultiChoice = questionEl.classList.contains('multiple_choice_question');
            const isMultiAnswer = questionEl.classList.contains('multiple_answers_question');
            const isTrueFalse = questionEl.classList.contains('true_false_question');
            const isShortAnswer = questionEl.classList.contains('short_answer_question') || questionEl.classList.contains('essay_question');
            const isMatching = questionEl.classList.contains('matching_question');

            let options = [];
            let questionType = 'text';

            if (isMultiChoice || isMultiAnswer || isTrueFalse) {
                const answerEls = questionEl.querySelectorAll('.answer > div, .answer label');
                answerEls.forEach(el => {
                    const text = getText(el);
                    if (text && text.length > 0 && text.length < 500) {
                        options.push(text);
                    }
                });
                questionType = 'choice';
            } else if (isMatching) {
                const rows = questionEl.querySelectorAll('.matching_table tr');
                let matchText = questionText + '\n\nMatching pairs:';
                rows.forEach(row => {
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
