// src/providers/classtime/autoanswer.ts
// Classtime answer applying for every student question kind. The applier runs
// as window.xdAnswers._customAutoAnswer, so it can use sequential clicks where
// React state has to settle between two interactions (categorizer, sorter, gap
// menus).
import type { ClasstimeQuestionState, ClozeGroup } from './dom/question';
import { elementText, isQuestionCurrent, readClozeGroups } from './dom/question';

function delay(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}

function waitFor<T>(fn: () => T | null, timeout = 800, interval = 40): Promise<T | null> {
    const end = Date.now() + timeout;
    return new Promise<T | null>(resolve => {
        const check = (): void => {
            try {
                const value = fn();
                if (value) { resolve(value); return; }
            } catch (e) { /* keep polling */ }
            if (Date.now() >= end) { resolve(null); return; }
            window.setTimeout(check, interval);
        };
        check();
    });
}

function normalize(value: string | null | undefined): string {
    return window.xdAnswers._internal.normalizeText(value || '');
}

function similarity(a: string, b: string): number {
    return window.xdAnswers._internal.textSimilarity(normalize(a), normalize(b));
}

function cleanAnswerText(value: string): string {
    let text = String(value || '').trim();
    text = text.replace(/^```[a-z0-9_-]*\s*/i, '').replace(/\s*```$/i, '').trim();
    text = text.replace(/^(?:answer|відповідь|ответ)\s*[:：]\s*/i, '').trim();
    text = text.replace(/^\*\*(.*)\*\*$/s, '$1').trim();
    text = text.replace(/^["'«»`]+|["'«»`]+$/g, '').trim();
    return text;
}

function stripLeadingLabel(value: string): string {
    return value
        .replace(/^\s*(?:[A-Za-zА-Яа-яІіЇїЄєҐґ]|\d{1,2})\s*[).:]\s+/, '')
        .replace(/^\s*[-–—]\s*/, '')
        .trim();
}

function splitAnswerParts(answerText: string): string[] {
    return cleanAnswerText(answerText)
        .split(/\s*;\s*|\n+/)
        .map(stripLeadingLabel)
        .filter(Boolean);
}

function parseKeyedAnswer(answerText: string): Map<string, string> {
    const map = new Map<string, string>();
    const segments = cleanAnswerText(answerText).split(/\s*;\s*|\n+/);
    for (const segment of segments) {
        const match = segment.match(/^\s*([A-Za-z]\d+)\s*[=:]\s*(.+)$/);
        if (!match) continue;
        map.set(match[1].toUpperCase(), match[2].trim());
    }
    return map;
}

function keyedValue(map: Map<string, string>, key: string, fallback: string[], index: number): string {
    if (map.size > 0) return map.get(key) || '';
    return fallback[index] || '';
}

function currentBody(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-testid="questions-answers-list"]');
}

