// src/providers/wayground/dom/question.ts
// Wayground question and options extraction: multiple choice, true/false, fill-in-blank.

export interface WaygroundQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    inputElement: HTMLInputElement | null;
    container: HTMLElement | null;
}

export function readQuestion(): WaygroundQuestionState | null {
    // 1. Locate question text
    const questionEl = document.querySelector<HTMLElement>(
        '[class*="questionText"], [class*="question-title"], [data-testid="question-text"], .task-text, .question-content, h1, h2'
    );
    if (!questionEl) return null;

    const text = (questionEl.innerText || '').trim();
    if (!text) return null;

    // 2. Locate options
    const optionEls = document.querySelectorAll<HTMLElement>(
        'button[class*="option"], [class*="option-item"], [class*="choice"], .answer-option, [role="button"][class*="answer"]'
    );
    const options = Array.from(optionEls).map(el => (el.innerText || '').trim()).filter(Boolean);

    // 3. Locate fill-in-the-blank input
    const inputEl = document.querySelector<HTMLInputElement>(
        'input[type="text"], [class*="blank"] input, [class*="fill"] input, .task-input'
    );

    // 4. Collect images
    const container = questionEl.closest<HTMLElement>('[class*="question-card"], [class*="task-container"], [class*="quiz"], body');
    const imageUrls: string[] = [];

    if (container) {
        container.querySelectorAll('img').forEach(img => {
            if (img.src && !img.src.startsWith('data:image/gif') && !imageUrls.includes(img.src)) {
                imageUrls.push(img.src);
            }
        });
    }

    const qType: WaygroundQuestionState['questionType'] = (options.length > 0) ? 'choice' : 'text';

    return {
        text,
        options,
        imageUrls,
        questionType: qType,
        inputElement: inputEl || null,
        container: container || questionEl.parentElement
    };
}
