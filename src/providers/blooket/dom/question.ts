// src/providers/blooket/dom/question.ts
// Blooket question and options extraction: text, answer buttons, feedback overlay and images.

export interface BlooketQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    container: HTMLElement | null;
    feedbackEl: HTMLElement | null;
}

export function readQuestion(): BlooketQuestionState | null {
    // 1. Check feedback overlay (e.g. Correct/Incorrect or Next Question modal)
    const feedbackEl = document.querySelector<HTMLElement>(
        '[class*="feedbackContainer"], [class*="feedback"], [class*="Feedback"], [class*="modalOverlay"]'
    );

    // 2. Locate active question container in #app
    const app = document.querySelector('#app') || document.body;
    const questionEl = app.querySelector<HTMLElement>(
        '[class*="questionText"], [class*="QuestionText"], [class*="question-text"], [data-testid="question-text"], h1, h2'
    );
    if (!questionEl && !feedbackEl) return null;

    const text = questionEl ? (questionEl.innerText || '').trim() : '';

    // 3. Find answer choices
    const optionEls = app.querySelectorAll<HTMLElement>(
        '[class*="answerContainer"], [class*="AnswerContainer"], [class*="answerButton"], [class*="AnswerButton"], [class*="answersHolder"] > div, [role="button"][class*="answer"]'
    );
    const options = Array.from(optionEls).map(el => (el.innerText || '').trim()).filter(Boolean);

    // 4. Collect images from question wrapper and options
    const questionWrapper = questionEl ? questionEl.closest<HTMLElement>('[class*="questionContainer"], [class*="gameContainer"], [class*="questionWrapper"], #app > div') : null;
    const imageUrls: string[] = [];

    if (questionWrapper) {
        questionWrapper.querySelectorAll('img').forEach(img => {
            if (img.src && !img.src.startsWith('data:image/gif') && !imageUrls.includes(img.src)) {
                imageUrls.push(img.src);
            }
        });
    }

    return {
        text,
        options,
        imageUrls,
        questionType: options.length > 0 ? 'choice' : 'text',
        container: questionWrapper || (questionEl ? questionEl.parentElement : null),
        feedbackEl: feedbackEl || null
    };
}
