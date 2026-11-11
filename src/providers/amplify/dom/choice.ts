// src/providers/amplify/dom/choice.ts
// Reads Desmos multiple-choice choices from list, button, segment and grid layouts.

import { cleanText } from './util';

function optionContainerFor(input: HTMLInputElement): HTMLElement | null {
    return input.closest<HTMLElement>('.dcg-multiple-choice')
        || input.closest<HTMLElement>('.buttons-wrapper')
        || input.closest<HTMLElement>('.segment-wrapper')
        || input.closest<HTMLElement>('.mc-tile')
        || input.closest<HTMLElement>('label')
        || input.parentElement;
}

export function collectChoice(screen: HTMLElement): {
    options: string[];
    elements: HTMLElement[];
    isMultiple: boolean;
} {
    const components = Array.from(screen.querySelectorAll<HTMLElement>('[data-component-type="multiple-choice"]'));
    if (!components.length) return { options: [], elements: [], isMultiple: false };

    const component = components[0];
    const inputs = Array.from(component.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]'));
    const elements: HTMLElement[] = [];
    const options: string[] = [];
    let isMultiple = false;

    if (inputs.length) {
        for (const input of inputs) {
            const container = optionContainerFor(input);
            if (!container || elements.includes(container)) continue;
            elements.push(container);
            container.setAttribute('data-xd-option', 'true');

            const label = cleanText(input.getAttribute('aria-label') || input.value || container.innerText || '');
            const image = container.querySelector<HTMLImageElement>('img[src]');
            options.push(label || (image ? '[зображення]' : ''));
            if (input.type === 'checkbox') isMultiple = true;
        }
    } else {
        // Button/grid layouts can render a plain button with no hidden input.
        const candidates = Array.from(component.querySelectorAll<HTMLElement>('.dcg-multiple-choice, .mc-tile'))
            .filter(el => !el.querySelector('.dcg-multiple-choice, .mc-tile'));
        for (const container of candidates) {
            if (elements.includes(container)) continue;
            elements.push(container);
            container.setAttribute('data-xd-option', 'true');
            const image = container.querySelector<HTMLImageElement>('img[src]');
            options.push(cleanText(container.innerText || '') || (image ? '[зображення]' : ''));
        }
        isMultiple = !!component.querySelector('.is-checkbox, [aria-checked="true"]');
    }

    if (!isMultiple) {
        isMultiple = !!component.querySelector('.dcg-multiple-choice.is-checkbox, input[type="checkbox"]');
    }

    return { options, elements, isMultiple };
}
