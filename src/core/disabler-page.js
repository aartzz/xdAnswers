(function() {
    'use strict';

    if (!location.hostname.includes('vseosvita.ua')) return;

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

    // 3. Neutralize requestFullscreen on Element prototype (all variants)
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

    // 5. Clear inline fullscreen handlers
    try {
        document.onfullscreenchange = null;
        document.onwebkitfullscreenchange = null;
        document.onmozfullscreenchange = null;
        document.onMSFullscreenChange = null;
    } catch (e) { /* ignore */ }

    // 6. Intercept addEventListener for fullscreen events (in page world!)
    const origAddEventListener = EventTarget.prototype.addEventListener;
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
            return origAddEventListener.call(this, type, wrapped, options);
        }
        return origAddEventListener.call(this, type, listener, options);
    };

    // 7. Patch Vue instances
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

    // 8. Add top padding to the test container so the fixed header doesn't cover timer/questions
    // when fullscreen is bypassed (viewport is shorter without fullscreen).
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
})();
