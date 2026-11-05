// src/providers/testix/dom/question.ts
// Testix play page: extract the currently visible question form. Testix renders
// every question up front and toggles forms with Alpine's x-show, so the active
// form is the only one whose computed display is not "none".
//
// Supported layouts:
//   matching  - match rows ([data-drop-slot]) against a shared option pool
//   choice    - radio inputs wrapped in labels
//   multi     - checkbox inputs wrapped in labels
//   text      - one text input
//   text_multi- several text inputs
//   ordering  - [data-order-id] items controlled by the ordering component
//   categorize- [data-drop-bin] categories with draggable items

export type TestixQuestionKind =
    | 'matching'
    | 'choice'
    | 'multi'
    | 'text'
    | 'text_multi'
    | 'ordering'
    | 'categorize';

export interface TestixOption {
    id: string;
    text: string;
    element: HTMLElement;
    input: HTMLInputElement;
}

export interface TestixMatchingLeft {
    id: string;
    text: string;
    slot: HTMLButtonElement;
    row: HTMLElement;
}

export interface TestixMatchingRight {
    id: string;
    text: string;
    button: HTMLButtonElement;
}

export interface TestixMatchingState {
    root: HTMLElement;
    lefts: TestixMatchingLeft[];
    rights: TestixMatchingRight[];
}

export interface TestixTextInput {
    element: HTMLInputElement | HTMLTextAreaElement;
    label: string;
}

export interface TestixOrderItem {
    id: string;
    text: string;
    element: HTMLElement;
}

export interface TestixCategoryBin {
    id: string;
    text: string;
    element: HTMLElement;
}

export interface TestixQuestionState {
    id: string;
    text: string;
    kind: TestixQuestionKind;
    container: HTMLFormElement;
    options: TestixOption[];
    textInputs: TestixTextInput[];
    imageUrls: string[];
    matching: TestixMatchingState | null;
    orderingItems: TestixOrderItem[];
    categoryBins: TestixCategoryBin[];
}

const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF\u2060]/g;

export function cleanText(value: string | null | undefined): string {
    return String(value || '')
        .replace(ZERO_WIDTH, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim();
}

function absoluteUrl(src: string): string {
    try {
        return new URL(src, location.href).href;
    } catch (e) {
        return src;
    }
}

function isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function findActiveForm(): HTMLFormElement | null {
    const forms = Array.from(document.querySelectorAll<HTMLFormElement>('form[data-question]'));
    for (const form of forms) {
        if (!form.hidden && isVisible(form)) return form;
    }
    return null;
}

function directQuestionText(form: HTMLFormElement): string {
    const directParagraphs = Array.from(form.children)
        .filter((child): child is HTMLParagraphElement => child.tagName === 'P');
    const preferred = directParagraphs.find(p => p.classList.contains('text-lg')) || directParagraphs[0];
    if (preferred) {
        const text = cleanText(preferred.innerText || preferred.textContent);
        if (text) return text;
    }
    const fallback = form.querySelector<HTMLElement>('p.text-lg, h1, h2, h3');
    return cleanText(fallback?.innerText || fallback?.textContent || '');
}

function questionImages(form: HTMLFormElement): string[] {
    const urls: string[] = [];
    const seen = new Set<string>();
    const images = Array.from(form.querySelectorAll<HTMLImageElement>('img[src]'));
    for (const image of images) {
        if (image.closest('[data-test="lightbox"]')) continue;
        const src = image.getAttribute('src') || '';
        if (!src || src.startsWith('data:')) continue;
        const absolute = absoluteUrl(src);
        if (seen.has(absolute)) continue;
        seen.add(absolute);
        urls.push(absolute);
    }
    return urls;
}

function matchingId(element: Element, prefix: string): string {
    const key = element.getAttribute('wire:key') || '';
    if (key.startsWith(prefix)) return key.slice(prefix.length);
    const click = element.getAttribute('x-on:click') || element.getAttribute('@click') || '';
    const match = /(?:tapOption|tapSlot)\('([^']+)'\)/.exec(click);
    return match ? match[1] : '';
}

