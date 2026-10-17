// src/providers/naurok/dom.ts
// DOM extraction for the Naurok provider: scene state, session id, question
// text, answer options and images. Publishes its API on
// window.xdAnswers._internal.providerModules.naurok.dom for main.ts.

export interface NaurokQuestionState {
    questionText: string;
    optionsText: string;
    optionImageUrls: string[];
    validImages: string[];
    isMultiQuiz: boolean;
    questionType: 'multiquiz' | 'quiz';
}

export interface NaurokDomApi {
    getSceneBlocked(): boolean;
    parseSessionIdFromDOM(): number | null;
    getQuestionState(): NaurokQuestionState | null;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.naurok = I.providerModules.naurok || {});

    const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    function extractBackgroundUrl(el: Element | null): string {
        if (!el) return '';
        const bgStyle = (el as HTMLElement).style.backgroundImage || '';
        const match = bgStyle.match(/url\(["']?([^"')]+)["']?\)/);
        return match ? match[1] : '';
    }

    // Text options and background-image-only options live in .question-option-inner;
    // .question-option-inner-content is the fallback for older markup.
    function extractOptionData(): { optionsArr: string[]; optionImageUrls: string[] } {
        const optionInners = document.querySelectorAll('.question-option-inner');
        const optionsArr: string[] = [];
        const optionImageUrls: string[] = [];

        optionInners.forEach((inner, idx) => {
            const textEl = inner.querySelector('.question-option-inner-content');
            const text = textEl ? (textEl as HTMLElement).innerText.trim() : '';
            const bgUrl = extractBackgroundUrl(inner.querySelector('.question-option-image'));
            const label = OPTION_LABELS[idx] || (idx + 1);
            if (text) {
                optionsArr.push(label + ': ' + text);
            } else if (bgUrl) {
                optionsArr.push(label + ': [зображення]');
                optionImageUrls.push(bgUrl);
            }
        });

        if (optionsArr.length === 0) {
            const fallbackEls = document.querySelectorAll('.question-option-inner-content');
            fallbackEls.forEach((el, idx) => {
                const t = (el as HTMLElement).innerText.trim();
                if (t) optionsArr.push((OPTION_LABELS[idx] || (idx + 1)) + ': ' + t);
            });
        }

        return { optionsArr, optionImageUrls };
    }

    // Question image (<img> inside .test-question-content or background-image on
    // .test-content-image) plus image-only option URLs appended at the end.
    function extractQuestionImages(optionImageUrls: string[]): string[] {
        const validImages: string[] = [];

        const allImages = document.querySelectorAll('img');
        allImages.forEach(img => {
            const isHidden = img.classList.contains('ng-hide') || img.offsetParent === null;
            const hasSrc = img.src && img.src.length > 0 && !img.src.startsWith('data:image/gif');
            const isInQuestion = img.closest('.test-question-content');
            if (!isHidden && hasSrc && isInQuestion && img.width > 40) {
                validImages.push(img.src);
            }
        });

        const questionImgDiv = document.querySelector('.test-content-image');
        if (questionImgDiv && !questionImgDiv.classList.contains('ng-hide')) {
            const bgUrl = extractBackgroundUrl(questionImgDiv);
            if (bgUrl) validImages.push(bgUrl);
            const qImg = questionImgDiv.querySelector('img');
            if (qImg && qImg.src && !qImg.classList.contains('ng-hide')) {
                if (!qImg.src.startsWith('data:image/gif') && qImg.width > 40) {
                    validImages.push(qImg.src);
                }
            }
        }

        optionImageUrls.forEach(url => { if (!validImages.includes(url)) validImages.push(url); });

        return validImages;
    }

    // naurok scene==1 shows the question, scene==2 plays the "answer accepted"
    // animation and scene==3 is the finished test.
    function getSceneBlocked(): boolean {
        const scene1 = document.querySelector('[ng-show="test.scene == 1"]');
        const scene2 = document.querySelector('[ng-show="test.scene == 2"]');
        const scene3 = document.querySelector('[ng-show="test.scene == 3"]');
        const isAnimationActive = scene2 && !scene2.classList.contains('ng-hide');
        const isTestEnded = scene3 && !scene3.classList.contains('ng-hide');
        if (isAnimationActive || isTestEnded) return true;
        if (scene1 && scene1.classList.contains('ng-hide')) return true;
        return false;
    }

    // Angular puts ng-init="init(settings_id, session_id, account_id)" on the root
    // element; the second argument is the numeric session ID used by the API.
    function parseSessionIdFromDOM(): number | null {
        const el = document.querySelector('[ng-init*="init("]');
        if (!el) return null;
        const ngInit = el.getAttribute('ng-init') || '';
        const match = ngInit.match(/init\s*\(\s*\d+\s*,\s*(\d+)\s*,/);
        if (match) {
            const sid = parseInt(match[1], 10);
            console.log('[xdAnswers/naurok] Session ID from ng-init:', sid);
            return sid;
        }
        return null;
    }

    function getQuestionState(): NaurokQuestionState | null {
        const textContainer = document.querySelector('.test-content-text-inner');
        const questionText = textContainer ? (textContainer as HTMLElement).innerText.trim() : '';
        if (!questionText) return null;

        const { optionsArr, optionImageUrls } = extractOptionData();
        if (optionsArr.length === 0) return null;
        const optionsText = optionsArr.join('\n');

        const questionScope = document.querySelector('.test-container-inner') || document;
        const isMultiQuiz = !!questionScope.querySelector('.question-option-inner[ng-click*="multiquiz"], [ng-if="test.question.type == \'multiquiz\'"]:not(.ng-hide)');

        const validImages = extractQuestionImages(optionImageUrls);

        return {
            questionText,
            optionsText,
            optionImageUrls,
            validImages,
            isMultiQuiz,
            questionType: isMultiQuiz ? 'multiquiz' : 'quiz'
        };
    }

    ns.dom = {
        getSceneBlocked,
        parseSessionIdFromDOM,
        getQuestionState
    };
})();
