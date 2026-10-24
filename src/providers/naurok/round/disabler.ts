// src/providers/naurok/round/disabler.ts
// Page-world anti-detect for the Naurok olympiad route (/round/*). Bundled
// into the injected page disabler (see scripts/build.js) and gated on
// location.hostname + pathname.
//
// Round pages threaten to log blur/focus-leave events. Stop window/document
// level listeners for those signals from ever registering.
(function () {
    'use strict';

    if (location.hostname.indexOf('naurok') === -1) return;
    if ((location.pathname || '').indexOf('/round/') !== 0) return;

    try {
        const w = window as any;
        if (w.__xdAnswersNaurokRoundAntiDetect) return;
        w.__xdAnswersNaurokRoundAntiDetect = true;

        const roundAdd = EventTarget.prototype.addEventListener;
        const roundBlocked: Record<string, 1> = {
            blur: 1,
            focus: 1,
            focusin: 1,
            focusout: 1,
            mouseleave: 1,
            visibilitychange: 1,
            webkitvisibilitychange: 1
        };
        EventTarget.prototype.addEventListener = function (
            this: EventTarget,
            type: string,
            listener: EventListenerOrEventListenerObject,
            options?: boolean | AddEventListenerOptions
        ) {
            if (roundBlocked[type] && (this === window || this === document)) { return; }
            return roundAdd.call(this, type, listener, options);
        } as typeof EventTarget.prototype.addEventListener;
    } catch (e) { /* ignore */ }

    console.log('[xdAnswers Disabler] Round anti-detect active for naurok.ua/round/*');
})();
