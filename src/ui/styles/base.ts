// src/ui/styles/base.ts
// Helper window base CSS: theme tokens, font, container, header, footer and content chrome.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    I.buildHelperBaseCss = function(): string {
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

        return (fontUrl ? '@font-face { font-family: "Material Symbols Outlined"; src: url("' + fontUrl + '") format("woff2"); font-weight: normal; font-style: normal; font-display: block; }\n' : '') +
            ':host, :root {' +
            '--xd-bg:' + custom.contentColor + ';--xd-border:' + custom.borderColor + ';' +
            '--xd-text:' + custom.textColor + ';--xd-header:' + custom.headerColor + ';' +
            '--xd-glow:' + (custom.glowEffect ? '0 0 8px ' + custom.borderColor : 'none') + ';' +
            '--xd-font:Roboto,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
            '}' +
            ':host{margin:0 !important;padding:0 !important;border:none !important;box-sizing:border-box !important;contain:layout style !important;}' +
            '.xd-icon,.app-icon{font-family:"Material Symbols Outlined" !important;font-weight:normal !important;font-style:normal !important;font-size:16px !important;line-height:1 !important;letter-spacing:normal !important;text-transform:none !important;display:inline-block !important;white-space:nowrap !important;word-wrap:normal !important;direction:ltr !important;-webkit-font-smoothing:antialiased !important;font-feature-settings:"liga" 1 !important;-webkit-font-feature-settings:"liga" 1 !important;font-variant-ligatures:normal !important;vertical-align:middle !important;}' +
            '.app-panel,.ollama-helper-container{margin:0;padding:0;border:none;font-weight:normal;text-align:left;transform:none;' +
            'width:100% !important;height:100% !important;max-height:inherit !important;' +
            'display:flex !important;flex-direction:column !important;' +
            'background-color:' + containerBg + ' !important;border:none !important;' +
            (isM3 ? 'backdrop-filter:blur(16px) !important;-webkit-backdrop-filter:blur(16px) !important;' : '') +
            'border-radius:' + borderRadius + ' !important;box-shadow:' + boxShadow + ' !important;color:var(--xd-text) !important;' +
            'font-family:var(--xd-font) !important;font-size:14px !important;line-height:1.5 !important;overflow:hidden !important;' +
            'contain:paint !important;isolation:isolate !important;background-clip:padding-box !important;' +
            'clip-path:inset(0 round ' + borderRadius + ') !important;' +
            '}' +
            '.app-panel *:not(.xd-loader):not(.app-spinner):not(.app-bar):not(.ollama-helper-header):not(.app-footer):not(.ollama-helper-footer),.ollama-helper-container *:not(.xd-loader):not(.app-spinner):not(.app-bar):not(.ollama-helper-header):not(.app-footer):not(.ollama-helper-footer){' +
            'all:revert !important;appearance:none !important;-webkit-appearance:none !important;-moz-appearance:none !important;' +
            'font-family:var(--xd-font) !important;font-size:inherit !important;line-height:inherit !important;' +
            'color:var(--xd-text) !important;box-sizing:border-box !important;margin:0 !important;padding:0 !important;' +
            'background:none !important;border:none !important;}' +
            '.app-bar,.ollama-helper-header{display:flex !important;justify-content:space-between !important;align-items:center !important;' +
            'padding:12px 16px !important;background-color:' + headerBg + ' !important;' +
            'border-bottom:' + (isM3 ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.06)') + ' !important;border-radius:' + headerRadius + ' !important;cursor:move !important;user-select:none !important;}' +
            '.app-title,.ollama-header-title{font-weight:600 !important;margin-right:auto !important;font-size:14px !important;letter-spacing:0.2px !important;}' +
            '.app-version,.xd-version{font-weight:400 !important;font-size:10px !important;opacity:0.5 !important;margin-left:4px !important;vertical-align:middle !important;}' +
            '.app-actions,.ollama-header-buttons{display:flex !important;align-items:center !important;gap:6px !important;}' +
            '.app-actions button,.ollama-header-buttons button{all:revert !important;background:rgba(255,255,255,0.06) !important;border:1px solid rgba(255,255,255,0.08) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:13px !important;' +
            'border-radius:' + btnRadius + ' !important;cursor:pointer !important;width:30px !important;height:30px !important;' +
            'padding:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;line-height:1 !important;transition:all 0.15s cubic-bezier(0.2, 0, 0, 1) !important;}' +
            '.app-actions button:hover,.ollama-header-buttons button:hover{background-color:rgba(255,255,255,0.12) !important;border-color:rgba(255,255,255,0.18) !important;}' +
            '#btn-silent.active,#silent-mode-btn.active{background:rgba(255,255,255,0.2) !important;border-color:rgba(255,255,255,0.4) !important;}' +
            '#sel-silent,#silent-mode-inline-select{all:revert !important;background:rgba(0,0,0,0.25) !important;border:1px solid rgba(255,255,255,0.15) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:11px !important;' +
            'border-radius:' + (isM3 ? '16px' : '6px') + ' !important;cursor:pointer !important;margin-left:4px !important;height:28px !important;' +
            'padding:0 6px !important;line-height:1 !important;display:none !important;}' +
            '#sel-silent option,#silent-mode-inline-select option{background:var(--xd-bg) !important;color:var(--xd-text) !important;}' +
            '.app-footer,.ollama-helper-footer{display:flex !important;justify-content:space-between !important;align-items:center !important;' +
            'padding:10px 16px !important;background-color:' + footerBg + ' !important;' +
            'border-top:' + (isM3 ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.06)') + ' !important;border:none !important;' +
            'border-radius:' + footerRadius + ' !important;background-clip:padding-box !important;' +
            'min-height:36px !important;position:relative !important;overflow:hidden !important;}' +
            '.app-time,.xd-footer-elapsed{font-size:11px !important;opacity:0.6 !important;font-variant-numeric:tabular-nums !important;pointer-events:none !important;flex-shrink:0 !important;min-width:48px !important;z-index:1 !important;}' +
            '.app-model,.xd-footer-model{font-size:11px !important;opacity:0.5 !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;' +
            'position:absolute !important;left:50% !important;transform:translateX(-50%) !important;max-width:60% !important;pointer-events:none !important;z-index:0 !important;font-weight:500 !important;}' +
            '.app-copy,.xd-footer-copy{all:revert !important;background:rgba(255,255,255,0.06) !important;border:1px solid rgba(255,255,255,0.08) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:13px !important;' +
            'border-radius:' + (isM3 ? '50%' : '6px') + ' !important;cursor:pointer !important;width:30px !important;height:30px !important;display:flex !important;' +
            'align-items:center !important;justify-content:center !important;line-height:1 !important;flex-shrink:0 !important;transition:all 0.15s cubic-bezier(0.2, 0, 0, 1) !important;}' +
            '.app-copy:hover,.xd-footer-copy:hover{background-color:rgba(255,255,255,0.12) !important;}' +
            '.app-view,.ollama-helper-content{padding:16px !important;overflow-y:auto !important;flex-grow:1 !important;word-wrap:break-word !important;position:relative !important;}' +
            '.app-view ul,.app-view li,.ollama-helper-content ul,.ollama-helper-content li{list-style:revert !important;margin-left:20px !important;padding-left:5px !important;}' +
            '.app-view::-webkit-scrollbar,.ollama-helper-content::-webkit-scrollbar{width:5px !important;}' +
            '.app-view::-webkit-scrollbar-track,.ollama-helper-content::-webkit-scrollbar-track{background:transparent !important;}' +
            '.app-view::-webkit-scrollbar-thumb,.ollama-helper-content::-webkit-scrollbar-thumb{background-color:rgba(255,255,255,0.18) !important;border-radius:10px !important;}' +
            '.app-spinner,.xd-loader{box-sizing:border-box !important;border:3px solid rgba(255,255,255,0.1) !important;' +
            'border-top:3px solid var(--xd-border) !important;border-radius:50% !important;' +
            'width:32px !important;height:32px !important;animation:xd-spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;margin:24px auto !important;}' +
            '@keyframes xd-spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}';
    };
})();
