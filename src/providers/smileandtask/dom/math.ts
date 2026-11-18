// src/providers/smileandtask/dom/math.ts
// Extracts readable text and LaTeX from MathRichText / MathInline DOM nodes
// and from serialized formula documents stored in sessionStorage.

import { cleanText } from './util';

const FX_STRUCTURES = ['fx-frac', 'fx-pow', 'fx-sub', 'fx-root', 'fx-func', 'fx-sys', 'fx-matrix', 'fx-int'];

function child(el: Element, selector: string): Element | null {
    return el.querySelector(`:scope > ${selector}`);
}

function wrapped(text: string): string {
    return /^[\w.]+$/u.test(text) ? text : `(${text})`;
}

function storedRunsText(runs: unknown): string {
    if (!Array.isArray(runs)) return '';
    return runs.map(run => {
        if (!run || typeof run !== 'object') return '';
        const item = run as { t?: string; s?: string; d?: boolean; fx?: unknown };
        if (item.t === 'text') return typeof item.s === 'string' ? item.s : '';
        if (item.t === 'kx') {
            const src = typeof item.s === 'string' ? item.s : '';
            return item.d ? `$$${src}$$` : `$${src}$`;
        }
        if (item.t === 'fx') return storedFxText(item.fx);
        return '';
    }).join('');
}

function storedFxText(fx: unknown): string {
    if (!fx || typeof fx !== 'object') return '';
    const node = fx as Record<string, unknown>;
    const op = node.op;
    const part = (key: string): string => storedRunsText(node[key]).trim();
    switch (op) {
        case 'expr': return part('runs');
        case 'frac': return `${wrapped(part('num'))}/${wrapped(part('den'))}`;
        case 'pow': return `${wrapped(part('base'))}^${wrapped(part('exp'))}`;
        case 'sub': return `${wrapped(part('base'))}_${wrapped(part('sub'))}`;
        case 'root': {
            const idx = part('index');
            const rad = part('rad');
            return idx ? `root(${idx}, ${rad})` : `√(${rad})`;
        }
        case 'func': {
            const name = typeof node.name === 'string' ? node.name : '';
            const base = part('base');
            return `${name}${base ? `_${wrapped(base)}` : ''}(${part('arg')})`;
        }
        case 'sys': {
            const rows = Array.isArray(node.rows) ? node.rows.map(row => storedRunsText(row).trim()) : [];
            return `{ ${rows.join('; ')} }`;
        }
        case 'matrix': {
            const cells = Array.isArray(node.cells)
                ? node.cells.map(row => `[${(Array.isArray(row) ? row : []).map(cell => storedRunsText(cell).trim()).join(', ')}]`)
                : [];
            return `[${cells.join(', ')}]`;
        }
        case 'int':
        case 'sum': {
            const glyph = op === 'int' ? '∫' : '∑';
            const lower = part('lower');
            const upper = part('upper');
            const limits = `${lower ? `_${wrapped(lower)}` : ''}${upper ? `^${wrapped(upper)}` : ''}`;
            return `${glyph}${limits} ${part('body')}`.trim();
        }
        default:
            return '';
    }
}

export function storedText(raw: string | null | undefined): string {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (value.startsWith('{')) {
        try {
            const doc = JSON.parse(value) as { v?: number; blocks?: Array<{ t?: string; runs?: unknown; fx?: unknown }> };
            if (doc && doc.v === 1 && Array.isArray(doc.blocks)) {
                return cleanText(doc.blocks.map(block => {
                    if (block.t === 'p') return storedRunsText(block.runs);
                    if (block.t === 'fx') return storedFxText(block.fx);
                    return '';
                }).join('\n'));
            }
        } catch (e) { /* plain string starting with { */ }
    }
    return cleanText(value);
}

