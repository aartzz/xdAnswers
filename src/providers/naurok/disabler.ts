// src/providers/naurok/disabler.ts
// Page-world interception for the Naurok provider. This file is bundled into
// the injected page disabler (see scripts/build.js) and gated on
// location.hostname, so it only patches Naurok pages.
//
// Legacy Angular: wraps fetch/XHR to capture /api2/test/sessions/ payloads
// (test topic and session id) and forwards them through the xd-disabler bridge.
//
// test-beta: adds the React app's anti-cheat handling:
//   * /test-beta/api/session is forwarded so the provider can read question
//     types and structured option data;
//   * /test-beta/api/focus is dropped (teacher telemetry: fullscreen exits,
//     tab switches and away time);
//   * fullscreen/visibility checks are neutralized and the fullscreen gate is
//     dismissed automatically, so the test does not block on a modal.
(function () {
    'use strict';

    if (location.hostname.indexOf('naurok') === -1) return;

    const BETA_SESSION_RE = /\/test-beta\/api\/session(?:\?|$)/;
    const BETA_FOCUS_RE = /\/test-beta\/api\/focus(?:\?|$)/;
    const LEGACY_SESSION_RE = /\/api2\/test\/sessions\//;
    const isBetaPage = /^\/test-beta\//.test(location.pathname);

    function postPayload(json: unknown, type: string): void {
        try {
            window.postMessage({
                source: 'xd-disabler',
                provider: 'naurok',
                type,
                payload: json
            }, '*');
        } catch (e) { /* payload not structured-cloneable */ }
    }

    function blockedFocusResponse(): Response {
        return new Response('{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    function installBetaFullscreenBypass(): void {
        if (!isBetaPage) return;
        try {
            Object.defineProperty(document, 'fullscreenEnabled', {
                get: function () { return true; },
                configurable: true
            });
            Object.defineProperty(document, 'fullscreenElement', {
                get: function () { return document.documentElement; },
                configurable: true
            });
            Object.defineProperty(document, 'webkitFullscreenElement', {
                get: function () { return document.documentElement; },
                configurable: true
            });
            const noop = function () { return Promise.resolve(); };
            const docProto = Document.prototype as any;
            const elProto = Element.prototype as any;
            docProto.exitFullscreen = noop;
            if ('webkitExitFullscreen' in docProto) docProto.webkitExitFullscreen = noop;
            elProto.requestFullscreen = noop;
            if ('webkitRequestFullscreen' in elProto) elProto.webkitRequestFullscreen = noop;

            // The global disabler deliberately lets fullscreenchange listeners
            // run with a null element; test-beta reacts to that by showing the
            // "you left fullscreen" alert and posting telemetry. Drop the
            // listener registration on test pages instead.
            const origAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
                if (type === 'fullscreenchange' || type === 'webkitfullscreenchange') return;
                // Window/document blur and pagehide are classic unfocus
                // telemetry triggers. Keep element-level blur/focusout intact
                // because React uses them for input state.
                if ((this === window || this === document) && (type === 'blur' || type === 'pagehide')) return;
                return origAddEventListener.call(this, type, listener, options);
            };
        } catch (e) { /* property patch failed */ }
    }

    function dismissBetaFocusGate(): void {
        if (!isBetaPage) return;
        const gate = document.querySelector<HTMLElement>('.tb-focus');
        if (!gate || gate.getClientRects().length === 0) return;
        const button = gate.querySelector<HTMLButtonElement>('.tb-focus-box .tb-btn-go');
        if (!button) return;
        console.log('[xdAnswers/naurok] Dismissing test-beta fullscreen gate');
        button.click();
    }

    function installBetaGateDismisser(): void {
        if (!isBetaPage) return;
        const observer = new MutationObserver(() => {
            window.setTimeout(dismissBetaFocusGate, 30);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        document.addEventListener('DOMContentLoaded', dismissBetaFocusGate);
        window.setTimeout(dismissBetaFocusGate, 600);
        window.setTimeout(dismissBetaFocusGate, 2000);
    }

    // ── Intercept window.fetch ────────────────────────────────────────
    try {
        const w = window as any;
        const origFetch = window.fetch;
        if (origFetch && !w.__xdAnswersNaurokFetchHooked) {
            w.__xdAnswersNaurokFetchHooked = true;
            w.fetch = function (this: any, input: any, init?: any) {
                const url = (typeof input === 'string') ? input : (input && input.url) || '';
                if (BETA_FOCUS_RE.test(url)) {
                    console.log('[xdAnswers/naurok] Blocked test-beta focus telemetry:', url);
                    return Promise.resolve(blockedFocusResponse());
                }
                const promise = origFetch.apply(this, arguments as any);
                if (url && LEGACY_SESSION_RE.test(url)) {
                    console.log('[xdAnswers/naurok] Fetch intercepted:', url);
                    promise.then((resp: Response) => {
                        try {
                            resp.clone().json().then(json => {
                                postPayload(json, 'session-payload');
                            }).catch(() => {});
                        } catch (e) { /* clone failed */ }
                    }).catch(() => {});
                } else if (url && BETA_SESSION_RE.test(url)) {
                    console.log('[xdAnswers/naurok] test-beta session intercepted:', url);
                    promise.then((resp: Response) => {
                        try {
                            resp.clone().json().then(json => {
                                postPayload(json, 'beta-session');
                            }).catch(() => {});
                        } catch (e) { /* clone failed */ }
                    }).catch(() => {});
                }
                return promise;
            };
        }
    } catch (e) { /* fetch patch failed */ }

    // ── Intercept XMLHttpRequest (AngularJS $http uses XHR, not fetch) ──
    try {
        const proto = XMLHttpRequest.prototype as any;
        const w = window as any;
        const origOpen = proto.open;
        const origSend = proto.send;
        if (!w.__xdAnswersNaurokXHRHooked) {
            w.__xdAnswersNaurokXHRHooked = true;
            proto.open = function (this: any, method: string, url: string) {
                this.__xdUrl = url;
                return origOpen.apply(this, arguments as any);
            };
            proto.send = function (this: any) {
                if (this.__xdUrl && BETA_FOCUS_RE.test(this.__xdUrl)) {
                    console.log('[xdAnswers/naurok] Blocked test-beta focus XHR:', this.__xdUrl);
                    try {
                        Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
                        Object.defineProperty(this, 'status', { value: 200, configurable: true });
                        Object.defineProperty(this, 'responseText', { value: '{}', configurable: true });
                        this.dispatchEvent(new Event('readystatechange'));
                        this.dispatchEvent(new Event('load'));
                        this.dispatchEvent(new Event('loadend'));
                    } catch (e) { /* fake response failed */ }
                    return;
                }
                if (this.__xdUrl && LEGACY_SESSION_RE.test(this.__xdUrl)) {
                    console.log('[xdAnswers/naurok] XHR intercepted:', this.__xdUrl);
                    this.addEventListener('load', function (this: any) {
                        try {
                            const json = JSON.parse(this.responseText);
                            postPayload(json, 'session-payload');
                        } catch (e) { /* not json */ }
                    });
                }
                return origSend.apply(this, arguments as any);
            };
        }
    } catch (e) { /* XHR patch failed */ }

    // ── Beacon fallback: focus telemetry must never leave the page ──────
    try {
        const origBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null): boolean {
            if (BETA_FOCUS_RE.test(String(url))) {
                console.log('[xdAnswers/naurok] Blocked test-beta focus beacon:', String(url));
                return true;
            }
            return origBeacon(url, data);
        };
    } catch (e) { /* beacon patch failed */ }

    installBetaFullscreenBypass();
    installBetaGateDismisser();
})();
