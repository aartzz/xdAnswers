// src/providers/classtime/dom.ts
// Classtime DOM layer: question/option extraction plus categorization and DND applying.

export interface ClasstimeQuestionState {
    text: string;
    options: string[];
    categories: string[];
    items: string[];
    questionType: 'choice' | 'text' | 'categorization' | 'dragdrop';
    isCategorization: boolean;
    isDND: boolean;
    imageContainer: HTMLElement;
    oneclickContainer: HTMLElement | null;
}

export interface ClasstimeDomApi {
    readQuestion(): ClasstimeQuestionState | null;
    loadImages(container: HTMLElement): Promise<string[]>;
    applyCategorization(answerText: string): void;
    applyDndDrag(): void;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

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

    function applyCategorization(answerText: string): void {
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

    function applyDndDrag(): void {
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

    function readQuestion(): ClasstimeQuestionState | null {
        const isCategorization = !!document.querySelector('[data-testid="student-categorizer-answers-form"]');
        const isDND = !!document.querySelector('[data-testid="draggable-item"], [draggable="true"]');

        const questionSelectors = ['[data-p3-hint]', '.question-text', '[data-testid="question-text"]', 'h1', 'h2', '.task-title'];
        let questionEl: HTMLElement | null = null;
        for (let i = 0; i < questionSelectors.length; i++) {
            questionEl = document.querySelector<HTMLElement>(questionSelectors[i]);
            if (questionEl) break;
        }
        if (!questionEl) return null;

        const questionText = questionEl.innerText.trim();
        if (!questionText) return null;

        const optionEls = document.querySelectorAll<HTMLElement>('[data-testid="choice-wrapper"], .answer-option, [data-testid="answer-option"], .choice');
        const options = Array.from(optionEls).map(function(el) { return el.innerText.trim(); }).filter(Boolean);

        let categories: string[] = [];
        let items: string[] = [];
        if (isCategorization) {
            const catEls = document.querySelectorAll<HTMLElement>('[data-testid="category-header"], .category-title');
            categories = Array.from(catEls).map(function(el) { return el.innerText.trim(); }).filter(Boolean);
            const itemEls = document.querySelectorAll<HTMLElement>('[data-testid="categorizer-item"], .categorizer-item, [data-testid="draggable-item"]');
            items = Array.from(itemEls).map(function(el) { return el.innerText.trim(); }).filter(Boolean);
        }

        const imageContainer = (questionEl.closest('[data-testid="question"], .question, [class*="question"]') as HTMLElement | null) || document.body;
        const oneclickContainer = (questionEl.closest('[data-testid="question-container"], .question') as HTMLElement | null) || questionEl.parentElement;

        let questionType: ClasstimeQuestionState['questionType'] = 'choice';
        if (isCategorization) questionType = 'categorization';
        else if (isDND) questionType = 'dragdrop';
        else if (options.length === 0) questionType = 'text';

        return {
            text: questionText,
            options: options,
            categories: categories,
            items: items,
            questionType: questionType,
            isCategorization: isCategorization,
            isDND: isDND,
            imageContainer: imageContainer,
            oneclickContainer: oneclickContainer
        };
    }

    function loadImages(container: HTMLElement): Promise<string[]> {
        const imgPromises: Array<Promise<string | null>> = [];
        container.querySelectorAll<HTMLImageElement>('img').forEach(function(img) {
            imgPromises.push(window.xdAnswers.imageToBase64(img.src));
        });
        return Promise.all(imgPromises).then(function(images) {
            return images.filter(function(img): img is string { return img !== null; });
        });
    }

    const api: ClasstimeDomApi = {
        readQuestion: readQuestion,
        loadImages: loadImages,
        applyCategorization: applyCategorization,
        applyDndDrag: applyDndDrag
    };

    window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {};
    window.xdAnswers._internal.providerModules.classtime = window.xdAnswers._internal.providerModules.classtime || {};
    window.xdAnswers._internal.providerModules.classtime.dom = api;
})();
