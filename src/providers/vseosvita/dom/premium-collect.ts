// src/providers/vseosvita/dom/premium-collect.ts
// vseosvita premium collectors. Most formats are recognised by their runtime
// component classes (the old data-quest_type attribute is no longer emitted),
// while the data-quest_type collectors remain as a compatibility fallback.
import type { VseosvitaMeta } from './index';
import { normalize } from './text';

function firstText(root: Element | null, selectors: string): string {
    if (!root) return '';
    for (const selector of selectors.split(',')) {
        const el = root.querySelector(selector.trim());
        const text = normalize(el?.textContent);
        if (text) return text;
    }
    return '';
}

function imageText(el: Element): string {
    const img = el.querySelector('img');
    return normalize(img?.getAttribute('alt') || img?.getAttribute('title'));
}

function imageMarker(el: Element, index: number): string {
    const alt = imageText(el);
    return `[зображення ${index}]` + (alt ? ` (${alt})` : '');
}

export function findVrQuest(questionRoot: Element | null): Element | null {
    if (!questionRoot) return null;
    const marked = questionRoot.closest?.('.vr-quest[data-quest_type]')
        || questionRoot.querySelector?.('.vr-quest[data-quest_type]');
    if (marked) return marked;
    return questionRoot.closest?.('.v-test-go-bg, .v-test-question, .v-test-questions-block, .v-test-go-body')
        || questionRoot;
}

// ── Type 12: true/false statement buttons ─────────────────────────
export function collectTrueFalse(vrQuest: Element): VseosvitaMeta | null {
    const buttons = Array.from(vrQuest.querySelectorAll('.true-false_test-wrap button.item-true-false, button.item-true-false'));
    if (buttons.length < 2) return null;
    let imageIndex = 0;
    const items = buttons.map(btn => {
        let text = firstText(btn, '.text-btn, .text-btn_row') || normalize(btn.textContent);
        if (!text && btn.querySelector('img')) {
            imageIndex++;
            text = imageMarker(btn, imageIndex);
        }
        return {
            text,
            element: btn,
            correctStyle: btn.classList.contains('green') ? 'green' : (btn.classList.contains('red') ? 'red' : '')
        };
    }).filter(item => item.text);
    if (items.length < 2) return null;
    return { formatType: 'true_false', buttons: items };
}

// ── Type 1/2 with picture answers ─────────────────────────────────
// Text-only radio/checkbox questions go through the generic path. This
// collector is used only when at least one answer is an image with no text.
export function collectImageQuiz(vrQuest: Element): VseosvitaMeta | null {
    const blocks = Array.from(vrQuest.querySelectorAll('.v-test-questions-radio-block, .v-test-questions-checkbox-block'));
    if (blocks.length < 2) return null;

    let imageIndex = 0;
    let hasImageOnly = false;
    const options: Array<{ text: string; element: Element }> = [];

    for (const block of blocks) {
        const label = block.querySelector('label[for], label') || block;
        const text = normalize(label.textContent);
        if (text) {
            options.push({ text, element: label });
            continue;
        }
        const img = label.querySelector('img');
        if (!img) continue;
        hasImageOnly = true;
        imageIndex++;
        options.push({ text: imageMarker(label, imageIndex), element: label });
    }

    if (!hasImageOnly || options.length < 2) return null;
    return {
        formatType: 'image_quiz',
        options,
        isMulti: !!blocks[0].querySelector('input[type="checkbox"]')
    };
}

// ── Type 3 / 5: single and multi text inputs ──────────────────────
export function collectTextInputs(vrQuest: Element): VseosvitaMeta | null {
    const inputs: Array<{ label: string; element: HTMLInputElement }> = [];
    const seen = new Set<HTMLInputElement>();

    const containers = Array.from(vrQuest.querySelectorAll('.a-test-lab-inp'));
    for (const container of containers) {
        const input = container.querySelector('input[type="text"]') as HTMLInputElement | null;
        if (!input || input.disabled || input.readOnly || seen.has(input)) continue;
        seen.add(input);
        const label = container.querySelector('label');
        const labelText = normalize(label?.textContent) || `Поле ${inputs.length + 1}`;
        inputs.push({ label: labelText, element: input });
    }

    // Static preview markup sometimes omits the wrapper. Fall back to any
    // visible text input, but never collect inputs embedded in fill-the-gap.
    if (inputs.length === 0) {
        vrQuest.querySelectorAll('input[type="text"]').forEach(input => {
            const el = input as HTMLInputElement;
            if (el.disabled || el.readOnly || el.closest('.vr-fill-the-gap, .vr-fill-the-gap-select')) return;
            if (seen.has(el)) return;
            seen.add(el);
            inputs.push({ label: `Поле ${inputs.length + 1}`, element: el });
        });
    }

    if (inputs.length === 0) return null;
    return {
        formatType: inputs.length > 1 ? 'text_input_multi' : 'text_input_single',
        inputs
    };
}

