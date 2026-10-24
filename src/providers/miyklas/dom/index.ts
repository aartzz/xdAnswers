// src/providers/miyklas/dom/index.ts
// Miyklas DOM layer entry: publishes question/option/image extraction.
import { readQuestion, loadImages, getLastFields, getLastInputs } from './question';
import type { MiyklasQuestionState } from './question';

export type { MiyklasOption, MiyklasQuestionState } from './question';

export interface MiyklasDomApi {
    readQuestion(): MiyklasQuestionState | null;
    loadImages(): Promise<string[]>;
    getLastFields(): HTMLElement[];
    getLastInputs(): HTMLInputElement[];
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    const api: MiyklasDomApi = {
        readQuestion: readQuestion,
        loadImages: loadImages,
        getLastFields: getLastFields,
        getLastInputs: getLastInputs
    };

    window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {};
    window.xdAnswers._internal.providerModules.miyklas = window.xdAnswers._internal.providerModules.miyklas || {};
    window.xdAnswers._internal.providerModules.miyklas.dom = api;
})();
