// src/providers/kahoot/autoanswer.ts
// Kahoot custom auto-answer: character-by-character numeric and text typing with timing simulation.

export function applyKahootAnswer(input: HTMLInputElement, answerText: string): void {
    const proto = window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) nativeSetter.call(input, '');
    else input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Type character by character at 15ms intervals (matching InRoute anti-detect)
    const cleanAnswer = answerText.replace(/[^0-9a-zA-Z\s.,\-]/g, '').trim();
    const chars = cleanAnswer.split('');
    let idx = 0;

    const typeInterval = setInterval(function() {
        if (idx >= chars.length) {
            clearInterval(typeInterval);

            // Dot animation buffer (400ms) — anti-detect settling before submitting
            setTimeout(function() {
                if (nativeSetter) nativeSetter.call(input, cleanAnswer);
                else input.value = cleanAnswer;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
                input.style.setProperty('outline', '2px solid #22c55e', 'important');
            }, 400);

            return;
        }

        const current = chars.slice(0, idx + 1).join('');
        if (nativeSetter) nativeSetter.call(input, current);
        else input.value = current;

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            key: chars[idx],
            code: 'Key' + chars[idx].toUpperCase()
        }));
        input.dispatchEvent(new KeyboardEvent('keyup', {
            bubbles: true,
            key: chars[idx],
            code: 'Key' + chars[idx].toUpperCase()
        }));

        idx++;
    }, 15);
}
