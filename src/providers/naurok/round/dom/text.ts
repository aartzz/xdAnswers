// src/providers/naurok/round/dom/text.ts
// НаУрок round text helpers: normalisation, KaTeX/rich text rendering and item keys.

export const LETTERS = 'ABCDEFGHIJ';

export function norm(s: unknown): string {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

export function cleanRef(text: unknown): string {
    return norm(String(text || '').replace(/[*_`]/g, '').replace(/^["'«„“]+|["'»“”]+$/g, ''));
}

export function toAbsolute(src: string): string {
    try { return new URL(src, window.location.href).href; } catch (e) { return src; }
}

export function annotationOf(el: Element | null): Element | null {
    return el && el.querySelector ? el.querySelector('annotation[encoding="application/x-tex"]') : null;
}

export function katexText(el: Element): string {
    const tex = annotationOf(el);
    return tex ? '$' + norm(tex.textContent) + '$' : '';
}

export function optionText(el: Element): string {
    const k = katexText(el);
    // Mixed content like "$Cu(OH)_2$ та SO_2": keep both the TeX parts and the
    // plain text around them (textContent would duplicate KaTeX internals).
    if (k || (el.classList && el.classList.contains('katex'))) {
        return richText(el, { images: [], inputs: [] });
    }
    return norm(el.textContent);
}

export interface RichTextContext {
    images: string[];
    inputs: HTMLInputElement[];
}

// Renders a subtree into plain text: KaTeX becomes $tex$, images become [зображення],
// inputs become [A0]/[A1]/... (registered in ctx.inputs in DOM order).
export function richText(root: Node, ctx: RichTextContext): string {
    const parts: string[] = [];
    const visit = (node: Node): void => {
        if (node.nodeType === 3) {
            const t = norm(node.nodeValue);
            if (t) parts.push(t);
            return;
        }
        if (node.nodeType !== 1) return;
        const el = node as Element;
        const tag = el.tagName;
        if (tag === 'SELECT' || tag === 'BUTTON') return;
        if (tag === 'KATEX' || (el.classList && el.classList.contains('katex') && annotationOf(el))) {
            parts.push(katexText(el));
            return;
        }
        if (tag === 'IMG') {
            const src = el.getAttribute('src') || el.getAttribute('ng-src') || '';
            const real = src.replace(/\{\{[^}]*\}\}/g, '');
            if (real && !real.startsWith('data:') && ctx) ctx.images.push(toAbsolute(real));
            parts.push('[зображення]');
            return;
        }
        if (tag === 'INPUT') {
            if (ctx) {
                ctx.inputs.push(el as HTMLInputElement);
                parts.push('[A' + (ctx.inputs.length - 1) + ']');
            }
            return;
        }
        for (const child of Array.from(el.childNodes)) visit(child);
    };
    visit(root);
    return parts.join(' ');
}

export function itemKey(el: Element): string {
    const tex = annotationOf(el);
    return tex ? norm(tex.textContent) : norm(el.textContent);
}
