// src/providers/naurok/autoanswer.ts
// Naurok answer applying: handles open text inputs, crossword/hang answers and auto-advances "Далі" popups.

export function clickNaurokNextButton(): boolean {
    const feedbackSelectors = [
        '.tb-feedback button.tb-btn-white',
        '.tb-feedback .tb-btn',
        '.tb-feedback button',
        '.tb-board-foot button.tb-btn-go',
        '.tb-board-foot button',
        '.tb-team-foot button.tb-btn-go',
        '.tb-team-foot button',
        'button.tb-btn-white.tb-btn-lg',
        '.test-multiquiz-save'
    ];

    for (const sel of feedbackSelectors) {
        const btn = document.querySelector<HTMLButtonElement>(sel);
        if (btn && btn.offsetParent !== null && !btn.disabled) {
            btn.click();
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            return true;
        }
    }

    const allButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button, [role="button"]'));
    for (const b of allButtons) {
        if (b.offsetParent === null || b.disabled) continue;
        const txt = (b.textContent || '').trim();
        if (/^(Далі|Завершити|Next)\b/i.test(txt)) {
            b.click();
            b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            return true;
        }
    }

    return false;
}

export function applyNaurokTextAnswer(inputEl: HTMLInputElement | null, answerText: string): void {
    const input = inputEl || document.querySelector<HTMLInputElement>(
        '.test-content-text-inner input, .test-question-content input, .test-container input[type="text"]'
    );
    if (input) {
        const clean = answerText.replace(/^(?:FINAL_ANSWER|Відповідь)\s*:\s*/i, '').trim();
        input.value = clean;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
        input.style.setProperty('outline', '2px solid #22c55e', 'important');

        setTimeout(() => {
            clickNaurokNextButton();
        }, 150);
    }
}

