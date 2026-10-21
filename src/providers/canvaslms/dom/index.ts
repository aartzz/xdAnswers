// src/providers/canvaslms/dom/index.ts
// Canvas LMS DOM extraction entry: question text, type detection, options, matching pairs and images.
import type { CanvaslmsQuestionState } from './question';
import { getText } from './text';
import { readQuestion } from './question';
import { loadImages } from './images';

export type { CanvaslmsQuestionState } from './question';

export interface CanvaslmsDomApi {
    getText(el: Element | null): string;
    readQuestion(): CanvaslmsQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

const api: CanvaslmsDomApi = { getText, readQuestion, loadImages };
const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
const provider = (modules.canvaslms = modules.canvaslms || {});
provider.dom = api;
