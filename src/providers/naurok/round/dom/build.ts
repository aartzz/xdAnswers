// src/providers/naurok/round/dom/build.ts
// НаУрок round question data: maps extracted meta to the shared XdQuestionData shape.
import type { NaurokRoundMeta } from './index';
import { LETTERS } from './text';

export function buildQuestionData(meta: NaurokRoundMeta, base64Images: string[]): XdQuestionData {
    const data: XdQuestionData = {
        text: meta.text || ' ',
        optionsText: undefined,
        base64Images: base64Images,
        questionType: 'quiz',
        isMultiQuiz: false,
        isMulti: false
    };
    const type = meta.type;

    if (type === 'quiz' || type === 'select') {
        data.questionType = 'quiz';
        data.optionsText = meta.options.map(o => o.text).join('\n') || undefined;
    } else if (type === 'quiz_image') {
        data.questionType = 'quiz';
        data.optionsText = meta.options.map((o, i) => (LETTERS[i] || (i + 1)) + ') [зображення]').join('\n') || undefined;
    } else if (type === 'multiquiz') {
        data.questionType = 'multiquiz';
        data.isMultiQuiz = true;
        data.optionsText = meta.options.map(o => o.text).join('\n') || undefined;
    } else if (type === 'multiquiz_image') {
        data.questionType = 'multiquiz';
        data.isMultiQuiz = true;
        data.optionsText = meta.options.map((o, i) => (LETTERS[i] || (i + 1)) + ') [зображення]').join('\n') || undefined;
    } else if (type === 'truefalse') {
        data.questionType = 'true_false_multi';
        data.optionsText = meta.rows.map((r, i) => (i + 1) + '. ' + (r.label || '')).join('\n') || undefined;
    } else if (type === 'short') {
        data.questionType = 'short_text';
    } else if (type === 'fill') {
        data.questionType = 'fill_blank';
    } else if (type === 'order' || type === 'order2') {
        data.questionType = 'order_words';
        data.optionsText = meta.list ? meta.list.items.map(it => it.text).join('\n') : undefined;
    } else if (type === 'match' || type === 'match_image') {
        data.questionType = 'match_pairs';
        const rows = meta.rows.map((r, i) => (i + 1) + '. ' + (r.label || ''));
        const firstWithOptions = meta.rows.find(r => r.options && r.options.length > 0);
        const variants = firstWithOptions && firstWithOptions.options ? firstWithOptions.options.map(o => o.text) : [];
        data.optionsText = 'Рядки:\n' + rows.join('\n') + '\n\nВаріанти:\n' + variants.join('\n');
    }
    return data;
}
