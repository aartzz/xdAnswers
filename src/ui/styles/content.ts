// src/ui/styles/content.ts
// Helper window content CSS: answer, search, calculator, thinking, code and consensus blocks.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    I.buildHelperContentCss = function(): string {
        return '.xd-answer{font-size:18px !important;font-weight:700 !important;margin-bottom:10px !important;line-height:1.4 !important;}' +
            '.xd-answer-partial{font-size:16px !important;}' +
            '.xd-explanation{font-size:13px !important;opacity:0.85 !important;margin-bottom:8px !important;line-height:1.5 !important;}' +
            '.xd-solution{font-size:13px !important;opacity:0.85 !important;padding:8px !important;background:rgba(255,255,255,0.05) !important;border-radius:6px !important;margin-top:6px !important;white-space:pre-wrap !important;}' +
            '.xd-confidence{font-size:11px !important;opacity:0.5 !important;margin-top:4px !important;}' +
            '.xd-raw-preview{font-size:12px !important;opacity:0.4 !important;}' +
            '.xd-waiting{font-size:12px !important;opacity:0.4 !important;text-align:center !important;padding:10px !important;}' +
            '.xd-search-block{margin-bottom:10px !important;padding:8px !important;background:rgba(255,255,255,0.03) !important;border-radius:6px !important;border-left:3px solid rgba(255,165,0,0.3) !important;}' +
            '.xd-search-header{color:#c89640 !important;font-style:italic !important;font-size:12px !important;display:flex !important;align-items:center !important;gap:6px !important;}' +
            '.xd-search-count{font-style:normal !important;font-weight:500 !important;opacity:0.7 !important;}' +
            '.xd-search-toggle{font-style:normal !important;opacity:0.5 !important;font-size:10px !important;margin-left:auto !important;}' +
            '.xd-search-content{font-size:12px !important;opacity:0.7 !important;margin-top:6px !important;}' +
            '.xd-search-entry{padding:3px 0 !important;font-size:12px !important;opacity:0.8 !important;}' +
            '.xd-searching-query{font-style:normal !important;font-weight:500 !important;opacity:0.85 !important;}' +
            '.xd-searching-count{font-style:normal !important;opacity:0.5 !important;font-size:11px !important;}' +
            '.xd-calc-block{margin-bottom:10px !important;padding:8px !important;background:rgba(255,255,255,0.03) !important;border-radius:6px !important;border-left:3px solid rgba(56,189,248,0.4) !important;}' +
            '.xd-calc-header{color:#38bdf8 !important;font-style:italic !important;font-size:12px !important;display:flex !important;align-items:center !important;gap:6px !important;}' +
            '.xd-calc-count{font-style:normal !important;font-weight:500 !important;opacity:0.7 !important;}' +
            '.xd-calc-toggle{font-style:normal !important;opacity:0.5 !important;font-size:10px !important;margin-left:auto !important;}' +
            '.xd-calc-content{font-size:12px !important;opacity:0.7 !important;margin-top:6px !important;}' +
            '.xd-calc-entry{padding:3px 0 !important;font-size:12px !important;opacity:0.85 !important;}' +
            '.xd-calc-expr{font-family:"Fira Code",Consolas,monospace !important;opacity:0.85 !important;}' +
            '.xd-calc-result{color:#38bdf8 !important;font-family:"Fira Code",Consolas,monospace !important;margin-left:4px !important;}' +
            '.xd-error{color:#f87171 !important;font-size:13px !important;padding:8px !important;background:rgba(248,113,113,0.08) !important;border-radius:6px !important;border-left:3px solid #f87171 !important;}' +
            '.xd-elapsed{display:none !important;}' +
            '.xd-status{text-align:center !important;font-size:12px !important;opacity:0.5 !important;margin-top:8px !important;}' +
            '.xd-thinking{margin-bottom:10px !important;padding:8px !important;background:rgba(255,255,255,0.03) !important;border-radius:6px !important;border-left:3px solid rgba(255,255,255,0.1) !important;}' +
            '.xd-thinking-header{color:#888 !important;font-style:italic !important;font-size:12px !important;display:flex !important;align-items:center !important;gap:6px !important;}' +
            '.xd-thinking-toggle{font-style:normal !important;opacity:0.5 !important;font-size:10px !important;margin-left:auto !important;}' +
            '.xd-thinking-timer{font-style:normal !important;opacity:0.6 !important;}' +
            '.xd-thinking-chars{font-style:normal !important;opacity:0.4 !important;font-size:10px !important;}' +
            '.xd-thinking-content{font-size:12px !important;opacity:0.7 !important;margin-top:6px !important;white-space:pre-wrap !important;}' +
            '.xd-code{background:rgba(0,0,0,0.3) !important;border-radius:6px !important;padding:10px !important;overflow-x:auto !important;font-family:"Fira Code",Consolas,monospace !important;font-size:12px !important;margin:8px 0 !important;white-space:pre !important;}' +
            '.xd-icode{background:rgba(255,255,255,0.1) !important;padding:1px 5px !important;border-radius:3px !important;font-family:"Fira Code",Consolas,monospace !important;font-size:0.9em !important;}' +
            '.xd-latex-block{background:rgba(255,255,255,0.05) !important;padding:8px !important;border-radius:4px !important;font-family:"Cambria Math","Latin Modern Math",serif !important;font-size:15px !important;text-align:center !important;margin:8px 0 !important;}' +
            '.xd-latex{font-family:"Cambria Math","Latin Modern Math",serif !important;font-size:1.05em !important;}' +
            '.xd-consensus-tabs{display:flex !important;gap:2px !important;margin:-14px -14px 10px -14px !important;padding:8px 10px 0 10px !important;border-bottom:1px solid var(--xd-border) !important;overflow-x:auto !important;flex-shrink:0 !important;scrollbar-width:none !important;}' +
            '.xd-consensus-tabs::-webkit-scrollbar{display:none !important;}' +
            '.xd-consensus-tab{padding:4px 10px !important;border-radius:6px 6px 0 0 !important;cursor:pointer !important;font-size:11px !important;white-space:nowrap !important;opacity:0.5 !important;transition:opacity 0.2s !important;display:flex !important;align-items:center !important;gap:4px !important;border-bottom:2px solid transparent !important;}' +
            '.xd-consensus-tab:hover{opacity:0.8 !important;}' +
            '.xd-consensus-tab.active{opacity:1 !important;border-bottom-color:var(--xd-text) !important;background:rgba(255,255,255,0.05) !important;}' +
            '.xd-tab-spinner{display:inline-block !important;width:10px !important;height:10px !important;border:2px solid rgba(255,255,255,0.15) !important;border-top:2px solid var(--xd-text) !important;border-radius:50% !important;animation:xd-spin 0.8s linear infinite !important;flex-shrink:0 !important;}' +
            '.xd-consensus-tab.xd-tab-majority{opacity:1 !important;color:#4ade80 !important;}' +
            '.xd-consensus-tab.xd-tab-majority.active{border-bottom-color:#4ade80 !important;}' +
            '.xd-consensus-tab.xd-tab-minority{opacity:0.7 !important;}' +
            '.xd-consensus-tab.xd-tab-error{opacity:0.5 !important;color:#f87171 !important;}' +
            '.xd-tab-content{display:none !important;}' +
            '.xd-tab-content.active-tab{display:block !important;}' +
            '.xd-consensus-banner{margin-bottom:10px !important;padding:6px 10px !important;border-radius:6px !important;font-size:13px !important;font-weight:500 !important;display:flex !important;align-items:center !important;gap:6px !important;}' +
            '.xd-consensus-banner.xd-consensus-unanimous{background:rgba(34,197,94,0.1) !important;border-left:3px solid rgba(34,197,94,0.5) !important;}' +
            '.xd-consensus-banner.xd-consensus-majority{background:rgba(250,204,21,0.1) !important;border-left:3px solid rgba(250,204,21,0.5) !important;}' +
            '.xd-consensus-banner.xd-consensus-no-consensus{background:rgba(248,113,113,0.1) !important;border-left:3px solid rgba(248,113,113,0.5) !important;}' +
            '.xd-consensus-agreement{font-variant-numeric:tabular-nums !important;opacity:0.7 !important;margin-left:auto !important;}';
    };
})();
