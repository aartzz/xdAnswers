// src/dom/select.js
// Answer highlighting and auto-selection. Extracted from legacy utils.js (lines 1479-1639).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    function highlightCorrectAnswer(answerText) {
        const I = window.xdAnswers._internal;
        // Only highlight when setting is enabled and not in any silent mode
        if (!window.xdAnswers.settings.highlightCorrect) return;
        const silentMode = window.xdAnswers.settings.silentMode || '';
        if (silentMode !== '') return; // silent mode handles its own indicators/title/clipboard
        // Clear previous highlights first
        document.querySelectorAll('.xd-highlight-correct').forEach(el => {
            el.classList.remove('xd-highlight-correct');
            el.style.removeProperty('outline');
            el.style.removeProperty('background-color');
            el.style.removeProperty('border-radius');
        });
        const allOptionElements = I.findOptionElements();
        const scopedContainer = window.xdAnswers._oneClickContainer || window.xdAnswers._answerContainer;
        const optionElements = scopedContainer
            ? allOptionElements.filter(el => scopedContainer.contains(el))
            : allOptionElements;
        const elements = I.matchAnswerToOptions(answerText, optionElements);
        for (const el of elements) {
            const target = el.closest('.question-option, .answer-item, .v-test-questions-select-block, .v-test-questions-radio-block, .v-test-questions-checkbox-block, label, [role="radio"], [role="checkbox"], [data-automation-id="choiceItem"]') || el;
            target.classList.add('xd-highlight-correct');
            target.style.setProperty('outline', '3px solid #22c55e', 'important');
            target.style.setProperty('background-color', 'rgba(34, 197, 94, 0.15)', 'important');
            target.style.setProperty('border-radius', '4px', 'important');
        }
    }

    function formatDateForMSForms(text) {
        if (!text) return text;
        text = text.trim();
        // Already in dd.MM.yyyy format
        if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text)) return text;
        // ISO: yyyy-MM-dd → dd.MM.yyyy
        const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
        // dd/mm/yyyy or dd-mm-yyyy where day > 12 (unambiguous day-first)
        const dmy = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) {
            const a = parseInt(dmy[1]), b = parseInt(dmy[2]);
            if (a > 12 && b <= 12) {
                // a must be day, b is month
                return `${String(a).padStart(2,'0')}.${String(b).padStart(2,'0')}.${dmy[3]}`;
            }
            if (b > 12 && a <= 12) {
                // b must be day, a is month (US mm/dd/yyyy)
                return `${String(b).padStart(2,'0')}.${String(a).padStart(2,'0')}.${dmy[3]}`;
            }
        }
        // Try native Date parse for text formats ("January 15, 2024", etc.)
        try {
            const date = new Date(text);
            if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}.${month}.${year}`;
            }
        } catch (e) {}
        return text;
    }

    function autoSelectAnswer(answerText, force) {
        const I = window.xdAnswers._internal;
        if (!force && !window.xdAnswers.settings.autoAnswer) return;
        const allOptionElements = I.findOptionElements();
        const scopedContainer = window.xdAnswers._oneClickContainer || window.xdAnswers._answerContainer;
        // In oneclick/answer-scoped mode, only select options within the clicked question container
        const optionElements = scopedContainer
            ? allOptionElements.filter(el => scopedContainer.contains(el))
            : allOptionElements;
        const elements = I.matchAnswerToOptions(answerText, optionElements);

        setTimeout(() => {
            // Flag to prevent oneclick handler from re-triggering on programmatic clicks
            window.xdAnswers._autoSelecting = true;

            if (elements.length > 0) {
                for (const el of elements) {
                    // Try multiple click target strategies
                    const clickTarget = el.closest('.question-option, .answer-item, .v-test-questions-select-block, .v-test-questions-radio-block, .v-test-questions-checkbox-block, label, [role="radio"], [role="checkbox"], [data-automation-id="choiceItem"]') || el;

                    // Strategy 1: Direct click
                    clickTarget.click();

                    // Strategy 2: If there's a radio/checkbox input inside, click it too
                    const input = clickTarget.querySelector('input[type="radio"], input[type="checkbox"]')
                        || clickTarget.closest('label')?.querySelector('input[type="radio"], input[type="checkbox"]');
                    if (input && !input.checked) {
                        input.click();
                    }

                    // Strategy 3: Dispatch events for React/Angular apps
                    clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                }
            } else if (scopedContainer && answerText) {
                // No option elements matched — try text/paragraph inputs
                // GForms: input.whsOnd (short text), textarea.KHxj8b (paragraph)
                // Vseosvita: .a-test-lab-inp input[type="text"] (open answer)
                const textInput = scopedContainer.querySelector('input.whsOnd, .a-test-lab-inp input[type="text"], input[data-automation-id="textInput"], input[role="combobox"], input[type="text"]');
                const textArea = scopedContainer.querySelector('textarea.KHxj8b, textarea');
                const target = textArea || textInput;
                if (target) {
                    // For MS Forms date combobox, parse and format as dd.MM.yyyy
                    let fillText = answerText;
                    if (target.matches('input[role="combobox"]')) {
                        fillText = I.formatDateForMSForms(answerText);
                    }
                    // Use native value setter matching the element type to bypass React/jQlite wrappers
                    const proto = target instanceof HTMLTextAreaElement
                        ? window.HTMLTextAreaElement.prototype
                        : window.HTMLInputElement.prototype;
                    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                    if (nativeSetter) nativeSetter.call(target, fillText);
                    else target.value = fillText;
                    // Dispatch input event so Google Forms/MS Forms picks up the change
                    target.dispatchEvent(new Event('input', { bubbles: true }));
                    target.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            // For multiquiz questions: click the "save answers" / "confirm" button after selecting options
            // Only when checkboxes are present (multiquiz) — single-answer questions don't need a save step
            // Naurok: .test-multiquiz-save-button, [ng-click*="save"], .test-action-button with "зберегти"
            // Generic: any visible button/link containing save/confirm text after checkbox selection
            const hasCheckboxes = !!document.querySelector('input[type="checkbox"]:not(.ng-hide)') ||
                !!document.querySelector('[ng-click*="multiquiz"], .question-option-inner-multiple, .fa-check-square-o');
            if (elements.length > 1 && hasCheckboxes) {
                let saveBtn = document.querySelector(
                    '.test-multiquiz-save-button:not(.ng-hide), ' +
                    'a[ng-click*="save"]:not(.ng-hide), ' +
                    '[ng-click*="saveAnswer"], ' +
                    '[ng-click*="check"], ' +
                    '.test-action-button:not(.ng-hide):not([disabled])'
                );
                // Fallback: find button/link by text content ("зберегти", "save", "confirm")
                if (!saveBtn) {
                    const allBtns = document.querySelectorAll('button, a[ng-click], [role="button"], .btn, .test-action-button, .test-multiquiz-save-button');
                    for (const btn of allBtns) {
                        const t = (btn.innerText || '').trim().toLowerCase();
                        if (t.includes('зберегти') || t.includes('save') || t.includes('confirm') || t.includes('підтвердити')) {
                            if (!btn.classList.contains('ng-hide') && !btn.disabled && btn.offsetParent !== null) {
                                saveBtn = btn;
                                break;
                            }
                        }
                    }
                }
                if (saveBtn) {
                    setTimeout(() => {
                        saveBtn.click();
                        saveBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        saveBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    }, 200);
                }
            }

            // Clear scoped container after selection
            window.xdAnswers._oneClickContainer = null;
            window.xdAnswers._answerContainer = null;
            window.xdAnswers._autoSelecting = false;
        }, window.xdAnswers.settings.autoAnswerCooldown);
    }

    // Export to _internal for cross-file access
    window.xdAnswers._internal.highlightCorrectAnswer = highlightCorrectAnswer;
    window.xdAnswers._internal.formatDateForMSForms = formatDateForMSForms;
    window.xdAnswers._internal.autoSelectAnswer = autoSelectAnswer;
})();
