// src/providers/testix/autoanswer.ts
// Testix answer application. Testix is an Alpine.js app; content scripts cannot
// touch its component state directly, so every answer is applied through the
// same clicks/inputs a student would use.
//
// Matching rows use tapOption(id) + tapSlot(id); choice rows use the native
// radio/checkbox input; ordering and categorization are driven through their
// tap handlers. Highlighting is done here because the generic matcher cannot
// understand the matching/ordering/categorization layouts.
import { cleanText } from './dom/question';
import type {
    TestixCategoryBin,
    TestixMatchingLeft,
    TestixMatchingRight,
    TestixOption,
    TestixQuestionState
} from './dom/question';

const ANSWER_PREFIX = /^(?:FINAL_ANSWER|Відповідь|Ответ|Answer)\s*:\s*/i;
const LIST_PREFIX = /^\s*(?:[-*•]\s*)?(?:\d+[.)]|[A-Za-zА-Яа-я][.)])\s+/;

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
    used?: Set<string>,
    getKey?: (item: T) => string
): T | null {
    const target = normalize(needle);
    if (!target) return null;
    const available = used && getKey ? items.filter(item => !used.has(getKey(item))) : items;

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
    const text = part.trim();
    const match = /^(\d+)(?:[.)]\s*)?$/.exec(text);
    if (!match) return -1;
    const index = Number(match[1]) - 1;
    return index >= 0 && index < length ? index : -1;
}

function indexFromLetter(part: string, length: number): number {
    const text = part.trim();
    const match = /^([A-Za-zА-Яа-я])(?:[.)]\s*)?$/.exec(text);
    if (!match) return -1;
    const letter = match[1].toUpperCase();
    let index = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(letter);
    if (index < 0) index = 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ'.indexOf(letter);
    return index >= 0 && index < length ? index : -1;
}

function resolveLeft(part: string, lefts: TestixMatchingLeft[]): TestixMatchingLeft | null {
    const withoutNumber = stripListPrefix(part);
    const byText = bestMatch(withoutNumber || part, lefts, left => left.text);
    if (byText) return byText;

    const numberIndex = indexFromNumber(part, lefts.length);
    if (numberIndex >= 0) return lefts[numberIndex];

    const letterIndex = indexFromLetter(part, lefts.length);
    if (letterIndex >= 0) return lefts[letterIndex];

    return null;
}

function resolveRight(
    part: string,
    rights: TestixMatchingRight[],
    used: Set<string>
): TestixMatchingRight | null {
    const cleaned = stripListPrefix(part);
    const byText = bestMatch(cleaned || part, rights, right => right.text, used, right => right.id);
    if (byText) return byText;

    const numberIndex = indexFromNumber(part, rights.length);
    if (numberIndex >= 0 && !used.has(rights[numberIndex].id)) return rights[numberIndex];

    const letterIndex = indexFromLetter(part, rights.length);
    if (letterIndex >= 0 && !used.has(rights[letterIndex].id)) return rights[letterIndex];

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

function parseMatchPairs(
    answerText: string,
    lefts: TestixMatchingLeft[],
    rights: TestixMatchingRight[]
): Map<string, string> {
    const result = new Map<string, string>();
    const used = new Set<string>();
    const blocks = stripAnswer(answerText)
        .split(/[;\n]+/)
        .map(block => cleanText(block))
        .filter(Boolean);

    for (const block of blocks) {
        for (const [leftPart, rightPart] of splitPair(block)) {
            const left = resolveLeft(leftPart, lefts);
            const right = resolveRight(rightPart, rights, used);
            if (!left || !right || result.has(left.id)) continue;
            result.set(left.id, right.id);
            used.add(right.id);
            break;
        }
    }

    // Some models return only the right-side values, one per line. Accept that
    // form when every row has exactly one value.
    if (result.size === 0 && blocks.length === lefts.length) {
        const sequential: TestixMatchingRight[] = [];
        const sequentialUsed = new Set<string>();
        for (const block of blocks) {
            const right = resolveRight(stripListPrefix(block), rights, sequentialUsed);
            if (!right) {
                sequential.length = 0;
                break;
            }
            sequential.push(right);
            sequentialUsed.add(right.id);
        }
        if (sequential.length === lefts.length) {
            lefts.forEach((left, index) => result.set(left.id, sequential[index].id));
        }
    }

    return result;
}

function stripOptionLabel(part: string): string {
    return cleanText(part)
        .replace(/^(?:варіант|option|answer|відповідь)\s*[:.-]?\s*/i, '')
        .trim();
}

function resolveOption(part: string, options: TestixOption[]): TestixOption | null {
    const cleaned = stripOptionLabel(part);

    // Prefer an explicit "A: text" label before fuzzy text matching so a short
    // option text cannot win over the label the model actually wrote.
    const labelled = /^([A-Za-zА-Яа-я])\s*[.):]\s*(.+)$/.exec(cleaned);
    if (labelled) {
        const rest = bestMatch(labelled[2], options, option => option.text);
        if (rest) return rest;
        const index = indexFromLetter(labelled[1], options.length);
        if (index >= 0) return options[index];
    }

    const byText = bestMatch(cleaned || part, options, option => option.text);
    if (byText) return byText;

    const index = indexFromLetter(cleaned, options.length);
    if (index >= 0) return options[index];

    return null;
}

