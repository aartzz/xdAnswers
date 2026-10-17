// src/providers/lcloud/dom.ts
// lcloud.in.ua DOM layer: question text, answer options, images, question type.
export interface LcloudQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: string;
    container: HTMLElement | null;
}

export interface LcloudDomApi {
    readQuestion(): LcloudQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

    // lcloud.in.ua question selectors
    const QUESTION_SELECTORS = [
        '.question-text',
        '.test-question',
        '.task-text',
        '.question-content',
        '.q-text',
        '[data-question-text]',
        'h1',
        'h2',
        'h3'
    ];

    const OPTION_SELECTORS = [
        '.answer-option',
        '.option-item',
        '.test-option',
        '.answer-item',
        '.choice',
        '[data-option]',
        'label'
    ];

    function getText(el: Element | null): string {
        return ((el as HTMLElement | null)?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function readQuestion(): LcloudQuestionState | null {
        let questionEl: Element | null = null;
        for (const sel of QUESTION_SELECTORS) {
            questionEl = document.querySelector(sel);
            if (questionEl) break;
        }
        if (!questionEl) return null;

        const text = getText(questionEl);
        if (!text) return null;

        // Detect options
        const options: string[] = [];
        const seen = new Set<string>();
        for (const sel of OPTION_SELECTORS) {
            document.querySelectorAll(sel).forEach(el => {
                const optionText = getText(el);
                if (!optionText || seen.has(optionText)) return;
                seen.add(optionText);
                options.push(optionText);
            });
        }

        // Detect inputs (text / textarea)
        const textInputs = Array.from(document.querySelectorAll('input[type="text"], textarea'));
        const hasTextInput = textInputs.length > 0;

        // Detect true/false
        const trueFalseButtons = document.querySelectorAll('.true-false-btn, [data-type="true-false"], button[value="true"], button[value="false"]');
        const isTrueFalse = trueFalseButtons.length >= 2;

        // Detect drag-and-drop / categorization
        const dragItems = document.querySelectorAll('[draggable="true"], .draggable, .drag-item');
        const dropZones = document.querySelectorAll('.drop-zone, .drop-target, .category-zone');
        const isDND = dragItems.length > 0 && dropZones.length > 0;

        // Detect matching
        const matchingLeft = document.querySelectorAll('.matching-left, .match-source');
        const matchingRight = document.querySelectorAll('.matching-right, .match-target');
        const isMatching = matchingLeft.length > 0 && matchingRight.length > 0;

        let questionType = 'choice';
        if (isTrueFalse) questionType = 'true_false';
        else if (isDND) questionType = 'dragdrop';
        else if (isMatching) questionType = 'matching';
        else if (hasTextInput && options.length === 0) questionType = 'short_text';
        else if (options.length > 1) questionType = 'choice';
        else if (options.length === 0) questionType = 'short_text';

        // Collect images
        const imageContainer = questionEl.closest('.question, .test-item, [class*="question"]') || document.body;
        const imageUrls: string[] = [];
        imageContainer.querySelectorAll('img').forEach(img => {
            if (img.src) imageUrls.push(img.src);
        });

        const container = (questionEl.closest('.question, .test-item, [class*="question"]') as HTMLElement | null) || questionEl.parentElement;
        return { text, options, imageUrls, questionType, container };
    }

    async function loadImages(urls: string[]): Promise<string[]> {
        const images = await Promise.all(urls.map(url => window.xdAnswers.imageToBase64(url)));
        return images.filter((img): img is string => img !== null);
    }

    const api: LcloudDomApi = { readQuestion, loadImages };
    modules.lcloud = modules.lcloud || {};
    modules.lcloud.dom = api;
})();