function highlightElement(el: Element | null | undefined): void {
    if (!(el instanceof HTMLElement)) return;
    el.classList.add('xd-highlight-correct');
    el.style.setProperty('outline', '3px solid #22c55e', 'important');
    el.style.setProperty('background-color', 'rgba(34, 197, 94, 0.15)', 'important');
    el.style.setProperty('border-radius', '4px', 'important');
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const proto = el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

function checkboxOf(el: ParentNode): HTMLInputElement | null {
    return el.querySelector<HTMLInputElement>('input[type="checkbox"], input[type="radio"]');
}

// ── choice / boolean ────────────────────────────────────────────────────────

function applyChoice(state: ClasstimeQuestionState, answerText: string, canApply: boolean, canHighlight: boolean): void {
    const body = currentBody();
    if (!body) return;

    const wrappers = Array.from(body.querySelectorAll<HTMLElement>('[data-testid="choice-wrapper"]'));
    if (!wrappers.length) return;

    let matched = window.xdAnswers._internal.matchAnswerToOptions(cleanAnswerText(answerText), wrappers);
    if (!matched.length) {
        matched = window.xdAnswers._internal.matchAnswerToOptions(stripLeadingLabel(cleanAnswerText(answerText)), wrappers);
    }
    if (!matched.length) {
        // Image-only choices are represented as "[зображення N]" in the AI
        // payload, so map an exact placeholder back to its rendered wrapper.
        const answer = normalize(cleanAnswerText(answerText));
        if (answer) {
            const index = state.options.findIndex(option => {
                const candidate = normalize(option);
                return candidate === answer || candidate.includes(answer) || answer.includes(candidate);
            });
            if (index >= 0 && wrappers[index]) matched = [wrappers[index]];
        }
    }
    let targets = Array.from(new Set(matched))
        .map(el => el.closest<HTMLElement>('[data-testid="choice-wrapper"]') || el)
        .filter((el): el is HTMLElement => el instanceof HTMLElement);
    if (!state.isMulti) targets = targets.slice(0, 1);

    if (canHighlight) {
        for (const target of targets) highlightElement(target);
    }
    if (!canApply || !targets.length) return;

    if (state.isMulti) {
        for (const wrapper of wrappers) {
            const input = checkboxOf(wrapper);
            if (input && input.checked && targets.indexOf(wrapper) === -1) input.click();
        }
    }
    for (const target of targets) {
        const input = checkboxOf(target);
        if (input) {
            if (!input.checked) input.click();
        } else {
            (target.querySelector<HTMLElement>('label') || target).click();
        }
    }
}

// ── text / essay ────────────────────────────────────────────────────────────

function applyText(answerText: string, canApply: boolean, canHighlight: boolean): void {
    const body = currentBody();
    if (!body) return;
    const target = body.querySelector<HTMLTextAreaElement>('[data-testid="student-answer-area"] textarea')
        || body.querySelector<HTMLTextAreaElement>('[data-testid="student-test-question-area"] textarea')
        || body.querySelector<HTMLTextAreaElement>('textarea');
    if (!target) return;

    if (canHighlight) highlightElement(target);
    if (canApply) setNativeValue(target, cleanAnswerText(answerText));
}

function insertEssayText(editor: HTMLElement, value: string): void {
    const text = cleanAnswerText(value);
    editor.focus();

    try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
    } catch (e) { /* selection is optional */ }

    const before = (editor.innerText || '').trim();
    let inserted = false;
    try {
        inserted = document.execCommand('insertText', false, text);
    } catch (e) { /* fall back to InputEvent below */ }

    if (!inserted || (editor.innerText || '').trim() === before) {
        try {
            const event = new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: text
            });
            editor.dispatchEvent(event);
        } catch (e) { /* old engine without InputEvent constructor */ }
    }
}

function applyEssay(answerText: string, canApply: boolean, canHighlight: boolean): void {
    const body = currentBody();
    if (!body) return;
    const editor = body.querySelector<HTMLElement>('[data-testid="essay-input-field"] [data-slate-editor="true"], [data-testid="slate-content-editable"] [contenteditable="true"], [data-slate-editor="true"]');
    if (!editor) return;

    if (canHighlight) highlightElement(editor);
    if (canApply) insertEssayText(editor, answerText);
}

// ── categorizer ─────────────────────────────────────────────────────────────

interface CategoryMapping {
    category: string;
    item: string;
}

