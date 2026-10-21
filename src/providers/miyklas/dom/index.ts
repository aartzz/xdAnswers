// src/providers/miyklas/dom/index.ts
// Miyklas DOM layer entry: publishes question/option/image extraction and drag-and-drop applying.
import { readQuestion, loadImages } from './question';
import type { MiyklasQuestionState } from './question';
import { applyDndAnswer } from './dnd';

export type { MiyklasOption, MiyklasQuestionState } from './question';

export interface MiyklasDomApi {
    readQuestion(): MiyklasQuestionState | null;
    loadImages(): Promise<string[]>;
    applyDndAnswer(answerText: string): void;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    const api: MiyklasDomApi = { readQuestion: readQuestion, loadImages: loadImages, applyDndAnswer: applyDndAnswer };

    window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {};
    window.xdAnswers._internal.providerModules.miyklas = window.xdAnswers._internal.providerModules.miyklas || {};
    window.xdAnswers._internal.providerModules.miyklas.dom = api;
})();
