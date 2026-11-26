// src/providers/classtime/disabler.ts
// Page-world patches for Classtime. This file is bundled into the injected
// page disabler (see src/core/disabler/page.ts) and gates itself on hostname.
//
// Classtime's exam session has two client-side restrictions that get in the
// way of helping with a question:
//   * the essay editor cancels copy/cut/paste events unless the teacher enabled
//     external clipboard access, and blocks the Shift clipboard shortcuts;
//   * the running session registers a beforeunload warning.
// The global disabler already handles focus/visibility/fullscreen detection.
import { makeNative } from '../../core/disabler/stealth';

(function() {
    'use strict';

    if (!/(^|\.)classtime\.com$/.test(location.hostname)) return;

    // Let the browser perform copy, cut and paste. The page listens for these
    // events in the React capture phase and calls preventDefault(); stopping the
    // event at the window capture phase keeps the native clipboard behaviour.
    try {
        const clipboardEvents = ['copy', 'cut', 'paste'];
        for (const type of clipboardEvents) {
            window.addEventListener(type, function(event: Event) {
                event.stopImmediatePropagation();
            }, true);
        }
    } catch (e) { /* ignore */ }

    // Drop the "leave site?" guard. useBeforeunload attaches to window, so
    // ignoring that registration is enough; the inline handler is neutralized
    // separately for older code paths.
    try {
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = makeNative(function(this: any, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
            if ((this === window || this === document) && type === 'beforeunload') return;
            return originalAddEventListener.call(this, type, listener, options);
        }, 'addEventListener');
    } catch (e) { /* ignore */ }

    try {
        Object.defineProperty(window, 'onbeforeunload', {
            configurable: true,
            get: function() { return null; },
            set: function() { /* ignore */ }
        });
    } catch (e) { /* ignore */ }
})();
