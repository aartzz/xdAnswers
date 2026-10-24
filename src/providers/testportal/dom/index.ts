// src/providers/testportal/dom/index.ts
// TestPortal DOM extraction entry: question text, type detection, options and images.
import type { TestportalQuestionState } from './question';
import { getText } from './text';
import { readQuestion } from './question';
import { loadImages } from './images';

export type { TestportalQuestionState } from './question';

export interface TestportalDomApi {
    getText(el: Element | null): string;
    readQuestion(): TestportalQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

const api: TestportalDomApi = { getText, readQuestion, loadImages };
const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
const provider = (modules.testportal = modules.testportal || {});
provider.dom = api;
