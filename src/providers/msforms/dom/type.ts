// src/providers/msforms/dom/type.ts
// Microsoft Forms question type detection from structural hints and localized type text.
import type { MsformsQuestionType } from './index';

export function getQuestionType(questionItem: HTMLElement): MsformsQuestionType {
    const typeInfoEl = questionItem.querySelector('[id^="QuestionInfo_"]');
    const typeInfo = typeInfoEl ? typeInfoEl.textContent!.trim().toLowerCase() : '';

    // Check structural hints
    const hasRadiogroup = !!questionItem.querySelector('[role="radiogroup"]');
    const hasCheckboxGroup = !!questionItem.querySelector('[role="group"]');
    const hasTextInput = !!questionItem.querySelector('input[data-automation-id="textInput"]');
    const hasTextarea = !!questionItem.querySelector('textarea');
    const hasDateInput = !!questionItem.querySelector('input[role="combobox"]');
    const hasListbox = !!questionItem.querySelector('[role="listbox"]');
    // Likert uses native <table> with role="group" (not role="table")
    const hasTable = !!questionItem.querySelector('[role="table"], table');

    // Disambiguate by typeInfo text (localized, covers Ukrainian/English/Russian)
    if (hasRadiogroup) {
        if (typeInfo.includes('оцінк') || typeInfo.includes('rating') || typeInfo.includes('оценк')) return 'rating';
        if (typeInfo.includes('net promoter') || typeInfo.includes('nps')) return 'nps';
        if (typeInfo.includes('лайкерт') || typeInfo.includes('likert') || hasTable) return 'likert';
        // Single choice
        return 'choice';
    }
    if (hasCheckboxGroup) {
        if (hasTable) return 'likert';
        // Multiple choice
        return 'multichoice';
    }
    if (hasTextarea) return 'textarea';
    if (hasTextInput) return 'text';
    if (hasDateInput) return 'date';
    if (hasListbox) return 'ranking';

    return 'unknown';
}
