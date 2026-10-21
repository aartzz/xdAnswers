// src/providers/gforms/dom/grid.ts
// Google Forms grid ("Сітка") parsing and hidden/disabled cell filtering.

export interface GformsGridPayload {
    optionsText: string;
    isMulti: boolean;
}

// Google Forms renders grid questions twice: the interactive grid plus a
// hidden print copy (inside [aria-hidden="true"]) whose cells are
// aria-disabled and dead to clicks. Skip those everywhere.
export function isHiddenOrDisabled(el: Element): boolean {
    return !!el.closest('[aria-hidden="true"]') || el.getAttribute('aria-disabled') === 'true';
}

// Grid ("Сітка") questions: rows of examples × columns of answers.
// Cells hold no text (only an icon), so build a rows/columns description
// for the AI and mark the question as type 'grid'. Returns null for
// regular questions.
export function collectGrid(container: Element): GformsGridPayload | null {
    const gridRows = window.xdAnswers._internal.collectGridRows(
        Array.from(container.querySelectorAll('[data-field-index]'))
    );
    if (gridRows.length < 2) return null;

    const columns: string[] = [];
    for (const row of gridRows) {
        for (const cell of row.cells) {
            if (cell.column && !columns.includes(cell.column)) columns.push(cell.column);
        }
    }
    if (!columns.length) return null;

    const lines = gridRows.map((row, i) => {
        const label = (row.label || '').replace(/\s+/g, ' ').trim();
        return `${i + 1}. ${label || 'рядок ' + (i + 1)}`;
    });
    const isMulti = gridRows.some(row => row.cells.some(cell => cell.element.getAttribute('role') === 'checkbox'));
    return {
        optionsText: 'Рядки (для кожного рядка обери стовпець):\n' + lines.join('\n') +
            '\n\nСтовпці (варіанти відповіді):\n' + columns.map(c => c.replace(/\s+/g, ' ').trim()).join(' | '),
        isMulti: isMulti
    };
}
