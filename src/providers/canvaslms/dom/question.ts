// src/providers/canvaslms/dom/question.ts
// Canvas LMS question extraction: text, question type, options and matching pairs.
import { getText } from './text';

export interface CanvaslmsQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    container: HTMLElement;
}

export function readQuestion(): CanvaslmsQuestionState | null {
    // Canvas LMS uses .display_question.question
    const questionEl = document.querySelector('.display_question.question');
    if (!questionEl) return null;

    const qtextEl = questionEl.querySelector('.question_text, .text');
    if (!qtextEl) return null;

    let questionText = getText(qtextEl);
    if (!questionText) return null;

    // Detect question type
    const isMultiChoice = questionEl.classList.contains('multiple_choice_question');
    const isMultiAnswer = questionEl.classList.contains('multiple_answers_question');
    const isTrueFalse = questionEl.classList.contains('true_false_question');
    const isMatching = questionEl.classList.contains('matching_question');

    const options: string[] = [];
    let questionType: 'choice' | 'text' = 'text';

    if (isMultiChoice || isMultiAnswer || isTrueFalse) {
        questionEl.querySelectorAll('.answer > div, .answer label').forEach(el => {
            const text = getText(el);
            if (text && text.length > 0 && text.length < 500) {
                options.push(text);
            }
        });
        questionType = 'choice';
    } else if (isMatching) {
        const rows = questionEl.querySelectorAll('.matching_table tr');
        let matchText = questionText + '\n\nMatching pairs:';
        rows.forEach(row => {
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
