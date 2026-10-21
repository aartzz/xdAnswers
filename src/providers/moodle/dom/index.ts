// src/providers/moodle/dom/index.ts
// Moodle DOM extraction entry: question text, type detection, options, matching pairs and images.
import type { MoodleQuestionState } from './question';
import { getText } from './text';
import { readQuestion } from './question';
import { loadImages } from './images';

export type { MoodleQuestionState } from './question';

export interface MoodleDomApi {
    getText(el: Element | null): string;
    readQuestion(): MoodleQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

const api: MoodleDomApi = { getText, readQuestion, loadImages };
const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
const provider = (modules.moodle = modules.moodle || {});
provider.dom = api;
