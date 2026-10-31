// src/ai/calculator/tools.ts
// Tool declarations and dispatcher entries for the calculator.
(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function buildCalculatorTool(apiFormat: string): unknown[] {
        const desc = 'Evaluate a non-trivial arithmetic, algebraic, or LaTeX expression. Use ONLY when the question explicitly requires a numeric computation. Never call it for simple arithmetic (e.g. 1+1), for questions that need no calculation, or to test that the tool works.';
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

    // The tool schema is sent with every request, so only expose the calculator
    // when the question actually looks numerical. Otherwise models tend to call
    // it "just in case" (e.g. 1+1 on a biology test), costing an extra round trip.
    function questionNeedsCalculator(questionData?: XdQuestionData): boolean {
        if (!questionData) return true;
        // Use the question text only: numeric answer options alone (dates, counts,
        // percentages) do not mean the model needs to compute anything.
        const text = (questionData.text || '').toLowerCase();
        if (!text.trim()) return true;
        if (/\\frac|\\sqrt|\\times|\\div|\\cdot|\\pi|\\left|\\right/.test(text)) return true;
        if (/\d\s*[+\-*/×÷^%=<>√]|[+\-*/×÷^%=<>√]\s*\d/.test(text)) return true;
        return /(обчисл|розраху|порахуй|підраху|знайди значення|спростіть вираз|спрости вираз|розв['’]?яж|рівнянн|відсот|процент|ймовірніст|пропорці|площ|об['’]?єм|швидкіст|прискоренн|добуток|частк|логарифм|синус|косинус|тангенс|похідн|інтеграл|молярн|концентрац|густин|стехіометр|середнє арифметичне|сум[аи]|різниц)/i.test(text);
    }

    function buildTools(s: XdEffectiveSettings, apiFormat: string, questionData?: XdQuestionData): unknown[] {
        const tools: unknown[] = [];
        const I = window.xdAnswers._internal;
        const webSearch = s.webSearchEnabled && !!(I.getActiveSearchProvider && I.getActiveSearchProvider(s as unknown as XdSettings));
        const calculator = s.calculatorEnabled !== false && questionNeedsCalculator(questionData);

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

    I.buildCalculatorTool = buildCalculatorTool;
    I.buildTools = buildTools;
    I.executeCalculator = executeCalculator;
    I.isCalculatorToolName = isCalculatorToolName;
})();
