// src/providers/naurok/dom/question.ts
// Naurok question extraction: question text, options text, and question images.
import { extractBackgroundUrl, extractOptionData } from './options';

export interface NaurokQuestionState {
    questionText: string;
    optionsText: string;
    optionImageUrls: string[];
    validImages: string[];
    isMultiQuiz: boolean;
    questionType: 'multiquiz' | 'quiz' | 'text';
    inputElement?: HTMLInputElement | null;
    questionKey?: string;
}

// Question image (<img> inside .test-question-content or background-image on
// .test-content-image) plus image-only option URLs appended at the end.
function extractQuestionImages(optionImageUrls: string[]): string[] {
    const validImages: string[] = [];

    const allImages = document.querySelectorAll('img');
    allImages.forEach(img => {
        const isHidden = img.classList.contains('ng-hide') || img.offsetParent === null;
        const hasSrc = img.src && img.src.length > 0 && !img.src.startsWith('data:image/gif');
        const isInQuestion = img.closest('.test-question-content, .test-container');
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

export function getQuestionState(): NaurokQuestionState | null {
    const textContainer = document.querySelector(
        '.test-content-text-inner, .test-content-text, .test-question-content-inner, .test-question-content, .v-test-questions-title'
    );
    const questionText = textContainer ? (textContainer as HTMLElement).innerText.trim() : '';
    if (!questionText) return null;

    const { optionsArr, optionImageUrls } = extractOptionData();

    // Check for open text input / crossword / hangman
    const inputEl = document.querySelector<HTMLInputElement>(
        '.test-content-text-inner input, .test-question-content input, .test-container input[type="text"], input.test-input'
    );
    const isCrossword = !!document.querySelector('.crossword, [class*="crossword"], [class*="cw-"]');
    const isHangman = !!document.querySelector('.hangman, [class*="hangman"], [class*="hang-"]');

    if (optionsArr.length === 0 && !inputEl && !isCrossword && !isHangman) {
        return null;
    }

    const questionScope = document.querySelector('.test-container-inner') || document;
    const isMultiQuiz = !!questionScope.querySelector('.question-option-inner[ng-click*="multiquiz"], [ng-if="test.question.type == \'multiquiz\'"]:not(.ng-hide)');

    const validImages = extractQuestionImages(optionImageUrls);

    let qText = questionText;
    if (isCrossword) qText += '\n[Режим: Кросворд Naurok. Відповідай відповідним словом без лапок]';
    if (isHangman) qText += '\n[Режим: Гра «Шибениця» Naurok. Відповідай словом або наступною літерою]';

    let qType: NaurokQuestionState['questionType'] = 'quiz';
    if (isMultiQuiz) qType = 'multiquiz';
    else if (optionsArr.length === 0 || inputEl || isCrossword || isHangman) qType = 'text';

    return {
        questionText: qText,
        optionsText: optionsArr.join('\n'),
        optionImageUrls,
        validImages,
        isMultiQuiz,
        questionType: qType,
        inputElement: inputEl
    };
}
