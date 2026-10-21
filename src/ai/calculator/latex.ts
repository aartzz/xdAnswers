// src/ai/calculator/latex.ts
// LaTeX to plain math notation conversion (fractions, roots, binomials).
(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function parseGroup(str: string, start: number, openChar: string, closeChar: string): { content: string; endIndex: number } | null {
        if (str[start] !== openChar) return null;
        let depth = 0;
        for (let i = start; i < str.length; i++) {
            if (str[i] === openChar) depth++;
            else if (str[i] === closeChar) {
                depth--;
                if (depth === 0) return { content: str.slice(start + 1, i), endIndex: i };
            }
        }
        return null;
    }

    function latexToMath(latex: string): string {
        if (!latex || typeof latex !== 'string') return '';
        let s = latex.trim();
        s = s.replace(/^\$+|\$+$/g, '').trim();

        // Balanced braces replacement for \frac and \dfrac
        function replaceFracs(str: string): string {
            let regex = /\\d?frac\s*\{/g;
            let match;
            while ((match = regex.exec(str)) !== null) {
                const startIdx = match.index;
                const numOpen = str.indexOf('{', startIdx);
                const num = parseGroup(str, numOpen, '{', '}');
                if (!num) break;
                const denOpen = str.indexOf('{', num.endIndex + 1);
                if (denOpen === -1 || str.slice(num.endIndex + 1, denOpen).trim() !== '') break;
                const den = parseGroup(str, denOpen, '{', '}');
                if (!den) break;
                const rep = '((' + replaceFracs(num.content) + ') / (' + replaceFracs(den.content) + '))';
                str = str.slice(0, startIdx) + rep + str.slice(den.endIndex + 1);
                regex.lastIndex = startIdx + rep.length;
            }
            return str;
        }
        s = replaceFracs(s);

        // \binom{n}{k}
        function replaceBinoms(str: string): string {
            let regex = /\\binom\s*\{/g;
            let match;
            while ((match = regex.exec(str)) !== null) {
                const startIdx = match.index;
                const nOpen = str.indexOf('{', startIdx);
                const nGrp = parseGroup(str, nOpen, '{', '}');
                if (!nGrp) break;
                const kOpen = str.indexOf('{', nGrp.endIndex + 1);
                if (kOpen === -1) break;
                const kGrp = parseGroup(str, kOpen, '{', '}');
                if (!kGrp) break;
                const rep = 'comb(' + nGrp.content + ', ' + kGrp.content + ')';
                str = str.slice(0, startIdx) + rep + str.slice(kGrp.endIndex + 1);
                regex.lastIndex = startIdx + rep.length;
            }
            return str;
        }
        s = replaceBinoms(s);

        // \log_{base}{x} or \log_{base}(x)
        s = s.replace(/\\log_\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(ln($2)/ln($1))');
        s = s.replace(/\\log_\{([^{}]+)\}\s*\(([^()]+)\)/g, '(ln($2)/ln($1))');
        s = s.replace(/\\log_([0-9a-zA-Z]+)\s*\(([^()]+)\)/g, '(ln($2)/ln($1))');

        // \sqrt[n]{x}
        s = s.replace(/\\sqrt\s*\[(.*?)\]\s*\{(.*?)\}/g, 'pow(($2), 1/($1))');

        // \sqrt{x} with balanced braces
        let sqrtRegex = /\\sqrt\s*\{/g;
        let sMatch: RegExpExecArray | null;
        while ((sMatch = sqrtRegex.exec(s)) !== null) {
            const open = s.indexOf('{', sMatch.index);
            const grp = parseGroup(s, open, '{', '}');
            if (grp) {
                const rep = 'sqrt(' + grp.content + ')';
                s = s.slice(0, sMatch.index) + rep + s.slice(grp.endIndex + 1);
                sqrtRegex.lastIndex = sMatch.index + rep.length;
            } else break;
        }

        // Common symbols
        s = s.replace(/\\times|\\cdot/g, ' * ');
        s = s.replace(/\\div|\\colon/g, ' / ');
        s = s.replace(/\\pi\b/g, ' PI ');
        s = s.replace(/\\e\b/g, ' E ');
        s = s.replace(/\\left|\\right/g, '');
        s = s.replace(/\\displaystyle|\\limits/g, '');
        s = s.replace(/\\text\{.*?\}|\\mathrm\{.*?\}|\\mathbf\{.*?\}/g, '');
        s = s.replace(/\\,|\\;|\\!|\\quad|\\qquad/g, ' ');

        // Degrees: 30^\circ or 30^{\circ} or 30°
        s = s.replace(/(\d+(?:\.\d+)?)\s*\^?\s*\{?\\circ\}?/g, '($1 * PI / 180)');
        s = s.replace(/(\d+(?:\.\d+)?)\s*°/g, '($1 * PI / 180)');

        // Factorial: 5! -> factorial(5)
        s = s.replace(/(\d+)\s*!/g, 'factorial($1)');
        s = s.replace(/\(([^()]+)\)\s*!/g, 'factorial($1)');

        // Trig & Log function names
        s = s.replace(/\\sin\b/g, 'sin');
        s = s.replace(/\\cos\b/g, 'cos');
        s = s.replace(/\\tan\b|\\tg\b/g, 'tan');
        s = s.replace(/\\cot\b|\\ctg\b/g, 'cot');
        s = s.replace(/\\arcsin\b/g, 'asin');
        s = s.replace(/\\arccos\b/g, 'acos');
        s = s.replace(/\\arctan\b|\\arctg\b/g, 'atan');
        s = s.replace(/\\ln\b/g, 'ln');
        s = s.replace(/\\lg\b/g, 'lg');
        s = s.replace(/\\log\b/g, 'log');
        s = s.replace(/\\exp\b/g, 'exp');

        // Brackets & braces
        s = s.replace(/\{/g, '(').replace(/\}/g, ')');
        s = s.replace(/\[/g, '(').replace(/\]/g, ')');

        // Power operator ^ to **
        s = s.replace(/\^/g, '**');

        // Unicode math symbols
        s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/²/g, '**2').replace(/³/g, '**3');

        // Decimal comma (e.g. 3,14 -> 3.14) when between digits
        s = s.replace(/(\d+),(\d+)/g, '$1.$2');

        // Percentages: 25% -> (25 / 100)
        s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1 / 100)');

        // Implicit multiplication
        // 2( -> 2*(
        s = s.replace(/(\d)\s*(\()/g, '$1 * $2');
        // 2x or 2sin or 2PI -> 2 * x
        s = s.replace(/(\d)\s*([a-zA-Z])/g, '$1 * $2');
        // )( -> )*(
        s = s.replace(/(\))\s*(\()/g, '$1 * $2');
        // )2 -> )*2
        s = s.replace(/(\))\s*(\d)/g, '$1 * $2');
        // )x -> )*x
        s = s.replace(/(\))\s*([a-zA-Z])/g, '$1 * $2');

        return s.trim();
    }


    I.latexToMath = latexToMath;
})();
