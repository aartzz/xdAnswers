// src/providers/classtime/dom/apply.ts
// Classtime answer applying: categorization mapping and DND drag simulation.

function simulateDragDrop(sourceEl: Element, targetEl: Element): void {
    if (!sourceEl || !targetEl) return;
    const sr = sourceEl.getBoundingClientRect();
    const tr = targetEl.getBoundingClientRect();
    const sx = sr.left + sr.width / 2;
    const sy = sr.top + sr.height / 2;
    const tx = tr.left + tr.width / 2;
    const ty = tr.top + tr.height / 2;

    sourceEl.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true, clientX: sx, clientY: sy, button: 0
    }));

    for (let s = 1; s <= 10; s++) {
        const p = s / 10;
        document.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true, cancelable: true,
            clientX: sx + (tx - sx) * p,
            clientY: sy + (ty - sy) * p,
            button: 0
        }));
    }

    document.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true, cancelable: true, clientX: tx, clientY: ty, button: 0
    }));
}

function norm(s: string | null | undefined): string {
    return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findElementByText(selector: string, text: string): Element | null {
    const els = document.querySelectorAll(selector);
    const nt = norm(text);
    let best: Element | null = null;
    let bestScore = 0;
    for (let i = 0; i < els.length; i++) {
        const el = els[i];
        const et = norm((el as HTMLElement).innerText || el.textContent);
        if (et === nt) return el;
        if (et.includes(nt) || nt.includes(et)) {
            const score = Math.min(et.length, nt.length) / Math.max(et.length, nt.length);
            if (score > bestScore) { bestScore = score; best = el; }
        }
    }
    return best;
}

export function applyCategorization(answerText: string): void {
    // Parse answer: "Category A: item1, item2; Category B: item3"
    const mappings: Array<{ category: string; item: string }> = [];
    const blocks = answerText.split(/;\s*\n?/).filter(Boolean);

    for (let b = 0; b < blocks.length; b++) {
        const block = blocks[b].trim();
        const colonIdx = block.indexOf(':');
        if (colonIdx < 0) continue;
        const catName = block.substring(0, colonIdx).trim().replace(/^Категорія\s*/i, '');
        const itemsPart = block.substring(colonIdx + 1).trim();
        const itemNames = itemsPart.split(/,\s*/).map(function(s) { return s.trim(); }).filter(Boolean);

        for (let n = 0; n < itemNames.length; n++) {
            mappings.push({ category: catName, item: itemNames[n] });
        }
    }

    // Fallback: try "N→category" format if no colons found
    if (mappings.length === 0) {
        const lines = answerText.split(/[\n;]/).filter(Boolean);
        for (let l = 0; l < lines.length; l++) {
            const parts = lines[l].trim().split(/→|->/);
            if (parts.length >= 2) {
                mappings.push({ category: parts[1].trim(), item: parts[0].trim() });
            }
        }
    }

    for (let m = 0; m < mappings.length; m++) {
        const map = mappings[m];

        // 1. Check for modern Classtime categorizer grid: rows with cells matching category column
        const rows = document.querySelectorAll('tr[data-testid="question-answer-row"]');
        let gridClicked = false;
        if (rows.length > 0) {
            const headerCells = Array.from(document.querySelectorAll('[data-testid="category-header-cell"] [data-text="true"], [data-testid="category-header"]'));
            const catIndex = headerCells.findIndex(h => norm(h.textContent).includes(norm(map.category)) || norm(map.category).includes(norm(h.textContent)));
            if (catIndex >= 0) {
                for (const row of Array.from(rows)) {
                    const rowText = norm(row.querySelector('th [data-text="true"], th')?.textContent);
                    if (rowText && (rowText.includes(norm(map.item)) || norm(map.item).includes(rowText))) {
                        const cells = row.querySelectorAll('[data-testid="question-answer-cell"], td');
                        const targetCell = cells[catIndex] || cells[catIndex + 1]; // +1 if th is index 0
                        if (targetCell) {
                            const btn = targetCell.querySelector('button, input, [role="radio"], [role="checkbox"]') || targetCell;
                            (btn as HTMLElement).click();
                            gridClicked = true;
                        }
                    }
                }
            }
        }

        if (gridClicked) continue;

        // 2. Fallback to Drag and drop
        const sourceEl = findElementByText(
            '[data-testid="categorizer-item"], .categorizer-item, [data-testid="draggable-item"]',
            map.item
        );
        const targetEl = findElementByText(
            '[data-testid="category-header"], .category-title, [data-testid="category-drop"]',
            map.category
        );

        if (sourceEl && targetEl) {
            simulateDragDrop(sourceEl, targetEl);
            (sourceEl as HTMLElement).style.setProperty('outline', '2px solid #22c55e', 'important');
            (sourceEl as HTMLElement).style.setProperty('border-radius', '4px', 'important');
        }
    }
}

export function applyDndDrag(): void {
    const items = document.querySelectorAll<HTMLElement>('[data-testid="draggable-item"], [draggable="true"]');
    const targets = document.querySelectorAll<HTMLElement>('[data-testid="drop-zone"], .drop-zone, [class*="drop-target"]');
    if (items.length > 0 && targets.length > 0) {
        for (let k = 0; k < Math.min(items.length, targets.length); k++) {
            simulateDragDrop(items[k], targets[k]);
            items[k].style.setProperty('outline', '2px solid #22c55e', 'important');
            items[k].style.setProperty('border-radius', '4px', 'important');
        }
    }
}
