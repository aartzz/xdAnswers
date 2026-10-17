// @ts-nocheck — page-world script injected by src/core/disabler-inject.ts via a
// <script src> tag, so it runs in the page context where it can monkey-patch
// non-standard browser APIs (webkit/moz/ms fullscreen members, prototype
// overrides, visibility state). Typing these overrides would require `any`
// casts on nearly every line, so the file is intentionally left unchecked.
//
// Provider-specific patches live in src/providers/<name>/disabler.ts and are
// bundled into this same page script (see scripts/build.js); they gate
// themselves on location.hostname.
(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════════
    //  GLOBAL ANTI-DETECT (all platforms)
    // ═══════════════════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════════════════
    //  GLOBAL FULLSCREEN BYPASS — applies to ALL platforms
    //  Many educational platforms (vseosvita, naurok, classtime, etc.) check
    //  fullscreen availability and element state for anti-cheat detection.
    // ═══════════════════════════════════════════════════════════════════════════════

    // 6. Spoof fullscreen support — always report fullscreen as unavailable
    try {
        Object.defineProperty(document, 'fullscreenEnabled', {
            get: function() { return false; },
            configurable: true
        });
        if (typeof document.webkitFullscreenEnabled !== 'undefined') {
            Object.defineProperty(document, 'webkitFullscreenEnabled', {
                get: function() { return false; },
                configurable: true
            });
        }
        if (typeof document.mozFullScreenEnabled !== 'undefined') {
            Object.defineProperty(document, 'mozFullScreenEnabled', {
                get: function() { return false; },
                configurable: true
            });
        }
        // mS prefixes
        if (typeof document.msFullscreenEnabled !== 'undefined') {
            Object.defineProperty(document, 'msFullscreenEnabled', {
                get: function() { return false; },
                configurable: true
            });
        }
    } catch (e) { /* ignore */ }

    // 7. Nullify fullscreenElement getters — always report nothing is fullscreened
    try {
        Object.defineProperty(document, 'fullscreenElement', {
            get: function() { return null; },
            configurable: true
        });
        if (typeof document.webkitFullscreenElement !== 'undefined') {
            Object.defineProperty(document, 'webkitFullscreenElement', {
                get: function() { return null; },
                configurable: true
            });
        }
        if (typeof document.mozFullScreenElement !== 'undefined') {
            Object.defineProperty(document, 'mozFullScreenElement', {
                get: function() { return null; },
                configurable: true
            });
        }
        if (typeof document.msFullscreenElement !== 'undefined') {
            Object.defineProperty(document, 'msFullscreenElement', {
                get: function() { return null; },
                configurable: true
            });
        }
    } catch (e) { /* ignore */ }

    // 8. Neutralize requestFullscreen — prevent programmatic fullscreen entry
    const noopFullscreen = function() { return Promise.resolve(); };
    try {
        if (typeof Element.prototype.requestFullscreen !== 'undefined') {
            Element.prototype.requestFullscreen = noopFullscreen;
        }
        if (typeof Element.prototype.webkitRequestFullscreen !== 'undefined') {
            Element.prototype.webkitRequestFullscreen = noopFullscreen;
        }
        if (typeof Element.prototype.mozRequestFullScreen !== 'undefined') {
            Element.prototype.mozRequestFullScreen = noopFullscreen;
        }
        if (typeof Element.prototype.msRequestFullscreen !== 'undefined') {
            Element.prototype.msRequestFullscreen = noopFullscreen;
        }
    } catch (e) { /* ignore */ }

    // 9. Neutralize fullscreen exit methods
    try {
        if (typeof document.exitFullscreen !== 'undefined') {
            document.exitFullscreen = function() { return Promise.resolve(); };
        }
        if (typeof document.webkitExitFullscreen !== 'undefined') {
            document.webkitExitFullscreen = function() { return Promise.resolve(); };
        }
        if (typeof document.mozCancelFullScreen !== 'undefined') {
            document.mozCancelFullScreen = function() { return Promise.resolve(); };
        }
        if (typeof document.msExitFullscreen !== 'undefined') {
            document.msExitFullscreen = function() { return Promise.resolve(); };
        }
    } catch (e) { /* ignore */ }

    // 10. Clear inline fullscreen event handlers
    try {
        document.onfullscreenchange = null;
        document.onfullscreenerror = null;
        document.onwebkitfullscreenchange = null;
        document.onwebkitfullscreenerror = null;
        document.onmozfullscreenchange = null;
        document.onmozfullscreenerror = null;
        document.onMSFullscreenChange = null;
        document.onMSFullscreenError = null;
    } catch (e) { /* ignore */ }

    // 11. Intercept addEventListener for fullscreen events — block them globally
    try {
        const origAddEventListenerFS = EventTarget.prototype.addEventListener;
        const FS_EVENTS = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange',
                           'fullscreenerror', 'webkitfullscreenerror', 'mozfullscreenerror', 'MSFullscreenError'];
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (FS_EVENTS.indexOf(type) !== -1) {
                var wrapped = function(event) {
                    var desc = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
                    try {
                        if (typeof document.fullscreenElement !== 'undefined') {
                            Object.defineProperty(document, 'fullscreenElement', {
                                get: function() { return null; },
                                configurable: true
                            });
                        }
                        if (typeof document.webkitFullscreenElement !== 'undefined') {
                            Object.defineProperty(document, 'webkitFullscreenElement', {
                                get: function() { return null; },
                                configurable: true
                            });
                        }
                    } catch (e) {}
                    try {
                        listener.call(this, event);
                    } finally {
                        if (desc) {
                            try { Object.defineProperty(document, 'fullscreenElement', desc); } catch (e) {}
                        }
                    }
                };
                return origAddEventListenerFS.call(this, type, wrapped, options);
            }
            return origAddEventListenerFS.call(this, type, listener, options);
        };
    } catch (e) { /* ignore */ }

    // ═══════════════════════════════════════════════════════════════════════════════
    //  GENERAL: Block common detection techniques
    // ═══════════════════════════════════════════════════════════════════════════════

    // Prevent sites from using performance.now() for timing analysis
    try {
        const origPerformanceNow = performance.now.bind(performance);
        let lastNow = 0;
        performance.now = function() {
            const now = origPerformanceNow();
            // Add tiny jitter to prevent timing-based bot detection
            lastNow = Math.max(lastNow, now);
            return lastNow;
        };
    } catch (e) { /* ignore */ }

    console.log('[xdAnswers Disabler] Global anti-detect active (blur/focus/visibility/fullscreen bypass)');
})();
