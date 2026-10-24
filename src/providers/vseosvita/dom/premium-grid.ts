// src/providers/vseosvita/dom/premium-grid.ts
// vseosvita premium grid collectors (Google Forms-style CSS heuristics): matrix,
// likert, linear scale, generic dropdown and date/time inputs.
import type { VseosvitaMeta } from './index';
import { normalize } from './text';

// checkboxGrid: multiple choice matrix (.mxSrOe rows, .uVccjd checkboxes)
export function collectCheckboxGrid(questionRoot: Element): VseosvitaMeta | null {
    const rows = Array.from(questionRoot.querySelectorAll('.mxSrOe'));
    if (rows.length === 0) return null;
    const items = rows.map((row, idx) => {
        const label = normalize(row.querySelector('.Wtw8H, .RHiBW')?.textContent) || `Рядок ${idx + 1}`;
        const checks = Array.from(row.querySelectorAll('.uVccjd')).map(cb => ({
            text: normalize(cb.querySelector('.aDTYNe, .docssharedWizToggleLabeledLabelText')?.textContent) || '',
            element: cb.querySelector('input[type="checkbox"]') || cb
        })).filter(c => c.text);
        return { label, checks };
    }).filter(r => r.checks.length > 0);
    if (items.length === 0) return null;
    return { formatType: 'checkbox_grid', rows: items };
}

// likert: radio button matrix / grid (.lLfZXe radiogroups, .Od2TWd radios)
export function collectLikert(questionRoot: Element): VseosvitaMeta | null {
    const groups = Array.from(questionRoot.querySelectorAll('.lLfZXe'));
    if (groups.length === 0) return null;
    const items = groups.map((group, idx) => {
        const label = normalize(group.querySelector('.Wtw8H, .RHiBW')?.textContent) || `Рядок ${idx + 1}`;
        const radios = Array.from(group.querySelectorAll('.Od2TWd')).map(r => ({
            text: normalize(r.querySelector('.aDTYNe, .docssharedWizToggleLabeledLabelText')?.textContent) || '',
            element: r.querySelector('input[type="radio"]') || r
        })).filter(r => r.text);
        return { label, radios };
    }).filter(r => r.radios.length > 0);
    if (items.length === 0) return null;
    return { formatType: 'likert', rows: items };
}

// scale: linear scale 1-10 (.N9Qcwe container, .T5pZmf items)
export function collectScale(questionRoot: Element): VseosvitaMeta | null {
    const container = questionRoot.querySelector('.N9Qcwe');
    if (!container) return null;
    const items = Array.from(container.querySelectorAll('.T5pZmf')).map(el => ({
        text: normalize(el.textContent) || '',
        element: el.querySelector('input[type="radio"]') || el
    })).filter(i => i.text);
    if (items.length === 0) return null;
    return { formatType: 'scale', items };
}

// generic dropdown (.jgvuAb[role="listbox"] with .MocG8c[role="option"] options)
export function collectGenericDropdown(questionRoot: Element): VseosvitaMeta | null {
    const listbox = questionRoot.querySelector('.jgvuAb[role="listbox"]');
    if (!listbox) return null;
    const options = Array.from(questionRoot.querySelectorAll('.MocG8c[role="option"]')).map(opt => ({
        text: normalize(opt.textContent) || '',
        element: opt
    })).filter(o => o.text);
    if (options.length === 0) return null;
    return { formatType: 'dropdown', element: listbox, options };
}

// date / time inputs
export function collectDateTime(questionRoot: Element): VseosvitaMeta | null {
    const dateInput = questionRoot.querySelector('input[type="date"]');
    const timeInputs = questionRoot.querySelectorAll('input[jsname="MKaSrf"], input[jsname="QbtXXe"]');
    if (!dateInput && timeInputs.length === 0) return null;
    return {
        formatType: 'date_time',
        dateElement: dateInput || null,
        timeElements: Array.from(timeInputs)
    };
}
