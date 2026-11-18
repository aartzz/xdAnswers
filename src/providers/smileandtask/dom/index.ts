// src/providers/smileandtask/dom/index.ts
// Publishes the S&T School DOM reader on window.xdAnswers._internal so that the
// provider entry (main.ts) does not import the DOM modules a second time.
import { readQuestion } from './question';
import { revealOptions } from './reveal';
import { currentTestId, currentTopic, currentTopicDescription } from './storage';
import type { StQuestionState } from './types';
import { cleanText, loadImages } from './util';

export type {
    StKind,
    StMatchRight,
    StMatchRow,
    StOption,
    StOrderItem,
    StOrderSlot,
    StQuestionState,
    StTextInput
} from './types';

export interface SmileAndTaskDomApi {
    readQuestion: () => StQuestionState | null;
    revealOptions: (state: StQuestionState) => Promise<void>;
    loadImages: (urls: string[]) => Promise<string[]>;
    currentTopic: () => string | undefined;
    currentTopicDescription: () => string | undefined;
    currentTestId: () => string | undefined;
    cleanText: (value: string | null | undefined) => string;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

    const api: SmileAndTaskDomApi = {
        readQuestion,
        revealOptions,
        loadImages,
        currentTopic,
        currentTopicDescription,
        currentTestId,
        cleanText
    };
    modules.smileandtask = modules.smileandtask || {};
    modules.smileandtask.dom = api;
})();
