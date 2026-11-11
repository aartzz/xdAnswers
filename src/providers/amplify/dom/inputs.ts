// src/providers/amplify/dom/inputs.ts
// Reads free-response, math-response, explain and table input elements.

export function isExplainElement(el: Element): boolean {
    return !!el.closest('.dcg-explain-your-answer, [data-component-type="disconnected-explain"]');
}

export function collectTextInputs(screen: HTMLElement): HTMLElement[] {
    return Array.from(screen.querySelectorAll<HTMLElement>('[data-component-type="input/text"] .ProseMirror[contenteditable="true"]'))
        .filter(input => !isExplainElement(input));
}

export function collectMathInputs(screen: HTMLElement): HTMLElement[] {
    return Array.from(screen.querySelectorAll<HTMLElement>('[data-component-type="input/expression"] .dcg-mq-editable-field'))
        .filter(input => !isExplainElement(input));
}

export function collectExplainInputs(screen: HTMLElement): HTMLElement[] {
    return Array.from(screen.querySelectorAll<HTMLElement>(
        '.dcg-explain-your-answer .ProseMirror[contenteditable="true"], [data-component-type="disconnected-explain"] .ProseMirror[contenteditable="true"]'
    ));
}

export function collectTableCells(screen: HTMLElement): HTMLElement[] {
    return Array.from(screen.querySelectorAll<HTMLElement>('[data-component-type="table"] .dcg-table-cell'))
        .filter(cell => !cell.classList.contains('add-new-row-cell'))
        .filter(cell => !!cell.querySelector('.ProseMirror[contenteditable="true"], .dcg-mq-editable-field'));
}
