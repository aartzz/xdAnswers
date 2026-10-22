// src/providers/mriia/autoanswer.ts
// Mriia answer application: choice cards, radio/checkbox inputs and open textareas.

export function applyMriiaChoiceAnswer(container: HTMLElement | null, answerText: string): void {
    const root = container || document.body;
    const cards = Array.from(root.querySelectorAll<HTMLElement>('.test-choiser-card, .test-choiser-zone, .form-check'));

    if (cards.length > 0) {
        const matched = window.xdAnswers._internal.matchAnswerToOptions(answerText, cards);
        if (matched.length > 0) {
            matched.forEach(el => {
                const clickTarget = (el.querySelector<HTMLElement>('.test-choiser-zone, input[type="radio"], input[type="checkbox"], label') || el) as HTMLElement;
                clickTarget.click();
                clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                clickTarget.style.setProperty('outline', '2px solid #22c55e', 'important');
            });
            return;
        }
    }

    // Generic fallback
    window.xdAnswers._internal.autoSelectAnswer(answerText, true);
}

export function applyMriiaTextAnswer(inputEl: HTMLInputElement | HTMLTextAreaElement, answerText: string): void {
    const clean = answerText.replace(/^(?:FINAL_ANSWER|Відповідь)\s*:\s*/i, '').trim();
    inputEl.value = clean;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    inputEl.style.setProperty('outline', '2px solid #22c55e', 'important');
}
