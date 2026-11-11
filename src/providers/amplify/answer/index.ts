// src/providers/amplify/answer/index.ts
// Answer dispatch for every Amplify/Desmos widget the provider can drive.

import type { AmplifyQuestionState } from '../dom/types';
import { applyCardsort } from './cardsort';
import { applyChoice } from './choice';
import { explanationText, fillExplanation } from './helpers';
import { applyInline } from './inline';
import { applyMath, applyTable, applyText } from './inputs';
import { applyReorder, applySlider, applySurvey } from './widgets';

export function applyAmplifyAnswer(
    state: AmplifyQuestionState,
    answerText: string,
    parsed?: XdParsedResponse
): boolean {
    let applied = false;
    switch (state.kind) {
        case 'choice':
            applied = applyChoice(answerText, state);
            break;
        case 'text':
            applied = applyText(answerText, state);
            break;
        case 'expression':
            applied = applyMath(answerText, state);
            break;
        case 'table':
            applied = applyTable(answerText, state);
            break;
        case 'cardsort':
            applied = applyCardsort(answerText);
            break;
        case 'inline':
            void applyInline(answerText, state);
            applied = true;
            break;
        case 'reorder':
            void applyReorder(answerText, state);
            applied = true;
            break;
        case 'slider':
            applied = applySlider(answerText, state);
            break;
        case 'survey':
            applied = applySurvey(answerText, state);
            break;
        default:
            applied = false;
            break;
    }

    if (applied && explanationText(parsed)) {
        setTimeout(() => { void fillExplanation(parsed); }, 700);
    }
    return applied;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});
    modules.amplify = modules.amplify || {};
    modules.amplify.autoanswer = { apply: applyAmplifyAnswer };
})();
