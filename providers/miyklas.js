(function() {
    'use strict';
    var lastQuestionText = '';
    var miyklasFields = [];
    var miyklasOptions = [];

    var waitForUtils = setInterval(async function() {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initMiyklas();
        }
    }, 50);

    function initMiyklas() {
        window.xdAnswers.onRefresh = function() { lastQuestionText = ''; checkQuestion(); };

        setInterval(checkQuestion, 800);

        function simulateDragDrop(sourceEl, targetEl) {
            if (!sourceEl || !targetEl) return;

            var sourceRect = sourceEl.getBoundingClientRect();
            var targetRect = targetEl.getBoundingClientRect();
            var startX = sourceRect.left + sourceRect.width / 2;
            var startY = sourceRect.top + sourceRect.height / 2;
            var endX = targetRect.left + targetRect.width / 2;
            var endY = targetRect.top + targetRect.height / 2;

            sourceEl.dispatchEvent(new MouseEvent('mousedown', {
                bubbles: true, cancelable: true,
                clientX: startX, clientY: startY, button: 0
            }));

            var steps = 10;
            for (var s = 1; s <= steps; s++) {
                var progress = s / steps;
                document.dispatchEvent(new MouseEvent('mousemove', {
                    bubbles: true, cancelable: true,
                    clientX: startX + (endX - startX) * progress,
                    clientY: startY + (endY - startY) * progress,
                    button: 0
                }));
            }

            document.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true, cancelable: true,
                clientX: endX, clientY: endY, button: 0
            }));
        }

        function applyMiyklasDND(answerText) {
            // Parse answer: format is "DND_FIELD_1: OPTION_3" or "1: 3" or "1=3"
            // AI may also answer in Ukrainian: "Поле 1: Варіант 3"
            var mappings = [];

            // Try keyed format: "DND_FIELD_N: OPTION_M" or "N: M" or "N = M" or "N:M"
            var pairs = answerText.split(/[;\n]/).map(function(s) { return s.trim(); }).filter(Boolean);
            for (var i = 0; i < pairs.length; i++) {
                var pair = pairs[i];
                var m = pair.match(/(?:DND_FIELD_)?(\d+)\s*[:=→\-–—]\s*(?:OPTION_)?(\d+)/i);
                if (m) {
                    mappings.push({ fieldIdx: parseInt(m[1], 10), optionIdx: parseInt(m[2], 10) });
                    continue;
                }
                // Try Ukrainian: "Поле 1: Варіант 3"
                m = pair.match(/Поле\s*(\d+).*?[Вв]аріант\s*(\d+)/i);
                if (m) {
                    mappings.push({ fieldIdx: parseInt(m[1], 10), optionIdx: parseInt(m[2], 10) });
                    continue;
                }
            }

            // If no structured mappings parsed, try position-based: answer lists options in field order
            if (mappings.length === 0 && miyklasFields.length > 0) {
                var items = answerText.split(/[;\n]/).map(function(s) { return s.trim(); }).filter(Boolean);
                if (items.length === miyklasFields.length) {
                    for (var j = 0; j < items.length; j++) {
                        var num = parseInt(items[j], 10);
                        if (!isNaN(num)) {
                            mappings.push({ fieldIdx: j + 1, optionIdx: num });
                        }
                    }
                }
            }

            // Apply mappings to DOM
            for (var k = 0; k < mappings.length; k++) {
                var map = mappings[k];
                var fieldEl = document.getElementById('DND_FIELD_' + map.fieldIdx);
                var optionEl = document.getElementById('OPTION_' + map.optionIdx);

                if (fieldEl && optionEl) {
                    // Strategy 1: Click option first, then click field (some DND UIs accept click-to-place)
                    optionEl.click();
                    optionEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    optionEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

                    // Small delay between click and drag attempt
                    // Strategy 2: Simulate drag-and-drop
                    simulateDragDrop(optionEl, fieldEl);

                    // Strategy 3: Direct click on field after option is selected
                    setTimeout(function(fEl) {
                        fEl.click();
                        fEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        fEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    }, 100, fieldEl);

                    // Highlight filled field
                    fieldEl.style.setProperty('outline', '2px solid #22c55e', 'important');
                    fieldEl.style.setProperty('border-radius', '4px', 'important');
                }
            }
        }

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            var dndFields = document.querySelectorAll('[id^="DND_FIELD_"]');
            var optionEls = document.querySelectorAll('[id^="OPTION_"]');

            var questionText = '';
            var fields = [];
            var options = [];

            if (dndFields.length > 0) {
                fields = Array.from(dndFields);
                fields.forEach(function(field, idx) {
                    questionText += field.innerText.trim();
                    if (idx < fields.length - 1) questionText += ' ___ ';
                });
            }

            if (optionEls.length > 0) {
                options = Array.from(optionEls).map(function(el) {
                    var m = el.id.match(/OPTION_(\d+)/);
                    return m ? { id: m[1], text: el.innerText.trim() } : null;
                }).filter(Boolean);
            }

            if (!questionText) {
                var genericQuestion = document.querySelector('.question-text, [data-testid="question"], .task');
                if (!genericQuestion) return;
                questionText = genericQuestion.innerText.trim();
            }

            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            // Store for answer-time use
            miyklasFields = fields;
            miyklasOptions = options;

            // Detect MathML / MathJax
            var mathElements = document.querySelectorAll('math, .mathjax, [class*="math"], mjx-container');
            var hasMath = mathElements.length > 0;

            var fullText = questionText;
            if (options.length > 0) {
                fullText += '\n\nВаріанти відповідей:\n' + options.map(function(o) { return o.id + ': ' + o.text; }).join('\n');
            }

            if (hasMath) {
                fullText += '\n\n(Примітка: у питанні присутні математичні формули (MathJax). Відповідай, зберігаючи математичну нотацію.)';
            }

            var imgPromises = [];
            document.querySelectorAll('img').forEach(function(img) {
                if (img.src) imgPromises.push(window.xdAnswers.imageToBase64(img.src));
            });

            Promise.all(imgPromises).then(function(images) {
                var questionData = {
                    text: fullText,
                    base64Images: images.filter(function(img) { return img !== null; }),
                    questionType: fields.length > 0 ? 'dragdrop' : (options.length > 0 ? 'choice' : 'text'),
                    _miyklasFields: fields.map(function(f) { return f.id; }),
                    _miyklasOptions: options
                };

                // Install DND custom applier for dragdrop questions
                if (fields.length > 0 && options.length > 0) {
                    window.xdAnswers._customAutoAnswer = function(answerText) {
                        applyMiyklasDND(answerText);
                        window.xdAnswers._customAutoAnswer = null;
                    };
                } else {
                    delete window.xdAnswers._customAutoAnswer;
                }

                var isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    var container = fields[0]?.closest('.question, [data-testid="question"]') || document.body;
                    if (!container.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.clearOneClickHandlers();
                        window.xdAnswers.setupOneClickHandler(container, async function() { return questionData; });
                    }
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            });
        }
    }
})();
