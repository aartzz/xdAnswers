// src/providers/kahoot/dom.ts
// Kahoot DOM layer: question text, answer options, images, numeric/text input lookup.
export interface KahootQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    container: HTMLElement | null;
}

export interface KahootDomApi {
    findInputElement(): HTMLInputElement | null;
    readQuestion(): KahootQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

    // Kahoot uses data-functional-selector for answer inputs
    // Numeric input has type="number" or type="text" inside the answer area
    function findInputElement(): HTMLInputElement | null {
        const el = document.querySelector('[data-functional-selector*="answer"] input[type="number"]')
               || document.querySelector('[data-functional-selector*="answer"] input[type="text"]')
               || document.querySelector('[data-functional-selector*="answer"] input')
               || document.querySelector('input[type="number"]')
               || document.querySelector('input[data-functional-selector*="answer"]');
        return el as HTMLInputElement | null;
    }

    function readQuestion(): KahootQuestionState | null {
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

    async function loadImages(urls: string[]): Promise<string[]> {
        const images = await Promise.all(urls.map(url => window.xdAnswers.imageToBase64(url)));
        return images.filter((img): img is string => img !== null);
    }

    const api: KahootDomApi = { findInputElement, readQuestion, loadImages };
    modules.kahoot = modules.kahoot || {};
    modules.kahoot.dom = api;
})();
