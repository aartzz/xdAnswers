// src/dom/match/options.ts
// Finds the clickable option elements on the current page.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    // Google Forms (and similar) render a hidden, aria-hidden print copy of grid
    // questions whose cells are aria-disabled. Those are dead to clicks, so they
    // must never be matched, highlighted or auto-selected.
    function isHiddenOrDisabled(el: Element | null): boolean {
        if (!el) return false;
        if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return true;
        return !!el.closest('[aria-hidden="true"]');
    }

    function findOptionElements(): Element[] {
        const selectors = [
            '[data-xd-option="true"]',
            '.question-option-inner-content',
            '.question-option-inner',
            '.answer-text',
            '.t-text-guest',
            '.t-text',
            '.test-answer',
            'label[for]',
            '.v-test-questions-select-block .t-text',
            '.v-test-questions-select-block .t-text-guest',
            '.n-kahoot-p',
            // Naurok test-beta (React): choices are button.tb-answer.
            '.tb-answers .tb-answer',
            '.v-block-answers-cross-block .numb-item',
            '.justkids-answer-text',
            // vseosvita premium formats: true/false buttons and order-words tokens
            'button.item-true-false',
            '.word-queue-test_question_sentence-item',
            '[role="radio"] span',
            '[role="checkbox"] span',
            '[role="option"] span'
        ];
        for (const sel of selectors) {
            const els = Array.from(document.querySelectorAll(sel)).filter(el => !isHiddenOrDisabled(el));
            if (els.length > 1) return els;
        }
        // Fallback: find all radio/checkbox labels
        const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        if (inputs.length > 1) {
            const labels = Array.from(inputs).map(inp => {
                const label: Element | null = inp.closest('label') || inp.parentElement;
                return label;
            }).filter((label): label is Element => !!label && !isHiddenOrDisabled(label));
            if (labels.length > 1) return labels;
        }
        return [];
    }

    I.isHiddenOrDisabled = isHiddenOrDisabled;
    I.findOptionElements = findOptionElements;
})();