function parseCategoryMappings(answerText: string): CategoryMapping[] {
    const mappings: CategoryMapping[] = [];
    const clean = cleanAnswerText(answerText);
    const blocks = clean.split(/\s*;\s*|\n+/).map(value => value.trim()).filter(Boolean);
    let currentCategory = '';

    for (const block of blocks) {
        const colon = block.indexOf(':');
        if (colon > 0) {
            const category = block.slice(0, colon).replace(/^(?:категорія|category)\s*/i, '').trim();
            const items = block.slice(colon + 1).split(',').map(value => value.trim()).filter(Boolean);
            if (!category) continue;
            currentCategory = category;
            for (const item of items) mappings.push({ category, item });
            continue;
        }

        const arrow = block.split(/→|->|=>|—/);
        if (arrow.length >= 2) {
            mappings.push({ category: stripLeadingLabel(arrow[1]), item: stripLeadingLabel(arrow[0]) });
            continue;
        }

        // A model sometimes lists items for the same category on separate
        // semicolon-separated lines: "Category A: item1; item2".
        if (currentCategory) {
            const items = block.split(',').map(value => value.trim()).filter(Boolean);
            for (const item of items) mappings.push({ category: currentCategory, item });
        }
    }

    // A second format many models produce: "item = category".
    if (!mappings.length) {
        for (const block of blocks) {
            const equal = block.indexOf('=');
            if (equal <= 0) continue;
            mappings.push({
                category: stripLeadingLabel(block.slice(equal + 1)),
                item: stripLeadingLabel(block.slice(0, equal))
            });
        }
    }
    return mappings;
}

function findBestTextIndex(value: string, list: string[], used: Set<number>): number {
    const needle = normalize(value);
    if (!needle) return -1;
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < list.length; i++) {
        if (used.has(i)) continue;
        const candidate = normalize(list[i]);
        if (!candidate) continue;
        if (candidate === needle) return i;
        const score = Math.max(similarity(candidate, needle), candidate.includes(needle) ? 0.8 : 0);
        if (score > bestScore) { bestScore = score; best = i; }
    }
    return bestScore >= 0.6 ? best : -1;
}

function findListIndex(value: string, list: string[], used: Set<number>): number {
    const trimmed = value.trim();
    if (/^[a-z]$/i.test(trimmed)) {
        const index = trimmed.toUpperCase().charCodeAt(0) - 65;
        if (index >= 0 && index < list.length && !used.has(index)) return index;
    }
    if (/^\d{1,2}$/.test(trimmed)) {
        const index = Number(trimmed) - 1;
        if (index >= 0 && index < list.length && !used.has(index)) return index;
    }
    return findBestTextIndex(value, list, used);
}

function cellIsChecked(cell: Element): boolean {
    const input = cell.querySelector<HTMLInputElement>('input[type="checkbox"], input[type="radio"]');
    if (input) return input.checked;
    return cell.getAttribute('aria-checked') === 'true' || cell.getAttribute('data-checked') === 'true';
}

function cellInputClicked(cell: Element): void {
    // The grid cell itself owns the click handler; the checkbox inside it is
    // only a visual control, so click the cell and let React update the answer.
    (cell as HTMLElement).click();
}

async function applyCategorization(answerText: string, canApply: boolean, canHighlight: boolean): Promise<void> {
    const form = document.querySelector<HTMLElement>('[data-testid="student-categorizer-answers-form"]');
    if (!form) return;

    const headers = Array.from(form.querySelectorAll<HTMLElement>('[data-testid="category-header-cell"]'))
        .map(cell => elementText(cell));
    const rows = Array.from(form.querySelectorAll<HTMLElement>('tr[data-testid="question-answer-row"]'));
    if (!headers.length || !rows.length) return;

    const rowItems = rows.map(row => elementText(row.querySelector('th')));
    const mappings = parseCategoryMappings(answerText);
    if (!mappings.length) return;

    const desired = new Map<number, Set<number>>();
    for (const mapping of mappings) {
        const rowIndex = findListIndex(mapping.item, rowItems, new Set());
        const colIndex = findListIndex(mapping.category, headers, new Set());
        if (rowIndex < 0 || colIndex < 0) continue;
        if (!desired.has(rowIndex)) desired.set(rowIndex, new Set());
        desired.get(rowIndex)!.add(colIndex);
    }
    if (!desired.size) return;

    if (canHighlight) {
        desired.forEach((columns, rowIndex) => {
            const cells = rows[rowIndex].querySelectorAll<HTMLElement>('[data-testid="question-answer-cell"]');
            columns.forEach(column => highlightElement(cells[column]));
        });
    }
    if (!canApply) return;

    for (const [rowIndex, columns] of desired) {
        const row = rows[rowIndex];
        const cells = row.querySelectorAll<HTMLElement>('[data-testid="question-answer-cell"]');
        for (const column of columns) {
            const cell = cells[column];
            if (!cell) continue;
            if (!cellIsChecked(cell)) {
                cellInputClicked(cell);
                await delay(70);
            }
        }
    }
}

