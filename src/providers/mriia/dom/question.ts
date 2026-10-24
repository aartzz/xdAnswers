// src/providers/mriia/dom/question.ts
// Mriia (school.mriia.gov.ua) question extraction: test questions, choices, images and homework inputs.

export interface MriiaQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    isMulti: boolean;
    inputElement: HTMLInputElement | HTMLTextAreaElement | null;
    container: HTMLElement | null;
}

function normalize(s: string | null | undefined): string {
    return (s || '').replace(/\s+/g, ' ').trim();
}

export function readQuestion(): MriiaQuestionState | null {
    // 1. Locate active test or question container
    const questionSelectors = [
        '.active > .label-number-test ~ div',
        '.test-choiser-title',
        '.question-title',
        '.test-question-title',
        '.test-question-text',
        '.homework-description',
        '.test-pd h4, .test-pd h5',
        '.data-lesson-tests .test-title',
        '[data-testid="question-text"]',
        'h3, h4, h5'
    ];

    let questionEl: HTMLElement | null = null;
    for (const sel of questionSelectors) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && normalize(el.innerText)) {
            questionEl = el;
            break;
        }
    }

    // Fallback: look for card container or question area
    const container = questionEl?.closest<HTMLElement>(
        '.test-choiser-container, .test-pd, .data-lesson-tests, .homework-content, .card, [class*="test-card"], body'
    ) || document.body;

    let text = questionEl ? normalize(questionEl.innerText) : '';

    // 2. Locate answer choices (.test-choiser-card, .test-choiser-zone, .form-check)
    const cardOptionEls = Array.from(
        container.querySelectorAll<HTMLElement>('.test-choiser-card, .test-choiser-zone')
    );

    let optionEls: HTMLElement[] = [];
    if (cardOptionEls.length > 0) {
        optionEls = cardOptionEls;
    } else {
        optionEls = Array.from(
            container.querySelectorAll<HTMLElement>('.form-check:not(.d-none), [class*="answer-option"], label.form-check-label')
        );
    }

    const options: string[] = [];
    const imageUrls: string[] = [];

    optionEls.forEach(el => {
        // Extract option text from input placeholder, value or text container
        const textInput = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            '.test-choiser-input input, .test-choiser-input textarea, input[type="text"], textarea'
        );
        let optText = textInput ? (textInput.value || textInput.getAttribute('placeholder') || '') : '';
        if (!optText) {
            optText = normalize((el as HTMLElement).innerText);
        }

        const img = el.querySelector<HTMLImageElement>('.test-choiser-img img, img');
        if (img && img.src && !img.src.startsWith('data:image/gif')) {
            if (!imageUrls.includes(img.src)) imageUrls.push(img.src);
            if (!optText) optText = '[зображення]';
        }

        if (optText) options.push(optText);
    });

    // 3. Collect question images
    if (questionEl) {
        const qParent = questionEl.parentElement || questionEl;
        qParent.querySelectorAll<HTMLImageElement>('img').forEach(img => {
            if (img.src && !img.src.startsWith('data:image/gif') && !imageUrls.includes(img.src)) {
                imageUrls.push(img.src);
            }
        });
    }

    // 4. Locate open text input / textarea if choice options not found
    const inputElement = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        '.homework-answer-text textarea, .homework-answer-content textarea, textarea.form-control, input.form-control.ellipsis-input, input[type="text"].form-control'
    );

    if (!text && options.length === 0 && !inputElement) return null;
    if (!text && options.length > 0) text = 'Оберіть правильну відповідь:';

    const hasCheckboxes = container.querySelectorAll('input[type="checkbox"]').length > 0;
    const qType: MriiaQuestionState['questionType'] = options.length > 0 ? 'choice' : 'text';

    return {
        text,
        options,
        imageUrls,
        questionType: qType,
        isMulti: hasCheckboxes,
        inputElement: inputElement || null,
        container
    };
}
