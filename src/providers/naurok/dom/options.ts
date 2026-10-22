// src/providers/naurok/dom/options.ts
// Naurok answer option extraction: text options and background-image options.

const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function extractBackgroundUrl(el: Element | null): string {
    if (!el) return '';
    const bgStyle = (el as HTMLElement).style.backgroundImage || '';
    const match = bgStyle.match(/url\(["']?([^"')]+)["']?\)/);
    return match ? match[1] : '';
}

// Text options and background-image-only options live in .question-option-inner;
// .question-option-inner-content is the fallback for older markup.
export function extractOptionData(): { optionsArr: string[]; optionImageUrls: string[] } {
    let optionInners = document.querySelectorAll('.question-option-inner, .test-option');
    const optionsArr: string[] = [];
    const optionImageUrls: string[] = [];

    optionInners.forEach((inner, idx) => {
        const textEl = inner.querySelector('.question-option-inner-content, .test-content-text, .text');
        const text = textEl ? (textEl as HTMLElement).innerText.trim() : (inner as HTMLElement).innerText.trim();
        const bgUrl = extractBackgroundUrl(inner.querySelector('.question-option-image, .test-content-image'));
        const label = OPTION_LABELS[idx] || (idx + 1);
        if (text) {
            optionsArr.push(label + ': ' + text);
        } else if (bgUrl) {
            optionsArr.push(label + ': [зображення]');
            optionImageUrls.push(bgUrl);
        }
    });

    if (optionsArr.length === 0) {
        const fallbackEls = document.querySelectorAll('.question-option-inner-content, .test-content-text-inner');
        fallbackEls.forEach((el, idx) => {
            const t = (el as HTMLElement).innerText.trim();
            if (t) optionsArr.push((OPTION_LABELS[idx] || (idx + 1)) + ': ' + t);
        });
    }

    return { optionsArr, optionImageUrls };
}
