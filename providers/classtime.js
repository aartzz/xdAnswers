(function() {
    'use strict';
    var lastQuestionText = '';
    var classtimeItems = null;
    var classtimeCategories = null;

    var waitForUtils = setInterval(async function() {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initClasstime();
        }
    }, 50);

    function initClasstime() {
        window.xdAnswers.onRefresh = function() { lastQuestionText = ''; checkQuestion(); };

        var observer = new MutationObserver(function() { checkQuestion(); });
        observer.observe(document.body, { childList: true, subtree: true });
        setInterval(checkQuestion, 1000);

        function simulateDragDrop(sourceEl, targetEl) {
            if (!sourceEl || !targetEl) return;
            var sr = sourceEl.getBoundingClientRect();
            var tr = targetEl.getBoundingClientRect();
            var sx = sr.left + sr.width / 2;
            var sy = sr.top + sr.height / 2;
            var tx = tr.left + tr.width / 2;
            var ty = tr.top + tr.height / 2;

            sourceEl.dispatchEvent(new MouseEvent('mousedown', {
                bubbles: true, cancelable: true, clientX: sx, clientY: sy, button: 0
            }));

            for (var s = 1; s <= 10; s++) {
                var p = s / 10;
                document.dispatchEvent(new MouseEvent('mousemove', {
                    bubbles: true, cancelable: true,
                    clientX: sx + (tx - sx) * p,
                    clientY: sy + (ty - sy) * p,
                    button: 0
                }));
            }

            document.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true, cancelable: true, clientX: tx, clientY: ty, button: 0
            }));
        }

        function norm(s) {
            return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
        }

        function findElementByText(selector, text) {
            var els = document.querySelectorAll(selector);
            var nt = norm(text);
            var best = null;
            var bestScore = 0;
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                var et = norm(el.innerText || el.textContent);
                if (et === nt) return el;
                if (et.includes(nt) || nt.includes(et)) {
                    var score = Math.min(et.length, nt.length) / Math.max(et.length, nt.length);
                    if (score > bestScore) { bestScore = score; best = el; }
                }
            }
            return best;
        }

        function applyClasstimeCategorization(answerText) {
            // Parse answer: "Category A: item1, item2; Category B: item3"
            var mappings = [];
            var blocks = answerText.split(/;\s*\n?/).filter(Boolean);

            for (var b = 0; b < blocks.length; b++) {
                var block = blocks[b].trim();
                var colonIdx = block.indexOf(':');
                if (colonIdx < 0) continue;
                var catName = block.substring(0, colonIdx).trim().replace(/^Категорія\s*/i, '');
                var itemsPart = block.substring(colonIdx + 1).trim();
                var itemNames = itemsPart.split(/,\s*/).map(function(s) { return s.trim(); }).filter(Boolean);

                for (var n = 0; n < itemNames.length; n++) {
                    mappings.push({ category: catName, item: itemNames[n] });
                }
            }

            // Fallback: try "N→category" format if no colons found
            if (mappings.length === 0) {
                var lines = answerText.split(/[\n;]/).filter(Boolean);
                for (var l = 0; l < lines.length; l++) {
                    var parts = lines[l].trim().split(/→|->/);
                    if (parts.length >= 2) {
                        mappings.push({ category: parts[1].trim(), item: parts[0].trim() });
                    }
                }
            }

            var itemEls = document.querySelectorAll('[data-testid="categorizer-item"], .categorizer-item, [data-testid="draggable-item"]');
            var catEls = document.querySelectorAll('[data-testid="category-header"], .category-title, [data-testid="category-drop"]');

            for (var m = 0; m < mappings.length; m++) {
                var map = mappings[m];
                var sourceEl = findElementByText(
                    '[data-testid="categorizer-item"], .categorizer-item, [data-testid="draggable-item"]',
                    map.item
                );
                var targetEl = findElementByText(
                    '[data-testid="category-header"], .category-title, [data-testid="category-drop"]',
                    map.category
                );

                if (sourceEl && targetEl) {
                    simulateDragDrop(sourceEl, targetEl);
                    sourceEl.style.setProperty('outline', '2px solid #22c55e', 'important');
                    sourceEl.style.setProperty('border-radius', '4px', 'important');
                }
            }
        }

        function checkQuestion() {
            if (window.xdAnswers.isProcessingAI) return;

            var isCategorization = !!document.querySelector('[data-testid="student-categorizer-answers-form"]');
            var isDND = !!document.querySelector('[data-testid="draggable-item"], [draggable="true"]');

            var questionSelectors = ['[data-p3-hint]', '.question-text', '[data-testid="question-text"]', 'h1', 'h2', '.task-title'];
            var questionEl = null;
            for (var i = 0; i < questionSelectors.length; i++) {
                questionEl = document.querySelector(questionSelectors[i]);
                if (questionEl) break;
            }
            if (!questionEl) return;

            var questionText = questionEl.innerText.trim();
            if (!questionText || questionText === lastQuestionText) return;
            lastQuestionText = questionText;

            var optionEls = document.querySelectorAll('[data-testid="choice-wrapper"], .answer-option, [data-testid="answer-option"], .choice');
            var options = Array.from(optionEls).map(function(el) { return el.innerText.trim(); }).filter(Boolean);

            var categories, items;
            if (isCategorization) {
                var catEls = document.querySelectorAll('[data-testid="category-header"], .category-title');
                categories = Array.from(catEls).map(function(el) { return el.innerText.trim(); }).filter(Boolean);
                var itemEls = document.querySelectorAll('[data-testid="categorizer-item"], .categorizer-item, [data-testid="draggable-item"]');
                items = Array.from(itemEls).map(function(el) { return el.innerText.trim(); }).filter(Boolean);
                classtimeItems = items;
                classtimeCategories = categories;
            }

            var imgPromises = [];
            var container = questionEl.closest('[data-testid="question"], .question, [class*="question"]') || document.body;
            container.querySelectorAll('img').forEach(function(img) {
                imgPromises.push(window.xdAnswers.imageToBase64(img.src));
            });

            Promise.all(imgPromises).then(function(images) {
                var questionType = 'choice';
                if (isCategorization) questionType = 'categorization';
                else if (isDND) questionType = 'dragdrop';
                else if (options.length === 0) questionType = 'text';

                var questionData = {
                    text: questionText,
                    options: options.length > 0 ? options : undefined,
                    base64Images: images.filter(function(img) { return img !== null; }),
                    questionType: questionType
                };

                if (isCategorization) {
                    questionData.categories = categories;
                    questionData.items = items;
                    questionData.text = questionText + '\n\nКатегорії: ' + categories.join(', ') +
                        '\nЕлементи: ' + items.join(', ') +
                        '\n\nВкажи, який елемент до якої категорії належить (формат: "Назва категорії: елемент1, елемент2; Інша категорія: елемент3")';
                    window.xdAnswers._customAutoAnswer = function(answerText) {
                        applyClasstimeCategorization(answerText);
                        window.xdAnswers._customAutoAnswer = null;
                    };
                } else if (isDND) {
                    window.xdAnswers._customAutoAnswer = function(answerText) {
                        var items = document.querySelectorAll('[data-testid="draggable-item"], [draggable="true"]');
                        var targets = document.querySelectorAll('[data-testid="drop-zone"], .drop-zone, [class*="drop-target"]');
                        if (items.length > 0 && targets.length > 0) {
                            for (var k = 0; k < Math.min(items.length, targets.length); k++) {
                                simulateDragDrop(items[k], targets[k]);
                                items[k].style.setProperty('outline', '2px solid #22c55e', 'important');
                                items[k].style.setProperty('border-radius', '4px', 'important');
                            }
                        }
                        window.xdAnswers._customAutoAnswer = null;
                    };
                } else {
                    delete window.xdAnswers._customAutoAnswer;
                }

                var isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';
                if (isOneClick) {
                    var cont = questionEl.closest('[data-testid="question-container"], .question') || questionEl.parentElement;
                    if (cont && !cont.classList.contains('xd-oneclick-ready')) {
                        window.xdAnswers.clearOneClickHandlers();
                        window.xdAnswers.setupOneClickHandler(cont, async function() { return questionData; });
                    }
                } else {
                    window.xdAnswers.processQuestion(questionData);
                }
            });
        }
    }
})();