// ── sorter ──────────────────────────────────────────────────────────────────

interface SorterItem {
    element: HTMLElement;
    text: string;
}

function sorterItems(): SorterItem[] {
    const body = currentBody();
    if (!body) return [];
    return Array.from(body.querySelectorAll<HTMLElement>('[data-testid="student-sorter-choice-wrapper"]')).map(wrapper => {
        const content = wrapper.querySelector<HTMLElement>('[data-testid="student-sorter-choice-content"]');
        return { element: wrapper, text: elementText(content || wrapper) };
    });
}

async function applySorter(answerText: string, canApply: boolean, canHighlight: boolean): Promise<void> {
    const items = sorterItems();
    if (!items.length) return;

    const parts = splitAnswerParts(answerText);
    const used = new Set<number>();
    const desired: SorterItem[] = [];
    for (const part of parts) {
        const index = findListIndex(part, items.map(item => item.text), used);
        if (index < 0) continue;
        used.add(index);
        desired.push(items[index]);
    }

    if (canHighlight) desired.forEach(item => highlightElement(item.element));
    if (!canApply || desired.length !== items.length) return;

    for (let target = 0; target < desired.length; target++) {
        let guard = 0;
        while (guard++ < items.length * 2) {
            const current = sorterItems();
            const wanted = desired[target];
            let index = current.findIndex(item => item.element === wanted.element);
            if (index < 0) index = current.findIndex(item => normalize(item.text) === normalize(wanted.text));
            if (index < 0 || index === target) break;

            const button = index > target
                ? current[index].element.querySelector<HTMLButtonElement>('[data-testid="student-sorter-choice-move-up"]')
                : current[index].element.querySelector<HTMLButtonElement>('[data-testid="student-sorter-choice-move-down"]');
            if (!button || button.disabled) break;
            button.click();
            const moved = await waitFor(() => {
                const after = sorterItems();
                const afterIndex = after.findIndex(item => item.element === wanted.element
                    || normalize(item.text) === normalize(wanted.text));
                return afterIndex >= 0 && afterIndex !== index ? after : null;
            }, 700);
            if (!moved) break;
        }
    }
}

// ── highlight-text (cloze) ──────────────────────────────────────────────────

function clozeLabelText(label: HTMLElement): string {
    return elementText(label.querySelector('[data-testid="highlight-text-choice-content"]') || label);
}

function clozeGroups(): ClozeGroup[] {
    const body = currentBody();
    return body ? readClozeGroups(body) : [];
}

function clozeLabels(group: ClozeGroup): HTMLElement[] {
    return Array.from(group.element.querySelectorAll<HTMLElement>('[data-testid="highlight-text-choice"]'))
        .filter(label => label.parentElement === group.element);
}

async function clickClozeLabel(label: HTMLElement): Promise<void> {
    const input = label.querySelector<HTMLInputElement>('input[type="checkbox"], input[type="radio"]');
    if (input) input.click();
    else label.click();
    await delay(35);
}

