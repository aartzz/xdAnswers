// src/providers/naurok/round/dom/index.ts
// DOM extraction entry for the НаУрок олімпіади / конкурси provider (naurok.ua/round/*):
// question text, answer options/rows/inputs and images. Publishes its API on
// window.xdAnswers._internal.providerModules['naurok-round'].dom for apply.ts and main.ts.
import { buildQuestionData } from './build';
import { collectMeta, getQuestionNumber } from './meta';
import { cleanRef, itemKey, norm } from './text';

export interface NaurokRoundOption {
    el: Element;
    text: string;
}

export interface NaurokRoundRow {
    el: Element;
    num?: number;
    label?: string;
    spans?: Element[];
    select?: HTMLSelectElement | null;
    options?: Array<{ el: HTMLOptionElement; value: string; text: string }>;
    _used?: boolean;
    _applied?: boolean;
}

export interface NaurokRoundList {
    el: Element;
    items: NaurokRoundOption[];
}

export interface NaurokRoundMeta {
    type: string;
    qNum: string;
    questionEl: Element;
    block: Element;
    images: string[];
    inputs: HTMLInputElement[];
    options: NaurokRoundOption[];
    rows: NaurokRoundRow[];
    list: NaurokRoundList | null;
    text: string;
}

export interface NaurokRoundDomApi {
    collectMeta(questionEl: Element): NaurokRoundMeta | null;
    buildQuestionData(meta: NaurokRoundMeta, base64Images: string[]): XdQuestionData;
    getQuestionNumber(): string;
    norm(s: unknown): string;
    cleanRef(text: unknown): string;
    itemKey(el: Element): string;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules['naurok-round'] = I.providerModules['naurok-round'] || {});

    ns.dom = {
        collectMeta: collectMeta,
        buildQuestionData: buildQuestionData,
        getQuestionNumber: getQuestionNumber,
        norm: norm,
        cleanRef: cleanRef,
        itemKey: itemKey
    } as NaurokRoundDomApi;
})();