function splitMultiAnswers(answerText: string, options: TestixOption[]): TestixOption[] {
    const text = stripAnswer(answerText);
    const primary = text.split(/[;\n]+/).map(part => cleanText(part)).filter(Boolean);
    const matched = new Map<string, TestixOption>();
    for (const part of primary) {
        const option = resolveOption(part, options);
        if (option) matched.set(option.id || option.text, option);
    }

    // Comma-separated answers are common when the model ignores the prompt.
    // Only use them when the primary split found fewer options and the comma
    // split finds more.
    if (primary.length <= 1 && matched.size <= 1 && text.includes(',')) {
        const commaParts = text.split(/\s*,\s*/).map(part => cleanText(part)).filter(Boolean);
        const commaMatched = new Map<string, TestixOption>();
        for (const part of commaParts) {
            const option = resolveOption(part, options);
            if (option) commaMatched.set(option.id || option.text, option);
        }
        if (commaMatched.size > matched.size) {
            return Array.from(commaMatched.values());
        }
    }

    return Array.from(matched.values());
}

function highlight(element: HTMLElement): void {
    element.classList.add('xd-highlight-correct');
    element.style.setProperty('outline', '3px solid #22c55e', 'important');
    element.style.setProperty('background-color', 'rgba(34, 197, 94, 0.15)', 'important');
    element.style.setProperty('border-radius', '4px', 'important');
}

function applyMatching(
    state: TestixQuestionState,
    answerText: string,
    canApply: boolean,
    canHighlight: boolean
): boolean {
    if (!state.matching) return false;
    const pairs = parseMatchPairs(answerText, state.matching.lefts, state.matching.rights);
    if (pairs.size === 0) return false;

    if (canHighlight) {
        for (const [leftId, rightId] of pairs) {
            const left = state.matching.lefts.find(item => item.id === leftId);
            const right = state.matching.rights.find(item => item.id === rightId);
            if (left) highlight(left.slot);
            if (right) highlight(right.button);
        }
    }

    if (canApply) {
        for (const [leftId, rightId] of pairs) {
            const left = state.matching.lefts.find(item => item.id === leftId);
            const right = state.matching.rights.find(item => item.id === rightId);
            if (!left || !right) continue;
            // tapOption selects the pool value, tapSlot assigns it. The option
            // button stays in the DOM even when x-show hides an already-used one.
            right.button.click();
            left.slot.click();
        }
    }

    return true;
}

function applyChoice(
    state: TestixQuestionState,
    answerText: string,
    canApply: boolean,
    canHighlight: boolean
): boolean {
    if (!state.options.length) return false;
    const multiple = state.kind === 'multi';
    const targets = multiple
        ? splitMultiAnswers(answerText, state.options)
        : [resolveOption(stripAnswer(answerText), state.options)].filter((option): option is TestixOption => !!option);

    const unique = Array.from(new Map(targets.map(option => [option.id || option.text, option])).values());
    if (!unique.length) return false;

    if (canHighlight) {
        for (const option of unique) highlight(option.element);
    }

    if (canApply) {
        for (const option of unique) {
            if (!option.input.checked) option.input.click();
        }
    }

    return true;
}

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

