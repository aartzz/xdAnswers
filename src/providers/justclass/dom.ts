// src/providers/justclass/dom.ts
// JustClass page helpers: widget discovery, question extraction and
// Angular Material mat-select driving.
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

    const PANEL_SELECTOR = '.mat-select-panel';
    const PANEL_WAIT_MS = 1400;
    const OPTION_WAIT_MS = 1000;

    function norm(s: unknown): string {
        return String(s == null ? '' : s)
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function lower(s: unknown): string {
        return norm(s).toLocaleLowerCase('uk');
    }

    function sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function isVisible(el: Element | null): boolean {
        if (!el || !el.isConnected) return false;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        return el.getClientRects().length > 0;
    }

    function getHash(): string | null {
        const m = location.pathname.match(/\/hw\/([^/?#]+)/);
        if (!m) return null;
        try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
    }

    function getQuestionNumber(): number {
        const widgets = getWidgets();
        const scope = widgets.length
            ? (widgets[0].closest('.preview-block') || widgets[0].closest('justkids-training-preview'))
            : null;

        const candidates: Element[] = [];
        if (scope) candidates.push(scope);
        document.querySelectorAll('.preview-block, justkids-training-preview').forEach(el => {
            if (isVisible(el)) candidates.push(el);
        });
        candidates.push(document.body);

        for (const root of candidates) {
            const text = norm((root as HTMLElement).innerText);
            const m = text.match(/(\d+)\s*із\s*(\d+)/i);
            if (m) return parseInt(m[1], 10) || 0;
        }
        return 0;
    }

    function getWidgets(): Element[] {
        return Array.from(document.querySelectorAll('justkids-select-dynamic'))
            .filter(isVisible);
    }

    function getSelect(widget: Element | null): Element | null {
        return widget ? widget.querySelector('mat-select') : null;
    }

    function getQuestionKey(widgets: Element[]): string {
        const ids = widgets.map(w => w.id || '').join(',');
        return (getHash() || '') + '|' + getQuestionNumber() + '|' + ids;
    }

    function sameWidgets(a: Element[], b: Element[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    function rowLabel(widget: Element): string {
        let node: Element | null = widget;
        for (let depth = 0; depth < 3 && node; depth++) {
            let prev = node.previousElementSibling;
            while (prev && !norm(prev.textContent)) prev = prev.previousElementSibling;
            if (prev && !prev.querySelector('justkids-select-dynamic, mat-select, .select-wrapper')) {
                const text = norm(prev.textContent);
                if (text && text.length <= 180) return text;
            }
            node = node.parentElement;
        }
        return '';
    }

    // ---------------------------------------------------------------------
    // Angular Material mat-select driving
    // ---------------------------------------------------------------------

    function getVisiblePanel(): Element | null {
        const panels = Array.from(document.querySelectorAll(PANEL_SELECTOR)).filter(isVisible);
        return panels[panels.length - 1] || null;
    }

    function panelForSelect(select: Element): Element | null {
        const owns = select.getAttribute('aria-owns');
        if (owns) {
            const panel = document.getElementById(owns);
            if (panel && panel.matches(PANEL_SELECTOR) && isVisible(panel)) return panel;
        }
        return null;
    }

    function isDisabled(select: Element | null): boolean {
        return !select
            || select.getAttribute('aria-disabled') === 'true'
            || select.classList.contains('mat-select-disabled')
            || select.hasAttribute('disabled');
    }

    async function waitFor<T>(fn: () => T | null, timeout?: number, interval?: number): Promise<T | null> {
        const end = Date.now() + (timeout || 1000);
        const step = interval || 40;
        while (Date.now() < end) {
            try {
                const value = fn();
                if (value) return value;
            } catch (e) {}
            await sleep(step);
        }
        return null;
    }

    async function closePanels(): Promise<void> {
        if (!getVisiblePanel()) return;

        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true
        }));
        await sleep(120);

        if (!getVisiblePanel()) return;

        const backdrop = document.querySelector('.cdk-overlay-backdrop');
        if (backdrop) {
            (backdrop as HTMLElement).click();
            await sleep(120);
        }
    }

    function selectedText(select: Element | null): string {
        if (!select) return '';
        const textEl = select.querySelector('.mat-select-value-text');
        if (textEl) return norm(textEl.textContent);

        const valueEl = select.querySelector('.mat-select-value');
        if (!valueEl) return '';
        if (valueEl.querySelector('.mat-select-placeholder')) return '';
        return norm(valueEl.textContent);
    }

    function isAlreadyCorrect(widget: Element, entry: JustclassEntry | null): boolean {
        const select = getSelect(widget);
        if (!select || !entry || !entry.correctValues.length) return false;
        const selected = lower(selectedText(select));
        if (!selected) return false;
        return entry.correctValues.some(value => lower(value) === selected);
    }

    function optionText(option: Element): string {
        const textEl = option.querySelector('.mat-option-text');
        return norm(textEl ? textEl.textContent : option.textContent);
    }

    function similarity(a: string, b: string): number {
        if (a === b) return 1;
        if (!a || !b) return 0;
        if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return 0.9;

        const m = a.length;
        const n = b.length;
        if (Math.abs(m - n) / Math.max(m, n) > 0.6) return 0;

        let prev = new Array(n + 1);
        for (let j = 0; j <= n; j++) prev[j] = j;

        for (let i = 1; i <= m; i++) {
            const current = [i];
            for (let j = 1; j <= n; j++) {
                current[j] = Math.min(
                    current[j - 1] + 1,
                    prev[j] + 1,
                    prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
            }
            prev = current;
        }

        return 1 - prev[n] / Math.max(m, n);
    }

    function matchOption(options: Element[], values: string[]): Element | null {
        const wanted = values.map(lower).filter(Boolean);
        if (!wanted.length) return null;

        for (const value of wanted) {
            const exact = options.find(option => lower(optionText(option)) === value);
            if (exact) return exact;
        }

        for (const value of wanted) {
            if (value.length < 3) continue;
            const contains = options.find(option => {
                const text = lower(optionText(option));
                return text.length >= 3 && (text.includes(value) || value.includes(text));
            });
            if (contains) return contains;
        }

        let best: Element | null = null;
        let bestScore = 0;
        for (const option of options) {
            const text = lower(optionText(option));
            for (const value of wanted) {
                const score = similarity(text, value);
                if (score > bestScore) {
                    bestScore = score;
                    best = option;
                }
            }
        }
        return bestScore >= 0.72 ? best : null;
    }

    async function selectWidget(widget: Element, entry: JustclassEntry): Promise<boolean> {
        const select = getSelect(widget);
        if (!select || isDisabled(select)) return false;
        if (isAlreadyCorrect(widget, entry)) return true;

        let panel: Element | null = null;
        if (select.getAttribute('aria-expanded') === 'true') {
            panel = panelForSelect(select) || getVisiblePanel();
        } else {
            await closePanels();
            const trigger = select.querySelector('.mat-select-trigger') || select;
            (trigger as HTMLElement).click();
            panel = await waitFor(() => panelForSelect(select) || getVisiblePanel(), PANEL_WAIT_MS);

            if (!panel && select.getAttribute('aria-expanded') !== 'true') {
                (select as HTMLElement).click();
                panel = await waitFor(() => panelForSelect(select) || getVisiblePanel(), PANEL_WAIT_MS);
            }
        }

        if (!panel) {
            await closePanels();
            return false;
        }

        const options = await waitFor(() => {
            const list = Array.from(panel.querySelectorAll('mat-option'));
            return list.length ? list : null;
        }, OPTION_WAIT_MS);

        if (!options) {
            await closePanels();
            return false;
        }

        const option = matchOption(options, entry.correctValues);
        if (!option) {
            await closePanels();
            return false;
        }

        (option as HTMLElement).click();
        await waitFor(() => isAlreadyCorrect(widget, entry), 900, 50);
        await closePanels();
        return isAlreadyCorrect(widget, entry);
    }

    async function applySelections(widgets: Element[], entries: Array<JustclassEntry | null>, triggerKey: string, userTriggered: boolean): Promise<boolean> {
        const settings = window.xdAnswers.settings || ({} as XdSettings);
        if (!userTriggered && settings.autoAnswerCooldown) {
            const cooldown = Math.min(Math.max(0, Number(settings.autoAnswerCooldown) || 0), 5000);
            if (cooldown) await sleep(cooldown);
            if (getQuestionKey(getWidgets()) !== triggerKey) return false;
        }

        let allDone = true;
        for (let i = 0; i < widgets.length; i++) {
            const widget = widgets[i];
            const entry = entries[i];
            if (!widget.isConnected) return false;
            if (!entry || !entry.correctValues.length) {
                allDone = false;
                continue;
            }
            if (isAlreadyCorrect(widget, entry)) continue;

            const ok = await selectWidget(widget, entry);
            if (!ok) allDone = false;
            if (getQuestionKey(getWidgets()) !== triggerKey) return false;
            await sleep(80);
        }
        return allDone;
    }

    // ---------------------------------------------------------------------
    // Question extraction
    // ---------------------------------------------------------------------

    function questionRoot(widgets: Element[]): Element | null {
        if (!widgets.length) return null;
        return widgets[0].closest('justkids-text-select')
            || widgets[0].closest('.preview-content')
            || widgets[0].closest('justkids-training-preview')
            || widgets[0].parentElement;
    }

    function questionStem(widgets: Element[]): string {
        const root = questionRoot(widgets);
        if (!root) return '';
        const clone = root.cloneNode(true) as Element;
        clone.querySelectorAll('justkids-select-dynamic').forEach(el => el.remove());
        return norm((clone as HTMLElement).innerText || clone.textContent);
    }

    async function collectQuestionImages(widgets: Element[]): Promise<string[]> {
        const root = questionRoot(widgets);
        if (!root || !window.xdAnswers.imageToBase64) return [];

        const urls: string[] = [];
        root.querySelectorAll('img').forEach(img => {
            if (!img.src || img.src.startsWith('data:image/gif')) return;
            if (img.closest('justkids-select-dynamic')) return;
            if ((img.width || img.naturalWidth || 0) < 40) return;
            if (!urls.includes(img.src)) urls.push(img.src);
        });

        const images = await Promise.all(urls.map(url =>
            Promise.resolve(window.xdAnswers.imageToBase64(url)).catch(() => null)
        ));
        return images.filter(Boolean) as string[];
    }

    async function readWidgetOptions(widget: Element): Promise<string[]> {
        const select = getSelect(widget);
        if (!select || isDisabled(select)) return [];

        let panel: Element | null = select.getAttribute('aria-expanded') === 'true'
            ? (panelForSelect(select) || getVisiblePanel())
            : null;

        if (!panel) {
            await closePanels();
            const trigger = select.querySelector('.mat-select-trigger') || select;
            (trigger as HTMLElement).click();
            panel = await waitFor(() => panelForSelect(select) || getVisiblePanel(), PANEL_WAIT_MS);
            if (!panel && select.getAttribute('aria-expanded') !== 'true') {
                (select as HTMLElement).click();
                panel = await waitFor(() => panelForSelect(select) || getVisiblePanel(), PANEL_WAIT_MS);
            }
        }

        let texts: string[] = [];
        if (panel) {
            const options = await waitFor(() => {
                const list = Array.from(panel!.querySelectorAll('mat-option'));
                return list.length ? list : null;
            }, OPTION_WAIT_MS);
            if (options) texts = options.map(optionText).filter(Boolean);
        }

        await closePanels();
        return texts;
    }

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
