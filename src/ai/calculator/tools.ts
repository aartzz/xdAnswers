// src/ai/calculator/tools.ts
// Tool declarations and dispatcher entries for the calculator.
(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function buildCalculatorTool(apiFormat: string): unknown[] {
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

    function executeCalculator(rawExpression: string): string {
        const res = I.evaluateMath(rawExpression);
        return JSON.stringify(res);
    }

    function isCalculatorToolName(name: string): boolean {
        if (!name) return false;
        const n = String(name).toLowerCase();
        return n === 'calculator' || n === 'calculate' || n === 'math_eval' || n === 'latex_calculator' || n === 'latex_eval';
    }

    function buildTools(s: XdEffectiveSettings, apiFormat: string): unknown[] {
        const tools: unknown[] = [];
        const I = window.xdAnswers._internal;
        const webSearch = s.webSearchEnabled && !!(I.getActiveSearchProvider && I.getActiveSearchProvider(s as unknown as XdSettings));
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

    I.buildCalculatorTool = buildCalculatorTool;
    I.buildTools = buildTools;
    I.executeCalculator = executeCalculator;
    I.isCalculatorToolName = isCalculatorToolName;
})();
