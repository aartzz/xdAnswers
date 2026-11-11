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
        || widgets[0].closest('justkids-text-input')
        || widgets[0].closest('justkids-text-dnd')
        || widgets[0].closest('justkids-image-set-input')
        || widgets[0].closest('justkids-image-set-select')
        || widgets[0].closest('justkids-image-set-dnd')
        || widgets[0].closest('justkids-dnd-image')
        || widgets[0].closest('justkids-training-preview')
        || widgets[0].closest('.preview-content')
        || widgets[0].parentElement;
}

export function questionStem(widgets: Element[]): string {
    const root = questionRoot(widgets);
    if (!root) return '';
    const clone = root.cloneNode(true) as Element;
    clone.querySelectorAll([
        'justkids-select',
        'justkids-input',
        'justkids-dnd-text-answer-drop',
        'justkids-image-set-input',
        'justkids-image-set-select',
        'justkids-image-set-dnd',
        'justkids-dnd-image',
        '.answer__content'
    ].join(', ')).forEach(el => el.remove());

    return norm((clone as HTMLElement).innerText || clone.textContent);
}

export async function collectQuestionImages(widgets: Element[]): Promise<string[]> {
    const root = questionRoot(widgets);
    if (!root || !window.xdAnswers.imageToBase64) return [];

    const urls: string[] = [];
    root.querySelectorAll('img').forEach(img => {
        if (!img.src || img.src.startsWith('data:image/gif')) return;
        if (img.closest('justkids-select, justkids-input, mat-select, mat-option')) return;
        if ((img.width || img.naturalWidth || 0) < 30) return;
        if (!urls.includes(img.src)) urls.push(img.src);
    });

    const images = await Promise.all(urls.map(url =>
        Promise.resolve(window.xdAnswers.imageToBase64(url)).catch(() => null)
    ));
    return images.filter(Boolean) as string[];
}

function dndDragItems(widget: Element): string[] {
    const root = widget.closest('justkids-text-dnd, justkids-image-set-dnd, justkids-dnd-image');
    if (!root) return [];
    const items = root.querySelectorAll([
        '.answers justkids-dnd-answer-drag',
        '.dnd-answers justkids-dnd-answer-drag',
        '.answers justkids-image-set-dnd-answer-drag',
        '.dnd-answers justkids-image-set-dnd-answer-drag',
        '.dnd-answers justkids-dnd-image-answer-drag',
        'justkids-dnd-answer-drag',
        'justkids-image-set-dnd-answer-drag',
        'justkids-dnd-image-answer-drag'
    ].join(', '));
    return Array.from(items).map(item => norm(item.textContent)).filter(Boolean);
}

export async function readWidgetOptions(widget: Element): Promise<string[]> {
    // 1. Drag and drop widget: choices live in the drag source row.
    if (widget.matches('justkids-dnd-text-answer-drop, justkids-image-set-dnd-answer-drop, justkids-dnd-image-answer-drop')) {
        return dndDragItems(widget);
    }

    // 2. Text input / image-set input: the answer is typed, not chosen.
    if (widget.matches('justkids-input') || widget.querySelector('input')) {
        return [];
    }

    // 3. mat-select driving
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
