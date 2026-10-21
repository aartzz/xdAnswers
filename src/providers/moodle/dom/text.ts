// src/providers/moodle/dom/text.ts
// Moodle text helper: normalized inner text of an element.
export function getText(el: Element | null): string {
    return ((el as HTMLElement | null)?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
}
