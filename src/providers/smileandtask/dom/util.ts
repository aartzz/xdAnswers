// src/providers/smileandtask/dom/util.ts
// Small text, URL, DOM and image-loading helpers for S&T School.

const API_BASE = 'https://api.smileandtask.com';
const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF\u2060]/g;

export const HOLD_PLACEHOLDER = /^Натисни й утримуй/i;
export const IMAGE_PLACEHOLDER = '[зображення]';

export function cleanText(value: string | null | undefined): string {
    return String(value || '')
        .replace(ZERO_WIDTH, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function imageLabel(index?: number): string {
    return typeof index === 'number' ? `[зображення ${index + 1}]` : IMAGE_PLACEHOLDER;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function absoluteUrl(src: string): string {
    const trimmed = src.trim();
    if (trimmed.startsWith('/api/')) return `${API_BASE}${trimmed}`;
    try {
        return new URL(trimmed, location.href).href;
    } catch (e) {
        return trimmed;
    }
}

export function cellImage(scope: Element | null): string | null {
    const img = scope?.querySelector<HTMLImageElement>('img[src]');
    const src = img?.getAttribute('src') || '';
    if (!src || src.startsWith('data:')) return null;
    return absoluteUrl(src);
}

export function isDisabled(el: Element): boolean {
    return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-disabled');
}

function retryImageUrl(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.pathname = parsed.pathname.replace(/-thumb(\.[^./]+)$/, '$1');
        return parsed.href;
    } catch (e) {
        return url;
    }
}

export async function loadImages(urls: string[]): Promise<string[]> {
    const images = await Promise.all(urls.map(async url => {
        const full = retryImageUrl(url);
        const first = await window.xdAnswers.imageToBase64(full);
        if (first) return first;
        if (full !== url) return window.xdAnswers.imageToBase64(url);
        return null;
    }));
    return images.filter((image): image is string => image !== null);
}
