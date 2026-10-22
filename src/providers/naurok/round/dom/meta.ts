// src/providers/naurok/round/dom/meta.ts
// НаУрок round question extraction: visible answer block, question number and per-type meta.
import type { NaurokRoundMeta } from './index';
import { LETTERS, norm, optionText, richText, toAbsolute } from './text';
import type { RichTextContext } from './text';

export function getQuestionNumber(): string {
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

export function collectMeta(questionEl: Element): NaurokRoundMeta | null {
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
