// src/ui/styles/main.ts
// Injects the helper window CSS: base chrome first, then content blocks.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    window.xdAnswers.updateHelperBaseStyles = function(): void {
        const isMax = window.xdAnswers.isHelperWindowMaximized;
        const defaultHelperState = I.defaultHelperState;
        const maximizedHelperState = I.maximizedHelperState;

        const w = isMax ? maximizedHelperState.width : defaultHelperState.width;
        const h = isMax ? maximizedHelperState.height : defaultHelperState.height;
        const mh = isMax ? maximizedHelperState.maxHeight : defaultHelperState.maxHeight;

        if (window.xdAnswers.helperContainer) {
            window.xdAnswers.helperContainer.style.setProperty('width', w, 'important');
            window.xdAnswers.helperContainer.style.setProperty('height', h, 'important');
            window.xdAnswers.helperContainer.style.setProperty('max-height', mh, 'important');
        }

        const shadow = window.xdAnswers.shadowRoot;
        const css = I.buildHelperBaseCss() + I.buildHelperContentCss();
        if (shadow) {
            let el = shadow.querySelector<HTMLStyleElement>('style[data-helper-style]');
            if (!el) {
                el = document.createElement('style');
                el.setAttribute('data-helper-style', 'true');
                shadow.prepend(el);
            }
            if (el.textContent !== css) el.textContent = css;
        } else {
            window.xdAnswers.addStyle(css);
        }
    };
})();
