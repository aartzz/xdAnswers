// src/providers/smileandtask/dom/live.ts
// Live mode reader (_Component27: "Запитання №N" + 2..4 A/B/C/D buttons)
// backed by the normalized task in sessionStorage ("jt_test").

import { storedText } from './math';
import { readStoredTask, resolveStoredImage } from './storage';
import type { StOption, StQuestionState } from './types';
import { cleanText, imageLabel, isDisabled } from './util';

export function readLiveQuestion(): StQuestionState | null {
    const headings = Array.from(document.querySelectorAll<HTMLElement>('p.text-lg.font-semibold'));
    let heading: HTMLElement | null = null;
    let number = 0;
    for (const candidate of headings) {
        const match = /^Запитання\s*№\s*(\d+)/.exec(cleanText(candidate.textContent));
        if (match) {
            heading = candidate;
            number = Number(match[1]);
            break;
        }
    }
    if (!heading || !number) return null;

    const container = heading.parentElement?.parentElement as HTMLElement | null;
    if (!container) return null;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('div.grid button'));
    if (!buttons.length) return null;

    const task = readStoredTask();
    const liveQuestions = (task?.questions || []).filter(q => q.type === 'single' || q.type === 'true_false');
    const stored = liveQuestions[number - 1];
    if (!stored) return null;

    const text = storedText(stored.question);
    const questionImage = resolveStoredImage(stored.image);
    if (!text && !questionImage) return null;

    const rawOptions = stored.type === 'true_false'
        ? ['Так', 'Ні']
        : (stored.options || []);
    const options: StOption[] = buttons.map((button, index) => {
        const image = resolveStoredImage(stored.optionImages?.[index] || null);
        const optText = storedText(rawOptions[index]) || (image ? imageLabel(index) : cleanText(button.textContent));
        return {
            index,
            text: optText,
            image,
            label: button,
            control: button,
            lock: null
        };
    });

    const imageUrls: string[] = [];
    if (questionImage) imageUrls.push(questionImage);
    for (const option of options) if (option.image) imageUrls.push(option.image);

    return {
        number,
        text: text || '[Завдання на зображенні]',
        kind: 'choice',
        container,
        options,
        textInputs: [],
        matchRows: [],
        matchRights: [],
        orderSlots: [],
        orderItems: [],
        imageUrls: Array.from(new Set(imageUrls)),
        limit: null,
        needsReveal: false,
        locked: buttons.every(button => isDisabled(button))
    };
}
