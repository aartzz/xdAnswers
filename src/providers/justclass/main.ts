// src/providers/justclass/main.ts
// JustClass provider entry: answer-key scan loop, AI fallback, silent modes
// and page wiring.
import type { JustclassDomApi } from './dom';
import type { JustclassApi, JustclassEntry } from './api';
import type { JustclassUi } from './ui';

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

    let initialized = false;
    let scanTimer: number | null = null;
    let busy = false;
    let queuedScan: ScanOptions | null = null;
    let lastHash: string | null = null;
    let lastScanKey = '';
    let lastScanWidgets: Element[] = [];
    let lastQuestionKey = '';
    let answeredKey = '';
    let retryCount = 0;
    let oneClickRoot: Element | null = null;
    let oneClickHandler: ((event: Event) => Promise<void>) | null = null;
    let aiKey = '';                  // question key for which the AI fallback was requested
    let aiApplyAllowed = false;      // whether the AI answer may be selected automatically

    function domApi(): JustclassDomApi {
        return (I.providerModules as Record<string, any>).justclass.dom as JustclassDomApi;
    }

    function apiApi(): JustclassApi {
        return (I.providerModules as Record<string, any>).justclass.api as JustclassApi;
    }

    function uiApi(): JustclassUi {
        return (I.providerModules as Record<string, any>).justclass.ui as JustclassUi;
    }

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            try {
                await window.xdAnswers.loadSettings();
            } catch (e) {
                console.warn('[xdAnswers] JustClass: settings load failed, continuing with defaults', e);
            }
            initJustClass();
        }
    }, 50);

    // ---------------------------------------------------------------------
    // AI fallback (answer key API unavailable)
    // ---------------------------------------------------------------------

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

        applyVisuals(parsed);
    }

    async function aiFallback(widgets: Element[], options: ScanOptions, key: string): Promise<void> {
        const d = domApi();
        const settings = window.xdAnswers.settings || ({} as XdSettings);
        const oneclick = settings.silentMode === 'oneclick';

        if (oneclick && !options.userTriggered) {
            answeredKey = key;
            applyVisuals();
            return;
        }

        if (aiKey === key) {
            answeredKey = key;
            applyVisuals();
            return;
        }

        if (window.xdAnswers.isProcessingAI) {
            // Another AI request is already running; re-check once it finishes.
            setTimeout(() => scheduleScan(0), 900);
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
            answeredKey = key;
            return;
        }

        aiApplyAllowed = !!options.userTriggered || !!settings.autoAnswer || oneclick;
        aiKey = key;
        answeredKey = key;

        if (oneclick && options.userTriggered) {
            window.xdAnswers._oneClickUserTriggered = true;
        }

        window.xdAnswers._customAutoAnswer = applyAiAnswer;
        window.xdAnswers.processQuestion(payload);
    }

    // ---------------------------------------------------------------------
    // One-click and silent modes
    // ---------------------------------------------------------------------

    function clearOneClick(): void {
        if (oneClickRoot && oneClickHandler) {
            oneClickRoot.removeEventListener('click', oneClickHandler, true);
            oneClickRoot.classList.remove('xd-oneclick-ready');
            (oneClickRoot as HTMLElement).style.removeProperty('cursor');
        }
        oneClickRoot = null;
        oneClickHandler = null;
    }

    function registerOneClick(root: Element | null): void {
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
            await runScan({ force: true, userTriggered: true });
        };
        oneClickRoot.addEventListener('click', oneClickHandler, true);
    }

    function applyVisuals(parsedArg?: XdParsedResponse): void {
        const d = domApi();
        const u = uiApi();
        const settings = window.xdAnswers.settings || ({} as XdSettings);
        const mode = settings.silentMode || '';
        const parsed = parsedArg || window.xdAnswers.lastParsedResponse || {};

        if (mode !== 'oneclick') clearOneClick();
        u.clearMarks();

        if (mode === 'oneclick') {
            registerOneClick(d.questionRoot(d.getWidgets()));
            return;
        }

        if (mode === 'ghost') {
            if (!window.xdAnswers._originalTitle) {
                window.xdAnswers._originalTitle = document.title;
            }
            const short = u.plainAnswer(parsed).substring(0, 60);
            document.title = '[' + short + '] ' + window.xdAnswers._originalTitle;
            return;
        }

        if (mode === 'stealth') {
            const text = u.plainAnswer(parsed);
            if (text) {
                try { navigator.clipboard.writeText(text); } catch (e) {}
            }
            return;
        }

        const found = u.currentWidgetEntries();
        if (!found) return;

        if (mode === 'indicators') {
            found.widgets.forEach((widget, index) => {
                const entry = found.entries[index];
                if (entry && entry.correctValues.length) u.markWidget(widget, entry, true);
            });
            return;
        }

        if (mode !== '') return;
        if (!settings.highlightCorrect) return;

        found.widgets.forEach((widget, index) => {
            const entry = found.entries[index];
            if (entry && entry.correctValues.length) u.markWidget(widget, entry, false);
        });
    }

    function hookSilentMode(): void {
        const internal = I as XdAnswersInternal & { __xdJustClassWrapped?: boolean };
        if (!internal.applySilentMode || internal.__xdJustClassWrapped) return;
        const original = internal.applySilentMode;
        internal.applySilentMode = function (answerText: string, parsed: XdParsedResponse) {
            if (parsed && parsed._justclass) {
                applyVisuals(parsed);
                return;
            }
            return original.apply(this, arguments as unknown as [string, XdParsedResponse]);
        };
        internal.__xdJustClassWrapped = true;
    }

    // ---------------------------------------------------------------------
    // Scan loop
    // ---------------------------------------------------------------------

    function scheduleScan(delay: number, options?: ScanOptions): void {
        if (scanTimer !== null) clearTimeout(scanTimer);
        scanTimer = setTimeout(() => {
            scanTimer = null;
            runScan(options || {});
        }, delay);
    }

    async function runScan(options?: ScanOptions): Promise<void> {
        const opts = options || {};
        if (!initialized) return;
        if (!domApi().getHash()) return;

        if (busy) {
            queuedScan = opts;
            return;
        }
        busy = true;

        try {
            await scan(opts);
        } catch (err) {
            console.warn('[xdAnswers] JustClass scan failed:', err);
            uiApi().renderError(err);
        } finally {
            busy = false;
            if (queuedScan) {
                const next = queuedScan;
                queuedScan = null;
                scheduleScan(120, next);
            }
        }
    }

    async function scan(options: ScanOptions): Promise<void> {
        const d = domApi();
        const u = uiApi();
        const hash = d.getHash();
        if (!hash) return;

        const widgets = d.getWidgets();
        if (!widgets.length) {
            lastScanKey = '';
            lastScanWidgets = [];
            lastQuestionKey = '';
            answeredKey = '';
            aiKey = '';
            u.clearMarks();
            clearOneClick();
            return;
        }

        const key = d.getQuestionKey(widgets);
        if (!options.force
            && key === lastScanKey
            && d.sameWidgets(widgets, lastScanWidgets)
            && (apiApi().getCachedHash() === hash || aiKey === key)) {
            if (window.xdAnswers.helperContainer && !document.body.contains(window.xdAnswers.helperContainer)) {
                window.xdAnswers.attachAndPositionHelper();
            }
            return;
        }

        lastScanKey = key;
        lastScanWidgets = widgets;

        if (key !== lastQuestionKey) {
            retryCount = 0;
            lastQuestionKey = key;
        }
        if (options.force) {
            answeredKey = '';
            retryCount = 0;
        }

        const settings = window.xdAnswers.settings || ({} as XdSettings);

        let api: Awaited<ReturnType<JustclassApi['ensureApi']>> = null;
        try {
            api = await apiApi().ensureApi();
        } catch (err) {
            console.warn('[xdAnswers] JustClass: answer key unavailable, falling back to AI', err);
        }
        if (d.getHash() !== hash) return;

        const currentWidgets = d.getWidgets();
        if (!currentWidgets.length) return;
        const entries = currentWidgets.map((widget, index) => api ? apiApi().findEntry(widget, index) : null);
        const hasFullKey = entries.length > 0
            && entries.every(entry => entry && entry.correctValues.length);

        if (!hasFullKey) {
            await aiFallback(currentWidgets, options, key);
            return;
        }
        aiKey = '';

        const parsed = u.buildParsed(currentWidgets, entries);
        window.xdAnswers.lastParsedResponse = parsed;
        u.renderHelper(parsed, !!options.force);

        const auto = options.userTriggered
            || (settings.autoAnswer && settings.silentMode !== 'oneclick');

        if (auto && (options.force || key !== answeredKey)) {
            const ok = await d.applySelections(currentWidgets, entries, key, !!options.userTriggered);
            if (d.getHash() !== hash) return;
            if (d.getQuestionKey(d.getWidgets()) !== key) return;

            answeredKey = key;
            if (!ok && retryCount < 2) {
                retryCount++;
                setTimeout(() => runScan({ force: true }), 700);
            }
        } else if (!auto) {
            answeredKey = key;
        }

        if (d.getHash() !== hash) return;
        applyVisuals();
    }

    // ---------------------------------------------------------------------
    // Wiring
    // ---------------------------------------------------------------------

    function initJustClass(): void {
        if (initialized) return;
        initialized = true;

        console.log('[xdAnswers] JustClass provider loaded');
        lastHash = domApi().getHash();
        hookSilentMode();

        window.xdAnswers.onRefresh = () => {
            lastScanKey = '';
            lastQuestionKey = '';
            answeredKey = '';
            retryCount = 0;
            aiKey = '';
            scheduleScan(0, { force: true });
        };

        // Hash changes (SPA navigation) invalidate the cached answer key.
        setInterval(() => {
            const hash = domApi().getHash();
            if (hash === lastHash) return;
            lastHash = hash;
            apiApi().reset();
            lastScanKey = '';
            lastScanWidgets = [];
            lastQuestionKey = '';
            answeredKey = '';
            retryCount = 0;
            uiApi().resetRenderKey();
            aiKey = '';
            uiApi().clearMarks();
            clearOneClick();
            if (hash) scheduleScan(250, { force: true });
        }, 1000);

        let observerTimer: number | null = null;
        const observer = new MutationObserver(() => {
            if (observerTimer) return;
            observerTimer = setTimeout(() => {
                observerTimer = null;
                scheduleScan(200);
            }, 100);

            if (window.xdAnswers.helperContainer && !document.body.contains(window.xdAnswers.helperContainer)) {
                document.body.appendChild(window.xdAnswers.helperContainer);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Settings changes can turn auto-answer/highlight/silent mode on or off.
        try {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area !== 'local' || !changes.xdAnswers_settings) return;
                lastScanKey = '';
                answeredKey = '';
                window.xdAnswers.loadSettings()
                    .then(() => scheduleScan(120, { force: false }))
                    .catch(() => scheduleScan(120, { force: false }));
            });
        } catch (e) {}

        scheduleScan(0);
    }
})();
