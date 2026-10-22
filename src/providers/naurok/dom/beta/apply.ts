// src/providers/naurok/dom/beta/apply.ts
// Applies an AI answer to the test-beta React renderers. Each question type has
// its own interaction: click options, fill inputs/selects, reorder items, pair
// cards, assign chips to categories or answer every row of a true/false grid.
// Every entry point verifies the question key first, so an answer produced for
// the previous question can never land on the next one during an animation.

import { getBetaQuestionState } from './main';
import { applyArcadeAnswer } from './arcade';

window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
const I = window.xdAnswers._internal;
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function normalize(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanAnswer(answerText: string): string {
    return (answerText || '')
        .replace(/```[a-z]*|```/gi, '')
        .replace(/^\s*(?:answer|відповідь)\s*:\s*/i, '')
        .trim();
}

function stripNumbering(value: string): string {
    return value.replace(/^\s*\d+\s*[.)]\s*/, '').trim();
}

function firstAnswerLine(answerText: string): string {
    return cleanAnswer(answerText)
        .split(/[\n;]/)[0]
        .replace(/^\s*(?:слово|word)\s*:\s*/i, '')
        .trim();
}

function splitParts(answerText: string): string[] {
    return answerText
        .split(/[;\n]+/)
        .map(part => stripNumbering(cleanAnswer(part)))
        .filter(Boolean);
}

function parseKeyed(answerText: string): Map<string, string> {
    const result = new Map<string, string>();
    const re = /\b([A-Z]\d+)\s*[=:–—-]\s*([^;\n]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(answerText)) !== null) {
        const key = match[1].toUpperCase();
        const value = cleanAnswer(match[2]);
        if (value) result.set(key, value);
    }
    if (result.size) return result;
    splitParts(answerText).forEach((value, index) => result.set('A' + index, value));
    return result;
}

function findMatch<T extends Element>(items: T[], ref: string): T | null {
    const wanted = I.normalizeText(ref);
    if (!wanted) return null;
    const imageIndex = ref.match(/\[зображення\s*(\d+)\]/i);
    if (imageIndex) {
        const item = items[parseInt(imageIndex[1], 10) - 1];
        if (item) return item as T;
    }
    const indexed = wanted.match(/^(\d+)$/);
    if (indexed) {
        const item = items[parseInt(indexed[1], 10) - 1];
        if (item) return item as T;
    }
    const texts = items.map(item => I.normalizeText(item.textContent || ''));
    let index = texts.findIndex(text => text === wanted);
    if (index < 0) index = texts.findIndex(text => text.includes(wanted) || wanted.includes(text));
    if (index < 0) {
        let best = 0;
        texts.forEach((text, i) => {
            const score = I.textSimilarity(text, wanted);
            if (score > best) {
                best = score;
                index = i;
            }
        });
        if (best < 0.45) index = -1;
    }
    return index >= 0 ? items[index] : null;
}

