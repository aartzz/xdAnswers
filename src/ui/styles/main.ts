// src/ui/styles/main.ts
// Injects the helper window CSS: base chrome first, then content blocks.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    window.xdAnswers.updateHelperBaseStyles = function(): void {
        window.xdAnswers.addStyle(I.buildHelperBaseCss() + I.buildHelperContentCss());
    };
})();
