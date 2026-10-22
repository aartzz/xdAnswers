// src/providers/vseosvita/apply.ts
// Answer application for vseosvita premium formats: clicks, native value sets and
// drag-and-drop simulation driven by the meta captured in ./dom.ts. Publishes its
// API on window.xdAnswers._internal.providerModules.vseosvita.apply for main.ts.

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

    // Format normalisation: vseosvita uses a mix of non-breaking spaces and odd whitespace.
    function normalize(text: unknown): string {
        return String(text || '').replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Parse "A0=value; A1=value2" into a Map { 'A0' -> 'value', 'A1' -> 'value2' }
    function parseKeyedAnswer(answerText: string): Map<string, string> {
        const out = new Map<string, string>();
        if (!answerText) return out;
        const parts = answerText.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        for (const part of parts) {
            const m = part.match(/^([A-Za-z]\d+)\s*[=:\-\u2013\u2014]\s*(.+)$/);
            if (m) {
                out.set(m[1].toUpperCase(), m[2].trim());
            }
        }
        return out;
    }

    // Set a text value using the native setter (so Vue/React pick up the change).
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

    function applyTrueFalse(meta: VseosvitaMeta, answerText: string): void {
        const norm = normalize(answerText).toLowerCase();
        // Map Ukrainian/English true-false synonyms to the button classes.
        const truthy = /(^|\s)(правда|так|вірно|істина|true|yes)(\s|$)/;
        const falsy = /(^|\s)(неправда|ні|невірно|хибно|хиба|хибне|false|no)(\s|$)/;
        let target: Element | null = null;
        if (truthy.test(norm)) target = meta.buttons.find((b: any) => b.element.classList.contains('green'))?.element;
        else if (falsy.test(norm)) target = meta.buttons.find((b: any) => b.element.classList.contains('red'))?.element;
        // Fallback: fuzzy text match
        if (!target) {
            const best = meta.buttons.find((b: any) => normalize(b.text).toLowerCase() === norm);
            target = best?.element;
        }
        if (target) {
            (target as HTMLElement).click();
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        }
    }

    function applyTextInputSingle(meta: VseosvitaMeta, answerText: string): void {
        const input = meta.inputs[0]?.element;
        if (input) setNativeValue(input, answerText);
    }

    function applyTextInputMulti(meta: VseosvitaMeta, answerText: string): void {
        // Expect "answer1; answer2; answer3" in provider-order.
        const parts = answerText.split(/;\s*|\n/).map(s => s.trim()).filter(Boolean);
        meta.inputs.forEach((field: any, idx: number) => {
            const val = parts[idx];
            if (val != null && field.element) setNativeValue(field.element, val);
        });
    }

    function applyFillBlanks(meta: VseosvitaMeta, answerText: string): void {
        const map = parseKeyedAnswer(answerText);
        meta.blanks.forEach((blank: any) => {
            const val = map.get(blank.key.toUpperCase());
            if (val == null) return;
            try {
                // At runtime vseosvita injects an <input type="text"> inside
                // the .vr-fill-the-gap span (same data-key). Prefer that.
                // Fallback to contenteditable span (which is what static
                // preview dumps ship before runtime hydration).
                const input = blank.element.querySelector('input[type="text"]');
                if (input) {
                    setNativeValue(input, val);
                    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                } else {
                    blank.element.setAttribute('contenteditable', 'true');
                    blank.element.textContent = val;
                    blank.element.dispatchEvent(new Event('input', { bubbles: true }));
                    blank.element.dispatchEvent(new Event('change', { bubbles: true }));
                    blank.element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                }
            } catch (e) {
                console.warn('[xdAnswers/vseosvita] fill_blank apply failed:', e);
            }
        });
    }

    function applySelectInText(meta: VseosvitaMeta, answerText: string): void {
        // Runtime DOM for type 7 is not fully known from static dumps; best-effort:
        // - Set textContent on the span (visual);
        // - Click the span to open a dropdown (if vseosvita attaches one);
        // - Dispatch input events in case it's contenteditable-backed.
        // NOTE: may need refinement once observed on live vseosvita runtime.
        const map = parseKeyedAnswer(answerText);
        meta.blanks.forEach((blank: any) => {
            const val = map.get(blank.key.toUpperCase());
            if (val == null) return;
            try {
                blank.element.setAttribute('contenteditable', 'true');
                blank.element.textContent = val;
                blank.element.dispatchEvent(new Event('input', { bubbles: true }));
                blank.element.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {
                console.warn('[xdAnswers/vseosvita] select_in_text apply failed:', e);
            }
        });
    }

    function applyOrderWords(meta: VseosvitaMeta, answerText: string): void {
        // AI returns words separated by "; " in the desired order.
        // Click tokens sequentially; vseosvita moves each clicked token to the answer area.
        const wanted = answerText.split(/;\s*|\n/).map(s => normalize(s).toLowerCase()).filter(Boolean);
        const remaining = meta.tokens.slice();
        for (const w of wanted) {
            // Find closest matching token (prefer exact, then substring).
            let hitIdx = remaining.findIndex((t: any) => normalize(t.text).toLowerCase() === w);
            if (hitIdx < 0) {
                hitIdx = remaining.findIndex((t: any) => normalize(t.text).toLowerCase().includes(w) || w.includes(normalize(t.text).toLowerCase()));
            }
            if (hitIdx < 0) continue;
            const token = remaining.splice(hitIdx, 1)[0];
            if (token?.element) {
                (token.element as HTMLElement).click();
                token.element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                token.element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            }
        }
    }

    function applyFreeResponse(meta: VseosvitaMeta, answerText: string): void {
        // Use the element captured at detection time if present, otherwise
        // search the latest DOM (vseosvita renders the textarea lazily for type 18).
        let target = meta.element;
        if (!target && meta.vrQuest) {
            target = meta.vrQuest.querySelector('textarea') || meta.vrQuest.querySelector('[contenteditable="true"]');
        }
        if (!target) return;
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            setNativeValue(target as HTMLTextAreaElement | HTMLInputElement, answerText);
        } else {
            // contenteditable
            target.textContent = answerText;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function applyOrderingSelect(meta: VseosvitaMeta, answerText: string): void {
        // AI returns items separated by "; " in correct order.
        // For each listed item, find matching block and set its <select> or click up-arrow.
        const wanted = answerText.split(/;\s*|\n/).map(s => normalize(s).toLowerCase()).filter(Boolean);
        wanted.forEach((want: string, positionIdx: number) => {
            const hit = meta.items.find((it: any) => {
                const t = normalize(it.text).toLowerCase();
                return t === want || t.includes(want) || want.includes(t);
            });
            if (hit && hit.element) {
                if (hit.element.tagName === 'SELECT') {
                    setNativeValue(hit.element, String(positionIdx + 1));
                } else {
                    const upBtn = hit.element.querySelector('a[title="Поставити вище"], button[title="Поставити вище"]');
                    if (upBtn) (upBtn as HTMLElement).click();
                }
            }
        });
    }

    function applyCategorization(meta: VseosvitaMeta, answerText: string): void {
        // Expected answer format: "Категорія1: елемент1, елемент2; Категорія2: елемент3"
        // Parse the AI response into category -> items mapping
        const categoryMap = new Map<string, string[]>();
        const segments = answerText.split(/;\s*(?=[А-ЯІЇЄҐA-Z][^:]*:)/);
        for (const seg of segments) {
            const colonIdx = seg.indexOf(':');
            if (colonIdx < 0) continue;
            const catName = normalize(seg.slice(0, colonIdx)).toLowerCase();
            const itemsPart = seg.slice(colonIdx + 1);
            const items = itemsPart.split(/,\s*|\n/).map(s => normalize(s).toLowerCase()).filter(Boolean);
            categoryMap.set(catName, items);
        }

        // For each item, find which category it belongs to and simulate drag-and-drop
        meta.items.forEach((item: any) => {
            const itemTextNorm = normalize(item.text).toLowerCase();
            let targetCategoryEl: Element | null = null;

            // Find the category that contains this item
            for (const [catName, catItems] of categoryMap) {
                if (catItems.some((ci: string) => ci === itemTextNorm || itemTextNorm.includes(ci) || ci.includes(itemTextNorm))) {
                    targetCategoryEl = meta.categoryElements.find((c: any) => normalize(c.text).toLowerCase() === catName || normalize(c.text).toLowerCase().includes(catName))?.element;
                    break;
                }
            }

            if (targetCategoryEl && item.element) {
                // Simulate drag-and-drop events
                const itemEl = item.element;
                itemEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                itemEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
                targetCategoryEl.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
                targetCategoryEl.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
                itemEl.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
                itemEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));

                // Fallback: click the item then click the category (some UIs use click-based DnD)
                (itemEl as HTMLElement).click();
                (targetCategoryEl as HTMLElement).click();
            }
        });
    }

    // Central applier dispatcher used as window.xdAnswers._customAutoAnswer.
    function makeCustomApplier(meta: VseosvitaMeta): (answerText: string) => void {
        return function (answerText: string): void {
            if (!answerText || !meta) return;
            try {
                switch (meta.formatType) {
                    case 'true_false':       applyTrueFalse(meta, answerText); break;
                    case 'text_input_single':applyTextInputSingle(meta, answerText); break;
                    case 'text_input_multi': applyTextInputMulti(meta, answerText); break;
                    case 'fill_blank':       applyFillBlanks(meta, answerText); break;
                    case 'select_in_text':   applySelectInText(meta, answerText); break;
                    case 'order_words':      applyOrderWords(meta, answerText); break;
                    case 'ordering_select':  applyOrderingSelect(meta, answerText); break;
                    case 'categorization':   applyCategorization(meta, answerText); break;
                    case 'free_response':    applyFreeResponse(meta, answerText); break;
                }
            } catch (e) {
                console.warn('[xdAnswers/vseosvita] customApplier error:', e);
            }
        };
    }

    // Formats that need a CUSTOM applier (anything other than simple click-a-label
    // or fill-single-textbox, which the default autoSelectAnswer already covers).
    const CUSTOM_APPLIER_FORMATS = new Set([
        'true_false',           // button click (green/red classes) - custom for class-based TRUE/FALSE mapping
        'text_input_multi',     // multiple fields, parse "; "-separated
        'fill_blank',           // contenteditable spans OR inner input[type=text], parse "A0=val"
        'select_in_text',       // contenteditable + runtime dropdown (best-effort)
        'categorization',       // drag-and-drop items into categories
        'ordering_select',      // <select> elements set to position numbers
        'checkbox_grid',        // matrix of checkboxes
        'likert',               // matrix of radio buttons
        'scale',                // linear scale radio buttons
        'dropdown'              // listbox role option clicks
    ]);
    // order_words relies on default autoSelectAnswer (the "; "-split + fuzzy
    // match naturally clicks tokens in answer order).
    // text_input_single and free_response rely on default autoSelectAnswer
    // fallback (it already handles `input[type="text"]` and `textarea`).
    // true_false COULD fall back to default click since both buttons are now
    // data-xd-option tagged, but we keep a custom applier so TRUE/FALSE map
    // unambiguously to the .green/.red button class regardless of button text.

    // Wire a custom applier for premium formats that need it.
    // Runs right before processQuestion() / oneclick-handler-triggered processQuestion.
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
