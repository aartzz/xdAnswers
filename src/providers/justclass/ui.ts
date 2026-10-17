// src/providers/justclass/ui.ts
// Helper content, answer markers and entry lookup for the JustClass provider.
import type { JustclassEntry, JustclassApi } from './api';
import type { JustclassDomApi } from './dom';

export interface JustclassUi {
    setAiEntry(widget: Element, entry: JustclassEntry | null): void;
    buildParsed(widgets: Element[], entries: Array<JustclassEntry | null>): XdParsedResponse;
    plainAnswer(parsed: XdParsedResponse | null | undefined): string;
    renderHelper(parsed: XdParsedResponse, force: boolean): void;
    renderError(err: unknown): void;
    clearMarks(): void;
    markWidget(widget: Element, entry: JustclassEntry, indicator: boolean): void;
    currentWidgetEntries(): { widgets: Element[]; entries: Array<JustclassEntry | null> } | null;
    resetRenderKey(): void;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.justclass = I.providerModules.justclass || {});

    let lastRenderKey = '';
    const aiEntryMap = new WeakMap<Element, JustclassEntry>();

    function domApi(): JustclassDomApi {
        return (I.providerModules as Record<string, any>).justclass.dom as JustclassDomApi;
    }

    function apiApi(): JustclassApi {
        return (I.providerModules as Record<string, any>).justclass.api as JustclassApi;
    }

    function setAiEntry(widget: Element, entry: JustclassEntry | null): void {
        if (entry) aiEntryMap.set(widget, entry);
    }

    function buildParsed(widgets: Element[], entries: Array<JustclassEntry | null>): XdParsedResponse {
        const rowLabel = domApi().rowLabel;
        const lines: string[] = [];
        const values: string[] = [];

        widgets.forEach((widget, index) => {
            const entry = entries[index];
            if (!entry || !entry.correctValues.length) return;
            const value = entry.correctValues.join(' / ');
            values.push(value);

            if (widgets.length > 1) {
                const label = rowLabel(widget);
                lines.push((label ? (index + 1) + '. ' + label + ' — ' : (index + 1) + '. ') + '**' + value + '**');
            } else {
                lines.push('**' + value + '**');
            }
        });

        if (!lines.length) {
            return {
                answer: '',
                explanation: 'У ключі відповідей JustClass не знайдено відповіді для цього завдання.',
                _justclass: true,
                _justclassShort: ''
            };
        }

        return {
            answer: lines.join('\n'),
            explanation: '',
            _justclass: true,
            _justclassShort: values.join('; '),
            isStructured: true
        };
    }

    function plainAnswer(parsed: XdParsedResponse | null | undefined): string {
        const text = (parsed && (parsed._justclassShort || parsed.answer)) || '';
        return domApi().norm(String(text).replace(/\*\*/g, '').replace(/\n+/g, '; '));
    }

    function renderHelper(parsed: XdParsedResponse, force: boolean): void {
        const d = domApi();
        const key = (d.getHash() || '') + '|' + d.getQuestionNumber() + '|' + (parsed.answer || '') + '|' + (parsed.explanation || '');
        if (!force && key === lastRenderKey
            && window.xdAnswers.helperContainer
            && document.body.contains(window.xdAnswers.helperContainer)) {
            return;
        }
        lastRenderKey = key;

        if (!window.xdAnswers.helperContainer) window.xdAnswers.createUI();
        if (!document.body.contains(window.xdAnswers.helperContainer)) {
            window.xdAnswers.attachAndPositionHelper();
        }

        const div = window.xdAnswers.answerContentDiv;
        if (!div) return;
        const html = I.renderParsedResponse(parsed);
        div.innerHTML = html || '<div class="xd-answer">Готово.</div>';
    }

    function renderError(err: unknown): void {
        const message = err && (err as Error).message ? (err as Error).message : String(err);
        const parsed: XdParsedResponse = {
            answer: '',
            explanation: 'Не вдалося завантажити ключ відповідей JustClass: ' + message,
            _justclass: true,
            _justclassShort: ''
        };
        window.xdAnswers.lastParsedResponse = parsed;
        renderHelper(parsed, false);
    }

    function clearMarks(): void {
        document.querySelectorAll('.xd-jc-highlight').forEach(el => {
            el.classList.remove('xd-jc-highlight', 'xd-highlight-correct');
            (el as HTMLElement).style.removeProperty('outline');
            (el as HTMLElement).style.removeProperty('outline-offset');
            (el as HTMLElement).style.removeProperty('border-radius');
        });
        document.querySelectorAll('.xd-jc-dot').forEach(el => el.remove());
        document.querySelectorAll('justkids-select-dynamic').forEach(el => (el as HTMLElement).style.removeProperty('position'));
    }

    function markWidget(widget: Element, entry: JustclassEntry, indicator: boolean): void {
        const formField = widget.querySelector('mat-form-field') || widget;

        if (indicator) {
            const widgetEl = widget as HTMLElement;
            widgetEl.style.setProperty('position', 'relative', 'important');
            const dot = document.createElement('span');
            dot.className = 'xd-indicator-dot xd-jc-dot';
            dot.style.cssText = 'position:absolute;top:-3px;right:-3px;width:8px;height:8px;background:#22c55e;border-radius:50%;box-shadow:0 0 4px rgba(34,197,94,0.5);pointer-events:none;z-index:2;';
            dot.title = entry.correctValues.join(', ');
            widget.appendChild(dot);
            return;
        }

        const formFieldEl = formField as HTMLElement;
        formFieldEl.classList.add('xd-highlight-correct', 'xd-jc-highlight');
        formFieldEl.style.setProperty('outline', '2px solid #22c55e', 'important');
        formFieldEl.style.setProperty('outline-offset', '2px', 'important');
        formFieldEl.style.setProperty('border-radius', '8px', 'important');
    }

    function currentWidgetEntries(): { widgets: Element[]; entries: Array<JustclassEntry | null> } | null {
        const widgets = domApi().getWidgets();
        if (!widgets.length) return null;

        const entries = widgets.map((widget, index) => {
            const apiEntry = apiApi().findEntry(widget, index);
            if (apiEntry && apiEntry.correctValues.length) return apiEntry;
            return aiEntryMap.get(widget) || null;
        });

        if (!entries.some(entry => entry && entry.correctValues.length)) return null;
        return { widgets, entries };
    }

    function resetRenderKey(): void {
        lastRenderKey = '';
    }

    ns.ui = {
        setAiEntry,
        buildParsed,
        plainAnswer,
        renderHelper,
        renderError,
        clearMarks,
        markWidget,
        currentWidgetEntries,
        resetRenderKey
    } as JustclassUi;
})();
