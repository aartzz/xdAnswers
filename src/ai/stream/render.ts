// src/ai/stream/render.ts
// HTML builders for the thinking, web search and calculator blocks shown above the streamed answer.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function toggleIcon(expanded: boolean): string {
        return expanded
            ? '<span class="xd-icon" style="font-size:14px !important;">expand_less</span>'
            : '<span class="xd-icon" style="font-size:14px !important;">expand_more</span>';
    }

    I.thinkingBlockHtml = function(elapsed: string, fullThinking: string, expanded: boolean): string {
        const displayStyle = expanded ? 'block' : 'none';
        return '<div class="xd-thinking">' +
            '<div class="xd-thinking-header" style="cursor:pointer;"><span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">psychology</span> Thinking <span class="xd-thinking-timer">(' + elapsed + ')</span> <span class="xd-thinking-chars">(' + fullThinking.length + ' chars)</span> <span class="xd-thinking-toggle">' + toggleIcon(expanded) + '</span></div>' +
            '<div class="xd-thinking-content" style="display:' + displayStyle + ' !important;">' + window.xdAnswers.renderMarkdown(fullThinking) + '</div></div>';
    };

    I.searchBlockHtml = function(searchCalls: XdSearchCallInfo[], expanded: boolean): string {
        const doneCount = searchCalls.filter(sc => sc.status === 'done').length;
        const searchingCount = searchCalls.length - doneCount;
        const headerLabel = searchingCount > 0
            ? '<span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">travel_explore</span> Web Search... <span class="xd-search-count">(' + searchCalls.length + ')</span>'
            : '<span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">travel_explore</span> Web Search <span class="xd-search-count">(' + doneCount + ')</span>';
        const sDisplay = expanded ? 'block' : 'none';
        let html = '<div class="xd-search-block">' +
            '<div class="xd-search-header" style="cursor:pointer;">' + headerLabel + ' <span class="xd-search-toggle">' + toggleIcon(expanded) + '</span></div>' +
            '<div class="xd-search-content" style="display:' + sDisplay + ' !important;">';
        for (let i = 0; i < searchCalls.length; i++) {
            const sc = searchCalls[i];
            if (sc.status === 'searching') {
                html += '<div class="xd-search-entry" data-xd-search-idx="' + i + '"><span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">hourglass_top</span> <span class="xd-searching-query">' + I.escapeHTML(sc.query) + '</span></div>';
            } else {
                html += '<div class="xd-search-entry" data-xd-search-idx="' + i + '"><span class="xd-icon" style="font-size:14px !important;color:#4ade80;vertical-align:middle;margin-right:2px;">check</span> <span class="xd-searching-query">' + I.escapeHTML(sc.query) + '</span> <span class="xd-searching-count">(' + sc.resultCount + ' results)</span></div>';
            }
        }
        return html + '</div></div>';
    };

    I.calcBlockHtml = function(calcCalls: XdCalcCallInfo[], expanded: boolean): string {
        const doneCount = calcCalls.filter(c => c.status === 'done').length;
        const calculatingCount = calcCalls.length - doneCount;
        const headerLabel = calculatingCount > 0
            ? '<span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">calculate</span> Calculator... <span class="xd-calc-count">(' + calcCalls.length + ')</span>'
            : '<span class="xd-icon" style="font-size:15px !important;vertical-align:middle;margin-right:4px;">calculate</span> Calculator <span class="xd-calc-count">(' + doneCount + ')</span>';
        const cDisplay = expanded ? 'block' : 'none';
        let html = '<div class="xd-calc-block">' +
            '<div class="xd-calc-header" style="cursor:pointer;">' + headerLabel + ' <span class="xd-calc-toggle">' + toggleIcon(expanded) + '</span></div>' +
            '<div class="xd-calc-content" style="display:' + cDisplay + ' !important;">';
        for (let i = 0; i < calcCalls.length; i++) {
            const cc = calcCalls[i];
            if (cc.status === 'calculating') {
                html += '<div class="xd-calc-entry"><span class="xd-icon" style="font-size:14px !important;vertical-align:middle;margin-right:4px;">hourglass_top</span> <span class="xd-calc-expr">' + I.escapeHTML(cc.expression || '...') + '</span></div>';
            } else {
                const resText = cc.result !== undefined ? ' = ' + I.escapeHTML(String(cc.result)) : '';
                html += '<div class="xd-calc-entry"><span class="xd-icon" style="font-size:14px !important;color:#38bdf8;vertical-align:middle;margin-right:2px;">check</span> <span class="xd-calc-expr">' + I.escapeHTML(cc.expression) + '</span><strong class="xd-calc-result">' + resText + '</strong></div>';
            }
        }
        return html + '</div></div>';
    };
})();
