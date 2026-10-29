// src/ai/stream/tool-calls.ts
// Executes streamed tool calls (web search, calculator) and continues the stream.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    type ToolStreamState = { fullContent: string; fullThinking: string; lastHighlightedAnswer: string; thinkingStarted: boolean; thinkingDone: boolean; streamTimerInterval: number | null; statusCleared: boolean; toolLoopDepth: number; isHandlingToolCalls: boolean; searchCalls: XdSearchCallInfo[]; calcCalls: XdCalcCallInfo[]; pendingToolCalls: Record<number, { index: number; id?: string; name?: string; args: string; _parsedInput?: any }>; inInlineThinking: boolean; rawContentBuffer: string; isThinkingExpanded: boolean; isSearchExpanded: boolean; isCalcExpanded: boolean };

    I.createToolCalls = function(ctx: Record<string, any>): () => Promise<void> {
        const { I, MAX_TOOL_LOOPS, executeSearch, finishStream, messages, s, startStreamRound, updateStreamUI } = ctx;
        const st = ctx.st as ToolStreamState;

            // Execute pending tool calls and continue streaming
            async function handleToolCalls() {
                if (st.isHandlingToolCalls) return;
                st.isHandlingToolCalls = true;

                const toolCalls = Object.values(st.pendingToolCalls);
                if (toolCalls.length === 0) {
                    st.isHandlingToolCalls = false;
                    finishStream();
                    return;
                }

                st.toolLoopDepth++;
                console.log('[xdAnswers] Tool call detected (depth=' + st.toolLoopDepth + '):', toolCalls.map(tc => (tc.name || '') + '(' + tc.args.slice(0, 100) + ')').join(', '));
                if (st.toolLoopDepth > MAX_TOOL_LOOPS) {
                    console.warn('[xdAnswers] Max tool loop depth reached, stopping');
                    st.fullContent += '\n\n[Web search limit reached — skipping further searches]';
                    st.isHandlingToolCalls = false;
                    finishStream();
                    return;
                }

                // Cancel the previous stream before starting a new one to avoid port leaks and
                // "Promised response went out of scope" errors in Firefox/Zen.
                if (window.xdAnswers._cancelStream) {
                    try { window.xdAnswers._cancelStream(); } catch (e) {}
                    window.xdAnswers._cancelStream = null;
                }

                // Build assistant message with tool_calls (OpenAI format) or content blocks (Anthropic)
                if (s.apiFormat === 'openai') {
                    toolCalls.forEach((tc, idx) => {
                        if (!tc.id) tc.id = 'call_' + Date.now() + '_' + idx;
                    });

                    const assistantMsg = {
                        role: 'assistant',
                        content: st.fullContent || '',
                        tool_calls: toolCalls.map(tc => ({
                            id: tc.id,
                            type: 'function',
                            function: { name: tc.name, arguments: tc.args }
                        }))
                    };
                    messages.push(assistantMsg);

                    // Execute each tool call and add tool results
                    for (let i = 0; i < toolCalls.length; i++) {
                        const tc = toolCalls[i];
                        let args: any = {};
                        try { args = JSON.parse(tc.args); } catch {}
                        const isCalc = I.isCalculatorToolName && I.isCalculatorToolName(tc.name || '');
                        const isSearch = tc.name === 'web_search' || tc.name === 'search';

                        if (isCalc) {
                            const expr = I.extractToolExpression(args);
                            let ccEntry = st.calcCalls.find(c => c.round === (st.toolLoopDepth - 1) && c.toolIndex === tc.index);
                            if (!ccEntry && expr) {
                                ccEntry = st.calcCalls.find(c => c.expression === expr && c.status === 'calculating');
                            }
                            if (!ccEntry) {
                                ccEntry = { round: st.toolLoopDepth - 1, toolIndex: tc.index !== undefined ? tc.index : i, expression: expr || 'Math expression', status: 'calculating' };
                                st.calcCalls.push(ccEntry);
                            } else {
                                ccEntry.status = 'calculating';
                                if (expr) ccEntry.expression = expr;
                            }
                            updateStreamUI();

                            try {
                                const resultJson = I.executeCalculator(expr);
                                let resObj: any = {};
                                try { resObj = JSON.parse(resultJson); } catch {}
                                ccEntry.status = 'done';
                                ccEntry.result = resObj.result !== undefined ? resObj.result : (resObj.error || 'error');
                                updateStreamUI();

                                messages.push({ role: 'tool', tool_call_id: tc.id, content: resultJson });
                            } catch (err) {
                                ccEntry.status = 'done';
                                ccEntry.result = (err as Error).message;
                                updateStreamUI();
                                messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: (err as Error).message }) });
                            }
                        } else if (isSearch) {
                            const query = I.extractToolQuery(args);
                            const numResults = args.num_results || args.num || 5;

                            let scEntry = st.searchCalls.find(sc => sc.round === (st.toolLoopDepth - 1) && sc.toolIndex === tc.index);
                            if (!scEntry && query) {
                                scEntry = st.searchCalls.find(sc => sc.query === query && sc.status === 'searching');
                            }
                            if (!scEntry) {
                                scEntry = { round: st.toolLoopDepth - 1, toolIndex: tc.index !== undefined ? tc.index : i, query: query || 'Web search', status: 'searching', resultCount: 0 };
                                st.searchCalls.push(scEntry);
                            } else {
                                scEntry.status = 'searching';
                                if (query) scEntry.query = query;
                            }
                            updateStreamUI();

                            if (!query) {
                                scEntry.status = 'done';
                                scEntry.resultCount = 0;
                                updateStreamUI();
                                messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: 'Empty query' }) });
                                continue;
                            }

                            try {
                                const source = args.source || null;
                                const resultJson = await executeSearch(query, numResults, source);
                                let count = 0;
                                try {
                                    const resultObj = JSON.parse(resultJson);
                                    count = resultObj.organic?.length || 0;
                                } catch {}
                                scEntry.status = 'done';
                                scEntry.resultCount = count;
                                updateStreamUI();

                                messages.push({ role: 'tool', tool_call_id: tc.id, content: resultJson });
                            } catch (err) {
                                scEntry.status = 'done';
                                scEntry.resultCount = 0;
                                updateStreamUI();
                                messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: (err as Error).message }) });
                            }
                        } else {
                            // Stub or unsupported tool from free-tier gate
                            messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: 'Tool not supported in this client' }) });
                        }
                    }
                } else if (s.apiFormat === 'anthropic') {
                    // Build assistant content blocks
                    const assistantBlocks: Array<Record<string, unknown>> = [];
                    if (st.fullContent) {
                        assistantBlocks.push({ type: 'text', text: st.fullContent });
                    }
                    toolCalls.forEach((tc, idx) => {
                        if (!tc.id) tc.id = 'toolu_' + Date.now() + '_' + idx;
                        try { tc._parsedInput = JSON.parse(tc.args || '{}'); } catch { tc._parsedInput = {}; }
                        assistantBlocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc._parsedInput });
                    });
                    messages.push({ role: 'assistant', content: assistantBlocks });

                    // Execute and add tool_result
                    const toolResultBlocks: Array<Record<string, unknown>> = [];
                    for (let i = 0; i < toolCalls.length; i++) {
                        const tc = toolCalls[i];
                        const args = tc._parsedInput || {};
                        const isCalc = I.isCalculatorToolName && I.isCalculatorToolName(tc.name || '');

                        if (isCalc) {
                            const expr = I.extractToolExpression(args);
                            let ccEntry = st.calcCalls.find(c => c.round === (st.toolLoopDepth - 1) && c.toolIndex === tc.index);
                            if (!ccEntry && expr) {
                                ccEntry = st.calcCalls.find(c => c.expression === expr && c.status === 'calculating');
                            }
                            if (!ccEntry) {
                                ccEntry = { round: st.toolLoopDepth - 1, toolIndex: tc.index !== undefined ? tc.index : i, expression: expr || 'Math expression', status: 'calculating' };
                                st.calcCalls.push(ccEntry);
                            } else {
                                ccEntry.status = 'calculating';
                                if (expr) ccEntry.expression = expr;
                            }
                            updateStreamUI();

                            try {
                                const resultJson = I.executeCalculator(expr);
                                let resObj: any = {};
                                try { resObj = JSON.parse(resultJson); } catch {}
                                ccEntry.status = 'done';
                                ccEntry.result = resObj.result !== undefined ? resObj.result : (resObj.error || 'error');
                                updateStreamUI();

                                toolResultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: resultJson });
                            } catch (err) {
                                ccEntry.status = 'done';
                                ccEntry.result = (err as Error).message;
                                updateStreamUI();
                                toolResultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify({ error: (err as Error).message }) });
                            }
                        } else {
                            const query = args.query || '';
                            const numResults = args.num_results || 5;

                            let scEntry = st.searchCalls.find(sc => sc.round === (st.toolLoopDepth - 1) && sc.toolIndex === tc.index);
                            if (!scEntry && query) {
                                scEntry = st.searchCalls.find(sc => sc.query === query && sc.status === 'searching');
                            }
                            if (!scEntry) {
                                scEntry = { round: st.toolLoopDepth - 1, toolIndex: tc.index !== undefined ? tc.index : i, query: query || 'Web search', status: 'searching', resultCount: 0 };
                                st.searchCalls.push(scEntry);
                            } else {
                                scEntry.status = 'searching';
                                if (query) scEntry.query = query;
                            }
                            updateStreamUI();

                            if (!query) {
                                scEntry.status = 'done';
                                scEntry.resultCount = 0;
                                updateStreamUI();
                                toolResultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify({ error: 'Empty query' }) });
                                continue;
                            }

                            try {
                                const source = args.source || null;
                                const resultJson = await executeSearch(query, numResults, source);
                                let count = 0;
                                try {
                                    const resultObj = JSON.parse(resultJson);
                                    count = resultObj.organic?.length || 0;
                                } catch {}
                                scEntry.status = 'done';
                                scEntry.resultCount = count;
                                updateStreamUI();

                                toolResultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: resultJson });
                            } catch (err) {
                                scEntry.status = 'done';
                                scEntry.resultCount = 0;
                                updateStreamUI();
                                toolResultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify({ error: (err as Error).message }) });
                            }
                        }
                    }
                    messages.push({ role: 'user', content: toolResultBlocks });
                }

                // Ensure all indicators for this round are finalized
                st.searchCalls.forEach(sc => { if (sc.status === 'searching') sc.status = 'done'; });
                st.calcCalls.forEach(c => { if (c.status === 'calculating') c.status = 'done'; });
                updateStreamUI();

                // Reset per-round state for the next stream
                st.pendingToolCalls = {};
                st.inInlineThinking = false;
                st.rawContentBuffer = '';
                st.thinkingStarted = false;
                st.thinkingDone = false;
                st.isHandlingToolCalls = false;

                // Re-stream with updated messages
                startStreamRound(messages);
            }

        return handleToolCalls;
    };
})();
