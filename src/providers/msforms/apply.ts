// src/providers/msforms/apply.ts
// Microsoft Forms answer application: Likert radio selection and ranking reorder.

export interface MsformsApplyApi {
    autoAnswerLikert(questionItem: HTMLElement, answerText: string): void;
    autoAnswerRanking(questionItem: HTMLElement, answerText: string): void;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    function norm(t: string): string { return t.toLowerCase().replace(/\s+/g, ' ').trim(); }

    // ── Custom auto-answer: Likert ──
    // AI answer format: "RowName1: ColumnName3; RowName2: ColumnName5"
    // Clicks the radio whose aria-label matches "RowName ColumnName"

    function autoAnswerLikert(questionItem: HTMLElement, answerText: string): void {
        const table = questionItem.querySelector('table');
        if (!table) return;

        // Parse answer: split by ";" then by ":" or "→" or "-"
        const pairs = answerText.split(';').map(s => s.trim()).filter(Boolean);
        const matched: HTMLInputElement[] = [];

        for (const pair of pairs) {
            const parts = pair.split(/[:→\-–—]/, 2).map(s => s.trim());
            if (parts.length < 2) continue;

            const rowName = parts[0];
            const colName = parts[1];

            // Find radio with aria-label containing both row and column text
            const radios = table.querySelectorAll<HTMLInputElement>('input[type="radio"]');
            for (const radio of radios) {
                const label = (radio.getAttribute('aria-label') || '').toLowerCase();
                const rn = rowName.toLowerCase().replace(/\s+/g, ' ').trim();
                const cn = colName.toLowerCase().replace(/\s+/g, ' ').trim();
                if (label.includes(rn) && label.includes(cn)) {
                    if (!radio.checked) {
                        radio.click();
                    }
                    matched.push(radio);
                    break;
                }
            }
        }

        // Highlight matched rows/cells
        for (const radio of matched) {
            const td = radio.closest('td');
            if (td) {
                td.style.setProperty('outline', '3px solid #22c55e', 'important');
                td.style.setProperty('background-color', 'rgba(34, 197, 94, 0.15)', 'important');
                td.style.setProperty('border-radius', '4px', 'important');
            }
        }
    }

    // ── Custom auto-answer: Ranking ──
    // AI answer: options listed in correct order (1st = best, last = worst)
    // Strategy: simulate mouse drag events to reorder options in the DOM

    function autoAnswerRanking(questionItem: HTMLElement, answerText: string): void {
        const listbox = questionItem.querySelector('[role="listbox"]');
        if (!listbox) return;

        // Parse desired order from answer
        const desiredOrder = answerText.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        if (desiredOrder.length === 0) return;

        // Get current option elements
        const currentOptions = Array.from(listbox.querySelectorAll('[role="option"]'));
        if (currentOptions.length === 0) return;

        // Build current order (text content of each option)
        const currentTexts = currentOptions.map(el => {
            const content = el.querySelector('[data-automation-id="rankingItemContent"] .text-format-content');
            return content ? (content as HTMLElement).innerText.trim() : (el as HTMLElement).innerText.trim();
        });

        // Map desired order texts to current option elements
        const desiredElements: Element[] = [];
        for (const desired of desiredOrder) {
            const nd = norm(desired);
            let bestEl: Element | null = null, bestScore = 0;
            for (const el of currentOptions) {
                const content = el.querySelector('[data-automation-id="rankingItemContent"] .text-format-content');
                const elText = content ? (content as HTMLElement).innerText.trim() : (el as HTMLElement).innerText.trim();
                const nt = norm(elText);
                if (nt === nd) { bestEl = el; bestScore = 1; break; }
                if (nt.includes(nd) || nd.includes(nt)) {
                    const score = Math.min(nt.length, nd.length) / Math.max(nt.length, nd.length);
                    if (score > bestScore) { bestScore = score; bestEl = el; }
                }
            }
            if (bestEl && bestScore > 0.4) desiredElements.push(bestEl);
        }

        // If we couldn't match enough, just highlight the answer text
        if (desiredElements.length < currentOptions.length) {
            // Fallback: show answer text as visual hint
            highlightRankingAnswer(questionItem, desiredOrder);
            return;
        }

        // Simulate mouse drags to reorder
        // Strategy: move each desired element to its correct position from top to bottom
        reorderRankingByDrag(questionItem, listbox, desiredElements, currentOptions);
    }

