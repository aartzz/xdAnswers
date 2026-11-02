// src/providers/schoolos/dom/index.ts
// SchoolOS INTEGRITY DOM layer: publishes question extraction to the provider entry.
import { readQuestion, loadImages, cleanText } from './question';
import type { SchoolosQuestionState } from './question';

export type { SchoolosQuestionState } from './question';

export interface SchoolosDomApi {
    readQuestion(): SchoolosQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
    cleanText(value: string | null | undefined): string;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

    const api: SchoolosDomApi = { readQuestion, loadImages, cleanText };
    modules.schoolos = modules.schoolos || {};
    modules.schoolos.dom = api;
})();
