// @ts-nocheck — page-world module bundled into dist/disabler.js (see src/core/disabler/page.ts).
// Hides tab switching and focus loss from page scripts.
export function installFocusBypass() {
    // 1. Blur/Focus bypass — prevent sites from detecting when user switches tabs
    try {
        const origAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            // Block blur/focus/visibility events that sites use for anti-cheat
            if (type === 'blur' || type === 'focus' || type === 'focusout' || type === 'focusin') {
                // Allow the event but wrap listener to prevent detection logic
                const wrapped = function(event) {
                    // Skip if this is a synthetic event from the site itself trying to detect tab switching
                    if (event && event.isTrusted === false) {
                        return;
                    }
                    return listener.call(this, event);
                };
                return origAddEventListener.call(this, type, wrapped, options);
            }
            return origAddEventListener.call(this, type, listener, options);
        };
    } catch (e) { /* ignore */ }

    // 2. Visibility API spoofing — always report page as visible
    try {
        Object.defineProperty(document, 'visibilityState', {
            get: function() { return 'visible'; },
            configurable: true
        });
        Object.defineProperty(document, 'hidden', {
            get: function() { return false; },
            configurable: true
        });
    } catch (e) { /* ignore */ }

    // 3. Intercept visibilitychange events
    try {
        const origAddEventListener2 = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (type === 'visibilitychange' || type === 'webkitvisibilitychange') {
                // Don't register visibilitychange listeners in page world
                // Sites use this to detect tab switching
                console.log('[xdAnswers Disabler] Blocked visibilitychange listener');
                return;
            }
            return origAddEventListener2.call(this, type, listener, options);
        };
    } catch (e) { /* ignore */ }

    // 4. window.onblur / window.onfocus — neutralize
    try {
        Object.defineProperty(window, 'onblur', {
            set: function() { /* ignore */ },
            configurable: true
        });
        Object.defineProperty(window, 'onfocus', {
            set: function() { /* ignore */ },
            configurable: true
        });
    } catch (e) { /* ignore */ }

    // 5. hasFocus() spoofing
    try {
        Document.prototype.hasFocus = function() { return true; };
    } catch (e) { /* ignore */ }
}
