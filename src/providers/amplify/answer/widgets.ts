// src/providers/amplify/answer/widgets.ts
// Applies answers to ordered lists, sliders and the student survey.

import type { AmplifyQuestionState } from '../dom/types';
import { dispatchKey, findBestByText, sequenceValues, stripAnswer, wait } from './helpers';

async function moveReorderItem(item: HTMLElement, direction: 'up' | 'down', steps: number): Promise<void> {
    if (!item.isConnected || steps <= 0) return;
    item.focus();
    dispatchKey(item, 'Enter', 'Enter');
    await wait(120);
    for (let i = 0; i < steps; i++) {
        dispatchKey(item, direction === 'up' ? 'ArrowUp' : 'ArrowDown', direction === 'up' ? 'ArrowUp' : 'ArrowDown');
        await wait(90);
    }
    dispatchKey(item, 'Enter', 'Enter');
    await wait(120);
}

export async function applyReorder(answerText: string, state: AmplifyQuestionState): Promise<boolean> {
    const desired = sequenceValues(answerText);
    if (desired.length < 2) return false;

    const targetItems: HTMLElement[] = [];
    for (const value of desired) {
        const item = findBestByText(value, state.reorderItems, el => {
            const content = el.querySelector('.item-content');
            return (content as HTMLElement | null)?.innerText || el.getAttribute('aria-label') || '';
        });
        if (item) targetItems.push(item);
    }
    if (targetItems.length < 2) return false;

    // Move the requested items into place one at a time using the widget's
    // keyboard reorder mode (Enter toggles dragging, arrows move the item).
    for (let targetIndex = 0; targetIndex < targetItems.length; targetIndex++) {
        const item = targetItems[targetIndex];
        if (!item.isConnected) continue;
        const screen = document.querySelector<HTMLElement>('.dcg-student-screen.current-screen') || document;
        const items = Array.from(screen.querySelectorAll<HTMLElement>('[data-component-type="reorder"] .dcg-reorder-item-view'));
        const currentIndex = items.indexOf(item);
        if (currentIndex < 0 || currentIndex === targetIndex) continue;
        await moveReorderItem(item, currentIndex > targetIndex ? 'up' : 'down', Math.abs(currentIndex - targetIndex));
    }
    return true;
}

function keyboardSetSlider(thumb: HTMLElement, value: number): boolean {
    if (!thumb.isConnected) return false;
    const min = Number(thumb.getAttribute('aria-valuemin') || 0);
    const max = Number(thumb.getAttribute('aria-valuemax') || 100);
    const step = Number(thumb.getAttribute('data-keyboard-step') || 1) || 1;
    if (!Number.isFinite(value)) return false;

    const clamped = Math.min(max, Math.max(min, value));
    const steps = Math.round((clamped - min) / step);
    const reverseSteps = Math.round((max - clamped) / step);
    thumb.focus();
    if (steps <= reverseSteps) {
        dispatchKey(thumb, 'Home', 'Home');
        for (let i = 0; i < steps; i++) {
            dispatchKey(thumb, 'ArrowUp', 'ArrowUp');
        }
    } else {
        dispatchKey(thumb, 'End', 'End');
        for (let i = 0; i < reverseSteps; i++) {
            dispatchKey(thumb, 'ArrowDown', 'ArrowDown');
        }
    }
    return true;
}

export function applySlider(answerText: string, state: AmplifyQuestionState): boolean {
    if (!state.sliderThumb) return false;
    const match = stripAnswer(answerText).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    if (!match) return false;
    return keyboardSetSlider(state.sliderThumb, Number(match[0]));
}

export function applySurvey(answerText: string, state: AmplifyQuestionState): boolean {
    const choices = Array.from(state.container?.querySelectorAll<HTMLElement>('.student-survey-choice') || []);
    if (!choices.length) return false;
    const target = findBestByText(answerText, choices, choice => choice.getAttribute('aria-label') || choice.innerText || '');
    if (!target) return false;
    target.click();
    return true;
}
