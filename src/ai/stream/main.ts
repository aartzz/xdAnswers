// src/ai/stream/main.ts
// Streaming answer pipeline. Extracted from legacy utils.js (lines 759-1107).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    interface PendingToolCall {
        index: number;
        id?: string;
        name?: string;
        args: string;
        _parsedInput?: any;
    }

    window.xdAnswers.streamAnswer = function(questionData: XdQuestionData, outerStartTime?: number, overrides?: XdStreamAnswerOverrides): Promise<XdStreamAnswerResult> {
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
            const parsePartialLabeled = I.parsePartialLabeled;
            const salvagePartialJSON = I.salvagePartialJSON;
            const renderPartial = I.renderPartial;
            const toggleThinkingContent = I.toggleThinkingContent;

            const s = (overrides && overrides.effectiveSettings) || getEffectiveSettings(window.xdAnswers.settings);
            const { systemPrompt, userMsg } = buildMessages(questionData, overrides && overrides.showAnswerOnly);
            const images = questionData.base64Images || [];

            // Build initial messages array for multi-turn tool-call support
            const messages: Array<Record<string, unknown>> = [];
            if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
            const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: userMsg }];
            images.forEach(img => userContent.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + img } }));
            messages.push({ role: 'user', content: images.length > 0 ? userContent : userMsg });

            const initialBody = buildRequestBody(s, systemPrompt, userMsg, images, true);
            window.xdAnswers.lastRequestBody = initialBody;

            const st: { fullContent: string; fullThinking: string; lastHighlightedAnswer: string; thinkingStarted: boolean; thinkingDone: boolean; streamTimerInterval: number | null; statusCleared: boolean; toolLoopDepth: number; isHandlingToolCalls: boolean; searchCalls: XdSearchCallInfo[]; calcCalls: XdCalcCallInfo[]; pendingToolCalls: Record<number, PendingToolCall>; inInlineThinking: boolean; rawContentBuffer: string; isThinkingExpanded: boolean; isSearchExpanded: boolean; isCalcExpanded: boolean } = {
                fullContent: '',
                fullThinking: '',
                lastHighlightedAnswer: '',
                thinkingStarted: false,
                thinkingDone: false,
                streamTimerInterval: null,
                statusCleared: false,
                toolLoopDepth: 0,
                isHandlingToolCalls: false,
                searchCalls: [],
                calcCalls: [],
                pendingToolCalls: {},
                inInlineThinking: false,
                rawContentBuffer: '',
                isThinkingExpanded: false,
                isSearchExpanded: false,
                isCalcExpanded: false
            };
            const startTime = outerStartTime || Date.now();
            const contentDiv = (overrides && overrides.contentDiv) || window.xdAnswers.answerContentDiv;
            const MAX_TOOL_LOOPS = 3;

            // Search indicator state
            // Calculator indicator state

            // Tool call accumulation state (per stream round)

            function setToolStreamingIndicator(toolIndex: number, name: string, argsStr: string) {
                const isCalc = I.isCalculatorToolName && I.isCalculatorToolName(name);
                let args: any = {};
                try { args = JSON.parse(argsStr); } catch {}

                if (isCalc) {
                    const expr = I.extractToolExpression(args);
                    if (!expr) return;
                    let entry = st.calcCalls.find(c => c.round === st.toolLoopDepth && c.toolIndex === toolIndex);
                    if (!entry) {
                        entry = { round: st.toolLoopDepth, toolIndex, expression: expr, status: 'calculating' };
                        st.calcCalls.push(entry);
                    } else {
                        entry.expression = expr;
                        entry.status = 'calculating';
                    }
                    updateStreamUI();
                } else {
                    const query = I.extractToolQuery(args);
                    if (!query) return;
                    let entry = st.searchCalls.find(sc => sc.round === st.toolLoopDepth && sc.toolIndex === toolIndex);
                    if (!entry) {
                        entry = { round: st.toolLoopDepth, toolIndex, query, status: 'searching', resultCount: 0 };
                        st.searchCalls.push(entry);
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
                if (st.streamTimerInterval) return;
                st.streamTimerInterval = setInterval(() => {
                    const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
                    if (footerElapsed) footerElapsed.innerHTML = '<span class="xd-icon" style="font-size:13px !important;vertical-align:middle;margin-right:2px;">schedule</span> ' + getElapsed();
                    // Only update thinking timer while thinking is still in progress
                    if (!st.thinkingDone) {
                        const thinkingTimer = contentDiv?.querySelector('.xd-thinking-timer');
                        if (thinkingTimer) thinkingTimer.textContent = '(' + getElapsed() + ')';
                    }
                }, 1000);
            }

            function stopStreamTimer() {
                if (st.streamTimerInterval) { clearInterval(st.streamTimerInterval); st.streamTimerInterval = null; }
            }

            function clearStatus() {
                if (st.statusCleared) return;
                st.statusCleared = true;
                if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
                const status = contentDiv?.querySelector('.xd-status');
                const loader = contentDiv?.querySelector('.xd-loader');
                if (status) status.remove();
                if (loader) loader.remove();
                // Start persistent stream timer when status is cleared
                 startStreamTimer();
            }

            // Track inline thinking (<think>...</think> or prose reasoning like "The user is asking...")

            const PROSE_THINKING_ANYWHERE_REGEX = I.PROSE_THINKING_ANYWHERE_REGEX;
            const PROSE_TRANSITION_REGEX = I.PROSE_TRANSITION_REGEX;

            function checkAndExtractInlineThinking(newText: string) {
                st.rawContentBuffer += newText;

                // 1. Tag based: <think>...</think>
                if (!st.inInlineThinking && st.rawContentBuffer.includes('<think>')) {
                    const parts = st.rawContentBuffer.split('<think>');
                    const before = parts[0];
                    st.rawContentBuffer = '<think>' + parts.slice(1).join('<think>');
                    st.inInlineThinking = true;
                    ensureThinkingUI();
                    if (before) {
                        st.fullContent += before;
                    }
                }

                // 2. Prose header based (e.g. Qwen / Deepseek / Llama without tags):
                if (!st.inInlineThinking) {
                    if (st.fullContent.length === 0) {
                        // At stream beginning, hold buffer if it could be start of prose thinking header
                        if (st.rawContentBuffer.length < 30) {
                            const prefix = st.rawContentBuffer.trimStart();
                            const possiblePrefixes = ["here", "thinking", "the", "i need", "let", "first", "we need"];
                            const isCandidate = possiblePrefixes.some(p => p.startsWith(prefix.toLowerCase()) || prefix.toLowerCase().startsWith(p));
                            if (isCandidate) {
                                return; // hold buffer for more chunks
                            }
                        }
                    }

                    const anywhereMatch = st.rawContentBuffer.match(PROSE_THINKING_ANYWHERE_REGEX);
                    if (anywhereMatch) {
                        const matchIndex = anywhereMatch.index ?? 0;
                        const before = st.rawContentBuffer.slice(0, matchIndex);
                        st.rawContentBuffer = st.rawContentBuffer.slice(matchIndex).replace(/^\n\s*/, '');
                        st.inInlineThinking = true;
                        ensureThinkingUI();
                        if (before) {
                            st.fullContent += before;
                        }
                    }
                }

                if (st.inInlineThinking) {
                    // Check for close of thinking
                    // Check </think>
                    const closeIndex = st.rawContentBuffer.indexOf('</think>');
                    if (closeIndex !== -1) {
                        const thinkPart = st.rawContentBuffer.slice(0, closeIndex).replace(/^<think>/i, '');
                        st.fullThinking = thinkPart;
                        st.rawContentBuffer = st.rawContentBuffer.slice(closeIndex + 8);
                        st.inInlineThinking = false;
                        st.thinkingDone = true;
                        if (st.rawContentBuffer) {
                            st.fullContent += st.rawContentBuffer;
                            st.rawContentBuffer = '';
                        }
                    } else if (!st.rawContentBuffer.startsWith('<think>')) {
                        // Check prose transition like "---", "**Answer:**", "\nAnswer:", "FINAL_ANSWER:", JSON start "{" or labeled answer "Answer:" / "Відповідь:" / "Option A"
                        // Note: do NOT match option letters during thinking like "Options:\nA: ... B: ..."
                        const transitionMatch = st.rawContentBuffer.search(PROSE_TRANSITION_REGEX);
                        if (transitionMatch !== -1) {
                            const thinkPart = st.rawContentBuffer.slice(0, transitionMatch);
                            st.fullThinking = thinkPart;
                            st.rawContentBuffer = st.rawContentBuffer.slice(transitionMatch + 1);
                            st.inInlineThinking = false;
                            st.thinkingDone = true;
                            if (st.rawContentBuffer) {
                                st.fullContent += st.rawContentBuffer;
                                st.rawContentBuffer = '';
                            }
                        } else {
                            // Still streaming prose thinking - push into st.fullThinking incrementally
                            st.fullThinking = st.rawContentBuffer;
                        }
                    } else {
                        // Still in <think> tags
                        st.fullThinking = st.rawContentBuffer.replace(/^<think>/i, '');
                    }

                    if (st.fullThinking) {
                        ensureThinkingUI();
                    }
                    // During prose thinking, don't display st.rawContentBuffer in the answer section
                    updateStreamUI();
                    return;
                }

                // Normal content flow
                if (st.thinkingStarted && !st.thinkingDone) st.thinkingDone = true;
                st.fullContent += st.rawContentBuffer;
                st.rawContentBuffer = '';
                updateStreamUI();
            }


            function ensureThinkingUI() {
                if (st.thinkingStarted || !contentDiv) return;
                clearStatus();
                st.thinkingStarted = true;
                const displayStyle = st.isThinkingExpanded ? 'block' : 'none';
                const toggleIcon = st.isThinkingExpanded 
                    ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                    : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
                contentDiv.innerHTML =
                    '<div class="xd-thinking">' +
                    '<div class="xd-thinking-header" style="cursor:pointer;"><span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">psychology</span> Thinking... <span class="xd-thinking-timer">(0s)</span> <span class="xd-thinking-chars"></span> <span class="xd-thinking-toggle">' + toggleIcon + '</span></div>' +
                    '<div class="xd-thinking-content" style="display:' + displayStyle + ' !important;"></div>' +
                    '</div>';
                const header = contentDiv.querySelector('.xd-thinking-header');
                header!.addEventListener('click', function(this: HTMLElement) {
                    st.isThinkingExpanded = !st.isThinkingExpanded;
                    toggleThinkingContent(this);
                });
            }

            function updateStreamUI() {
                if (!contentDiv) return;
                clearStatus();

                const elapsed = getElapsed();
                let html = '';

                // Thinking block always first (at the top)
                if (st.thinkingStarted) html += I.thinkingBlockHtml(elapsed, st.fullThinking, st.isThinkingExpanded);

                // Search indicator block between thinking and answer
                if (st.searchCalls.length > 0) html += I.searchBlockHtml(st.searchCalls, st.isSearchExpanded);

                // Calculator indicator block
                if (st.calcCalls.length > 0) html += I.calcBlockHtml(st.calcCalls, st.isCalcExpanded);

                const parsed = parsePartialLabeled(st.fullContent) || salvagePartialJSON(st.fullContent);

                if (parsed && parsed.answer && parsed.answer !== st.lastHighlightedAnswer) {
                    st.lastHighlightedAnswer = parsed.answer;
                    I.highlightCorrectAnswer(parsed.answer);
                }

                if (parsed) {
                    html += renderPartial(parsed);
                } else if (st.fullContent.trim()) {
                    html += '<div class="xd-answer xd-answer-partial">' + window.xdAnswers.renderMarkdown(st.fullContent) + '</div>';
                } else if (st.searchCalls.some(sc => sc.status === 'searching')) {
                    html += '<div class="xd-waiting"><span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">travel_explore</span> Executing web search...</div>';
                } else if (st.calcCalls.some(c => c.status === 'calculating')) {
                    html += '<div class="xd-waiting"><span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">calculate</span> Calculating math expression...</div>';
                } else {
                    html += '<div class="xd-waiting"><span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">hourglass_empty</span> Waiting for answer...</div>';
                }

                contentDiv.innerHTML = html;
                const th = contentDiv.querySelector('.xd-thinking-header');
                if (th) th.addEventListener('click', function(this: HTMLElement) {
                    st.isThinkingExpanded = !st.isThinkingExpanded;
                    toggleThinkingContent(this);
                });
                const sh = contentDiv.querySelector('.xd-search-header');
                if (sh) sh.addEventListener('click', function(this: HTMLElement) {
                    st.isSearchExpanded = !st.isSearchExpanded;
                    const content = this.nextElementSibling as HTMLElement | null;
                    if (!content) return;
                    const toggle = this.querySelector('.xd-search-toggle');
                    content.style.setProperty('display', st.isSearchExpanded ? 'block' : 'none', 'important');
                    if (toggle) toggle.innerHTML = st.isSearchExpanded 
                        ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                        : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
                });
                const ch = contentDiv.querySelector('.xd-calc-header');
                if (ch) ch.addEventListener('click', function(this: HTMLElement) {
                    st.isCalcExpanded = !st.isCalcExpanded;
                    const content = this.nextElementSibling as HTMLElement | null;
                    if (!content) return;
                    const toggle = this.querySelector('.xd-calc-toggle');
                    content.style.setProperty('display', st.isCalcExpanded ? 'block' : 'none', 'important');
                    if (toggle) toggle.innerHTML = st.isCalcExpanded 
                        ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                        : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
                });
            }

            const handleToolCalls = I.createToolCalls({ I, MAX_TOOL_LOOPS, executeSearch, finishStream, messages, s, st, startStreamRound, updateStreamUI });

            function finishStream() {
                stopStreamTimer();
                // If stream ended while still in inline thinking buffer, inspect if it contains transition or is entirely thinking
                if (st.rawContentBuffer) {
                    if (st.inInlineThinking) {
                        const transitionMatch = st.rawContentBuffer.search(PROSE_TRANSITION_REGEX);
                        if (transitionMatch !== -1) {
                            st.fullThinking = (st.fullThinking ? st.fullThinking + '\n' : '') + st.rawContentBuffer.slice(0, transitionMatch).replace(/^<think>/i, '').trim();
                            st.fullContent += st.rawContentBuffer.slice(transitionMatch + 1).trim();
                        } else {
                            // Check if st.rawContentBuffer has any answer keywords or is purely thinking
                            const altMatch = st.rawContentBuffer.search(/(?:^|\n)\s*(?:(?:\*{0,2}Answer\*{0,2}\s*:)|(?:(?:Therefore|Thus|So),?\s*.*?(?:option|answer)\s*(?:is|=)\s*)|(?:Option\s+[A-D]))/i);
                            if (altMatch !== -1 && altMatch > 0) {
                                st.fullThinking = (st.fullThinking ? st.fullThinking + '\n' : '') + st.rawContentBuffer.slice(0, altMatch).replace(/^<think>/i, '').trim();
                                st.fullContent += st.rawContentBuffer.slice(altMatch).trim();
                            } else {
                                st.fullThinking = ((st.fullThinking ? st.fullThinking + '\n' : '') + st.rawContentBuffer).replace(/^<think>/i, '').replace(/<\/think>$/i, '').trim();
                            }
                        }
                    } else {
                        st.fullContent += st.rawContentBuffer;
                    }
                    st.rawContentBuffer = '';
                }
                resolve({ content: st.fullContent, thinking: st.fullThinking, searchCalls: st.searchCalls, calcCalls: st.calcCalls });
            }

            function startStreamRound(currentMessages: Array<Record<string, unknown>>) {
                // Build the request body from the current message history
                const body = Object.assign({}, initialBody) as Record<string, unknown>;
                body.messages = currentMessages;
                // Remove any stale tools from initialBody copy before conditionally adding fresh ones.
                delete body.tools;
                // Include tools on stream rounds within MAX_TOOL_LOOPS limit
                if (st.toolLoopDepth < MAX_TOOL_LOOPS) {
                    const tools = I.buildTools ? I.buildTools(s, s.apiFormat) : [];
                    if (tools.length > 0 && s.apiFormat !== 'google') {
                        body.tools = tools;
                    }
                }
                window.xdAnswers.lastRequestBody = body;

                const cancel = window.xdAnswers.streamRequest(
                    { url: buildStreamUrl(s), method: 'POST', headers: buildHeaders(s), data: JSON.stringify(body) },
                    (chunk) => {
                        const events = parseSSEChunks(chunk as string, s.apiFormat);
                        for (const ev of events) {
                            if (ev.thinking) {
                                ensureThinkingUI();
                                st.fullThinking += ev.thinking;
                                const tc = contentDiv?.querySelector('.xd-thinking-content');
                                if (tc) tc.innerHTML = window.xdAnswers.renderMarkdown(st.fullThinking);
                                const chars = contentDiv?.querySelector('.xd-thinking-chars');
                                if (chars) chars.textContent = '(' + st.fullThinking.length + ' chars)';
                            }
                            if (ev.content) {
                                checkAndExtractInlineThinking(ev.content);
                            }
                            // Tool call events
                            if (ev.tool_call_start) {
                                const tcs = ev.tool_call_start;
                                st.pendingToolCalls[tcs.index] = { index: tcs.index, id: tcs.id, name: tcs.name, args: '' };
                            }
                            if (ev.tool_call_delta) {
                                const tcd = ev.tool_call_delta;
                                if (!st.pendingToolCalls[tcd.index]) {
                                    st.pendingToolCalls[tcd.index] = { index: tcd.index, id: tcd.id || '', name: tcd.name || '', args: '' };
                                }
                                if (tcd.id) st.pendingToolCalls[tcd.index].id = tcd.id;
                                if (tcd.name) st.pendingToolCalls[tcd.index].name = tcd.name;
                                if (tcd.argsDelta) st.pendingToolCalls[tcd.index].args += tcd.argsDelta;

                                setToolStreamingIndicator(tcd.index, st.pendingToolCalls[tcd.index].name || '', st.pendingToolCalls[tcd.index].args);
                            }
                            if (ev.tool_call_args_delta) {
                                const tcad = ev.tool_call_args_delta;
                                if (!st.pendingToolCalls[tcad.index]) {
                                    st.pendingToolCalls[tcad.index] = { index: tcad.index, id: tcad.id || '', name: tcad.name || '', args: '' };
                                }
                                st.pendingToolCalls[tcad.index].args += tcad.argsDelta;
                                setToolStreamingIndicator(tcad.index, st.pendingToolCalls[tcad.index].name || '', st.pendingToolCalls[tcad.index].args);
                            }
                            if (ev.tool_call_stop) {
                                // Tool call finished — execute and continue
                                handleToolCalls();
                                return; // stop processing this chunk, handleToolCalls will start new stream
                            }
                            // Google non-streaming tool call (already complete)
                            if (ev.tool_call_complete) {
                                const tcc = ev.tool_call_complete;
                                const idx = Object.keys(st.pendingToolCalls).length;
                                st.pendingToolCalls[idx] = { index: idx, id: 'google_tc_' + idx, name: tcc.name, args: JSON.stringify(tcc.args || {}) };
                            }
                        }
                    },
                    () => {
                        if (st.isHandlingToolCalls) return;
                        if (Object.keys(st.pendingToolCalls).length > 0) {
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
