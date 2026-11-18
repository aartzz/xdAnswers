// src/providers/smileandtask/dom/options.ts
// Readers for choice options, text inputs, matching rows/options, and ordering grids.

import { inlineValue } from './math';
import type { StMatchRight, StMatchRow, StOption, StOrderItem, StOrderSlot, StTextInput } from './types';
import { cellImage, cleanText, IMAGE_PLACEHOLDER, imageLabel } from './util';

export type GridKind = 'matching' | 'ordering';

export function readChoice(card: HTMLElement, role: 'radio' | 'checkbox'): StOption[] {
    const controls = Array.from(card.querySelectorAll<HTMLElement>(`button[role="${role}"]`));
    return controls.map((control, index) => {
        const row = control.parentElement;
        const label = row?.querySelector<HTMLElement>('label') || null;
        const lock = row?.parentElement?.querySelector<HTMLElement>(':scope > button[aria-label]') || null;
        const text = inlineValue(label);
        const image = cellImage(label);
        return {
            index,
            text: text || (image && !lock ? imageLabel(index) : ''),
            image,
            label,
            control,
            lock
        };
    });
}

export function readTextInputs(card: HTMLElement): StTextInput[] {
    const inputs = Array.from(card.querySelectorAll<HTMLInputElement>('input'))
        .filter(input => !['radio', 'checkbox', 'hidden', 'button', 'submit'].includes(input.type) && input.offsetParent !== null);
    return inputs.map(input => {
        // multi_blank rows are "label + input" blocks; fill_blank has no row label.
        let label = '';
        let node: HTMLElement | null = input.parentElement;
        while (node && node !== card) {
            if (node.classList.contains('flex-col')) {
                label = cleanText(node.querySelector('label')?.textContent).replace(/:$/, '');
                break;
            }
            node = node.parentElement;
        }
        return { element: input, label };
    });
}

export function gridCells(card: HTMLElement): { kind: GridKind; cells: HTMLElement[] } | null {
    const headers = Array.from(card.querySelectorAll<HTMLElement>('span.uppercase'))
        .filter(span => span.parentElement && span.parentElement.querySelectorAll(':scope > span.uppercase').length >= 3);
    if (headers.length < 3) return null;

    const first = cleanText(headers[0].textContent);
    const kind: GridKind | null = first === 'Елемент' ? 'matching' : first === '№' ? 'ordering' : null;
    if (!kind) return null;

    const headerGrid = headers[0].parentElement as HTMLElement;
    let body: HTMLElement | null = headerGrid;
    const own = Array.from(headerGrid.children).filter(item => !item.classList.contains('uppercase'));
    if (!own.length) body = headerGrid.nextElementSibling as HTMLElement | null;
    if (!body) return null;

    const cells = (Array.from(body.children) as HTMLElement[])
        .filter(item => !(item.tagName === 'SPAN' && item.classList.contains('uppercase')));
    return { kind, cells };
}

function cellButton(cell: HTMLElement | undefined): HTMLButtonElement | null {
    if (!cell) return null;
    if (cell.tagName === 'BUTTON') return cell as HTMLButtonElement;
    return cell.querySelector<HTMLButtonElement>(':scope > button');
}

function slotValue(
    button: HTMLButtonElement,
    candidates: Array<{ text: string; image: string | null }>
): string {
    if (button.querySelector('span.italic')) return '';
    const text = inlineValue(button);
    if (text) return text;
    const image = cellImage(button);
    if (!image) return '';
    const matched = candidates.find(candidate => candidate.image === image);
    return matched?.text || IMAGE_PLACEHOLDER;
}

export function readMatching(cells: HTMLElement[]): { rows: StMatchRow[]; rights: StMatchRight[] } {
    const rights: StMatchRight[] = [];
    for (let i = 0; i < cells.length; i += 3) {
        const right = cellButton(cells[i + 2]);
        if (!right) continue;
        const image = cellImage(right);
        const text = inlineValue(right);
        const index = rights.length;
        rights.push({
            index,
            text: text || (image ? imageLabel(index) : ''),
            image,
            button: right
        });
    }

    const rows: StMatchRow[] = [];
    for (let i = 0; i < cells.length; i += 3) {
        const left = cells[i];
        const assign = cellButton(cells[i + 1]);
        if (!left || !assign) continue;
        const image = cellImage(left);
        const text = inlineValue(left);
        const index = rows.length;
        rows.push({
            index,
            text: text || (image ? imageLabel(index) : ''),
            image,
            assign,
            value: slotValue(assign, rights)
        });
    }
    return { rows, rights };
}

export function readOrdering(cells: HTMLElement[]): { slots: StOrderSlot[]; items: StOrderItem[] } {
    const items: StOrderItem[] = [];
    for (let i = 0; i < cells.length; i += 3) {
        const item = cellButton(cells[i + 2]);
        if (!item) continue;
        const image = cellImage(item);
        const text = inlineValue(item);
        const index = items.length;
        items.push({
            index,
            text: text || (image ? imageLabel(index) : ''),
            image,
            button: item
        });
    }

    const slots: StOrderSlot[] = [];
    for (let i = 0; i < cells.length; i += 3) {
        const slot = cellButton(cells[i + 1]);
        if (!slot) continue;
        slots.push({
            index: slots.length,
            button: slot,
            value: slotValue(slot, items)
        });
    }
    return { slots, items };
}
