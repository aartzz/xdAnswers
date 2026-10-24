// src/providers/moodle/dom/question.ts
// Moodle question extraction: text, question type, options and matching pairs.
import { getText } from './text';

export interface MoodleQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    questionType: 'choice' | 'text';
    container: HTMLElement;
}

export function readQuestion(): MoodleQuestionState | null {
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
