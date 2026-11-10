// src/providers/vseosvita/dom/premium.ts
// vseosvita premium question formats: runtime class detection, data-quest_type
// compatibility collectors, AI-side optionsText and questionType mapping.
import type { VseosvitaMeta } from './index';
import {
    collectCategorization,
    collectCrossPairs,
    collectFillBlanks,
    collectFillWord,
    collectFreeResponse,
    collectImageArea,
    collectImagePuzzle,
    collectImageQuiz,
    collectMatchQuest,
    collectOrderWords,
    collectOrderingSelect,
    collectRange,
    collectSelectInText,
    collectTextInputs,
    collectTrueFalse,
    findVrQuest
} from './premium-collect';

// Detect the current vseosvita runtime layouts by their component classes.
// Ordered from the most specific container to the generic text-input shapes.
export function detectRuntimeFormat(questionRoot: Element): VseosvitaMeta | null {
    const vrQuest = findVrQuest(questionRoot) || questionRoot;
    const has = (selector: string): boolean => !!vrQuest.querySelector(selector);

    if (has('.question-sort-category_wrap')) return collectCategorization(vrQuest);
    if (has('.question-match-quest_wrap')) return collectMatchQuest(vrQuest);
    if (has('.v-block-answers-cross-wrapper')) return collectCrossPairs(vrQuest);
    if (has('.true-false_test-wrap')) return collectTrueFalse(vrQuest);
    if (has('.fillWord_table')) return collectFillWord(vrQuest);
    if (has('.imageSearch_test')) return collectImageArea(vrQuest);
    if (has('.imagePuzzle_test')) return collectImagePuzzle(vrQuest);

    // Radio/checkbox questions normally go through the generic option path.
    // Use a dedicated collector only when at least one answer is picture-only.
    const imageQuiz = collectImageQuiz(vrQuest);
    if (imageQuiz) return imageQuiz;

    // Queue ordering exposes two or more .v-test-questions-select-block items.
    if (has('.row_draggable-question, .draggable-question-box')) return collectOrderingSelect(vrQuest);

    if (has('.word-queue-test_question_sentence-wrap-testing')) return collectOrderWords(vrQuest);
    if (has('.vue-slider_wrap')) return collectRange(vrQuest);

    // Type 18 uses a ProseMirror editor inside the same .a-test-lab-inp wrapper
    // that type 3 uses. Check the editor before the plain-input collector.
    if (has('.a-test-lab-inp .ProseMirror[contenteditable="true"], .ProseMirror[contenteditable="true"]')) {
        return collectFreeResponse(vrQuest);
    }

    if (has('.a-test-lab-inp input[type="text"]')) return collectTextInputs(vrQuest);
    if (has('.vr-fill-the-gap-select')) return collectSelectInText(vrQuest);
    if (has('.vr-fill-the-gap')) return collectFillBlanks(vrQuest);
    if (has('textarea')) return collectFreeResponse(vrQuest);

    return null;
}

export function detectPremiumFormat(questionRoot: Element): VseosvitaMeta | null {
    const vrQuest = findVrQuest(questionRoot);
    if (!vrQuest) return null;
    const dqt = vrQuest.getAttribute('data-quest_type');
    if (!dqt) return null;

    let meta: VseosvitaMeta | null = null;
    switch (dqt) {
        case '3':  meta = collectTextInputs(vrQuest); break;
        case '4':  meta = collectCrossPairs(vrQuest); break;
        case '5':  meta = collectTextInputs(vrQuest); break;
        case '6':  meta = collectFillBlanks(vrQuest); break;
        case '7':  meta = collectSelectInText(vrQuest); break;
        case '8':  meta = collectOrderingSelect(vrQuest); break;
        case '10': meta = collectCategorization(vrQuest); break;
        case '12': meta = collectTrueFalse(vrQuest); break;
        case '13': meta = collectOrderWords(vrQuest); break;
        case '14':
        case '15': meta = collectFillWord(vrQuest); break;
        case '16': meta = collectRange(vrQuest); break;
        case '17': meta = collectMatchQuest(vrQuest); break;
        case '18': meta = collectFreeResponse(vrQuest); break;
        default:
            meta = collectCategorization(vrQuest);
            if (!meta) return null;
            break;
    }
    if (!meta) return null;
    meta.vrQuest = vrQuest;
    meta.dataQuestType = dqt;
    return meta;
}

