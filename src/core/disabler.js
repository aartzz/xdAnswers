(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    const DEFAULT_SETTINGS = {
        disablerEnabled: false
    };

    function shouldApplyDisabler(callback) {
        try {
            chrome.storage.local.get('xdAnswers_settings', (data) => {
                let enabled = DEFAULT_SETTINGS.disablerEnabled;
                if (data && data.xdAnswers_settings) {
                    try {
                        const parsed = JSON.parse(data.xdAnswers_settings);
                        if (typeof parsed.disablerEnabled === 'boolean') {
                            enabled = parsed.disablerEnabled;
                        }
                    } catch (e) {}
                }
                callback(enabled);
            });
        } catch (e) {
            callback(DEFAULT_SETTINGS.disablerEnabled);
        }
    }

    function applyDisabler() {
        const settings = window.xdAnswers.settings || {};
        if (!settings.disablerEnabled) return;

        // Target domain check
        const hostname = location.hostname;
        if (!hostname.includes('vseosvita.ua')) return;

        // 1. Spoof fullscreen support so isFullscreenSupported returns false
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

        // 2. Nullify fullscreenElement getters
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

        // 3. Neutralize requestFullscreen on Element prototype
        if (typeof Element.prototype.requestFullscreen === 'function') {
            Element.prototype.requestFullscreen = function() {
                return Promise.resolve();
            };
        }
        if (typeof Element.prototype.mozRequestFullScreen === 'function') {
            Element.prototype.mozRequestFullScreen = function() {
                return Promise.resolve();
            };
        }
        if (typeof Element.prototype.webkitRequestFullScreen === 'function') {
            Element.prototype.webkitRequestFullScreen = function() {
                return Promise.resolve();
            };
        }

        // 4. Neutralize cancel/exit methods
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

        // 5. Remove fullscreenchange listeners that the site may have already attached
        // We can't enumerate them, but we can fire a fake event to trigger their handler
        // and then intercept addEventListener for future ones.
        const origAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (type === 'fullscreenchange' || type === 'webkitfullscreenchange' || type === 'mozfullscreenchange' || type === 'MSFullscreenChange') {
                // Wrap listener so it always sees is_full_screen_mode = false
                const wrapped = function(event) {
                    // Before calling the original listener, temporarily spoof fullscreenElement again
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
                return origAddEventListener.call(this, type, wrapped, options);
            }
            return origAddEventListener.call(this, type, listener, options);
        };

        // 6. Patch Vue instance if accessible — force is_full_screen_required and is_full_screen_mode to false
        function patchVueInstance() {
            const vueEls = document.querySelectorAll('*');
            for (const el of vueEls) {
                if (el.__vue__) {
                    const vm = el.__vue__;
                    if (typeof vm.is_full_screen_required !== 'undefined') {
                        vm.is_full_screen_required = false;
                    }
                    if (typeof vm.is_full_screen_mode !== 'undefined') {
                        vm.is_full_screen_mode = false;
                    }
                    if (typeof vm.isFullscreenRequired !== 'undefined') {
                        vm.isFullscreenRequired = false;
                    }
                    // Break after first found root instance
                    break;
                }
            }
        }

        // Try immediately and after delay
        patchVueInstance();
        setTimeout(patchVueInstance, 500);
        setTimeout(patchVueInstance, 1500);
        setTimeout(patchVueInstance, 3000);

        console.log('[xdAnswers Disabler] Fullscreen checks neutralized on vseosvita.ua');
    }

    function runIfEnabled() {
        shouldApplyDisabler((enabled) => {
            if (!enabled) return;
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', applyDisabler);
            } else {
                applyDisabler();
            }
        });
    }

    // Run as soon as possible
    runIfEnabled();

    // Also re-apply on settings update
    window.xdAnswers._applyDisabler = applyDisabler;
})();
