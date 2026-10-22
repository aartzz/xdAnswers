// src/providers/wayground/autoanswer.ts
// Wayground custom auto-answer: typing text into blanks and triggering DOM update.

export function applyWaygroundAnswer(input: HTMLInputElement, answerText: string): void {
    const clean = answerText.replace(/^(?:FINAL_ANSWER|Відповідь)\s*:\s*/i, '').trim();
    input.value = clean;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.style.setProperty('outline', '2px solid #22c55e', 'important');
}