// ── Type 18: free response (ProseMirror editor or textarea) ────────
export function collectFreeResponse(vrQuest: Element): VseosvitaMeta | null {
    const editor = vrQuest.querySelector('.a-test-lab-inp .ProseMirror[contenteditable="true"], .ProseMirror[contenteditable="true"], .a-test-lab-inp [contenteditable="true"]');
    const textarea = vrQuest.querySelector('textarea');
    const element = editor || textarea;
    if (!element) return null;
    return { formatType: 'free_response', element };
}

// ── Type 6: fill-in-the-gap inline inputs ─────────────────────────
export function collectFillBlanks(vrQuest: Element): VseosvitaMeta | null {
    const spans = Array.from(vrQuest.querySelectorAll('span.vr-fill-the-gap[data-key], .vr-fill-the-gap[data-key]'))
        .filter(span => !span.classList.contains('vr-fill-the-gap-select') && !span.querySelector('select'));
    if (spans.length === 0) return null;
    const blanks = spans.map(span => {
        const input = span.querySelector('input[data-key], input[type="text"]');
        return {
            key: span.getAttribute('data-key') || input?.getAttribute('data-key') || '',
            element: span,
            input
        };
    }).filter(b => b.key);
    if (blanks.length === 0) return null;
    return { formatType: 'fill_blank', blanks };
}

// ── Type 7: select-in-the-gap inline dropdowns ────────────────────
export function collectSelectInText(vrQuest: Element): VseosvitaMeta | null {
    const spans = Array.from(vrQuest.querySelectorAll('span.vr-fill-the-gap-select[data-key], .vr-fill-the-gap-select[data-key], span.vr-fill-the-gap-select, .vr-fill-the-gap-select'));
    if (spans.length === 0) return null;
    const blanks = spans.map(span => {
        const select = span.querySelector('select') as HTMLSelectElement | null;
        let options: string[] = [];
        if (select) {
            options = Array.from(select.options)
                .filter(opt => normalize(opt.textContent) && opt.value !== '')
                .map(opt => normalize(opt.textContent));
        }
        if (options.length === 0) {
            // Static preview markup lists options in a following <strong>.
            let sibling: Element | null = span.nextElementSibling;
            for (let i = 0; i < 3 && sibling; i++) {
                const strong = sibling.querySelector?.('strong');
                if (strong) {
                    options = normalize(strong.textContent).split(',').map(s => s.trim()).filter(Boolean);
                    break;
                }
                sibling = sibling.nextElementSibling;
            }
        }
        return {
            key: span.getAttribute('data-key') || select?.getAttribute('data-key') || '',
            options,
            element: span,
            select
        };
    }).filter(b => b.key);
    if (blanks.length === 0) return null;
    return { formatType: 'select_in_text', blanks };
}

// ── Type 8: queue ordering (up/down arrows) ───────────────────────
export function collectOrderingSelect(vrQuest: Element): VseosvitaMeta | null {
    const blocks = Array.from(vrQuest.querySelectorAll('.row_draggable-question .v-test-questions-select-block, .draggable-question-box .v-test-questions-select-block, .v-test-questions-select-block'));
    if (blocks.length < 2) return null;
    let imageIndex = 0;
    const items = blocks.map((block, idx) => {
        const select = block.querySelector('select');
        let text = firstText(block, '.t-text-guest, .t-text');
        if (!text && block.querySelector('img')) {
            imageIndex++;
            text = imageMarker(block, imageIndex);
        }
        const id = block.getAttribute('data-xd-vseosvita-order-id') || String(idx);
        block.setAttribute('data-xd-vseosvita-order-id', id);
        return {
            index: idx + 1,
            id,
            text,
            element: block,
            select
        };
    }).filter(i => i.text);
    if (items.length < 2) return null;
    return { formatType: 'ordering_select', layout: 'queue', items };
}

