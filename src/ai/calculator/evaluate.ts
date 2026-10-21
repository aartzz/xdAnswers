// src/ai/calculator/evaluate.ts
// Expression evaluation with LaTeX preprocessing and numeric rounding.
(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    const { latexToMath, ALLOWED_TOKENS, isSafeExpression, compileExpression } = I;

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
})();
