// src/providers/amplify/answer/choice.ts
// Applies answers to Desmos multiple-choice components.

import type { AmplifyQuestionState } from '../dom/types';
import { cleanText } from '../dom/util';
import { clickChoiceElement, stripAnswer, submitComponent } from './helpers';

function parseLetters(answerText: string, optionElements: HTMLElement[]): HTMLElement[] {
    const text = cleanText(stripAnswer(answerText));
    if (!/^[a-zа-яіїєґ](?:\s*[,;\/]\s*[a-zа-яіїєґ])*$/iu.test(text)) return [];
    const letters = text.split(/[,;\/]/).map(part => part.trim()).filter(Boolean);
    const matched: HTMLElement[] = [];
    for (const letter of letters) {
        const index = letter.toUpperCase().charCodeAt(0) - 65;
        if (index >= 0 && index < optionElements.length) matched.push(optionElements[index]);
    }
    return matched;
}

function matchChoice(answerText: string, state: AmplifyQuestionState): HTMLElement[] {
    const elements = state.optionElements.filter(el => el.isConnected);
    if (!elements.length) return [];

    const internal = window.xdAnswers._internal;
    let matched = internal.matchAnswerToOptions(stripAnswer(answerText), elements)
        .filter((el): el is HTMLElement => el instanceof HTMLElement);
    if (matched.length) return state.isMultiple ? matched : matched.slice(0, 1);

    matched = parseLetters(answerText, elements);
    if (matched.length) return state.isMultiple ? matched : matched.slice(0, 1);

    const letterList = cleanText(stripAnswer(answerText)).match(/^([a-zа-яіїєґ](?:\s*,\s*)+)+$/iu);
    if (letterList) {
        matched = parseLetters(letterList[0].replace(/\s+/g, ''), elements);
        if (matched.length) return matched;
    }

    return [];
}

export function applyChoice(answerText: string, state: AmplifyQuestionState): boolean {
    const matched = matchChoice(answerText, state);
    if (!matched.length) return false;

    if (state.isMultiple) {
        for (const option of state.optionElements) {
            if (matched.includes(option) || !option.isConnected) continue;
            const input = option.matches('input')
                ? option as HTMLInputElement
                : option.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (input?.checked) input.click();
        }
    }

    for (const option of matched) {
        option.style.setProperty('outline', '3px solid #22c55e', 'important');
        option.style.setProperty('border-radius', '6px', 'important');
        clickChoiceElement(option);
    }

    const first = matched[0];
    if (first) submitComponent(first);
    return true;
}
