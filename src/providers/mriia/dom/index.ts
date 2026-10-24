// src/providers/mriia/dom/index.ts
// Mriia DOM extraction layer: publishes question/option/image API.
import type { MriiaQuestionState } from './question';
import { readQuestion } from './question';
import { loadImages } from './images';

export type { MriiaQuestionState } from './question';

export interface MriiaDomApi {
    readQuestion(): MriiaQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

const api: MriiaDomApi = { readQuestion, loadImages };
const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
const provider = (modules.mriia = modules.mriia || {});
provider.dom = api;