function findLeftRow(slot: HTMLButtonElement, root: HTMLElement): HTMLElement {
    let node: HTMLElement | null = slot.parentElement;
    while (node && node !== root) {
        if ((node.getAttribute('wire:key') || '').startsWith('left-')) return node;
        node = node.parentElement;
    }
    return slot.parentElement || slot;
}

function matchingLeftText(slot: HTMLButtonElement, row: HTMLElement): string {
    const aria = cleanText(slot.getAttribute('aria-label'));
    const fromAria = cleanText(aria.replace(/^Відповідь\s+для\s*:\s*/i, ''));
    if (fromAria) return fromAria;
    const spans = Array.from(row.querySelectorAll<HTMLElement>('span'));
    for (const span of spans) {
        const text = cleanText(span.innerText || span.textContent);
        if (text && text !== 'Не обрано') return text;
    }
    return '[зображення]';
}

function readMatching(form: HTMLFormElement): TestixMatchingState | null {
    const root = form.querySelector<HTMLElement>('[x-data*="matching("]');
    if (!root) return null;

    const lefts: TestixMatchingLeft[] = [];
    const slots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-drop-slot]'));
    for (const slot of slots) {
        const id = slot.dataset.dropSlot || matchingId(slot, 'left-');
        if (!id) continue;
        const row = findLeftRow(slot, root);
        slot.classList.add('opt');
        lefts.push({
            id,
            text: matchingLeftText(slot, row),
            slot,
            row
        });
    }

    const rights: TestixMatchingRight[] = [];
    const pool = root.querySelector<HTMLElement>('[data-drop-pool]') || root;
    const buttons = Array.from(pool.querySelectorAll<HTMLButtonElement>('button'));
    for (const button of buttons) {
        const id = matchingId(button, 'right-');
        const text = cleanText(button.innerText || button.textContent);
        if (!id || !text) continue;
        button.classList.add('opt');
        rights.push({ id, text, button });
    }

    if (!lefts.length || !rights.length) return null;
    return { root, lefts, rights };
}

function inputLabel(input: HTMLInputElement | HTMLTextAreaElement): string {
    const aria = cleanText(input.getAttribute('aria-label'));
    if (aria) return aria;
    const placeholder = cleanText(input.getAttribute('placeholder'));
    if (placeholder) return placeholder;
    const label = input.closest('label');
    if (label) {
        const text = cleanText((label as HTMLElement).innerText || label.textContent);
        if (text) return text;
    }
    const name = cleanText(input.getAttribute('name'));
    return name || 'Поле відповіді';
}

function readChoiceOptions(form: HTMLFormElement): TestixOption[] {
    const options: TestixOption[] = [];
    const inputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]'));
    for (const input of inputs) {
        if (input.disabled) continue;
        const label = input.closest<HTMLElement>('label') || input.parentElement;
        if (!label) continue;
        const textEl = label.querySelector<HTMLElement>('span.min-w-0, span');
        const text = cleanText(textEl?.innerText || textEl?.textContent || label.innerText || label.textContent);
        const hasImage = !!label.querySelector('img');
        label.classList.add('opt');
        options.push({
            id: input.value || '',
            text: text || (hasImage ? '[зображення]' : ''),
            element: label,
            input
        });
    }
    return options;
}

function readOrdering(form: HTMLFormElement): TestixOrderItem[] {
    // Categorization items share data-order-id with the ordering component and
    // are addressed by the same tap handlers.
    const root = form.querySelector<HTMLElement>('[x-data*="ordering("]')
        || form.querySelector<HTMLElement>('[x-data*="categorize("]');
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>('[data-order-id]')).map(element => {
        element.classList.add('opt');
        return {
            id: element.dataset.orderId || '',
            text: cleanText(element.getAttribute('aria-label') || element.innerText || element.textContent),
            element
        };
    }).filter(item => !!item.id);
}

