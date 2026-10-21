// src/providers/kahoot/dom/question.ts
// Kahoot question extraction: question text, answer options and image URLs.
export interface KahootQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    container: HTMLElement | null;
}

export function readQuestion(): KahootQuestionState | null {
    // Find question text — InRoute uses .n-kahoot-p
    const questionEl = document.querySelector('.n-kahoot-p');
    if (!questionEl) return null;

    const text = ((questionEl as HTMLElement).innerText || '').trim();
    if (!text) return null;

    // Find option buttons — Kahoot uses data-functional-selector for answers
    let optionEls = document.querySelectorAll('[data-functional-selector^="answer-"], [data-functional-selector*="answer"]');
    if (optionEls.length === 0) {
        optionEls = document.querySelectorAll('.choices__choice, [class*="choice"], button[role="radio"]');
    }

    const options = Array.from(optionEls).map(el => ((el as HTMLElement).innerText || '').trim()).filter(Boolean);

    // Check for images in the question
    const questionContainer = questionEl.closest('[data-testid="question-screen"], [class*="question"], div');
    const imageUrls: string[] = [];
    if (questionContainer) {
        questionContainer.querySelectorAll('img').forEach(img => {
            imageUrls.push(img.src);
        });
    }

    return {
        text,
        options,
        imageUrls,
        questionType: options.length > 0 ? 'choice' : 'text',
        container: (questionContainer as HTMLElement | null) || questionEl.parentElement
    };
}
