// src/dom/match.js
// Option matching utilities. Extracted from legacy utils.js (lines 1343-1477).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    function findOptionElements() {
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
            const els = document.querySelectorAll(sel);
            if (els.length > 1) return Array.from(els);
        }
        // Fallback: find all radio/checkbox labels
        const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        if (inputs.length > 1) {
            const labels = Array.from(inputs).map(inp => {
                const label = inp.closest('label') || inp.parentElement;
                return label || null;
            }).filter(Boolean);
            if (labels.length > 1) return labels;
        }
        return [];
    }

    function normalizeText(t) {
        return (t || '').replace(/\s+/g, ' ').trim().toLowerCase()
            .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, '')  // zero-width / nbsp
            .replace(/[.,;:!?()\-–—]/g, '')                     // strip punctuation for matching
            .trim();
    }

    function levenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = b[i - 1] === a[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        return matrix[b.length][a.length];
    }

    function textSimilarity(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 1;
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        // Exact substring match
        if (a.includes(b) || b.includes(a)) {
            return Math.min(a.length, b.length) / maxLen;
        }
        // Levenshtein-based similarity
        const dist = levenshtein(a, b);
        return 1 - dist / maxLen;
    }

    function matchAnswerToOptions(answerText, optionElements) {
        if (!answerText || !optionElements.length) return [];
        const answers = answerText.split(';').map(a => a.trim()).filter(Boolean);
        const matched = [];
        const usedElements = new Set();
        const optionLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        for (const ans of answers) {
            const normAns = normalizeText(ans);
            if (!normAns) continue;

            // Спочатку перевіряємо відповідність за літерою (A, B, C...) —
            // для варіантів-зображень, де немає тексту
            const letterMatch = normAns.match(/^([a-z])$/i);
            if (letterMatch) {
                const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
                if (idx >= 0 && idx < optionElements.length && !usedElements.has(optionElements[idx])) {
                    matched.push(optionElements[idx]);
                    usedElements.add(optionElements[idx]);
                    continue;
                }
            }

            // Також перевіряємо "варіант A", "варіант a" тощо
            const variantMatch = normAns.match(/(?:варіант|вариант|option|variant)\s*([a-z])/i);
            if (variantMatch) {
                const idx = variantMatch[1].toUpperCase().charCodeAt(0) - 65;
                if (idx >= 0 && idx < optionElements.length && !usedElements.has(optionElements[idx])) {
                    matched.push(optionElements[idx]);
                    usedElements.add(optionElements[idx]);
                    continue;
                }
            }

            let best = null, bestScore = 0;

            for (const el of optionElements) {
                if (usedElements.has(el)) continue;
                const normEl = normalizeText(el.innerText || el.textContent);
                if (!normEl) continue;

                // Exact match
                if (normEl === normAns) {
                    best = el; bestScore = 1; break;
                }

                const score = textSimilarity(normEl, normAns);
                if (score > bestScore) {
                    bestScore = score;
                    best = el;
                }
            }

            if (best && bestScore > 0.4) {
                matched.push(best);
                usedElements.add(best);
            }
        }
        return matched;
    }

    // Export to _internal for cross-file access
    window.xdAnswers._internal.findOptionElements = findOptionElements;
    window.xdAnswers._internal.normalizeText = normalizeText;
    window.xdAnswers._internal.levenshtein = levenshtein;
    window.xdAnswers._internal.textSimilarity = textSimilarity;
    window.xdAnswers._internal.matchAnswerToOptions = matchAnswerToOptions;
})();