function clickElement(el: Element | null): void {
    if (!(el instanceof HTMLElement)) return;
    el.click();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
    let proto: object;
    if (el instanceof HTMLSelectElement) proto = HTMLSelectElement.prototype;
    else if (el instanceof HTMLTextAreaElement) proto = HTMLTextAreaElement.prototype;
    else proto = HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

function scheduleFeedbackClick(): void {
    let attempts = 0;
    const timer = setInterval(() => {
        attempts++;
        if (attempts > 50) {
            clearInterval(timer);
            return;
        }
        const nextButton = document.querySelector<HTMLButtonElement>(
            '.tb-feedback button.tb-btn-white, .tb-feedback .tb-btn, .tb-feedback button, .tb-board-foot button.tb-btn-go, .tb-team-foot button.tb-btn-go'
        );
        if (nextButton && nextButton.offsetParent !== null && !nextButton.disabled) {
            clearInterval(timer);
            setTimeout(() => {
                clickElement(nextButton);
            }, 120);
            return;
        }
        const feedback = document.querySelector('.tb-feedback');
        if (feedback) {
            const btn = Array.from(feedback.querySelectorAll<HTMLButtonElement>('button')).find(
                b => /^(Далі|Завершити)\b/i.test(b.textContent || '')
            );
            if (btn && !btn.disabled) {
                clearInterval(timer);
                setTimeout(() => {
                    clickElement(btn);
                }, 120);
                return;
            }
        }
    }, 100);
}

function clickSubmit(): void {
    const button = document.querySelector<HTMLButtonElement>(
        '.tb-submit-row button.tb-btn-white:not([disabled]), ' +
        'form.tb-type-answer button[type="submit"]:not([disabled]), ' +
        '.tb-submit-row button:not(.tb-btn-ghost):not([disabled]), ' +
        '.tb-mode-tools button.tb-btn-white:not([disabled])'
    );
    if (!button) return;
    clickElement(button);
    scheduleFeedbackClick();
}

function stageRoot(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.tb-stagebox');
}

function questionKeyMatches(stateKey: string): boolean {
    const modules = I.providerModules || (I.providerModules = {});
    const naurok = modules.naurok || (modules.naurok = {});
    const expected = naurok.currentQuestionKey;
    return !expected || expected === stateKey;
}

function applyChoices(answerText: string, stage: HTMLElement): void {
    const answers = Array.from(stage.querySelectorAll<HTMLElement>('.tb-answers .tb-answer, .tb-holes .tb-mole'))
        .filter(answer => answer.getClientRects().length > 0);
    const matched = I.matchAnswerToOptions(answerText, answers);
    const multi = !!stage.querySelector('.tb-answer-tick') ||
        (!!stage.querySelector('.tb-mode-whack') && !!stage.querySelector('.tb-submit-row'));
    const chosen = multi ? matched : matched.slice(0, 1);
    chosen.forEach(answer => {
        const target = answer.closest<HTMLElement>('.tb-answer, .tb-mole') || answer;
        clickElement(target);
    });
    if (multi && chosen.length) setTimeout(clickSubmit, 140);
    else if (!multi && chosen.length) scheduleFeedbackClick();
}

function applyFill(answerText: string, stage: HTMLElement): void {
    const pairs = parseKeyed(answerText);
    const inputs = Array.from(stage.querySelectorAll<HTMLInputElement>('.tb-fill-input'));
    inputs.forEach((input, index) => {
        // Tolerate a model that answers with 1-based keys even though the
        // prompt uses A0/A1.
        const value = pairs.get('A' + index) ?? pairs.get('A' + (index + 1));
        if (value != null) setNativeValue(input, value);
    });
    if (inputs.length) setTimeout(clickSubmit, 90);
}

function applyDropdown(answerText: string, stage: HTMLElement): void {
    const pairs = parseKeyed(answerText);
    const selects = Array.from(stage.querySelectorAll<HTMLSelectElement>('.tb-fill-select'));
    selects.forEach((select, index) => {
        const value = pairs.get('A' + index) ?? pairs.get('A' + (index + 1));
        if (value == null) return;
        const option = Array.from(select.options).find(opt =>
            I.normalizeText(opt.textContent) === I.normalizeText(value) ||
            I.normalizeText(opt.textContent).includes(I.normalizeText(value)) ||
            I.normalizeText(value).includes(I.normalizeText(opt.textContent))
        );
        if (option) {
            setNativeValue(select, option.value);
            if (select.value !== option.value) {
                select.selectedIndex = Array.from(select.options).indexOf(option);
            }
        }
    });
    if (selects.length) setTimeout(clickSubmit, 90);
}

async function applyOrder(answerText: string): Promise<void> {
    const targets = splitParts(answerText).map(stripNumbering).filter(Boolean);
    if (!targets.length) return;
    for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
        for (let guard = 0; guard < 40; guard++) {
            const items = Array.from(document.querySelectorAll<HTMLElement>('.tb-order .tb-order-item'));
            if (targetIndex >= items.length) break;
            const currentIndex = items.findIndex(item => {
                const body = item.querySelector('.tb-order-body') || item;
                return findMatch([body], targets[targetIndex]) !== null;
            });
            if (currentIndex < 0 || currentIndex === targetIndex) break;
            const direction = currentIndex > targetIndex ? 'Вище' : 'Нижче';
            const button = items[currentIndex].querySelector<HTMLButtonElement>(`.tb-order-btn[aria-label="${direction}"]`);
            if (!button || button.disabled) break;
            clickElement(button);
            await wait(70);
        }
    }
    await wait(120);
    clickSubmit();
}

