// src/providers/justclass/main.ts
// JustClass provider entry: answer-key scan loop, silent modes and page wiring.
import type { JustclassDomApi } from './dom';
import type { JustclassApi, JustclassEntry } from './api';
import type { JustclassUi } from './ui';
import type { JustclassAiFallbackApi } from './ai-fallback';
import { applyVisuals as runVisuals, clearOneClick, hookSilentMode } from './visuals';

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

    function domApi(): JustclassDomApi {
        return (I.providerModules as Record<string, any>).justclass.dom as JustclassDomApi;
    }

    function apiApi(): JustclassApi {
        return (I.providerModules as Record<string, any>).justclass.api as JustclassApi;
    }

    function uiApi(): JustclassUi {
        return (I.providerModules as Record<string, any>).justclass.ui as JustclassUi;
    }

    function handleApplyVisuals(parsed?: XdParsedResponse): void {
        runVisuals(domApi(), uiApi(), parsed, async () => {
            await runScan({ force: true, userTriggered: true });
        });
    }

    const ai: JustclassAiFallbackApi = (I.providerModules as Record<string, any>).justclass.createAiFallback({
        applyVisuals: (parsed?: XdParsedResponse) => handleApplyVisuals(parsed),
        scheduleScan: (delay: number) => scheduleScan(delay),
        setAnsweredKey: (key: string) => { answeredKey = key; }
    });

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
            ai.reset();
            u.clearMarks();
            clearOneClick();
            return;
        }

        const key = d.getQuestionKey(widgets);
        if (!options.force
            && key === lastScanKey
            && d.sameWidgets(widgets, lastScanWidgets)
            && (apiApi().getCachedHash() === hash || ai.isFor(key))) {
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
            await ai.run(currentWidgets, options, key);
            return;
        }
        ai.reset();

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
        handleApplyVisuals();
    }

    // ---------------------------------------------------------------------
    // Wiring
    // ---------------------------------------------------------------------

    function initJustClass(): void {
        if (initialized) return;
        initialized = true;

        console.log('[xdAnswers] JustClass provider loaded');
        lastHash = domApi().getHash();
        hookSilentMode(handleApplyVisuals);

        window.xdAnswers.onRefresh = () => {
            lastScanKey = '';
            lastQuestionKey = '';
            answeredKey = '';
            retryCount = 0;
            ai.reset();
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
            ai.reset();
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
