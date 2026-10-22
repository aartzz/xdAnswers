// src/providers/gimkit/dom/question.ts
// Gimkit question and options extraction: live game DOM, choice options, text inputs and images.

export interface GimkitQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    inputElement: HTMLInputElement | null;
    container: HTMLElement | null;
}

export function readQuestion(): GimkitQuestionState | null {
    // 1. Locate question text
    const questionEl = document.querySelector<HTMLElement>(
        '[class*="questionText"], [class*="QuestionText"], [class*="Question"], [data-testid="question-text"], .notranslate h1, .notranslate h2, .notranslate'
    );
    if (!questionEl) return null;

    const text = (questionEl.innerText || '').trim();
    if (!text) return null;

    // 2. Locate choices
    let optionEls = document.querySelectorAll<HTMLElement>(
        'button[class*="Option"], button[class*="option"], [class*="optionContainer"] button, [class*="Choice"], [class*="choice"], [role="button"][class*="option"]'
    );
    if (optionEls.length === 0) {
        optionEls = document.querySelectorAll<HTMLElement>('.notranslate[role="button"]');
    }

    const options = Array.from(optionEls).map(el => (el.innerText || '').trim()).filter(Boolean);

    // 3. Locate text input if no choices exist
    const inputEl = document.querySelector<HTMLInputElement>(
        'input[type="text"], input[data-testid="text-input"], [class*="inputContainer"] input'
    );

    // 4. Collect images
    const container = questionEl.closest<HTMLElement>('[class*="questionContainer"], [class*="gameContainer"], [class*="screen"], body');
    const imageUrls: string[] = [];

    if (container) {
        container.querySelectorAll('img').forEach(img => {
            if (img.src && !img.src.startsWith('data:image/gif') && !imageUrls.includes(img.src)) {
                imageUrls.push(img.src);
            }
        });
    }

    const qType: GimkitQuestionState['questionType'] = (options.length > 0) ? 'choice' : 'text';

    return {
        text,
        options,
        imageUrls,
        questionType: qType,
        inputElement: inputEl || null,
        container: container || questionEl.parentElement
    };
}
