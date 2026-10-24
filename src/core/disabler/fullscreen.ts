// @ts-nocheck — page-world module bundled into dist/disabler.js (see src/core/disabler/page.ts).
// Global fullscreen bypass, applied on all platforms.
export function installFullscreenBypass() {
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
}
