// src/providers/justclass/dom.ts
// JustClass page helpers entry: publishes the combined dom API from the dom-* parts.
import type { JustclassEntry } from './api';

export interface JustclassDomApi {
    norm(value: unknown): string;
    lower(value: unknown): string;
    sleep(ms: number): Promise<void>;
    isVisible(el: Element | null): boolean;
    getHash(): string | null;
    getQuestionNumber(): number;
    getWidgets(): Element[];
    getSelect(widget: Element | null): Element | null;
    getQuestionKey(widgets: Element[]): string;
    sameWidgets(a: Element[], b: Element[]): boolean;
    rowLabel(widget: Element): string;
    selectedText(select: Element | null): string;
    isAlreadyCorrect(widget: Element, entry: JustclassEntry | null): boolean;
    matchOption(options: Element[], values: string[]): Element | null;
    selectWidget(widget: Element, entry: JustclassEntry): Promise<boolean>;
    applySelections(widgets: Element[], entries: Array<JustclassEntry | null>, triggerKey: string, userTriggered: boolean): Promise<boolean>;
    questionRoot(widgets: Element[]): Element | null;
    questionStem(widgets: Element[]): string;
    collectQuestionImages(widgets: Element[]): Promise<string[]>;
    readWidgetOptions(widget: Element): Promise<string[]>;
    closePanels(): Promise<void>;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.justclass = I.providerModules.justclass || {});

    const { getHash, getQuestionKey, getQuestionNumber, getSelect, getWidgets, isVisible, lower, norm, rowLabel, sameWidgets, sleep } = ns.shared as Record<string, any>;
    const { applySelections, closePanels, isAlreadyCorrect, matchOption, selectWidget, selectedText } = ns.select as Record<string, any>;
    const { collectQuestionImages, questionRoot, questionStem, readWidgetOptions } = ns.question as Record<string, any>;
    ns.dom = {
        norm,
        lower,
        sleep,
        isVisible,
        getHash,
        getQuestionNumber,
        getWidgets,
        getSelect,
        getQuestionKey,
        sameWidgets,
        rowLabel,
        selectedText,
        isAlreadyCorrect,
        matchOption,
        selectWidget,
        applySelections,
        questionRoot,
        questionStem,
        collectQuestionImages,
        readWidgetOptions,
        closePanels
    } as JustclassDomApi;
})();
