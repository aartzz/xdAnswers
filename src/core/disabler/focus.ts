// @ts-nocheck — page-world module bundled into dist/disabler.js (see src/core/disabler/page.ts).
// Hides tab switching and focus loss from page scripts.
import { makeNative, definePrototypeGetter } from './stealth';

export function installFocusBypass() {
    // 1. Blur/Focus & Visibility bypass — prevent sites from detecting when user switches tabs
    try {
        const origAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = makeNative(function(type, listener, options) {
            // Drop visibilitychange listeners in page world
            if (type === 'visibilitychange' || type === 'webkitvisibilitychange') {
                return;
            }
            // Block blur/focus/visibility events that sites use for anti-cheat
            if (type === 'blur' || type === 'focus' || type === 'focusout' || type === 'focusin') {
                // Window/document focus tracking is the tab-switch signal used by
                // exam pages. Element-level focus handlers keep working.
                if (this === window || this === document) {
                    return;
                }
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
        }, 'addEventListener');
    } catch (e) { /* ignore */ }

    // 1b. Copy/cut/context-menu guards — keep the browser defaults, but stop
    // page handlers from turning the action into an anti-cheat violation.
    try {
        const guarded = ['contextmenu', 'copy', 'cut'];
        for (const type of guarded) {
            window.addEventListener(type, function(event: Event) {
                event.stopImmediatePropagation();
            }, true);
        }
    } catch (e) { /* ignore */ }

    // 1c. Keyboard guard — PrintScreen and devtools shortcuts must not reach
    // the page's keydown/keyup listeners. Browser shortcuts still work.
    try {
        const devtoolsKeys = ['i', 'j', 'c', 'k'];
        const guardKey = function(event: KeyboardEvent) {
            const key = (event.key || '').toLowerCase();
            const devtools = key === 'f12' ||
                (event.ctrlKey && event.shiftKey && devtoolsKeys.includes(key)) ||
                (event.ctrlKey && key === 'u');
            if (event.key === 'PrintScreen' || devtools) {
                event.stopImmediatePropagation();
            }
        };
        window.addEventListener('keydown', guardKey, true);
        window.addEventListener('keyup', guardKey, true);
    } catch (e) { /* ignore */ }

    // 2. Visibility API spoofing — defined on Document.prototype (HTML spec), never on document instance
    definePrototypeGetter(Document.prototype, 'visibilityState', () => 'visible', 'get visibilityState');
    definePrototypeGetter(Document.prototype, 'hidden', () => false, 'get hidden');

    // 3. window.onblur / window.onfocus — neutralize
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

    // 4. hasFocus() spoofing — marked native to pass cheat detection
    try {
        Document.prototype.hasFocus = makeNative(function() { return true; }, 'hasFocus');
    } catch (e) { /* ignore */ }
}
