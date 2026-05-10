(function() {
    'use strict';
    let lastQuestionText = '';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initMiyklas();
        }
    }, 50);

    function initMiyklas() {
        window.xdAnswers.onRefresh = () => { lastQuestionText = ''; checkQuestion(); };

        setInterval(checkQuestion, 800);

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            // Miyklas uses specific field patterns per InRoute analysis
            const dndFields = document.querySelectorAll('[id^="DND_FIELD_"]');
            const optionEls = document.querySelectorAll('[id^="OPTION_"]');

            let questionText = '';
            let fields = [];
            let options = [];

            if (dndFields.length > 0) {
                // Build question text from DND fields
                fields = Array.from(dndFields);
                fields.forEach((field, idx) => {
                    questionText += field.innerText.trim();
                    if (idx < fields.length - 1) questionText += ' ___ ';
                });
            }

            if (optionEls.length > 0) {
                options = Array.from(optionEls).map(el => {
                    const match = el.id.match(/OPTION_(\d+)/);
                    return match ? { id: match[1], text: el.innerText.trim() } : null;
                }).filter(Boolean);
            }

            // Fallback to generic selectors if no DND fields found
            if (!questionText) {
                const genericQuestion = document.querySelector('.question-text, [data-testid="question"], .task');
                if (!genericQuestion) return;
                questionText = genericQuestion.innerText.trim();
            }

            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Detect MathML / MathJax
            const mathElements = document.querySelectorAll('math, .mathjax, [class*="math"], mjx-container');
            let hasMath = mathElements.length > 0;

            // Build full prompt text including options
            let fullText = questionText;
            if (options.length > 0) {
                fullText += '\n\nВаріанти відповідей:\n' + options.map(o => `${o.id}: ${o.text}`).join('\n');
            }

            // If MathML present, add note
            if (hasMath) {
                fullText += '\n\n(Примітка: у питанні присутні математичні формули (MathJax). Відповідай відповідно.)';
            }

            // Collect images
            const imgPromises = [];
            document.querySelectorAll('img').forEach(img => {
                imgPromises.push(window.xdAnswers.imageToBase64(img.src));
            });

            Promise.all(imgPromises).then(images => {
                const questionData = {
                    text: fullText,
                    base64Images: images.filter(img => img !== null),
                    questionType: fields.length > 0 ? 'dragdrop' : (options.length > 0 ? 'choice' : 'text'),
                    // Store Miyklas-specific data for answer application
                    _miyklasFields: fields.map(f => f.id),
                    _miyklasOptions: options
                };

                const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    const container = fields[0]?.closest('.question, [data-testid="question"]') || document.body;
                    if (!container.classList.contains('xd-oneclick-ready')) {
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
