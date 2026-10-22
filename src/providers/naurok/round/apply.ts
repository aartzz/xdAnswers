// src/providers/naurok/round/apply.ts
// Answer application for the НаУрок олімпіади / конкурси provider: resolves the
// AI answer against the extracted question meta and clicks, types or drags it
// into the page. Publishes its API on
// window.xdAnswers._internal.providerModules['naurok-round'].apply for main.ts.

import type { NaurokRoundMeta, NaurokRoundDomApi, NaurokRoundOption, NaurokRoundRow } from './dom';

export interface NaurokRoundApplyApi {
    applyAnswer(meta: NaurokRoundMeta, answerText: string, questionEl: Element): void;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules['naurok-round'] = I.providerModules['naurok-round'] || {});
    const dom = ns.dom as NaurokRoundDomApi;

    const HL_CLASS = 'xd-highlight-correct';

    interface ChoiceCandidate {
        el: Element;
        text: string;
        value?: string;
    }

    // ---------------------------------------------------------------------
    // Answer resolution helpers
    // ---------------------------------------------------------------------

    function splitRefs(text: unknown): string[] {
        return String(text || '').split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
    }

    function resolveChoice(candidates: ChoiceCandidate[], ref: unknown): ChoiceCandidate | null {
        const text = dom.cleanRef(ref);
        if (!text) return null;
        let m = text.match(/^(?:варіант|вариант|option|variant)?\s*([a-zа-я])\s*[).:]?\s*$/i);
        if (m) {
            const ch = m[1].toLowerCase();
            let idx = 'abcdefghijklmnopqrstuvwxyz'.indexOf(ch);
            if (idx < 0) idx = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя'.indexOf(ch);
            if (idx < 0 && ch === 'с') idx = 2;
            if (idx >= 0 && idx < candidates.length) return candidates[idx];
        }
        m = text.match(/^(\d+)\s*[).]?$/);
        if (m) {
            const i = parseInt(m[1], 10) - 1;
            if (i >= 0 && i < candidates.length) return candidates[i];
        }
        const target = I.normalizeText(text);
        let best: ChoiceCandidate | null = null, bestScore = 0;
        for (const c of candidates) {
            const n = I.normalizeText(c.text);
            if (!n) continue;
            const s = I.textSimilarity(target, n);
            if (s > bestScore) { bestScore = s; best = c; }
        }
        if (best && bestScore >= 0.45) return best;
        for (const c of candidates) {
            const n = I.normalizeText(c.text);
            if (n && target && (n.includes(target) || target.includes(n))) return c;
        }
        return null;
    }

    function parseKeyedPairs(text: unknown): Map<string, string> {
        const map = new Map<string, string>();
        for (const part of splitRefs(text)) {
            const m = part.match(/^([A-Za-z]\d+)\s*[=:\-–—]\s*(.+)$/);
            if (m) map.set(m[1].toUpperCase(), m[2].trim());
        }
        return map;
    }

    function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
            : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
            : window.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, value); else (el as HTMLInputElement).value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function simulateClick(el: Element | null): void {
        if (!el) return;
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        (el as HTMLElement).click();
    }

    function markEl(el: Element | null): void {
        if (!el || !el.classList) return;
        el.classList.add(HL_CLASS);
        const style = (el as HTMLElement).style;
        style.outline = '3px solid #22c55e';
        style.outlineOffset = '2px';
        style.background = 'rgba(34, 197, 94, 0.15)';
        style.borderRadius = '4px';
    }

    function clearHighlights(questionEl: Element): void {
        questionEl.querySelectorAll('.' + HL_CLASS).forEach(el => {
            el.classList.remove(HL_CLASS);
            const style = (el as HTMLElement).style;
            style.outline = '';
            style.outlineOffset = '';
            style.background = '';
            style.borderRadius = '';
        });
    }

    // ---------------------------------------------------------------------
    // Page-world bridge (order/order2 reorder via Angular scope)
    // ---------------------------------------------------------------------

    let msgSeq = 0;
    const pendingMsg = new Map<number, (d: any) => void>();

    window.addEventListener('message', (e: MessageEvent) => {
        const d = e.data;
        if (!d || d.source !== 'xd-naurok-page' || d.cmd !== 'reorder-result') return;
        const cb = pendingMsg.get(d.requestId);
        if (cb) { pendingMsg.delete(d.requestId); cb(d); }
    });

    function requestReorder(order: string[], timeoutMs?: number): Promise<any> {
        return new Promise(resolve => {
            const id = ++msgSeq;
            let done = false;
            pendingMsg.set(id, d => { if (!done) { done = true; resolve(d); } });
            window.postMessage({ source: 'xd-naurok', cmd: 'reorder', requestId: id, order: order }, '*');
            setTimeout(() => {
                if (!done) { done = true; pendingMsg.delete(id); resolve({ ok: false, timeout: true }); }
            }, timeoutMs || 1500);
        });
    }

    function dragMouse(fromEl: Element, toEl: Element): void {
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const startX = a.left + a.width / 2, startY = a.top + a.height / 2;
        const endX = b.left + b.width / 2, endY = b.top + b.height / 2;
        fromEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: startX, clientY: startY, button: 0 }));
        for (let s = 1; s <= 6; s++) {
            const x = startX + (endX - startX) * s / 6;
            const y = startY + (endY - startY) * s / 6;
            document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }));
        }
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, clientX: endX, clientY: endY, button: 0 }));
    }

    // Best-effort fallback for ng-sortable lists (forceFallback mouse dragging).
    function sortableFallbackReorder(listEl: Element, orderedItems: NaurokRoundOption[]): void {
        const desired = orderedItems.map(it => it.el);
        for (let i = 0; i < desired.length; i++) {
            const current = Array.from(listEl.querySelectorAll('li'))[i];
            const item = desired[i];
            if (!current || !item || item === current) continue;
            dragMouse(item, current);
        }
    }

    // ---------------------------------------------------------------------
    // Answer application
    // ---------------------------------------------------------------------

    function applyChoiceList(meta: NaurokRoundMeta, answerText: string, doHighlight: boolean, doApply: boolean): void {
        const used = new Set<NaurokRoundOption>();
        for (const part of splitRefs(answerText)) {
            const cand = resolveChoice(meta.options.filter(o => !used.has(o)), part);
            if (!cand) continue;
            used.add(cand as NaurokRoundOption);
            if (doHighlight) markEl(cand.el);
            if (doApply) simulateClick(cand.el);
        }
    }

    function applyTrueFalse(meta: NaurokRoundMeta, answerText: string, doHighlight: boolean, doApply: boolean): void {
        for (const part of splitRefs(answerText)) {
            const m = part.match(/^(\d+)\s*[).\]]*\s*[=:\-–—]?\s*(.+)$/);
            let row = m && m[1] ? meta.rows[parseInt(m[1], 10) - 1] : null;
            let verdict = m ? m[2] : part;
            if (!row) {
                row = meta.rows.find(r => !r._used) || null;
                verdict = part;
            }
            if (!row) break;
            row._used = true;
            const falsy = /(неправда|невірно|хибно|хиба|\bні\b|\bno\b|\bfalse\b)/i.test(verdict);
            const truthy = /(правда|вірно|істина|\bтак\b|\byes\b|\btrue\b)/i.test(verdict);
            const spans = row.spans || [];
            const span = falsy ? spans[1] : (truthy ? spans[0] : null);
            if (doHighlight) markEl(row.el);
            if (doApply && span) simulateClick(span);
        }
    }

    function resolveRow(meta: NaurokRoundMeta, ref: unknown, usedRows: Set<NaurokRoundRow>): NaurokRoundRow | null {
        const text = dom.cleanRef(ref);
        let m = text.match(/\[?\s*зображення\s*(\d+)\s*\]?/i);
        if (m) return meta.rows[parseInt(m[1], 10) - 1] || null;
        m = text.match(/^(?:рядок\s*)?(\d+)\s*[).]?$/i);
        if (m && meta.rows[parseInt(m[1], 10) - 1]) return meta.rows[parseInt(m[1], 10) - 1];
        let best: NaurokRoundRow | null = null, bestScore = 0;
        for (const r of meta.rows) {
            if (usedRows.has(r)) continue;
            const n = I.normalizeText(r.label);
            if (!n) continue;
            const s = I.textSimilarity(I.normalizeText(text), n);
            if (s > bestScore) { bestScore = s; best = r; }
        }
        if (best && bestScore >= 0.45) return best;
        for (const r of meta.rows) {
            if (usedRows.has(r)) continue;
            const n = I.normalizeText(r.label);
            if (n && I.normalizeText(text).includes(n)) return r;
        }
        return null;
    }

    function applyRowVariant(row: NaurokRoundRow, variantRef: unknown, doHighlight: boolean, doApply: boolean): void {
        if (doHighlight) markEl(row.el);
        if (!doApply || !row.select || row._applied) return;
        const cand = resolveChoice((row.options || []).map(o => ({ el: o.el, text: o.text, value: o.value })), variantRef);
        if (!cand) return;
        row._applied = true;
        row.select.value = cand.value as string;
        row.select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function applyMatch(meta: NaurokRoundMeta, answerText: string, doHighlight: boolean, doApply: boolean): void {
        const usedRows = new Set<NaurokRoundRow>();
        const leftovers: string[] = [];
        for (const part of splitRefs(answerText)) {
            const m = part.match(/^(.+?)\s*(?:=|:|->|→|–|—)\s*(.+)$/);
            const row = m ? resolveRow(meta, m[1], usedRows) : null;
            if (!row) { leftovers.push(part); continue; }
            usedRows.add(row);
            applyRowVariant(row, m![2], doHighlight, doApply);
        }
        // AI listed only variants, one per row: assign in order to the next rows
        for (const ref of leftovers) {
            const row = meta.rows.find(r => !usedRows.has(r));
            if (!row) break;
            usedRows.add(row);
            applyRowVariant(row, ref, doHighlight, doApply);
        }
    }

    function applyFill(meta: NaurokRoundMeta, answerText: string, doHighlight: boolean, doApply: boolean): void {
        const pairs = parseKeyedPairs(answerText);
        const positional = splitRefs(answerText);
        meta.inputs.forEach((input, i) => {
            const value = pairs.size ? pairs.get('A' + i) : positional[i];
            if (value == null) return;
            if (doHighlight) markEl(input);
            if (doApply) setNativeValue(input, value);
        });
    }

    function applyShort(meta: NaurokRoundMeta, answerText: string, doHighlight: boolean, doApply: boolean): void {
        const input = meta.inputs[0];
        if (!input) return;
        const value = dom.cleanRef(String(answerText || '').replace(/^[^:]{0,20}(?:відповідь|answer)\s*:\s*/i, ''));
        if (!value) return;
        if (doHighlight) markEl(input);
        if (doApply) setNativeValue(input, value);
    }

    async function applyOrder(meta: NaurokRoundMeta, answerText: string, doHighlight: boolean, doApply: boolean): Promise<void> {
        if (!meta.list) return;
        const items = meta.list.items;
        const used = new Set<NaurokRoundOption>();
        const ordered: NaurokRoundOption[] = [];
        for (const ref of splitRefs(answerText)) {
            const cand = resolveChoice(items.filter(it => !used.has(it)), ref);
            if (cand) { used.add(cand as NaurokRoundOption); ordered.push(cand as NaurokRoundOption); }
        }
        for (const it of items) if (!used.has(it)) ordered.push(it);
        if (doHighlight) ordered.forEach(it => markEl(it.el));
        if (!doApply) return;
        const order = ordered.map(it => dom.itemKey(it.el));
        const reply = await requestReorder(order, 1500);
        if (!reply.ok && meta.type === 'order') {
            sortableFallbackReorder(meta.list.el, ordered);
        }
    }

    function applyAnswer(meta: NaurokRoundMeta, answerText: string, questionEl: Element): void {
        if (!meta || !questionEl || !questionEl.isConnected) return;
        const settings = window.xdAnswers.settings || ({} as XdSettings);
        const silentMode = settings.silentMode || '';
        const curNum = dom.getQuestionNumber();
        if (curNum && meta.qNum && curNum !== meta.qNum) return; // question changed while AI was thinking
        const doApply = settings.autoAnswer || silentMode === 'oneclick';
        const doHighlight = settings.highlightCorrect && silentMode === '';
        if (!doApply && !doHighlight) return;
        clearHighlights(questionEl);
        try {
            const type = meta.type;
            if (type === 'quiz' || type === 'select' || type === 'quiz_image') {
                applyChoiceList(meta, answerText, doHighlight, doApply);
            } else if (type === 'multiquiz' || type === 'multiquiz_image') {
                applyChoiceList(meta, answerText, doHighlight, doApply);
            } else if (type === 'truefalse') {
                applyTrueFalse(meta, answerText, doHighlight, doApply);
            } else if (type === 'short') {
                applyShort(meta, answerText, doHighlight, doApply);
            } else if (type === 'fill') {
                applyFill(meta, answerText, doHighlight, doApply);
            } else if (type === 'match' || type === 'match_image') {
                applyMatch(meta, answerText, doHighlight, doApply);
            } else if (type === 'order' || type === 'order2') {
                applyOrder(meta, answerText, doHighlight, doApply);
            }
        } catch (e) {
            console.warn('[xdAnswers] naurok-round apply failed:', e);
        }
    }

    ns.apply = {
        applyAnswer: applyAnswer
    } as NaurokRoundApplyApi;
})();
