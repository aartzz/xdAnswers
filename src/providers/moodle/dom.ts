// src/providers/moodle/dom.ts
// Moodle DOM extraction: question text, type detection, options, matching pairs and images.
export interface MoodleQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    container: HTMLElement;
}

export interface MoodleDomApi {
    getText(el: Element | null): string;
    readQuestion(): MoodleQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    function getText(el: Element | null): string {
        return ((el as HTMLElement | null)?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function readQuestion(): MoodleQuestionState | null {
        // Moodle uses .que class for questions
        const questionEl = document.querySelector('.que');
        if (!questionEl) return null;

        const qtextEl = questionEl.querySelector('.qtext');
        if (!qtextEl) return null;

        let questionText = getText(qtextEl);
        if (!questionText) return null;

        // Detect question type
        const isMultiChoice = questionEl.classList.contains('multichoice') || questionEl.classList.contains('calculatedmulti');
        const isTrueFalse = questionEl.classList.contains('truefalse');
        const isMatch = questionEl.classList.contains('match');

        const options: string[] = [];
        let questionType: 'choice' | 'text' = 'text';

        if (isMultiChoice || isTrueFalse) {
            questionEl.querySelectorAll('.answer .r0, .answer .r1, .answer > div').forEach(el => {
                const label = el.querySelector('label');
                if (label) {
                    const text = getText(label);
                    if (text) options.push(text);
                } else {
                    const text = getText(el);
                    if (text && text.length < 500) options.push(text);
                }
            });
            questionType = 'choice';
        } else if (isMatch) {
            const matchEls = questionEl.querySelectorAll('.matchtable tr');
            let matchText = questionText + '\n\nMatching pairs:';
            matchEls.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    matchText += '\n- ' + getText(cells[0]) + ' → ' + getText(cells[1]);
                }
            });
            questionText = matchText;
            questionType = 'text';
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
            questionType,
            container: questionEl as HTMLElement
        };
    }

    function loadImages(urls: string[]): Promise<string[]> {
        return Promise.all(urls.map(url => window.xdAnswers.imageToBase64(url)))
            .then(images => images.filter((img): img is string => img !== null));
    }

    const api: MoodleDomApi = { getText, readQuestion, loadImages };
    const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
    const provider = (modules.moodle = modules.moodle || {});
    provider.dom = api;
})();