// ── Type 13: order-words (draggable tokens) ───────────────────────
export function collectOrderWords(vrQuest: Element): VseosvitaMeta | null {
    const rows = Array.from(vrQuest.querySelectorAll('.word-queue-test_question_sentence-row'));
    const tokens: Array<{ text: string; element: Element }> = [];
    if (rows.length) {
        rows.forEach(row => {
            row.querySelectorAll('.word-queue-test_question_sentence-item').forEach(token => {
                const text = normalize(token.textContent);
                if (text) tokens.push({ text, element: token });
            });
        });
    } else {
        vrQuest.querySelectorAll('.word-queue-test_question_sentence-item').forEach(token => {
            const text = normalize(token.textContent);
            if (text) tokens.push({ text, element: token });
        });
    }
    if (tokens.length < 2) return null;
    return {
        formatType: 'order_words',
        tokens,
        rows: rows.map(row => ({
            element: row,
            tokens: Array.from(row.querySelectorAll('.word-queue-test_question_sentence-item'))
        }))
    };
}

// ── Type 10: categorization / word basket ─────────────────────────
export function collectCategorization(vrQuest: Element): VseosvitaMeta | null {
    const wrapper = vrQuest.querySelector('.question-sort-category_wrap') || vrQuest;
    const areaEls = Array.from(wrapper.querySelectorAll('.vr-area_wrap'));
    if (areaEls.length < 1) return null;

    const areas = areaEls.map((area, idx) => {
        const title = firstText(area, '.area_title, .area_title_con');
        const titleImg = area.querySelector('.area_title_con img, .area_title img') || area.querySelector('img');
        const titleImage = normalize(titleImg?.getAttribute('alt') || titleImg?.getAttribute('title'));
        const addButton = area.querySelector('.area-add_btn.vr-add, .area-add_btn, .vr-add');
        return {
            text: title || titleImage || `Категорія ${idx + 1}`,
            element: area,
            addButton,
            title
        };
    });

    const itemEls = Array.from(wrapper.querySelectorAll('.question-sort-category_items .question-sort-category_item'));
    let imageIndex = 0;
    const items = itemEls.map(item => {
        const img = item.querySelector('img');
        let text = firstText(item, '.icon-con .text, .text, .icon-con') || imageText(item);
        if (!text && img) {
            imageIndex++;
            text = imageMarker(item, imageIndex);
        }
        return {
            text,
            src: img?.src || '',
            element: item
        };
    }).filter(item => item.text);

    if (items.length < 2) return null;

    return {
        formatType: 'categorization',
        categories: areas.map(area => area.text),
        categoryElements: areas.map(area => ({ text: area.text, element: area.element })),
        areas,
        items
    };
}

// ── Type 4: matching / cross pairs ────────────────────────────────
function collectCrossColumn(column: Element | null, side: 'left' | 'right'): Array<{ key: string; text: string; id: string; element: Element }> {
    if (!column) return [];
    let imageIndex = 0;
    return Array.from(column.querySelectorAll('.v-block-answers-cross-block')).map((block, idx) => {
        let text = firstText(block, '.n-answer-p, p');
        if (!text && block.querySelector('img')) {
            imageIndex++;
            text = imageMarker(block, imageIndex);
        }
        const id = block.getAttribute('data-xd-vseosvita-cross-id') || `${side}-${idx}`;
        block.setAttribute('data-xd-vseosvita-cross-id', id);
        return {
            key: firstText(block, '.numb-item'),
            text,
            id,
            element: block
        };
    }).filter(item => item.text);
}

export function collectCrossPairs(vrQuest: Element): VseosvitaMeta | null {
    const wrapper = vrQuest.querySelector('.v-block-answers-cross-wrapper');
    if (!wrapper) return null;
    const row = wrapper.querySelector('.v-block-answers-cross_row') || wrapper;
    const columns = Array.from(row.querySelectorAll('.v-col-6'));
    const leftColumn = columns.find(col => !col.classList.contains('v-col-last')) || columns[0] || null;
    const rightColumn = columns.find(col => col.classList.contains('v-col-last')) || columns[1] || null;
    const left = collectCrossColumn(leftColumn, 'left');
    const right = collectCrossColumn(rightColumn, 'right');
    if (left.length < 1 || right.length < 1) return null;
    return {
        formatType: 'match_pairs',
        layout: 'cross',
        left,
        right,
        leftColumn,
        rightColumn
    };
}

