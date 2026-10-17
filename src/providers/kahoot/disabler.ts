// src/providers/kahoot/disabler.ts
// Page-world patches for Kahoot. Bundled into the injected page disabler (see
// scripts/build.js) and gated on location.hostname.
//
// Kahoot injects a visual watermark marker for proctored tests. The marker
// should NOT be removed (that triggers detection), but its functional hooks
// must be neutralized so it doesn't affect submission behavior.
(function () {
    'use strict';

    if (location.hostname.indexOf('kahoot.it') === -1) return;

    // Block visibilitychange handlers (Kahoot uses them for focus-out detection)
    try {
        const w = window as any;
        if (!w.__xdAnswersKahootHooked) {
            w.__xdAnswersKahootHooked = true;
            const vcAdd = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function (
                this: EventTarget,
                type: string,
                listener: EventListenerOrEventListenerObject,
                options?: boolean | AddEventListenerOptions
            ) {
                if (type === 'visibilitychange' || type === 'webkitvisibilitychange') { return; }
                return vcAdd.call(this, type, listener, options);
            } as typeof EventTarget.prototype.addEventListener;
        }
    } catch (e) { /* ignore */ }

    // Prevent page from resetting input focus (Kahoot watermarks track this)
    try {
        const bhOrig = HTMLInputElement.prototype.blur;
        HTMLInputElement.prototype.blur = function (this: HTMLInputElement) {
            // Only block blur if no explicit user action is happening
            if (document.querySelector('[data-functional-selector*="answer"]')) {
                return; // ignore blur during answer flow
            }
            return bhOrig.apply(this, arguments as any);
        } as typeof HTMLInputElement.prototype.blur;
    } catch (e) { /* ignore */ }

    console.log('[xdAnswers Disabler] Anti-detect active for kahoot.it (watermark + blur bypass)');
})();
