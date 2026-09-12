(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    const MATH_SCOPE = {
        Math: Math,
        PI: Math.PI,
        E: Math.E,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        asin: Math.asin,
        acos: Math.acos,
        atan: Math.atan,
        atan2: Math.atan2,
        sinh: Math.sinh,
        cosh: Math.cosh,
        tanh: Math.tanh,
        cot: function(x) { return 1 / Math.tan(x); },
        ctg: function(x) { return 1 / Math.tan(x); },
        tg: Math.tan,
        sqrt: Math.sqrt,
        cbrt: Math.cbrt,
        abs: Math.abs,
        pow: Math.pow,
        exp: Math.exp,
        ln: Math.log,
        log: Math.log10,
        lg: Math.log10,
        log10: Math.log10,
        log2: Math.log2,
        min: Math.min,
        max: Math.max,
        round: Math.round,
        floor: Math.floor,
        ceil: Math.ceil,
        factorial: function(n) {
            n = Math.round(Number(n));
            if (n < 0 || !isFinite(n)) return NaN;
            if (n === 0 || n === 1) return 1;
            if (n > 170) return Infinity;
            let r = 1;
            for (let i = 2; i <= n; i++) r *= i;
            return r;
        },
        comb: function(n, k) {
            n = Math.round(Number(n));
            k = Math.round(Number(k));
            if (k < 0 || k > n) return 0;
            if (k === 0 || k === n) return 1;
            k = Math.min(k, n - k);
            let c = 1;
            for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
            return Math.round(c);
        },
        perm: function(n, k) {
            n = Math.round(Number(n));
            k = Math.round(Number(k));
            if (k < 0 || k > n) return 0;
            let p = 1;
            for (let i = 0; i < k; i++) p *= (n - i);
            return p;
        },
        gcd: function(a, b) {
            a = Math.abs(Math.round(a));
            b = Math.abs(Math.round(b));
            while (b) { const t = b; b = a % b; a = t; }
            return a;
        },
        lcm: function(a, b) {
            if (!a || !b) return 0;
            return Math.abs(Math.round(a * b)) / MATH_SCOPE.gcd(a, b);
        }
    };

    function parseGroup(str, start, openChar, closeChar) {
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

    function latexToMath(latex) {
        if (!latex || typeof latex !== 'string') return '';
        let s = latex.trim();
        s = s.replace(/^\$+|\$+$/g, '').trim();

        // Balanced braces replacement for \frac and \dfrac
        function replaceFracs(str) {
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
        function replaceBinoms(str) {
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
        let sMatch;
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

    function isSafeExpression(expr, allowedVars) {
        if (/["'`\\;{}[\]]/.test(expr)) return false;
        const vars = new Set(allowedVars || []);
        const words = expr.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
        for (const w of words) {
            if (!ALLOWED_TOKENS.has(w) && !vars.has(w)) return false;
        }
        return true;
    }

    function evaluateMath(rawExpression) {
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
                            const fnArgs = Object.keys(MATH_SCOPE);
                            const fnVals = Object.values(MATH_SCOPE);
                            const fn = new Function(...fnArgs, varName, 'return (' + diffStr + ');');
                            const evalAt = (val) => fn(...fnVals, val);

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
            const fnArgs = Object.keys(MATH_SCOPE);
            const fnVals = Object.values(MATH_SCOPE);
            const fn = new Function(...fnArgs, 'return (' + converted + ');');
            const res = fn(...fnVals);

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
            return { success: false, error: err.message, converted };
        }
    }

    function buildCalculatorTool(apiFormat) {
        const desc = 'Calculate and evaluate mathematical expressions, arithmetic, algebraic formulas, or LaTeX math (e.g. fractions \\frac{a}{b}, square roots \\sqrt{x}, exponents 2^8, percentages, trigonometry, equations 2x + 5 = 15). Use this tool whenever the question involves calculations to guarantee 100% precision.';
        const params = {
            type: 'object',
            properties: {
                expression: {
                    type: 'string',
                    description: 'The mathematical expression or LaTeX equation to evaluate (e.g. "125 * 0.15", "\\frac{3}{4} + \\sqrt{144}", "2^8 - 15", "2x + 10 = 30")'
                }
            },
            required: ['expression'],
            additionalProperties: false
        };

        if (apiFormat === 'openai') {
            return [{ type: 'function', function: { name: 'calculator', description: desc, parameters: params, strict: true } }];
        }
        if (apiFormat === 'anthropic') {
            return [{ name: 'calculator', description: desc, input_schema: params }];
        }
        if (apiFormat === 'google') {
            return [{ function_declarations: [{ name: 'calculator', description: desc, parameters: params }] }];
        }
        return [];
    }

    function executeCalculator(rawExpression) {
        const res = evaluateMath(rawExpression);
        return JSON.stringify(res);
    }

    function isCalculatorToolName(name) {
        if (!name) return false;
        const n = String(name).toLowerCase();
        return n === 'calculator' || n === 'calculate' || n === 'math_eval' || n === 'latex_calculator' || n === 'latex_eval';
    }

    function buildTools(s, apiFormat) {
        const tools = [];
        const I = window.xdAnswers._internal;
        const webSearch = s.webSearchEnabled && !!(I.getActiveSearchProvider && I.getActiveSearchProvider(s));
        const calculator = s.calculatorEnabled !== false;

        if (apiFormat === 'openai') {
            if (webSearch && I.buildWebSearchTool) tools.push(...I.buildWebSearchTool('openai'));
            if (calculator) tools.push(...buildCalculatorTool('openai'));
            return tools;
        }
        if (apiFormat === 'anthropic') {
            if (webSearch && I.buildWebSearchTool) tools.push(...I.buildWebSearchTool('anthropic'));
            if (calculator) tools.push(...buildCalculatorTool('anthropic'));
            return tools;
        }
        if (apiFormat === 'google') {
            const decls = [];
            if (webSearch && I.buildWebSearchTool) {
                const ws = I.buildWebSearchTool('google');
                if (ws[0]?.function_declarations) decls.push(...ws[0].function_declarations);
            }
            if (calculator) {
                const calc = buildCalculatorTool('google');
                if (calc[0]?.function_declarations) decls.push(...calc[0].function_declarations);
            }
            return decls.length > 0 ? [{ function_declarations: decls }] : [];
        }
        return [];
    }

    window.xdAnswers._internal.evaluateMath = evaluateMath;
    window.xdAnswers._internal.latexToMath = latexToMath;
    window.xdAnswers._internal.buildCalculatorTool = buildCalculatorTool;
    window.xdAnswers._internal.buildTools = buildTools;
    window.xdAnswers._internal.executeCalculator = executeCalculator;
    window.xdAnswers._internal.isCalculatorToolName = isCalculatorToolName;
})();
