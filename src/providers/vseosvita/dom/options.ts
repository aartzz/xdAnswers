// src/providers/vseosvita/dom/options.ts
// vseosvita answer options: option text collection and option element marking.
import { getText } from './text';

function collectMatchingOptions(questionRoot: Element): string[] {
    const wrapper = questionRoot.querySelector('.v-block-answers-cross-wrapper');
    if (!wrapper) return [];

    const items: Array<{ key: string; combined: string }> = [];
    const seen = new Set<string>();

    wrapper.querySelectorAll('.v-block-answers-cross-block').forEach(block => {
        const key = getText(block.querySelector('.numb-item'));
        const value = getText(block.querySelector('.n-answer-p, p'));
        const combined = key && value ? `${key}. ${value}` : value || key;
        if (!combined || seen.has(combined)) return;
        seen.add(combined);
        items.push({ key, combined });
    });

    const numericItems = items
        .filter(item => /^\d+$/.test(item.key))
        .sort((a, b) => Number(a.key) - Number(b.key))
        .map(item => item.combined);

    const alphaItems = items
        .filter(item => item.key && !/^\d+$/.test(item.key))
        .sort((a, b) => a.key.localeCompare(b.key, 'uk'))
        .map(item => item.combined);

    const otherItems = items
        .filter(item => !item.key)
        .map(item => item.combined)
        .sort((a, b) => a.localeCompare(b, 'uk'));

    return [...numericItems, ...alphaItems, ...otherItems];
}

export function collectOptions(questionRoot: Element): string[] {
    const matchingOptions = collectMatchingOptions(questionRoot);
    if (matchingOptions.length) return matchingOptions;

    const optionSelectors = [
        '[data-xd-option="true"]',
        '.answer-text',
        '.v-test-questions-select-block .t-text-guest',
        '.v-test-questions-select-block .t-text',
        '.t-test-questions .t-text-guest',
        '.t-test-questions .t-text',
        '.test-answer',
        'label[for]'
    ];

    const seen = new Set<string>();
    const options: string[] = [];
    for (const selector of optionSelectors) {
        questionRoot.querySelectorAll(selector).forEach(el => {
            const text = getText(el);
            if (!text) return;
            if (seen.has(text)) return;
            seen.add(text);
            options.push(text);
        });
    }

    if (options.length === 0) {
        const choiceBlocks = questionRoot.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        choiceBlocks.forEach(input => {
            const wrap = input.closest('label, .answer-item, .v-test-questions-select-block, .test-answer') || input.parentElement;
            const text = getText(wrap).replace(/^[A-ZА-ЯІЇЄҐ]\s*[\)\.]\s*/i, '').trim();
            if (text && !seen.has(text)) {
                seen.add(text);
                options.push(text);
            }
        });
    }

    return options;
}

// Google Forms-style widgets use stable ARIA roles while their CSS classes are
// regenerated. Mark the text-bearing node (or the grid cell itself when it has
// no visible text) so the generic option matcher can work without class names.
function isHiddenOrDisabled(el: Element): boolean {
    return !!el.closest('[aria-hidden="true"]') || el.getAttribute('aria-disabled') === 'true';
}

function optionTextTarget(el: Element): Element {
    const text = (el.textContent || '').trim();
    if (!text) return el;
    const leaves = Array.from(el.querySelectorAll('*')).filter(child => {
        if (child.closest('[aria-hidden="true"]')) return false;
        if (child.children.length > 0) return false;
        return (child.textContent || '').trim().length > 0;
    });
    if (leaves.length === 0) return el;
    leaves.sort((a, b) => (b.textContent || '').trim().length - (a.textContent || '').trim().length);
    return leaves[0];
}

function markStructuredChoices(questionRoot: Element): void {
    questionRoot.querySelectorAll('[role="radio"], [role="checkbox"], [role="option"]').forEach(el => {
        if (isHiddenOrDisabled(el)) return;

        // Grid/likert cells must stay recognisable as grid cells: they carry
        // data-field-index and are parsed as rows, not as text options.
        const fieldContainer = el.closest('[data-field-index]');
        if (fieldContainer) {
            if (!el.hasAttribute('data-field-index') && fieldContainer !== el) {
                const fieldIndex = fieldContainer.getAttribute('data-field-index');
                if (fieldIndex !== null) el.setAttribute('data-field-index', fieldIndex);
            }
            el.setAttribute('data-xd-option', 'true');
            return;
        }

        optionTextTarget(el).setAttribute('data-xd-option', 'true');
    });
}

// Mark option elements with data-xd-option so findOptionElements()/matchAnswerToOptions()
// in src/dom can find them for auto-answer and indicator modes
export function markOptionElements(questionRoot: Element): void {
    // For radio/checkbox questions: mark the label[for] elements
    questionRoot.querySelectorAll('.v-test-questions-radio-block label[for], .v-test-questions-checkbox-block label[for]').forEach(label => {
        label.setAttribute('data-xd-option', 'true');
    });
    // For matching questions: mark cross-block items
    questionRoot.querySelectorAll('.v-block-answers-cross-block').forEach(block => {
        const textEl = block.querySelector('.n-answer-p, p') || block;
        textEl.setAttribute('data-xd-option', 'true');
    });
    // Fallback: mark generic option elements
    questionRoot.querySelectorAll('.v-test-questions-select-block .t-text, .v-test-questions-select-block .t-text-guest, .answer-text, .test-answer').forEach(el => {
        el.setAttribute('data-xd-option', 'true');
    });
    // Premium format interactive elements (types 12, 13)
    // type 12 - true/false buttons
    questionRoot.querySelectorAll('button.item-true-false').forEach(btn => {
        btn.setAttribute('data-xd-option', 'true');
    });
    // type 13 - order-words clickable tokens
    questionRoot.querySelectorAll('.word-queue-test_question_sentence-item').forEach(token => {
        token.setAttribute('data-xd-option', 'true');
    });
    // Google Forms-style grids, likert rows, radio/checkbox choices and
    // dropdown options: structural marking only, no generated CSS classes.
    markStructuredChoices(questionRoot);
}
