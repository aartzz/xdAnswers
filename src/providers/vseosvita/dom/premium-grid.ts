// src/providers/vseosvita/dom/premium-grid.ts
// Google Forms-style grids, likert, linear scale, dropdowns and date/time
// inputs. The old implementation keyed off obfuscated CSS classes such as
// .mxSrOe/.uVccjd; those classes are regenerated on deploy and after reload,
// so detection here uses stable structure instead: roles, aria-* labels and
// data-field-index attributes.
import type { VseosvitaMeta } from './index';
import { normalize } from './text';

function isHiddenOrDisabled(el: Element): boolean {
    if (el.closest('[aria-hidden="true"]')) return true;
    if (el.getAttribute('aria-disabled') === 'true') return true;
    return false;
}

function textOf(el: Element | null | undefined): string {
    if (!el) return '';
    return normalize((el as HTMLElement).innerText || el.textContent || '');
}

function ariaLabelledText(el: Element): string {
    const id = el.getAttribute('aria-labelledby');
    if (!id) return '';
    return id.split(/\s+/)
        .map(part => textOf(document.getElementById(part)))
        .filter(Boolean)
        .join(' ');
}

function rowLabel(group: Element, cell: Element): string {
    const aria = normalize(group.getAttribute('aria-label') || '');
    if (aria) return aria;
    const labelled = ariaLabelledText(group);
    if (labelled) return labelled;
    const heading = textOf(group.querySelector('[role="heading"]'));
    if (heading) return heading;
    const cellAria = cell.getAttribute('aria-label') || '';
    const comma = cellAria.indexOf(',');
    return comma >= 0
        ? normalize(cellAria.slice(comma + 1).replace(/^(?:відповідь\s+для|answer\s+for)\s*:?\s*/i, ''))
        : '';
}

// Structural fallback for environments where the shared grid helper is not
// available. The shared helper is preferred because the matching code uses the
// same row grouping.
function collectRowsLocally(cells: Element[]): XdGridRowInfo[] {
    const rows: XdGridRowInfo[] = [];
    const byGroup = new Map<Element, XdGridRowInfo>();

    for (const cell of cells) {
        const group = cell.closest('[role="group"], [role="radiogroup"]') || cell.parentElement || cell;
        let row = byGroup.get(group);
        if (!row) {
            const raw = cell.getAttribute('data-field-index') || group.getAttribute('data-field-index');
            const parsed = raw === null ? NaN : parseInt(raw, 10);
            row = {
                index: Number.isNaN(parsed) ? rows.length : parsed,
                label: rowLabel(group, cell),
                cells: []
            };
            byGroup.set(group, row);
            rows.push(row);
        }
        const fieldIndex = cell.getAttribute('data-field-index') || group.getAttribute('data-field-index');
        let column = normalize(cell.getAttribute('data-answer-value') || cell.getAttribute('data-value') || '');
        if (!column) {
            const aria = cell.getAttribute('aria-label') || '';
            const comma = aria.indexOf(',');
            column = normalize(comma >= 0 ? aria.slice(0, comma) : aria);
        }
        if (!column) column = `Стовпець ${row.cells.length + 1}`;
        row.cells.push({ element: cell, column });
        if (fieldIndex !== null && !cell.hasAttribute('data-field-index')) {
            cell.setAttribute('data-field-index', fieldIndex);
        }
    }

    rows.sort((a, b) => a.index - b.index);
    return rows;
}

function collectGridRows(cells: Element[]): XdGridRowInfo[] {
    const shared = window.xdAnswers?._internal?.collectGridRows;
    if (typeof shared === 'function') {
        const rows = shared(cells);
        if (rows.length > 0) return rows;
    }
    return collectRowsLocally(cells);
}

