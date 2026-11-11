// src/providers/amplify/answer/helpers.ts
// Shared primitives for applying answers to Desmos widgets.

import { cleanText } from '../dom/util';

const ANSWER_PREFIX = /^\s*(?:FINAL_ANSWER|ANSWER|Відповідь|Ответ)\s*:\s*/i;
const KEY_VALUE = /^([A-Za-z]\d+)\s*[:=]\s*(.+)$/;

export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function stripAnswer(raw: string): string {
    return String(raw || '')
        .replace(/```[a-zA-Z]*\s*/g, '')
        .replace(/```/g, '')
        .replace(ANSWER_PREFIX, '')
        .trim();
}

export function normalized(value: string): string {
    return cleanText(value)
        .toLowerCase()
        .replace(/[«»"'`]/g, '')
        .replace(/[–—−]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

export function similarity(a: string, b: string): number {
    const internal = window.xdAnswers._internal;
    if (internal && typeof internal.textSimilarity === 'function') {
        return internal.textSimilarity(a, b);
    }
    if (a === b) return 1;
    if (!a || !b) return 0;
    const longer = a.length >= b.length ? a : b;
    const shorter = a.length < b.length ? a : b;
    return longer.includes(shorter) ? shorter.length / longer.length : 0;
}

export function findBestByText<T>(needle: string, items: T[], getText: (item: T) => string): T | null {
    const target = normalized(needle);
    if (!target) return null;
    let best: T | null = null;
    let bestScore = 0;
    for (const item of items) {
        const text = normalized(getText(item));
        if (!text) continue;
        if (text === target) return item;
        if (text.includes(target) || target.includes(text)) return item;
        const score = similarity(text, target);
        if (score > bestScore) {
            bestScore = score;
            best = item;
        }
    }
    return bestScore > 0.62 ? best : null;
}

export function parseKeyValues(answerText: string): Map<string, string> {
    const values = new Map<string, string>();
    stripAnswer(answerText).split(/[;\n]+/).forEach(block => {
        const match = KEY_VALUE.exec(cleanText(block));
        if (match) values.set(match[1].toUpperCase(), match[2].trim());
    });
    return values;
}

export function sequenceValues(answerText: string): string[] {
    return stripAnswer(answerText)
        .split(/[;\n]+/)
        .map(part => part.replace(/^\s*\d+[.)]\s*/, '').trim())
        .filter(Boolean);
}

export function clickChoiceElement(element: HTMLElement): void {
    const input = element.matches('input')
        ? element as HTMLInputElement
        : element.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
    if (input) {
        if (input.disabled) return;
        if ((input.type === 'radio' || input.type === 'checkbox') && input.checked) return;
        input.click();
        return;
    }
    element.click();
}

export function submitComponent(element: HTMLElement): void {
    const component = element.closest<HTMLElement>('[data-component-type]') || element;
    const button = component.querySelector<HTMLButtonElement>(
        '.dcg-textarea-submit-button, .submit-and-edit-button button, .table-submit-button'
    );
    if (!button || button.disabled || button.classList.contains('disabled')) return;
    setTimeout(() => {
        if (button.isConnected && !button.disabled && !button.classList.contains('disabled')) {
            button.click();
        }
    }, 350);
}

export function setProseMirror(input: HTMLElement, text: string): boolean {
    if (!input.isConnected) return false;
    const value = cleanText(text);
    if (!value) return false;
    if (cleanText(input.innerText || input.textContent) === value) return true;

    try {
        input.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(input);
        selection?.removeAllRanges();
        selection?.addRange(range);
        if (document.execCommand('insertText', false, value)) {
            input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
            return true;
        }
    } catch (e) { /* fall through */ }

    input.textContent = value;
    input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: value
    }));
    return true;
}

export function plainMath(answerText: string): string {
    return stripAnswer(answerText)
        .replace(/^\$+|\$+$/g, '')
        .replace(/\\left|\\right/g, '')
        .replace(/\\cdot/g, '*')
        .replace(/\\times/g, '*')
        .replace(/\\div/g, '/')
        .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)')
        .replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)')
        .replace(/\\[a-zA-Z]+/g, ' ')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function setMathField(field: HTMLElement, text: string): boolean {
    if (!field.isConnected) return false;
    const value = plainMath(text);
    if (!value) return false;

    const textarea = field.querySelector<HTMLTextAreaElement>('textarea');
    if (textarea) {
        textarea.focus();
        try {
            textarea.setSelectionRange(0, textarea.value.length);
            if (document.execCommand('insertText', false, value)) {
                return true;
            }
        } catch (e) { /* fall through */ }

        textarea.value = value;
        try {
            textarea.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                inputType: 'insertText',
                data: value
            }));
        } catch (e) {
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return true;
    }

    try {
        field.focus();
        for (const char of value) {
            field.dispatchEvent(new KeyboardEvent('keypress', {
                key: char,
                charCode: char.charCodeAt(0),
                keyCode: char.charCodeAt(0),
                which: char.charCodeAt(0),
                bubbles: true,
                cancelable: true
            }));
        }
        return true;
    } catch (e) {
        return false;
    }
}

function keyCodeFor(key: string): number {
    const map: Record<string, number> = {
        Enter: 13,
        Escape: 27,
        Home: 36,
        End: 35,
        ArrowUp: 38,
        ArrowDown: 40,
        ArrowLeft: 37,
        ArrowRight: 39,
        ' ': 32
    };
    if (map[key] !== undefined) return map[key];
    return key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0;
}

export function dispatchKey(element: HTMLElement, key: string, code = key): void {
    element.focus();
    const keyCode = keyCodeFor(key);
    const init: KeyboardEventInit = {
        key,
        code,
        keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true
    };
    for (const type of ['keydown', 'keypress', 'keyup']) {
        element.dispatchEvent(new KeyboardEvent(type, init));
    }
}

export function explanationText(parsed?: XdParsedResponse): string {
    if (!parsed) return '';
    const explanation = cleanText(parsed.explanation || '');
    const solution = cleanText(parsed.solution || '');
    if (solution && explanation) return `${explanation} ${solution}`;
    return solution || explanation;
}

export async function fillExplanation(parsed?: XdParsedResponse): Promise<boolean> {
    const value = explanationText(parsed);
    if (!value) return false;

    const screen = document.querySelector<HTMLElement>('.dcg-student-screen.current-screen') || document;
    const findInputs = (): HTMLElement[] => Array.from(screen.querySelectorAll<HTMLElement>(
        '.dcg-explain-your-answer .ProseMirror[contenteditable="true"], [data-component-type="disconnected-explain"] .ProseMirror[contenteditable="true"]'
    )).filter(input => input.isConnected);

    let inputs: HTMLElement[] = [];
    for (let attempt = 0; attempt < 16; attempt++) {
        inputs = findInputs();
        if (inputs.length) break;
        await wait(250);
    }
    if (!inputs.length) return false;

    let applied = false;
    for (const input of inputs) {
        if (setProseMirror(input, value)) {
            applied = true;
            const container = input.closest<HTMLElement>('.dcg-explain-your-answer') || input.closest<HTMLElement>('[data-component-type]') || input;
            submitComponent(container);
        }
    }
    return applied;
}
