// src/providers/lcloud/dom/index.ts
// lcloud.in.ua DOM layer entry: publishes question text, answer options, images and question type.
import { readQuestion, loadImages } from './question';
import type { LcloudQuestionState } from './question';

export type { LcloudQuestionState } from './question';

export interface LcloudDomApi {
    readQuestion(): LcloudQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

    const api: LcloudDomApi = { readQuestion, loadImages };
    modules.lcloud = modules.lcloud || {};
    modules.lcloud.dom = api;
})();
