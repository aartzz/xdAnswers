// src/providers/naurok/dom/question.ts
// Naurok question extraction: question text, options text, and question images.
import { extractBackgroundUrl, extractOptionData } from './options';

export interface NaurokQuestionState {
    questionText: string;
    optionsText: string;
    optionImageUrls: string[];
    validImages: string[];
    isMultiQuiz: boolean;
    questionType: 'multiquiz' | 'quiz';
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

export function getQuestionState(): NaurokQuestionState | null {
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
