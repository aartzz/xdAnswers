// src/providers/naurok/dom/index.ts
// DOM extraction entry for the Naurok provider: scene state, session id, question
// text, answer options and images. Publishes its API on
// window.xdAnswers._internal.providerModules.naurok.dom for main.ts.
import { getSceneBlocked, parseSessionIdFromDOM } from './session';
import { getQuestionState } from './question';
import type { NaurokQuestionState } from './question';
import { betaQuestionContainer, getBetaQuestionState, isBetaTest } from './beta';
import type { NaurokBetaQuestionState } from './beta';

export type { NaurokQuestionState } from './question';
export type { NaurokBetaQuestionState } from './beta';

export interface NaurokDomApi {
    getSceneBlocked(): boolean;
    parseSessionIdFromDOM(): number | null;
    getQuestionState(): NaurokQuestionState | null;
    isBetaTest(): boolean;
    getBetaQuestionState(): NaurokBetaQuestionState | null;
    betaQuestionContainer(): HTMLElement | null;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.naurok = I.providerModules.naurok || {});

    ns.dom = {
        getSceneBlocked,
        parseSessionIdFromDOM,
        getQuestionState,
        isBetaTest,
        getBetaQuestionState,
        betaQuestionContainer
    } as NaurokDomApi;
})();