// checkboxGrid: rows x checkbox columns. Cells are radio/checkbox roles with
// data-field-index; no class names involved.
export function collectCheckboxGrid(questionRoot: Element): VseosvitaMeta | null {
    const cells = Array.from(questionRoot.querySelectorAll(
        '[data-field-index][role="checkbox"], [data-field-index][role="option"]'
    )).filter(el => !isHiddenOrDisabled(el));
    if (cells.length < 2) return null;

    const rows = collectGridRows(cells).map((row, rowIndex) => ({
        label: row.label || `Рядок ${rowIndex + 1}`,
        checks: row.cells.map((cell, cellIndex) => ({
            text: cell.column || `Стовпець ${cellIndex + 1}`,
            element: cell.element
        }))
    })).filter(row => row.checks.length > 0);

    if (rows.length < 2) return null;
    return { formatType: 'checkbox_grid', rows };
}

// likert: rows x radio columns. The role/data-field-index structure is the
// same as a checkbox grid, so class rotation does not matter.
export function collectLikert(questionRoot: Element): VseosvitaMeta | null {
    const cells = Array.from(questionRoot.querySelectorAll(
        '[data-field-index][role="radio"]'
    )).filter(el => !isHiddenOrDisabled(el));
    if (cells.length < 2) return null;

    const rows = collectGridRows(cells).map((row, rowIndex) => ({
        label: row.label || `Рядок ${rowIndex + 1}`,
        radios: row.cells.map((cell, cellIndex) => ({
            text: cell.column || textOf(cell.element) || `Стовпець ${cellIndex + 1}`,
            element: cell.element
        }))
    })).filter(row => row.radios.length > 0);

    if (rows.length < 2) return null;
    return { formatType: 'likert', rows };
}

// scale: one horizontal radiogroup (linear scale 1-10). A normal quiz uses a
// vertical radiogroup, so require either numeric labels or a single visual row.
export function collectScale(questionRoot: Element): VseosvitaMeta | null {
    const groups = Array.from(questionRoot.querySelectorAll('[role="radiogroup"], [role="group"]'));
    for (const group of groups) {
        if (isHiddenOrDisabled(group)) continue;
        const radios = Array.from(group.querySelectorAll('[role="radio"]'))
            .filter(el => !isHiddenOrDisabled(el));
        if (radios.length < 3) continue;
        // Grid/likert rows use data-field-index and are handled separately.
        if (radios.some(el => el.hasAttribute('data-field-index') || el.closest('[data-field-index]'))) continue;

        const items = radios.map(el => ({ text: textOf(el), element: el }))
            .filter(item => item.text);
        if (items.length !== radios.length) continue;

        const numeric = items.every(item => /^\d+(?:[.,]\d+)?$/.test(item.text));
        const tops = radios.map(el => el.getBoundingClientRect().top);
        const sameRow = Math.max(...tops) - Math.min(...tops) < 8;
        if (!numeric && !sameRow) continue;

        return { formatType: 'scale', items };
    }
    return null;
}

// generic dropdown: a role=listbox with role=option children. The options may
// be hidden while the menu is closed; the applier reopens it by text.
export function collectGenericDropdown(questionRoot: Element): VseosvitaMeta | null {
    const listboxes = Array.from(questionRoot.querySelectorAll('[role="listbox"]'));
    for (const listbox of listboxes) {
        if (isHiddenOrDisabled(listbox)) continue;
        const options = Array.from(listbox.querySelectorAll('[role="option"]'))
            .filter(el => !isHiddenOrDisabled(el))
            .map(el => ({ text: textOf(el), element: el }))
            .filter(option => option.text);
        if (options.length === 0) continue;
        return { formatType: 'dropdown', element: listbox, options };
    }
    return null;
}

// date / time inputs. Prefer standard input types; keep the Google Forms
// jsname attributes as a fallback because those are stable identifiers, not
// generated CSS classes.
export function collectDateTime(questionRoot: Element): VseosvitaMeta | null {
    const dateInput = questionRoot.querySelector(
        'input[type="date"], input[type="datetime-local"], input[jsname="MKaSrf"]'
    );
    const timeInputs = Array.from(questionRoot.querySelectorAll(
        'input[type="time"], input[jsname="QbtXXe"]'
    )).filter(el => !isHiddenOrDisabled(el));
    if (!dateInput && timeInputs.length === 0) return null;
    return {
        formatType: 'date_time',
        dateElement: dateInput || null,
        timeElements: timeInputs
    };
}
