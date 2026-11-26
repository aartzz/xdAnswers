// src/providers/classtime/dom/question.ts
// Classtime question extraction for every student question kind:
// boolean/single/multiple choice, text, essay, categorizer, sorter,
// highlight-text (cloze), fill-in-the-gap and hotspot.

export type ClasstimeKind =
    | 'choice'
    | 'multiple_choice'
    | 'text'
    | 'essay'
    | 'categorization'
    | 'categorization_multiple'
    | 'sorter'
    | 'cloze'
    | 'gap'
    | 'hotspot';

export interface ClasstimeGapInfo {
    key: string;
    type: 'blank' | 'choice';
    choices: string[];
}

export interface ClasstimeQuestionState {
    kind: ClasstimeKind;
    text: string;
    questionType: string;
    isMulti: boolean;
    options: string[];
    categories: string[];
    items: string[];
    gaps: ClasstimeGapInfo[];
    titleText: string;
    contentText: string;
    imageRoots: HTMLElement[];
    root: HTMLElement;
    oneclickContainer: HTMLElement | null;
    hotspotRequireAll: boolean;
    key: string;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}

function waitFor<T>(fn: () => T | null, timeout = 900, interval = 40): Promise<T | null> {
    const end = Date.now() + timeout;
    return new Promise<T | null>(resolve => {
        const check = (): void => {
            try {
                const value = fn();
                if (value) { resolve(value); return; }
            } catch (e) { /* keep polling */ }
            if (Date.now() >= end) { resolve(null); return; }
            window.setTimeout(check, interval);
        };
        check();
    });
}

