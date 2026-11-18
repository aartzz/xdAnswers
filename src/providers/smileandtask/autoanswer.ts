// src/providers/smileandtask/autoanswer.ts
// S&T School answer application. The player is a React app whose state cannot be
// reached from a content script, so every answer is applied through the same
// clicks and input events a student would produce.
//
// Choice rows use the Radix radio/checkbox buttons; matching and ordering use the
// two-step "pick a slot, then pick a value" interaction of the grids. The player
// keeps the answer in memory until "Зберегти відповідь" is pressed, and that
// final step is deliberately left to the student.
import { cleanText } from './dom/util';
import type { StKind, StMatchRight, StMatchRow, StOption, StOrderItem, StQuestionState } from './dom/types';

type Reread = () => StQuestionState | null;

const ANSWER_PREFIX = /^(?:FINAL_ANSWER|Відповідь|Ответ|Answer)\s*:\s*/i;
const LIST_PREFIX = /^\s*(?:[-*•]\s*)?(?:\d+[.)]|[A-Za-zА-Яа-я][.)])\s+/;
const YES = /^(?:так|правда|true|yes|вірно|істина|т)$/i;
const NO = /^(?:ні|неправда|хиба|false|no|невірно|помилково|н)$/i;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function stripAnswer(raw: string): string {
    return String(raw || '')
        .replace(/```[a-zA-Z]*\s*/g, '')
        .replace(/```/g, '')
        .replace(ANSWER_PREFIX, '')
        .trim();
}

function stripListPrefix(value: string): string {
    return cleanText(value)
        .replace(/^\s*[-*•]\s*/, '')
        .replace(LIST_PREFIX, '')
        .trim();
}

