// src/ai/process.js
// Main question processing pipeline. Extracted from legacy utils.js (lines 1842-1975).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    window.xdAnswers.processQuestion = async function(questionData) {
        if (window.xdAnswers.isProcessingAI) {
            window.xdAnswers._oneClickUserTriggered = false;
            return;
        }

        const I = window.xdAnswers._internal;
        const silentMode = window.xdAnswers.settings.silentMode || '';
        const webSearch = window.xdAnswers.settings.webSearchEnabled && I.getActiveSearchProvider(window.xdAnswers.settings);
        console.log('[xdAnswers] processQuestion:', questionData.text?.slice(0, 80) + '...', '| topic=' + (questionData.topic || 'none'), '| webSearch=' + !!webSearch, '| silent=' + silentMode);

        // In oneclick mode, only process when user explicitly clicked (flag set by setupOneClickHandler)
        if (silentMode === 'oneclick' && !window.xdAnswers._oneClickUserTriggered) {
            return;
        }
        window.xdAnswers._oneClickUserTriggered = false;

        const isSilent = silentMode !== '';

        if (!isSilent) {
            window.xdAnswers.createUI();
            window.xdAnswers.attachAndPositionHelper();
        }

        window.xdAnswers.isProcessingAI = true;
        const startTime = Date.now();

        function getElapsed() {
            const ms = Date.now() - startTime;
            const sec = Math.floor(ms / 1000);
            return sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's';
        }

        if (!isSilent && window.xdAnswers.answerContentDiv) {
            window.xdAnswers.answerContentDiv.innerHTML = '<div class="xd-loader"></div>';
            const statusDiv = document.createElement('div');
            statusDiv.className = 'xd-status';
            statusDiv.textContent = '⏳ Connecting...';
            window.xdAnswers.answerContentDiv.appendChild(statusDiv);
            const statusInterval = setInterval(() => {
                // Always update footer elapsed
                const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
                if (footerElapsed) footerElapsed.textContent = '⏱ ' + getElapsed();
                // Update status text if still showing
                const s = window.xdAnswers.answerContentDiv?.querySelector('.xd-status');
                if (s) s.textContent = '⏳ Waiting for response...';
            }, 1000);
            window.xdAnswers._statusInterval = statusInterval;
        }

        try {
            let result;
            try {
                result = await window.xdAnswers.streamAnswer(questionData, startTime);
            } catch (streamErr) {
                console.warn('xdAnswers: Streaming failed, falling back:', streamErr.message);
                const answer = await window.xdAnswers.getAnswer(questionData);
                result = { content: answer, thinking: '' };
            }

            if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }

            const elapsed = getElapsed();
            const parsed = I.parseAIResponse(result.content);
            window.xdAnswers.lastParsedResponse = parsed;

            if (isSilent) {
                I.applySilentMode(parsed.answer || parsed.explanation || 'Parse error', parsed);
            } else if (window.xdAnswers.answerContentDiv) {
                let html = '<div class="xd-elapsed">⏱ ' + elapsed + '</div>';
                // Update footer elapsed too
                const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
                if (footerElapsed) footerElapsed.textContent = '⏱ ' + elapsed;
                if (result.thinking) {
                    html += '<div class="xd-thinking">' +
                        '<div class="xd-thinking-header" style="cursor:pointer;">💭 Thinking <span class="xd-thinking-timer">(' + elapsed + ')</span> <span class="xd-thinking-chars">(' + result.thinking.length + ' chars)</span> <span class="xd-thinking-toggle">▼</span></div>' +
                        '<div class="xd-thinking-content" style="display:none !important;">' + window.xdAnswers.renderMarkdown(result.thinking) + '</div></div>';
                }
                if (result.searchCalls && result.searchCalls.length > 0) {
                    const scDone = result.searchCalls.filter(sc => sc.status === 'done').length;
                    html += '<div class="xd-search-block">' +
                        '<div class="xd-search-header" style="cursor:pointer;">🔍 Web Search <span class="xd-search-count">(' + scDone + ')</span> <span class="xd-search-toggle">▼</span></div>' +
                        '<div class="xd-search-content" style="display:none !important;">';
                    for (const sc of result.searchCalls) {
                        html += '<div class="xd-search-entry">✓ <span class="xd-searching-query">' + I.escapeHTML(sc.query) + '</span> <span class="xd-searching-count">(' + (sc.resultCount || 0) + ' results)</span></div>';
                    }
                    html += '</div></div>';
                }
                html += I.renderParsedResponse(parsed);
                window.xdAnswers.answerContentDiv.innerHTML = html;

                const th = window.xdAnswers.answerContentDiv.querySelector('.xd-thinking-header');
                if (th) th.addEventListener('click', function() { I.toggleThinkingContent(this); });
                const sh = window.xdAnswers.answerContentDiv.querySelector('.xd-search-header');
                if (sh) sh.addEventListener('click', function() {
                    const content = this.nextElementSibling;
                    if (!content) return;
                    const toggle = this.querySelector('.xd-search-toggle');
                    const isHidden = content.style.display === 'none' || getComputedStyle(content).display === 'none';
                    content.style.setProperty('display', isHidden ? 'block' : 'none', 'important');
                    if (toggle) toggle.textContent = isHidden ? '▲' : '▼';
                });
            }

            if (parsed.answer) {
                if (!isSilent) {
                    I.highlightCorrectAnswer(parsed.answer);
                }
                // If provider set a custom auto-answer handler, use it instead of default
                if (window.xdAnswers._customAutoAnswer) {
                    const customFn = window.xdAnswers._customAutoAnswer;
                    window.xdAnswers._customAutoAnswer = null;
                    setTimeout(() => {
                        window.xdAnswers._autoSelecting = true;
                        try { customFn(parsed.answer, parsed); } catch (e) { console.error('xdAnswers customAutoAnswer:', e); }
                        window.xdAnswers._oneClickContainer = null;
                        window.xdAnswers._answerContainer = null;
                        window.xdAnswers._autoSelecting = false;
                    }, window.xdAnswers.settings.autoAnswerCooldown);
                } else {
                    // In oneclick mode, always auto-select (bypass autoAnswer setting)
                    I.autoSelectAnswer(parsed.answer, silentMode === 'oneclick');
                }
            }
        } catch (error) {
            if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
            if (!isSilent && window.xdAnswers.answerContentDiv) {
                const errHtml = I.formatError(error.message);
                window.xdAnswers.answerContentDiv.innerHTML = errHtml;
            }
        } finally {
            window.xdAnswers.isProcessingAI = false;
            window.xdAnswers._oneClickContainer = null;
        }
    };
})();