function isVisible(el: HTMLElement | null): boolean {
    if (!el) return false;
    if (!el.isConnected) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

/**
 * Rendered text without icon-only controls. The clone keeps line breaks from
 * block elements, so questions with several paragraphs stay readable.
 */
export function elementText(el: Element | null): string {
    if (!el) return '';
    try {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('button, svg, style, script, noscript').forEach(node => node.remove());
        return (clone.innerText || clone.textContent || '')
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    } catch (e) {
        return ((el as HTMLElement).innerText || el.textContent || '').trim();
    }
}

export function collectImages(roots: HTMLElement[]): HTMLImageElement[] {
    const seen = new Set<HTMLImageElement>();
    const images: HTMLImageElement[] = [];
    for (const root of roots) {
        if (!root) continue;
        root.querySelectorAll<HTMLImageElement>('img').forEach(img => {
            if (seen.has(img)) return;
            const src = img.currentSrc || img.src;
            if (!src || src.indexOf('data:image/gif') === 0) return;
            seen.add(img);
            images.push(img);
        });
    }
    return images;
}

interface ClasstimeBase {
    titleText: string;
    contentText: string;
    baseText: string;
    root: HTMLElement;
    bodyRoot: HTMLElement;
    imageRoots: HTMLElement[];
    oneclickContainer: HTMLElement | null;
}

function readBase(): ClasstimeBase | null {
    const titleEl = document.querySelector<HTMLElement>('[data-testid="student-session-question-title"]');
    const bodyRoot = document.querySelector<HTMLElement>('[data-testid="questions-answers-list"]');
    if (!titleEl || !bodyRoot) return null;

    const titleWrapper = titleEl.parentElement;
    const root = (titleWrapper && titleWrapper.parentElement) || titleEl;
    const contentEl = titleWrapper ? (titleWrapper.nextElementSibling as HTMLElement | null) : null;
    const titleText = elementText(titleEl);
    const contentText = elementText(contentEl);

    const textParts: string[] = [];
    if (titleText) textParts.push(titleText);
    if (contentText && contentText !== titleText) textParts.push(contentText);
    const questionText = textParts.join('\n').trim();

    // Side-by-side context material is part of the question in Classtime.
    // Include a bounded excerpt so a long article does not flood the prompt.
    const contextEl = document.querySelector<HTMLElement>('[data-testid="context-material-text"]');
    const contextText = elementText(contextEl);
    const contextExcerpt = contextText.length > 3000 ? contextText.slice(0, 3000) + '…' : contextText;
    const baseText = contextExcerpt
        ? `Контекст:\n${contextExcerpt}\n\nПитання:\n${questionText}`.trim()
        : questionText;

    const imageRoots: HTMLElement[] = [];
    if (root) imageRoots.push(root);
    if (bodyRoot && bodyRoot !== root) imageRoots.push(bodyRoot);

    return {
        titleText,
        contentText,
        baseText,
        root,
        bodyRoot,
        imageRoots,
        oneclickContainer: root
    };
}

function readChoiceOption(wrapper: HTMLElement, images: HTMLImageElement[]): string {
    const label = wrapper.querySelector<HTMLElement>('[data-testid="multiple-answer-choice"]') || wrapper;
    let text = elementText(label);
    const img = label.querySelector<HTMLImageElement>('img');
    if (img) {
        const imageNumber = images.indexOf(img) + 1;
        if (imageNumber > 0) {
            const placeholder = `[зображення ${imageNumber}]`;
            text = text ? `${text} ${placeholder}` : placeholder;
        }
    }
    return text;
}

function readChoice(root: HTMLElement, base: ClasstimeBase): ClasstimeQuestionState | null {
    const wrappers = Array.from(root.querySelectorAll<HTMLElement>('[data-testid="choice-wrapper"]'));
    if (!wrappers.length) return null;

    const images = collectImages(base.imageRoots);
    const options = wrappers.map((wrapper, index) => {
        const text = readChoiceOption(wrapper, images);
        return text || `[варіант ${index + 1}]`;
    });
    const isMulti = wrappers.some(wrapper => !!wrapper.querySelector('input[type="checkbox"]'));
    const kind: ClasstimeKind = isMulti ? 'multiple_choice' : 'choice';
    const text = base.baseText || '[запитання]';
    const key = JSON.stringify([kind, text, options]);

    return {
        kind,
        text,
        questionType: isMulti ? 'quiz' : 'choice',
        isMulti,
        options,
        categories: [],
        items: [],
        gaps: [],
        titleText: base.titleText,
        contentText: base.contentText,
        imageRoots: base.imageRoots,
        root: base.root,
        oneclickContainer: base.oneclickContainer,
        hotspotRequireAll: false,
        key
    };
}

function readCategorizer(root: HTMLElement, base: ClasstimeBase): ClasstimeQuestionState | null {
    const form = root.querySelector<HTMLElement>('[data-testid="student-categorizer-answers-form"]');
    if (!form) return null;

    const categories = Array.from(form.querySelectorAll<HTMLElement>('[data-testid="category-header-cell"]'))
        .map(cell => elementText(cell))
        .filter(Boolean);
    const rows = Array.from(form.querySelectorAll<HTMLElement>('tr[data-testid="question-answer-row"]'));
    const items = rows
        .map(row => elementText(row.querySelector('th')))
        .filter(Boolean);

    if (!categories.length || !items.length) return null;

    const isMulti = !!form.querySelector('input[type="checkbox"]');
    const kind: ClasstimeKind = isMulti ? 'categorization_multiple' : 'categorization';
    const instruction = isMulti
        ? 'Для кожного елемента може бути одна або кілька категорій. У полі answer вкажи всі правильні категорії у форматі: Категорія1: елемент1, елемент2; Категорія2: елемент3. Використовуй точні назви категорій та елементів зі списків.'
        : 'Для кожного елемента вибери одну категорію. У полі answer вкажи результат у форматі: Категорія1: елемент1, елемент2; Категорія2: елемент3. Використовуй точні назви категорій та елементів зі списків.';
    const text = `${base.baseText || '[запитання]'}\n\nКатегорії: ${categories.join(' | ')}\nЕлементи: ${items.join(' | ')}\n\n${instruction}`;
    const key = JSON.stringify([kind, text, categories, items]);

    return {
        kind,
        text,
        questionType: 'categorization',
        isMulti,
        options: [],
        categories,
        items,
        gaps: [],
        titleText: base.titleText,
        contentText: base.contentText,
        imageRoots: base.imageRoots,
        root: base.root,
        oneclickContainer: base.oneclickContainer,
        hotspotRequireAll: false,
        key
    };
}

function readSorter(root: HTMLElement, base: ClasstimeBase): ClasstimeQuestionState | null {
    const wrappers = Array.from(root.querySelectorAll<HTMLElement>('[data-testid="student-sorter-choice-wrapper"]'));
    if (!wrappers.length) return null;

    const options = wrappers.map(wrapper => {
        const content = wrapper.querySelector<HTMLElement>('[data-testid="student-sorter-choice-content"]');
        return elementText(content || wrapper);
    }).filter(Boolean);
    if (!options.length) return null;

    const instruction = 'Розташуй елементи у правильному порядку. У полі answer перерахуй їх через крапку з комою у потрібному порядку: елемент1; елемент2; елемент3. Використовуй точні тексти елементів.';
    const text = `${base.baseText || '[запитання]'}\n\n${instruction}`;
    const key = JSON.stringify(['sorter', text, options]);

    return {
        kind: 'sorter',
        text,
        questionType: 'ordering',
        isMulti: false,
        options,
        categories: [],
        items: [],
        gaps: [],
        titleText: base.titleText,
        contentText: base.contentText,
        imageRoots: base.imageRoots,
        root: base.root,
        oneclickContainer: base.oneclickContainer,
        hotspotRequireAll: false,
        key
    };
}

export interface ClozeGroup {
    key: string;
    element: HTMLElement;
    choices: string[];
}

function groupChoiceLabels(group: HTMLElement): HTMLElement[] {
    return Array.from(group.querySelectorAll<HTMLElement>('[data-testid="highlight-text-choice"]'))
        .filter(label => label.parentElement === group);
}

export function readClozeGroups(root: HTMLElement): ClozeGroup[] {
    const preview = root.querySelector<HTMLElement>('[data-testid="highlight-text-preview"]');
    if (!preview) return [];

    const labels = Array.from(preview.querySelectorAll<HTMLElement>('[data-testid="highlight-text-choice"]'));
    const groupElements: HTMLElement[] = [];
    for (const label of labels) {
        const group = label.parentElement;
        if (group && groupElements.indexOf(group) === -1) groupElements.push(group);
    }

    return groupElements.map((group, index) => ({
        key: `A${index}`,
        element: group,
        choices: groupChoiceLabels(group)
            .map(label => elementText(label.querySelector('[data-testid="highlight-text-choice-content"]') || label))
            .filter(Boolean)
    }));
}

function readCloze(root: HTMLElement, base: ClasstimeBase): ClasstimeQuestionState | null {
    const preview = root.querySelector<HTMLElement>('[data-testid="highlight-text-preview"]');
    if (!preview) return null;

    const groups = readClozeGroups(root);
    if (!groups.length) {
        const plain = elementText(preview);
        if (!plain) return null;
        return {
            kind: 'cloze',
            text: `${base.baseText || '[запитання]'}\n\n${plain}`,
            questionType: 'select_in_text',
            isMulti: true,
            options: [],
            categories: [],
            items: [],
            gaps: [],
            titleText: base.titleText,
            contentText: base.contentText,
            imageRoots: base.imageRoots,
            root: base.root,
            oneclickContainer: base.oneclickContainer,
            hotspotRequireAll: false,
            key: JSON.stringify(['cloze', base.baseText, plain])
        };
    }

    const groupByElement = new Map<HTMLElement, ClozeGroup>();
    const paragraphs: HTMLElement[] = [];
    for (const group of groups) {
        groupByElement.set(group.element, group);
        const paragraph = group.element.closest<HTMLElement>('[class*="clozeContent"]')
            || group.element.parentElement?.parentElement
            || group.element.parentElement;
        if (paragraph && paragraphs.indexOf(paragraph) === -1) paragraphs.push(paragraph);
    }
    paragraphs.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);

    const paragraphTexts: string[] = [];
    for (const paragraph of paragraphs) {
        let out = '';
        const walk = (node: Node): void => {
            if (node.nodeType === Node.TEXT_NODE) {
                out += node.textContent || '';
                return;
            }
            if (!(node instanceof Element)) return;
            const group = groupByElement.get(node as HTMLElement);
            if (group) {
                out += `${group.key} [${group.choices.join(' | ')}]`;
                return;
            }
            if (node.matches('button, svg, style, script, noscript')) return;
            node.childNodes.forEach(walk);
        };
        walk(paragraph);
        const cleaned = out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        if (cleaned) paragraphTexts.push(cleaned);
    }

    const clozeText = paragraphTexts.join('\n\n') || elementText(preview);
    const instruction = 'У тексті є пропуски з ключами A0, A1, A2. Для кожного пропуску обери один або кілька правильних варіантів із квадратних дужок. Якщо у пропуску кілька правильних варіантів, перелічи їх через кому. У полі answer вкажи: A0=обраний_варіант; A1=обраний_варіант.';
    const text = `${base.baseText || '[запитання]'}\n\n${clozeText}\n\n${instruction}`;
    const key = JSON.stringify(['cloze', text, groups.map(group => group.choices)]);

    return {
        kind: 'cloze',
        text,
        questionType: 'select_in_text',
        isMulti: true,
        options: [],
        categories: [],
        items: [],
        gaps: [],
        titleText: base.titleText,
        contentText: base.contentText,
        imageRoots: base.imageRoots,
        root: base.root,
        oneclickContainer: base.oneclickContainer,
        hotspotRequireAll: false,
        key
    };
}

