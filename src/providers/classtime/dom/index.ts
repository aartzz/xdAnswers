// src/providers/classtime/dom/index.ts
// Classtime DOM layer entry: publishes the question/option extraction plus categorization and DND applying.
import { readQuestion, loadImages } from './question';
import type { ClasstimeQuestionState } from './question';
import { applyCategorization, applyDndDrag } from './apply';

export type { ClasstimeQuestionState } from './question';

export interface ClasstimeDomApi {
    readQuestion(): ClasstimeQuestionState | null;
    loadImages(container: HTMLElement): Promise<string[]>;
    applyCategorization(answerText: string): void;
    applyDndDrag(): void;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    const api: ClasstimeDomApi = {
        readQuestion: readQuestion,
        loadImages: loadImages,
        applyCategorization: applyCategorization,
        applyDndDrag: applyDndDrag
    };

    window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {};
    window.xdAnswers._internal.providerModules.classtime = window.xdAnswers._internal.providerModules.classtime || {};
    window.xdAnswers._internal.providerModules.classtime.dom = api;
})();
