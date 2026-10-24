// src/dom/match/answer.ts
// Matches a plain AI answer string to the option elements on the page.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function matchAnswerToOptions(answerText: string, optionElements: Element[]): Element[] {
        if (!answerText || !optionElements.length) return [];
        // Grid path only when the candidate set is pure grid cells, so a mixed
        // unscoped page (regular questions + grids) can't hijack matching.
        const gridCells = optionElements.filter(I.isGridCell);
        if (gridCells.length >= 2 && gridCells.length === optionElements.length) {
            const gridMatched = I.matchGridAnswer(answerText, gridCells);
            if (gridMatched.length) return gridMatched;
        }
        const answers = answerText.split(';').map(a => a.trim()).filter(Boolean);
        const matched: Element[] = [];
        const usedElements = new Set<Element>();
        const optionLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        for (const ans of answers) {
            const normAns = I.normalizeText(ans);
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

            let best: Element | null = null, bestScore = 0;

            for (const el of optionElements) {
                if (usedElements.has(el)) continue;
                const normEl = I.normalizeText((el as HTMLElement).innerText || el.textContent);
                if (!normEl) continue;

                // Exact match
                if (normEl === normAns) {
                    best = el; bestScore = 1; break;
                }

                const score = I.textSimilarity(normEl, normAns);
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

    I.matchAnswerToOptions = matchAnswerToOptions;
})();
