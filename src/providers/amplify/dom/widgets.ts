// src/providers/amplify/dom/widgets.ts
// Readers for the non-question widgets that can still be answered: cardsort,
// ordered list, slider and the student survey.

import { cleanText } from './util';

export function collectCardOptions(screen: HTMLElement): string[] {
    return Array.from(screen.querySelectorAll<HTMLElement>('[data-component-type="cardsort"] .card-wrapper'))
        .map(card => cleanText(card.getAttribute('aria-label') || card.innerText || ''))
        .filter(Boolean);
}

export function collectReorderItems(screen: HTMLElement): HTMLElement[] {
    return Array.from(screen.querySelectorAll<HTMLElement>('[data-component-type="reorder"] .dcg-reorder-item-view'));
}

export function collectSliderThumb(screen: HTMLElement): HTMLElement | null {
    return screen.querySelector<HTMLElement>('[data-component-type="slider"] .thumb[role="slider"]');
}

export function hasSurveyChoices(screen: HTMLElement): boolean {
    return !!screen.querySelector('[data-component-type="student-survey"] .student-survey-choice');
}
