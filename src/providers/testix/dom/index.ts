// src/providers/testix/dom/index.ts
// Testix DOM layer: publishes question extraction to the provider entry.
import { readQuestion, loadImages, cleanText } from './question';
import type { TestixQuestionState } from './question';

export type {
    TestixQuestionState,
    TestixQuestionKind,
    TestixOption,
    TestixMatchingState,
    TestixTextInput,
    TestixOrderItem,
    TestixCategoryBin
} from './question';

export interface TestixDomApi {
    readQuestion(): TestixQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
    cleanText(value: string | null | undefined): string;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

    const api: TestixDomApi = { readQuestion, loadImages, cleanText };
    modules.testix = modules.testix || {};
    modules.testix.dom = api;
})();
