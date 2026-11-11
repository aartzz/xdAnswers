// src/providers/amplify/answer/inputs.ts
// Applies answers to free-response, math-response and table cells.

import type { AmplifyQuestionState } from '../dom/types';
import { sequenceValues, setMathField, setProseMirror, stripAnswer, submitComponent } from './helpers';

export function applyText(answerText: string, state: AmplifyQuestionState): boolean {
    const value = stripAnswer(answerText);
    if (!value) return false;

    const inputs = state.textInputs.filter(el => el.isConnected);
    if (!inputs.length) return false;

    if (inputs.length === 1) {
        const ok = setProseMirror(inputs[0], value);
        if (ok) submitComponent(inputs[0]);
        return ok;
    }

    const parts = sequenceValues(answerText);
    let applied = false;
    inputs.forEach((input, index) => {
        const part = parts[index] || (index === 0 ? value : '');
        if (part && setProseMirror(input, part)) applied = true;
    });
    if (applied) submitComponent(inputs[0]);
    return applied;
}

export function applyMath(answerText: string, state: AmplifyQuestionState): boolean {
    const fields = state.mathInputs.filter(el => el.isConnected);
    if (!fields.length) return false;

    const values = sequenceValues(answerText);
    let applied = false;
    fields.forEach((field, index) => {
        const value = values[index] || (index === 0 ? stripAnswer(answerText) : '');
        if (value && setMathField(field, value)) applied = true;
    });
    if (applied) submitComponent(fields[0]);
    return applied;
}

export function applyTable(answerText: string, state: AmplifyQuestionState): boolean {
    const cells = state.tableCells.filter(cell => cell.isConnected);
    if (!cells.length) return false;
    const values = sequenceValues(answerText);
    if (!values.length) return false;

    let applied = false;
    cells.forEach((cell, index) => {
        const value = values[index];
        if (!value) return;
        const math = cell.querySelector<HTMLElement>('.dcg-mq-editable-field');
        const text = cell.querySelector<HTMLElement>('.ProseMirror[contenteditable="true"], [contenteditable="true"]');
        if (math && setMathField(math, value)) applied = true;
        else if (text && setProseMirror(text, value)) applied = true;
    });
    if (applied) submitComponent(cells[0]);
    return applied;
}
