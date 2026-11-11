// src/providers/amplify/dom/math-text.ts
// Converts Desmos rich text to plain readable text while preserving MathQuill
// formulas, inline fields and hot-text markers.

import { cleanText } from './util';
import type { AmplifyHotText, AmplifyInlineField } from './types';

function childText(el: Element | null | undefined): string {
    if (!el) return '';
    let result = '';
    el.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            result += node.textContent || '';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            result += mathNodeText(node as Element);
        }
    });
    return result;
}

// MathQuill renders fractions, powers, roots and subscripts as nested spans.
// `innerText` flattens "1/2" into "12", so rebuild a readable LaTeX-ish form.
export function mathNodeText(el: Element): string {
    if (!el) return '';
    const classes = el.classList;
    if (classes.contains('dcg-mq-bg') || classes.contains('dcg-mq-cursor')) return '';
    if (classes.contains('dcg-mq-sqrt-prefix')) return '';
    if (classes.contains('dcg-mq-fraction')) {
        const children = Array.from(el.children);
        const numerator = children.length > 0 ? mathNodeText(children[0]) : '';
        const denominator = children.length > 1 ? mathNodeText(children[children.length - 1]) : '';
        return `\\frac{${numerator}}{${denominator}}`;
    }
    if (classes.contains('dcg-mq-sqrt-stem')) {
        return `\\sqrt{${childText(el)}}`;
    }
    if (classes.contains('dcg-mq-sup')) return `^{${childText(el)}}`;
    if (classes.contains('dcg-mq-sub')) return `_{${childText(el)}}`;
    return childText(el);
}

export function textWithMarkers(
    original: Element,
    inlineFields: AmplifyInlineField[],
    hotTexts: AmplifyHotText[]
): string {
    if (!original) return '';
    const clone = original.cloneNode(true) as HTMLElement;
    const originalInline = Array.from(original.querySelectorAll<HTMLElement>('.inline-math, .inline-text, .inline-dropdown'));
    const originalHotText = Array.from(original.querySelectorAll<HTMLElement>('.hot-text'));
    const clonedInline = Array.from(clone.querySelectorAll<HTMLElement>('.inline-math, .inline-text, .inline-dropdown'));
    const clonedHotText = Array.from(clone.querySelectorAll<HTMLElement>('.hot-text'));
    const clonedMath = Array.from(clone.querySelectorAll<HTMLElement>('.dcg-mq-math-mode'));

    clonedInline.forEach((node, index) => {
        const originalNode = originalInline[index];
        const field = inlineFields.find(item => item.element === originalNode);
        if (!field) return;
        const marker = field.kind === 'dropdown' && field.options.length
            ? `[[${field.id}: ${field.options.join(' | ')}]]`
            : `[[${field.id}]]`;
        node.replaceWith(document.createTextNode(marker));
    });
    clonedHotText.forEach((node, index) => {
        const originalNode = originalHotText[index];
        const hot = hotTexts.find(item => item.element === originalNode);
        if (!hot) return;
        node.replaceWith(document.createTextNode(`[[${hot.id}:${hot.text}]]`));
    });
    clonedMath.forEach((node, index) => {
        const originalMath = original.querySelectorAll<HTMLElement>('.dcg-mq-math-mode')[index];
        if (!originalMath) return;
        node.replaceWith(document.createTextNode(`$${mathNodeText(originalMath)}$`));
    });
    clone.querySelectorAll<HTMLImageElement>('img').forEach(img => {
        const alt = cleanText(img.getAttribute('alt'));
        img.replaceWith(document.createTextNode(alt ? `[зображення: ${alt}]` : '[зображення]'));
    });
    clone.querySelectorAll('.dcg-mq-bg, script, style, .sr-only, [aria-hidden="true"]').forEach(node => node.remove());
    return cleanText(clone.innerText || clone.textContent || '');
}
