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
        const themeEngine = window.xdAnswers.settings.themeEngine || 'material3';
        const isM3 = themeEngine === 'material3';
        const borderRadius = isM3 ? '24px' : '12px';
        const headerRadius = isM3 ? '24px 24px 0 0' : '12px 12px 0 0';
        const footerRadius = isM3 ? '0 0 24px 24px' : '0 0 12px 12px';
        const btnRadius = isM3 ? '50%' : '6px';

        // Material You tinted background: subtle tint from borderColor (accent color)
        let containerBg = 'var(--xd-bg)';
        if (isM3) {
            const hex = (custom.borderColor || '#3b82f6').replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16) || 59;
            const g = parseInt(hex.substring(2, 4), 16) || 130;
            const b = parseInt(hex.substring(4, 6), 16) || 246;
            // Check if dark theme contentColor
            const baseC = (custom.contentColor || '#1c1c1c').replace('#', '');
            const br = parseInt(baseC.substring(0, 2), 16) || 28;
            const bg = parseInt(baseC.substring(2, 4), 16) || 28;
            const bb = parseInt(baseC.substring(4, 6), 16) || 28;
            const isDark = ((0.299 * br + 0.587 * bg + 0.114 * bb) / 255) < 0.45;

            if (isDark) {
                // Dark mode: blend 6% accent tint into #18191e base
                const tr = Math.round(24 * 0.94 + r * 0.06);
                const tg = Math.round(25 * 0.94 + g * 0.06);
                const tb = Math.round(30 * 0.94 + b * 0.06);
                containerBg = 'rgba(' + tr + ', ' + tg + ', ' + tb + ', 0.94)';
            } else {
                // Light mode: blend 6% accent tint into #f6f8fb base
                const tr = Math.round(246 * 0.94 + r * 0.06);
                const tg = Math.round(248 * 0.94 + g * 0.06);
                const tb = Math.round(251 * 0.94 + b * 0.06);
                containerBg = 'rgba(' + tr + ', ' + tg + ', ' + tb + ', 0.95)';
            }
        }

        const headerBg = isM3 ? 'transparent' : 'var(--xd-header)';
        const footerBg = isM3 ? 'transparent' : 'var(--xd-header)';
        const boxShadow = isM3 
            ? '0 12px 40px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.08)' 
            : 'inset 0 0 0 1px var(--xd-border),var(--xd-glow),0 4px 24px rgba(0,0,0,0.4)';

        const fontUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL 
            ? chrome.runtime.getURL('lib/beercss/material-symbols-outlined.woff2') 
            : '';

        window.xdAnswers.addStyle(
            (fontUrl ? '@font-face { font-family: "Material Symbols Outlined"; src: url("' + fontUrl + '") format("woff2"); font-weight: normal; font-style: normal; font-display: block; }\n' : '') +
            ':root {' +
            '--xd-bg:' + custom.contentColor + ';--xd-border:' + custom.borderColor + ';' +
            '--xd-text:' + custom.textColor + ';--xd-header:' + custom.headerColor + ';' +
            '--xd-glow:' + (custom.glowEffect ? '0 0 8px ' + custom.borderColor : 'none') + ';' +
            '--xd-font:Roboto,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
            '}' +
            '.xd-icon{font-family:"Material Symbols Outlined" !important;font-weight:normal !important;font-style:normal !important;font-size:16px !important;line-height:1 !important;letter-spacing:normal !important;text-transform:none !important;display:inline-block !important;white-space:nowrap !important;word-wrap:normal !important;direction:ltr !important;-webkit-font-smoothing:antialiased !important;font-feature-settings:"liga" !important;vertical-align:middle !important;}' +
            '.ollama-helper-container{margin:0;padding:0;border:none;font-weight:normal;text-align:left;transform:none;' +
            'position:fixed !important;z-index:2147483647 !important;display:flex !important;flex-direction:column !important;' +
            'background-color:' + containerBg + ' !important;border:none !important;' +
            (isM3 ? 'backdrop-filter:blur(16px) !important;-webkit-backdrop-filter:blur(16px) !important;' : '') +
            'border-radius:' + borderRadius + ' !important;box-shadow:' + boxShadow + ' !important;color:var(--xd-text) !important;' +
            'font-family:var(--xd-font) !important;font-size:14px !important;line-height:1.5 !important;overflow:hidden !important;' +
            'contain:paint !important;isolation:isolate !important;background-clip:padding-box !important;' +
            'clip-path:inset(0 round ' + borderRadius + ') !important;' +
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
            'padding:12px 16px !important;background-color:' + headerBg + ' !important;' +
            'border-bottom:' + (isM3 ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.06)') + ' !important;border-radius:' + headerRadius + ' !important;cursor:move !important;user-select:none !important;}' +
            '.ollama-header-title{font-weight:600 !important;margin-right:auto !important;font-size:14px !important;letter-spacing:0.2px !important;}' +
            '.xd-version{font-weight:400 !important;font-size:10px !important;opacity:0.5 !important;margin-left:4px !important;vertical-align:middle !important;}' +
            '.ollama-header-buttons{display:flex !important;align-items:center !important;gap:6px !important;}' +
            '.ollama-header-buttons button{all:revert !important;background:rgba(255,255,255,0.06) !important;border:1px solid rgba(255,255,255,0.08) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:13px !important;' +
            'border-radius:' + btnRadius + ' !important;cursor:pointer !important;width:30px !important;height:30px !important;' +
            'padding:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;line-height:1 !important;transition:all 0.15s cubic-bezier(0.2, 0, 0, 1) !important;}' +
            '.ollama-header-buttons button:hover{background-color:rgba(255,255,255,0.12) !important;border-color:rgba(255,255,255,0.18) !important;}' +
            '#silent-mode-btn.active{background:rgba(255,255,255,0.2) !important;border-color:rgba(255,255,255,0.4) !important;}' +
            '#silent-mode-inline-select{all:revert !important;background:rgba(0,0,0,0.25) !important;border:1px solid rgba(255,255,255,0.15) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:11px !important;' +
            'border-radius:' + (isM3 ? '16px' : '6px') + ' !important;cursor:pointer !important;margin-left:4px !important;height:28px !important;' +
            'padding:0 6px !important;line-height:1 !important;display:none !important;}' +
            '#silent-mode-inline-select option{background:var(--xd-bg) !important;color:var(--xd-text) !important;}' +
            '.ollama-helper-footer{display:flex !important;justify-content:space-between !important;align-items:center !important;' +
            'padding:10px 16px !important;background-color:' + footerBg + ' !important;' +
            'border-top:' + (isM3 ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.06)') + ' !important;border:none !important;' +
            'border-radius:' + footerRadius + ' !important;background-clip:padding-box !important;' +
            'min-height:36px !important;position:relative !important;overflow:hidden !important;}' +
            '.xd-footer-elapsed{font-size:11px !important;opacity:0.6 !important;font-variant-numeric:tabular-nums !important;pointer-events:none !important;flex-shrink:0 !important;min-width:48px !important;z-index:1 !important;}' +
            '.xd-footer-model{font-size:11px !important;opacity:0.5 !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;' +
            'position:absolute !important;left:50% !important;transform:translateX(-50%) !important;max-width:60% !important;pointer-events:none !important;z-index:0 !important;font-weight:500 !important;}' +
            '.xd-footer-copy{all:revert !important;background:rgba(255,255,255,0.06) !important;border:1px solid rgba(255,255,255,0.08) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:13px !important;' +
            'border-radius:' + (isM3 ? '50%' : '6px') + ' !important;cursor:pointer !important;width:30px !important;height:30px !important;display:flex !important;' +
            'align-items:center !important;justify-content:center !important;line-height:1 !important;flex-shrink:0 !important;transition:all 0.15s cubic-bezier(0.2, 0, 0, 1) !important;}' +
            '.xd-footer-copy:hover{background-color:rgba(255,255,255,0.12) !important;}' +
            '.ollama-helper-content{padding:16px !important;overflow-y:auto !important;flex-grow:1 !important;word-wrap:break-word !important;position:relative !important;}' +
            '.ollama-helper-content ul,.ollama-helper-content li{list-style:revert !important;margin-left:20px !important;padding-left:5px !important;}' +
            '.ollama-helper-content::-webkit-scrollbar{width:5px !important;}' +
            '.ollama-helper-content::-webkit-scrollbar-track{background:transparent !important;}' +
            '.ollama-helper-content::-webkit-scrollbar-thumb{background-color:rgba(255,255,255,0.18) !important;border-radius:10px !important;}' +
            '.xd-loader{box-sizing:border-box !important;border:3px solid rgba(255,255,255,0.1) !important;' +
            'border-top:3px solid var(--xd-border) !important;border-radius:50% !important;' +
            'width:32px !important;height:32px !important;animation:xd-spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;margin:24px auto !important;}' +
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
            '.xd-consensus-agreement{font-variant-numeric:tabular-nums !important;opacity:0.7 !important;margin-left:auto !important;}'
        );
    };
})();