    function highlightRankingAnswer(questionItem: HTMLElement, desiredOrder: string[]): void {
        // Visual fallback: add numbered badges next to each matched option
        const options = questionItem.querySelectorAll('[role="option"]');

        for (let i = 0; i < desiredOrder.length; i++) {
            const nd = norm(desiredOrder[i]);
            for (const opt of options) {
                const content = opt.querySelector('[data-automation-id="rankingItemContent"] .text-format-content');
                const elText = content ? (content as HTMLElement).innerText.trim() : (opt as HTMLElement).innerText.trim();
                if (norm(elText) === nd) {
                    const badge = document.createElement('span');
                    badge.className = 'xd-ranking-badge';
                    badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#6366f1;color:white;font-size:12px;font-weight:700;margin-right:6px;flex-shrink:0;';
                    badge.textContent = String(i + 1);
                    (opt as HTMLElement).style.setProperty('outline', i === 0 ? '3px solid #22c55e' : '2px solid #6366f1', 'important');
                    (opt as HTMLElement).style.setProperty('border-radius', '4px', 'important');
                    opt.insertBefore(badge, opt.firstChild);
                    break;
                }
            }
        }
    }

    async function reorderRankingByDrag(questionItem: HTMLElement, listbox: Element, desiredElements: Element[], currentOptions: Element[]): Promise<void> {
        // Strategy: for each position from 0 to N-1, drag the desired element to that position
        // We simulate real mouse events at the correct screen coordinates

        for (let targetIdx = 0; targetIdx < desiredElements.length; targetIdx++) {
            const desiredEl = desiredElements[targetIdx];

            // Re-read current DOM order (it may have changed after previous drags)
            const liveOptions = Array.from(listbox.querySelectorAll('[role="option"]'));
            const currentIdx = liveOptions.indexOf(desiredEl);

            if (currentIdx === targetIdx) continue; // already in correct position
            if (currentIdx === -1) continue; // element no longer in DOM

            // Simulate drag: mousedown on source, mousemove to target position, mouseup
            const sourceRect = desiredEl.getBoundingClientRect();
            const targetEl = liveOptions[targetIdx];
            const targetRect = targetEl.getBoundingClientRect();

            // Drag from center of source to center of target
            const startX = sourceRect.left + sourceRect.width / 2;
            const startY = sourceRect.top + sourceRect.height / 2;
            const endX = targetRect.left + targetRect.width / 2;
            const endY = targetRect.top + targetRect.height / 2;

            // Dispatch mousedown
            desiredEl.dispatchEvent(new MouseEvent('mousedown', {
                bubbles: true, cancelable: true,
                clientX: startX, clientY: startY,
                screenX: startX, screenY: startY,
                button: 0
            }));

            // Dispatch mousemove in steps
            const steps = 10;
            for (let s = 1; s <= steps; s++) {
                const progress = s / steps;
                const mx = startX + (endX - startX) * progress;
                const my = startY + (endY - startY) * progress;
                document.dispatchEvent(new MouseEvent('mousemove', {
                    bubbles: true, cancelable: true,
                    clientX: mx, clientY: my,
                    screenX: mx, screenY: my,
                    button: 0
                }));
            }

            // Dispatch mouseup
            document.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true, cancelable: true,
                clientX: endX, clientY: endY,
                screenX: endX, screenY: endY,
                button: 0
            }));

            // Small delay between drags
            await new Promise(r => setTimeout(r, 150));
        }

        // After attempting drag, check if order actually changed
        // If not, fall back to visual badges
        const finalOptions = Array.from(listbox.querySelectorAll('[role="option"]'));
        const finalTexts = finalOptions.map(el => {
            const c = el.querySelector('[data-automation-id="rankingItemContent"] .text-format-content');
            return c ? (c as HTMLElement).innerText.trim() : (el as HTMLElement).innerText.trim();
        });
        const desiredTexts = desiredElements.map(el => {
            const c = el.querySelector('[data-automation-id="rankingItemContent"] .text-format-content');
            return c ? (c as HTMLElement).innerText.trim() : (el as HTMLElement).innerText.trim();
        });

        let orderChanged = false;
        for (let i = 0; i < Math.min(finalTexts.length, desiredTexts.length); i++) {
            if (norm(finalTexts[i]) === norm(desiredTexts[i])) { orderChanged = true; break; }
        }

        if (!orderChanged) {
            // Drag didn't work - use visual fallback
            // Remove any badges we might have added
            listbox.querySelectorAll('.xd-ranking-badge').forEach(b => b.remove());
            highlightRankingAnswer((questionItem.closest('[data-automation-id="questionItem"]') || listbox) as HTMLElement, desiredTexts);
        } else {
            // Success - highlight the #1 option
            if (finalOptions.length > 0) {
                (finalOptions[0] as HTMLElement).style.setProperty('outline', '3px solid #22c55e', 'important');
                (finalOptions[0] as HTMLElement).style.setProperty('border-radius', '4px', 'important');
            }
        }
    }

    window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {};
    window.xdAnswers._internal.providerModules.msforms = window.xdAnswers._internal.providerModules.msforms || {};
    window.xdAnswers._internal.providerModules.msforms.apply = {
        autoAnswerLikert,
        autoAnswerRanking
    } as MsformsApplyApi;
})();