function normalize(value: string): string {
    return cleanText(value)
        .toLowerCase()
        .replace(/[«»"'`]/g, '')
        .replace(/[–—−]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function sameText(a: string, b: string): boolean {
    return !!a && normalize(a) === normalize(b);
}

function similarity(a: string, b: string): number {
    const internal = window.xdAnswers._internal;
    if (internal && typeof internal.textSimilarity === 'function') {
        return internal.textSimilarity(a, b);
    }
    if (a === b) return 1;
    if (!a || !b) return 0;
    const longer = a.length >= b.length ? a : b;
    const shorter = a.length < b.length ? a : b;
    if (longer.includes(shorter)) return shorter.length / longer.length;
    return 0;
}

function bestMatch<T>(
    needle: string,
    items: T[],
    getText: (item: T) => string,
    used?: Set<T>
): T | null {
    const target = normalize(needle);
    if (!target) return null;
    const available = used ? items.filter(item => !used.has(item)) : items;

    const exact = available.find(item => normalize(getText(item)) === target);
    if (exact) return exact;

    let best: T | null = null;
    let bestScore = 0.5;
    for (const item of available) {
        const itemText = normalize(getText(item));
        if (!itemText) continue;
        const score = similarity(target, itemText);
        if (score > bestScore) {
            best = item;
            bestScore = score;
        }
    }
    return best;
}

function indexFromNumber(part: string, length: number): number {
    const match = /^(\d+)(?:[.)]\s*)?$/.exec(part.trim());
    if (!match) return -1;
    const index = Number(match[1]) - 1;
    return index >= 0 && index < length ? index : -1;
}

function indexFromLetter(part: string, length: number): number {
    const match = /^([A-Za-zА-Яа-я])(?:[.)]\s*)?$/.exec(part.trim());
    if (!match) return -1;
    const letter = match[1].toUpperCase();
    let index = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(letter);
    if (index < 0) index = 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ'.indexOf(letter);
    return index >= 0 && index < length ? index : -1;
}

function indexFromImageLabel(part: string, length: number): number {
    const match = /^\[?\s*зображення\s*(\d+)\s*\]?$/i.exec(part.trim());
    if (!match) return -1;
    const index = Number(match[1]) - 1;
    return index >= 0 && index < length ? index : -1;
}

function highlight(element: HTMLElement | null): void {
    if (!element) return;
    element.classList.add('xd-highlight-correct');
    element.style.setProperty('outline', '3px solid #22c55e', 'important');
    element.style.setProperty('background-color', 'rgba(34, 197, 94, 0.15)', 'important');
    element.style.setProperty('border-radius', '4px', 'important');
}

function isDisabled(el: Element): boolean {
    return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-disabled');
}

function isChecked(el: Element): boolean {
    return el.getAttribute('aria-checked') === 'true' || el.getAttribute('data-state') === 'checked';
}

// ---------------------------------------------------------------------------
// Choice (single / multiple)
// ---------------------------------------------------------------------------

function stripOptionLabel(part: string): string {
    return cleanText(part)
        .replace(/^(?:варіант|option|answer|відповідь)\s*[:.-]?\s*/i, '')
        .trim();
}

function resolveOption(part: string, options: StOption[]): StOption | null {
    const cleaned = stripOptionLabel(part).replace(/^["'«]+|["'»]+$/g, '');

    // True/false questions have the fixed options "Так" / "Ні"; accept the usual synonyms.
    const yes = options.find(option => sameText(option.text, 'Так'));
    const no = options.find(option => sameText(option.text, 'Ні'));
    if (yes && no && options.length === 2) {
        if (YES.test(cleaned)) return yes;
        if (NO.test(cleaned)) return no;
    }

    // Prefer an explicit "A: text" label so a short option text cannot beat the
    // label the model actually wrote.
    const labelled = /^([A-Za-zА-Яа-я])\s*[.):]\s*(.+)$/.exec(cleaned);
    if (labelled) {
        const rest = bestMatch(labelled[2], options, option => option.text);
        if (rest) return rest;
        const index = indexFromLetter(labelled[1], options.length);
        if (index >= 0) return options[index];
    }

    const byText = bestMatch(cleaned, options, option => option.text);
    if (byText) return byText;

    const letterIndex = indexFromLetter(cleaned, options.length);
    if (letterIndex >= 0) return options[letterIndex];

    const imageIndex = indexFromImageLabel(cleaned, options.length);
    if (imageIndex >= 0) return options[imageIndex];

    return null;
}

function splitMultiAnswers(answerText: string, options: StOption[]): StOption[] {
    const text = stripAnswer(answerText);
    const primary = text.split(/[;\n]+/).map(part => cleanText(part)).filter(Boolean);
    const matched = new Set<StOption>();
    for (const part of primary) {
        const option = resolveOption(part, options);
        if (option) matched.add(option);
    }

    // Models sometimes join the options with commas; use that split only when it
    // finds more options than the primary one.
    if (primary.length <= 1 && matched.size <= 1 && text.includes(',')) {
        const commaMatched = new Set<StOption>();
        for (const part of text.split(/\s*,\s*/).map(item => cleanText(item)).filter(Boolean)) {
            const option = resolveOption(part, options);
            if (option) commaMatched.add(option);
        }
        if (commaMatched.size > matched.size) return Array.from(commaMatched);
    }

    return Array.from(matched);
}

function applyChoice(
    state: StQuestionState,
    answerText: string,
    canApply: boolean,
    canHighlight: boolean
): boolean {
    if (!state.options.length) return false;
    const multiple = state.kind === 'multi';
    let targets = multiple
        ? splitMultiAnswers(answerText, state.options)
        : [resolveOption(stripAnswer(answerText), state.options)].filter((option): option is StOption => !!option);
    if (multiple && state.limit && targets.length > state.limit) targets = targets.slice(0, state.limit);
    if (!targets.length) return false;

    if (canHighlight) {
        for (const option of targets) highlight(option.label?.closest<HTMLElement>('div.flex') || option.label);
    }

    if (canApply) {
        if (multiple) {
            // Free slots first when the player caps the number of choices.
            for (const option of state.options) {
                if (!targets.includes(option) && isChecked(option.control) && !isDisabled(option.control)) option.control.click();
            }
        }
        for (const option of targets) {
            if (!isChecked(option.control) && !isDisabled(option.control)) option.control.click();
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// Text inputs
// ---------------------------------------------------------------------------

function cleanFreeformAnswer(answerText: string): string {
    return stripAnswer(answerText)
        .replace(/^\s*[-*•]\s*/, '')
        .replace(/^["'«]+|["'»]+$/g, '')
        .trim();
}

function splitTextAnswers(answerText: string): string[] {
    const cleaned = cleanFreeformAnswer(answerText);
    let parts = cleaned.split(/[;\n]+/).map(part => cleanText(part)).filter(Boolean);
    if (parts.length <= 1 && cleaned.includes(',')) {
        const commaParts = cleaned.split(/\s*,\s*/).map(part => cleanText(part)).filter(Boolean);
        if (commaParts.length > 1) parts = commaParts;
    }
    return parts;
}

function setNativeValue(input: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

function applyText(
    state: StQuestionState,
    answerText: string,
    canApply: boolean,
    canHighlight: boolean
): boolean {
    if (!state.textInputs.length) return false;
    const parts = state.kind === 'multi_text'
        ? splitTextAnswers(answerText)
        : [cleanFreeformAnswer(answerText)];

    if (canHighlight) {
        for (const input of state.textInputs) highlight(input.element);
    }
    if (!canApply) return true;

    state.textInputs.forEach((input, index) => {
        if (input.element.disabled || input.element.readOnly) return;
        let value = parts[index] ?? '';
        if (!value) return;
        const maxLength = input.element.maxLength;
        if (typeof maxLength === 'number' && maxLength > 0) value = value.slice(0, maxLength);
        setNativeValue(input.element, value);
    });
    return true;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function resolveRow(part: string, rows: StMatchRow[]): StMatchRow | null {
    const withoutNumber = stripListPrefix(part);
    const byText = bestMatch(withoutNumber || part, rows, row => row.text);
    if (byText) return byText;

    const numberIndex = indexFromNumber(part, rows.length);
    if (numberIndex >= 0) return rows[numberIndex];

    const imageIndex = indexFromImageLabel(part, rows.length);
    if (imageIndex >= 0) return rows[imageIndex];

    const letterIndex = indexFromLetter(part, rows.length);
    if (letterIndex >= 0) return rows[letterIndex];

    return null;
}

function resolveRight(part: string, rights: StMatchRight[], used: Set<StMatchRight>): StMatchRight | null {
    const cleaned = stripListPrefix(part);
    const byText = bestMatch(cleaned || part, rights, right => right.text, used);
    if (byText) return byText;

    const imageIndex = indexFromImageLabel(part, rights.length);
    if (imageIndex >= 0 && !used.has(rights[imageIndex])) return rights[imageIndex];

    const letterIndex = indexFromLetter(part, rights.length);
    if (letterIndex >= 0 && !used.has(rights[letterIndex])) return rights[letterIndex];

    const numberIndex = indexFromNumber(part, rights.length);
    if (numberIndex >= 0 && !used.has(rights[numberIndex])) return rights[numberIndex];

    return null;
}

function splitPair(block: string): Array<[string, string]> {
    const candidates: Array<[string, string]> = [];
    const patterns = [
        /\s*(?:=>|→|->|=)\s*/,
        /\s+[—–-]\s+/,
        /\s*:\s*/
    ];
    for (const pattern of patterns) {
        const match = pattern.exec(block);
        if (!match) continue;
        const left = block.slice(0, match.index).trim();
        const right = block.slice(match.index + match[0].length).trim();
        if (left && right) candidates.push([left, right]);
    }
    return candidates;
}

function parseMatchPairs(answerText: string, rows: StMatchRow[], rights: StMatchRight[]): Map<number, number> {
    const result = new Map<number, number>();
    const used = new Set<StMatchRight>();
    const blocks = stripAnswer(answerText)
        .split(/[;\n]+/)
        .map(block => cleanText(block))
        .filter(Boolean);

    for (const block of blocks) {
        for (const [leftPart, rightPart] of splitPair(block)) {
            const row = resolveRow(leftPart, rows);
            const right = resolveRight(rightPart, rights, used);
            if (!row || !right || result.has(row.index)) continue;
            result.set(row.index, right.index);
            used.add(right);
            break;
        }
    }

    // Some models answer with just the right-hand values, one per row.
    if (result.size === 0 && blocks.length === rows.length) {
        const sequential: StMatchRight[] = [];
        const sequentialUsed = new Set<StMatchRight>();
        for (const block of blocks) {
            const right = resolveRight(stripListPrefix(block), rights, sequentialUsed);
            if (!right) {
                sequential.length = 0;
                break;
            }
            sequential.push(right);
            sequentialUsed.add(right);
        }
        if (sequential.length === rows.length) {
            rows.forEach((row, index) => result.set(row.index, sequential[index].index));
        }
    }

    return result;
}

async function runMatching(number: number, pairs: Map<number, number>, reread: Reread): Promise<void> {
    const fresh = (): StQuestionState | null => {
        const current = reread();
        return current && current.number === number && current.kind === 'matching' ? current : null;
    };

    // 1) Empty every row that holds a different value than the wanted one
    //    (clicking a filled "your choice" button clears it).
    let state = fresh();
    if (!state) return;
    for (const [rowIndex, rightIndex] of pairs) {
        const row = state.matchRows[rowIndex];
        const right = state.matchRights[rightIndex];
        if (!row || !right || !row.value || sameText(row.value, right.text)) continue;
        row.assign.click();
        await sleep(50);
        state = fresh();
        if (!state) return;
    }

    // 2) Pick the row, then pick its value.
    for (const [rowIndex, rightIndex] of pairs) {
        state = fresh();
        if (!state) return;
        const row = state.matchRows[rowIndex];
        const right = state.matchRights[rightIndex];
        if (!row || !right || isDisabled(row.assign)) continue;
        if (row.value) continue;

        row.assign.click();
        await sleep(60);
        state = fresh();
        if (!state) return;
        state.matchRights[rightIndex]?.button.click();
        await sleep(80);
    }
}

function applyMatching(
    state: StQuestionState,
    answerText: string,
    reread: Reread,
    canApply: boolean,
    canHighlight: boolean
): boolean {
    if (!state.matchRows.length || !state.matchRights.length) return false;
    const pairs = parseMatchPairs(answerText, state.matchRows, state.matchRights);
    if (pairs.size === 0) return false;

    if (canHighlight) {
        for (const [rowIndex, rightIndex] of pairs) {
            highlight(state.matchRows[rowIndex]?.assign || null);
            highlight(state.matchRights[rightIndex]?.button || null);
        }
    }
    if (canApply) void runMatching(state.number, pairs, reread);
    return true;
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

function parseOrder(answerText: string, items: StOrderItem[]): StOrderItem[] {
    const parts = stripAnswer(answerText)
        .split(/[;\n]+/)
        .map(part => stripListPrefix(part))
        .filter(Boolean);
    const desired: StOrderItem[] = [];
    const used = new Set<StOrderItem>();
    for (const part of parts) {
        const item = bestMatch(part, items, entry => entry.text, used)
            || (() => {
                const index = indexFromImageLabel(part, items.length);
                return index >= 0 && !used.has(items[index]) ? items[index] : null;
            })();
        if (!item) continue;
        desired.push(item);
        used.add(item);
    }
    return desired;
}

async function runOrdering(number: number, desired: number[], reread: Reread): Promise<void> {
    const fresh = (): StQuestionState | null => {
        const current = reread();
        return current && current.number === number && current.kind === 'ordering' ? current : null;
    };

    // 1) Empty slots that hold the wrong item.
    let state = fresh();
    if (!state) return;
    for (let slotIndex = 0; slotIndex < desired.length; slotIndex++) {
        const slot = state.orderSlots[slotIndex];
        const item = state.orderItems[desired[slotIndex]];
        if (!slot || !item || !slot.value || sameText(slot.value, item.text)) continue;
        slot.button.click();
        await sleep(50);
        state = fresh();
        if (!state) return;
    }

    // 2) Pick the item, then pick its slot.
    for (let slotIndex = 0; slotIndex < desired.length; slotIndex++) {
        state = fresh();
        if (!state) return;
        const slot = state.orderSlots[slotIndex];
        const item = state.orderItems[desired[slotIndex]];
        if (!slot || !item || isDisabled(slot.button) || slot.value) continue;

        item.button.click();
        await sleep(50);
        state = fresh();
        if (!state) return;
        state.orderSlots[slotIndex]?.button.click();
        await sleep(80);
    }
}

function applyOrdering(
    state: StQuestionState,
    answerText: string,
    reread: Reread,
    canApply: boolean,
    canHighlight: boolean
): boolean {
    if (!state.orderItems.length || !state.orderSlots.length) return false;
    const desired = parseOrder(answerText, state.orderItems);
    if (!desired.length) return false;

    if (canHighlight) {
        for (const item of desired) highlight(item.button);
    }

    // A partial order would push the unmatched items to the end and could save a
    // wrong sequence, so only apply when every item was recognised.
    if (canApply && desired.length === state.orderItems.length) {
        void runOrdering(state.number, desired.map(item => item.index), reread);
    }
    return true;
}

// ---------------------------------------------------------------------------

export function applySmileAndTaskAnswer(state: StQuestionState, answerText: string, reread: Reread): boolean {
    const settings = window.xdAnswers.settings;
    const canApply = !!settings.autoAnswer || settings.silentMode === 'oneclick';
    const canHighlight = !!settings.highlightCorrect && !settings.silentMode;
    const kind: StKind = state.kind;

    switch (kind) {
        case 'choice':
        case 'multi':
            return applyChoice(state, answerText, canApply, canHighlight);
        case 'text':
        case 'multi_text':
            return applyText(state, answerText, canApply, canHighlight);
        case 'matching':
            return applyMatching(state, answerText, reread, canApply, canHighlight);
        case 'ordering':
            return applyOrdering(state, answerText, reread, canApply, canHighlight);
        default:
            return false;
    }
}
