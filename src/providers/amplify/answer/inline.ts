// src/providers/amplify/answer/inline.ts
// Applies answers to inline text, inline math, inline dropdown and hot text.

import type { AmplifyInlineField, AmplifyQuestionState } from '../dom/types';
import {
    findBestByText,
    normalized,
    parseKeyValues,
    sequenceValues,
    setMathField,
    setProseMirror,
    submitComponent,
    wait
} from './helpers';

async function chooseDropdownOption(field: AmplifyInlineField, value: string): Promise<boolean> {
    const anchor = field.element.querySelector<HTMLElement>('.select-dropdown-anchor');
    if (!anchor) return false;
    anchor.click();
    await wait(180);

    const options = Array.from(document.querySelectorAll<HTMLElement>(
        '[role="option"], .dropdown-option-container .dropdown-choice, .dropdown-choice-btn, .dropdown-choice'
    )).filter(option => {
        if (!option.isConnected || option.closest('[aria-hidden="true"]')) return false;
        return option.getClientRects().length > 0;
    });
    const target = findBestByText(value, options, option => option.innerText || option.textContent || '');
    if (!target) return false;
    target.click();
    await wait(120);
    return true;
}

export async function applyInline(answerText: string, state: AmplifyQuestionState): Promise<boolean> {
    const keyed = parseKeyValues(answerText);
    const sequential = sequenceValues(answerText);
    let applied = false;

    for (let index = 0; index < state.inlineFields.length; index++) {
        const field = state.inlineFields[index];
        if (!field.element.isConnected) continue;
        const value = keyed.get(field.id.toUpperCase()) || sequential[index];
        if (!value) continue;

        if (field.kind === 'dropdown') {
            if (await chooseDropdownOption(field, value)) applied = true;
        } else if (field.kind === 'math') {
            const math = field.element.querySelector<HTMLElement>('.dcg-mq-editable-field, .dcg-expression-input');
            if (math && setMathField(math, value)) applied = true;
        } else {
            const text = field.element.querySelector<HTMLElement>('.ProseMirror[contenteditable="true"], [contenteditable="true"]');
            if (text && setProseMirror(text, value)) applied = true;
        }
        await wait(80);
    }

    // Hot text has no value input: the answer is the exact text to select.
    for (const hot of state.hotTexts) {
        const keyValue = keyed.get(hot.id.toUpperCase());
        const target = keyValue || (sequential.some(value => normalized(value) === normalized(hot.text)) ? hot.text : '');
        if (target && !hot.element.classList.contains('selected')) {
            hot.element.click();
            applied = true;
        }
    }

    if (applied) {
        const component = state.inlineFields[0]?.element.closest<HTMLElement>('[data-component-type]')
            || state.hotTexts[0]?.element.closest<HTMLElement>('[data-component-type]')
            || state.container;
        if (component) submitComponent(component);
    }
    return applied;
}