function fxText(el: Element): string {
    const part = (selector: string): string => {
        const node = child(el, selector);
        return node ? inlineText(node).trim() : '';
    };
    const cls = (name: string): boolean => el.classList.contains(name);

    if (cls('fx-frac')) {
        return `${wrapped(part('.fx-frac-top'))}/${wrapped(part('.fx-frac-bot'))}`;
    }
    if (cls('fx-pow')) {
        return `${wrapped(part('.fx-pow-base'))}^${wrapped(part('sup'))}`;
    }
    if (cls('fx-sub')) {
        return `${wrapped(part('.fx-sub-base'))}_${wrapped(part('sub'))}`;
    }
    if (cls('fx-root')) {
        const index = part('.fx-root-idx');
        const radicand = el.querySelector('.fx-root-rad');
        const body = radicand ? inlineText(radicand).trim() : '';
        return index ? `root(${index}, ${body})` : `√(${body})`;
    }
    if (cls('fx-func')) {
        const name = part('.fx-func-name');
        const base = part('sub');
        const arg = el.querySelector('.fx-func-arg');
        const argText = arg ? inlineText(arg).trim() : '';
        return `${name}${base ? `_${wrapped(base)}` : ''}(${argText})`;
    }
    if (cls('fx-sys')) {
        const rows = Array.from(el.querySelectorAll('.fx-sys-row')).map(row => inlineText(row).trim());
        return `{ ${rows.join('; ')} }`;
    }
    if (cls('fx-matrix')) {
        const rows = Array.from(el.querySelectorAll('.fx-matrix-row')).map(row => {
            const cells = Array.from(row.querySelectorAll('.fx-matrix-cell')).map(cell => inlineText(cell).trim());
            return `[${cells.join(', ')}]`;
        });
        return `[${rows.join(', ')}]`;
    }
    if (cls('fx-int')) {
        const glyph = el.querySelector('.fx-stack-glyph')?.textContent?.trim() || '∫';
        const upper = el.querySelector('.fx-stack-top');
        const lower = el.querySelector('.fx-stack-bot');
        const body = el.querySelector('.fx-int-body');
        const limits = `${lower ? `_${wrapped(inlineText(lower).trim())}` : ''}${upper ? `^${wrapped(inlineText(upper).trim())}` : ''}`;
        return `${glyph}${limits} ${body ? inlineText(body).trim() : ''}`.trim();
    }
    return inlineText(el);
}

function inlineText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || tag === 'svg') return '';
    if (tag === 'BR') return '\n';
    if (el.classList.contains('fx-del')) return '';

    if (el.classList.contains('fx-kx')) {
        const source = el.getAttribute('data-kx') || '';
        if (source) return el.classList.contains('fx-kx-display') ? `$$${source}$$` : `$${source}$`;
        return el.querySelector('.katex-html')?.textContent || '';
    }
    if (el.classList.contains('fx-inline')) {
        return el.firstElementChild ? inlineText(el.firstElementChild) : cleanText(el.textContent);
    }
    if (el.classList.contains('fx-expr')) {
        const box = child(el, '.fx-expr-box');
        return box ? inlineText(box) : '';
    }
    if (FX_STRUCTURES.some(name => el.classList.contains(name))) return fxText(el);

    let result = '';
    el.childNodes.forEach(item => { result += inlineText(item); });
    return result;
}

/** Text of a MathRichText block (paragraphs and display formulas on separate lines). */
export function richText(el: Element | null): string {
    if (!el) return '';
    const blocks = Array.from(el.children).filter(item =>
        item.tagName === 'P' || item.classList.contains('fx-node'));
    if (!blocks.length) return cleanText(inlineText(el));
    return cleanText(blocks.map(block => inlineText(block)).join('\n'));
}

/** Text of a MathInline span (option / matching / ordering cell). */
export function inlineValue(scope: Element | null): string {
    if (!scope) return '';
    const span = scope.querySelector('span.whitespace-pre-wrap');
    return span ? cleanText(inlineText(span)) : '';
}