function setNativeValue(
    input: HTMLInputElement | HTMLTextAreaElement,
    value: string
): void {
    const proto = input instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

function applyText(
    state: TestixQuestionState,
    answerText: string,
    canApply: boolean,
    canHighlight: boolean
): boolean {
    if (!state.textInputs.length) return false;
    const parts = state.kind === 'text_multi'
        ? splitTextAnswers(answerText)
        : [cleanFreeformAnswer(answerText)];

    if (canHighlight) {
        for (const input of state.textInputs) highlight(input.element);
    }

    if (!canApply) return true;

    state.textInputs.forEach((input, index) => {
        let value = parts[index] ?? '';
        if (!value) return;
        const maxLength = input.element.maxLength;
        if (typeof maxLength === 'number' && maxLength > 0) value = value.slice(0, maxLength);
        setNativeValue(input.element, value);
    });
    return true;
}

function itemById(state: TestixQuestionState, id: string): HTMLElement | null {
    const items = Array.from(state.container.querySelectorAll<HTMLElement>('[data-order-id]'));
    return items.find(item => item.dataset.orderId === id) || null;
}

function applyOrdering(
    state: TestixQuestionState,
    answerText: string,
    canApply: boolean,
    canHighlight: boolean
): boolean {
    if (!state.orderingItems.length) return false;
    const parts = stripAnswer(answerText)
        .split(/[;\n]+/)
        .map(part => stripListPrefix(part))
        .filter(Boolean);
    if (!parts.length) return false;

    const desired: TestixQuestionState['orderingItems'] = [];
    const used = new Set<string>();
    for (const part of parts) {
        const item = bestMatch(part, state.orderingItems, entry => entry.text, used, entry => entry.id);
        if (!item) continue;
        desired.push(item);
        used.add(item.id);
    }
    if (!desired.length) return false;

    if (canHighlight) {
        for (const item of desired) highlight(item.element);
    }

    // A partial order would push the unmatched items to the end and could
    // silently submit a wrong sequence. Only apply when every item was parsed.
    if (canApply && desired.length === state.orderingItems.length) {
        const order = state.orderingItems.map(item => item.id);
        for (let i = 0; i < desired.length; i++) {
            const sourceId = desired[i].id;
            const from = order.indexOf(sourceId);
            if (from < 0 || from <= i) continue;
            const targetId = order[i];
            const source = itemById(state, sourceId);
            const target = itemById(state, targetId);
            if (!source || !target) continue;
            // ordering.tap() moves the picked item in front of the tapped one.
            source.click();
            target.click();
            order.splice(i, 0, order.splice(from, 1)[0]);
        }
    }

    return true;
}

function resolveCategoryBin(part: string, bins: TestixCategoryBin[]): TestixCategoryBin | null {
    const cleaned = cleanText(part).replace(/^Категорія\s*/i, '');
    const byText = bestMatch(cleaned || part, bins, bin => bin.text);
    if (byText) return byText;

    const numberIndex = indexFromNumber(part, bins.length);
    if (numberIndex >= 0) return bins[numberIndex];

    const letterIndex = indexFromLetter(part, bins.length);
    if (letterIndex >= 0) return bins[letterIndex];

    return null;
}

function parseCategoryMappings(
    answerText: string
): Array<{ category: string; items: string[] }> {
    const blocks = stripAnswer(answerText)
        .split(/[;\n]+/)
        .map(block => cleanText(block))
        .filter(Boolean);
    const mappings: Array<{ category: string; items: string[] }> = [];

    for (const block of blocks) {
        const colon = block.indexOf(':');
        if (colon > 0) {
            const category = block.slice(0, colon).trim();
            const items = block.slice(colon + 1).split(',').map(item => cleanText(item)).filter(Boolean);
            if (category && items.length) mappings.push({ category, items });
            continue;
        }

        const pair = splitPair(block)[0];
        if (pair) {
            const item = cleanText(pair[0]);
            const category = cleanText(pair[1]);
            if (item && category) mappings.push({ category, items: [item] });
        }
    }

    return mappings;
}

function applyCategorize(
    state: TestixQuestionState,
    answerText: string,
    canApply: boolean,
    canHighlight: boolean
): boolean {
    if (!state.categoryBins.length) return false;
    const mappings = parseCategoryMappings(answerText);
    if (!mappings.length) return false;

    let applied = false;
    for (const mapping of mappings) {
        const bin = resolveCategoryBin(mapping.category, state.categoryBins);
        if (!bin) continue;

        for (const itemText of mapping.items) {
            const item = bestMatch(itemText, state.orderingItems, entry => entry.text);
            if (!item) continue;
            applied = true;
            if (canHighlight) {
                highlight(item.element);
                highlight(bin.element);
            }
            if (canApply) {
                // categorize.tapItem() picks the item, tapBin() places it.
                item.element.click();
                bin.element.click();
            }
        }
    }

    return applied;
}

export function applyTestixAnswer(state: TestixQuestionState, answerText: string): boolean {
    const settings = window.xdAnswers.settings;
    const canApply = !!settings.autoAnswer || settings.silentMode === 'oneclick';
    const canHighlight = !!settings.highlightCorrect && !settings.silentMode;

    switch (state.kind) {
        case 'matching':
            return applyMatching(state, answerText, canApply, canHighlight);
        case 'choice':
        case 'multi':
            return applyChoice(state, answerText, canApply, canHighlight);
        case 'text':
        case 'text_multi':
            return applyText(state, answerText, canApply, canHighlight);
        case 'ordering':
            return applyOrdering(state, answerText, canApply, canHighlight);
        case 'categorize':
            return applyCategorize(state, answerText, canApply, canHighlight);
        default:
            return false;
    }
}
