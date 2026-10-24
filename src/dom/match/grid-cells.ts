// src/dom/match/grid-cells.ts
// Recognizes grid (matrix) question cells and groups them into rows.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    // --- Grid (matrix) questions, e.g. Google Forms "Сітка" ---
    // Grid cells contain no text (only an icon), so text similarity on the cell
    // itself cannot work. Texts live in row labels and in cell attributes
    // (data-answer-value / data-value / aria-label), and cells share a
    // data-field-index that identifies their row.

    function isGridCell(el: Element | null): boolean {
        return !!(el && typeof el.matches === 'function' &&
            el.hasAttribute('data-field-index') &&
            el.matches('[role="radio"], [role="checkbox"], [role="option"]'));
    }

    function gridRowLabel(el: Element): string {
        const group = el.closest('[role="group"], [role="radiogroup"]');
        if (group) {
            const labelEl = group.querySelector('.V4d7Ke.wzWPxe');
            const labelText = labelEl ? ((labelEl as HTMLElement).innerText || labelEl.textContent || '').trim() : '';
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

    function gridCellColumnText(el: Element): string {
        const direct = (el.getAttribute('data-answer-value') || el.getAttribute('data-value') || '').trim();
        if (direct) return direct;
        const aria = (el.getAttribute('aria-label') || '').trim();
        const comma = aria.indexOf(',');
        return (comma > 0 ? aria.slice(0, comma) : aria).trim();
    }

    // Groups grid cells into rows: [{ index, label, cells: [{ element, column }] }]
    // Returns [] when the elements are not grid cells.
    function collectGridRows(elements: Element[] | null | undefined): XdGridRowInfo[] {
        const cells = (elements || []).filter(el => isGridCell(el) && !I.isHiddenOrDisabled(el));
        if (cells.length < 2) return [];
        // Group by the row container first: separate grids on the page reuse the
        // same data-field-index values, so index alone would merge their rows.
        const rows: XdGridRowInfo[] = [];
        const byGroup = new Map<Element, XdGridRowInfo>();
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

    I.isGridCell = isGridCell;
    I.gridRowLabel = gridRowLabel;
    I.gridCellColumnText = gridCellColumnText;
    I.collectGridRows = collectGridRows;
})();
