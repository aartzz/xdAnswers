// src/providers/msforms/dom/question.ts
// Microsoft Forms question extraction and page state hashing.
import type { MsformsQuestionData } from './index';
import { getQuestionType } from './type';
import { extractOptions } from './options';

export function norm(t: string): string { return t.toLowerCase().replace(/\s+/g, ' ').trim(); }

export function extractQuestionData(questionItem: HTMLElement): MsformsQuestionData | null {
    const type = getQuestionType(questionItem);

    // Title text
    const titleEl = questionItem.querySelector('[data-automation-id="questionTitle"] .text-format-content')
        || questionItem.querySelector('[data-automation-id="questionTitle"]');
    const questionText = titleEl ? (titleEl as HTMLElement).innerText.trim() : '';

    if (!questionText) return null;

    // Images
    const imageUrls: string[] = [];
    questionItem.querySelectorAll('img').forEach(img => {
        if (img.width > 50 && img.height > 50 && img.src && !img.src.startsWith('data:')) {
            imageUrls.push(img.src);
        }
    });

    // Options
    const options = extractOptions(questionItem, type);

    // Determine questionType for AI
    let aiQuestionType = 'quiz';
    let isMulti = false;

    if (type === 'multichoice' || type === 'likert') {
        isMulti = true;
    } else if (type === 'ranking') {
        aiQuestionType = 'ordering';
    } else if (type === 'text' || type === 'textarea' || type === 'date') {
        aiQuestionType = 'general';
    } else if (type === 'rating' || type === 'nps') {
        aiQuestionType = 'quiz';
    }

    // For date questions, add format hint so AI outputs correct format
    let optionsText: string | undefined = options.join('\n') || undefined;
    if (type === 'date') {
        optionsText = 'Format: dd.MM.yyyy (e.g., 15.01.2024)';
    }

    return {
        type,
        questionItem,
        text: questionText,
        optionsText,
        base64ImageSources: imageUrls,
        questionType: aiQuestionType,
        isMulti,
        isMultiQuiz: isMulti
    };
}

export function buildStateHash(): string {
    const questionItems = document.querySelectorAll('[data-automation-id="questionItem"]');
    return Array.from(questionItems).map(qi => {
        const title = qi.querySelector('[data-automation-id="questionTitle"]');
        return title ? (title as HTMLElement).innerText.trim() : '';
    }).join('|||');
}