async function applyMatch(answerText: string, stage: HTMLElement): Promise<void> {
    const columns = stage.querySelectorAll('.tb-match .tb-match-col');
    const left = Array.from(columns[0]?.querySelectorAll<HTMLElement>('.tb-match-card') || []);
    const right = Array.from(columns[1]?.querySelectorAll<HTMLElement>('.tb-match-card') || []);
    if (!left.length || !right.length) return;
    const pairs = answerText.split(/[;\n]+/).map(line => {
        const match = stripNumbering(line).match(/^(.*?)\s*(?:=|->|→|—|–)\s*(.*)$/);
        return match ? { left: cleanAnswer(match[1]), right: cleanAnswer(match[2]) } : null;
    }).filter((pair): pair is { left: string; right: string } => !!pair && !!pair.left && !!pair.right);
    for (const pair of pairs) {
        const leftCard = findMatch(left, pair.left);
        const rightCard = findMatch(right, pair.right);
        if (!leftCard || !rightCard) continue;
        clickElement(leftCard);
        await wait(50);
        clickElement(rightCard);
        await wait(60);
    }
    await wait(120);
    clickSubmit();
}

async function applyCategorize(answerText: string, stage: HTMLElement): Promise<void> {
    const groups: { title: string; element: HTMLElement }[] = [];
    stage.querySelectorAll<HTMLElement>('.tb-cat-group').forEach(group => {
        const title = normalize(group.querySelector('.tb-cat-title')?.textContent || '');
        if (title) groups.push({ title, element: group });
    });
    if (!groups.length) return;

    const assignments: { item: string; category: string }[] = [];
    answerText.split(/[;\n]+/).forEach(line => {
        const match = stripNumbering(line).match(/^(.+?)\s*:\s*(.+)$/);
        if (!match) return;
        const category = cleanAnswer(match[1]);
        match[2].split(',').map(cleanAnswer).filter(Boolean).forEach(item => assignments.push({ item, category }));
    });
    if (!assignments.length) return;

    for (const assignment of assignments) {
        const pool = Array.from(stage.querySelectorAll<HTMLElement>('.tb-cat-pool .tb-cat-chip'));
        const chip = findMatch(pool, assignment.item);
        if (!chip) continue;
        const group = findMatch(groups.map(entry => entry.element), assignment.category);
        if (!group) continue;
        clickElement(chip);
        await wait(50);
        clickElement(group);
        await wait(70);
    }
    await wait(120);
    clickSubmit();
}

function answerIsTrue(value: string): boolean | null {
    const text = I.normalizeText(value);
    if (/^(правда|так|true|1|вірно)/.test(text)) return true;
    if (/^(неправда|хиба|ні|false|0|невірно)/.test(text)) return false;
    return null;
}

