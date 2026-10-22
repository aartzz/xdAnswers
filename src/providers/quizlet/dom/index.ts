// src/providers/quizlet/dom/index.ts
// Quizlet DOM extraction: question text, MCQ options and question images.
import type { QuizletQuestionState } from './question';
import { readQuestion } from './question';
import { loadImages } from './images';

export type { QuizletQuestionState } from './question';

export interface QuizletDomApi {
    readQuestion(): QuizletQuestionState | null;
    loadImages(urls: string[]): Promise<string[]>;
}

window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

const api: QuizletDomApi = { readQuestion, loadImages };
const modules = window.xdAnswers._internal.providerModules || (window.xdAnswers._internal.providerModules = {});
const provider = (modules.quizlet = modules.quizlet || {});
provider.dom = api;
