// src/providers/justclass/dom/select.ts
// JustClass mat-select driving: opening panels, matching options and applying answers.
import type { JustclassEntry } from '../api';
import { OPTION_WAIT_MS, PANEL_SELECTOR, PANEL_WAIT_MS, getQuestionKey, getSelect, getWidgets, isVisible, lower, norm, sleep } from './shared';

// ---------------------------------------------------------------------
// Angular Material mat-select driving
// ---------------------------------------------------------------------

export function getVisiblePanel(): Element | null {
    const panels = Array.from(document.querySelectorAll(PANEL_SELECTOR)).filter(isVisible);
    return panels[panels.length - 1] || null;
}

export function panelForSelect(select: Element): Element | null {
    const owns = select.getAttribute('aria-owns');
    if (owns) {
        const panel = document.getElementById(owns);
        if (panel && panel.matches(PANEL_SELECTOR) && isVisible(panel)) return panel;
    }
    return null;
}

export function isDisabled(select: Element | null): boolean {
    return !select
        || select.getAttribute('aria-disabled') === 'true'
        || select.classList.contains('mat-select-disabled')
        || select.hasAttribute('disabled');
}

export async function waitFor<T>(fn: () => T | null, timeout?: number, interval?: number): Promise<T | null> {
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

export async function closePanels(): Promise<void> {
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

export function selectedText(select: Element | null): string {
    if (!select) return '';
    const textEl = select.querySelector('.mat-select-value-text');
    if (textEl) return norm(textEl.textContent);

    const valueEl = select.querySelector('.mat-select-value');
    if (!valueEl) return '';
    if (valueEl.querySelector('.mat-select-placeholder')) return '';
    return norm(valueEl.textContent);
}

export function isAlreadyCorrect(widget: Element, entry: JustclassEntry | null): boolean {
    const select = getSelect(widget);
    if (!select || !entry || !entry.correctValues.length) return false;
    const selected = lower(selectedText(select));
    if (!selected) return false;
    return entry.correctValues.some(value => lower(value) === selected);
}

export function optionText(option: Element): string {
    const textEl = option.querySelector('.mat-option-text');
    return norm(textEl ? textEl.textContent : option.textContent);
}

export function similarity(a: string, b: string): number {
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

export function matchOption(options: Element[], values: string[]): Element | null {
    const wanted: string[] = values.map(value => lower(value)).filter(Boolean);
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

export async function selectWidget(widget: Element, entry: JustclassEntry): Promise<boolean> {
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

export async function applySelections(widgets: Element[], entries: Array<JustclassEntry | null>, triggerKey: string, userTriggered: boolean): Promise<boolean> {
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
