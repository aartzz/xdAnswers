// src/providers/kahoot/dom/question.ts
// Kahoot question extraction: question text, answer options and image URLs.
export interface KahootQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    isMulti?: boolean;
    container: HTMLElement | null;
}

function extractElementTextWithMath(el: Element): string {
    const clone = el.cloneNode(true) as HTMLElement;
    // Format KaTeX or MathML elements
    clone.querySelectorAll('math').forEach(m => {
        const alt = m.getAttribute('alttext');
        if (alt) m.replaceWith(` ${alt} `);
    });
    clone.querySelectorAll('.katex-html').forEach(k => {
        k.remove(); // keep mathml / latex text if present
    });
    clone.querySelectorAll('sup').forEach(s => {
        s.textContent = `^(${s.textContent || ''})`;
    });
    clone.querySelectorAll('sub').forEach(s => {
        s.textContent = `_(${s.textContent || ''})`;
    });
    return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
}

export function readQuestion(): KahootQuestionState | null {
    // Find question text — support modern block-title, n-kahoot-p and question-title
    const questionEl = document.querySelector(
        '[data-functional-selector="block-title"], .n-kahoot-p, [data-functional-selector*="question"], [data-testid="question-title"]'
    );
    if (!questionEl) return null;

    const text = extractElementTextWithMath(questionEl);
    if (!text) return null;

    // Find option buttons — support answers, pointer choices, choices class
    let optionEls = document.querySelectorAll(
        '[data-functional-selector^="answer-"], [data-functional-selector*="answer"], [data-testid="fitg-pointer-choice"]'
    );
    if (optionEls.length === 0) {
        optionEls = document.querySelectorAll('.choices__choice, [class*="choice"], button[role="radio"], button[role="checkbox"]');
    }

    const options = Array.from(optionEls).map(el => extractElementTextWithMath(el)).filter(Boolean);

    // Check for images in the question
    const questionContainer = questionEl.closest('[data-testid="question-screen"], [class*="question"], div');
    const imageUrls: string[] = [];

    // Prioritize Kahoot media container image
    const mediaImg = document.querySelector('img[data-functional-selector="media-container__media-image"], [data-functional-selector="media-container"] img') as HTMLImageElement | null;
    if (mediaImg && mediaImg.src && !mediaImg.src.startsWith('data:image/gif')) {
        imageUrls.push(mediaImg.src);
    }

    if (questionContainer) {
        questionContainer.querySelectorAll('img').forEach(img => {
            if (img.src && !img.src.startsWith('data:image/gif') && !imageUrls.includes(img.src)) {
                imageUrls.push(img.src);
            }
        });
    }

    const hasNumberInput = !!document.querySelector('.numb-item, input[type="number"], input[data-testid="pin-input"]');
    const isMulti = !!document.querySelector('[data-functional-selector*="multi-select"], [data-testid*="multi-select"], button[role="checkbox"]');

    return {
        text,
        options,
        imageUrls,
        questionType: (options.length > 0 && !hasNumberInput) ? 'choice' : 'text',
        isMulti,
        container: (questionContainer as HTMLElement | null) || questionEl.parentElement
    };
}
