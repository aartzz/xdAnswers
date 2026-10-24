// src/providers/vseosvita/dom/text.ts
// vseosvita text helpers: whitespace normalisation, rendered text reads and math extraction.

// Format normalisation: vseosvita uses a mix of non-breaking spaces and odd whitespace.
export function normalize(text: unknown): string {
    return String(text || '').replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getText(el: Element | null | undefined): string {
    return ((el as HTMLElement | null)?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
}

// Extract mathematical content from elements (MathML, KaTeX, LaTeX).
export function extractMathContent(el: Element | null): string {
    if (!el) return '';
    let mathText = '';
    // MathML
    el.querySelectorAll('math, .mathml').forEach(m => {
        mathText += ' ' + (m.textContent || '').trim();
    });
    // KaTeX
    el.querySelectorAll('.katex, .katex-display, .katex-mathml').forEach(k => {
        mathText += ' ' + (k.textContent || '').trim();
    });
    // data-math attribute
    el.querySelectorAll('[data-math]').forEach(dm => {
        mathText += ' ' + (dm.getAttribute('data-math') || '').trim();
    });
    // Inline LaTeX $...$
    const text = el.textContent || '';
    const latexMatches = text.match(/\$[^$]+\$/g);
    if (latexMatches) {
        mathText += ' ' + latexMatches.join(' ');
    }
    return mathText.trim();
}
