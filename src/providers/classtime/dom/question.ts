// src/providers/classtime/dom/question.ts
// Classtime question extraction: text, options, categories, items, images.

export interface ClasstimeQuestionState {
    text: string;
    options: string[];
    categories: string[];
    items: string[];
    questionType: 'choice' | 'text' | 'categorization' | 'dragdrop' | 'sorter' | 'highlight';
    isCategorization: boolean;
    isDND: boolean;
    isSorter?: boolean;
    isHighlight?: boolean;
    imageContainer: HTMLElement;
    oneclickContainer: HTMLElement | null;
}

export function readQuestion(): ClasstimeQuestionState | null {
    const isCategorization = !!document.querySelector('[data-testid="student-categorizer-answers-form"]');
    const isSorter = !!document.querySelector('[data-testid="student-sorter-choice"]');
    const isHighlight = !!document.querySelector('[data-testid="highlight-text-choice"]');
    const isDND = !isCategorization && !isSorter && !!document.querySelector('[data-testid="draggable-item"], [draggable="true"]');

    const questionSelectors = [
        '[data-p3-hint]',
        '[data-testid="student-test-question-area"]',
        '.question-text',
        '[data-testid="question-text"]',
        'h1',
        'h2',
        '.task-title'
    ];
    let questionEl: HTMLElement | null = null;
    for (let i = 0; i < questionSelectors.length; i++) {
        questionEl = document.querySelector<HTMLElement>(questionSelectors[i]);
        if (questionEl && questionEl.innerText.trim()) break;
    }
    if (!questionEl) return null;

    const questionText = questionEl.innerText.trim();
    if (!questionText) return null;

    let options: string[] = [];
    if (isSorter) {
        const sorterEls = document.querySelectorAll<HTMLElement>('[data-testid="student-sorter-choice"]');
        options = Array.from(sorterEls).map(el => el.innerText.trim()).filter(Boolean);
    } else if (isHighlight) {
        const hlEls = document.querySelectorAll<HTMLElement>('[data-testid="highlight-text-choice"]');
        options = Array.from(hlEls).map(el => el.innerText.trim()).filter(Boolean);
    } else {
        const optionEls = document.querySelectorAll<HTMLElement>(
            '[data-testid="choice-wrapper"], .answer-option, [data-testid="answer-option"], .choice, [data-testid="student-test-question-area"] BUTTON'
        );
        options = Array.from(optionEls).map(el => {
            const label = el.querySelector('.MuiTypography-button, span, [data-text="true"]');
            return ((label as HTMLElement)?.innerText || el.innerText || '').trim();
        }).filter(Boolean);
    }

    let categories: string[] = [];
    let items: string[] = [];
    if (isCategorization) {
        const catEls = document.querySelectorAll<HTMLElement>(
            '[data-testid="category-header-cell"] [data-text="true"], [data-testid="category-header"], .category-title'
        );
        categories = Array.from(catEls).map(el => el.innerText.trim()).filter(Boolean);

        const itemEls = document.querySelectorAll<HTMLElement>(
            'tr[data-testid="question-answer-row"] th [data-text="true"], [data-testid="categorizer-item"], .categorizer-item, [data-testid="draggable-item"]'
        );
        items = Array.from(itemEls).map(el => el.innerText.trim()).filter(Boolean);
    }

    const imageContainer = (questionEl.closest('[data-testid="question"], .question, [class*="question"]') as HTMLElement | null) || document.body;
    const oneclickContainer = (questionEl.closest('[data-testid="question-container"], .question') as HTMLElement | null) || questionEl.parentElement;

    const hasTextarea = !!document.querySelector('.styles__textarea-da062d, textarea');

    let questionType: ClasstimeQuestionState['questionType'] = 'choice';
    if (isCategorization) questionType = 'categorization';
    else if (isSorter) questionType = 'sorter';
    else if (isHighlight) questionType = 'highlight';
    else if (isDND) questionType = 'dragdrop';
    else if (hasTextarea || options.length === 0) questionType = 'text';

    return {
        text: questionText,
        options: options,
        categories: categories,
        items: items,
        questionType: questionType,
        isCategorization: isCategorization,
        isDND: isDND,
        isSorter: isSorter,
        isHighlight: isHighlight,
        imageContainer: imageContainer,
        oneclickContainer: oneclickContainer
    };
}

export function loadImages(container: HTMLElement): Promise<string[]> {
    const imgPromises: Array<Promise<string | null>> = [];
    container.querySelectorAll<HTMLImageElement>('img').forEach(function(img) {
        imgPromises.push(window.xdAnswers.imageToBase64(img.src));
    });
    return Promise.all(imgPromises).then(function(images) {
        return images.filter(function(img): img is string { return img !== null; });
    });
}
