// src/providers/vseosvita/dom/index.ts
// vseosvita DOM extraction entry: question text, answer options, premium question
// formats (data-quest_type 3/5/6/7/8/10/12/13/18 plus Google Forms-style grids,
// scales, dropdowns and date inputs) and images. Publishes its API on
// window.xdAnswers._internal.providerModules.vseosvita.dom for apply.ts and main.ts.
import { detectQuestionData } from './detect';
import { markOptionElements } from './options';

export interface VseosvitaMeta {
    formatType: string;
    vrQuest?: Element | null;
    dataQuestType?: string | null;
    [key: string]: any;
}

export interface VseosvitaQuestionData {
    root: Element;
    text: string;
    options: string[];
    optionsText: string | undefined;
    base64ImageSources: string[];
    questionType: string;
    isMultiQuiz: boolean;
    isMulti: boolean;
    vseosvitaMeta: VseosvitaMeta | null;
}

export interface VseosvitaDomApi {
    detectQuestionData(): VseosvitaQuestionData | null;
    markOptionElements(questionRoot: Element): void;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.vseosvita = I.providerModules.vseosvita || {});

    ns.dom = {
        detectQuestionData,
        markOptionElements
    } as VseosvitaDomApi;
})();
