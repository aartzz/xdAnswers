// src/providers/szkolawchmurze/dom/index.ts
// Szkola w Chmurze DOM extraction entry: question text, choicegroup type, options and images.
import type { SzkolawchmurzeQuestionState } from './question';
import { getText } from './text';
import { readQuestion } from './question';
import { loadImages } from './images';

export type { SzkolawchmurzeQuestionState } from './question';

export interface SzkolawchmurzeDomApi {
    getText(el: Element | null): string;
    readQuestion(): SzkolawchmurzeQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

const api: SzkolawchmurzeDomApi = { getText, readQuestion, loadImages };
const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
const provider = (modules.szkolawchmurze = modules.szkolawchmurze || {});
provider.dom = api;
