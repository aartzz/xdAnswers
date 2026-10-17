// src/providers/testportal/dom.ts
// TestPortal DOM extraction: question text, type detection, options and images.
export interface TestportalQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    container: HTMLElement | null;
}

export interface TestportalDomApi {
    getText(el: Element | null): string;
    readQuestion(): TestportalQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    function getText(el: Element | null): string {
        return ((el as HTMLElement | null)?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function detectQuestionType(questionElement: Element): string {
        const typeInput = questionElement.querySelector('input[name="givenAnswer.questionType"]') as HTMLInputElement | null;
        if (!typeInput) return 'unknown';
        switch (typeInput.value) {
            case 'TRUE_FALSE': return 'trueFalse';
            case 'SINGLE_ANSWER':
            case 'SURVEY': return 'singleChoice';
            case 'MULTI_ANSWER': return 'multipleChoice';
            case 'SHORT_ANSWER': return 'shortAnswer';
            case 'DESCRIPTIVE': return 'openText';
            default: return 'unknown';
        }
    }

    function readQuestion(): TestportalQuestionState | null {
        // TestPortal uses specific question containers
        const questionEl = document.querySelector('.question-content, .question-content-wrapper, [class*="question"]');
        if (!questionEl) return null;

        // Extract question text
        const qtextSelectors = ['.question-content .text', '.question-text', '.question-title', 'h3', 'h4'];
        let qtextEl: Element | null = null;
        for (const sel of qtextSelectors) {
            qtextEl = questionEl.querySelector(sel) || questionEl.closest(sel);
            if (qtextEl) break;
        }
        if (!qtextEl) return null;

        const questionText = getText(qtextEl);
        if (!questionText) return null;

        // Detect type
        const type = detectQuestionType(questionEl);
        const isChoice = type === 'singleChoice' || type === 'multipleChoice' || type === 'trueFalse';

        // Extract options
        const options: string[] = [];
        if (isChoice) {
            questionEl.querySelectorAll('.answer-variant, [class*="answer"], label.radio, label.checkbox, .option-label').forEach(el => {
                const text = getText(el);
                if (text && text.length < 500) options.push(text);
            });
        }

        // Collect question image URLs
        const imageUrls: string[] = [];
        qtextEl.querySelectorAll('img').forEach(img => {
            imageUrls.push((img as HTMLImageElement).src);
        });

        return {
            text: questionText,
            options,
            imageUrls,
            questionType: isChoice ? 'choice' : 'text',
            container: questionEl as HTMLElement
        };
    }

    function loadImages(urls: string[]): Promise<string[]> {
        return Promise.all(urls.map(url => window.xdAnswers.imageToBase64(url)))
            .then(images => images.filter((img): img is string => img !== null));
    }

    const api: TestportalDomApi = { getText, readQuestion, loadImages };
    const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
    const provider = (modules.testportal = modules.testportal || {});
    provider.dom = api;
})();
