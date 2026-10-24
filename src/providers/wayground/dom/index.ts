// src/providers/wayground/dom/index.ts
// Wayground DOM extraction: question text, answer buttons and question images.
import type { WaygroundQuestionState } from './question';
import { readQuestion } from './question';
import { loadImages } from './images';

export type { WaygroundQuestionState } from './question';

export interface WaygroundDomApi {
    readQuestion(): WaygroundQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

const api: WaygroundDomApi = { readQuestion, loadImages };
const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
const provider = (modules.wayground = modules.wayground || {});
provider.dom = api;
