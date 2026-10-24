// src/providers/justclass/ai-fallback.ts
// JustClass AI fallback for when the answer-key API is unavailable: builds the
// question payload from the widgets, maps the AI reply to options and applies it.
import type { JustclassDomApi } from './dom';
import type { JustclassApi, JustclassEntry } from './api';
import type { JustclassUi } from './ui';

export interface JustclassAiFallbackHost {
    applyVisuals(parsed?: XdParsedResponse): void;
    scheduleScan(delay: number): void;
    setAnsweredKey(key: string): void;
}

export interface JustclassAiFallbackApi {
    run(widgets: Element[], options: { force?: boolean; userTriggered?: boolean }, key: string): Promise<void>;
    reset(): void;
    isFor(key: string): boolean;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.justclass = I.providerModules.justclass || {});

    interface ScanOptions {
        force?: boolean;
        userTriggered?: boolean;
    }

    let aiKey = '';                  // question key for which the AI fallback was requested
    let aiApplyAllowed = false;      // whether the AI answer may be selected automatically
    let host: JustclassAiFallbackHost;

    function domApi(): JustclassDomApi {
        return (I.providerModules as Record<string, any>).justclass.dom as JustclassDomApi;
    }

    function apiApi(): JustclassApi {
        return (I.providerModules as Record<string, any>).justclass.api as JustclassApi;
    }

    function uiApi(): JustclassUi {
        return (I.providerModules as Record<string, any>).justclass.ui as JustclassUi;
    }

    function aiValues(answerText: string, count: number): string[] {
        const cleaned = String(answerText == null ? '' : answerText).trim();
        if (!cleaned || count < 1) return [];

        const pairs = new Map<number, string>();
        cleaned.split(/[\n;]+/).forEach(chunk => {
            const m = domApi().norm(chunk).match(/^(\d+)\s*[=:.)\-]\s*(.+)$/);
            if (!m) return;
            const index = parseInt(m[1], 10);
            if (index >= 1 && index <= count && !pairs.has(index)) pairs.set(index, m[2].trim());
        });

        if (count === 1) {
            const single = pairs.get(1)
                || domApi().norm(cleaned).replace(/^\s*(?:answer|відповідь)\s*[:\-]\s*/i, '');
            return [single.split(/\n+/)[0].trim()];
        }

        const values: string[] = [];
        for (let i = 1; i <= count; i++) values.push(pairs.get(i) || '');
        if (values.some(Boolean)) return values;

        const lines = cleaned.split(/[\n;]+/)
            .map(line => domApi().norm(line).replace(/^\d+\s*[=:.)\-]?\s*/, ''))
            .filter(Boolean);
        for (let i = 0; i < count; i++) values[i] = lines[i] || '';
        return values;
    }

    function aiEntry(values: string | string[] | undefined): JustclassEntry | null {
        const d = domApi();
        const seen = new Set<string>();
        const correctValues: string[] = [];
        const list = Array.isArray(values) ? values : (values ? [values] : []);

        function push(value: string): void {
            const clean = d.norm(value).replace(/[*`]+/g, '').replace(/^["'«»]+|["'«»]+$/g, '').trim();
            if (!clean) return;
            const key = d.lower(clean);
            if (seen.has(key)) return;
            seen.add(key);
            correctValues.push(clean);
        }

        list.forEach(value => {
            push(value);

            const clean = d.norm(value).replace(/[*`]+/g, '').replace(/^["'«»]+|["'«»]+$/g, '').trim();
            clean.split(/[(),;:\u2014\u2013]|\s+-\s+/).forEach(part => push(part));

            const low = d.lower(clean);
            if (low === 'правда' || low === 'вірно' || low === 'true') push('Так');
            if (low === 'хиба' || low === 'неправда' || low === 'невірно' || low === 'false') push('Ні');
        });

        return correctValues.length
            ? { answerId: '', options: [], correctValues: correctValues, tooltip: '' }
            : null;
    }

    async function buildAiPayload(widgets: Element[]): Promise<XdQuestionData | null> {
        const d = domApi();
        const a = apiApi();
        const stem = d.questionStem(widgets);
        const rows: Array<{ label: string; options: string[] }> = [];
        let hasOptions = false;

        for (let i = 0; i < widgets.length; i++) {
            const widget = widgets[i];
            const entry = a.findEntry(widget, i);
            let options = entry ? entry.options.map(option => option.value).filter(Boolean) : [];

            if (!options.length) options = await d.readWidgetOptions(widget);
            if (options.length) hasOptions = true;

            rows.push({
                label: d.rowLabel(widget) || ('Пункт ' + (i + 1)),
                options: options
            });
        }

        if (!hasOptions) return null;

        let text: string;
        let optionsText = '';

        if (rows.length === 1) {
            text = stem || 'Завдання JustClass.';
            optionsText = rows[0].options.join('\n');
        } else {
            text = 'Це завдання з кількома пунктами — для кожного пункту треба вибрати правильний варіант.\n'
                + 'Відповідай СТРОГО у форматі: 1=варіант; 2=варіант; ... (номер пункту = вибраний варіант).\n'
                + 'Використовуй ТОЧНИЙ текст варіанту зі списку.\n\n';
            if (stem) text += 'Завдання: ' + stem + '\n\n';
            text += 'Пункти:';
            rows.forEach((row, index) => {
                text += '\n' + (index + 1) + '. ' + row.label + ' — варіанти: ' + row.options.join(' | ');
            });
        }

        return {
            text: text,
            optionsText: optionsText,
            base64Images: await d.collectQuestionImages(widgets),
            topic: 'JustClass'
        };
    }

    async function applyAiAnswer(answerText: string, parsed: XdParsedResponse): Promise<void> {
        const d = domApi();
        const u = uiApi();
        const widgets = d.getWidgets();
        if (!widgets.length) return;
        const key = d.getQuestionKey(widgets);
        if (aiKey && key !== aiKey) {
            console.warn('[xdAnswers] JustClass: AI answer arrived for an older question, skipping');
            return;
        }
        aiKey = key;

        const values = aiValues(answerText, widgets.length);
        const entries = widgets.map((widget, index) => aiEntry(values[index]));
        entries.forEach((entry, index) => {
            if (entry) u.setAiEntry(widgets[index], entry);
        });

        if (aiApplyAllowed) {
            await d.applySelections(widgets, entries, key, true);
        }

        parsed = parsed || ({} as XdParsedResponse);
        parsed._justclass = true;
        parsed._justclassShort = entries
            .map(entry => entry ? entry.correctValues[0] : '')
            .filter(Boolean)
            .join('; ');
        window.xdAnswers.lastParsedResponse = parsed;

        host.applyVisuals(parsed);
    }

    async function aiFallback(widgets: Element[], options: ScanOptions, key: string): Promise<void> {
        const d = domApi();
        const settings = window.xdAnswers.settings || ({} as XdSettings);
        const oneclick = settings.silentMode === 'oneclick';

        if (oneclick && !options.userTriggered) {
            host.setAnsweredKey(key);
            host.applyVisuals();
            return;
        }

        if (aiKey === key) {
            host.setAnsweredKey(key);
            host.applyVisuals();
            return;
        }

        if (window.xdAnswers.isProcessingAI) {
            // Another AI request is already running; re-check once it finishes.
            setTimeout(() => host.scheduleScan(0), 900);
            return;
        }

        let payload: XdQuestionData | null = null;
        try {
            payload = await buildAiPayload(widgets);
        } catch (err) {
            console.warn('[xdAnswers] JustClass: failed to prepare AI fallback payload', err);
        }

        if (d.getQuestionKey(d.getWidgets()) !== key) return;

        if (!payload) {
            uiApi().renderError(new Error('ключ відповідей недоступний, а варіанти завдання прочитати не вдалося'));
            host.setAnsweredKey(key);
            return;
        }

        aiApplyAllowed = !!options.userTriggered || !!settings.autoAnswer || oneclick;
        aiKey = key;
        host.setAnsweredKey(key);

        if (oneclick && options.userTriggered) {
            window.xdAnswers._oneClickUserTriggered = true;
        }

        window.xdAnswers._customAutoAnswer = applyAiAnswer;
        window.xdAnswers.processQuestion(payload);
    }

    function createAiFallback(hostApi: JustclassAiFallbackHost): JustclassAiFallbackApi {
        host = hostApi;
        return {
            run: (widgets, options, key) => aiFallback(widgets, options, key),
            reset: () => { aiKey = ''; },
            isFor: (key) => aiKey === key
        };
    }

    ns.createAiFallback = createAiFallback;
})();
