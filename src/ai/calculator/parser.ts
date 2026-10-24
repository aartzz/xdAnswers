// src/ai/calculator/parser.ts
// Expression safety check, tokenizer and CSP-safe closure compiler.
(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    const MATH_SCOPE = I.MATH_SCOPE as Record<string, unknown>;

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


    I.ALLOWED_TOKENS = ALLOWED_TOKENS;
    I.isSafeExpression = isSafeExpression;
    I.tokenizeMath = tokenizeMath;
    I.compileExpression = compileExpression;
})();