function readCategoryBins(form: HTMLFormElement): TestixCategoryBin[] {
    const root = form.querySelector<HTMLElement>('[x-data*="categorize("]');
    if (!root) return [];
    const bins = Array.from(root.querySelectorAll<HTMLElement>('[data-drop-bin]'));
    return bins.map(element => {
        element.classList.add('opt');
        const heading = element.querySelector<HTMLElement>('h1, h2, h3, h4, [data-bin-title], [data-slot="heading"]');
        let text = cleanText(
            element.getAttribute('aria-label')
            || heading?.innerText
            || heading?.textContent
        );
        if (!text) {
            // Drop the placed items before reading the label: innerText of the
            // whole bin would otherwise mix the category name with its items.
            const clone = element.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('[data-order-id], button, img, svg').forEach(node => node.remove());
            text = cleanText(clone.textContent).split('\n')[0] || '';
        }
        return {
            id: element.dataset.dropBin || '',
            text,
            element
        };
    }).filter(bin => !!bin.id && !!bin.text);
}

function readTextInputs(form: HTMLFormElement): TestixTextInput[] {
    const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input[type="text"], input:not([type]), textarea'
    ));
    return inputs.filter(input => !input.disabled && !input.readOnly && input.offsetParent !== null)
        .map(input => ({ element: input, label: inputLabel(input) }));
}

function readOptionImages(options: TestixOption[]): string[] {
    const urls: string[] = [];
    for (const option of options) {
        const image = option.element.querySelector<HTMLImageElement>('img[src]');
        const src = image?.getAttribute('src') || '';
        if (src && !src.startsWith('data:')) urls.push(absoluteUrl(src));
    }
    return urls;
}

export function readQuestion(): TestixQuestionState | null {
    const form = findActiveForm();
    if (!form) return null;

    const matching = readMatching(form);
    const orderingItems = readOrdering(form);
    const categoryBins = readCategoryBins(form);
    const choiceOptions = readChoiceOptions(form);
    const textInputs = readTextInputs(form);
    const images = questionImages(form);

    let kind: TestixQuestionKind;
    if (matching) {
        kind = 'matching';
    } else if (categoryBins.length > 0) {
        kind = 'categorize';
    } else if (orderingItems.length > 0) {
        kind = 'ordering';
    } else if (choiceOptions.length > 0) {
        kind = choiceOptions.some(option => option.input.type === 'checkbox') ? 'multi' : 'choice';
    } else if (textInputs.length > 1) {
        kind = 'text_multi';
    } else if (textInputs.length === 1) {
        kind = 'text';
    } else {
        return null;
    }

    let text = directQuestionText(form);
    if (!text) {
        const alt = cleanText(form.querySelector<HTMLImageElement>('img[alt]')?.getAttribute('alt'));
        text = alt || (images.length > 0 ? '[Завдання на зображенні]' : '');
    }
    if (!text) return null;

    const optionImages = readOptionImages(choiceOptions);
    const imageUrls = Array.from(new Set([...images, ...optionImages]));

    return {
        id: form.dataset.itemId || '',
        text,
        kind,
        container: form,
        options: choiceOptions,
        textInputs,
        imageUrls,
        matching,
        orderingItems,
        categoryBins
    };
}

function retryImageUrl(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.pathname = parsed.pathname.replace(/-thumb(\.[^./]+)$/, '$1');
        return parsed.href;
    } catch (e) {
        return url;
    }
}

export async function loadImages(urls: string[]): Promise<string[]> {
    const images = await Promise.all(urls.map(async url => {
        const full = retryImageUrl(url);
        const first = await window.xdAnswers.imageToBase64(full);
        if (first) return first;
        if (full !== url) return window.xdAnswers.imageToBase64(url);
        return null;
    }));
    return images.filter((image): image is string => image !== null);
}
