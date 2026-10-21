// src/dom/select/highlight.ts
// Highlights the option elements matching the AI answer.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function highlightCorrectAnswer(answerText: string): void {
        // Only highlight when setting is enabled and not in any silent mode
        if (!window.xdAnswers.settings.highlightCorrect) return;
        const silentMode = window.xdAnswers.settings.silentMode || '';
        if (silentMode !== '') return; // silent mode handles its own indicators/title/clipboard
        // Clear previous highlights first
        document.querySelectorAll('.xd-highlight-correct').forEach(el => {
            el.classList.remove('xd-highlight-correct');
            (el as HTMLElement).style.removeProperty('outline');
            (el as HTMLElement).style.removeProperty('background-color');
            (el as HTMLElement).style.removeProperty('border-radius');
        });
        const allOptionElements = I.findOptionElements();
        const scopedContainer = window.xdAnswers._oneClickContainer || window.xdAnswers._answerContainer;
        const optionElements = scopedContainer
            ? allOptionElements.filter(el => scopedContainer.contains(el))
            : allOptionElements;
        const elements = I.matchAnswerToOptions(answerText, optionElements);
        for (const el of elements) {
            const target = (el.closest('.question-option, .answer-item, .v-test-questions-select-block, .v-test-questions-radio-block, .v-test-questions-checkbox-block, label, [role="radio"], [role="checkbox"], [data-automation-id="choiceItem"]') || el) as HTMLElement;
            target.classList.add('xd-highlight-correct');
            target.style.setProperty('outline', '3px solid #22c55e', 'important');
            target.style.setProperty('background-color', 'rgba(34, 197, 94, 0.15)', 'important');
            target.style.setProperty('border-radius', '4px', 'important');
        }
    }

    I.highlightCorrectAnswer = highlightCorrectAnswer;
})();