// ── Type 17: MatchQuest drag cards ────────────────────────────────
export function collectMatchQuest(vrQuest: Element): VseosvitaMeta | null {
    const container = vrQuest.querySelector('.question-match-quest_container');
    if (!container) return null;
    const cards = Array.from(container.querySelectorAll(':scope > .card.match-quest_card'));
    const left: Array<{ text: string; id: string; element: Element }> = [];
    const right: Array<{ text: string; id: string; element: Element }> = [];
    let titleIndex = 0;
    let descIndex = 0;
    let imageIndex = 0;
    cards.forEach(card => {
        if (card.closest('.match-quest_card-connected')) return;
        const isTitle = card.classList.contains('title');
        const isDesc = card.classList.contains('description');
        if (!isTitle && !isDesc) return;
        let text = firstText(card, '.matcher_item-content-box');
        if (!text && card.querySelector('img')) {
            imageIndex++;
            text = imageMarker(card, imageIndex);
        }
        if (!text) return;
        let id = card.getAttribute('data-xd-vseosvita-match-id');
        if (!id) {
            id = isTitle ? `title-${titleIndex}` : `desc-${descIndex}`;
            card.setAttribute('data-xd-vseosvita-match-id', id);
        }
        if (isTitle) titleIndex++;
        else descIndex++;
        if (isTitle) left.push({ text, id, element: card });
        else right.push({ text, id, element: card });
    });
    if (left.length < 1 || right.length < 1) return null;
    return {
        formatType: 'match_pairs',
        layout: 'match_quest',
        left,
        right,
        container
    };
}

// ── Type 16: range slider ─────────────────────────────────────────
export function collectRange(vrQuest: Element): VseosvitaMeta | null {
    const wrap = vrQuest.querySelector('.vue-slider_wrap');
    if (!wrap) return null;
    const slider = wrap.querySelector('.vue-slider');
    const dot = wrap.querySelector('[role="slider"]');
    const rail = wrap.querySelector('.vue-slider-rail');
    if (!slider || !dot) return null;
    const min = Number(dot.getAttribute('aria-valuemin'));
    const max = Number(dot.getAttribute('aria-valuemax'));
    const currentAttr = dot.getAttribute('aria-valuenow');
    const current = currentAttr === null ? null : Number(currentAttr);
    const display = normalize(wrap.parentElement?.textContent || wrap.textContent);
    const unitMatch = display.match(/(?:Обрано:?\s*)?-?\d+(?:[.,]\d+)?\s*([^\s\d.,;:]+)\s*$/);
    const steps = Number((slider as HTMLElement).style.getPropertyValue('--steps'));
    const step = Number.isFinite(steps) && steps > 0 && Number.isFinite(max) && Number.isFinite(min) && max > min
        ? (max - min) / steps
        : 1;
    return {
        formatType: 'range',
        element: wrap,
        slider,
        dot,
        rail,
        min: Number.isFinite(min) ? min : 0,
        max: Number.isFinite(max) ? max : 100,
        current: current !== null && Number.isFinite(current) ? current : null,
        step,
        unit: unitMatch?.[1] || ''
    };
}

// ── Type 9: image search area ─────────────────────────────────────
export function collectImageArea(vrQuest: Element): VseosvitaMeta | null {
    const element = vrQuest.querySelector('.imageSearch_test')
        || vrQuest.querySelector('.n-class-visually-impaired-img.test-img-con');
    if (!element) return null;
    return { formatType: 'image_area', element };
}

// ── Type 11: image puzzle ─────────────────────────────────────────
export function collectImagePuzzle(vrQuest: Element): VseosvitaMeta | null {
    const element = vrQuest.querySelector('.imagePuzzle_test');
    if (!element) return null;
    return { formatType: 'image_puzzle', element };
}

// ── Type 14 / 15: fillword / crossword (detect only) ──────────────
export function collectFillWord(vrQuest: Element): VseosvitaMeta | null {
    const table = vrQuest.querySelector('.fillWord_table');
    if (!table) return null;
    const words = Array.from(vrQuest.querySelectorAll('.hint-text-flow .hint-text-item, .word-queue-test_question_sentence-item'))
        .map(el => normalize(el.textContent)).filter(Boolean);
    return { formatType: 'fill_word', element: table, words };
}
