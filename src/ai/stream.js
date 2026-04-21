(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    function parseSSEChunks(rawText, apiFormat) {
        const results = [];
        const lines = rawText.split('\n');

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') { results.push({ done: true }); continue; }

            try {
                const json = JSON.parse(data);

                if (apiFormat === 'openai') {
                    const choice = json.choices?.[0];
                    if (!choice) continue;
                    // Tool call finish — stop streaming, hand off to tool loop
                    if (choice.finish_reason === 'tool_calls') {
                        // Emit any remaining tool_calls delta in this chunk
                        const delta = choice.delta || {};
                        if (delta.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                results.push({ tool_call_delta: { index: tc.index, id: tc.id || undefined, name: tc.function?.name || undefined, argsDelta: tc.function?.arguments || '' } });
                            }
                        }
                        results.push({ tool_call_stop: true });
                        continue;
                    }
                    if (choice.finish_reason) { results.push({ done: true }); continue; }
                    const delta = choice.delta || {};
                    if (delta.reasoning_content) {
                        results.push({ thinking: delta.reasoning_content });
                    } else if (delta.tool_calls) {
                        // Streaming tool call deltas
                        for (const tc of delta.tool_calls) {
                            results.push({ tool_call_delta: { index: tc.index, id: tc.id || undefined, name: tc.function?.name || undefined, argsDelta: tc.function?.arguments || '' } });
                        }
                    } else if (delta.content) {
                        results.push({ content: delta.content });
                    }
                } else if (apiFormat === 'anthropic') {
                    if (json.type === 'content_block_start') {
                        const block = json.content_block;
                        if (block?.type === 'tool_use') {
                            results.push({ tool_call_start: { index: json.index || 0, id: block.id, name: block.name } });
                        }
                    } else if (json.type === 'content_block_delta') {
                        if (json.delta?.type === 'thinking_delta') results.push({ thinking: json.delta.thinking });
                        else if (json.delta?.type === 'text_delta') results.push({ content: json.delta.text });
                        else if (json.delta?.type === 'input_json_delta') results.push({ tool_call_args_delta: { index: json.index || 0, argsDelta: json.delta.partial_json || '' } });
                    } else if (json.type === 'message_delta') {
                        if (json.delta?.stop_reason === 'tool_use') {
                            results.push({ tool_call_stop: true });
                        } else if (json.delta?.stop_reason) {
                            results.push({ done: true });
                        }
                    } else if (json.type === 'message_stop') {
                        // Only emit done if we didn't already emit tool_call_stop
                        // (Anthropic may send message_stop after message_delta with stop_reason)
                        // We handle this by checking if the last event was tool_call_stop
                        if (!results.some(r => r.tool_call_stop)) {
                            results.push({ done: true });
                        }
                    }
                } else if (apiFormat === 'google') {
                    // Google tool calls come as functionCall in parts, non-streaming
                    const parts = json.candidates?.[0]?.content?.parts || [];
                    for (const part of parts) {
                        if (part.functionCall) {
                            results.push({ tool_call_complete: { name: part.functionCall.name, args: part.functionCall.args || {} } });
                        }
                        if (part.text) results.push({ content: part.text });
                    }
                    if (json.candidates?.[0]?.finishReason === 'STOP') results.push({ done: true });
                }
            } catch (e) { /* partial JSON chunk, skip */ }
        }
        return results;
    }

    window.xdAnswers._internal.parseSSEChunks = parseSSEChunks;
})();
