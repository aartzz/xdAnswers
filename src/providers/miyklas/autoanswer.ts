// src/providers/miyklas/autoanswer.ts
// Miyklas auto-answer: drag-and-drop answer mapping and multi-field text input filling.
import { getLastFields, getLastInputs } from './dom/question';

export function applyMiyklasDndAnswer(answerText: string): void {
    const fields = getLastFields();
    if (!fields.length) return;

    // Parse mappings from AI answer (e.g. "1=OPTION_2, 2=OPTION_1" or "OPTION_2, OPTION_1")
    const dndMap = new Map<number, string>();
    const pairRegex = /(\d+)\s*=\s*(?:OPTION_)?(\d+)/gi;
    let match: RegExpExecArray | null;

    while ((match = pairRegex.exec(answerText)) !== null) {
        dndMap.set(parseInt(match[1], 10), match[2]);
    }

    if (dndMap.size === 0) {
        // Fallback: list of options in order
        const optMatches = answerText.match(/OPTION_(\d+)/gi);
        if (optMatches) {
            optMatches.forEach((opt, idx) => {
                const num = opt.replace(/OPTION_/i, '');
                dndMap.set(idx + 1, num);
            });
        }
    }

    fields.forEach((field, idx) => {
        const optionId = dndMap.get(idx + 1);
        if (!optionId) return;

        const optionEl = document.getElementById(`OPTION_${optionId}`);
        if (!optionEl) return;

        // Simulate DND click / selection
        optionEl.click();
        field.click();

        field.style.setProperty('outline', '2px solid #22c55e', 'important');
        optionEl.style.setProperty('outline', '2px solid #22c55e', 'important');
    });
}

export function applyMiyklasInputsAnswer(answerText: string): void {
    const inputs = getLastInputs();
    if (!inputs.length) return;

    // Parse comma-separated or newline-separated values
    const clean = answerText.replace(/^(?:FINAL_ANSWER|Відповідь)\s*:\s*/i, '').trim();
    const parts = clean.split(/[,;\n]/).map(p => p.trim()).filter(Boolean);

    for (let i = 0; i < inputs.length; i++) {
        const val = parts[i] || (parts.length === 1 ? parts[0] : '');
        if (val && inputs[i]) {
            inputs[i].value = val;
            inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
            inputs[i].dispatchEvent(new Event('change', { bubbles: true }));
            inputs[i].style.setProperty('outline', '2px solid #22c55e', 'important');
        }
    }
}
