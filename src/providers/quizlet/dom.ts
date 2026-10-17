// src/providers/quizlet/dom.ts
// Quizlet DOM extraction: question text, MCQ options and question images.
export interface QuizletQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    container: HTMLElement | null;
}

export interface QuizletDomApi {
    readQuestion(): QuizletQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    function readQuestion(): QuizletQuestionState | null {
        // Quizlet uses data-testid attributes
        const questionTextEl = document.querySelector('[data-testid="Question Text"] .FormattedText');
        if (!questionTextEl) return null;

        const text = (questionTextEl as HTMLElement).innerText.trim();
        if (!text) return null;

        // Find MCQ options
        const mcqContainer = document.querySelector('[data-testid="MCQ Answers"]');
        const options: string[] = [];
        if (mcqContainer) {
            mcqContainer.querySelectorAll('[data-testid="MCQ Answer"]').forEach(el => {
                const textEl = el.querySelector('.FormattedText');
                const value = ((textEl || el) as HTMLElement).innerText.trim();
                if (value) options.push(value);
            });
        }

        // Collect question image URLs
        const imageUrls: string[] = [];
        const questionContainer = document.querySelector('[data-testid="Question Text"]');
        if (questionContainer) {
            questionContainer.querySelectorAll('img').forEach(img => {
                imageUrls.push((img as HTMLImageElement).src);
            });
            // Also check for background images
            const bgImgEl = questionContainer.querySelector('.Image-image') as HTMLElement | null;
            if (bgImgEl && bgImgEl.style.backgroundImage) {
                const bgUrl = bgImgEl.style.backgroundImage.slice(5, -2);
                if (bgUrl) imageUrls.push(bgUrl);
            }
        }

        return {
            text,
            options,
            imageUrls,
            questionType: options.length > 0 ? 'choice' : 'text',
            container: (document.querySelector('[data-testid="question"]') || questionContainer) as HTMLElement | null
        };
    }

    function loadImages(urls: string[]): Promise<string[]> {
        return Promise.all(urls.map(url => window.xdAnswers.imageToBase64(url)))
            .then(images => images.filter((img): img is string => img !== null));
    }

    const api: QuizletDomApi = { readQuestion, loadImages };
    const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
    const provider = (modules.quizlet = modules.quizlet || {});
    provider.dom = api;
})();
