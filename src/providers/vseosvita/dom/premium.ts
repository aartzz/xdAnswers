// src/providers/vseosvita/dom/premium.ts
// vseosvita premium question formats: dispatches data-quest_type collectors, builds
// the AI-side optionsText and maps each format -> questionType vocabulary.
// Used by detect.ts only when the legacy CSS-heuristic branch returns 'unknown'.
import type { VseosvitaMeta } from './index';
import { collectCategorization, collectFillBlanks, collectFreeResponse, collectOrderWords, collectOrderingSelect, collectSelectInText, collectTextInputs, collectTrueFalse, findVrQuest } from './premium-collect';

export function detectPremiumFormat(questionRoot: Element): VseosvitaMeta | null {
    const vrQuest = findVrQuest(questionRoot);
    if (!vrQuest) return null;
    const dqt = vrQuest.getAttribute('data-quest_type');
    if (!dqt) return null;

    let meta: VseosvitaMeta | null = null;
    switch (dqt) {
        case '3':  meta = collectTextInputs(vrQuest); break;    // single input
        case '5':  meta = collectTextInputs(vrQuest); break;    // multi input (same collector, distinguishes by count)
        case '6':  meta = collectFillBlanks(vrQuest); break;
        case '7':  meta = collectSelectInText(vrQuest); break;
        case '8':  meta = collectOrderingSelect(vrQuest); break; // fallback only - legacy branch usually catches this
        case '10': meta = collectCategorization(vrQuest); break; // categorization / drag-drop
        case '12': meta = collectTrueFalse(vrQuest); break;
        case '13': meta = collectOrderWords(vrQuest); break;
        case '18': meta = collectFreeResponse(vrQuest); break;
        default:
            // Fallback heuristic for categorization when data-quest_type is absent/unknown
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
        return meta.buttons.map((b: any, i: number) => `${String.fromCharCode(65 + i)}: ${b.text}`).join('\n');
    }
    if (meta.formatType === 'order_words') {
        return meta.tokens.map((t: any) => `- ${t.text}`).join('\n');
    }
    if (meta.formatType === 'text_input_multi') {
        return meta.inputs.map((i: any) => `- ${i.label}`).join('\n');
    }
    if (meta.formatType === 'fill_blank') {
        return meta.blanks.map((b: any) => `- Пропуск ${b.key}`).join('\n');
    }
    if (meta.formatType === 'select_in_text') {
        return meta.blanks
            .map((b: any) => `- ${b.key}: [${b.options.join(' | ')}]`)
            .join('\n');
    }
    if (meta.formatType === 'ordering_select') {
        return meta.items.map((i: any) => `- ${i.text}`).join('\n');
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

// Map premium formatType to the existing questionType vocabulary that
// src/ai/request.ts understands (plus new ones we're adding).
export function premiumQuestionType(formatType: string): string {
    switch (formatType) {
        case 'true_false':       return 'true_false';
        case 'text_input_single':return 'short_text';
        case 'text_input_multi': return 'text_input_multi';
        case 'fill_blank':       return 'fill_blank';
        case 'select_in_text':   return 'select_in_text';
        case 'order_words':      return 'order_words';
        case 'ordering_select':  return 'ordering';
        case 'categorization':   return 'categorization';
        case 'free_response':    return 'paragraph';
        case 'checkbox_grid':    return 'checkbox_grid';
        case 'likert':           return 'likert';
        case 'scale':            return 'scale';
        case 'dropdown':         return 'dropdown';
        case 'date_time':        return 'date_time';
        default:                 return 'unknown';
    }
}