function closeVisibleMenus(): void {
    document.querySelectorAll<HTMLElement>('[role="menu"]').forEach(menu => {
        if (!isVisible(menu)) return;
        menu.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
            cancelable: true
        }));
    });
}

async function readGapChoices(wrapper: HTMLElement, index: number): Promise<string[]> {
    const button = wrapper.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
    if (!button) return [];

    if (button.getAttribute('aria-expanded') !== 'true') {
        button.click();
    }
    const menuId = button.getAttribute('aria-controls') || `gap-${index + 1}-choices`;
    const menu = await waitFor(() => document.getElementById(menuId));
    if (!menu) return [];

    const choices = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .map(item => elementText(item))
        .filter(Boolean);

    closeVisibleMenus();
    await delay(30);
    if (isVisible(menu)) {
        const rect = button.getBoundingClientRect();
        document.body.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + 1,
            clientY: rect.top + 1
        }));
        await delay(30);
    }
    return choices;
}

function gapTextFromDom(container: HTMLElement, keys: Map<HTMLElement, string>): string {
    let out = '';
    const walk = (node: Node): void => {
        if (node.nodeType === Node.TEXT_NODE) {
            out += node.textContent || '';
            return;
        }
        if (!(node instanceof Element)) return;
        const key = keys.get(node as HTMLElement);
        if (key) {
            out += ` ${key} `;
            return;
        }
        if (node.matches('button, svg, style, script, noscript')) return;
        node.childNodes.forEach(walk);
    };
    walk(container);
    return out
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function readGap(root: HTMLElement, base: ClasstimeBase): Promise<ClasstimeQuestionState | null> {
    const wrappers = Array.from(root.querySelectorAll<HTMLElement>('[data-testid="fitg-pointer-choice"], [data-testid="fitg-pointer-blank"]'));
    if (!wrappers.length) return null;

    const container = wrappers[0].closest<HTMLElement>('[class*="styles__textarea"]')
        || root;

    const gaps: ClasstimeGapInfo[] = [];
    const keys = new Map<HTMLElement, string>();
    for (let i = 0; i < wrappers.length; i++) {
        const wrapper = wrappers[i];
        const key = `A${i}`;
        const type: ClasstimeGapInfo['type'] = wrapper.getAttribute('data-testid') === 'fitg-pointer-choice' ? 'choice' : 'blank';
        const choices = type === 'choice' ? await readGapChoices(wrapper, i) : [];
        gaps.push({ key, type, choices });
        keys.set(wrapper, key);
    }

    const gapText = gapTextFromDom(container, keys) || elementText(container);
    const choiceLines = gaps
        .filter(gap => gap.type === 'choice' && gap.choices.length > 0)
        .map(gap => `${gap.key}: [${gap.choices.join(' | ')}]`);
    const instruction = 'Заповни кожен пропуск. Для пропуску з варіантами використовуй ТОЧНИЙ текст одного з варіантів у квадратних дужках. У полі answer вкажи: A0=значення; A1=значення; A2=значення.';
    const text = `${base.baseText || '[запитання]'}\n\n${gapText}\n${choiceLines.length ? '\nВаріанти для пропусків:\n' + choiceLines.join('\n') : ''}\n\n${instruction}`;
    const key = JSON.stringify(['gap', text, gaps.map(gap => [gap.type, gap.choices])]);

    return {
        kind: 'gap',
        text,
        questionType: 'fill_blank',
        isMulti: false,
        options: [],
        categories: [],
        items: [],
        gaps,
        titleText: base.titleText,
        contentText: base.contentText,
        imageRoots: base.imageRoots,
        root: base.root,
        oneclickContainer: base.oneclickContainer,
        hotspotRequireAll: false,
        key
    };
}

function readHotspot(root: HTMLElement, base: ClasstimeBase): ClasstimeQuestionState | null {
    const helper = root.querySelector<HTMLElement>('[data-testid="hotspot-image-coordinates-helper"]');
    if (!helper) return null;

    const image = helper.querySelector<HTMLImageElement>('img.hotspotImage, img');
    if (!image) return null;

    const requireAll = !!helper.querySelector('[data-testid="add-new-point"]');
    const imageNote = 'Останнє прикріплене зображення — це полотно, на якому треба позначити точку. ';
    const instruction = imageNote + (requireAll
        ? 'На зображенні треба позначити одну або кілька точок. Визнач координати кожної потрібної точки у відсотках від ширини та висоти зображення. У полі answer вкажи точки у форматі: x1,y1; x2,y2 (x і y — числа від 0 до 100, без символу %).'
        : 'На зображенні треба позначити одну точку. Визнач її координати у відсотках від ширини та висоти зображення. У полі answer вкажи: x,y (x і y — числа від 0 до 100, без символу %).');
    const text = `${base.baseText || '[запитання]'}\n\n${instruction}`;
    const key = JSON.stringify(['hotspot', text, requireAll]);

    return {
        kind: 'hotspot',
        text,
        questionType: requireAll ? 'hotspot_multi' : 'hotspot',
        isMulti: false,
        options: [],
        categories: [],
        items: [],
        gaps: [],
        titleText: base.titleText,
        contentText: base.contentText,
        imageRoots: base.imageRoots,
        root: base.root,
        oneclickContainer: base.oneclickContainer,
        hotspotRequireAll: requireAll,
        key
    };
}

function readText(root: HTMLElement, base: ClasstimeBase): ClasstimeQuestionState | null {
    const area = root.querySelector<HTMLElement>('[data-testid="student-test-question-area"]');
    if (!area || !area.querySelector('textarea, input[type="text"], [contenteditable="true"]')) return null;

    const text = base.baseText || '[запитання]';
    return {
        kind: 'text',
        text,
        questionType: 'short_text',
        isMulti: false,
        options: [],
        categories: [],
        items: [],
        gaps: [],
        titleText: base.titleText,
        contentText: base.contentText,
        imageRoots: base.imageRoots,
        root: base.root,
        oneclickContainer: base.oneclickContainer,
        hotspotRequireAll: false,
        key: JSON.stringify(['text', text])
    };
}

function readEssay(root: HTMLElement, base: ClasstimeBase): ClasstimeQuestionState | null {
    const editor = root.querySelector<HTMLElement>('[data-testid="essay-input-field"] [data-slate-editor="true"], [data-testid="slate-content-editable"] [data-slate-editor="true"]');
    if (!editor) return null;

    const text = base.baseText || '[запитання]';
    return {
        kind: 'essay',
        text,
        questionType: 'open_ended',
        isMulti: false,
        options: [],
        categories: [],
        items: [],
        gaps: [],
        titleText: base.titleText,
        contentText: base.contentText,
        imageRoots: base.imageRoots,
        root: base.root,
        oneclickContainer: base.oneclickContainer,
        hotspotRequireAll: false,
        key: JSON.stringify(['essay', text])
    };
}

/**
 * Cheap identity check used before the full extraction. Gap extraction opens
 * each choice menu, so it must never run again for the same visible question.
 */
export function readSignature(): string | null {
    const base = readBase();
    if (!base) return null;
    const numberEl = document.querySelector<HTMLElement>('[data-testid="student-session-question-number"]');
    return JSON.stringify([elementText(numberEl), base.titleText, base.contentText]);
}

export async function readQuestion(): Promise<ClasstimeQuestionState | null> {
    const base = readBase();
    if (!base) return null;

    const root = base.bodyRoot;
    const categorizer = readCategorizer(root, base);
    if (categorizer) return categorizer;

    const cloze = readCloze(root, base);
    if (cloze) return cloze;

    const sorter = readSorter(root, base);
    if (sorter) return sorter;

    const hotspot = readHotspot(root, base);
    if (hotspot) return hotspot;

    const gap = await readGap(root, base);
    if (gap) return gap;

    const essay = readEssay(root, base);
    if (essay) return essay;

    const text = readText(root, base);
    if (text) return text;

    const choice = readChoice(root, base);
    if (choice) return choice;

    return null;
}

function compatibleText(previous: string, current: string): boolean {
    if (previous === current) return true;
    if (!previous || !current) return !previous && !current;
    const length = Math.min(80, previous.length, current.length);
    return length > 0 && previous.slice(0, length) === current.slice(0, length);
}

export function isQuestionCurrent(state: ClasstimeQuestionState): boolean {
    if (!state.root.isConnected) return false;
    const titleEl = document.querySelector<HTMLElement>('[data-testid="student-session-question-title"]');
    if (!titleEl) return false;
    const titleWrapper = titleEl.parentElement;
    const contentEl = titleWrapper ? (titleWrapper.nextElementSibling as HTMLElement | null) : null;
    return compatibleText(state.titleText, elementText(titleEl))
        && compatibleText(state.contentText, elementText(contentEl));
}

export function loadImages(roots: HTMLElement[]): Promise<string[]> {
    const images = collectImages(roots);
    const promises: Array<Promise<string | null>> = images.map(img => window.xdAnswers.imageToBase64(img.currentSrc || img.src));
    return Promise.all(promises).then(values => values.filter((value): value is string => !!value));
}
