// src/providers/amplify/dom/media.ts
// Collects image URLs and graph/sketch canvases from the active screen.

import { absoluteUrl, cleanText } from './util';

export function collectImages(screen: HTMLElement): string[] {
    const urls: string[] = [];
    const add = (src: string | null | undefined): void => {
        const value = cleanText(src || '');
        if (!value || value.startsWith('data:')) return;
        const absolute = absoluteUrl(value);
        if (urls.includes(absolute)) return;
        urls.push(absolute);
    };

    screen.querySelectorAll<HTMLImageElement>('img[src]').forEach(img => {
        if (img.closest('.dcg-mq-bg, .dcg-keypad, .dcg-tooltip-hit-area-container, .student-account-menu, .student-activity-header')) return;
        const width = img.naturalWidth || 0;
        const height = img.naturalHeight || 0;
        if (width > 0 && height > 0 && width < 32 && height < 32) return;
        add(img.getAttribute('src'));
    });

    screen.querySelectorAll<HTMLElement>('[style*="background-image"]').forEach(el => {
        const match = /url\((["']?)(.*?)\1\)/.exec(el.style.backgroundImage || '');
        if (match && match[2]) add(match[2]);
    });

    return urls;
}

export function collectCanvasElements(screen: HTMLElement): HTMLCanvasElement[] {
    return Array.from(screen.querySelectorAll<HTMLCanvasElement>(
        '[data-component-type="graph"] canvas, [data-component-type="input/graph"] canvas, [data-component-type="sketch"] canvas, [data-component-type="geometry"] canvas, [data-component-type="marbleslides"] canvas, [data-component-type="transform"] canvas'
    )).filter(canvas => canvas.width >= 40 && canvas.height >= 40);
}
