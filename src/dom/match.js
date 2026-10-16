// src/dom/match.js
// Option matching utilities. Extracted from legacy utils.js (lines 1343-1477).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    // Google Forms (and similar) render a hidden, aria-hidden print copy of grid
    // questions whose cells are aria-disabled. Those are dead to clicks, so they
    // must never be matched, highlighted or auto-selected.
    function isHiddenOrDisabled(el) {
        if (!el || !el.closest) return false;
        if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return true;
        return !!el.closest('[aria-hidden="true"]');
    }

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
            const els = Array.from(document.querySelectorAll(sel)).filter(el => !isHiddenOrDisabled(el));
            if (els.length > 1) return els;
        }
        // Fallback: find all radio/checkbox labels
        const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        if (inputs.length > 1) {
            const labels = Array.from(inputs).map(inp => {
                const label = inp.closest('label') || inp.parentElement;
                return label || null;
            }).filter(label => label && !isHiddenOrDisabled(label));
            if (labels.length > 1) return labels;
        }
        return [];
    }

    function normalizeText(t) {
        return (t || '').replace(/\s+/g, ' ').trim().toLowerCase()
            .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, '')  // zero-width / nbsp
            .replace(/(\d),(\d)/g, '$1.$2')                    // decimal comma → dot (1,5 → 1.5)
            .replace(/(\d)\.(\d)/g, '$1_DOT_$2')               // protect decimal dots temporarily
            .replace(/[.,;:!?()\-–—]/g, '')                     // strip remaining punctuation
            .replace(/_DOT_/g, '.')                              // restore decimal dots
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

    // --- Grid (matrix) questions, e.g. Google Forms "Сітка" ---
    // Grid cells contain no text (only an icon), so text similarity on the cell
    // itself cannot work. Texts live in row labels and in cell attributes
    // (data-answer-value / data-value / aria-label), and cells share a
    // data-field-index that identifies their row.

    function isGridCell(el) {
        return !!(el && typeof el.matches === 'function' &&
            el.hasAttribute('data-field-index') &&
            el.matches('[role="radio"], [role="checkbox"], [role="option"]'));
    }

    function gridRowLabel(el) {
        const group = el.closest ? el.closest('[role="group"], [role="radiogroup"]') : null;
        if (group) {
            const labelEl = group.querySelector('.V4d7Ke.wzWPxe');
            const labelText = labelEl ? (labelEl.innerText || labelEl.textContent || '').trim() : '';
            if (labelText) return labelText;
            const groupAria = (group.getAttribute('aria-label') || '').trim();
            if (groupAria) return groupAria;
        }
        const aria = (el.getAttribute('aria-label') || '').trim();
        const comma = aria.indexOf(',');
        if (comma === -1) return '';
        // "column, відповідь для row" → row
        return aria.slice(comma + 1).trim().replace(/^(?:відповідь\s+для|answer\s+for)\s*:?\s*/i, '');
    }

    function gridCellColumnText(el) {
        const direct = (el.getAttribute('data-answer-value') || el.getAttribute('data-value') || '').trim();
        if (direct) return direct;
        const aria = (el.getAttribute('aria-label') || '').trim();
        const comma = aria.indexOf(',');
        return (comma > 0 ? aria.slice(0, comma) : aria).trim();
    }

    // Groups grid cells into rows: [{ index, label, cells: [{ element, column }] }]
    // Returns [] when the elements are not grid cells.
    function collectGridRows(elements) {
        const cells = (elements || []).filter(el => isGridCell(el) && !isHiddenOrDisabled(el));
        if (cells.length < 2) return [];
        // Group by the row container first: separate grids on the page reuse the
        // same data-field-index values, so index alone would merge their rows.
        const rows = [];
        const byGroup = new Map();
        for (const el of cells) {
            const group = el.closest('[role="group"], [role="radiogroup"]') || el.parentElement || el;
            let row = byGroup.get(group);
            if (!row) {
                const raw = el.getAttribute('data-field-index') || group.getAttribute('data-field-index');
                const index = raw === null || raw === '' ? rows.length : parseInt(raw, 10);
                row = { index, label: gridRowLabel(el), cells: [] };
                byGroup.set(group, row);
                rows.push(row);
            }
            row.cells.push({ element: el, column: gridCellColumnText(el) });
        }
        rows.sort((a, b) => a.index - b.index);
        return rows;
    }

    function gridCleanRef(text) {
        return (text || '')
            .replace(/[*`_]/g, '')
            .replace(/^[\s"'«»„“”]+|[\s"'«»„“”]+$/g, '')
            .replace(/^(?:рядок|row)\s*[:№#]?\s*(?=\d)/i, '')
            .replace(/^\d+[.)\]]\s+/, '')
            .replace(/^[-•*·]\s+/, '')
            .trim();
    }

    function findGridRow(ref, rows) {
        const norm = normalizeText(gridCleanRef(ref));
        if (!norm) return null;
        if (/^\d+$/.test(norm)) {
            const i = parseInt(norm, 10) - 1;
            return (i >= 0 && i < rows.length) ? { row: rows[i], score: 1 } : null;
        }
        let best = null, bestScore = 0;
        for (const row of rows) {
            if (!row.label) continue;
            const rowNorm = normalizeText(row.label);
            if (!rowNorm) continue;
            if (rowNorm === norm) return { row, score: 1 };
            let score = textSimilarity(rowNorm, norm);
            if (Math.min(rowNorm.length, norm.length) >= 3 && (rowNorm.includes(norm) || norm.includes(rowNorm))) score = Math.max(score, 0.6);
            if (score > bestScore) { bestScore = score; best = row; }
        }
        return bestScore >= 0.45 ? { row: best, score: bestScore } : null;
    }

    function findGridColumn(row, ref) {
        const norm = normalizeText(gridCleanRef(ref));
        if (!norm) return null;
        const letter = norm.match(/^(?:варіант|вариант|option|variant)?\s*([a-zа-яіїєґ])$/);
        if (letter) {
            const ch = letter[1];
            const cyr = 'абвгд', lat = 'abcde';
            let i = cyr.indexOf(ch);
            if (i < 0) i = lat.indexOf(ch);
            if (i < 0 && ch === 'с') i = 2; // Cyrillic С (U+0441) read as Latin C
            if (i >= 0 && i < row.cells.length) return { cell: row.cells[i], score: 1 };
        }
        const numeric = norm.match(/^(?:стовпець|колонка|column)?\s*(\d+)$/);
        if (numeric) {
            const i = parseInt(numeric[1], 10) - 1;
            if (i >= 0 && i < row.cells.length) return { cell: row.cells[i], score: 1 };
        }
        let best = null, bestScore = 0;
        for (const c of row.cells) {
            if (!c.column) continue;
            const colNorm = normalizeText(c.column);
            if (!colNorm) continue;
            if (colNorm === norm) return { cell: c, score: 1 };
            let score = textSimilarity(colNorm, norm);
            if (Math.min(colNorm.length, norm.length) >= 3 && (colNorm.includes(norm) || norm.includes(colNorm))) score = Math.max(score, 0.6);
            if (score > bestScore) { bestScore = score; best = c; }
        }
        return bestScore >= 0.45 ? { cell: best, score: bestScore } : null;
    }

    // Parses answers like "row = column; row = column" (also "1-A", "рядок 1: ...",
    // "column = row" reversed) and returns the matched grid cells.
    function matchGridAnswer(answerText, optionElements) {
        const rows = collectGridRows(optionElements);
        if (rows.length < 2) return [];

        const items = answerText.split(/;|\n+/).map(s => s.trim()).filter(Boolean);
        const pairSeparator = /(?:=>|->|=|→|—|–|\s-\s|-|:|\)\s*)/;
        const matched = [];
        const usedCells = new Set();
        const usedRows = new Set();

        const pushCell = (cell, row) => {
            if (!cell || usedCells.has(cell.element)) return;
            usedCells.add(cell.element);
            if (row) usedRows.add(row);
            matched.push(cell.element);
        };

        for (const item of items) {
            let bestCell = null, bestRow = null, bestScore = 0;
            let cursor = 0;
            // Try every separator position; keep the split that scores best.
            while (cursor < item.length) {
                const sep = pairSeparator.exec(item.slice(cursor));
                if (!sep) break;
                const sepIndex = cursor + sep.index;
                const step = Math.max(sep[0].length, 1);
                const left = item.slice(0, sepIndex).trim();
                const right = item.slice(sepIndex + step).trim();
                if (left && right) {
                    // "row = column"
                    const rowHit = findGridRow(left, rows);
                    if (rowHit) {
                        const colHit = findGridColumn(rowHit.row, right);
                        if (colHit) {
                            const score = rowHit.score * colHit.score;
                            if (score > bestScore) { bestScore = score; bestCell = colHit.cell; bestRow = rowHit.row; }
                        }
                    }
                    // "column = row" (some models swap the order)
                    const rowHit2 = findGridRow(right, rows);
                    if (rowHit2) {
                        const colHit2 = findGridColumn(rowHit2.row, left);
                        if (colHit2) {
                            const score = rowHit2.score * colHit2.score;
                            if (score > bestScore) { bestScore = score; bestCell = colHit2.cell; bestRow = rowHit2.row; }
                        }
                    }
                }
                cursor = sepIndex + step;
            }

            if (bestCell) {
                pushCell(bestCell, bestRow);
                continue;
            }

            // No parseable pair: many models just enumerate each row's column in
            // order ("A; B; C"). Assign those to the next unassigned row.
            const nextRow = rows.find(r => !usedRows.has(r) && r.cells.some(c => !usedCells.has(c.element)));
            if (nextRow) {
                const colHit = findGridColumn(nextRow, item);
                if (colHit) pushCell(colHit.cell, nextRow);
            }
        }
        return matched;
    }

    function matchAnswerToOptions(answerText, optionElements) {
        if (!answerText || !optionElements.length) return [];
        // Grid path only when the candidate set is pure grid cells, so a mixed
        // unscoped page (regular questions + grids) can't hijack matching.
        const gridCells = optionElements.filter(isGridCell);
        if (gridCells.length >= 2 && gridCells.length === optionElements.length) {
            const gridMatched = matchGridAnswer(answerText, gridCells);
            if (gridMatched.length) return gridMatched;
        }
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
    window.xdAnswers._internal.isGridCell = isGridCell;
    window.xdAnswers._internal.gridRowLabel = gridRowLabel;
    window.xdAnswers._internal.gridCellColumnText = gridCellColumnText;
    window.xdAnswers._internal.collectGridRows = collectGridRows;
    window.xdAnswers._internal.matchGridAnswer = matchGridAnswer;
})();
