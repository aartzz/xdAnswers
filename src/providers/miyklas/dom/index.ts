// src/providers/miyklas/dom/index.ts
// Miyklas DOM layer entry: publishes question/option/image extraction and drag-and-drop applying.
import { readQuestion, loadImages, getLastInputs } from './question';
import type { MiyklasQuestionState } from './question';
import { applyDndAnswer } from './dnd';

export type { MiyklasOption, MiyklasQuestionState } from './question';

export interface MiyklasDomApi {
    readQuestion(): MiyklasQuestionState | null;
    loadImages(): Promise<string[]>;
    applyDndAnswer(answerText: string): void;
    getLastInputs(): HTMLInputElement[];
    applyInputsAnswer(answerText: string): void;
}

function applyInputsAnswer(answerText: string): void {
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

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    const api: MiyklasDomApi = {
        readQuestion: readQuestion,
        loadImages: loadImages,
        applyDndAnswer: applyDndAnswer,
        getLastInputs: getLastInputs,
        applyInputsAnswer: applyInputsAnswer
    };

    window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {};
    window.xdAnswers._internal.providerModules.miyklas = window.xdAnswers._internal.providerModules.miyklas || {};
    window.xdAnswers._internal.providerModules.miyklas.dom = api;
})();
