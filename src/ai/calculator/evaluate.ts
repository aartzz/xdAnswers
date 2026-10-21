// src/ai/calculator/evaluate.ts
// LaTeX preprocessing, tokenizer, expression compiler and evaluator.
(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    const MATH_SCOPE = I.MATH_SCOPE as Record<string, unknown>;

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

    const ALLOWED_TOKENS = new Set([
        'Math', 'PI', 'E',
        'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
        'sinh', 'cosh', 'tanh', 'cot', 'ctg', 'tg',
        'sqrt', 'cbrt', 'abs', 'pow', 'exp',
        'ln', 'log', 'lg', 'log10', 'log2',
        'min', 'max', 'round', 'floor', 'ceil',
        'factorial', 'comb', 'perm', 'gcd', 'lcm'
    ]);

    function isSafeExpression(expr: string, allowedVars?: string[]): boolean {
        if (/["'`\\;{}[\]]/.test(expr)) return false;
        const vars = new Set(allowedVars || []);
        const words = expr.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
        for (const w of words) {
            if (!ALLOWED_TOKENS.has(w) && !vars.has(w)) return false;
        }
        return true;
    }

    type MathFn = (env: Record<string, number>) => number;

    interface MathToken {
        type: 'num' | 'name' | 'op';
        value: number | string;
    }

    // CSP-safe expression evaluator: new Function() is blocked by CSP in
    // content scripts (Firefox: "call to Function() blocked by CSP"), so
    // parse the expression into a tree of closures instead.
    function tokenizeMath(expr: string): MathToken[] {
        const tokens: MathToken[] = [];
        let i = 0;
        while (i < expr.length) {
            const ch = expr[i];
            if (/\s/.test(ch)) { i++; continue; }
            if (/[0-9.]/.test(ch)) {
                let j = i;
                while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
                // Scientific notation: 1e-3, 2.5E6
                if (expr[j] === 'e' || expr[j] === 'E') {
                    let k = j + 1;
                    if (expr[k] === '+' || expr[k] === '-') k++;
                    if (/[0-9]/.test(expr[k] || '')) {
                        while (k < expr.length && /[0-9]/.test(expr[k])) k++;
                        j = k;
                    }
                }
                const value = Number(expr.slice(i, j));
                if (!isFinite(value)) throw new Error('Invalid number: ' + expr.slice(i, j));
                tokens.push({ type: 'num', value });
                i = j;
                continue;
            }
            if (/[a-zA-Z_$]/.test(ch)) {
                let j = i;
                while (j < expr.length && /[a-zA-Z0-9_$]/.test(expr[j])) j++;
                tokens.push({ type: 'name', value: expr.slice(i, j) });
                i = j;
                continue;
            }
            if (ch === '*' && expr[i + 1] === '*') { tokens.push({ type: 'op', value: '**' }); i += 2; continue; }
            if ('+-*/%(),'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i++; continue; }
            throw new Error('Unexpected character: ' + ch);
        }
        return tokens;
    }

    function compileExpression(expr: string, variableNames?: string[]): MathFn {
        const mathVars = new Set(variableNames || []);
        const tokens = tokenizeMath(expr.replace(/Math\s*\./g, ''));
        let pos = 0;
        const peek = (): MathToken | undefined => tokens[pos];
        const next = (): MathToken | undefined => tokens[pos++];
        const isOp = (t: MathToken | undefined, v: string): boolean => !!t && t.type === 'op' && t.value === v;

        function parsePrimary(): MathFn {
            const t = next();
            if (!t) throw new Error('Unexpected end of expression');
            if (t.type === 'num') { const v = t.value as number; return () => v; }
            if (t.type === 'name') {
                const name = t.value as string;
                if (isOp(peek(), '(')) {
                    next();
                    const args: MathFn[] = [];
                    if (!isOp(peek(), ')')) {
                        args.push(parseExpression());
                        while (isOp(peek(), ',')) { next(); args.push(parseExpression()); }
                    }
                    if (!isOp(peek(), ')')) throw new Error('Expected ) after arguments of ' + name);
                    next();
                    const fn = MATH_SCOPE[name];
                    if (typeof fn !== 'function') throw new Error('Unknown function: ' + name);
                    const callable = fn as (...fnArgs: number[]) => number;
                    return env => callable(...args.map(a => a(env)));
                }
                if (mathVars.has(name)) { return env => env[name]; }
                const constant = MATH_SCOPE[name];
                if (typeof constant === 'number') { return () => constant; }
                throw new Error('Unknown identifier: ' + name);
            }
            if (isOp(t, '(')) {
                const inner = parseExpression();
                if (!isOp(peek(), ')')) throw new Error('Expected )');
                next();
                return inner;
            }
            throw new Error('Unexpected token: ' + t.value);
        }

        function parsePower(): MathFn {
            const base = parsePrimary();
            if (isOp(peek(), '**')) {
                next();
                const exp = parseUnary(); // right-associative
                return env => Math.pow(base(env), exp(env));
            }
            return base;
        }

        function parseUnary(): MathFn {
            if (isOp(peek(), '-') || isOp(peek(), '+')) {
                const sign = next()!.value;
                const operand = parseUnary();
                return sign === '-' ? env => -operand(env) : operand;
            }
            return parsePower();
        }

        function parseMultiplicative(): MathFn {
            let left = parseUnary();
            while (isOp(peek(), '*') || isOp(peek(), '/') || isOp(peek(), '%')) {
                const op = next()!.value;
                const l = left;
                const r = parseUnary();
                if (op === '*') left = env => l(env) * r(env);
                else if (op === '/') left = env => l(env) / r(env);
                else left = env => l(env) % r(env);
            }
            return left;
        }

        function parseExpression(): MathFn {
            let left = parseMultiplicative();
            while (isOp(peek(), '+') || isOp(peek(), '-')) {
                const op = next()!.value;
                const l = left;
                const r = parseMultiplicative();
                left = op === '+' ? env => l(env) + r(env) : env => l(env) - r(env);
            }
            return left;
        }

        const root = parseExpression();
        if (pos < tokens.length) throw new Error('Unexpected token: ' + tokens[pos].value);
        return root;
    }

    function evaluateMath(rawExpression: string): XdMathEvalResult {
        if (!rawExpression || typeof rawExpression !== 'string') {
            return { success: false, error: 'Empty expression' };
        }

        const converted = latexToMath(rawExpression);

        // Check if equation
        if (converted.includes('=')) {
            const parts = converted.split('=');
            if (parts.length === 2) {
                const lhs = parts[0].trim();
                const rhs = parts[1].trim();
                const varMatches = converted.match(/\b([a-zA-Z])\b/g) || [];
                const candidateVars = [...new Set(varMatches)].filter(v => !ALLOWED_TOKENS.has(v));

                if (candidateVars.length === 1) {
                    const varName = candidateVars[0];
                    if (isSafeExpression(lhs, [varName]) && isSafeExpression(rhs, [varName])) {
                        try {
                            const diffStr = '(' + lhs + ') - (' + rhs + ')';
                            const fn = compileExpression(diffStr, [varName]);
                            const evalAt = (val: number) => fn({ [varName]: val });

                            // Test for quadratic: f(x) = A*x^2 + B*x + C
                            const c = evalAt(0);
                            const f1 = evalAt(1);
                            const fm1 = evalAt(-1);
                            const a = (f1 + fm1 - 2 * c) / 2;
                            const b = (f1 - fm1) / 2;
                            const f2 = evalAt(2);
                            const expectedF2 = 4 * a + 2 * b + c;

                            if (Math.abs(f2 - expectedF2) < 1e-5) {
                                if (Math.abs(a) < 1e-9) {
                                    // Linear: b*x + c = 0
                                    if (Math.abs(b) > 1e-9) {
                                        const sol = -c / b;
                                        const cleanSol = Math.round(sol * 1e8) / 1e8;
                                        return {
                                            success: true,
                                            expression: rawExpression,
                                            equation: true,
                                            variable: varName,
                                            solutions: [cleanSol],
                                            result: varName + ' = ' + cleanSol
                                        };
                                    }
                                } else {
                                    // Quadratic: a*x^2 + b*x + c = 0
                                    const D = b * b - 4 * a * c;
                                    if (D >= 0) {
                                        const sqrtD = Math.sqrt(Math.max(0, D));
                                        const x1 = (-b + sqrtD) / (2 * a);
                                        const x2 = (-b - sqrtD) / (2 * a);
                                        const clean1 = Math.round(x1 * 1e8) / 1e8;
                                        const clean2 = Math.round(x2 * 1e8) / 1e8;
                                        const uniqueSols = [...new Set([clean1, clean2])].sort((u, v) => u - v);
                                        return {
                                            success: true,
                                            expression: rawExpression,
                                            equation: true,
                                            variable: varName,
                                            solutions: uniqueSols,
                                            result: varName + ' = ' + uniqueSols.join(', ' + varName + ' = ')
                                        };
                                    }
                                    return {
                                        success: true,
                                        expression: rawExpression,
                                        equation: true,
                                        variable: varName,
                                        solutions: [],
                                        result: 'No real roots (D = ' + Math.round(D * 1e4) / 1e4 + ')'
                                    };
                                }
                            }
                        } catch (eqErr) {
                            // Fall through to general expression evaluation if equation solver fails
                        }
                    }
                }
            }
        }

        if (!isSafeExpression(converted)) {
            return { success: false, error: 'Unsafe or invalid math expression: ' + rawExpression };
        }

        try {
            const fn = compileExpression(converted, []);
            const res = fn({});

            if (typeof res !== 'number' || isNaN(res)) {
                return { success: false, error: 'Expression evaluated to NaN or non-number', converted };
            }

            // Round small floating precision errors (e.g. 0.30000000000000004 -> 0.3)
            const cleanRes = Math.abs(res - Math.round(res)) < 1e-10 ? Math.round(res) : Number(res.toPrecision(10));

            return {
                success: true,
                expression: rawExpression,
                converted: converted,
                result: cleanRes,
                formatted: String(cleanRes)
            };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err), converted };
        }
    }

    I.evaluateMath = evaluateMath;
    I.latexToMath = latexToMath;
})();
