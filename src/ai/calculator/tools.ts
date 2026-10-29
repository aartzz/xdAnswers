// src/ai/calculator/tools.ts
// Tool declarations and dispatcher entries for the calculator.
(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function questionLikelyNeedsCalculator(text?: string, optionsText?: string): boolean {
        const combined = ((text || '') + ' ' + (optionsText || '')).trim();
        if (!combined) return false;

        // 1. Explicit LaTeX math commands
        if (/\\(?:frac|sqrt|times|div|pm|cdot|sum|int|sin|cos|tan|cot|log|ln|lim|infty)\b/.test(combined)) {
            return true;
        }

        // 2. Clear arithmetic or algebraic expressions: "25 + 17", "12 * 8", "100 / 4", "2^8", "x^2"
        if (/\b\d+\s*[\+\-\*\/×÷\^]\s*\d+\b/.test(combined) || /\b\d+\s*=\s*\d+\b/.test(combined)) {
            return true;
        }

        // 3. Mathematical equations with variables: "2x + 5 = 15", "y = 3x - 1"
        if (/\b\d*[a-zA-Z]\s*[\+\-\*\/]\s*\d*[a-zA-Z0-9]\s*=/.test(combined)) {
            return true;
        }

        // 4. Word-based math / physics calculation keywords when digits are present
        const hasDigits = /\d/.test(combined);
        if (hasDigits && /обчисл|порахуй|знайдіть значення|площ[аі]|периметр|густин|швидкіст|відсот[ок|ків]|процент|розв['’]?яж(?:іть)? рівнян|градус|координат|calculate|solve|equation|formula/i.test(combined)) {
            return true;
        }

        // 5. If options are predominantly pure numbers/math: e.g. "A: 4; B: 12; C: 25; D: 36"
        if (optionsText) {
            const optionLines = optionsText.split('\n').filter(Boolean);
            if (optionLines.length >= 2) {
                const pureNumberOptions = optionLines.filter(line => /^[A-Z0-9\.\)\s]*[\+\-]?\d+(?:[\.,]\d+)?\s*(?:см|мм|м|кг|г|с|хв|%|°)?$/i.test(line.trim()));
                if (pureNumberOptions.length >= Math.ceil(optionLines.length / 2)) {
                    return true;
                }
            }
        }

        return false;
    }

    function buildCalculatorTool(apiFormat: string): unknown[] {
        const desc = 'Calculate and evaluate mathematical expressions, arithmetic, algebraic formulas, or LaTeX math (e.g. fractions \\frac{a}{b}, square roots \\sqrt{x}, exponents 2^8, percentages, trigonometry, equations). Use this tool ONLY when the question explicitly involves mathematical calculations. NEVER call this tool for language, grammar, or non-math questions, and NEVER call it with dummy expressions.';
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

    function executeCalculator(rawExpression: string): string {
        const res = I.evaluateMath(rawExpression);
        return JSON.stringify(res);
    }

    function isCalculatorToolName(name: string): boolean {
        if (!name) return false;
        const n = String(name).toLowerCase();
        return n === 'calculator' || n === 'calculate' || n === 'math_eval' || n === 'latex_calculator' || n === 'latex_eval';
    }

    function buildOpenCodeCoreTools(): unknown[] {
        // Zen's free-tier gate reads names only (schemas/descriptions are ignored).
        // These are stubs so the real calculator tool still works below.
        return ['bash', 'edit', 'glob', 'grep', 'read'].map(name => ({
            type: 'function',
            function: {
                name,
                description: 'OpenCode internal tool. Not available in this client; do not call.',
                parameters: { type: 'object', properties: {}, additionalProperties: true }
            }
        }));
    }

    function buildTools(s: XdEffectiveSettings, apiFormat: string, questionData?: XdQuestionData): unknown[] {
        const tools: unknown[] = [];
        const I = window.xdAnswers._internal;
        const webSearch = s.webSearchEnabled && !!(I.getActiveSearchProvider && I.getActiveSearchProvider(s as unknown as XdSettings));
        let calculator = s.calculatorEnabled !== false;
        if (calculator && questionData) {
            calculator = questionLikelyNeedsCalculator(questionData.text, questionData.optionsText);
        }

        if (apiFormat === 'openai') {
            if (I.isOpenCodeFreeModel && I.isOpenCodeFreeModel(s)) tools.push(...buildOpenCodeCoreTools());
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
            const decls: unknown[] = [];
            if (webSearch && I.buildWebSearchTool) {
                const ws = I.buildWebSearchTool('google') as Array<{ function_declarations?: unknown[] }>;
                if (ws[0]?.function_declarations) decls.push(...ws[0].function_declarations);
            }
            if (calculator) {
                const calc = buildCalculatorTool('google') as Array<{ function_declarations?: unknown[] }>;
                if (calc[0]?.function_declarations) decls.push(...calc[0].function_declarations);
            }
            return decls.length > 0 ? [{ function_declarations: decls }] : [];
        }
        return [];
    }

    I.questionLikelyNeedsCalculator = questionLikelyNeedsCalculator;
    I.buildCalculatorTool = buildCalculatorTool;
    I.buildTools = buildTools;
    I.executeCalculator = executeCalculator;
    I.isCalculatorToolName = isCalculatorToolName;
})();
