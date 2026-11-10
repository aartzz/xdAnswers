// src/dom/match/answer.ts
// Matches a plain AI answer string to the option elements on the page.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    const DECORATION_SELECTORS = '.tb-answer-key, .tb-order-num, .tb-match-badge, ' +
        '.tb-answer-tick, .tb-order-tools, .tb-order-mark, .tb-fill-wrap';

    // Naurok test-beta puts the A/B/C key inside the option button, so innerText
    // is "A 7" while the AI answer (and the cache) contains only "7". Compare
    // the full text, the text without the key badge, and a label-stripped copy.
    function comparableOptionTexts(el: Element): string[] {
        const texts = new Set<string>();
        const add = (value: string): void => {
            if (!value) return;
            texts.add(value);
            const folded = I.normalizeConfusables ? I.normalizeConfusables(value) : value;
            if (folded) texts.add(folded);
        };

        const full = I.normalizeText((el as HTMLElement).innerText || el.textContent || '');
        add(full);

        let clean = '';
        try {
            const clone = el.cloneNode(true) as HTMLElement;
            clone.querySelectorAll(DECORATION_SELECTORS).forEach(node => node.remove());
            clean = I.normalizeText(clone.innerText || clone.textContent || '');
        } catch {
            clean = '';
        }
        add(clean);

        const base = clean || full;
        const stripped = base.replace(/^(?:[a-zа-яіїєґ]|\d{1,2})\s*[:.)\-]?\s+/iu, '').trim();
        add(stripped);
        return Array.from(texts);
    }

    function matchAnswerToOptions(answerText: string, optionElements: Element[]): Element[] {
        if (!answerText || !optionElements.length) return [];
        // Grid path only when the candidate set is pure grid cells, so a mixed
        // unscoped page (regular questions + grids) can't hijack matching.
        const gridCells = optionElements.filter(I.isGridCell);
        if (gridCells.length >= 2 && gridCells.length === optionElements.length) {
            const gridMatched = I.matchGridAnswer(answerText, gridCells);
            if (gridMatched.length) return gridMatched;
        }
        // Options can contain semicolons themselves ("Cu(OH)2 ; синій колір").
        // Try the whole answer before splitting it into multiquiz parts.
        const wholeNorm = I.normalizeText(answerText);
        const wholeConf = I.normalizeConfusables ? I.normalizeConfusables(wholeNorm) : wholeNorm;
        if (wholeNorm) {
            for (const el of optionElements) {
                const candidates = comparableOptionTexts(el);
                if (candidates.includes(wholeNorm) || candidates.includes(wholeConf)) return [el];
            }
        }

        const answers = answerText.split(';').map(a => a.trim()).filter(Boolean);
        const matched: Element[] = [];
        const usedElements = new Set<Element>();
        const optionLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        for (const ans of answers) {
            const normAns = I.normalizeText(ans);
            if (!normAns) continue;
            const normAnsConf = I.normalizeConfusables ? I.normalizeConfusables(normAns) : normAns;

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

            let best: Element | null = null, bestScore = 0;

            for (const el of optionElements) {
                if (usedElements.has(el)) continue;
                const candidates = comparableOptionTexts(el);
                if (!candidates.length) continue;

                // Exact match on any comparable form (full text, without the
                // A/B/C key, or with a leading option label stripped).
                if (candidates.includes(normAns) || candidates.includes(normAnsConf)) {
                    best = el; bestScore = 1; break;
                }

                for (const normEl of candidates) {
                    const score = Math.max(
                        I.textSimilarity(normEl, normAns),
                        I.textSimilarity(normEl, normAnsConf)
                    );
                    if (score > bestScore) {
                        bestScore = score;
                        best = el;
                    }
                }
            }

            if (best && bestScore > 0.4) {
                matched.push(best);
                usedElements.add(best);
            }
        }
        return matched;
    }

    I.matchAnswerToOptions = matchAnswerToOptions;
})();
