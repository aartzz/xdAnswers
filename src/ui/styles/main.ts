// src/ui/styles/main.ts
// Injects the helper window CSS: base chrome first, then content blocks.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    function ensureMaterialSymbolsFont(): void {
        const fontUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL 
            ? chrome.runtime.getURL('lib/beercss/material-symbols-outlined.woff2') 
            : '';
        if (!fontUrl) return;

        if (typeof FontFace !== 'undefined' && document.fonts) {
            try {
                let exists = false;
                for (const f of document.fonts) {
                    if (f.family === 'Material Symbols Outlined') {
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    const face = new FontFace('Material Symbols Outlined', `url(${fontUrl})`, {
                        weight: 'normal',
                        style: 'normal',
                        display: 'block'
                    });
                    face.load().then(f => document.fonts.add(f)).catch(() => {});
                }
            } catch (e) {}
        }

        if (!document.querySelector('style[data-app-font]')) {
            try {
                const style = document.createElement('style');
                style.setAttribute('data-app-font', 'true');
                style.textContent = `@font-face{font-family:"Material Symbols Outlined";src:url("${fontUrl}") format("woff2");font-weight:normal;font-style:normal;font-display:block;}`;
                (document.head || document.documentElement).appendChild(style);
            } catch (e) {}
        }
    }
    I.ensureMaterialSymbolsFont = ensureMaterialSymbolsFont;
    ensureMaterialSymbolsFont();

    window.xdAnswers.updateHelperBaseStyles = function(): void {
        ensureMaterialSymbolsFont();

        const isMax = window.xdAnswers.isHelperWindowMaximized;
        const defaultHelperState = I.defaultHelperState;
        const maximizedHelperState = I.maximizedHelperState;

        const w = isMax ? maximizedHelperState.width : defaultHelperState.width;
        const h = isMax ? maximizedHelperState.height : defaultHelperState.height;
        const mh = isMax ? maximizedHelperState.maxHeight : defaultHelperState.maxHeight;

        if (window.xdAnswers.helperContainer) {
            window.xdAnswers.helperContainer.style.setProperty('z-index', String(I.uiTokens?.zIndex || 999999), 'important');
            window.xdAnswers.helperContainer.style.setProperty('width', w, 'important');
            window.xdAnswers.helperContainer.style.setProperty('height', h, 'important');
            window.xdAnswers.helperContainer.style.setProperty('max-height', mh, 'important');
        }

        const shadow = window.xdAnswers.shadowRoot;
        const css = I.buildHelperBaseCss() + I.buildHelperContentCss();
        if (shadow) {
            let el = shadow.querySelector<HTMLStyleElement>('style[data-s]');
            if (!el) {
                el = document.createElement('style');
                el.setAttribute('data-s', '1');
                shadow.prepend(el);
            }
            if (el.textContent !== css) el.textContent = css;
        } else {
            window.xdAnswers.addStyle(css);
        }
    };
})();
