// src/providers/blooket/autoanswer.ts
// Blooket auto-answer: dismisses feedback modals and clicks matching answer choices.

export function dismissFeedback(feedbackEl: HTMLElement | null): void {
    if (!feedbackEl) return;
    feedbackEl.click();
    document.body.click();
}

export function applyBlooketAnswer(answerText: string): void {
    window.xdAnswers._internal.autoSelectAnswer(answerText, true);
}
