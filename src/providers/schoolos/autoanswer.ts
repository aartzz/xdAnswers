// src/providers/schoolos/autoanswer.ts
// SchoolOS answer application. The exam UI selects options on pointerdown, not
// click, so the generic option clicker cannot drive it. Multi-choice questions
// additionally require a click on the confirm button.
import { cleanText } from './dom/question';

function dispatchPointerDown(target: HTMLElement): void {
    const init: PointerEventInit = {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true
    };
    try {
        target.dispatchEvent(new PointerEvent('pointerdown', init));
    } catch (e) {
        target.dispatchEvent(new MouseEvent('pointerdown', init));
    }
}

function answerParts(answerText: string): string[] {
    return answerText
        .replace(/^(?:FINAL_ANSWER|Відповідь|Ответ|Answer)\s*:\s*/i, '')
        .split(/[,;\n]+/)
        .map(part => cleanText(part).replace(/^\d+[.)]\s*/, '').toLowerCase())
        .filter(Boolean);
}

function fallbackMatch(answerText: string, optionEls: HTMLElement[]): HTMLElement[] {
    const parts = answerParts(answerText);
    const matched: HTMLElement[] = [];

    for (const part of parts) {
        const candidate = optionEls.find(el => {
            const optionText = cleanText(el.innerText || el.textContent).toLowerCase();
            return optionText.length > 1 && (optionText === part || part.includes(optionText) || optionText.includes(part));
        });
        if (candidate && !matched.includes(candidate)) matched.push(candidate);
    }

    return matched;
}

export function applySchoolosAnswer(answerText: string): boolean {
    const optionEls = Array.from(document.querySelectorAll<HTMLElement>('#optsWrap .opt, .q-card .opt'));
    if (!optionEls.length) return false;

    const targets = optionEls
        .map(opt => opt.querySelector<HTMLElement>('.opt-txt') || opt);

    let matched = window.xdAnswers._internal.matchAnswerToOptions(answerText, targets)
        .map(el => el.closest<HTMLElement>('.opt'))
        .filter((el): el is HTMLElement => !!el && optionEls.includes(el));

    const confirmButton = document.querySelector<HTMLButtonElement>('#confirmBtn');
    const isMultiple = !!confirmButton || optionEls.some(opt => !!opt.querySelector('.opt-cb'));

    // Multi-choice answers sometimes arrive as a comma-separated list rather
    // than the semicolon format the generic matcher expects. Match every
    // option whose exact text is one of those list items.
    if (isMultiple) {
        const parts = answerParts(answerText);
        const extra = optionEls.filter(opt => {
            const optionText = cleanText(opt.innerText || opt.textContent).toLowerCase();
            return optionText.length > 1 && parts.includes(optionText);
        });
        if (extra.length) {
            matched = Array.from(new Set([...matched, ...extra]));
        }
    }

    if (!matched.length) {
        matched = fallbackMatch(answerText, optionEls);
    }

    const selected = Array.from(new Set(matched));
    if (!selected.length) return false;

    for (const option of selected) {
        option.style.setProperty('outline', '3px solid #22c55e', 'important');
        dispatchPointerDown(option);
    }

    if (confirmButton) {
        setTimeout(() => {
            if (confirmButton.isConnected && !confirmButton.disabled) confirmButton.click();
        }, 300);
    }

    return true;
}
