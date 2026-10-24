// src/providers/kahoot/dom/index.ts
// Kahoot DOM layer entry: question text, answer options, images, numeric/text input lookup.
import type { KahootQuestionState } from './question';
import { readQuestion } from './question';
import { findInputElement } from './input';
import { loadImages } from './images';

export type { KahootQuestionState } from './question';

export interface KahootDomApi {
    findInputElement(): HTMLInputElement | null;
    readQuestion(): KahootQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

const api: KahootDomApi = { findInputElement, readQuestion, loadImages };
modules.kahoot = modules.kahoot || {};
modules.kahoot.dom = api;
