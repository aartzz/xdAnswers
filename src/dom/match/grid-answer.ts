// src/dom/match/grid-answer.ts
// Matches "row = column" style answers to grid question cells.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function gridCleanRef(text: string | null | undefined): string {
        return (text || '')
            .replace(/[*`_]/g, '')
            .replace(/^[\s"'«»„“”]+|[\s"'«»„“”]+$/g, '')
            .replace(/^(?:рядок|row)\s*[:№#]?\s*(?=\d)/i, '')
            .replace(/^\d+[.)\]]\s+/, '')
            .replace(/^[-•*·]\s+/, '')
            .trim();
    }

    function findGridRow(ref: string, rows: XdGridRowInfo[]): { row: XdGridRowInfo; score: number } | null {
        const norm = I.normalizeText(gridCleanRef(ref));
        if (!norm) return null;
        if (/^\d+$/.test(norm)) {
            const i = parseInt(norm, 10) - 1;
            return (i >= 0 && i < rows.length) ? { row: rows[i], score: 1 } : null;
        }
        let best: XdGridRowInfo | null = null, bestScore = 0;
        for (const row of rows) {
            if (!row.label) continue;
            const rowNorm = I.normalizeText(row.label);
            if (!rowNorm) continue;
            if (rowNorm === norm) return { row, score: 1 };
            let score = I.textSimilarity(rowNorm, norm);
            if (Math.min(rowNorm.length, norm.length) >= 3 && (rowNorm.includes(norm) || norm.includes(rowNorm))) score = Math.max(score, 0.6);
            if (score > bestScore) { bestScore = score; best = row; }
        }
        return bestScore >= 0.45 && best ? { row: best, score: bestScore } : null;
    }

    function findGridColumn(row: XdGridRowInfo, ref: string): { cell: XdGridCellInfo; score: number } | null {
        const norm = I.normalizeText(gridCleanRef(ref));
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
        let best: XdGridCellInfo | null = null, bestScore = 0;
        for (const c of row.cells) {
            if (!c.column) continue;
            const colNorm = I.normalizeText(c.column);
            if (!colNorm) continue;
            if (colNorm === norm) return { cell: c, score: 1 };
            let score = I.textSimilarity(colNorm, norm);
            if (Math.min(colNorm.length, norm.length) >= 3 && (colNorm.includes(norm) || norm.includes(colNorm))) score = Math.max(score, 0.6);
            if (score > bestScore) { bestScore = score; best = c; }
        }
        return bestScore >= 0.45 && best ? { cell: best, score: bestScore } : null;
    }

    // Parses answers like "row = column; row = column" (also "1-A", "рядок 1: ...",
    // "column = row" reversed) and returns the matched grid cells.
    function matchGridAnswer(answerText: string, optionElements: Element[]): Element[] {
        const rows = I.collectGridRows(optionElements);
        if (rows.length < 2) return [];

        const items = answerText.split(/;|\n+/).map(s => s.trim()).filter(Boolean);
        const pairSeparator = /(?:=>|->|=|→|—|–|\s-\s|-|:|\)\s*)/;
        const matched: Element[] = [];
        const usedCells = new Set<Element>();
        const usedRows = new Set<XdGridRowInfo>();

        const pushCell = (cell: XdGridCellInfo | null, row: XdGridRowInfo | null): void => {
            if (!cell || usedCells.has(cell.element)) return;
            usedCells.add(cell.element);
            if (row) usedRows.add(row);
            matched.push(cell.element);
        };

        for (const item of items) {
            let bestCell: XdGridCellInfo | null = null, bestRow: XdGridRowInfo | null = null, bestScore = 0;
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

    I.matchGridAnswer = matchGridAnswer;
})();
