// src/ai/stream-answer.js
// Streaming answer pipeline. Extracted from legacy utils.js (lines 759-1107).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    window.xdAnswers.streamAnswer = function(questionData, outerStartTime, overrides) {
        return new Promise((resolve, reject) => {
            const I = window.xdAnswers._internal;
            const getEffectiveSettings = I.getEffectiveSettings;
            const buildMessages = I.buildMessages;
            const buildRequestBody = I.buildRequestBody;
            const buildWebSearchTool = I.buildWebSearchTool;
            const buildStreamUrl = I.buildStreamUrl;
            const buildHeaders = I.buildHeaders;
            const parseSSEChunks = I.parseSSEChunks;
            const executeSearch = I.executeSearch;
            const escapeHTML = I.escapeHTML;
            const parsePartialLabeled = I.parsePartialLabeled;
            const salvagePartialJSON = I.salvagePartialJSON;
            const renderPartial = I.renderPartial;
            const toggleThinkingContent = I.toggleThinkingContent;

            const s = (overrides && overrides.effectiveSettings) || getEffectiveSettings(window.xdAnswers.settings);
            const { systemPrompt, userMsg } = buildMessages(questionData, overrides && overrides.showAnswerOnly);
            const images = questionData.base64Images || [];

            // Build initial messages array for multi-turn tool-call support
            const messages = [];
            if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
            const userContent = [{ type: 'text', text: userMsg }];
            images.forEach(img => userContent.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + img } }));
            messages.push({ role: 'user', content: images.length > 0 ? userContent : userMsg });

            const initialBody = buildRequestBody(s, systemPrompt, userMsg, images, true);
            window.xdAnswers.lastRequestBody = initialBody;

            let fullContent = '';
            let fullThinking = '';
            let lastHighlightedAnswer = '';
            const startTime = outerStartTime || Date.now();
            const contentDiv = (overrides && overrides.contentDiv) || window.xdAnswers.answerContentDiv;
            let thinkingStarted = false;
            let thinkingDone = false;
            let streamTimerInterval = null;
            let statusCleared = false;
            let toolLoopDepth = 0;
            const MAX_TOOL_LOOPS = 3;

            // Search indicator state
            let searchCalls = []; // [{query, status:'searching'|'done', resultCount}]

            // Tool call accumulation state (per stream round)
            let pendingToolCalls = {}; // {index: {id, name, args:''}}

            function getElapsed() {
                const sec = Math.floor((Date.now() - startTime) / 1000);
                return sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's';
            }

            // Single timer that always updates footer + thinking timer (stops thinking timer when thinking ends)
            function startStreamTimer() {
                if (streamTimerInterval) return;
                streamTimerInterval = setInterval(() => {
                    const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
                    if (footerElapsed) footerElapsed.textContent = '⏱ ' + getElapsed();
                    // Only update thinking timer while thinking is still in progress
                    if (!thinkingDone) {
                        const thinkingTimer = contentDiv?.querySelector('.xd-thinking-timer');
                        if (thinkingTimer) thinkingTimer.textContent = '(' + getElapsed() + ')';
                    }
                }, 1000);
            }

            function stopStreamTimer() {
                if (streamTimerInterval) { clearInterval(streamTimerInterval); streamTimerInterval = null; }
            }

            function clearStatus() {
                if (statusCleared) return;
                statusCleared = true;
                if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
                const status = contentDiv?.querySelector('.xd-status');
                const loader = contentDiv?.querySelector('.xd-loader');
                if (status) status.remove();
                if (loader) loader.remove();
                // Start persistent stream timer when status is cleared
                 startStreamTimer();
            }

            function ensureThinkingUI() {
                if (thinkingStarted || !contentDiv) return;
                clearStatus();
                thinkingStarted = true;
                contentDiv.innerHTML =
                    '<div class="xd-thinking">' +
                    '<div class="xd-thinking-header" style="cursor:pointer;">💭 Thinking... <span class="xd-thinking-timer">(0s)</span> <span class="xd-thinking-chars"></span> <span class="xd-thinking-toggle">▼</span></div>' +
                    '<div class="xd-thinking-content" style="display:none !important;"></div>' +
                    '</div>';
                const header = contentDiv.querySelector('.xd-thinking-header');
                header.addEventListener('click', function() { toggleThinkingContent(this); });
            }

            function updateStreamUI() {
                if (!contentDiv) return;
                clearStatus();

                const elapsed = getElapsed();
                let html = '';

                // Thinking block always first (at the top)
                if (thinkingStarted) {
                    html += '<div class="xd-thinking">' +
                        '<div class="xd-thinking-header" style="cursor:pointer;">💭 Thinking <span class="xd-thinking-timer">(' + elapsed + ')</span> <span class="xd-thinking-chars">(' + fullThinking.length + ' chars)</span> <span class="xd-thinking-toggle">▼</span></div>' +
                        '<div class="xd-thinking-content" style="display:none !important;">' + window.xdAnswers.renderMarkdown(fullThinking) + '</div></div>';
                }

                // Search indicator block between thinking and answer
                if (searchCalls.length > 0) {
                    const doneCount = searchCalls.filter(sc => sc.status === 'done').length;
                    const searchingCount = searchCalls.length - doneCount;
                    const headerLabel = searchingCount > 0
                        ? '🔍 Web Search... <span class="xd-search-count">(' + searchCalls.length + ')</span>'
                        : '🔍 Web Search <span class="xd-search-count">(' + doneCount + ')</span>';
                    html += '<div class="xd-search-block">' +
                        '<div class="xd-search-header" style="cursor:pointer;">' + headerLabel + ' <span class="xd-search-toggle">▼</span></div>' +
                        '<div class="xd-search-content" style="display:none !important;">';
                    for (let i = 0; i < searchCalls.length; i++) {
                        const sc = searchCalls[i];
                        if (sc.status === 'searching') {
                            html += '<div class="xd-search-entry" data-xd-search-idx="' + i + '">⏳ <span class="xd-searching-query">' + escapeHTML(sc.query) + '</span></div>';
                        } else {
                            html += '<div class="xd-search-entry" data-xd-search-idx="' + i + '">✓ <span class="xd-searching-query">' + escapeHTML(sc.query) + '</span> <span class="xd-searching-count">(' + sc.resultCount + ' results)</span></div>';
                        }
                    }
                    html += '</div></div>';
                }

                const parsed = parsePartialLabeled(fullContent) || salvagePartialJSON(fullContent);

                if (parsed && parsed.answer && parsed.answer !== lastHighlightedAnswer) {
                    lastHighlightedAnswer = parsed.answer;
                    I.highlightCorrectAnswer(parsed.answer);
                }

                if (parsed) {
                    html += renderPartial(parsed);
                } else if (fullContent.trim()) {
                    html += '<div class="xd-answer xd-answer-partial">' + window.xdAnswers.renderMarkdown(fullContent) + '</div>';
                } else if (searchCalls.some(sc => sc.status === 'searching')) {
                    html += '<div class="xd-waiting">⏳ Executing web search...</div>';
                } else {
                    html += '<div class="xd-waiting">⏳ Waiting for answer...</div>';
                }

                contentDiv.innerHTML = html;
                const th = contentDiv.querySelector('.xd-thinking-header');
                if (th) th.addEventListener('click', function() { toggleThinkingContent(this); });
                const sh = contentDiv.querySelector('.xd-search-header');
                if (sh) sh.addEventListener('click', function() {
                    const content = this.nextElementSibling;
                    if (!content) return;
                    const toggle = this.querySelector('.xd-search-toggle');
                    const isHidden = content.style.display === 'none' || getComputedStyle(content).display === 'none';
                    content.style.setProperty('display', isHidden ? 'block' : 'none', 'important');
                    if (toggle) toggle.textContent = isHidden ? '▲' : '▼';
                });
            }

            // Execute pending tool calls and continue streaming
            async function handleToolCalls() {
                const toolCalls = Object.values(pendingToolCalls);
                if (toolCalls.length === 0) { finishStream(); return; }

                toolLoopDepth++;
                console.log('[xdAnswers] Tool call detected (depth=' + toolLoopDepth + '):', toolCalls.map(tc => tc.name + '(' + tc.args.slice(0, 100) + ')').join(', '));
                if (toolLoopDepth > MAX_TOOL_LOOPS) {
                    console.warn('[xdAnswers] Max tool loop depth reached, stopping');
                    fullContent += '\n\n[Web search limit reached — skipping further searches]';
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
                    const assistantMsg = {
                        role: 'assistant',
                        content: '',
                        tool_calls: toolCalls.map(tc => ({
                            id: tc.id || ('call_' + Date.now()),
                            type: 'function',
                            function: { name: tc.name, arguments: tc.args }
                        }))
                    };
                    messages.push(assistantMsg);

                    // Execute each tool call and add tool results
                    for (const tc of toolCalls) {
                        try {
                            let args = {};
                            try { args = JSON.parse(tc.args); } catch {}
                            const query = args.query || args.q || '';
                            const numResults = args.num_results || args.num || 5;
                            if (!query) throw new Error('Empty query');

                            searchCalls.push({ query, status: 'searching', resultCount: 0 });
                            updateStreamUI();

                            const resultJson = await executeSearch(query, numResults);
                            const resultObj = JSON.parse(resultJson);
                            const count = resultObj.organic?.length || 0;
                            searchCalls[searchCalls.length - 1].status = 'done';
                            searchCalls[searchCalls.length - 1].resultCount = count;
                            updateStreamUI();

                            messages.push({ role: 'tool', tool_call_id: assistantMsg.tool_calls.find(t => t.function.name === tc.name)?.id || tc.id, content: resultJson });
                        } catch (err) {
                            searchCalls[searchCalls.length - 1].status = 'done';
                            searchCalls[searchCalls.length - 1].resultCount = 0;
                            updateStreamUI();
                            messages.push({ role: 'tool', tool_call_id: assistantMsg.tool_calls.find(t => t.function.name === tc.name)?.id || tc.id, content: JSON.stringify({ error: err.message }) });
                        }
                    }
                } else if (s.apiFormat === 'anthropic') {
                    // Build assistant content blocks
                    const assistantBlocks = [];
                    if (fullThinking) {
                        // Don't include thinking blocks — they're not part of the API message schema
                    }
                    if (fullContent) {
                        assistantBlocks.push({ type: 'text', text: fullContent });
                    }
                    for (const tc of toolCalls) {
                        assistantBlocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: {} });
                        try { tc._parsedInput = JSON.parse(tc.args || '{}'); } catch { tc._parsedInput = {}; }
                        assistantBlocks[assistantBlocks.length - 1].input = tc._parsedInput;
                    }
                    messages.push({ role: 'assistant', content: assistantBlocks });

                    // Execute and add tool_result
                    const toolResultBlocks = [];
                    for (const tc of toolCalls) {
                        try {
                            const args = tc._parsedInput || {};
                            const query = args.query || '';
                            const numResults = args.num_results || 5;
                            if (!query) throw new Error('Empty query');

                            searchCalls.push({ query, status: 'searching', resultCount: 0 });
                            updateStreamUI();

                            const resultJson = await executeSearch(query, numResults);
                            const resultObj = JSON.parse(resultJson);
                            const count = resultObj.organic?.length || 0;
                            searchCalls[searchCalls.length - 1].status = 'done';
                            searchCalls[searchCalls.length - 1].resultCount = count;
                            updateStreamUI();

                            toolResultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: resultJson });
                        } catch (err) {
                            searchCalls[searchCalls.length - 1].status = 'done';
                            searchCalls[searchCalls.length - 1].resultCount = 0;
                            updateStreamUI();
                            toolResultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify({ error: err.message }) });
                        }
                    }
                    messages.push({ role: 'user', content: toolResultBlocks });
                }

                // Reset per-round state for the next stream
                pendingToolCalls = {};
                fullContent = '';
                fullThinking = '';
                thinkingStarted = false;
                thinkingDone = false;

                // Re-stream with updated messages
                startStreamRound(messages);
            }

            function finishStream() {
                stopStreamTimer();
                resolve({ content: fullContent, thinking: fullThinking, searchCalls });
            }

            function startStreamRound(currentMessages) {
                // Build the request body from the current message history
                const body = Object.assign({}, initialBody);
                body.messages = currentMessages;
                // Remove any stale tools from initialBody copy before conditionally adding fresh ones.
                // Some gateways reject follow-up requests that still include the tools array.
                delete body.tools;
                // Only include tools on the first stream round; omit after tool calls to avoid 400 errors on some gateways
                if (s.webSearchEnabled && s.apiFormat !== 'google' && toolLoopDepth === 0) {
                    body.tools = buildWebSearchTool(s.apiFormat);
                }
                window.xdAnswers.lastRequestBody = body;

                const cancel = window.xdAnswers.streamRequest(
                    { url: buildStreamUrl(s), method: 'POST', headers: buildHeaders(s), data: JSON.stringify(body) },
                    (chunk) => {
                        const events = parseSSEChunks(chunk, s.apiFormat);
                        for (const ev of events) {
                            if (ev.thinking) {
                                ensureThinkingUI();
                                fullThinking += ev.thinking;
                                const tc = contentDiv?.querySelector('.xd-thinking-content');
                                if (tc) tc.innerHTML = window.xdAnswers.renderMarkdown(fullThinking);
                                const chars = contentDiv?.querySelector('.xd-thinking-chars');
                                if (chars) chars.textContent = '(' + fullThinking.length + ' chars)';
                            }
                            if (ev.content) {
                                if (thinkingStarted && !thinkingDone) thinkingDone = true;
                                fullContent += ev.content;
                                updateStreamUI();
                            }
                            // Tool call events
                            if (ev.tool_call_start) {
                                const tcs = ev.tool_call_start;
                                pendingToolCalls[tcs.index] = { id: tcs.id, name: tcs.name, args: '' };
                            }
                            if (ev.tool_call_delta) {
                                const tcd = ev.tool_call_delta;
                                if (!pendingToolCalls[tcd.index]) {
                                    pendingToolCalls[tcd.index] = { id: tcd.id || '', name: tcd.name || '', args: '' };
                                }
                                if (tcd.id) pendingToolCalls[tcd.index].id = tcd.id;
                                if (tcd.name) pendingToolCalls[tcd.index].name = tcd.name;
                                if (tcd.argsDelta) pendingToolCalls[tcd.index].args += tcd.argsDelta;

                                // Show searching indicator as soon as we have a query
                                try {
                                    const partial = JSON.parse(pendingToolCalls[tcd.index].args);
                                    if (partial.query && !searchCalls.some(sc => sc.query === partial.query)) {
                                        searchCalls.push({ query: partial.query, status: 'searching', resultCount: 0 });
                                        updateStreamUI();
                                    }
                                } catch {} // partial JSON, will update later
                            }
                            if (ev.tool_call_args_delta) {
                                const tcad = ev.tool_call_args_delta;
                                if (!pendingToolCalls[tcad.index] && tcad.name) {
                                    pendingToolCalls[tcad.index] = { id: tcad.id || '', name: tcad.name, args: '' };
                                }
                                if (pendingToolCalls[tcad.index]) {
                                    pendingToolCalls[tcad.index].args += tcad.argsDelta;
                                    // Try to show searching indicator for partial args
                                    try {
                                        const partial = JSON.parse(pendingToolCalls[tcad.index].args);
                                        if (partial.query && !searchCalls.some(sc => sc.query === partial.query)) {
                                            searchCalls.push({ query: partial.query, status: 'searching', resultCount: 0 });
                                            updateStreamUI();
                                        }
                                    } catch {}
                                }
                            }
                            if (ev.tool_call_stop) {
                                // Tool call finished — execute and continue
                                handleToolCalls();
                                return; // stop processing this chunk, handleToolCalls will start new stream
                            }
                            // Google non-streaming tool call (already complete)
                            if (ev.tool_call_complete) {
                                const tcc = ev.tool_call_complete;
                                const idx = Object.keys(pendingToolCalls).length;
                                pendingToolCalls[idx] = { id: 'google_tc_' + idx, name: tcc.name, args: JSON.stringify(tcc.args || {}) };
                            }
                        }
                    },
                    () => {
                        // Stream done normally (no tool calls)
                        finishStream();
                    },
                    (error, details) => {
                        stopStreamTimer();
                        reject(new Error(error + (details ? '\n' + details : '')));
                    }
                );

                window.xdAnswers._cancelStream = cancel;
            }

            // Start the first stream round
            startStreamRound(messages);
        });
    };
})();
