// src/providers/msforms/dom/index.ts
// Microsoft Forms DOM extraction entry: question type detection, option extraction,
// option marking for the answer matcher, and page state hashing.
import { buildStateHash, extractQuestionData, norm } from './question';
import { extractOptions, markOptionElements } from './options';
import { getQuestionType } from './type';

export type MsformsQuestionType =
    | 'choice'
    | 'multichoice'
    | 'rating'
    | 'nps'
    | 'likert'
    | 'ranking'
    | 'text'
    | 'textarea'
    | 'date'
    | 'unknown';

export interface MsformsQuestionData {
    type: MsformsQuestionType;
    questionItem: HTMLElement;
    text: string;
    optionsText?: string;
    base64ImageSources: string[];
    questionType: string;
    isMulti: boolean;
    isMultiQuiz: boolean;
}

export interface MsformsDomApi {
    getQuestionType(questionItem: HTMLElement): MsformsQuestionType;
    extractOptions(questionItem: HTMLElement, type: MsformsQuestionType): string[];
    markOptionElements(questionItem: HTMLElement, type: MsformsQuestionType): void;
    extractQuestionData(questionItem: HTMLElement): MsformsQuestionData | null;
    buildStateHash(): string;
    norm(t: string): string;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {};
    window.xdAnswers._internal.providerModules.msforms = window.xdAnswers._internal.providerModules.msforms || {};
    window.xdAnswers._internal.providerModules.msforms.dom = {
        getQuestionType,
        extractOptions,
        markOptionElements,
        extractQuestionData,
        buildStateHash,
        norm
    } as MsformsDomApi;
})();
