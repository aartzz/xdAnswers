// @ts-nocheck — page-world module bundled into dist/disabler.js (see src/core/disabler/page.ts).
// Global fullscreen bypass, applied on all platforms.
import { makeNative, definePrototypeGetter } from './stealth';

export function installFullscreenBypass() {
    // ═══════════════════════════════════════════════════════════════════════════════
    //  GLOBAL FULLSCREEN BYPASS — applies to ALL platforms
    //  Educational platforms (vseosvita, naurok, classtime, etc.) check
    //  fullscreen availability and element state for anti-cheat detection.
    //  Properties are defined on Document.prototype to conform to Web API specs.
    // ═══════════════════════════════════════════════════════════════════════════════

    // 1. Spoof fullscreen support on Document.prototype
    definePrototypeGetter(Document.prototype, 'fullscreenEnabled', () => false, 'get fullscreenEnabled');
    if ('webkitFullscreenEnabled' in Document.prototype) {
        definePrototypeGetter(Document.prototype, 'webkitFullscreenEnabled', () => false, 'get webkitFullscreenEnabled');
    }
    if ('mozFullScreenEnabled' in Document.prototype) {
        definePrototypeGetter(Document.prototype, 'mozFullScreenEnabled', () => false, 'get mozFullScreenEnabled');
    }
    if ('msFullscreenEnabled' in Document.prototype) {
        definePrototypeGetter(Document.prototype, 'msFullscreenEnabled', () => false, 'get msFullscreenEnabled');
    }

    // 2. Nullify fullscreenElement getters on Document.prototype
    definePrototypeGetter(Document.prototype, 'fullscreenElement', () => null, 'get fullscreenElement');
    if ('webkitFullscreenElement' in Document.prototype) {
        definePrototypeGetter(Document.prototype, 'webkitFullscreenElement', () => null, 'get webkitFullscreenElement');
    }
    if ('mozFullScreenElement' in Document.prototype) {
        definePrototypeGetter(Document.prototype, 'mozFullScreenElement', () => null, 'get mozFullScreenElement');
    }
    if ('msFullscreenElement' in Document.prototype) {
        definePrototypeGetter(Document.prototype, 'msFullscreenElement', () => null, 'get msFullscreenElement');
    }

    // 3. Neutralize requestFullscreen — prevent programmatic fullscreen entry
    const noopFullscreen = makeNative(function() { return Promise.resolve(); }, 'requestFullscreen');
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

    // 4. Neutralize fullscreen exit methods
    const noopExit = makeNative(function() { return Promise.resolve(); }, 'exitFullscreen');
    try {
        if (typeof Document.prototype.exitFullscreen !== 'undefined') {
            Document.prototype.exitFullscreen = noopExit;
        }
        if (typeof Document.prototype.webkitExitFullscreen !== 'undefined') {
            Document.prototype.webkitExitFullscreen = noopExit;
        }
        if (typeof Document.prototype.mozCancelFullScreen !== 'undefined') {
            Document.prototype.mozCancelFullScreen = noopExit;
        }
        if (typeof Document.prototype.msExitFullscreen !== 'undefined') {
            Document.prototype.msExitFullscreen = noopExit;
        }
    } catch (e) { /* ignore */ }

    // 5. Clear inline fullscreen event handlers
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

    // 6. Intercept addEventListener for fullscreen events
    try {
        const origAddEventListenerFS = EventTarget.prototype.addEventListener;
        const FS_EVENTS = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange',
                           'fullscreenerror', 'webkitfullscreenerror', 'mozfullscreenerror', 'MSFullscreenError'];
        EventTarget.prototype.addEventListener = makeNative(function(type, listener, options) {
            if (FS_EVENTS.indexOf(type) !== -1) {
                const wrapped = function(event) {
                    try {
                        listener.call(this, event);
                    } catch (e) { /* ignore */ }
                };
                return origAddEventListenerFS.call(this, type, wrapped, options);
            }
            return origAddEventListenerFS.call(this, type, listener, options);
        }, 'addEventListener');
    } catch (e) { /* ignore */ }
}
