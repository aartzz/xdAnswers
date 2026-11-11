// src/providers/amplify/dom/question-text.ts
// Builds the question prompt from title, notes, prompts, tables and labels.

import { addUnique } from './util';
import { textWithMarkers } from './math-text';
import type { AmplifyHotText, AmplifyInlineField, AmplifyQuestionKind } from './types';

export function collectQuestionText(
    screen: HTMLElement,
    kind: AmplifyQuestionKind,
    inlineFields: AmplifyInlineField[],
    hotTexts: AmplifyHotText[]
): string {
    const parts: string[] = [];
    addUnique(parts, textWithMarkers(screen.querySelector('.cls-step-title') as Element, inlineFields, hotTexts));

    screen.querySelectorAll<HTMLElement>('[data-component-type="exhibit/text"]').forEach(component => {
        addUnique(parts, textWithMarkers(component, inlineFields, hotTexts));
    });

    screen.querySelectorAll<HTMLElement>('[data-component-type="multiple-choice"] .dcg-instruction-prompt').forEach(prompt => {
        addUnique(parts, textWithMarkers(prompt, inlineFields, hotTexts));
    });

    if (kind === 'table') {
        screen.querySelectorAll<HTMLElement>('[data-component-type="table"] .dcg-table-playground-view').forEach(table => {
            addUnique(parts, textWithMarkers(table, inlineFields, hotTexts));
        });
    }

    if (kind === 'cardsort') {
        screen.querySelectorAll<HTMLElement>('[data-component-type="cardsort"] .cardsort-offscreen-instructions').forEach(instructions => {
            addUnique(parts, textWithMarkers(instructions, inlineFields, hotTexts));
        });
    }

    if (kind === 'reorder') {
        screen.querySelectorAll<HTMLElement>('[data-component-type="reorder"] .reorder-offscreen-instructions, [data-component-type="reorder"] .dcg-reorder-label').forEach(label => {
            addUnique(parts, textWithMarkers(label, inlineFields, hotTexts));
        });
    }

    if (kind === 'slider') {
        screen.querySelectorAll<HTMLElement>('[data-component-type="slider"]').forEach(slider => {
            addUnique(parts, slider.getAttribute('aria-label') || '');
            addUnique(parts, textWithMarkers(slider, inlineFields, hotTexts));
        });
    }

    if (kind === 'survey') {
        screen.querySelectorAll<HTMLElement>('[data-component-type="student-survey"]').forEach(survey => {
            addUnique(parts, textWithMarkers(survey, inlineFields, hotTexts));
        });
    }

    if (kind === 'graph' || kind === 'sketch' || kind === 'other') {
        screen.querySelectorAll<HTMLElement>('[data-component-type]').forEach(component => {
            const type = component.getAttribute('data-component-type') || '';
            if ([
                'exhibit/text', 'multiple-choice', 'input/text', 'input/expression',
                'table', 'cardsort', 'reorder', 'slider', 'student-survey'
            ].includes(type)) return;
            addUnique(parts, textWithMarkers(component, inlineFields, hotTexts));
        });
    }

    if (!parts.length) {
        const alt = Array.from(screen.querySelectorAll<HTMLImageElement>('img[alt]'))
            .map(img => (img.getAttribute('alt') || '').trim())
            .filter(Boolean)
            .join(' ');
        if (alt) addUnique(parts, alt);
    }

    return parts.join('\n\n');
}
