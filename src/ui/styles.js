// src/ui/styles.js
// Helper window CSS styles. Extracted from legacy utils.js (lines 2058-2152).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    window.xdAnswers.updateHelperBaseStyles = function() {
        const I = window.xdAnswers._internal;
        const custom = window.xdAnswers.settings.customization;
        const isMax = window.xdAnswers.isHelperWindowMaximized;
        const defaultHelperState = I.defaultHelperState;
        const maximizedHelperState = I.maximizedHelperState;
        window.xdAnswers.addStyle(
            ':root {' +
            '--xd-bg:' + custom.contentColor + ';--xd-border:' + custom.borderColor + ';' +
            '--xd-text:' + custom.textColor + ';--xd-header:' + custom.headerColor + ';' +
            '--xd-glow:' + (custom.glowEffect ? '0 0 8px ' + custom.borderColor : 'none') + ';' +
            '--xd-font:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
            '}' +
            '.ollama-helper-container{margin:0;padding:0;border:none;font-weight:normal;text-align:left;transform:none;' +
            'position:fixed !important;z-index:2147483647 !important;display:flex !important;flex-direction:column !important;' +
            'background-color:var(--xd-bg) !important;border:none !important;' +
            'border-radius:12px !important;box-shadow:inset 0 0 0 1px var(--xd-border),var(--xd-glow),0 4px 24px rgba(0,0,0,0.4) !important;color:var(--xd-text) !important;' +
            'font-family:var(--xd-font) !important;font-size:14px !important;line-height:1.5 !important;overflow:hidden !important;' +
            'contain:paint !important;isolation:isolate !important;background-clip:padding-box !important;' +
            'clip-path:inset(0 round 12px) !important;' +
            'width:' + (isMax ? maximizedHelperState.width : defaultHelperState.width) + ' !important;' +
            'height:' + (isMax ? maximizedHelperState.height : defaultHelperState.height) + ' !important;' +
            'max-height:' + (isMax ? maximizedHelperState.maxHeight : defaultHelperState.maxHeight) + ' !important;' +
            '}' +
            '.ollama-helper-container *:not(.xd-loader):not(.ollama-helper-header):not(.ollama-helper-footer),.ollama-helper-container *:before,.ollama-helper-container *:after:not(.xd-loader){' +
            'all:revert !important;appearance:none !important;-webkit-appearance:none !important;-moz-appearance:none !important;' +
            'font-family:var(--xd-font) !important;font-size:inherit !important;line-height:inherit !important;' +
            'color:var(--xd-text) !important;box-sizing:border-box !important;margin:0 !important;padding:0 !important;' +
            'background:none !important;border:none !important;}' +
            '.ollama-helper-header{display:flex !important;justify-content:space-between !important;align-items:center !important;' +
            'padding:10px 12px !important;background-color:var(--xd-header) !important;' +
            'border-bottom:1px solid var(--xd-border) !important;border-radius:12px 12px 0 0 !important;cursor:move !important;user-select:none !important;}' +
            '.ollama-header-title{font-weight:600 !important;margin-right:auto !important;font-size:13px !important;}' +
            '.xd-version{font-weight:400 !important;font-size:10px !important;opacity:0.5 !important;margin-left:4px !important;vertical-align:middle !important;}' +
            '.ollama-header-buttons{display:flex !important;align-items:center !important;}' +
            '.ollama-header-buttons button{all:revert !important;background:none !important;border:1px solid rgba(255,255,255,0.15) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:12px !important;' +
            'border-radius:6px !important;cursor:pointer !important;margin-left:4px !important;width:28px !important;height:24px !important;' +
            'padding:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;line-height:1 !important;}' +
            '.ollama-header-buttons button:hover{background-color:rgba(255,255,255,0.1) !important;}' +
            '#silent-mode-btn.active{background:rgba(255,255,255,0.15) !important;border-color:rgba(255,255,255,0.35) !important;}' +
            '#silent-mode-inline-select{all:revert !important;background:rgba(0,0,0,0.25) !important;border:1px solid rgba(255,255,255,0.15) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:11px !important;' +
            'border-radius:6px !important;cursor:pointer !important;margin-left:4px !important;height:24px !important;' +
            'padding:0 4px !important;line-height:1 !important;display:none !important;}' +
            '#silent-mode-inline-select option{background:var(--xd-bg) !important;color:var(--xd-text) !important;}' +
            '.ollama-helper-footer{display:flex !important;justify-content:space-between !important;align-items:center !important;' +
            'padding:6px 12px !important;background-color:var(--xd-header) !important;' +
            'box-shadow:inset 0 1px 0 var(--xd-border) !important;border:none !important;' +
            'border-radius:0 0 12px 12px !important;background-clip:padding-box !important;' +
            'min-height:28px !important;position:relative !important;overflow:hidden !important;}' +
            '.xd-footer-elapsed{font-size:11px !important;opacity:0.45 !important;font-variant-numeric:tabular-nums !important;pointer-events:none !important;flex-shrink:0 !important;min-width:48px !important;z-index:1 !important;}' +
            '.xd-footer-model{font-size:10px !important;opacity:0.35 !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;' +
            'position:absolute !important;left:50% !important;transform:translateX(-50%) !important;max-width:60% !important;pointer-events:none !important;z-index:0 !important;}' +
            '.xd-footer-copy{all:revert !important;background:none !important;border:1px solid rgba(255,255,255,0.15) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:13px !important;' +
            'border-radius:6px !important;cursor:pointer !important;padding:2px 6px !important;display:flex !important;' +
            'align-items:center !important;justify-content:center !important;line-height:1 !important;flex-shrink:0 !important;}' +
            '.xd-footer-copy:hover{background-color:rgba(255,255,255,0.1) !important;}' +
            '.ollama-helper-content{padding:14px !important;overflow-y:auto !important;flex-grow:1 !important;word-wrap:break-word !important;position:relative !important;}' +
            '.ollama-helper-content ul,.ollama-helper-content li{list-style:revert !important;margin-left:20px !important;padding-left:5px !important;}' +
            '.ollama-helper-content::-webkit-scrollbar{width:6px !important;}' +
            '.ollama-helper-content::-webkit-scrollbar-track{background:transparent !important;}' +
            '.ollama-helper-content::-webkit-scrollbar-thumb{background-color:rgba(255,255,255,0.15) !important;border-radius:3px !important;}' +
            '.xd-loader{box-sizing:border-box !important;border:3px solid rgba(255,255,255,0.1) !important;' +
            'border-top:3px solid var(--xd-border) !important;border-radius:50% !important;' +
            'width:28px !important;height:28px !important;animation:xd-spin 0.8s linear infinite !important;margin:20px auto !important;}' +
            '@keyframes xd-spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}' +
            '.xd-answer{font-size:18px !important;font-weight:700 !important;margin-bottom:10px !important;line-height:1.4 !important;}' +
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
            '.xd-latex{font-family:"Cambria Math","Latin Modern Math",serif !important;font-size:1.05em !important;}'
        );
    };
})();
