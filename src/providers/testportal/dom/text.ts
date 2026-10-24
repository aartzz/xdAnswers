// src/providers/testportal/dom/text.ts
// TestPortal text helper: normalized inner text of an element.
export function getText(el: Element | null): string {
    return ((el as HTMLElement | null)?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
}
