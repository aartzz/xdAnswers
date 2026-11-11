// src/providers/amplify/dom/inline.ts
// Reads inline math, inline text, inline dropdown and hot-text nodes.

import { cleanText } from './util';
import type { AmplifyHotText, AmplifyInlineField, AmplifyInlineKind } from './types';

export function collectInlineFields(screen: HTMLElement): AmplifyInlineField[] {
    const nodes = Array.from(screen.querySelectorAll<HTMLElement>('.inline-math, .inline-text, .inline-dropdown'));
    return nodes.map((element, index) => {
        let kind: AmplifyInlineKind = 'text';
        if (element.classList.contains('inline-math')) kind = 'math';
        else if (element.classList.contains('inline-dropdown')) kind = 'dropdown';

        const options: string[] = [];
        if (kind === 'dropdown') {
            const raw = element.getAttribute('data-config');
            if (raw) {
                try {
                    const config = JSON.parse(raw) as {
                        choiceIds?: string[];
                        choices?: Record<string, { text?: string }>;
                    };
                    const ids = config.choiceIds || [];
                    for (const id of ids) {
                        const choice = config.choices?.[id];
                        if (choice?.text) options.push(cleanText(choice.text));
                    }
                } catch (e) { /* ignore malformed config */ }
            }
            if (!options.length) {
                element.querySelectorAll<HTMLElement>('.dropdown-choice, [role="option"]').forEach(option => {
                    const text = cleanText(option.innerText || option.textContent || '');
                    if (text) options.push(text);
                });
            }
        }

        return { id: `A${index}`, kind, element, options };
    });
}

export function collectHotTexts(screen: HTMLElement): AmplifyHotText[] {
    return Array.from(screen.querySelectorAll<HTMLElement>('.hot-text')).map((element, index) => ({
        id: `H${index}`,
        element,
        text: cleanText(element.innerText || element.textContent || '')
    }));
}
