// src/providers/gforms/dom.ts
// Google Forms DOM layer: hidden/disabled filtering, grid (rows x columns) parsing, payload building.
export interface GformsGridPayload {
    optionsText: string;
    isMulti: boolean;
}

export interface GformsDomApi {
    isHiddenOrDisabled(el: Element): boolean;
    collectGrid(container: Element): GformsGridPayload | null;
    buildQuestionData(container: Element): Promise<XdQuestionData>;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

    // Google Forms renders grid questions twice: the interactive grid plus a
    // hidden print copy (inside [aria-hidden="true"]) whose cells are
    // aria-disabled and dead to clicks. Skip those everywhere.
    function isHiddenOrDisabled(el: Element): boolean {
        return !!el.closest('[aria-hidden="true"]') || el.getAttribute('aria-disabled') === 'true';
    }

    // Grid ("Сітка") questions: rows of examples × columns of answers.
    // Cells hold no text (only an icon), so build a rows/columns description
    // for the AI and mark the question as type 'grid'. Returns null for
    // regular questions.
    function collectGrid(container: Element): GformsGridPayload | null {
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

    function buildQuestionData(container: Element): Promise<XdQuestionData> {
        const titleEl = container.querySelector('.M7eMe, .GEHe6, [role="heading"]');
        const questionText = ((titleEl ? (titleEl as HTMLElement).innerText : (container as HTMLElement).innerText) || '').trim();
        const grid = collectGrid(container);
        const imgPromises: Array<Promise<string | null>> = [];
        container.querySelectorAll('img').forEach(img => {
            const src = img.src || img.getAttribute('data-src');
            if (src && !src.startsWith('data:image/gif')) {
                const absoluteSrc = new URL(src, window.location.href).href;
                imgPromises.push(window.xdAnswers.imageToBase64(absoluteSrc));
            }
        });
        return Promise.all(imgPromises).then(images => {
            if (grid) {
                return {
                    text: questionText,
                    optionsText: grid.optionsText,
                    base64Images: images.filter((i): i is string => i !== null),
                    questionType: 'grid',
                    isMulti: grid.isMulti
                };
            }
            const optionEls = container.querySelectorAll('[data-xd-option="true"]');
            const options = Array.from(optionEls).map(el => ((el as HTMLElement).innerText || '').trim()).filter(Boolean);
            const hasCheckboxes = container.querySelectorAll('[role="checkbox"]').length > 0;
            return {
                text: questionText,
                optionsText: options.join('\n') || undefined,
                base64Images: images.filter((i): i is string => i !== null),
                questionType: options.length > 0 ? 'quiz' : 'general',
                isMulti: hasCheckboxes
            };
        });
    }

    const api: GformsDomApi = { isHiddenOrDisabled, collectGrid, buildQuestionData };
    modules.gforms = modules.gforms || {};
    modules.gforms.dom = api;
})();
