// src/ai/process/render.ts
// Renders a finished single-model answer (thinking, search and calculator blocks, parsed body) into the answer panel.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    I.renderSingleResult = function(result: XdStreamAnswerResult, parsed: XdParsedResponse, elapsed: string): void {
        if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
        if (window.xdAnswers._streamTimerInterval) { clearInterval(window.xdAnswers._streamTimerInterval); window.xdAnswers._streamTimerInterval = null; }
        if (!window.xdAnswers.answerContentDiv) return;
        let html = '<div class="xd-elapsed"><span class="xd-icon" style="font-size:13px !important;vertical-align:middle;margin-right:2px;">schedule</span> ' + elapsed + '</div>';
        // Update footer elapsed too
        const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#lbl-elapsed, #xd-footer-elapsed');
        if (footerElapsed) footerElapsed.innerHTML = '<span class="xd-icon" style="font-size:13px !important;vertical-align:middle;margin-right:2px;">schedule</span> ' + elapsed;
        if (result.thinking) {
            const isExpanded = !!window.xdAnswers._thinkingExpanded;
            const displayStyle = isExpanded ? 'block' : 'none';
            const toggleIcon = isExpanded 
                ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
            html += '<div class="xd-thinking">' +
                '<div class="xd-thinking-header" style="cursor:pointer;"><span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">psychology</span> Thinking <span class="xd-thinking-timer">(' + elapsed + ')</span> <span class="xd-thinking-chars">(' + result.thinking.length + ' chars)</span> <span class="xd-thinking-toggle">' + toggleIcon + '</span></div>' +
                '<div class="xd-thinking-content" style="display:' + displayStyle + ' !important;">' + window.xdAnswers.renderMarkdown(result.thinking) + '</div></div>';
        }
        if (result.searchCalls && result.searchCalls.length > 0) {
            const scDone = result.searchCalls.filter(sc => sc.status === 'done').length;
            html += '<div class="xd-search-block">' +
                '<div class="xd-search-header" style="cursor:pointer;"><span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">travel_explore</span> Web Search <span class="xd-search-count">(' + scDone + ')</span> <span class="xd-search-toggle"><span class="xd-icon" style="font-size:14px !important;">expand_more</span></span></div>' +
                '<div class="xd-search-content" style="display:none !important;">';
            for (const sc of result.searchCalls) {
                html += '<div class="xd-search-entry"><span class="xd-icon" style="font-size:14px !important;color:#4ade80;vertical-align:middle;margin-right:2px;">check</span> <span class="xd-searching-query">' + I.escapeHTML(sc.query) + '</span> <span class="xd-searching-count">(' + (sc.resultCount || 0) + ' results)</span></div>';
            }
            html += '</div></div>';
        }
        if (result.calcCalls && result.calcCalls.length > 0) {
            const ccDone = result.calcCalls.filter(c => c.status === 'done').length;
            html += '<div class="xd-calc-block">' +
                '<div class="xd-calc-header" style="cursor:pointer;"><span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">calculate</span> Calculator <span class="xd-calc-count">(' + ccDone + ')</span> <span class="xd-calc-toggle"><span class="xd-icon" style="font-size:14px !important;">expand_more</span></span></div>' +
                '<div class="xd-calc-content" style="display:none !important;">';
            for (const cc of result.calcCalls) {
                const resText = cc.result !== undefined ? ' = ' + I.escapeHTML(String(cc.result)) : '';
                html += '<div class="xd-calc-entry"><span class="xd-icon" style="font-size:14px !important;color:#38bdf8;vertical-align:middle;margin-right:2px;">check</span> <span class="xd-calc-expr">' + I.escapeHTML(cc.expression) + '</span><strong class="xd-calc-result">' + resText + '</strong></div>';
            }
            html += '</div></div>';
        }
        html += I.renderParsedResponse(parsed);
        window.xdAnswers.answerContentDiv.innerHTML = html;

        const th = window.xdAnswers.answerContentDiv.querySelector('.xd-thinking-header');
        if (th) th.addEventListener('click', function(this: HTMLElement) { I.toggleThinkingContent(this); });
        const sh = window.xdAnswers.answerContentDiv.querySelector('.xd-search-header');
        if (sh) sh.addEventListener('click', function(this: HTMLElement) {
            const content = this.nextElementSibling as HTMLElement | null;
            if (!content) return;
            const toggle = this.querySelector('.xd-search-toggle');
            const isHidden = content.style.display === 'none' || getComputedStyle(content).display === 'none';
            content.style.setProperty('display', isHidden ? 'block' : 'none', 'important');
            if (toggle) toggle.innerHTML = isHidden 
                ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
        });
        const ch = window.xdAnswers.answerContentDiv.querySelector('.xd-calc-header');
        if (ch) ch.addEventListener('click', function(this: HTMLElement) {
            const content = this.nextElementSibling as HTMLElement | null;
            if (!content) return;
            const toggle = this.querySelector('.xd-calc-toggle');
            const isHidden = content.style.display === 'none' || getComputedStyle(content).display === 'none';
            content.style.setProperty('display', isHidden ? 'block' : 'none', 'important');
            if (toggle) toggle.innerHTML = isHidden 
                ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>' 
                : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
        });
    };
})();
