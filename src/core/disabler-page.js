(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════════
    //  PLATFORM DETECTION
    // ═══════════════════════════════════════════════════════════════════════════════
    const hostname = location.hostname;
    const isVseosvita = hostname.includes('vseosvita.ua');
    const isNaurok = hostname.includes('naurok.ua') || hostname.includes('naurok.com.ua');
    const isJustClass = hostname.includes('justclass.com.ua') || hostname.includes('justclass.me');
    const isClasstime = hostname.includes('classtime.com');
    const isMiyklas = hostname.includes('miyklas.com.ua');
    const isLcloud = hostname.includes('lcloud.in.ua');
    const isKahoot = hostname.includes('kahoot.it');

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
    //  VSEOSVITA SPECIFIC — Vue instance patches + layout fixes
    // ═══════════════════════════════════════════════════════════════════════════════
    if (isVseosvita) {
        // Patch Vue instances (vseosvita uses Vue with fullscreen computed properties)
        function patchVueInstance() {
            const vueEls = document.querySelectorAll('*');
            for (const el of vueEls) {
                if (el.__vue__) {
                    const vm = el.__vue__;
                    if (typeof vm.is_full_screen_required !== 'undefined') {
                        vm.is_full_screen_required = false;
                    }
                    if (typeof vm.is_full_screen_mode !== 'undefined') {
                        vm.is_full_screen_mode = true;
                    }
                    if (typeof vm.is_full_screen_listeners !== 'undefined') {
                        vm.is_full_screen_listeners = true;
                    }
                    if (typeof vm.is_full_screen_show_exit_dlg !== 'undefined') {
                        vm.is_full_screen_show_exit_dlg = false;
                    }
                    if (typeof vm.isFullscreenRequired !== 'undefined') {
                        vm.isFullscreenRequired = false;
                    }
                    try {
                        if (vm.$options && vm.$options.computed && vm.$options.computed.isFullscreenSupported) {
                            vm.$options.computed.isFullscreenSupported = function() { return false; };
                        }
                        if (vm._computedWatchers && vm._computedWatchers.isFullscreenSupported) {
                            vm._computedWatchers.isFullscreenSupported.value = false;
                            vm._computedWatchers.isFullscreenSupported.dirty = false;
                        }
                    } catch (e) { /* ignore */ }
                }
            }
        }

        patchVueInstance();
        setTimeout(patchVueInstance, 500);
        setTimeout(patchVueInstance, 1500);
        setTimeout(patchVueInstance, 3000);

        const hammerInterval = setInterval(function() {
            if (!location.hostname.includes('vseosvita.ua')) {
                clearInterval(hammerInterval);
                return;
            }
            patchVueInstance();
        }, 100);

        // Add top padding to the test container so the fixed header doesn't cover timer/questions
        function addTopPadding() {
            const style = document.createElement('style');
            style.textContent = `
                .v-test-go { padding-top: 60px !important; }
                .v-test-go-bg { margin-top: 10px !important; }
            `;
            (document.head || document.documentElement).appendChild(style);
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addTopPadding);
        } else {
            addTopPadding();
        }

        console.log('[xdAnswers Disabler] Fullscreen + Vue patches neutralized on vseosvita.ua (page world)');
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //  NAUROK SPECIFIC — Anti-detect logging only
    // ═══════════════════════════════════════════════════════════════════════════════
    if (isNaurok) {
        console.log('[xdAnswers Disabler] Anti-detect active for naurok.ua');
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //  KAHOOT SPECIFIC — Watermark bypass + focus detection
    //  Kahoot injects a visual watermark marker for proctored tests. The marker
    //  should NOT be removed (that triggers detection), but its functional hooks
    //  must be neutralized so it doesn't affect submission behavior.
    // ═══════════════════════════════════════════════════════════════════════════════
    if (isKahoot) {
        // Block visibilitychange handlers (Kahoot uses them for focus-out detection)
        try {
            var vcAdd = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                if (type === 'visibilitychange' || type === 'webkitvisibilitychange') { return; }
                return vcAdd.call(this, type, listener, options);
            };
        } catch (e) { /* ignore */ }

        // Prevent page from resetting input focus (Kahoot watermarks track this)
        try {
            var bhOrig = HTMLInputElement.prototype.blur;
            HTMLInputElement.prototype.blur = function() {
                // Only block blur if no explicit user action is happening
                if (document.querySelector('[data-functional-selector*="answer"]')) {
                    return; // ignore blur during answer flow
                }
                return bhOrig.apply(this, arguments);
            };
        } catch (e) { /* ignore */ }

        console.log('[xdAnswers Disabler] Anti-detect active for kahoot.it (watermark + blur bypass)');
    }

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
