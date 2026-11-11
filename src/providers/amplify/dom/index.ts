// src/providers/amplify/dom/index.ts
// Amplify Classroom DOM layer: publishes screen extraction to the provider entry.
import { readQuestion, loadImages } from './question';
import { cleanText } from './util';
import type { AmplifyQuestionState } from './types';

export type {
    AmplifyQuestionState,
    AmplifyQuestionKind,
    AmplifyInlineField,
    AmplifyInlineKind,
    AmplifyHotText
} from './types';

export interface AmplifyDomApi {
    readQuestion(): AmplifyQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
    cleanText(value: string | null | undefined): string;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

    const api: AmplifyDomApi = { readQuestion, loadImages, cleanText };
    modules.amplify = modules.amplify || {};
    modules.amplify.dom = api;
})();
