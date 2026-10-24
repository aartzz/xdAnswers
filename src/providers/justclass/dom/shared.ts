// src/providers/justclass/dom/shared.ts
// JustClass shared DOM helpers: text normalization, widget discovery and question keys.

export const PANEL_SELECTOR = '.mat-select-panel';
export const PANEL_WAIT_MS = 1400;
export const OPTION_WAIT_MS = 1000;

export function norm(s: unknown): string {
    return String(s == null ? '' : s)
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function lower(s: unknown): string {
    return norm(s).toLocaleLowerCase('uk');
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function isVisible(el: Element | null): boolean {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return el.getClientRects().length > 0;
}

export function getHash(): string | null {
    const m = location.pathname.match(/\/hw\/([^/?#]+)/);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
}

export function getQuestionNumber(): number {
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

export function getWidgets(): Element[] {
    const selectors = [
        'justkids-select-dynamic',
        'justkids-text-dnd',
        'justkids-input-dynamic',
        'justkids-image-set-input',
        '.answer__content'
    ];
    return Array.from(document.querySelectorAll(selectors.join(', ')))
        .filter(isVisible);
}

export function getWidgetType(widget: Element): 'select' | 'dnd' | 'input' | 'unscramble' | 'choice' {
    if (widget.matches('justkids-select-dynamic') || widget.querySelector('mat-select')) return 'select';
    if (widget.matches('justkids-text-dnd') || widget.querySelector('justkids-dnd-text-answer-drop-dynamic')) return 'dnd';
    if (widget.matches('justkids-input-dynamic') || widget.querySelector('input')) return 'input';
    if (widget.matches('justkids-image-set-input') || widget.querySelector('.image-set-item')) return 'unscramble';
    return 'choice';
}

export function getSelect(widget: Element | null): Element | null {
    return widget ? widget.querySelector('mat-select') : null;
}

export function getQuestionKey(widgets: Element[]): string {
    const ids = widgets.map(w => w.id || '').join(',');
    return (getHash() || '') + '|' + getQuestionNumber() + '|' + ids;
}

export function sameWidgets(a: Element[], b: Element[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

export function rowLabel(widget: Element): string {
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
