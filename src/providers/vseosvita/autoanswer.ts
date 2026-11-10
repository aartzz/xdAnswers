// src/providers/vseosvita/apply.ts
// Answer application for vseosvita premium formats: clicks, native value sets,
// menu actions and drag simulation driven by the meta captured in ./dom.ts.
// Publishes its API on window.xdAnswers._internal.providerModules.vseosvita.apply.

import type { VseosvitaMeta } from './dom';

export interface VseosvitaApplyApi {
    installCustomApplier(meta: VseosvitaMeta | null | undefined): void;
    makeCustomApplier(meta: VseosvitaMeta): (answerText: string) => void;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.vseosvita = I.providerModules.vseosvita || {});

    function normalize(text: unknown): string {
        return String(text || '').replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function normLower(text: unknown): string {
        return normalize(text).toLowerCase();
    }

    function sleep(ms: number): Promise<void> {
        return new Promise(resolve => window.setTimeout(resolve, ms));
    }

    function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
        const proto = el instanceof HTMLTextAreaElement
            ? window.HTMLTextAreaElement.prototype
            : (el instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function click(el: Element | null | undefined): void {
        if (!el) return;
        (el as HTMLElement).click();
    }

    function dispatchMouse(type: string, x: number, y: number, target: EventTarget = document): void {
        target.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            button: 0,
            buttons: type === 'mouseup' ? 0 : 1
        }));
    }

    function parseKeyedAnswer(answerText: string): Map<string, string> {
        const out = new Map<string, string>();
        if (!answerText) return out;
        const parts = answerText.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        for (const part of parts) {
            const m = part.match(/^([A-Za-z]\d+)\s*[=:\-\u2013\u2014]\s*(.+)$/);
            if (m) out.set(m[1].toUpperCase(), m[2].trim());
        }
        return out;
    }

    function parsePairs(answerText: string): Array<{ left: string; right: string }> {
        const out: Array<{ left: string; right: string }> = [];
        const parts = answerText.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        for (const part of parts) {
            const m = part.match(/^(.+?)\s*(?:=|->|\u2192)\s*(.+)$/);
            if (!m) continue;
            out.push({ left: normalize(m[1]), right: normalize(m[2]) });
        }
        return out;
    }

    function matches(candidate: string, wanted: string): boolean {
        const a = normLower(candidate);
        const b = normLower(wanted);
        if (!a || !b) return false;
        return a === b || a.includes(b) || b.includes(a);
    }

    function findFuzzy<T>(items: T[], getText: (item: T) => string, wanted: string): T | null {
        const exact = items.find(item => normLower(getText(item)) === normLower(wanted));
        if (exact) return exact;
        return items.find(item => matches(getText(item), wanted)) || null;
    }

    // ── true/false statement buttons ─────────────────────────────────
    function applyTrueFalse(meta: VseosvitaMeta, answerText: string): void {
        const buttons: any[] = meta.buttons || [];
        const answer = normalize(answerText.split(/[;\n]/)[0] || answerText);

        // The runtime type 12 is a single-choice list of statements. First try
        // the exact statement text, then the legacy truthy/falsy class mapping.
        let target = findFuzzy(buttons, b => b.text, answer)?.element as Element | null;
        if (!target) {
            const letter = answer.match(/^[A-ZА-ЯІЇЄҐ]$/i)?.[0];
            if (letter) {
                const idx = letter.toUpperCase().charCodeAt(0) - 65;
                target = buttons[idx]?.element || null;
            }
        }

        const norm = normLower(answer);
        const truthy = /(^|\s)(правда|так|вірно|істина|true|yes)(\s|$)/;
        const falsy = /(^|\s)(неправда|ні|невірно|хибно|хиба|хибне|false|no)(\s|$)/;
        if (!target && truthy.test(norm)) {
            target = buttons.find(b => b.element.classList.contains('green'))?.element || null;
        }
        if (!target && falsy.test(norm)) {
            target = buttons.find(b => b.element.classList.contains('red'))?.element || null;
        }
        click(target);
    }

    // ── text inputs ──────────────────────────────────────────────────
    function applyTextInputSingle(meta: VseosvitaMeta, answerText: string): void {
        const map = parseKeyedAnswer(answerText);
        const input = meta.inputs?.[0]?.element;
        if (input) setNativeValue(input, map.values().next().value || answerText);
    }

    function applyTextInputMulti(meta: VseosvitaMeta, answerText: string): void {
        const map = parseKeyedAnswer(answerText);
        const parts = map.size
            ? Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'uk')).map(([, value]) => value)
            : answerText.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        (meta.inputs || []).forEach((field: any, idx: number) => {
            const val = parts[idx];
            if (val != null && field.element) setNativeValue(field.element, val);
        });
    }

    // ── fill-in-the-gap inputs ───────────────────────────────────────
    function applyFillBlanks(meta: VseosvitaMeta, answerText: string): void {
        const map = parseKeyedAnswer(answerText);
        (meta.blanks || []).forEach((blank: any) => {
            const val = map.get(String(blank.key).toUpperCase());
            if (val == null) return;
            const live = meta.vrQuest?.querySelector(`.vr-fill-the-gap[data-key="${CSS.escape(String(blank.key))}"]`) || blank.element;
            if (!live) return;
            const input = live.querySelector('input[type="text"], input[data-key], textarea') as HTMLInputElement | HTMLTextAreaElement | null;
            if (input) {
                setNativeValue(input, val);
                input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            } else {
                live.setAttribute('contenteditable', 'true');
                live.textContent = val;
                live.dispatchEvent(new Event('input', { bubbles: true }));
                live.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    // ── select-in-the-gap dropdowns ──────────────────────────────────
    function applySelectInText(meta: VseosvitaMeta, answerText: string): void {
        const map = parseKeyedAnswer(answerText);
        (meta.blanks || []).forEach((blank: any) => {
            const val = map.get(String(blank.key).toUpperCase());
            if (val == null) return;
            const live = meta.vrQuest?.querySelector(`.vr-fill-the-gap-select[data-key="${CSS.escape(String(blank.key))}"]`) || blank.element;
            const select = (live?.querySelector('select') || blank.select) as HTMLSelectElement | null;
            if (select) {
                const options = Array.from(select.options);
                const wanted = normLower(val);
                const option = options.find(o => normLower(o.textContent) === wanted)
                    || options.find(o => matches(o.textContent, val))
                    || options[Number(val)];
                if (option) setNativeValue(select, option.value);
                return;
            }
            // Static preview fallback: make the visible span show the answer.
            if (live) {
                live.setAttribute('contenteditable', 'true');
                live.textContent = val;
                live.dispatchEvent(new Event('input', { bubbles: true }));
                live.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    // ── drag helpers ────────────────────────────────────────────────
    async function dragTo(source: Element, clientX: number, clientY: number): Promise<void> {
        const rect = source.getBoundingClientRect();
        const sx = rect.left + rect.width / 2;
        const sy = rect.top + rect.height / 2;
        dispatchMouse('mousedown', sx, sy, source);
        await sleep(30);
        for (let step = 1; step <= 8; step++) {
            const x = sx + ((clientX - sx) * step) / 8;
            const y = sy + ((clientY - sy) * step) / 8;
            dispatchMouse('mousemove', x, y, document);
            await sleep(20);
        }
        dispatchMouse('mouseup', clientX, clientY, document);
        await sleep(180);
    }

    async function reorderTokenRow(row: Element, wanted: string[]): Promise<void> {
        if (!wanted.length) return;
        const liveTokens = (): Element[] => Array.from(row.querySelectorAll('.word-queue-test_question_sentence-item'));

        for (let targetIndex = 0; targetIndex < wanted.length; targetIndex++) {
            const tokens = liveTokens();
            if (targetIndex >= tokens.length) break;
            const wantedText = wanted[targetIndex];
            const fromIndex = tokens.findIndex((token, idx) => idx >= targetIndex && matches(token.textContent || '', wantedText));
            if (fromIndex < 0 || fromIndex === targetIndex) continue;
            const source = tokens[fromIndex];
            const target = tokens[targetIndex];
            const rect = target.getBoundingClientRect();
            // Drop on the left half of the target token so SortableJS inserts
            // the dragged token before it.
            await dragTo(source, rect.left + rect.width * 0.25, rect.top + rect.height / 2);
        }
    }

    async function applyOrderWords(meta: VseosvitaMeta, answerText: string): Promise<void> {
        const scope = meta.vrQuest || document;
        const rowMetas: any[] = meta.rows || [];
        const rows: Element[] = rowMetas.length
            ? rowMetas.map(row => row.element).filter(Boolean)
            : [scope.querySelector('.word-queue-test_question_sentence-row')].filter(Boolean) as Element[];
        if (!rows.length) return;

        const cleanLine = (line: string): string => normalize(line.replace(/^рядок\s*\d+\s*[:.)-]?\s*/i, ''));
        const lines = answerText.split(/\n|\|/).map(cleanLine).filter(Boolean);
        const flat = answerText.split(/[;\n]/).map(s => normalize(s)).filter(Boolean);
        if (!flat.length) return;

        let sequences: string[][] = [flat];
        if (rows.length > 1 && lines.length === rows.length) {
            sequences = lines.map(line => line.split(/[;,]/).map(s => normalize(s)).filter(Boolean));
        } else if (rows.length > 1) {
            // The model may return one flat semicolon list. Split it between
            // rows using the number of tokens each row actually contains.
            const counts = rowMetas.map(row => row.tokens?.length || 0);
            const total = counts.reduce((sum, count) => sum + count, 0);
            if (total === flat.length) {
                let cursor = 0;
                sequences = counts.map(count => {
                    const part = flat.slice(cursor, cursor + count);
                    cursor += count;
                    return part;
                });
            }
        }

        for (let i = 0; i < rows.length; i++) {
            await reorderTokenRow(rows[i], sequences[i] || []);
        }
    }

    // ── queue ordering (up/down arrows) ─────────────────────────────
    async function applyQueueOrdering(meta: VseosvitaMeta, answerText: string): Promise<void> {
        const scope = meta.vrQuest || document;
        const parts = answerText.split(/[;\n]/).map(s => normalize(s)).filter(Boolean);
        if (!parts.length) return;

        const getBlocks = (): Element[] => Array.from(scope.querySelectorAll('.row_draggable-question .v-test-questions-select-block, .draggable-question-box .v-test-questions-select-block, .v-test-questions-select-block'));

        // Accept a plain sequence of numbers as positions as well as item text.
        let wanted = parts;
        if (parts.every(part => /^\d+$/.test(part))) {
            const sourceItems = meta.items || [];
            wanted = parts.map(part => sourceItems[Number(part) - 1]?.text).filter(Boolean);
        }

        for (let targetIndex = 0; targetIndex < wanted.length; targetIndex++) {
            let blocks = getBlocks();
            if (targetIndex >= blocks.length) break;
            let currentIndex = blocks.findIndex(block => matches(block.querySelector('.t-text-guest, .t-text')?.textContent || '', wanted[targetIndex]));
            if (currentIndex < 0) {
                const fuzzy = findFuzzy(blocks, block => block.querySelector('.t-text-guest, .t-text')?.textContent || '', wanted[targetIndex]);
                currentIndex = fuzzy ? blocks.indexOf(fuzzy) : -1;
            }
            if (currentIndex < 0) continue;

            // Compatibility with the old select-based type 8 layout.
            const currentSelect = blocks[currentIndex]?.querySelector('select') as HTMLSelectElement | null;
            if (currentSelect) {
                setNativeValue(currentSelect, String(targetIndex + 1));
                continue;
            }

            let guard = 0;
            while (currentIndex > targetIndex && guard++ < blocks.length + 2) {
                blocks = getBlocks();
                const block = blocks[currentIndex];
                const up = block?.querySelector('a[title="Поставити вище"], button[title="Поставити вище"], .vr-queue-select a:first-child');
                if (!up) break;
                click(up);
                await sleep(120);
                blocks = getBlocks();
                const nextIndex = blocks.findIndex(item => matches(item.querySelector('.t-text-guest, .t-text')?.textContent || '', wanted[targetIndex]));
                currentIndex = nextIndex < 0 ? currentIndex - 1 : nextIndex;
            }
        }
    }

    // ── free response (ProseMirror / textarea) ──────────────────────
    function applyFreeResponse(meta: VseosvitaMeta, answerText: string): void {
        let target = meta.element as HTMLElement | null;
        if (!target || !target.isConnected) {
            target = (meta.vrQuest?.querySelector('.a-test-lab-inp .ProseMirror[contenteditable="true"], .ProseMirror[contenteditable="true"], .a-test-lab-inp [contenteditable="true"], textarea') || null) as HTMLElement | null;
        }
        if (!target) return;

        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            setNativeValue(target as HTMLTextAreaElement | HTMLInputElement, answerText);
            return;
        }

        target.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        selection?.removeAllRanges();
        selection?.addRange(range);
        let inserted = false;
        try {
            inserted = document.execCommand('insertText', false, answerText);
        } catch {
            inserted = false;
        }
        if (!inserted || normalize(target.textContent) !== normalize(answerText)) {
            target.textContent = answerText;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    // ── matching: cross-pair columns ────────────────────────────────
    function crossItems(meta: VseosvitaMeta): { left: any[]; right: any[] } {
        const wrapper = meta.vrQuest?.querySelector('.v-block-answers-cross-wrapper')
            || document.querySelector('.v-block-answers-cross-wrapper');
        if (!wrapper) return { left: [], right: [] };
        const row = wrapper.querySelector('.v-block-answers-cross_row:not(.overflow)') || wrapper;
        const columns = Array.from(row.querySelectorAll('.v-col-6'));
        const leftCol = columns.find(col => !col.classList.contains('v-col-last')) || columns[0] || null;
        const rightCol = columns.find(col => col.classList.contains('v-col-last')) || columns[1] || null;
        const collect = (col: Element | null): any[] => {
            if (!col) return [];
            return Array.from(col.querySelectorAll('.v-block-answers-cross-block')).map(block => ({
                key: normalize(block.querySelector('.numb-item')?.textContent),
                text: normalize(block.querySelector('.n-answer-p, p')?.textContent) || normalize(block.textContent),
                element: block
            }));
        };
        return { left: collect(leftCol), right: collect(rightCol) };
    }

    async function applyCrossPairs(meta: VseosvitaMeta, answerText: string): Promise<void> {
        const pairs = parsePairs(answerText);
        const resolve = (items: any[], wanted: string): any | null => {
            const byKey = items.find(item => normLower(item.key) === normLower(wanted));
            return byKey || findFuzzy(items, item => item.text, wanted);
        };

        for (const pair of pairs) {
            const current = crossItems(meta);
            const left = resolve(current.left, pair.left);
            const right = resolve(current.right, pair.right);
            if (!left || !right) continue;

            click(left.element);
            await sleep(140);
            // Re-query the right side: Vue may re-render the column after the
            // first click, invalidating the old element reference.
            const refreshed = crossItems(meta);
            const liveRight = resolve(refreshed.right, pair.right) || right;
            click(liveRight.element);
            await sleep(260);
        }
    }

    // ── matching: MatchQuest drag cards ─────────────────────────────
    function matchQuestCards(meta: VseosvitaMeta): { container: Element | null; left: any[]; right: any[] } {
        const saved = meta.container as Element | null;
        const container: Element | null = (saved && saved.isConnected ? saved : null)
            || meta.vrQuest?.querySelector('.question-match-quest_container')
            || document.querySelector('.question-match-quest_container');
        if (!container) return { container: null, left: [], right: [] };
        const left: any[] = [];
        const right: any[] = [];
        Array.from(container.querySelectorAll(':scope > .card.match-quest_card')).forEach((card: Element) => {
            if (card.closest('.match-quest_card-connected')) return;
            const text = normalize(card.querySelector('.matcher_item-content-box')?.textContent) || normalize(card.textContent);
            if (!text) return;
            if (card.classList.contains('title')) left.push({ text, element: card });
            else if (card.classList.contains('description')) right.push({ text, element: card });
        });
        return { container, left, right };
    }

    async function applyMatchQuestPairs(meta: VseosvitaMeta, answerText: string): Promise<void> {
        const pairs = parsePairs(answerText);
        for (const pair of pairs) {
            const current = matchQuestCards(meta);
            if (!current.container) return;
            const left = findFuzzy(current.left, item => item.text, pair.left);
            const right = findFuzzy(current.right, item => item.text, pair.right);
            if (!left || !right) continue;

            const source = left.element as Element;
            const target = right.element as Element;
            const sourceRect = source.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();

            // MatchQuest compares card left/top, not pointer position. The drag
            // offset equals the pointer offset inside the source card, so moving
            // the pointer to target.left/top + half the source card aligns the
            // two cards exactly.
            const clientX = targetRect.left + sourceRect.width / 2;
            const clientY = targetRect.top + sourceRect.height / 2;
            await dragTo(source, clientX, clientY);
        }
    }

    // ── categorization / word basket ───────────────────────────────
    function parseCategorization(answerText: string): Map<string, string[]> {
        const out = new Map<string, string[]>();
        const segments = answerText.split(/;\s*(?=[А-ЯІЇЄҐA-Z][^:]*:)/);
        for (const seg of segments) {
            const colonIdx = seg.indexOf(':');
            if (colonIdx < 0) continue;
            const category = normalize(seg.slice(0, colonIdx));
            const items = seg.slice(colonIdx + 1).split(/,\s*|\n/).map(s => normalize(s)).filter(Boolean);
            if (category && items.length) out.set(category, items);
        }
        return out;
    }

    async function applyCategorization(meta: VseosvitaMeta, answerText: string): Promise<void> {
        const categoryMap = parseCategorization(answerText);
        if (!categoryMap.size) return;

        const scope = meta.vrQuest || document;
        const getAreas = (): Array<{ title: string; addButton: Element | null; element: Element }> => {
            return Array.from(scope.querySelectorAll('.vr-area_wrap')).map((area, idx) => ({
                title: normalize(area.querySelector('.area_title, .area_title_con')?.textContent) || `Категорія ${idx + 1}`,
                addButton: area.querySelector('.area-add_btn.vr-add, .area-add_btn, .vr-add'),
                element: area
            }));
        };

        for (const [category, items] of categoryMap) {
            let areas = getAreas();
            let area = findFuzzy(areas, a => a.title, category);
            if (!area && /^категорія\s*\d+$/i.test(category)) {
                area = areas[Number(category.match(/\d+/)?.[0]) - 1] || null;
            }
            if (!area?.addButton) continue;

            for (const item of items) {
                areas = getAreas();
                area = findFuzzy(areas, a => a.title, category) || area;
                if (!area?.addButton) break;

                click(area.addButton);
                await sleep(180);

                const menu = scope.querySelector('.dlg_question-sort') || document.querySelector('.dlg_question-sort');
                if (!menu) continue;
                const rows = Array.from(menu.querySelectorAll('tr'));
                const row = rows.find(tr => matches(
                    tr.querySelector('.dlg-text')?.textContent
                    || tr.querySelector('img')?.getAttribute('alt')
                    || tr.querySelector('img')?.getAttribute('title')
                    || tr.textContent
                    || '',
                    item
                ));
                if (!row) continue;
                const plus = row.querySelector('button.dlg-circle_btn.blue, button.dlg-circle_btn, button');
                click(plus);
                await sleep(180);
            }
        }
    }

    // ── range slider ───────────────────────────────────────────────
    function applyRange(meta: VseosvitaMeta, answerText: string): void {
        const numberMatch = answerText.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
        if (!numberMatch) return;
        const target = Number(numberMatch[0]);
        if (!Number.isFinite(target)) return;

        const wrap = meta.element as Element | null;
        const slider = (wrap?.querySelector('.vue-slider') || meta.slider) as HTMLElement | null;
        const dot = (wrap?.querySelector('[role="slider"]') || meta.dot) as HTMLElement | null;
        const rail = (wrap?.querySelector('.vue-slider-rail') || meta.rail) as HTMLElement | null;
        if (!slider || !rail) return;

        const min = Number(dot?.getAttribute('aria-valuemin') ?? meta.min ?? 0);
        const max = Number(dot?.getAttribute('aria-valuemax') ?? meta.max ?? 100);
        if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;

        const clamped = Math.max(min, Math.min(max, target));
        const fraction = (clamped - min) / (max - min);
        const rect = rail.getBoundingClientRect();
        const x = rect.left + rect.width * fraction;
        const y = rect.top + rect.height / 2;

        // VueSlider handles clicks on the slider root.
        slider.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y
        }));
        dot?.focus();
    }

    // ── unsupported interactive formats ────────────────────────────
    function applyFillWordNoop(): void {
        // Fillword/crossword requires cell-level or selection interaction that
        // cannot be reconstructed reliably from an answer string. Keep the
        // default auto-selector from clicking random cells.
    }

    // Central applier dispatcher used as window.xdAnswers._customAutoAnswer.
    function makeCustomApplier(meta: VseosvitaMeta): (answerText: string) => void {
        return function (answerText: string): void {
            if (!answerText || !meta) return;
            const run = async (): Promise<void> => {
                try {
                    switch (meta.formatType) {
                        case 'true_false':       applyTrueFalse(meta, answerText); break;
                        case 'text_input_single':applyTextInputSingle(meta, answerText); break;
                        case 'text_input_multi': applyTextInputMulti(meta, answerText); break;
                        case 'fill_blank':       applyFillBlanks(meta, answerText); break;
                        case 'select_in_text':   applySelectInText(meta, answerText); break;
                        case 'order_words':      await applyOrderWords(meta, answerText); break;
                        case 'ordering_select':  await applyQueueOrdering(meta, answerText); break;
                        case 'categorization':   await applyCategorization(meta, answerText); break;
                        case 'free_response':    applyFreeResponse(meta, answerText); break;
                        case 'match_pairs':
                            if (meta.layout === 'match_quest') await applyMatchQuestPairs(meta, answerText);
                            else await applyCrossPairs(meta, answerText);
                            break;
                        case 'range':            applyRange(meta, answerText); break;
                        case 'fill_word':        applyFillWordNoop(); break;
                    }
                } catch (e) {
                    console.warn('[xdAnswers/vseosvita] customApplier error:', e);
                }
            };
            void run();
        };
    }

    // Formats that need a custom applier. Simple radio/checkbox quizzes still use
    // the generic auto-selector; grid/likert/scale/dropdown are also left to it.
    const CUSTOM_APPLIER_FORMATS = new Set([
        'true_false',
        'text_input_single',
        'text_input_multi',
        'fill_blank',
        'select_in_text',
        'order_words',
        'ordering_select',
        'categorization',
        'match_pairs',
        'free_response',
        'range',
        'fill_word'
    ]);

    function installCustomApplier(meta: VseosvitaMeta | null | undefined): void {
        if (meta && CUSTOM_APPLIER_FORMATS.has(meta.formatType)) {
            window.xdAnswers._customAutoAnswer = makeCustomApplier(meta);
        }
    }

    ns.apply = {
        installCustomApplier,
        makeCustomApplier
    } as VseosvitaApplyApi;
})();
