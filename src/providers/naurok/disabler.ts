// src/providers/naurok/disabler.ts
// Page-world interception for the Naurok provider. This file is bundled into
// the injected page disabler (see scripts/build.js) and gated on
// location.hostname, so it only patches Naurok pages. It wraps window.fetch
// and XMLHttpRequest to capture /api2/test/sessions/ payloads (test topic and
// session id) and forwards them to the content script through a postMessage
// bridge (source: 'xd-disabler', provider: 'naurok').
(function () {
    'use strict';

    if (location.hostname.indexOf('naurok') === -1) return;

    function postSessionPayload(json: unknown): void {
        try {
            window.postMessage({
                source: 'xd-disabler',
                provider: 'naurok',
                type: 'session-payload',
                payload: json
            }, '*');
        } catch (e) { /* payload not structured-cloneable */ }
    }

    // ── Intercept window.fetch ────────────────────────────────────────
    try {
        const w = window as any;
        const origFetch = window.fetch;
        if (origFetch && !w.__xdAnswersNaurokFetchHooked) {
            w.__xdAnswersNaurokFetchHooked = true;
            w.fetch = function (this: any, input: any, init?: any) {
                const url = (typeof input === 'string') ? input : (input && input.url) || '';
                const promise = origFetch.apply(this, arguments as any);
                if (url && /\/api2\/test\/sessions\//.test(url)) {
                    console.log('[xdAnswers/naurok] Fetch intercepted:', url);
                    promise.then((resp: Response) => {
                        try {
                            resp.clone().json().then(json => {
                                postSessionPayload(json);
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
                if (this.__xdUrl && /\/api2\/test\/sessions\//.test(this.__xdUrl)) {
                    console.log('[xdAnswers/naurok] XHR intercepted:', this.__xdUrl);
                    this.addEventListener('load', function (this: any) {
                        try {
                            const json = JSON.parse(this.responseText);
                            postSessionPayload(json);
                        } catch (e) { /* not json */ }
                    });
                }
                return origSend.apply(this, arguments as any);
            };
        }
    } catch (e) { /* XHR patch failed */ }
})();
