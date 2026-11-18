// src/providers/smileandtask/dom/question.ts
// Orchestrates S&T School DOM extraction into a single StQuestionState.

import { readLiveQuestion } from './live';
import { richText } from './math';
import { gridCells, readChoice, readMatching, readOrdering, readTextInputs } from './options';
import { populateHiddenOptions } from './reveal';
import { rememberTopic } from './storage';
import type {
    StKind,
    StMatchRight,
    StMatchRow,
    StOption,
    StOrderItem,
    StOrderSlot,
    StQuestionState,
    StTextInput
} from './types';
import { cellImage, cleanText, isDisabled } from './util';

function hasSaveButton(node: Element): boolean {
    return Array.from(node.querySelectorAll('button'))
        .some(button => /Зберегти відповідь|Збережено|Збереження/.test(button.textContent || ''));
}

function findRoot(): { root: HTMLElement; number: number } | null {
    const headings = Array.from(document.querySelectorAll<HTMLElement>('h2'));
    for (const heading of headings) {
        const match = /^Питання\s*№\s*(\d+)/.exec(cleanText(heading.textContent));
        if (!match) continue;
        let node: HTMLElement | null = heading.parentElement;
        while (node && node !== document.body) {
            if (hasSaveButton(node)) return { root: node, number: Number(match[1]) };
            node = node.parentElement;
        }
    }
    return null;
}

function findCard(root: HTMLElement): HTMLElement | null {
    const card = Array.from(root.children).find(item =>
        item.classList.contains('rounded-2xl') && item.classList.contains('border'));
    return (card as HTMLElement | undefined) || null;
}

export function readQuestion(): StQuestionState | null {
    rememberTopic();

    const found = findRoot();
    if (!found) return readLiveQuestion();
    const card = findCard(found.root);
    if (!card) return null;

    const textEl = card.querySelector<HTMLElement>(':scope > div.leading-relaxed');
    const questionImages = Array.from(card.querySelectorAll<HTMLImageElement>(':scope > div img.max-h-80'))
        .map(img => cellImage(img.parentElement))
        .filter((url): url is string => !!url);

    let kind: StKind | null = null;
    let options: StOption[] = [];
    let textInputs: StTextInput[] = [];
    let matchRows: StMatchRow[] = [];
    let matchRights: StMatchRight[] = [];
    let orderSlots: StOrderSlot[] = [];
    let orderItems: StOrderItem[] = [];
    let locked = false;

    const grid = gridCells(card);
    if (card.querySelector('button[role="radio"]')) {
        kind = 'choice';
        options = readChoice(card, 'radio');
        locked = options.every(option => isDisabled(option.control));
    } else if (card.querySelector('button[role="checkbox"]')) {
        kind = 'multi';
        options = readChoice(card, 'checkbox');
        // With a max-choices limit the unselected options are disabled, but the
        // selected ones stay enabled; a fully disabled list means "already saved".
        locked = options.every(option => isDisabled(option.control));
    } else if (grid && grid.kind === 'matching') {
        kind = 'matching';
        ({ rows: matchRows, rights: matchRights } = readMatching(grid.cells));
        locked = matchRows.length > 0 && matchRows.every(row => isDisabled(row.assign));
    } else if (grid && grid.kind === 'ordering') {
        kind = 'ordering';
        ({ slots: orderSlots, items: orderItems } = readOrdering(grid.cells));
        locked = orderSlots.length > 0 && orderSlots.every(slot => isDisabled(slot.button));
    } else {
        textInputs = readTextInputs(card);
        if (textInputs.length > 0) {
            kind = textInputs.length === 1 && !textInputs[0].label ? 'text' : 'multi_text';
        }
        locked = textInputs.length > 0 && textInputs.every(input => input.element.disabled);
    }
    if (!kind) return null;

    let text = richText(textEl);
    if (!text && questionImages.length) text = '[Завдання на зображенні]';
    if (!text) return null;

    populateHiddenOptions(found.number, text, options);

    const needsReveal = options.some(option => !!option.lock && !isDisabled(option.lock) && !option.text);

    const badge = card.querySelector('[data-slot="badge"]');
    const limitMatch = /Вибрано:\s*\d+\s*\/\s*(\d+)/.exec(cleanText(badge?.textContent));
    const limit = limitMatch ? Number(limitMatch[1]) : null;

    const imageUrls: string[] = [...questionImages];
    for (const option of options) if (option.image) imageUrls.push(option.image);
    for (const row of matchRows) if (row.image) imageUrls.push(row.image);
    for (const right of matchRights) if (right.image) imageUrls.push(right.image);
    for (const item of orderItems) if (item.image) imageUrls.push(item.image);

    return {
        number: found.number,
        text,
        kind,
        container: card,
        options,
        textInputs,
        matchRows,
        matchRights,
        orderSlots,
        orderItems,
        imageUrls: Array.from(new Set(imageUrls)),
        limit,
        needsReveal,
        locked
    };
}

