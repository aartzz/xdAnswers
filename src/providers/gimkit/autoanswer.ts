// src/providers/gimkit/autoanswer.ts
// Gimkit custom auto-answer: typing answers into text inputs and submitting via Enter.

export function applyGimkitAnswer(input: HTMLInputElement, answerText: string): void {
    const clean = answerText.replace(/^(?:FINAL_ANSWER|Відповідь)\s*:\s*/i, '').trim();
    input.value = clean;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
    input.style.setProperty('outline', '2px solid #22c55e', 'important');
}
