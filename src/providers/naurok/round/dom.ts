// src/providers/naurok/round/dom.ts
// DOM extraction for the НаУрок олімпіади / конкурси provider (naurok.ua/round/*):
// question text, answer options/rows/inputs and images. Publishes its API on
// window.xdAnswers._internal.providerModules['naurok-round'].dom for apply.ts and main.ts.

export interface NaurokRoundOption {
    el: Element;
    text: string;
}

export interface NaurokRoundRow {
    el: Element;
    num?: number;
    label?: string;
    spans?: Element[];
    select?: HTMLSelectElement | null;
    options?: Array<{ el: HTMLOptionElement; value: string; text: string }>;
    _used?: boolean;
    _applied?: boolean;
}

export interface NaurokRoundList {
    el: Element;
    items: NaurokRoundOption[];
}

export interface NaurokRoundMeta {
    type: string;
    qNum: string;
    questionEl: Element;
    block: Element;
    images: string[];
    inputs: HTMLInputElement[];
    options: NaurokRoundOption[];
    rows: NaurokRoundRow[];
    list: NaurokRoundList | null;
    text: string;
}

export interface NaurokRoundDomApi {
    collectMeta(questionEl: Element): NaurokRoundMeta | null;
    buildQuestionData(meta: NaurokRoundMeta, base64Images: string[]): XdQuestionData;
    getQuestionNumber(): string;
    norm(s: unknown): string;
    cleanRef(text: unknown): string;
    itemKey(el: Element): string;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules['naurok-round'] = I.providerModules['naurok-round'] || {});

    const LETTERS = 'ABCDEFGHIJ';

    function norm(s: unknown): string {
        return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    }

    function cleanRef(text: unknown): string {
        return norm(String(text || '').replace(/[*_`]/g, '').replace(/^["'«„“]+|["'»“”]+$/g, ''));
    }

    function toAbsolute(src: string): string {
        try { return new URL(src, window.location.href).href; } catch (e) { return src; }
    }

    function annotationOf(el: Element | null): Element | null {
        return el && el.querySelector ? el.querySelector('annotation[encoding="application/x-tex"]') : null;
    }

    function katexText(el: Element): string {
        const tex = annotationOf(el);
        return tex ? '$' + norm(tex.textContent) + '$' : '';
    }

    function optionText(el: Element): string {
        const k = katexText(el);
        // Mixed content like "$Cu(OH)_2$ та SO_2": keep both the TeX parts and the
        // plain text around them (textContent would duplicate KaTeX internals).
        if (k || (el.classList && el.classList.contains('katex'))) {
            return richText(el, { images: [], inputs: [] });
        }
        return norm(el.textContent);
    }

    interface RichTextContext {
        images: string[];
        inputs: HTMLInputElement[];
    }

    // Renders a subtree into plain text: KaTeX becomes $tex$, images become [зображення],
    // inputs become [A0]/[A1]/... (registered in ctx.inputs in DOM order).
    function richText(root: Node, ctx: RichTextContext): string {
        const parts: string[] = [];
        const visit = (node: Node): void => {
            if (node.nodeType === 3) {
                const t = norm(node.nodeValue);
                if (t) parts.push(t);
                return;
            }
            if (node.nodeType !== 1) return;
            const el = node as Element;
            const tag = el.tagName;
            if (tag === 'SELECT' || tag === 'BUTTON') return;
            if (tag === 'KATEX' || (el.classList && el.classList.contains('katex') && annotationOf(el))) {
                parts.push(katexText(el));
                return;
            }
            if (tag === 'IMG') {
                const src = el.getAttribute('src') || el.getAttribute('ng-src') || '';
                const real = src.replace(/\{\{[^}]*\}\}/g, '');
                if (real && !real.startsWith('data:') && ctx) ctx.images.push(toAbsolute(real));
                parts.push('[зображення]');
                return;
            }
            if (tag === 'INPUT') {
                if (ctx) {
                    ctx.inputs.push(el as HTMLInputElement);
                    parts.push('[A' + (ctx.inputs.length - 1) + ']');
                }
                return;
            }
            for (const child of Array.from(el.childNodes)) visit(child);
        };
        visit(root);
        return parts.join(' ');
    }

    function getQuestionNumber(): string {
        const el = document.querySelector('.task-name');
        const m = norm(el && el.textContent).match(/№\s*(\d+)/);
        return m ? m[1] : '';
    }

    function blockType(block: Element): string {
        const m = (block.getAttribute('ng-if') || '').match(/isQuestionType\('([a-z_0-9]+)'\)/);
        return m ? m[1] : '';
    }

    function visibleAnswerBlock(questionEl: Element): Element | null {
        const blocks = Array.from(questionEl.querySelectorAll('.sth-question-answers > .answers-list'))
            .filter(b => !b.classList.contains('ng-hide'));
        return blocks[0] || null;
    }

    // ---------------------------------------------------------------------
    // Question extraction
    // ---------------------------------------------------------------------

    function collectMeta(questionEl: Element): NaurokRoundMeta | null {
        const block = visibleAnswerBlock(questionEl);
        if (!block) return null;
        const type = blockType(block);
        if (!type) return null;

        const ctx: RichTextContext = { images: [], inputs: [] };
        const contentEl = questionEl.querySelector('.sth-question-content');
        const meta: NaurokRoundMeta = {
            type: type,
            qNum: getQuestionNumber(),
            questionEl: questionEl,
            block: block,
            images: ctx.images,
            inputs: ctx.inputs,
            options: [],
            rows: [],
            list: null,
            text: contentEl ? richText(contentEl, ctx) : ''
        };

        if (type === 'quiz' || type === 'multiquiz') {
            const sel = type === 'quiz' ? 'span.sth-answer-control-radio' : 'span.sth-answer-control-checkbox';
            meta.options = Array.from(block.querySelectorAll(sel)).map(el => ({ el: el, text: optionText(el) }));
        } else if (type === 'quiz_image' || type === 'multiquiz_image') {
            meta.options = Array.from(block.querySelectorAll('div.sth-answer-control-image-radio > span')).map((el, i) => {
                const img = el.querySelector('img');
                if (img) {
                    const src = img.getAttribute('src') || img.getAttribute('ng-src') || '';
                    const real = src.replace(/\{\{[^}]*\}\}/g, '');
                    if (real && !real.startsWith('data:')) meta.images.push(toAbsolute(real));
                }
                return { el: el, text: 'варіант ' + (LETTERS[i] || String(i + 1)) };
            });
        } else if (type === 'truefalse') {
            meta.rows = Array.from(block.querySelectorAll('.sth-answer-truefalse-row')).map(row => {
                const spans = Array.from(row.querySelectorAll('span.sth-answer-control-radio'));
                const stmt = row.querySelector('div');
                return { el: row, label: stmt ? richText(stmt, ctx) : '', spans: spans };
            });
        } else if (type === 'select') {
            meta.options = Array.from(block.querySelectorAll('li.sth-answer-control-select-option'))
                .map(el => ({ el: el, text: optionText(el) }));
        } else if (type === 'short') {
            const input = block.querySelector('input.sth-answer-control-string');
            if (input) meta.inputs.push(input as HTMLInputElement);
        } else if (type === 'fill') {
            const fillRoot = block.querySelector('div[latex]') || block;
            const fctx: RichTextContext = { images: [], inputs: [] };
            meta.text = richText(fillRoot, fctx);
            meta.inputs = fctx.inputs;
            fctx.images.forEach(u => meta.images.push(u));
        } else if (type === 'order' || type === 'order2') {
            const listEl = block.querySelector('ul.sth-answer-control-order');
            if (listEl) {
                meta.list = {
                    el: listEl,
                    items: Array.from(listEl.querySelectorAll('li')).map(el => ({ el: el, text: optionText(el) }))
                };
            }
        } else if (type === 'match' || type === 'match_image') {
            const rowEls = type === 'match_image'
                ? Array.from(block.querySelectorAll('.sth-answer-control-image-insert > div'))
                : Array.from(block.querySelectorAll('.sth-answer-control-insert > .item-row'));
            meta.rows = rowEls.map((rowEl, i) => {
                const labelEl = rowEl.querySelector('.item-row-left') || rowEl.querySelector('.drop-area-block');
                const select = rowEl.querySelector('select') as HTMLSelectElement | null;
                return {
                    el: rowEl,
                    num: i + 1,
                    label: labelEl ? richText(labelEl, ctx) : '',
                    select: select,
                    options: select
                        ? Array.from(select.options).filter(o => !o.disabled).map(o => ({ el: o, value: o.value, text: norm(o.textContent) }))
                        : []
                };
            });
        }
        return meta;
    }

    function buildQuestionData(meta: NaurokRoundMeta, base64Images: string[]): XdQuestionData {
        const data: XdQuestionData = {
            text: meta.text || ' ',
            optionsText: undefined,
            base64Images: base64Images,
            questionType: 'quiz',
            isMultiQuiz: false,
            isMulti: false
        };
        const type = meta.type;

        if (type === 'quiz' || type === 'select') {
            data.questionType = 'quiz';
            data.optionsText = meta.options.map(o => o.text).join('\n') || undefined;
        } else if (type === 'quiz_image') {
            data.questionType = 'quiz';
            data.optionsText = meta.options.map((o, i) => (LETTERS[i] || (i + 1)) + ') [зображення]').join('\n') || undefined;
        } else if (type === 'multiquiz') {
            data.questionType = 'multiquiz';
            data.isMultiQuiz = true;
            data.optionsText = meta.options.map(o => o.text).join('\n') || undefined;
        } else if (type === 'multiquiz_image') {
            data.questionType = 'multiquiz';
            data.isMultiQuiz = true;
            data.optionsText = meta.options.map((o, i) => (LETTERS[i] || (i + 1)) + ') [зображення]').join('\n') || undefined;
        } else if (type === 'truefalse') {
            data.questionType = 'true_false_multi';
            data.optionsText = meta.rows.map((r, i) => (i + 1) + '. ' + (r.label || '')).join('\n') || undefined;
        } else if (type === 'short') {
            data.questionType = 'short_text';
        } else if (type === 'fill') {
            data.questionType = 'fill_blank';
        } else if (type === 'order' || type === 'order2') {
            data.questionType = 'order_words';
            data.optionsText = meta.list ? meta.list.items.map(it => it.text).join('\n') : undefined;
        } else if (type === 'match' || type === 'match_image') {
            data.questionType = 'match_pairs';
            const rows = meta.rows.map((r, i) => (i + 1) + '. ' + (r.label || ''));
            const firstWithOptions = meta.rows.find(r => r.options && r.options.length > 0);
            const variants = firstWithOptions && firstWithOptions.options ? firstWithOptions.options.map(o => o.text) : [];
            data.optionsText = 'Рядки:\n' + rows.join('\n') + '\n\nВаріанти:\n' + variants.join('\n');
        }
        return data;
    }

    function itemKey(el: Element): string {
        const tex = annotationOf(el);
        return tex ? norm(tex.textContent) : norm(el.textContent);
    }

    ns.dom = {
        collectMeta: collectMeta,
        buildQuestionData: buildQuestionData,
        getQuestionNumber: getQuestionNumber,
        norm: norm,
        cleanRef: cleanRef,
        itemKey: itemKey
    } as NaurokRoundDomApi;
})();
