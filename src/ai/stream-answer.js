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
            let isHandlingToolCalls = false;

            // Search indicator state
            let searchCalls = []; // [{query, status:'searching'|'done', resultCount, round, toolIndex}]
            // Calculator indicator state
            let calcCalls = []; // [{expression, status:'calculating'|'done', result, round, toolIndex}]

            // Tool call accumulation state (per stream round)
            let pendingToolCalls = {}; // {index: {index, id, name, args:''}}

            function setToolStreamingIndicator(toolIndex, name, argsStr) {
                const isCalc = I.isCalculatorToolName && I.isCalculatorToolName(name);
                let args = {};
                try { args = JSON.parse(argsStr); } catch {}

                if (isCalc) {
                    const expr = args.expression || args.expr || args.formula || args.query || args.input || '';
                    if (!expr) return;
                    let entry = calcCalls.find(c => c.round === toolLoopDepth && c.toolIndex === toolIndex);
                    if (!entry) {
                        entry = { round: toolLoopDepth, toolIndex, expression: expr, status: 'calculating' };
                        calcCalls.push(entry);
                    } else {
                        entry.expression = expr;
                        entry.status = 'calculating';
                    }
                    updateStreamUI();
                } else {
                    const query = args.query || args.q || '';
                    if (!query) return;
                    let entry = searchCalls.find(sc => sc.round === toolLoopDepth && sc.toolIndex === toolIndex);
                    if (!entry) {
                        entry = { round: toolLoopDepth, toolIndex, query, status: 'searching', resultCount: 0 };
                        searchCalls.push(entry);
                    } else {
                        entry.query = query;
                        entry.status = 'searching';
                    }
                    updateStreamUI();
                }
            }

            function getElapsed() {
                const sec = Math.floor((Date.now() - startTime) / 1000);
                return sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's';
            }

            // Single timer that always updates footer + thinking timer (stops thinking timer when thinking ends)
            function startStreamTimer() {
                if (streamTimerInterval) return;
                streamTimerInterval = setInterval(() => {
                    const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
                    if (footerElapsed) footerElapsed.innerHTML = '<span class="xd-icon" style="font-size:13px !important;vertical-align:middle;margin-right:2px;">schedule</span> ' + getElapsed();
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

            // Track inline thinking (<think>...</think> or prose reasoning like "The user is asking...")
            let inInlineThinking = false;
            let rawContentBuffer = '';

            const PROSE_THINKING_ANYWHERE_REGEX = /(?:^|\n)\s*(?:Here's a thinking process|Thinking Process:|Thinking:|The user (?:is asking|asks|wants|is trying)|I need to (?:select|choose|find|determine|identify)|Let's think|First, let's|Let's analyze|We need to (?:answer|find|determine|identify|select|choose))/i;
            const PROSE_TRANSITION_REGEX = /\n(?:\s*---|(?:\*{0,2}(?:Answer|Final Answer|Correct Answer|Відповідь|Ответ|Summary)\*{0,2}\s*:)|(?:\{[\s\r\n]*"answer")|(?:\*{0,2}(?:Therefore|Thus|So),?\s*(?:the\s+)?(?:correct\s+)?(?:answer|option)\s+(?:is|=)\*{0,2}\s*:?)|(?:Conclusion\s*:)|(?:The\s+correct\s+option\s+is\s*:?))/i;

            function checkAndExtractInlineThinking(newText) {
                rawContentBuffer += newText;

                // 1. Tag based: <think>...</think>
                if (!inInlineThinking && rawContentBuffer.includes('<think>')) {
                    const parts = rawContentBuffer.split('<think>');
                    const before = parts[0];
                    rawContentBuffer = '<think>' + parts.slice(1).join('<think>');
                    inInlineThinking = true;
                    ensureThinkingUI();
                    if (before) {
                        fullContent += before;
                    }
                }

                // 2. Prose header based (e.g. Qwen / Deepseek / Llama without tags):
                if (!inInlineThinking) {
                    if (fullContent.length === 0) {
                        // At stream beginning, hold buffer if it could be start of prose thinking header
                        if (rawContentBuffer.length < 30) {
                            const prefix = rawContentBuffer.trimStart();
                            const possiblePrefixes = ["here", "thinking", "the", "i need", "let", "first", "we need"];
                            const isCandidate = possiblePrefixes.some(p => p.startsWith(prefix.toLowerCase()) || prefix.toLowerCase().startsWith(p));
                            if (isCandidate) {
                                return; // hold buffer for more chunks
                            }
                        }
                    }

                    const anywhereMatch = rawContentBuffer.match(PROSE_THINKING_ANYWHERE_REGEX);
                    if (anywhereMatch) {
                        const matchIndex = anywhereMatch.index;
                        const before = rawContentBuffer.slice(0, matchIndex);
                        rawContentBuffer = rawContentBuffer.slice(matchIndex).replace(/^\n\s*/, '');
                        inInlineThinking = true;
                        ensureThinkingUI();
                        if (before) {
                            fullContent += before;
                        }
                    }
                }

                if (inInlineThinking) {
                    // Check for close of thinking
                    // Check </think>
                    const closeIndex = rawContentBuffer.indexOf('</think>');
                    if (closeIndex !== -1) {
                        const thinkPart = rawContentBuffer.slice(0, closeIndex).replace(/^<think>/i, '');
                        fullThinking = thinkPart;
                        rawContentBuffer = rawContentBuffer.slice(closeIndex + 8);
                        inInlineThinking = false;
                        thinkingDone = true;
                        if (rawContentBuffer) {
                            fullContent += rawContentBuffer;
                            rawContentBuffer = '';
                        }
                    } else if (!rawContentBuffer.startsWith('<think>')) {
                        // Check prose transition like "---", "**Answer:**", "\nAnswer:", "FINAL_ANSWER:", JSON start "{" or labeled answer "Answer:" / "Відповідь:" / "Option A"
                        // Note: do NOT match option letters during thinking like "Options:\nA: ... B: ..."
                        const transitionMatch = rawContentBuffer.search(PROSE_TRANSITION_REGEX);
                        if (transitionMatch !== -1) {
                            const thinkPart = rawContentBuffer.slice(0, transitionMatch);
                            fullThinking = thinkPart;
                            rawContentBuffer = rawContentBuffer.slice(transitionMatch + 1);
                            inInlineThinking = false;
                            thinkingDone = true;
                            if (rawContentBuffer) {
                                fullContent += rawContentBuffer;
                                rawContentBuffer = '';
                            }
                        } else {
                            // Still streaming prose thinking - push into fullThinking incrementally
                            fullThinking = rawContentBuffer;
                        }
                    } else {
                        // Still in <think> tags
                        fullThinking = rawContentBuffer.replace(/^<think>/i, '');
                    }

                    if (fullThinking) {
                        ensureThinkingUI();
                    }
                    // During prose thinking, don't display rawContentBuffer in the answer section
                    updateStreamUI();
                    return;
                }

                // Normal content flow
                if (thinkingStarted && !thinkingDone) thinkingDone = true;
                fullContent += rawContentBuffer;
                rawContentBuffer = '';
                updateStreamUI();
            }

            let isThinkingExpanded = false;
            let isSearchExpanded = false;
            let isCalcExpanded = false;

            function ensureThinkingUI() {
                if (thinkingStarted || !contentDiv) return;
                clearStatus();
                thinkingStarted = true;
                const displayStyle = isThinkingExpanded ? 'block' : 'none';
                const toggleIcon = isThinkingExpanded 
                    ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                    : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
                contentDiv.innerHTML =
                    '<div class="xd-thinking">' +
                    '<div class="xd-thinking-header" style="cursor:pointer;"><span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">psychology</span> Thinking... <span class="xd-thinking-timer">(0s)</span> <span class="xd-thinking-chars"></span> <span class="xd-thinking-toggle">' + toggleIcon + '</span></div>' +
                    '<div class="xd-thinking-content" style="display:' + displayStyle + ' !important;"></div>' +
                    '</div>';
                const header = contentDiv.querySelector('.xd-thinking-header');
                header.addEventListener('click', function() {
                    isThinkingExpanded = !isThinkingExpanded;
                    toggleThinkingContent(this);
                });
            }

            function updateStreamUI() {
                if (!contentDiv) return;
                clearStatus();

                const elapsed = getElapsed();
                let html = '';

                // Thinking block always first (at the top)
                if (thinkingStarted) {
                    const displayStyle = isThinkingExpanded ? 'block' : 'none';
                    const toggleIcon = isThinkingExpanded 
                        ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                        : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
                    html += '<div class="xd-thinking">' +
                        '<div class="xd-thinking-header" style="cursor:pointer;"><span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">psychology</span> Thinking <span class="xd-thinking-timer">(' + elapsed + ')</span> <span class="xd-thinking-chars">(' + fullThinking.length + ' chars)</span> <span class="xd-thinking-toggle">' + toggleIcon + '</span></div>' +
                        '<div class="xd-thinking-content" style="display:' + displayStyle + ' !important;">' + window.xdAnswers.renderMarkdown(fullThinking) + '</div></div>';
                }

                // Search indicator block between thinking and answer
                if (searchCalls.length > 0) {
                    const doneCount = searchCalls.filter(sc => sc.status === 'done').length;
                    const searchingCount = searchCalls.length - doneCount;
                    const headerLabel = searchingCount > 0
                        ? '<span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">travel_explore</span> Web Search... <span class="xd-search-count">(' + searchCalls.length + ')</span>'
                        : '<span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">travel_explore</span> Web Search <span class="xd-search-count">(' + doneCount + ')</span>';
                    const sDisplay = isSearchExpanded ? 'block' : 'none';
                    const sToggle = isSearchExpanded 
                        ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                        : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
                    html += '<div class="xd-search-block">' +
                        '<div class="xd-search-header" style="cursor:pointer;">' + headerLabel + ' <span class="xd-search-toggle">' + sToggle + '</span></div>' +
                        '<div class="xd-search-content" style="display:' + sDisplay + ' !important;">';
                    for (let i = 0; i < searchCalls.length; i++) {
                        const sc = searchCalls[i];
                        if (sc.status === 'searching') {
                            html += '<div class="xd-search-entry" data-xd-search-idx="' + i + '"><span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">hourglass_top</span> <span class="xd-searching-query">' + escapeHTML(sc.query) + '</span></div>';
                        } else {
                            html += '<div class="xd-search-entry" data-xd-search-idx="' + i + '"><span class="xd-icon" style="font-size:14px !important;color:#4ade80;vertical-align:middle;margin-right:2px;">check</span> <span class="xd-searching-query">' + escapeHTML(sc.query) + '</span> <span class="xd-searching-count">(' + sc.resultCount + ' results)</span></div>';
                        }
                    }
                    html += '</div></div>';
                }

                // Calculator indicator block
                if (calcCalls.length > 0) {
                    const doneCount = calcCalls.filter(c => c.status === 'done').length;
                    const calculatingCount = calcCalls.length - doneCount;
                    const headerLabel = calculatingCount > 0
                        ? '<span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">calculate</span> Calculator... <span class="xd-calc-count">(' + calcCalls.length + ')</span>'
                        : '<span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">calculate</span> Calculator <span class="xd-calc-count">(' + doneCount + ')</span>';
                    const cDisplay = isCalcExpanded ? 'block' : 'none';
                    const cToggle = isCalcExpanded 
                        ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                        : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
                    html += '<div class="xd-calc-block">' +
                        '<div class="xd-calc-header" style="cursor:pointer;">' + headerLabel + ' <span class="xd-calc-toggle">' + cToggle + '</span></div>' +
                        '<div class="xd-calc-content" style="display:' + cDisplay + ' !important;">';
                    for (let i = 0; i < calcCalls.length; i++) {
                        const cc = calcCalls[i];
                        if (cc.status === 'calculating') {
                            html += '<div class="xd-calc-entry"><span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">hourglass_top</span> <span class="xd-calc-expr">' + escapeHTML(cc.expression || '...') + '</span></div>';
                        } else {
                            const resText = cc.result !== undefined ? ' = ' + escapeHTML(String(cc.result)) : '';
                            html += '<div class="xd-calc-entry"><span class="xd-icon" style="font-size:14px !important;color:#38bdf8;vertical-align:middle;margin-right:2px;">check</span> <span class="xd-calc-expr">' + escapeHTML(cc.expression) + '</span><strong class="xd-calc-result">' + resText + '</strong></div>';
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
                    html += '<div class="xd-waiting"><span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">travel_explore</span> Executing web search...</div>';
                } else if (calcCalls.some(c => c.status === 'calculating')) {
                    html += '<div class="xd-waiting"><span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">calculate</span> Calculating math expression...</div>';
                } else {
                    html += '<div class="xd-waiting"><span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">hourglass_empty</span> Waiting for answer...</div>';
                }

                contentDiv.innerHTML = html;
                const th = contentDiv.querySelector('.xd-thinking-header');
                if (th) th.addEventListener('click', function() {
                    isThinkingExpanded = !isThinkingExpanded;
                    toggleThinkingContent(this);
                });
                const sh = contentDiv.querySelector('.xd-search-header');
                if (sh) sh.addEventListener('click', function() {
                    isSearchExpanded = !isSearchExpanded;
                    const content = this.nextElementSibling;
                    if (!content) return;
                    const toggle = this.querySelector('.xd-search-toggle');
                    content.style.setProperty('display', isSearchExpanded ? 'block' : 'none', 'important');
                    if (toggle) toggle.innerHTML = isSearchExpanded 
                        ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                        : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
                });
                const ch = contentDiv.querySelector('.xd-calc-header');
                if (ch) ch.addEventListener('click', function() {
                    isCalcExpanded = !isCalcExpanded;
                    const content = this.nextElementSibling;
                    if (!content) return;
                    const toggle = this.querySelector('.xd-calc-toggle');
                    content.style.setProperty('display', isCalcExpanded ? 'block' : 'none', 'important');
                    if (toggle) toggle.innerHTML = isCalcExpanded 
                        ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                        : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
                });
            }

            // Execute pending tool calls and continue streaming
            async function handleToolCalls() {
                if (isHandlingToolCalls) return;
                isHandlingToolCalls = true;

                const toolCalls = Object.values(pendingToolCalls);
                if (toolCalls.length === 0) {
                    isHandlingToolCalls = false;
                    finishStream();
                    return;
                }

                toolLoopDepth++;
                console.log('[xdAnswers] Tool call detected (depth=' + toolLoopDepth + '):', toolCalls.map(tc => tc.name + '(' + tc.args.slice(0, 100) + ')').join(', '));
                if (toolLoopDepth > MAX_TOOL_LOOPS) {
                    console.warn('[xdAnswers] Max tool loop depth reached, stopping');
                    fullContent += '\n\n[Web search limit reached — skipping further searches]';
                    isHandlingToolCalls = false;
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
                        content: fullContent || '',
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
                        let args = {};
                        try { args = JSON.parse(tc.args); } catch {}
                        const isCalc = I.isCalculatorToolName && I.isCalculatorToolName(tc.name);

                        if (isCalc) {
                            const expr = args.expression || args.expr || args.formula || args.query || args.input || '';
                            let ccEntry = calcCalls.find(c => c.round === (toolLoopDepth - 1) && c.toolIndex === tc.index);
                            if (!ccEntry && expr) {
                                ccEntry = calcCalls.find(c => c.expression === expr && c.status === 'calculating');
                            }
                            if (!ccEntry) {
                                ccEntry = { round: toolLoopDepth - 1, toolIndex: tc.index !== undefined ? tc.index : i, expression: expr || 'Math expression', status: 'calculating' };
                                calcCalls.push(ccEntry);
                            } else {
                                ccEntry.status = 'calculating';
                                if (expr) ccEntry.expression = expr;
                            }
                            updateStreamUI();

                            try {
                                const resultJson = I.executeCalculator(expr);
                                let resObj = {};
                                try { resObj = JSON.parse(resultJson); } catch {}
                                ccEntry.status = 'done';
                                ccEntry.result = resObj.result !== undefined ? resObj.result : (resObj.error || 'error');
                                updateStreamUI();

                                messages.push({ role: 'tool', tool_call_id: tc.id, content: resultJson });
                            } catch (err) {
                                ccEntry.status = 'done';
                                ccEntry.result = err.message;
                                updateStreamUI();
                                messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: err.message }) });
                            }
                        } else {
                            const query = args.query || args.q || '';
                            const numResults = args.num_results || args.num || 5;

                            let scEntry = searchCalls.find(sc => sc.round === (toolLoopDepth - 1) && sc.toolIndex === tc.index);
                            if (!scEntry && query) {
                                scEntry = searchCalls.find(sc => sc.query === query && sc.status === 'searching');
                            }
                            if (!scEntry) {
                                scEntry = { round: toolLoopDepth - 1, toolIndex: tc.index !== undefined ? tc.index : i, query: query || 'Web search', status: 'searching', resultCount: 0 };
                                searchCalls.push(scEntry);
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
                                messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: err.message }) });
                            }
                        }
                    }
                } else if (s.apiFormat === 'anthropic') {
                    // Build assistant content blocks
                    const assistantBlocks = [];
                    if (fullContent) {
                        assistantBlocks.push({ type: 'text', text: fullContent });
                    }
                    toolCalls.forEach((tc, idx) => {
                        if (!tc.id) tc.id = 'toolu_' + Date.now() + '_' + idx;
                        try { tc._parsedInput = JSON.parse(tc.args || '{}'); } catch { tc._parsedInput = {}; }
                        assistantBlocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc._parsedInput });
                    });
                    messages.push({ role: 'assistant', content: assistantBlocks });

                    // Execute and add tool_result
                    const toolResultBlocks = [];
                    for (let i = 0; i < toolCalls.length; i++) {
                        const tc = toolCalls[i];
                        const args = tc._parsedInput || {};
                        const isCalc = I.isCalculatorToolName && I.isCalculatorToolName(tc.name);

                        if (isCalc) {
                            const expr = args.expression || args.expr || args.formula || args.query || args.input || '';
                            let ccEntry = calcCalls.find(c => c.round === (toolLoopDepth - 1) && c.toolIndex === tc.index);
                            if (!ccEntry && expr) {
                                ccEntry = calcCalls.find(c => c.expression === expr && c.status === 'calculating');
                            }
                            if (!ccEntry) {
                                ccEntry = { round: toolLoopDepth - 1, toolIndex: tc.index !== undefined ? tc.index : i, expression: expr || 'Math expression', status: 'calculating' };
                                calcCalls.push(ccEntry);
                            } else {
                                ccEntry.status = 'calculating';
                                if (expr) ccEntry.expression = expr;
                            }
                            updateStreamUI();

                            try {
                                const resultJson = I.executeCalculator(expr);
                                let resObj = {};
                                try { resObj = JSON.parse(resultJson); } catch {}
                                ccEntry.status = 'done';
                                ccEntry.result = resObj.result !== undefined ? resObj.result : (resObj.error || 'error');
                                updateStreamUI();

                                toolResultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: resultJson });
                            } catch (err) {
                                ccEntry.status = 'done';
                                ccEntry.result = err.message;
                                updateStreamUI();
                                toolResultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify({ error: err.message }) });
                            }
                        } else {
                            const query = args.query || '';
                            const numResults = args.num_results || 5;

                            let scEntry = searchCalls.find(sc => sc.round === (toolLoopDepth - 1) && sc.toolIndex === tc.index);
                            if (!scEntry && query) {
                                scEntry = searchCalls.find(sc => sc.query === query && sc.status === 'searching');
                            }
                            if (!scEntry) {
                                scEntry = { round: toolLoopDepth - 1, toolIndex: tc.index !== undefined ? tc.index : i, query: query || 'Web search', status: 'searching', resultCount: 0 };
                                searchCalls.push(scEntry);
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
                                toolResultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify({ error: err.message }) });
                            }
                        }
                    }
                    messages.push({ role: 'user', content: toolResultBlocks });
                }

                // Ensure all indicators for this round are finalized
                searchCalls.forEach(sc => { if (sc.status === 'searching') sc.status = 'done'; });
                calcCalls.forEach(c => { if (c.status === 'calculating') c.status = 'done'; });
                updateStreamUI();

                // Reset per-round state for the next stream
                pendingToolCalls = {};
                fullContent = '';
                fullThinking = '';
                inInlineThinking = false;
                rawContentBuffer = '';
                thinkingStarted = false;
                thinkingDone = false;
                isHandlingToolCalls = false;

                // Re-stream with updated messages
                startStreamRound(messages);
            }

            function finishStream() {
                stopStreamTimer();
                // If stream ended while still in inline thinking buffer, inspect if it contains transition or is entirely thinking
                if (rawContentBuffer) {
                    if (inInlineThinking) {
                        const transitionMatch = rawContentBuffer.search(PROSE_TRANSITION_REGEX);
                        if (transitionMatch !== -1) {
                            fullThinking = rawContentBuffer.slice(0, transitionMatch).replace(/^<think>/i, '').trim();
                            fullContent += rawContentBuffer.slice(transitionMatch + 1).trim();
                        } else {
                            // Check if rawContentBuffer has any answer keywords or is purely thinking
                            const altMatch = rawContentBuffer.search(/(?:^|\n)\s*(?:(?:\*{0,2}Answer\*{0,2}\s*:)|(?:(?:Therefore|Thus|So),?\s*.*?(?:option|answer)\s*(?:is|=)\s*)|(?:Option\s+[A-D]))/i);
                            if (altMatch !== -1 && altMatch > 0) {
                                fullThinking = rawContentBuffer.slice(0, altMatch).replace(/^<think>/i, '').trim();
                                fullContent += rawContentBuffer.slice(altMatch).trim();
                            } else {
                                fullThinking = (fullThinking || rawContentBuffer).replace(/^<think>/i, '').replace(/<\/think>$/i, '').trim();
                            }
                        }
                    } else {
                        fullContent += rawContentBuffer;
                    }
                    rawContentBuffer = '';
                }
                resolve({ content: fullContent, thinking: fullThinking, searchCalls, calcCalls });
            }

            function startStreamRound(currentMessages) {
                // Build the request body from the current message history
                const body = Object.assign({}, initialBody);
                body.messages = currentMessages;
                // Remove any stale tools from initialBody copy before conditionally adding fresh ones.
                delete body.tools;
                // Include tools on stream rounds within MAX_TOOL_LOOPS limit
                if (toolLoopDepth < MAX_TOOL_LOOPS) {
                    const tools = I.buildTools ? I.buildTools(s, s.apiFormat) : [];
                    if (tools.length > 0 && s.apiFormat !== 'google') {
                        body.tools = tools;
                    }
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
                                checkAndExtractInlineThinking(ev.content);
                            }
                            // Tool call events
                            if (ev.tool_call_start) {
                                const tcs = ev.tool_call_start;
                                pendingToolCalls[tcs.index] = { index: tcs.index, id: tcs.id, name: tcs.name, args: '' };
                            }
                            if (ev.tool_call_delta) {
                                const tcd = ev.tool_call_delta;
                                if (!pendingToolCalls[tcd.index]) {
                                    pendingToolCalls[tcd.index] = { index: tcd.index, id: tcd.id || '', name: tcd.name || '', args: '' };
                                }
                                if (tcd.id) pendingToolCalls[tcd.index].id = tcd.id;
                                if (tcd.name) pendingToolCalls[tcd.index].name = tcd.name;
                                if (tcd.argsDelta) pendingToolCalls[tcd.index].args += tcd.argsDelta;

                                setToolStreamingIndicator(tcd.index, pendingToolCalls[tcd.index].name, pendingToolCalls[tcd.index].args);
                            }
                            if (ev.tool_call_args_delta) {
                                const tcad = ev.tool_call_args_delta;
                                if (!pendingToolCalls[tcad.index]) {
                                    pendingToolCalls[tcad.index] = { index: tcad.index, id: tcad.id || '', name: tcad.name || '', args: '' };
                                }
                                pendingToolCalls[tcad.index].args += tcad.argsDelta;
                                setToolStreamingIndicator(tcad.index, pendingToolCalls[tcad.index].name, pendingToolCalls[tcad.index].args);
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
                                pendingToolCalls[idx] = { index: idx, id: 'google_tc_' + idx, name: tcc.name, args: JSON.stringify(tcc.args || {}) };
                            }
                        }
                    },
                    () => {
                        if (isHandlingToolCalls) return;
                        if (Object.keys(pendingToolCalls).length > 0) {
                            handleToolCalls();
                        } else {
                            finishStream();
                        }
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
