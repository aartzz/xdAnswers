// src/providers/vseosvita/dom/premium-collect.ts
// vseosvita premium collectors for the data-quest_type layouts (type 3/5/6/7/8/10/12/13/18).
import type { VseosvitaMeta } from './index';
import { normalize } from './text';

export function findVrQuest(questionRoot: Element | null): Element | null {
    if (!questionRoot) return null;
    return questionRoot.closest?.('.vr-quest[data-quest_type]')
        || questionRoot.querySelector?.('.vr-quest[data-quest_type]')
        || null;
}

// ── Type 12: true/false ────────────────────────────────────────────
export function collectTrueFalse(vrQuest: Element): VseosvitaMeta | null {
    const buttons = Array.from(vrQuest.querySelectorAll('.true-false_test-wrap button.item-true-false'));
    if (buttons.length < 2) return null;
    const items = buttons.map(btn => ({
        text: normalize(btn.textContent) || (btn.classList.contains('green') ? 'Правда' : 'Неправда'),
        element: btn
    }));
    return { formatType: 'true_false', buttons: items };
}

// ── Type 3: single text input ──────────────────────────────────────
// ── Type 5: multi text input ───────────────────────────────────────
export function collectTextInputs(vrQuest: Element): VseosvitaMeta | null {
    // Prefer labels because they carry the field ordering semantic ("Відповідь 1:", ...)
    const inputs: Array<{ label: string; element: HTMLInputElement }> = [];
    vrQuest.querySelectorAll('label').forEach(label => {
        const input = label.querySelector('input[type="text"]');
        if (input) {
            const labelText = normalize(label.childNodes[0]?.textContent) || normalize(label.textContent).split(':')[0];
            inputs.push({ label: labelText || `Поле ${inputs.length + 1}`, element: input as HTMLInputElement });
        }
    });
    // Fallback: any text input directly inside the quest
    if (inputs.length === 0) {
        vrQuest.querySelectorAll('input[type="text"]').forEach((input, idx) => {
            inputs.push({ label: `Поле ${idx + 1}`, element: input as HTMLInputElement });
        });
    }
    if (inputs.length === 0) return null;
    return {
        formatType: inputs.length > 1 ? 'text_input_multi' : 'text_input_single',
        inputs
    };
}

// ── Type 6: fill-in-blank (inline contenteditable spans) ───────────
export function collectFillBlanks(vrQuest: Element): VseosvitaMeta | null {
    const spans = Array.from(vrQuest.querySelectorAll('span.vr-fill-the-gap.vr-control[data-key]'));
    if (spans.length === 0) return null;
    const blanks = spans.map(span => ({
        key: span.getAttribute('data-key') || '',
        element: span
    })).filter(b => b.key);
    if (blanks.length === 0) return null;
    return { formatType: 'fill_blank', blanks };
}

// ── Type 7: select-in-text (inline dropdown) ───────────────────────
// Each blank has a sibling <span>[<strong>opt1, opt2, opt3</strong>]</span>
// We extract the options list from the sibling so the AI knows what to pick.
export function collectSelectInText(vrQuest: Element): VseosvitaMeta | null {
    const spans = Array.from(vrQuest.querySelectorAll('span.vr-fill-the-gap-select.vr-control[data-key]'));
    if (spans.length === 0) return null;
    const blanks = spans.map(span => {
        const key = span.getAttribute('data-key') || '';
        // Look for the options listed in the sibling/next element
        let options: string[] = [];
        let sibling: Element | null = span.nextElementSibling;
        // Walk a few siblings forward to find the options span with <strong>
        for (let i = 0; i < 3 && sibling; i++) {
            const strong = sibling.querySelector?.('strong');
            if (strong) {
                options = normalize(strong.textContent).split(',').map(s => s.trim()).filter(Boolean);
                break;
            }
            sibling = sibling.nextElementSibling;
        }
        return { key, options, element: span };
    }).filter(b => b.key);
    if (blanks.length === 0) return null;
    return { formatType: 'select_in_text', blanks };
}

// ── Type 8 extras: ordering with <select> dropdowns ────────────────
// (Already detected by legacy branch as 'ordering', but that branch doesn't
// support the select-based variant. Kept here as a fallback if the legacy
// branch ever returns 'unknown' for this DOM shape.)
export function collectOrderingSelect(vrQuest: Element): VseosvitaMeta | null {
    const blocks = Array.from(vrQuest.querySelectorAll('.v-test-questions-select-block'));
    if (blocks.length === 0) return null;
    const items = blocks.map((block, idx) => {
        const select = block.querySelector('select');
        const textEl = block.querySelector('.t-text-guest, .t-text');
        return {
            index: idx + 1,
            text: normalize(textEl?.textContent) || '',
            element: select || block
        };
    }).filter(i => i.text);
    if (items.length === 0) return null;
    return { formatType: 'ordering_select', items };
}

// ── Type 13: order-words (click tokens in order) ───────────────────
export function collectOrderWords(vrQuest: Element): VseosvitaMeta | null {
    const tokens = Array.from(vrQuest.querySelectorAll('.word-queue-test_question_sentence-wrap-testing .word-queue-test_question_sentence-item'));
    if (tokens.length < 2) return null;
    const items = tokens.map(t => ({ text: normalize(t.textContent), element: t })).filter(t => t.text);
    if (items.length < 2) return null;
    return { formatType: 'order_words', tokens: items };
}

// ── Type 18: free-response (essay / textarea) ──────────────────────
export function collectFreeResponse(vrQuest: Element): VseosvitaMeta | null {
    const textarea = vrQuest.querySelector('textarea') || vrQuest.querySelector('[contenteditable="true"]');
    // Static dumps may have no textarea (preview mode) — still classify the type
    // so the AI prompt triggers and autoSelectAnswer's fallback branch can fill
    // the textarea that vseosvita renders at runtime.
    return { formatType: 'free_response', element: textarea || null };
}

// ── Type 10 / Categorization: drag-and-drop items into categories ───
// Heuristic: container with category titles and draggable items that
// must be distributed among the categories.
export function collectCategorization(vrQuest: Element): VseosvitaMeta | null {
    // Look for category headers and draggable items
    const catHeaders = Array.from(vrQuest.querySelectorAll('.vr-category-title, .category-title, .vr-cat-header, [data-testid="category-header"]'));
    const items = Array.from(vrQuest.querySelectorAll('.vr-categorization-item, .categorization-item, .draggable-item, [draggable="true"], [data-testid="categorizer-item"]'));

    if (catHeaders.length < 2 || items.length < 2) return null;

    const categories = catHeaders.map(h => normalize(h.textContent)).filter(Boolean);
    const itemTexts = items.map(it => normalize(it.textContent)).filter(Boolean);

    if (categories.length < 2 || itemTexts.length < 2) return null;

    return {
        formatType: 'categorization',
        categories,
        items: items.map((el, idx) => ({ text: itemTexts[idx] || '', element: el })).filter(i => i.text),
        categoryElements: catHeaders.map(el => ({ text: normalize(el.textContent), element: el }))
    };
}
