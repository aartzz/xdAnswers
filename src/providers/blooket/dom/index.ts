// src/providers/blooket/dom/index.ts
// Blooket DOM extraction: question text, answer buttons and question images.
import type { BlooketQuestionState } from './question';
import { readQuestion } from './question';
import { loadImages } from './images';

export type { BlooketQuestionState } from './question';

export interface BlooketDomApi {
    readQuestion(): BlooketQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

const api: BlooketDomApi = { readQuestion, loadImages };
const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
const provider = (modules.blooket = modules.blooket || {});
provider.dom = api;
