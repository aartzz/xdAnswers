// src/providers/naurok/autoanswer.ts
// Naurok answer applying: handles open text inputs, crossword/hang answers and triggers DOM events.

export function applyNaurokTextAnswer(inputEl: HTMLInputElement | null, answerText: string): void {
    const input = inputEl || document.querySelector<HTMLInputElement>(
        '.test-content-text-inner input, .test-question-content input, .test-container input[type="text"]'
    );
    if (input) {
        const clean = answerText.replace(/^(?:FINAL_ANSWER|Відповідь)\s*:\s*/i, '').trim();
        input.value = clean;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.style.setProperty('outline', '2px solid #22c55e', 'important');
    }
}