async function applyTrueFalse(answerText: string, stage: HTMLElement): Promise<void> {
    const rows = Array.from(stage.querySelectorAll<HTMLElement>('.tb-tf-row'));
    if (!rows.length) return;
    const keyed = new Map<number, string>();
    answerText.split(/[;\n]+/).forEach((line, index) => {
        const match = stripNumbering(line).match(/^(\d+)\s*[=:.)-]\s*(.+)$/);
        if (match) keyed.set(parseInt(match[1], 10) - 1, cleanAnswer(match[2]));
        else if (line.trim()) keyed.set(index, cleanAnswer(line));
    });
    for (let index = 0; index < rows.length; index++) {
        const raw = keyed.get(index);
        if (raw == null) continue;
        const value = answerIsTrue(raw);
        if (value == null) continue;
        const button = rows[index].querySelector<HTMLButtonElement>(value ? '.tb-tf-btn.is-true' : '.tb-tf-btn.is-false');
        clickElement(button);
        await wait(40);
    }
    await wait(120);
    clickSubmit();
}

async function applyHangman(answerText: string): Promise<void> {
    const word = firstAnswerLine(answerText);
    if (!word) return;
    let input = document.querySelector<HTMLInputElement>('.tb-mode-hang .tb-big-input');
    if (!input) {
        const knowWord = Array.from(document.querySelectorAll<HTMLButtonElement>('.tb-mode-hang button'))
            .find(button => /знаю слово|ввести слово/i.test(button.textContent || ''));
        if (knowWord) clickElement(knowWord);
        await wait(100);
        input = document.querySelector<HTMLInputElement>('.tb-mode-hang .tb-big-input');
    }
    if (!input) return;
    setNativeValue(input, word);
    await wait(80);
    clickSubmit();
}

async function applyAnagram(answerText: string): Promise<void> {
    const word = firstAnswerLine(answerText).toUpperCase().replace(/[^\p{L}]/gu, '');
    if (!word) return;
    const used = new Set<HTMLElement>();
    for (const letter of word) {
        const tiles = Array.from(document.querySelectorAll<HTMLElement>('.tb-tiles .tb-tile'))
            .filter(tile => !used.has(tile) && !tile.hasAttribute('disabled'));
        const tile = tiles.find(candidate => normalize(candidate.textContent).toUpperCase() === letter);
        if (!tile) continue;
        used.add(tile);
        clickElement(tile);
        await wait(45);
    }
    await wait(160);
    clickSubmit();
}

function applyShort(answerText: string): void {
    const input = document.querySelector<HTMLInputElement>('.tb-type-answer .tb-big-input, .tb-big-input');
    if (!input) return;
    const value = firstAnswerLine(answerText);
    if (!value) return;
    setNativeValue(input, value);
    setTimeout(clickSubmit, 80);
}

export function applyBetaAnswer(answerText: string): void {
    const state = getBetaQuestionState();
    if (!state || !questionKeyMatches(state.questionKey)) return;
    const stage = stageRoot();
    if (!stage) return;
    const text = cleanAnswer(answerText);
    if (!text) return;

    if (stage.querySelector('.tb-sky, .tb-maze')) {
        applyArcadeAnswer(answerText, stage);
    } else if (stage.querySelector('.tb-mode-hang')) {
        void applyHangman(answerText);
    } else if (stage.querySelector('.tb-mode-anagram')) {
        void applyAnagram(answerText);
    } else if (stage.querySelector('.tb-fill-select')) {
        applyDropdown(answerText, stage);
    } else if (stage.querySelector('.tb-fill-input')) {
        applyFill(answerText, stage);
    } else if (stage.querySelector('.tb-order')) {
        void applyOrder(answerText);
    } else if (stage.querySelector('.tb-match')) {
        void applyMatch(answerText, stage);
    } else if (stage.querySelector('.tb-cat-groups')) {
        void applyCategorize(answerText, stage);
    } else if (stage.querySelector('.tb-tf-list')) {
        void applyTrueFalse(answerText, stage);
    } else if (stage.querySelector('.tb-answers .tb-answer, .tb-holes .tb-mole')) {
        applyChoices(answerText, stage);
    } else {
        applyShort(answerText);
    }
}

// Re-exported so the DOM entry point can advertise the label pool to callers
// that build image-only prompts.
export const BETA_OPTION_LABELS = LABELS;