// Build the AI-side optionsText for formats that expose choices.
export function premiumOptionsText(meta: VseosvitaMeta | null): string | undefined {
    if (!meta) return undefined;
    if (meta.formatType === 'true_false') {
        return 'Твердження:\n' + meta.buttons.map((b: any, i: number) => `${String.fromCharCode(65 + i)}: ${b.text}`).join('\n');
    }
    if (meta.formatType === 'image_quiz') {
        return meta.options.map((option: any, i: number) => `${String.fromCharCode(65 + i)}: ${option.text}`).join('\n');
    }
    if (meta.formatType === 'order_words') {
        if (meta.rows && meta.rows.length > 1) {
            return 'Рядки для впорядкування:\n' + meta.rows.map((row: any, idx: number) => {
                const texts = row.tokens.map((token: Element) => (token.textContent || '').trim()).filter(Boolean);
                return `Рядок ${idx + 1}: ${texts.join(' | ')}`;
            }).join('\n');
        }
        return 'Слова/фрагменти:\n' + meta.tokens.map((t: any) => `- ${t.text}`).join('\n');
    }
    if (meta.formatType === 'text_input_multi') {
        return meta.inputs.map((i: any) => `- ${i.label}`).join('\n');
    }
    if (meta.formatType === 'fill_blank') {
        return meta.blanks.map((b: any) => `- Пропуск ${b.key}`).join('\n');
    }
    if (meta.formatType === 'select_in_text') {
        return meta.blanks
            .map((b: any) => `- ${b.key}: [${(b.options || []).join(' | ')}]`)
            .join('\n');
    }
    if (meta.formatType === 'ordering_select') {
        return 'Елементи для впорядкування:\n' + meta.items.map((i: any) => `- ${i.text}`).join('\n');
    }
    if (meta.formatType === 'match_pairs') {
        const leftTitle = meta.layout === 'match_quest' ? 'Ліві картки (назви)' : 'Ліві елементи (номери)';
        const rightTitle = meta.layout === 'match_quest' ? 'Праві картки (описи)' : 'Праві елементи (літери)';
        return leftTitle + ':\n' + meta.left.map((i: any) => `- ${i.key ? i.key + '. ' : ''}${i.text}`).join('\n')
            + '\n\n' + rightTitle + ':\n' + meta.right.map((i: any, idx: number) => `- ${i.key ? i.key + '. ' : String.fromCharCode(65 + idx) + '. '}${i.text}`).join('\n');
    }
    if (meta.formatType === 'range') {
        return `Діапазон: від ${meta.min} до ${meta.max}, крок ${meta.step}${meta.unit ? ', одиниця: ' + meta.unit : ''}`;
    }
    if (meta.formatType === 'fill_word') {
        return meta.words?.length ? 'Слова:\n' + meta.words.map((w: string) => `- ${w}`).join('\n') : undefined;
    }
    if (meta.formatType === 'checkbox_grid') {
        return meta.rows.map((r: any) => `- ${r.label}:\n  ${r.checks.map((c: any) => `[ ] ${c.text}`).join('\n  ')}`).join('\n');
    }
    if (meta.formatType === 'likert') {
        return meta.rows.map((r: any) => `- ${r.label}:\n  ${r.radios.map((radio: any) => `( ) ${radio.text}`).join('  ')}`).join('\n');
    }
    if (meta.formatType === 'scale') {
        return meta.items.map((it: any, i: number) => `${i + 1}: ${it.text}`).join('  ');
    }
    if (meta.formatType === 'dropdown') {
        return meta.options.map((o: any, i: number) => `${String.fromCharCode(65 + i)}: ${o.text}`).join('\n');
    }
    if (meta.formatType === 'categorization') {
        return 'Категорії:\n' + meta.categories.map((c: any) => `- ${c}`).join('\n') +
               '\n\nЕлементи для розподілу:\n' + meta.items.map((it: any) => `- ${it.text}`).join('\n');
    }
    return undefined;
}

// Map premium formatType to the questionType vocabulary understood by
// src/ai/request/messages.ts.
export function premiumQuestionType(formatType: string): string {
    switch (formatType) {
        case 'true_false':       return 'true_false';
        case 'image_quiz':       return 'quiz';
        case 'text_input_single':return 'short_text';
        case 'text_input_multi': return 'text_input_multi';
        case 'fill_blank':       return 'fill_blank';
        case 'select_in_text':   return 'select_in_text';
        case 'order_words':      return 'order_words';
        case 'ordering_select':  return 'ordering';
        case 'categorization':   return 'categorization';
        case 'match_pairs':      return 'match_pairs';
        case 'range':            return 'range';
        case 'fill_word':        return 'fill_word';
        case 'free_response':    return 'paragraph';
        case 'checkbox_grid':    return 'grid';
        case 'likert':           return 'grid';
        case 'scale':            return 'scale';
        case 'dropdown':         return 'dropdown';
        case 'date_time':        return 'date_time';
        case 'image_area':       return 'image_area';
        case 'image_puzzle':     return 'image_puzzle';
        default:                 return 'unknown';
    }
}
