// src/providers/miyklas/dom/dnd.ts
// Miyklas answer applying: parses field/option mappings and simulates DND placement.
import { getLastFields } from './question';

function simulateDragDrop(sourceEl: Element, targetEl: Element): void {
    if (!sourceEl || !targetEl) return;

    const sourceRect = sourceEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    sourceEl.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true,
        clientX: startX, clientY: startY, button: 0
    }));

    const steps = 10;
    for (let s = 1; s <= steps; s++) {
        const progress = s / steps;
        document.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true, cancelable: true,
            clientX: startX + (endX - startX) * progress,
            clientY: startY + (endY - startY) * progress,
            button: 0
        }));
    }

    document.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true, cancelable: true,
        clientX: endX, clientY: endY, button: 0
    }));
}

export function applyDndAnswer(answerText: string): void {
    // Parse answer: format is "DND_FIELD_1: OPTION_3" or "1: 3" or "1=3"
    // AI may also answer in Ukrainian: "Поле 1: Варіант 3"
    const mappings: Array<{ fieldIdx: number; optionIdx: number }> = [];

    // Try keyed format: "DND_FIELD_N: OPTION_M" or "N: M" or "N = M" or "N:M"
    const pairs = answerText.split(/[;\n]/).map(function(s) { return s.trim(); }).filter(Boolean);
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        let m = pair.match(/(?:DND_FIELD_)?(\d+)\s*[:=→\-–—]\s*(?:OPTION_)?(\d+)/i);
        if (m) {
            mappings.push({ fieldIdx: parseInt(m[1], 10), optionIdx: parseInt(m[2], 10) });
            continue;
        }
        // Try Ukrainian: "Поле 1: Варіант 3"
        m = pair.match(/Поле\s*(\d+).*?[Вв]аріант\s*(\d+)/i);
        if (m) {
            mappings.push({ fieldIdx: parseInt(m[1], 10), optionIdx: parseInt(m[2], 10) });
            continue;
        }
    }

    // If no structured mappings parsed, try position-based: answer lists options in field order
    const lastFields = getLastFields();
    if (mappings.length === 0 && lastFields.length > 0) {
        const items = answerText.split(/[;\n]/).map(function(s) { return s.trim(); }).filter(Boolean);
        if (items.length === lastFields.length) {
            for (let j = 0; j < items.length; j++) {
                const num = parseInt(items[j], 10);
                if (!isNaN(num)) {
                    mappings.push({ fieldIdx: j + 1, optionIdx: num });
                }
            }
        }
    }

    // Apply mappings to DOM
    for (let k = 0; k < mappings.length; k++) {
        const map = mappings[k];
        const fieldEl = document.getElementById('DND_FIELD_' + map.fieldIdx);
        const optionEl = document.getElementById('OPTION_' + map.optionIdx);

        if (fieldEl && optionEl) {
            // Strategy 1: Click option first, then click field (some DND UIs accept click-to-place)
            optionEl.click();
            optionEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            optionEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

            // Small delay between click and drag attempt
            // Strategy 2: Simulate drag-and-drop
            simulateDragDrop(optionEl, fieldEl);

            // Strategy 3: Direct click on field after option is selected
            setTimeout(function(fEl: HTMLElement) {
                fEl.click();
                fEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                fEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            }, 100, fieldEl);

            // Highlight filled field
            fieldEl.style.setProperty('outline', '2px solid #22c55e', 'important');
            fieldEl.style.setProperty('border-radius', '4px', 'important');
        }
    }
}
