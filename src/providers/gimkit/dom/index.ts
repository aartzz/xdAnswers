// src/providers/gimkit/dom/index.ts
// Gimkit DOM extraction: question text, answer buttons and question images.
import type { GimkitQuestionState } from './question';
import { readQuestion } from './question';
import { loadImages } from './images';

export type { GimkitQuestionState } from './question';

export interface GimkitDomApi {
    readQuestion(): GimkitQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

const api: GimkitDomApi = { readQuestion, loadImages };
const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
const provider = (modules.gimkit = modules.gimkit || {});
provider.dom = api;
