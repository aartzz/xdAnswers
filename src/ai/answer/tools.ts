// src/ai/answer/tools.ts
// Executes answer-mode tool calls (calculator, web search) and runs the Google function-call follow-up turn.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    I.executeAnswerTool = async function(name: string, args: Record<string, any>): Promise<string> {
        if (['bash', 'edit', 'glob', 'grep', 'read'].includes(name)) {
            return JSON.stringify({ error: 'This tool is not available in this client. Answer from the question only.' });
        }
        const isCalc = I.isCalculatorToolName && I.isCalculatorToolName(name);
        if (isCalc) {
            const expr = args.expression || args.expr || args.formula || args.query || args.input || '';
            return I.executeCalculator(expr);
        }
        const query = args.query || '';
        const numResults = args.num_results || 5;
        return query ? await I.executeSearch(query, numResults, args.source || null) : JSON.stringify({ error: 'Empty query' });
    };

    I.answerGoogleFunctionCalls = async function(s: XdEffectiveSettings, body: Record<string, unknown>, parts: any[]): Promise<string> {
        // Add assistant's function call to conversation
        const assistantParts = parts.map((p: any) => {
            if (p.functionCall) return { functionCall: p.functionCall };
            return p;
        });
        // Google requires functionResponse in the next turn
        const functionResponses: Array<Record<string, unknown>> = [];
        for (const p of parts) {
            if (p.functionCall) {
                try {
                    const resultJson = await I.executeAnswerTool(p.functionCall.name, p.functionCall.args || {});
                    functionResponses.push({ functionResponse: { name: p.functionCall.name, response: JSON.parse(resultJson) } });
                } catch (err) {
                    functionResponses.push({ functionResponse: { name: p.functionCall.name, response: { error: (err as Error).message } } });
                }
            }
        }
        // Rebuild contents with both turns
        const newContents = (body.contents as Array<Record<string, unknown>>) || [];
        newContents.push({ role: 'model', parts: assistantParts });
        newContents.push({ role: 'user', parts: functionResponses });
        body.contents = newContents;
        // Re-request
        const resp2 = await window.xdAnswers.makeRequest({
            url: I.buildNonStreamUrl(s), method: 'POST', headers: I.buildHeaders(s), data: JSON.stringify(body), timeout: 120000
        });
        const parsed2: any = JSON.parse(resp2.data);
        return parsed2.candidates?.[0]?.content?.parts?.[0]?.text || '';
    };
})();