async function applyCloze(answerText: string, canApply: boolean, canHighlight: boolean): Promise<void> {
    const groups = clozeGroups();
    if (!groups.length) return;

    const keyed = parseKeyedAnswer(answerText);
    const fallback = splitAnswerParts(answerText);

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const raw = keyedValue(keyed, group.key, fallback, i);
        if (!raw) continue;

        const labels = clozeLabels(group);
        const texts = labels.map(clozeLabelText);
        const desiredIndexes = new Set<number>();

        // Try a multi-answer value first ("choice1, choice2"). A single choice
        // may itself contain a comma, so fall back to the whole value when a
        // comma-separated split does not match every part.
        const parts = raw.split(/\s*,\s*|\s*\|\s*/).map(value => value.trim()).filter(Boolean);
        if (parts.length > 1) {
            const matched = new Set<number>();
            let allMatched = true;
            for (const part of parts) {
                const index = findBestTextIndex(part, texts, matched);
                if (index < 0) { allMatched = false; break; }
                matched.add(index);
            }
            if (allMatched) matched.forEach(index => desiredIndexes.add(index));
        }
        if (!desiredIndexes.size) {
            const rawIndex = findBestTextIndex(raw, texts, new Set());
            if (rawIndex >= 0) desiredIndexes.add(rawIndex);
        }

        if (canHighlight) desiredIndexes.forEach(index => highlightElement(labels[index]));
        if (!canApply || !desiredIndexes.size) continue;

        for (let index = 0; index < labels.length; index++) {
            const input = labels[index].querySelector<HTMLInputElement>('input[type="checkbox"], input[type="radio"]');
            const checked = input ? input.checked : false;
            if (desiredIndexes.has(index) && !checked) await clickClozeLabel(labels[index]);
            else if (!desiredIndexes.has(index) && checked) await clickClozeLabel(labels[index]);
        }
    }
}

// ── fill-in-the-gap ─────────────────────────────────────────────────────────

async function openGapMenu(wrapper: HTMLElement, index: number): Promise<HTMLElement | null> {
    const button = wrapper.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
    if (!button) return null;
    if (button.getAttribute('aria-expanded') !== 'true') button.click();
    const menuId = button.getAttribute('aria-controls') || `gap-${index + 1}-choices`;
    return waitFor(() => document.getElementById(menuId), 700);
}

function closeGapMenu(menu: HTMLElement | null): void {
    if (!menu) return;
    menu.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true
    }));
}

function gapWrappers(): HTMLElement[] {
    const body = currentBody();
    if (!body) return [];
    return Array.from(body.querySelectorAll<HTMLElement>('[data-testid="fitg-pointer-choice"], [data-testid="fitg-pointer-blank"]'));
}

async function applyGap(answerText: string, canApply: boolean, canHighlight: boolean): Promise<void> {
    const wrappers = gapWrappers();
    if (!wrappers.length) return;

    const keyed = parseKeyedAnswer(answerText);
    const fallback = splitAnswerParts(answerText);

    for (let i = 0; i < wrappers.length; i++) {
        const wrapper = wrappers[i];
        const raw = keyedValue(keyed, `A${i}`, fallback, i);
        if (!raw) continue;
        const value = stripLeadingLabel(raw);

        if (wrapper.getAttribute('data-testid') === 'fitg-pointer-blank') {
            const textarea = wrapper.querySelector<HTMLTextAreaElement>('textarea');
            if (!textarea) continue;
            if (canHighlight) highlightElement(wrapper);
            if (canApply) setNativeValue(textarea, value);
            continue;
        }

        const menu = await openGapMenu(wrapper, i);
        if (!menu) continue;
        const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
        const index = findBestTextIndex(value, items.map(item => elementText(item)), new Set());
        if (index < 0) {
            closeGapMenu(menu);
            await delay(40);
            continue;
        }
        if (canHighlight) highlightElement(items[index]);
        if (canApply) {
            items[index].click();
            await delay(120);
        } else {
            closeGapMenu(menu);
            await delay(40);
        }
    }
}

// ── hotspot ─────────────────────────────────────────────────────────────────

interface HotspotPoint {
    x: number;
    y: number;
}

