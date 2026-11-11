// src/providers/amplify/dom/util.ts
// Small text helpers shared by the Amplify DOM extractors.

const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF\u2060]/g;

export function cleanText(value: string | null | undefined): string {
    return String(value || '')
        .replace(ZERO_WIDTH, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function absoluteUrl(src: string): string {
    try {
        return new URL(src, location.href).href;
    } catch (e) {
        return src;
    }
}

export function addUnique(parts: string[], value: string): void {
    const text = cleanText(value);
    if (!text) return;
    if (parts.some(part => part === text)) return;
    parts.push(text);
}
