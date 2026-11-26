// src/providers/classtime/dom/index.ts
// Classtime DOM layer entry: publishes question extraction, image loading and
// the per-kind answer applier.
import { readQuestion, readSignature, loadImages, isQuestionCurrent } from './question';
import type { ClasstimeQuestionState } from './question';
import { applyClasstimeAnswer } from '../autoanswer';

export type { ClasstimeQuestionState } from './question';

export interface ClasstimeDomApi {
    readSignature(): string | null;
    readQuestion(): Promise<ClasstimeQuestionState | null>;
    loadImages(roots: HTMLElement[]): Promise<string[]>;
    applyAnswer(state: ClasstimeQuestionState, answerText: string): void;
    isQuestionCurrent(state: ClasstimeQuestionState): boolean;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    const api: ClasstimeDomApi = {
        readSignature: readSignature,
        readQuestion: readQuestion,
        loadImages: loadImages,
        applyAnswer: applyClasstimeAnswer,
        isQuestionCurrent: isQuestionCurrent
    };

    window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {};
    window.xdAnswers._internal.providerModules.classtime = window.xdAnswers._internal.providerModules.classtime || {};
    window.xdAnswers._internal.providerModules.classtime.dom = api;
})();
