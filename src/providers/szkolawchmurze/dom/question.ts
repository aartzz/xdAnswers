// src/providers/szkolawchmurze/dom/question.ts
// Szkola w Chmurze question extraction: text, choicegroup type, options and image URLs.
import { getText } from './text';

export interface SzkolawchmurzeQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    isMultiple: boolean;
    container: HTMLElement | null;
}

export function readQuestion(): SzkolawchmurzeQuestionState | null {
    // Szkola w Chmurze uses choicegroup element
    const choiceGroup = document.querySelector('choicegroup');
    if (!choiceGroup) return null;

    // Find question text - usually in preceding element or parent
    let questionEl: Element | null = choiceGroup.closest('.que, .question, [class*="question"]');
    if (!questionEl) {
        questionEl = choiceGroup.parentElement;
    }

    // Try to find question text element
    let qtextEl: Element | null = questionEl ? questionEl.querySelector('.qtext, .question-text, [class*="prompt"]') : null;
    if (!qtextEl && questionEl !== choiceGroup.parentElement) {
        qtextEl = choiceGroup.previousElementSibling;
    }

    const questionText = qtextEl ? getText(qtextEl) : getText(questionEl);
    if (!questionText) return null;

    // Detect type from choicegroup
    const typeAttr = choiceGroup.getAttribute('type')?.trim().toLowerCase();
    let questionType: 'choice' | 'text' = 'choice';
    let isMultiple = false;

    if (typeAttr === 'multiplechoice') {
        questionType = 'choice';
        isMultiple = false;
    } else if (typeAttr === 'multichoice') {
        questionType = 'choice';
        isMultiple = true;
    }

    // Extract options from mat-radio-button or mat-checkbox
    const options: string[] = [];
    choiceGroup.querySelectorAll('mat-radio-button, mat-checkbox').forEach(el => {
        const label = el.querySelector('label.mdc-label');
        if (label) {
            const text = getText(label);
            if (text) options.push(text);
        }
    });

    // Collect question image URLs
    const imageUrls: string[] = [];
    if (qtextEl) {
        qtextEl.querySelectorAll('img').forEach(img => {
            imageUrls.push((img as HTMLImageElement).src);
        });
    }

    return {
        text: questionText,
        options,
        imageUrls,
        questionType,
        isMultiple,
        container: questionEl as HTMLElement | null
    };
}
