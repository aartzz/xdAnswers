// src/providers/justclass/dom/question.ts
// JustClass question extraction: stem, images and widget option text.
import { PANEL_WAIT_MS, OPTION_WAIT_MS, getSelect, norm } from './shared';
import { closePanels, getVisiblePanel, isDisabled, optionText, panelForSelect, waitFor } from './select';

// ---------------------------------------------------------------------
// Question extraction
// ---------------------------------------------------------------------

export function questionRoot(widgets: Element[]): Element | null {
    if (!widgets.length) return null;
    return widgets[0].closest('justkids-text-select')
        || widgets[0].closest('.preview-content')
        || widgets[0].closest('justkids-training-preview')
        || widgets[0].parentElement;
}

export function questionStem(widgets: Element[]): string {
    const root = questionRoot(widgets);
    if (!root) return '';
    const clone = root.cloneNode(true) as Element;
    clone.querySelectorAll('justkids-select-dynamic').forEach(el => el.remove());
    return norm((clone as HTMLElement).innerText || clone.textContent);
}

export async function collectQuestionImages(widgets: Element[]): Promise<string[]> {
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

export async function readWidgetOptions(widget: Element): Promise<string[]> {
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
