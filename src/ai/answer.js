(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    window.xdAnswers.getAnswer = async function(questionData, effectiveSettingsOverride, showAnswerOnlyOverride) {
        const I = window.xdAnswers._internal;
        const getEffectiveSettings = I.getEffectiveSettings;
        const buildMessages = I.buildMessages;
        const buildRequestBody = I.buildRequestBody;
        const buildWebSearchTool = I.buildWebSearchTool;
        const buildNonStreamUrl = I.buildNonStreamUrl;
        const buildHeaders = I.buildHeaders;
        const executeSearch = I.executeSearch;

        const s = effectiveSettingsOverride || getEffectiveSettings(window.xdAnswers.settings);
        const { systemPrompt, userMsg } = buildMessages(questionData, showAnswerOnlyOverride);
        const images = questionData.base64Images || [];

        // Build initial messages for multi-turn tool support
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        const userContent = [{ type: 'text', text: userMsg }];
        images.forEach(img => userContent.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + img } }));
        messages.push({ role: 'user', content: images.length > 0 ? userContent : userMsg });

        let toolLoops = 0;
        const MAX_TOOL_LOOPS = 3;

        while (toolLoops <= MAX_TOOL_LOOPS) {
            const body = buildRequestBody(s, systemPrompt, userMsg, images, false);
            // Override messages with the accumulated multi-turn history
            if (s.apiFormat === 'openai' || s.apiFormat === 'google' || s.apiFormat === 'anthropic') {
                body.messages = messages;
            }
            // buildRequestBody may have added tools on its own; strip them so we only add on first loop.
            delete body.tools;
            // Only include tools on the first request; omit on follow-ups after tool calls
            if (s.webSearchEnabled && toolLoops === 0) {
                if (s.apiFormat !== 'google') body.tools = buildWebSearchTool(s.apiFormat);
                else body.tools = buildWebSearchTool('google');
            }
            window.xdAnswers.lastRequestBody = body;

            const response = await window.xdAnswers.makeRequest({
                url: buildNonStreamUrl(s), method: 'POST', headers: buildHeaders(s), data: JSON.stringify(body)
            });

            const parsed = JSON.parse(response.data);

            // Check for tool calls (OpenAI)
            if (s.apiFormat === 'openai') {
                const msg = parsed.choices[0].message;
                if (msg.tool_calls && msg.tool_calls.length > 0 && toolLoops < MAX_TOOL_LOOPS) {
                    toolLoops++;
                    // Sanitize assistant message to only standard fields
                    messages.push({
                        role: 'assistant',
                        content: msg.content || '',
                        tool_calls: msg.tool_calls.map(tc => ({
                            id: tc.id,
                            type: 'function',
                            function: { name: tc.function.name, arguments: tc.function.arguments }
                        }))
                    });
                    for (const tc of msg.tool_calls) {
                        try {
                            const args = JSON.parse(tc.function.arguments || '{}');
                            const query = args.query || '';
                            const numResults = args.num_results || 5;
                            const resultJson = query ? await executeSearch(query, numResults, args.source || null) : JSON.stringify({ error: 'Empty query' });
                            messages.push({ role: 'tool', tool_call_id: tc.id, content: resultJson });
                        } catch (err) {
                            messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: err.message }) });
                        }
                    }
                    continue; // re-call with tool results
                }
                return msg.content;
            }

            // Check for tool calls (Anthropic)
            if (s.apiFormat === 'anthropic') {
                const hasToolUse = parsed.content?.some(b => b.type === 'tool_use');
                if (hasToolUse && parsed.stop_reason === 'tool_use' && toolLoops < MAX_TOOL_LOOPS) {
                    toolLoops++;
                    messages.push({ role: 'assistant', content: parsed.content });
                    const toolResultBlocks = [];
                    for (const block of parsed.content) {
                        if (block.type === 'tool_use') {
                            try {
                                const query = block.input?.query || '';
                                const numResults = block.input?.num_results || 5;
                                const source = block.input?.source || null;
                                const resultJson = query ? await executeSearch(query, numResults, source) : JSON.stringify({ error: 'Empty query' });
                                toolResultBlocks.push({ type: 'tool_result', tool_use_id: block.id, content: resultJson });
                            } catch (err) {
                                toolResultBlocks.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: err.message }) });
                            }
                        }
                    }
                    messages.push({ role: 'user', content: toolResultBlocks });
                    continue;
                }
                const tb = parsed.content.find(b => b.type === 'text');
                return tb ? tb.text : '';
            }

            // Google: check for functionCall in response
            if (s.apiFormat === 'google') {
                const parts = parsed.candidates?.[0]?.content?.parts || [];
                const funcCall = parts.find(p => p.functionCall);
                if (funcCall && toolLoops < MAX_TOOL_LOOPS) {
                    toolLoops++;
                    // Add assistant's function call to conversation
                    const assistantParts = parts.map(p => {
                        if (p.functionCall) return { functionCall: p.functionCall };
                        return p;
                    });
                    // Google requires functionResponse in the next turn
                    const functionResponses = [];
                    for (const p of parts) {
                        if (p.functionCall) {
                            try {
                                const query = p.functionCall.args?.query || '';
                                const numResults = p.functionCall.args?.num_results || 5;
                                const source = p.functionCall.args?.source || null;
                                const resultJson = query ? await executeSearch(query, numResults, source) : JSON.stringify({ error: 'Empty query' });
                                functionResponses.push({ functionResponse: { name: p.functionCall.name, response: JSON.parse(resultJson) } });
                            } catch (err) {
                                functionResponses.push({ functionResponse: { name: p.functionCall.name, response: { error: err.message } } });
                            }
                        }
                    }
                    // Rebuild contents with both turns
                    const newContents = body.contents || [];
                    newContents.push({ role: 'model', parts: assistantParts });
                    newContents.push({ role: 'user', parts: functionResponses });
                    body.contents = newContents;
                    // Re-request
                    const resp2 = await window.xdAnswers.makeRequest({
                        url: buildNonStreamUrl(s), method: 'POST', headers: buildHeaders(s), data: JSON.stringify(body)
                    });
                    const parsed2 = JSON.parse(resp2.data);
                    return parsed2.candidates?.[0]?.content?.parts?.[0]?.text || '';
                }
                return parts[0]?.text || '';
            }

            throw new Error('Unknown API format');
        }

        // Fallback after max loops — just return whatever we have
        const lastParsed = JSON.parse((await window.xdAnswers.makeRequest({
            url: buildNonStreamUrl(s), method: 'POST', headers: buildHeaders(s), data: JSON.stringify(buildRequestBody(s, systemPrompt, userMsg, images, false))
        })).data);
        if (s.apiFormat === 'openai') return lastParsed.choices[0].message.content;
        if (s.apiFormat === 'anthropic') { const tb = lastParsed.content?.find(b => b.type === 'text'); return tb?.text || ''; }
        if (s.apiFormat === 'google') return lastParsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return '';
    };
})();
