// src/dom/match/text.ts
// Text normalization and similarity scoring for option matching.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function normalizeText(t: string | null | undefined): string {
        return (t || '').replace(/\s+/g, ' ').trim().toLowerCase()
            .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2060]/g, '')  // zero-width / nbsp
            .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(ch)))
            .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(ch)))
            .replace(/(\d),(\d)/g, '$1.$2')                    // decimal comma → dot (1,5 → 1.5)
            .replace(/(\d)\.(\d)/g, '$1_DOT_$2')               // protect decimal dots temporarily
            .replace(/[.,;:!?()\-–—]/g, '')                     // strip remaining punctuation
            .replace(/_DOT_/g, '.')                              // restore decimal dots
            .trim();
    }

    // Ukrainian text copied by a model often mixes Latin lookalikes into
    // Cyrillic words ("синiй колip"). Fold both scripts to one skeleton for
    // matching only; English text is folded consistently too.
    function normalizeConfusables(t: string | null | undefined): string {
        const map: Record<string, string> = {
            a: 'а', c: 'с', e: 'е', h: 'н', i: 'і', k: 'к', m: 'м',
            o: 'о', p: 'р', t: 'т', x: 'х', y: 'у',
            A: 'А', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М',
            O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У'
        };
        return (t || '').replace(/[A-Za-z]/g, ch => map[ch] || ch);
    }

    function levenshtein(a: string, b: string): number {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = b[i - 1] === a[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        return matrix[b.length][a.length];
    }

    function textSimilarity(a: string, b: string): number {
        if (!a || !b) return 0;
        if (a === b) return 1;
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        // Exact substring match
        if (a.includes(b) || b.includes(a)) {
            return Math.min(a.length, b.length) / maxLen;
        }
        // Levenshtein-based similarity
        const dist = levenshtein(a, b);
        return 1 - dist / maxLen;
    }

    I.normalizeText = normalizeText;
    I.normalizeConfusables = normalizeConfusables;
    I.levenshtein = levenshtein;
    I.textSimilarity = textSimilarity;
})();
