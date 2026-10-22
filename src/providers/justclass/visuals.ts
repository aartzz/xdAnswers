// src/providers/justclass/visuals.ts
// JustClass visuals, indicators, ghost/stealth silent modes and one-click handling.
import type { JustclassDomApi } from './dom';
import type { JustclassUi } from './ui';

let oneClickRoot: Element | null = null;
let oneClickHandler: ((event: Event) => Promise<void>) | null = null;

export function clearOneClick(): void {
    if (oneClickRoot && oneClickHandler) {
        oneClickRoot.removeEventListener('click', oneClickHandler, true);
        oneClickRoot.classList.remove('xd-oneclick-ready');
        (oneClickRoot as HTMLElement).style.removeProperty('cursor');
    }
    oneClickRoot = null;
    oneClickHandler = null;
}

export function registerOneClick(root: Element | null, onTrigger: () => Promise<void>): void {
    if (!root) return;
    if (oneClickRoot === root && oneClickHandler) return;
    clearOneClick();

    oneClickRoot = root;
    oneClickRoot.classList.add('xd-oneclick-ready');
    (oneClickRoot as HTMLElement).style.cursor = 'pointer';

    oneClickHandler = async (event: Event) => {
        if (window.xdAnswers._autoSelecting) return;
        const target = event && event.target as Element | null;
        if (target && target.closest && target.closest('.ollama-helper-container')) return;
        await onTrigger();
    };
    oneClickRoot.addEventListener('click', oneClickHandler, true);
}

export function applyVisuals(
    dom: JustclassDomApi,
    ui: JustclassUi,
    parsedArg?: XdParsedResponse,
    onOneClickTrigger?: () => Promise<void>
): void {
    const settings = window.xdAnswers.settings || ({} as XdSettings);
    const mode = settings.silentMode || '';
    const parsed = parsedArg || window.xdAnswers.lastParsedResponse || {};

    if (mode !== 'oneclick') clearOneClick();
    ui.clearMarks();

    if (mode === 'oneclick') {
        if (onOneClickTrigger) {
            registerOneClick(dom.questionRoot(dom.getWidgets()), onOneClickTrigger);
        }
        return;
    }

    if (mode === 'ghost') {
        if (!window.xdAnswers._originalTitle) {
            window.xdAnswers._originalTitle = document.title;
        }
        const short = ui.plainAnswer(parsed).substring(0, 60);
        document.title = '[' + short + '] ' + window.xdAnswers._originalTitle;
        return;
    }

    if (mode === 'stealth') {
        const text = ui.plainAnswer(parsed);
        if (text) {
            try { navigator.clipboard.writeText(text); } catch (e) {}
        }
        return;
    }

    const found = ui.currentWidgetEntries();
    if (!found) return;

    if (mode === 'indicators') {
        found.widgets.forEach((widget, index) => {
            const entry = found.entries[index];
            if (entry && entry.correctValues.length) ui.markWidget(widget, entry, true);
        });
        return;
    }

    if (mode !== '') return;
    if (!settings.highlightCorrect) return;

    found.widgets.forEach((widget, index) => {
        const entry = found.entries[index];
        if (entry && entry.correctValues.length) ui.markWidget(widget, entry, false);
    });
}

export function hookSilentMode(onApplyVisuals: (parsed: XdParsedResponse) => void): void {
    const internal = window.xdAnswers._internal as XdAnswersInternal & { __xdJustClassWrapped?: boolean };
    if (!internal.applySilentMode || internal.__xdJustClassWrapped) return;
    const original = internal.applySilentMode;
    internal.applySilentMode = function (answerText: string, parsed: XdParsedResponse) {
        if (parsed && parsed._justclass) {
            onApplyVisuals(parsed);
            return;
        }
        return original.apply(this, arguments as unknown as [string, XdParsedResponse]);
    };
    internal.__xdJustClassWrapped = true;
}
