// src/dom/select/auto-select.ts
// Clicks or fills the matched answer elements, then saves multiquiz answers.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    // Google Forms dropdowns (role="listbox" with role="option" items) keep a
    // closed "display" copy of the options and an opened menu copy. A click on
    // an option while the menu is closed only expands the listbox, so the
    // option has to be clicked again inside the opened menu.
    function closestDropdownOption(el: Element): Element | null {
        const option = el.getAttribute('role') === 'option' ? el : el.closest('[role="option"]');
        if (!option) return null;
        return option.closest('[role="listbox"][aria-expanded]') ? option : null;
    }

    function isDropdownExpanded(listbox: Element): boolean {
        return listbox.getAttribute('aria-expanded') === 'true';
    }

    function hasBox(el: Element): boolean {
        const rects = el.getClientRects();
        for (let i = 0; i < rects.length; i++) {
            if (rects[i].width > 0 && rects[i].height > 0) return true;
        }
        return false;
    }

    function optionText(el: Element): string {
        return I.normalizeText((el as HTMLElement).innerText || el.textContent || '');
    }

    function waitFor<T>(fn: () => T | null, timeout = 1000, interval = 40): Promise<T | null> {
        const end = Date.now() + timeout;
        return new Promise<T | null>(resolve => {
            const check = (): void => {
                try {
                    const value = fn();
                    if (value) { resolve(value); return; }
                } catch (e) {}
                if (Date.now() >= end) { resolve(null); return; }
                setTimeout(check, interval);
            };
            check();
        });
    }

    function findOptionByText(options: Element[], normText: string, fuzzy: boolean): Element | null {
        let best: Element | null = null;
        let bestScore = 0;
        for (const opt of options) {
            const normEl = optionText(opt);
            if (!normEl) continue;
            if (normEl === normText) return opt;
            if (!fuzzy) continue;
            const score = I.textSimilarity(normEl, normText);
            if (score > bestScore) { bestScore = score; best = opt; }
        }
        return bestScore > 0.6 ? best : null;
    }

    // Material selects build the opened menu from clones of the closed display
    // options and reshuffle their attributes, so prefer nodes that did not
    // exist before the menu opened.
    function findRenderedOption(root: Element, before: Set<Element>, normText: string): Element | null {
        let best: Element | null = null;
        for (const el of Array.from(root.querySelectorAll('*'))) {
            if (before.has(el)) continue;
            if (el.closest('[aria-hidden="true"]')) continue;
            if (!hasBox(el)) continue;
            if (optionText(el) !== normText) continue;
            // Deepest match: a click on the label bubbles to the option row.
            if (Array.from(el.children).some(child => optionText(child) === normText)) continue;
            best = el;
        }
        return best;
    }

    function findDropdownOption(listbox: Element, text: string, before: Set<Element>): Element | null {
        const normText = I.normalizeText(text);
        if (!normText) return null;
        const rendered = findRenderedOption(listbox, before, normText);
        if (rendered) return rendered;
        const scoped = Array.from(listbox.querySelectorAll('[role="option"]')).filter(hasBox);
        const found = findOptionByText(scoped, normText, true);
        if (found) return found;
        // Some select widgets portal the open menu outside the listbox.
        const global = Array.from(document.querySelectorAll('[role="option"]')).filter(opt => {
            if (!hasBox(opt)) return false;
            const owner = opt.closest('[role="listbox"]');
            return !owner || owner === listbox || owner.getAttribute('aria-expanded') === 'true';
        });
        return findOptionByText(global, normText, false);
    }

    async function openDropdown(listbox: Element): Promise<boolean> {
        const selected = listbox.querySelector('[role="option"][aria-selected="true"]');
        const opener = (selected as HTMLElement | null)
            || (listbox.querySelector('[role="option"]') as HTMLElement | null)
            || (listbox as HTMLElement);
        opener.click();
        return !!(await waitFor(() => isDropdownExpanded(listbox) ? listbox : null, 1200));
    }

    async function selectDropdownOption(el: Element): Promise<boolean> {
        const listbox = el.closest('[role="listbox"]');
        if (!listbox) return false;
        const text = ((el as HTMLElement).innerText || el.textContent || '').trim();
        const normText = I.normalizeText(text);
        if (!normText) return false;

        const selected = listbox.querySelector('[role="option"][aria-selected="true"]');
        if (selected && optionText(selected) === normText) return true;

        let before = new Set<Element>();
        if (!isDropdownExpanded(listbox)) {
            before = new Set(listbox.querySelectorAll('*'));
            if (!await openDropdown(listbox)) return false;
        }

        let option = await waitFor(() => findDropdownOption(listbox, text, before), 1200);
        if (!option) return false;

        const fire = (target: Element): void => {
            for (const type of ['mousedown', 'mouseup', 'click']) {
                target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
            }
        };
        fire(option);

        const isSelected = (): boolean => Array.from(listbox.querySelectorAll('[aria-selected="true"]'))
            .some(opt => optionText(opt) === normText && !opt.closest('[aria-hidden="true"]'));
        if (await waitFor(() => isSelected() ? listbox : null, 800)) return true;

        // Menu may have re-rendered the option; re-query and retry once.
        if (isSelected()) return true;
        if (!isDropdownExpanded(listbox)) {
            before = new Set(listbox.querySelectorAll('*'));
            if (!await openDropdown(listbox)) return false;
        }
        option = await waitFor(() => findDropdownOption(listbox, text, before), 600);
        if (!option) return false;
        fire(option);
        return !!(await waitFor(() => isSelected() ? listbox : null, 600));
    }

    function autoSelectAnswer(answerText: string, force?: boolean): void {
        if (!force && !window.xdAnswers.settings.autoAnswer) return;

        // test-beta is a React app with per-type renderers (order, match,
        // categorize, grids, word games). Its provider owns those interactions
        // so the generic option clicker cannot fire into a half-rendered stage.
        const betaDom = I.providerModules?.naurok?.dom as { applyBetaAnswer?: (text: string) => void } | undefined;
        if (betaDom?.applyBetaAnswer && document.querySelector('#tb-app')) {
            window.xdAnswers._autoSelecting = true;
            window.xdAnswers._oneClickContainer = null;
            window.xdAnswers._answerContainer = null;
            setTimeout(() => {
                betaDom.applyBetaAnswer!(answerText);
                window.setTimeout(() => { window.xdAnswers._autoSelecting = false; }, 8000);
            }, window.xdAnswers.settings.autoAnswerCooldown || 0);
            return;
        }

        const allOptionElements = I.findOptionElements();
        const scopedContainer = window.xdAnswers._oneClickContainer || window.xdAnswers._answerContainer;
        // In oneclick/answer-scoped mode, only select options within the clicked question container
        const optionElements = scopedContainer
            ? allOptionElements.filter(el => scopedContainer.contains(el))
            : allOptionElements;
        const elements = I.matchAnswerToOptions(answerText, optionElements);

        setTimeout(async () => {
            // Flag to prevent oneclick handler from re-triggering on programmatic clicks
            window.xdAnswers._autoSelecting = true;

            if (elements.length > 0) {
                for (const el of elements) {
                    const dropdownOption = closestDropdownOption(el);
                    if (dropdownOption) {
                        try {
                            await selectDropdownOption(dropdownOption);
                        } catch (e) {
                            console.warn('xdAnswers dropdown select failed:', e);
                        }
                        continue;
                    }
                    // Try multiple click target strategies
                    const clickTarget = (el.closest('.question-option, .answer-item, .tb-answer, .v-test-questions-select-block, .v-test-questions-radio-block, .v-test-questions-checkbox-block, .opt, label, [role="radio"], [role="checkbox"], [data-automation-id="choiceItem"]') || el) as HTMLElement;

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

                // Naurok auto-advance: click "Далі" when feedback overlay appears
                if (location.hostname.includes('naurok')) {
                    setTimeout(() => {
                        const nextBtn = document.querySelector<HTMLButtonElement>(
                            '.tb-feedback button.tb-btn-white, .tb-feedback .tb-btn, .tb-feedback button, .tb-board-foot button.tb-btn-go, button.tb-btn-white.tb-btn-lg, .test-multiquiz-save'
                        );
                        if (nextBtn && nextBtn.offsetParent !== null && !nextBtn.disabled) {
                            nextBtn.click();
                        }
                    }, 350);
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
            } else if (answerText && optionElements.length > 0) {
                console.warn('[xdAnswers] auto-select: answer did not match any option:', String(answerText).slice(0, 80));
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
