// src/providers/classtime/dom/question.ts
// Classtime question extraction: text, options, categories, items, images.

export interface ClasstimeQuestionState {
    text: string;
    options: string[];
    categories: string[];
    items: string[];
    questionType: 'choice' | 'text' | 'categorization' | 'dragdrop';
    isCategorization: boolean;
    isDND: boolean;
    imageContainer: HTMLElement;
    oneclickContainer: HTMLElement | null;
}

export function readQuestion(): ClasstimeQuestionState | null {
    const isCategorization = !!document.querySelector('[data-testid="student-categorizer-answers-form"]');
    const isDND = !!document.querySelector('[data-testid="draggable-item"], [draggable="true"]');

    const questionSelectors = ['[data-p3-hint]', '.question-text', '[data-testid="question-text"]', 'h1', 'h2', '.task-title'];
    let questionEl: HTMLElement | null = null;
    for (let i = 0; i < questionSelectors.length; i++) {
        questionEl = document.querySelector<HTMLElement>(questionSelectors[i]);
        if (questionEl) break;
    }
    if (!questionEl) return null;

    const questionText = questionEl.innerText.trim();
    if (!questionText) return null;

    const optionEls = document.querySelectorAll<HTMLElement>('[data-testid="choice-wrapper"], .answer-option, [data-testid="answer-option"], .choice');
    const options = Array.from(optionEls).map(function(el) { return el.innerText.trim(); }).filter(Boolean);

    let categories: string[] = [];
    let items: string[] = [];
    if (isCategorization) {
        const catEls = document.querySelectorAll<HTMLElement>('[data-testid="category-header"], .category-title');
        categories = Array.from(catEls).map(function(el) { return el.innerText.trim(); }).filter(Boolean);
        const itemEls = document.querySelectorAll<HTMLElement>('[data-testid="categorizer-item"], .categorizer-item, [data-testid="draggable-item"]');
        items = Array.from(itemEls).map(function(el) { return el.innerText.trim(); }).filter(Boolean);
    }

    const imageContainer = (questionEl.closest('[data-testid="question"], .question, [class*="question"]') as HTMLElement | null) || document.body;
    const oneclickContainer = (questionEl.closest('[data-testid="question-container"], .question') as HTMLElement | null) || questionEl.parentElement;

    let questionType: ClasstimeQuestionState['questionType'] = 'choice';
    if (isCategorization) questionType = 'categorization';
    else if (isDND) questionType = 'dragdrop';
    else if (options.length === 0) questionType = 'text';

    return {
        text: questionText,
        options: options,
        categories: categories,
        items: items,
        questionType: questionType,
        isCategorization: isCategorization,
        isDND: isDND,
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