function parseHotspotPoints(answerText: string): HotspotPoint[] {
    const points: HotspotPoint[] = [];
    const sections = cleanAnswerText(answerText)
        .replace(/%/g, '')
        .split(/\s*;\s*|\n+/)
        .map(value => value.trim())
        .filter(Boolean);
    for (const section of sections) {
        const pair = section.match(/(-?\d{1,3}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
        if (pair) {
            const x = Number(pair[1].replace(',', '.'));
            const y = Number(pair[2].replace(',', '.'));
            if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
            continue;
        }
        const xMatch = section.match(/x\s*[=:]\s*(-?\d{1,3}(?:[.,]\d+)?)/i);
        const yMatch = section.match(/y\s*[=:]\s*(-?\d{1,3}(?:[.,]\d+)?)/i);
        if (xMatch && yMatch) {
            const x = Number(xMatch[1].replace(',', '.'));
            const y = Number(yMatch[1].replace(',', '.'));
            if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
        }
    }
    return points
        .map(point => ({ x: Math.max(0, Math.min(100, point.x)), y: Math.max(0, Math.min(100, point.y)) }))
        .slice(0, 20);
}

function clickHotspot(image: HTMLImageElement, point: HotspotPoint): void {
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const clientX = rect.left + rect.width * point.x / 100;
    const clientY = rect.top + rect.height * point.y / 100;
    const base = {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button: 0,
        view: window
    };
    const pointer = (type: string, buttons: number): void => {
        try {
            image.dispatchEvent(new PointerEvent(type, {
                ...base,
                buttons,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true
            }));
        } catch (e) {
            image.dispatchEvent(new MouseEvent(type, { ...base, buttons }));
        }
    };
    pointer('pointerdown', 1);
    image.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    pointer('pointerup', 0);
    image.dispatchEvent(new MouseEvent('mouseup', base));
    image.dispatchEvent(new MouseEvent('click', base));
}

async function applyHotspot(state: ClasstimeQuestionState, answerText: string, canApply: boolean, canHighlight: boolean): Promise<void> {
    const helper = document.querySelector<HTMLElement>('[data-testid="hotspot-image-coordinates-helper"]');
    if (!helper) return;
    const image = helper.querySelector<HTMLImageElement>('img.hotspotImage, img');
    if (!image) return;
    if (canHighlight) highlightElement(image);
    if (!canApply) return;

    const points = parseHotspotPoints(answerText);
    for (let i = 0; i < points.length; i++) {
        if (i > 0 && state.hotspotRequireAll) {
            const addButton = helper.querySelector<HTMLButtonElement>('[data-testid="add-new-point"]');
            if (addButton && !addButton.disabled) {
                addButton.click();
                await delay(60);
            }
        }
        clickHotspot(image, points[i]);
        await delay(90);
    }
}

// ── dispatcher ──────────────────────────────────────────────────────────────

export function applyClasstimeAnswer(state: ClasstimeQuestionState, answerText: string): void {
    if (!state || !answerText || !isQuestionCurrent(state)) return;

    const settings = window.xdAnswers.settings;
    const silentMode = settings.silentMode || '';
    const canApply = !!settings.autoAnswer || silentMode === 'oneclick';
    const canHighlight = !!settings.highlightCorrect && (silentMode === '' || silentMode === 'indicators');
    if (!canApply && !canHighlight) return;

    const run = async (): Promise<void> => {
        switch (state.kind) {
            case 'choice':
            case 'multiple_choice':
                applyChoice(state, answerText, canApply, canHighlight);
                break;
            case 'text':
                applyText(answerText, canApply, canHighlight);
                break;
            case 'essay':
                applyEssay(answerText, canApply, canHighlight);
                break;
            case 'categorization':
            case 'categorization_multiple':
                await applyCategorization(answerText, canApply, canHighlight);
                break;
            case 'sorter':
                await applySorter(answerText, canApply, canHighlight);
                break;
            case 'cloze':
                await applyCloze(answerText, canApply, canHighlight);
                break;
            case 'gap':
                await applyGap(answerText, canApply, canHighlight);
                break;
            case 'hotspot':
                await applyHotspot(state, answerText, canApply, canHighlight);
                break;
        }
    };

    void run().catch(error => console.warn('[xdAnswers/classtime] apply failed:', error));
}
