// src/providers/naurok/dom/beta.ts
// Naurok test-beta React UI extraction: question text, choices, text inputs and images.

const BETA_OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface NaurokBetaQuestionState {
    questionText: string;
    optionsText: string;
    validImages: string[];
    isMultiQuiz: boolean;
    questionType: 'multiquiz' | 'quiz' | 'text_input';
}

export function isBetaTest(): boolean {
    return !!document.querySelector('#tb-app[data-mode]') || /^\/test-beta\/(?:play|result)\//.test(location.pathname);
}

export function getBetaQuestionState(): NaurokBetaQuestionState | null {
    if (!isBetaTest()) return null;

    const question = document.querySelector('.tb-stagebox .tb-question, .tb-question.is-main, .tb-question');
    if (!question) return null;

    const text = (question.querySelector('.tb-question-text') as HTMLElement | null)?.innerText.trim() || '';
    if (!text) return null;

    const answers = Array.from(document.querySelectorAll<HTMLElement>('.tb-answers .tb-answer'))
        .filter(answer => !answer.closest('[aria-hidden="true"]') && answer.offsetParent !== null);
    const optionsText = answers.map((answer, index) => {
        const optionText = answer.innerText
            .replace((answer.querySelector('.tb-answer-key') as HTMLElement | null)?.innerText || '', '')
            .trim();
        return (BETA_OPTION_LABELS[index] || String(index + 1)) + ': ' + (optionText || '[зображення]');
    }).join('\n');

    const input = document.querySelector<HTMLInputElement>('.tb-type-answer input.tb-big-input, input.tb-big-input');
    if (!optionsText && !input) return null;

    const validImages = Array.from(question.querySelectorAll<HTMLImageElement>('.tb-question-img, .tb-question-text img, img'))
        .map(image => image.currentSrc || image.src)
        .filter(src => !!src && !src.startsWith('data:image/gif'));

    const isMultiQuiz = answers.length > 0 && !!document.querySelector('.tb-answer-tick, .tb-answers + button:not([disabled])');
    return {
        questionText: text,
        optionsText,
        validImages: [...new Set(validImages)],
        isMultiQuiz,
        questionType: input ? 'text_input' : (isMultiQuiz ? 'multiquiz' : 'quiz')
    };
}

export function betaQuestionContainer(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.tb-stagebox') || document.querySelector<HTMLElement>('#tb-app');
}
