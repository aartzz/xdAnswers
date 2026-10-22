// src/providers/msforms/dom/options.ts
// Microsoft Forms option extraction and option element marking for the answer matcher.
import type { MsformsQuestionType } from './index';

export function extractOptions(questionItem: HTMLElement, type: MsformsQuestionType): string[] {
    const options: string[] = [];

    switch (type) {
        case 'choice':
        case 'multichoice': {
            const choiceItems = questionItem.querySelectorAll('[data-automation-id="choiceItem"]');
            choiceItems.forEach(item => {
                const textEl = item.querySelector('.text-format-content');
                if (textEl) {
                    const text = (textEl as HTMLElement).innerText.trim();
                    if (text) options.push(text);
                } else {
                    // Fallback: use input value
                    const input = item.querySelector('input[type="radio"], input[type="checkbox"]') as HTMLInputElement | null;
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
                    const text = (label as HTMLElement).innerText.trim();
                    if (text) options.push(text);
                });
            } else {
                // Fallback: use aria-label from inputs
                const radios = questionItem.querySelectorAll('[role="radiogroup"] input[type="radio"]');
                radios.forEach(radio => {
                    const label = radio.getAttribute('aria-label') || (radio as HTMLInputElement).value;
                    if (label) options.push(label);
                });
            }
            break;
        }
        case 'ranking': {
            const optEls = questionItem.querySelectorAll('[role="option"]');
            optEls.forEach(el => {
                const content = el.querySelector('.text-format-content') as HTMLElement | null;
                const text = content?.innerText.trim() || (el as HTMLElement).innerText.trim();
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
                    .map(th => (th as HTMLElement).innerText.trim())
                    .filter(Boolean)
                : [];
            // Row headers: first <th> in each subsequent row
            const dataRows = table.querySelectorAll('tr');
            for (let i = 1; i < dataRows.length; i++) {
                const rowHeader = dataRows[i].querySelector('th');
                if (rowHeader) {
                    const rowText = (rowHeader as HTMLElement).innerText.trim();
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

// ── Mark option elements with data-xd-option for the answer matcher ──

export function markOptionElements(questionItem: HTMLElement, type: MsformsQuestionType): void {
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
                let textEl = radio.querySelector('.xd-synthetic-option') as HTMLElement | null;
                if (!textEl) {
                    textEl = document.createElement('span');
                    textEl.className = 'xd-synthetic-option';
                    textEl.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
                    const label = radio.getAttribute('aria-label') || '';
                    textEl.textContent = label;
                    (radio as HTMLElement).style.position = 'relative';
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
                    const parent = (radio.closest('[data-automation-id="npsCell"]') || radio.parentElement) as HTMLElement;
                    let textEl = parent.querySelector('.xd-synthetic-option') as HTMLElement | null;
                    if (!textEl) {
                        textEl = document.createElement('span');
                        textEl.className = 'xd-synthetic-option';
                        textEl.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
                        const label = radio.getAttribute('aria-label') || (radio as HTMLInputElement).value;
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
