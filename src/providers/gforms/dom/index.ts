// src/providers/gforms/dom/index.ts
// Google Forms DOM layer entry: hidden/disabled filtering, grid (rows x columns) parsing, payload building.
import { isHiddenOrDisabled, collectGrid } from './grid';
import type { GformsGridPayload } from './grid';
import { buildQuestionData } from './question';

export type { GformsGridPayload } from './grid';

export interface GformsDomApi {
    isHiddenOrDisabled(el: Element): boolean;
    collectGrid(container: Element): GformsGridPayload | null;
    buildQuestionData(container: Element): Promise<XdQuestionData>;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

    const api: GformsDomApi = { isHiddenOrDisabled, collectGrid, buildQuestionData };
    modules.gforms = modules.gforms || {};
    modules.gforms.dom = api;
})();
