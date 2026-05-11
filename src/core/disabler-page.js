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
    //  VSEOSVITA SPECIFIC — Fullscreen bypass
    // ═══════════════════════════════════════════════════════════════════════════════
    if (isVseosvita) {
        // Spoof fullscreen support so isFullscreenSupported returns false
        try {
            Object.defineProperty(document, 'fullscreenEnabled', {
                get: function() { return false; },
                configurable: true
            });
            Object.defineProperty(document, 'mozFullscreenEnabled', {
                get: function() { return false; },
                configurable: true
            });
            Object.defineProperty(document, 'webkitFullscreenEnabled', {
                get: function() { return false; },
                configurable: true
            });
        } catch (e) { /* ignore */ }

        // Nullify fullscreenElement getters
        try {
            Object.defineProperty(document, 'fullscreenElement', {
                get: function() { return null; },
                configurable: true
            });
            Object.defineProperty(document, 'mozFullscreenElement', {
                get: function() { return null; },
                configurable: true
            });
            Object.defineProperty(document, 'webkitFullscreenElement', {
                get: function() { return null; },
                configurable: true
            });
        } catch (e) { /* ignore */ }

        // Neutralize requestFullscreen on Element prototype (all variants)
        const noopFullscreen = function() { return Promise.resolve(); };
        if (typeof Element.prototype.requestFullscreen === 'function') {
            Element.prototype.requestFullscreen = noopFullscreen;
        }
        if (typeof Element.prototype.requestFullScreen === 'function') {
            Element.prototype.requestFullScreen = noopFullscreen;
        }
        if (typeof Element.prototype.mozRequestFullScreen === 'function') {
            Element.prototype.mozRequestFullScreen = noopFullscreen;
        }
        if (typeof Element.prototype.webkitRequestFullScreen === 'function') {
            Element.prototype.webkitRequestFullScreen = noopFullscreen;
        }
        if (typeof Element.prototype.msRequestFullscreen === 'function') {
            Element.prototype.msRequestFullscreen = noopFullscreen;
        }

        // Neutralize cancel/exit methods
        if (typeof document.exitFullscreen === 'function') {
            document.exitFullscreen = function() { return Promise.resolve(); };
        }
        if (typeof document.mozCancelFullScreen === 'function') {
            document.mozCancelFullScreen = function() { return Promise.resolve(); };
        }
        if (typeof document.webkitCancelFullScreen === 'function') {
            document.webkitCancelFullScreen = function() { return Promise.resolve(); };
        }
        if (typeof document.cancelFullScreen === 'function') {
            document.cancelFullScreen = function() { return Promise.resolve(); };
        }

        // Clear inline fullscreen handlers
        try {
            document.onfullscreenchange = null;
            document.onwebkitfullscreenchange = null;
            document.onmozfullscreenchange = null;
            document.onMSFullscreenChange = null;
        } catch (e) { /* ignore */ }

        // Intercept addEventListener for fullscreen events (in page world!)
        const origAddEventListenerFS = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (type === 'fullscreenchange' || type === 'webkitfullscreenchange' || type === 'mozfullscreenchange' || type === 'MSFullscreenChange') {
                const wrapped = function(event) {
                    const originalFullscreenElement = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
                    try {
                        Object.defineProperty(document, 'fullscreenElement', {
                            get: function() { return null; },
                            configurable: true
                        });
                    } catch (e) {}
                    try {
                        listener.call(this, event);
                    } finally {
                        if (originalFullscreenElement) {
                            try {
                                Object.defineProperty(document, 'fullscreenElement', originalFullscreenElement);
                            } catch (e) {}
                        }
                    }
                };
                return origAddEventListenerFS.call(this, type, wrapped, options);
            }
            return origAddEventListenerFS.call(this, type, listener, options);
        };

        // Patch Vue instances
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

        console.log('[xdAnswers Disabler] Fullscreen checks neutralized on vseosvita.ua (page world)');
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //  NAUROK SPECIFIC — Anti-detect logging only
    // ═══════════════════════════════════════════════════════════════════════════════
    if (isNaurok) {
        console.log('[xdAnswers Disabler] Anti-detect active for naurok.ua');
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //  KAHOOT SPECIFIC — Anti-focus detection
    // ═══════════════════════════════════════════════════════════════════════════════
    if (isKahoot) {
        console.log('[xdAnswers Disabler] Anti-detect active for kahoot.it');
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

    console.log('[xdAnswers Disabler] Global anti-detect active (blur/focus/visibility bypass)');
})();
