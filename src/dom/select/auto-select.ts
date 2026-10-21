// src/dom/select/auto-select.ts
// Clicks or fills the matched answer elements, then saves multiquiz answers.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function autoSelectAnswer(answerText: string, force?: boolean): void {
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
                    const clickTarget = (el.closest('.question-option, .answer-item, .tb-answer, .v-test-questions-select-block, .v-test-questions-radio-block, .v-test-questions-checkbox-block, label, [role="radio"], [role="checkbox"], [data-automation-id="choiceItem"]') || el) as HTMLElement;

                    // Strategy 1: Direct click
                    clickTarget.click();

                    // Strategy 2: If there's a radio/checkbox input inside, click it too
                    const input = clickTarget.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]')
                        || clickTarget.closest('label')?.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
                    if (input && !input.checked) {
                        input.click();
                    }

                    // Strategy 3: Dispatch events for React/Angular apps
                    clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                }
            } else if ((scopedContainer || document.querySelector('.tb-type-answer input.tb-big-input')) && answerText) {
                // No option elements matched — try text/paragraph inputs
                // GForms: input.whsOnd (short text), textarea.KHxj8b (paragraph)
                // Vseosvita: .a-test-lab-inp input[type="text"] (open answer)
                const inputScope = scopedContainer || document.querySelector('.tb-stagebox, #tb-app') || document;
                const textInput = inputScope.querySelector<HTMLInputElement>('input.whsOnd, .a-test-lab-inp input[type="text"], .tb-type-answer input.tb-big-input, input.tb-big-input, input[data-automation-id="textInput"], input[role="combobox"], input[type="text"]');
                const textArea = inputScope.querySelector<HTMLTextAreaElement>('textarea.KHxj8b, textarea');
                const target: HTMLInputElement | HTMLTextAreaElement | null = textArea || textInput;
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
                    // Naurok test-beta keeps React state in the input and submits from
                    // its surrounding form, so wait one turn before clicking its button.
                    if (target.matches('.tb-big-input')) {
                        const submit = target.closest('form')?.querySelector<HTMLButtonElement>('button:not([disabled])');
                        if (submit) setTimeout(() => submit.click(), 50);
                    }
                }
            }
            // For multiquiz questions: click the "save answers" / "confirm" button after selecting options
            // Only when checkboxes are present (multiquiz) — single-answer questions don't need a save step
            // Naurok: .test-multiquiz-save-button, [ng-click*="save"], .test-action-button with "зберегти"
            // Generic: any visible button/link containing save/confirm text after checkbox selection
            const betaMulti = !!document.querySelector('.tb-answers .tb-answer-tick');
            const hasCheckboxes = !!document.querySelector('input[type="checkbox"]:not(.ng-hide)') ||
                !!document.querySelector('[ng-click*="multiquiz"], .question-option-inner-multiple, .fa-check-square-o') || betaMulti;
            if ((elements.length > 1 || betaMulti) && hasCheckboxes) {
                let saveBtn = document.querySelector<HTMLElement>(
                    '.test-multiquiz-save-button:not(.ng-hide), ' +
                    '.tb-answers + button:not([disabled]), ' +
                    'a[ng-click*="save"]:not(.ng-hide), ' +
                    '[ng-click*="saveAnswer"], ' +
                    '[ng-click*="check"], ' +
                    '.test-action-button:not(.ng-hide):not([disabled])'
                );
                // Fallback: find button/link by text content ("зберегти", "save", "confirm")
                if (!saveBtn) {
                    const allBtns = document.querySelectorAll('button, a[ng-click], [role="button"], .btn, .test-action-button, .test-multiquiz-save-button');
                    for (const btn of allBtns) {
                        const t = ((btn as HTMLElement).innerText || '').trim().toLowerCase();
                        if (t.includes('зберегти') || t.includes('save') || t.includes('confirm') || t.includes('підтвердити')) {
                            if (!btn.classList.contains('ng-hide') && !(btn as HTMLButtonElement).disabled && (btn as HTMLElement).offsetParent !== null) {
                                saveBtn = btn as HTMLElement;
                                break;
                            }
                        }
                    }
                }
                if (saveBtn) {
                    setTimeout(() => {
                        saveBtn!.click();
                        saveBtn!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        saveBtn!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    }, 200);
                }
            }

            // Clear scoped container after selection
            window.xdAnswers._oneClickContainer = null;
            window.xdAnswers._answerContainer = null;
            window.xdAnswers._autoSelecting = false;
        }, window.xdAnswers.settings.autoAnswerCooldown);
    }

    I.autoSelectAnswer = autoSelectAnswer;
})();
