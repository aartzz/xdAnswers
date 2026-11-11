// src/providers/amplify/answer/cardsort.ts
// Applies card groups with the same keyboard flow Desmos documents (M + J).

import { cleanText } from '../dom/util';
import { dispatchKey, findBestByText, stripAnswer } from './helpers';

function cardElements(): HTMLElement[] {
    const screen = document.querySelector<HTMLElement>('.dcg-student-screen.current-screen') || document;
    return Array.from(screen.querySelectorAll<HTMLElement>('[data-component-type="cardsort"] .card-wrapper'));
}

function resolveCard(value: string): HTMLElement | null {
    return findBestByText(value, cardElements(), card => card.getAttribute('aria-label') || card.innerText || '');
}

function parseCardPairs(answerText: string): Array<[string, string]> {
    const blocks = stripAnswer(answerText).split(/[;\n]+/).map(part => cleanText(part)).filter(Boolean);
    const pairs: Array<[string, string]> = [];

    for (const block of blocks) {
        const positions: number[] = [];
        let index = block.indexOf('=');
        while (index >= 0) {
            positions.push(index);
            index = block.indexOf('=', index + 1);
        }
        let found = false;
        for (let i = positions.length - 1; i >= 0; i--) {
            const left = block.slice(0, positions[i]).trim();
            const right = block.slice(positions[i] + 1).trim();
            if (!left || !right) continue;
            if (resolveCard(left) && resolveCard(right)) {
                pairs.push([left, right]);
                found = true;
                break;
            }
        }
        if (found) continue;

        const arrow = block.match(/^(.+?)\s*(?:->|→)\s*(.+)$/);
        if (arrow) pairs.push([arrow[1].trim(), arrow[2].trim()]);
    }
    return pairs;
}

function sameGroup(a: HTMLElement, b: HTMLElement): boolean {
    return a.closest('.dcg-cardsort-group') === b.closest('.dcg-cardsort-group');
}

export function applyCardsort(answerText: string): boolean {
    const pairs = parseCardPairs(answerText);
    if (!pairs.length) return false;

    let applied = false;
    for (const [leftText, rightText] of pairs) {
        const left = resolveCard(leftText);
        const right = resolveCard(rightText);
        if (!left || !right || left === right || sameGroup(left, right)) continue;
        dispatchKey(left, 'm');
        dispatchKey(right, 'j');
        applied = true;
    }
    return applied;
}
