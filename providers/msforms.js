(function() {
    'use strict';

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initMSForms();
        }
    }, 50);

    function initMSForms() {
        let lastQuestionHash = '';
        let debounceTimer = null;

        window.xdAnswers.onRefresh = () => {
            lastQuestionHash = '';
            scanQuestions();
        };

        // Listen for URL changes (MS Forms may navigate between pages via history API)
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'msform_url_changed') {
                lastQuestionHash = '';
                setTimeout(scanQuestions, 1500);
            }
            return true; // keep channel open for async responses
        });

        // ── Question type detection ──

        function getQuestionType(questionItem) {
            const typeInfoEl = questionItem.querySelector('[id^="QuestionInfo_"]');
            const typeInfo = typeInfoEl ? typeInfoEl.textContent.trim().toLowerCase() : '';

            // Check structural hints
            const hasRadiogroup = !!questionItem.querySelector('[role="radiogroup"]');
            const hasCheckboxGroup = !!questionItem.querySelector('[role="group"]');
            const hasTextInput = !!questionItem.querySelector('input[data-automation-id="textInput"]');
            const hasTextarea = !!questionItem.querySelector('textarea');
            const hasDateInput = !!questionItem.querySelector('input[role="combobox"]');
            const hasListbox = !!questionItem.querySelector('[role="listbox"]');
            // Likert uses native <table> with role="group" (not role="table")
            const hasTable = !!questionItem.querySelector('[role="table"], table');

            // Disambiguate by typeInfo text (localized, covers Ukrainian/English/Russian)
            if (hasRadiogroup) {
                if (typeInfo.includes('оцінк') || typeInfo.includes('rating') || typeInfo.includes('оценк')) return 'rating';
                if (typeInfo.includes('net promoter') || typeInfo.includes('nps')) return 'nps';
                if (typeInfo.includes('лайкерт') || typeInfo.includes('likert') || hasTable) return 'likert';
                // Single choice
                return 'choice';
            }
            if (hasCheckboxGroup) {
                if (hasTable) return 'likert';
                // Multiple choice
                return 'multichoice';
            }
            if (hasTextarea) return 'textarea';
            if (hasTextInput) return 'text';
            if (hasDateInput) return 'date';
            if (hasListbox) return 'ranking';

            return 'unknown';
        }

        // ── Option extraction per type ──

        function extractOptions(questionItem, type) {
            const options = [];

            switch (type) {
                case 'choice':
                case 'multichoice': {
                    const choiceItems = questionItem.querySelectorAll('[data-automation-id="choiceItem"]');
                    choiceItems.forEach(item => {
                        const textEl = item.querySelector('.text-format-content');
                        if (textEl) {
                            const text = textEl.innerText.trim();
                            if (text) options.push(text);
                        } else {
                            // Fallback: use input value
                            const input = item.querySelector('input[type="radio"], input[type="checkbox"]');
                            if (input && input.value) options.push(input.value);
                        }
                    });
                    break;
                }
                case 'rating': {
                    // Rating uses custom <span role="radio" aria-label="N Star/Heart">
                    const radios = questionItem.querySelectorAll('[role="radiogroup"] [role="radio"]');
                    radios.forEach(radio => {
                        const label = radio.getAttribute('aria-label') || '';
                        if (label) options.push(label);
                    });
                    break;
                }
                case 'nps': {
                    // NPS uses native <input type="radio"> + <label> with number text
                    const labels = questionItem.querySelectorAll('[data-automation-id="npsCell"] label');
                    if (labels.length > 0) {
                        labels.forEach(label => {
                            const text = label.innerText.trim();
                            if (text) options.push(text);
                        });
                    } else {
                        // Fallback: use aria-label from inputs
                        const radios = questionItem.querySelectorAll('[role="radiogroup"] input[type="radio"]');
                        radios.forEach(radio => {
                            const label = radio.getAttribute('aria-label') || radio.value;
                            if (label) options.push(label);
                        });
                    }
                    break;
                }
                case 'ranking': {
                    const optEls = questionItem.querySelectorAll('[role="option"]');
                    optEls.forEach(el => {
                        const text = el.querySelector('.text-format-content')?.innerText.trim() || el.innerText.trim();
                        if (text) options.push(text);
                    });
                    break;
                }
                case 'likert': {
                    // Likert: native <table> with <th> column headers and <th> row headers
                    const table = questionItem.querySelector('table');
                    if (!table) break;
                    const headerRow = table.querySelector('tr');
                    // Column headers: all <th> in first row, skip empty corner cell
                    const colHeaders = headerRow
                        ? Array.from(headerRow.querySelectorAll('th'))
                            .map(th => th.innerText.trim())
                            .filter(Boolean)
                        : [];
                    // Row headers: first <th> in each subsequent row
                    const dataRows = table.querySelectorAll('tr');
                    for (let i = 1; i < dataRows.length; i++) {
                        const rowHeader = dataRows[i].querySelector('th');
                        if (rowHeader) {
                            const rowText = rowHeader.innerText.trim();
                            if (rowText && colHeaders.length) {
                                options.push(rowText + ' [' + colHeaders.join(', ') + ']');
                            }
                        }
                    }
                    break;
                }
                // text, textarea, date: no options (free-form input)
            }

            return options;
        }

        // ── Mark option elements with data-xd-option for utils.js ──

        function markOptionElements(questionItem, type) {
            switch (type) {
                case 'choice':
                case 'multichoice': {
                    const choiceItems = questionItem.querySelectorAll('[data-automation-id="choiceItem"]');
                    choiceItems.forEach(item => {
                        const textEl = item.querySelector('.text-format-content');
                        if (textEl) {
                            textEl.setAttribute('data-xd-option', 'true');
                        } else {
                            item.setAttribute('data-xd-option', 'true');
                        }
                    });
                    break;
                }
                case 'rating': {
                    // Rating uses custom <span role="radio" aria-label="N Star/Heart">
                    // No visible text content - need synthetic spans INSIDE the role=radio span for matching
                    const radios = questionItem.querySelectorAll('[role="radiogroup"] [role="radio"]');
                    radios.forEach(radio => {
                        // Check if synthetic span already exists
                        let textEl = radio.querySelector('.xd-synthetic-option');
                        if (!textEl) {
                            textEl = document.createElement('span');
                            textEl.className = 'xd-synthetic-option';
                            textEl.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
                            const label = radio.getAttribute('aria-label') || '';
                            textEl.textContent = label;
                            radio.style.position = 'relative';
                            radio.appendChild(textEl);
                        }
                        textEl.setAttribute('data-xd-option', 'true');
                    });
                    break;
                }
                case 'nps': {
                    // NPS has <label> elements with number text inside npsCell containers
                    const labels = questionItem.querySelectorAll('[data-automation-id="npsCell"] label');
                    if (labels.length > 0) {
                        labels.forEach(label => {
                            label.setAttribute('data-xd-option', 'true');
                        });
                    } else {
                        // Fallback: create synthetic spans for matching
                        const radios = questionItem.querySelectorAll('[role="radiogroup"] input[type="radio"]');
                        radios.forEach(radio => {
                            const parent = radio.closest('[data-automation-id="npsCell"]') || radio.parentElement;
                            let textEl = parent.querySelector('.xd-synthetic-option');
                            if (!textEl) {
                                textEl = document.createElement('span');
                                textEl.className = 'xd-synthetic-option';
                                textEl.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
                                const label = radio.getAttribute('aria-label') || radio.value;
                                textEl.textContent = label;
                                parent.style.position = 'relative';
                                parent.appendChild(textEl);
                            }
                            textEl.setAttribute('data-xd-option', 'true');
                        });
                    }
                    break;
                }
                case 'ranking': {
                    const optEls = questionItem.querySelectorAll('[role="option"]');
                    optEls.forEach(el => {
                        const textEl = el.querySelector('.text-format-content');
                        if (textEl) {
                            textEl.setAttribute('data-xd-option', 'true');
                        } else {
                            el.setAttribute('data-xd-option', 'true');
                        }
                    });
                    break;
                }
                // likert, text, textarea, date: no standard option marking needed
            }
        }

        // ── Question data extraction ──

        function extractQuestionData(questionItem) {
            const type = getQuestionType(questionItem);

            // Title text
            const titleEl = questionItem.querySelector('[data-automation-id="questionTitle"] .text-format-content')
                || questionItem.querySelector('[data-automation-id="questionTitle"]');
            const questionText = titleEl ? titleEl.innerText.trim() : '';

            if (!questionText) return null;

            // Images
            const imageUrls = [];
            questionItem.querySelectorAll('img').forEach(img => {
                if (img.width > 50 && img.height > 50 && img.src && !img.src.startsWith('data:')) {
                    imageUrls.push(img.src);
                }
            });

            // Options
            const options = extractOptions(questionItem, type);

            // Determine questionType for AI
            let aiQuestionType = 'quiz';
            let isMulti = false;

            if (type === 'multichoice' || type === 'likert') {
                isMulti = true;
            } else if (type === 'ranking') {
                aiQuestionType = 'ordering';
            } else if (type === 'text' || type === 'textarea' || type === 'date') {
                aiQuestionType = 'general';
            } else if (type === 'rating' || type === 'nps') {
                aiQuestionType = 'quiz';
            }

            // For date questions, add format hint so AI outputs correct format
            let optionsText = options.join('\n') || undefined;
            if (type === 'date') {
                optionsText = 'Format: dd.MM.yyyy (e.g., 15.01.2024)';
            }

            return {
                type,
                questionItem,
                text: questionText,
                optionsText,
                base64ImageSources: imageUrls,
                questionType: aiQuestionType,
                isMulti,
                isMultiQuiz: isMulti
            };
        }

        // ── Custom auto-answer: Likert ──
        // AI answer format: "RowName1: ColumnName3; RowName2: ColumnName5"
        // Clicks the radio whose aria-label matches "RowName ColumnName"

        function autoAnswerLikert(questionItem, answerText) {
            const table = questionItem.querySelector('table');
            if (!table) return;

            // Parse answer: split by ";" then by ":" or "→" or "-"
            const pairs = answerText.split(';').map(s => s.trim()).filter(Boolean);
            const matched = [];

            for (const pair of pairs) {
                const parts = pair.split(/[:→\-–—]/, 2).map(s => s.trim());
                if (parts.length < 2) continue;

                const rowName = parts[0];
                const colName = parts[1];

                // Find radio with aria-label containing both row and column text
                const radios = table.querySelectorAll('input[type="radio"]');
                for (const radio of radios) {
                    const label = (radio.getAttribute('aria-label') || '').toLowerCase();
                    const rn = rowName.toLowerCase().replace(/\s+/g, ' ').trim();
                    const cn = colName.toLowerCase().replace(/\s+/g, ' ').trim();
                    if (label.includes(rn) && label.includes(cn)) {
                        if (!radio.checked) {
                            radio.click();
                        }
                        matched.push(radio);
                        break;
                    }
                }
            }

            // Highlight matched rows/cells
            for (const radio of matched) {
                const td = radio.closest('td');
                if (td) {
                    td.style.setProperty('outline', '3px solid #22c55e', 'important');
                    td.style.setProperty('background-color', 'rgba(34, 197, 94, 0.15)', 'important');
                    td.style.setProperty('border-radius', '4px', 'important');
                }
            }
        }

        // ── Custom auto-answer: Ranking ──
        // AI answer: options listed in correct order (1st = best, last = worst)
        // Strategy: simulate mouse drag events to reorder options in the DOM

        function autoAnswerRanking(questionItem, answerText) {
            const listbox = questionItem.querySelector('[role="listbox"]');
            if (!listbox) return;

            // Parse desired order from answer
            const desiredOrder = answerText.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
            if (desiredOrder.length === 0) return;

            // Get current option elements
            const currentOptions = Array.from(listbox.querySelectorAll('[role="option"]'));
            if (currentOptions.length === 0) return;

            // Build current order (text content of each option)
            const currentTexts = currentOptions.map(el => {
                const content = el.querySelector('[data-automation-id="rankingItemContent"] .text-format-content');
                return content ? content.innerText.trim() : el.innerText.trim();
            });

            // Map desired order texts to current option elements
            const desiredElements = [];
            for (const desired of desiredOrder) {
                const nd = norm(desired);
                let bestEl = null, bestScore = 0;
                for (const el of currentOptions) {
                    const content = el.querySelector('[data-automation-id="rankingItemContent"] .text-format-content');
                    const elText = content ? content.innerText.trim() : el.innerText.trim();
                    const nt = norm(elText);
                    if (nt === nd) { bestEl = el; bestScore = 1; break; }
                    if (nt.includes(nd) || nd.includes(nt)) {
                        const score = Math.min(nt.length, nd.length) / Math.max(nt.length, nd.length);
                        if (score > bestScore) { bestScore = score; bestEl = el; }
                    }
                }
                if (bestEl && bestScore > 0.4) desiredElements.push(bestEl);
            }

            // If we couldn't match enough, just highlight the answer text
            if (desiredElements.length < currentOptions.length) {
                // Fallback: show answer text as visual hint
                highlightRankingAnswer(questionItem, desiredOrder);
                return;
            }

            // Simulate mouse drags to reorder
            // Strategy: move each desired element to its correct position from top to bottom
            reorderRankingByDrag(listbox, desiredElements, currentOptions);
        }

        function highlightRankingAnswer(questionItem, desiredOrder) {
            // Visual fallback: add numbered badges next to each matched option
            const options = questionItem.querySelectorAll('[role="option"]');

            for (let i = 0; i < desiredOrder.length; i++) {
                const nd = norm(desiredOrder[i]);
                for (const opt of options) {
                    const content = opt.querySelector('[data-automation-id="rankingItemContent"] .text-format-content');
                    const elText = content ? content.innerText.trim() : opt.innerText.trim();
                    if (norm(elText) === nd) {
                        const badge = document.createElement('span');
                        badge.className = 'xd-ranking-badge';
                        badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#6366f1;color:white;font-size:12px;font-weight:700;margin-right:6px;flex-shrink:0;';
                        badge.textContent = String(i + 1);
                        opt.style.setProperty('outline', i === 0 ? '3px solid #22c55e' : '2px solid #6366f1', 'important');
                        opt.style.setProperty('border-radius', '4px', 'important');
                        opt.insertBefore(badge, opt.firstChild);
                        break;
                    }
                }
            }
        }

        async function reorderRankingByDrag(listbox, desiredElements, currentOptions) {
            // Strategy: for each position from 0 to N-1, drag the desired element to that position
            // We simulate real mouse events at the correct screen coordinates
            
            for (let targetIdx = 0; targetIdx < desiredElements.length; targetIdx++) {
                const desiredEl = desiredElements[targetIdx];
                
                // Re-read current DOM order (it may have changed after previous drags)
                const liveOptions = Array.from(listbox.querySelectorAll('[role="option"]'));
                const currentIdx = liveOptions.indexOf(desiredEl);
                
                if (currentIdx === targetIdx) continue; // already in correct position
                if (currentIdx === -1) continue; // element no longer in DOM
                
                // Simulate drag: mousedown on source, mousemove to target position, mouseup
                const sourceRect = desiredEl.getBoundingClientRect();
                const targetEl = liveOptions[targetIdx];
                const targetRect = targetEl.getBoundingClientRect();
                
                // Drag from center of source to center of target
                const startX = sourceRect.left + sourceRect.width / 2;
                const startY = sourceRect.top + sourceRect.height / 2;
                const endX = targetRect.left + targetRect.width / 2;
                const endY = targetRect.top + targetRect.height / 2;
                
                // Dispatch mousedown
                desiredEl.dispatchEvent(new MouseEvent('mousedown', {
                    bubbles: true, cancelable: true,
                    clientX: startX, clientY: startY,
                    screenX: startX, screenY: startY,
                    button: 0
                }));
                
                // Dispatch mousemove in steps
                const steps = 10;
                for (let s = 1; s <= steps; s++) {
                    const progress = s / steps;
                    const mx = startX + (endX - startX) * progress;
                    const my = startY + (endY - startY) * progress;
                    document.dispatchEvent(new MouseEvent('mousemove', {
                        bubbles: true, cancelable: true,
                        clientX: mx, clientY: my,
                        screenX: mx, screenY: my,
                        button: 0
                    }));
                }
                
                // Dispatch mouseup
                document.dispatchEvent(new MouseEvent('mouseup', {
                    bubbles: true, cancelable: true,
                    clientX: endX, clientY: endY,
                    screenX: endX, screenY: endY,
                    button: 0
                }));
                
                // Small delay between drags
                await new Promise(r => setTimeout(r, 150));
            }

            // After attempting drag, check if order actually changed
            // If not, fall back to visual badges
            const finalOptions = Array.from(listbox.querySelectorAll('[role="option"]'));
            const finalTexts = finalOptions.map(el => {
                const c = el.querySelector('[data-automation-id="rankingItemContent"] .text-format-content');
                return c ? c.innerText.trim() : el.innerText.trim();
            });
            const desiredTexts = desiredElements.map(el => {
                const c = el.querySelector('[data-automation-id="rankingItemContent"] .text-format-content');
                return c ? c.innerText.trim() : el.innerText.trim();
            });
            
            let orderChanged = false;
            for (let i = 0; i < Math.min(finalTexts.length, desiredTexts.length); i++) {
                if (norm(finalTexts[i]) === norm(desiredTexts[i])) { orderChanged = true; break; }
            }
            
            if (!orderChanged) {
                // Drag didn't work - use visual fallback
                // Remove any badges we might have added
                listbox.querySelectorAll('.xd-ranking-badge').forEach(b => b.remove());
                highlightRankingAnswer(questionItem.closest('[data-automation-id="questionItem"]') || listbox, desiredTexts);
            } else {
                // Success - highlight the #1 option
                if (finalOptions.length > 0) {
                    finalOptions[0].style.setProperty('outline', '3px solid #22c55e', 'important');
                    finalOptions[0].style.setProperty('border-radius', '4px', 'important');
                }
            }
        }

        function norm(t) { return t.toLowerCase().replace(/\s+/g, ' ').trim(); }

        // ── Build hash of current page state ──

        function buildStateHash() {
            const questionItems = document.querySelectorAll('[data-automation-id="questionItem"]');
            return Array.from(questionItems).map(qi => {
                const title = qi.querySelector('[data-automation-id="questionTitle"]');
                return title ? title.innerText.trim() : '';
            }).join('|||');
        }

        // ── Main scan ──

        function scanQuestions() {
            if (window.xdAnswers.isProcessingAI) return;

            const questionItems = document.querySelectorAll('[data-automation-id="questionItem"]');
            if (questionItems.length === 0) return;

            const currentHash = buildStateHash();
            if (currentHash === lastQuestionHash) return;
            lastQuestionHash = currentHash;

            // Clear old oneclick handlers when questions change
            if (window.xdAnswers.settings.silentMode === 'oneclick') {
                window.xdAnswers.clearOneClickHandlers();
            }

            // Remove old synthetic option spans and ranking badges from previous scan
            document.querySelectorAll('.xd-synthetic-option, .xd-ranking-badge').forEach(el => el.remove());
            // Remove old ranking highlights
            document.querySelectorAll('[role="option"]').forEach(el => {
                el.style.removeProperty('outline');
                el.style.removeProperty('border-radius');
            });

            const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';

            questionItems.forEach((questionItem) => {
                const data = extractQuestionData(questionItem);
                if (!data) return;

                // Mark option elements for utils.js findOptionElements/matchAnswerToOptions
                markOptionElements(questionItem, data.type);

                if (isOneClick) {
                    // One-click mode: click on question triggers AI → auto-select
                    if (questionItem.classList.contains('xd-oneclick-ready')) return;

                    // Capture data for click-time processing
                    const savedType = data.type;
                    const savedText = data.text;
                    const savedOptionsText = data.optionsText;
                    const savedImageUrls = data.base64ImageSources;
                    const savedQuestionType = data.questionType;
                    const savedIsMulti = data.isMulti;
                    const savedIsMultiQuiz = data.isMultiQuiz;
                    const savedItem = questionItem;

                    window.xdAnswers.setupOneClickHandler(questionItem, async () => {
                        // Re-mark options in case DOM changed
                        markOptionElements(savedItem, savedType);
                        // Set custom auto-answer for types that need special handling
                        if (savedType === 'likert' || savedType === 'ranking') {
                            window.xdAnswers._customAutoAnswer = (answerText) => {
                                if (savedType === 'likert') autoAnswerLikert(savedItem, answerText);
                                else if (savedType === 'ranking') autoAnswerRanking(savedItem, answerText);
                            };
                        }
                        const images = await Promise.all(savedImageUrls.map(src => window.xdAnswers.imageToBase64(src)));
                        return {
                            text: savedText,
                            optionsText: savedOptionsText,
                            base64Images: images.filter(Boolean),
                            questionType: savedQuestionType,
                            isMulti: savedIsMulti,
                            isMultiQuiz: savedIsMultiQuiz
                        };
                    });
                } else {
                    // Normal mode: add Solve button per question
                    if (questionItem.querySelector('.xd-solve-btn')) return;

                    const button = document.createElement('button');
                    button.className = 'xd-btn xd-solve-btn';
                    button.innerText = '✨ Solve';
                    button.style.cssText = 'background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.5);color:#6366f1;padding:6px 14px;border-radius:6px;cursor:pointer;margin-top:10px;font-family:system-ui,-apple-system,sans-serif;font-weight:600;font-size:13px;z-index:9999;position:relative;transition:all 0.15s;';

                    // Capture data for button click
                    const savedType = data.type;
                    const savedText = data.text;
                    const savedOptionsText = data.optionsText;
                    const savedImageUrls = data.base64ImageSources;
                    const savedQuestionType = data.questionType;
                    const savedIsMulti = data.isMulti;
                    const savedIsMultiQuiz = data.isMultiQuiz;
                    const savedItem = questionItem;

                    button.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Scope autoSelectAnswer to this question container
                        window.xdAnswers._answerContainer = savedItem;
                        // Set custom auto-answer for types that need special handling
                        if (savedType === 'likert' || savedType === 'ranking') {
                            window.xdAnswers._customAutoAnswer = (answerText) => {
                                if (savedType === 'likert') autoAnswerLikert(savedItem, answerText);
                                else if (savedType === 'ranking') autoAnswerRanking(savedItem, answerText);
                            };
                        }
                        Promise.all(savedImageUrls.map(src => window.xdAnswers.imageToBase64(src))).then(images => {
                            window.xdAnswers.processQuestion({
                                text: savedText,
                                optionsText: savedOptionsText,
                                base64Images: images.filter(Boolean),
                                questionType: savedQuestionType,
                                isMulti: savedIsMulti,
                                isMultiQuiz: savedIsMultiQuiz
                            });
                        });
                    };

                    questionItem.appendChild(button);
                }
            });
        }

        // ── MutationObserver ──

        const observer = new MutationObserver(() => {
            if (window.xdAnswers.isExtensionModifyingDOM) return;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(scanQuestions, 500);
            if (window.xdAnswers.helperContainer && !document.body.contains(window.xdAnswers.helperContainer)) {
                document.body.appendChild(window.xdAnswers.helperContainer);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Initial scan (delayed to let MS Forms render)
        setTimeout(scanQuestions, 1000);
    }
})();
