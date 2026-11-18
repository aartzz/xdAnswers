// src/providers/smileandtask/dom/reveal.ts
// Hold-to-reveal option support: reads hidden options from sessionStorage ("jt_test")
// when available, or replays the hold gesture on each lock button and caches the result.

import { inlineValue, storedText } from './math';
import { readStoredTask, resolveStoredImage } from './storage';
import type { StOption, StQuestionState } from './types';
import { cellImage, HOLD_PLACEHOLDER, imageLabel, isDisabled, sleep } from './util';

const revealCache = new Map<string, Array<{ text: string; image: string | null }>>();

function revealKey(number: number, text: string, count: number): string {
    return `${number}|${count}|${text}`;
}

export function populateHiddenOptions(number: number, text: string, options: StOption[]): void {
    if (!options.length || !options.some(option => option.lock && !option.text)) return;

    const stored = readStoredTask()?.questions?.[number - 1];
    const storedOpts = stored?.type === 'true_false' ? ['Так', 'Ні'] : stored?.options;
    if (Array.isArray(storedOpts) && storedOpts.length === options.length) {
        options.forEach((option, index) => {
            if (option.text) return;
            const image = option.image || resolveStoredImage(stored?.optionImages?.[index] || null);
            const optText = storedText(storedOpts[index]) || (image ? imageLabel(index) : '');
            option.image = image;
            option.text = optText;
        });
    }

    const cached = revealCache.get(revealKey(number, text, options.length));
    if (cached) {
        options.forEach((option, index) => {
            if (!option.text && cached[index]) {
                option.text = cached[index].text;
                option.image = option.image || cached[index].image;
            }
        });
    }
}

/**
 * Press and hold each lock button in turn (the way a student reveals an option),
 * read the text and release again. Resolves once every option has been tried.
 */
export async function revealOptions(state: StQuestionState): Promise<void> {
    const results: Array<{ text: string; image: string | null }> = [];
    for (const option of state.options) {
        let text = option.text;
        let image = option.image;
        if (!text && option.lock && !isDisabled(option.lock)) {
            option.lock.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
            for (let attempt = 0; attempt < 12 && !text; attempt++) {
                await sleep(60);
                const raw = inlineValue(option.label);
                if (raw && !HOLD_PLACEHOLDER.test(raw)) text = raw;
                image = image || cellImage(option.label);
                if (!text && image && attempt >= 3) text = imageLabel(option.index);
            }
            option.lock.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
            await sleep(30);
        }
        option.text = text;
        option.image = image;
        results.push({ text, image });
    }
    revealCache.set(revealKey(state.number, state.text, state.options.length), results);
    state.needsReveal = false;
    state.imageUrls = Array.from(new Set([
        ...state.imageUrls,
        ...results.map(result => result.image).filter((url): url is string => !!url)
    ]));
}
