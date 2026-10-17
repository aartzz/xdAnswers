// src/providers/msforms/dom.ts
// Microsoft Forms DOM extraction: question type detection, option extraction,
// option marking for the answer matcher, and page state hashing.

export type MsformsQuestionType =
    | 'choice'
    | 'multichoice'
    | 'rating'
    | 'nps'
    | 'likert'
    | 'ranking'
    | 'text'
    | 'textarea'
    | 'date'
    | 'unknown';

export interface MsformsQuestionData {
    type: MsformsQuestionType;
    questionItem: HTMLElement;
    text: string;
    optionsText?: string;
    base64ImageSources: string[];
    questionType: string;
    isMulti: boolean;
    isMultiQuiz: boolean;
}

export interface MsformsDomApi {
    getQuestionType(questionItem: HTMLElement): MsformsQuestionType;
    extractOptions(questionItem: HTMLElement, type: MsformsQuestionType): string[];
    markOptionElements(questionItem: HTMLElement, type: MsformsQuestionType): void;
    extractQuestionData(questionItem: HTMLElement): MsformsQuestionData | null;
    buildStateHash(): string;
    norm(t: string): string;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    function norm(t: string): string { return t.toLowerCase().replace(/\s+/g, ' ').trim(); }

    function getQuestionType(questionItem: HTMLElement): MsformsQuestionType {
        const typeInfoEl = questionItem.querySelector('[id^="QuestionInfo_"]');
        const typeInfo = typeInfoEl ? typeInfoEl.textContent!.trim().toLowerCase() : '';

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

    function extractOptions(questionItem: HTMLElement, type: MsformsQuestionType): string[] {
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

    function markOptionElements(questionItem: HTMLElement, type: MsformsQuestionType): void {
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

    function extractQuestionData(questionItem: HTMLElement): MsformsQuestionData | null {
        const type = getQuestionType(questionItem);

        // Title text
        const titleEl = questionItem.querySelector('[data-automation-id="questionTitle"] .text-format-content')
            || questionItem.querySelector('[data-automation-id="questionTitle"]');
        const questionText = titleEl ? (titleEl as HTMLElement).innerText.trim() : '';

        if (!questionText) return null;

        // Images
        const imageUrls: string[] = [];
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
        let optionsText: string | undefined = options.join('\n') || undefined;
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

    function buildStateHash(): string {
        const questionItems = document.querySelectorAll('[data-automation-id="questionItem"]');
        return Array.from(questionItems).map(qi => {
            const title = qi.querySelector('[data-automation-id="questionTitle"]');
            return title ? (title as HTMLElement).innerText.trim() : '';
        }).join('|||');
    }

    window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {};
    window.xdAnswers._internal.providerModules.msforms = window.xdAnswers._internal.providerModules.msforms || {};
    window.xdAnswers._internal.providerModules.msforms.dom = {
        getQuestionType,
        extractOptions,
        markOptionElements,
        extractQuestionData,
        buildStateHash,
        norm
    } as MsformsDomApi;
})();
