// src/providers/naurok/disabler.ts
// Page-world interception for the Naurok provider: patches window.fetch and
// XMLHttpRequest to capture /api2/test/sessions/ payloads (test topic and
// session id). Payloads are queued until main.ts installs its consumer.
// Publishes its API on window.xdAnswers._internal.providerModules.naurok.disabler.

export interface NaurokDisablerApi {
    install(onSessionPayload: (json: unknown) => void): void;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.naurok = I.providerModules.naurok || {});

    const pendingPayloads: unknown[] = [];
    let sink: ((json: unknown) => void) | null = null;

    function deliverSessionPayload(json: unknown): void {
        if (sink) {
            try { sink(json); } catch (e) { /* consumer error */ }
        } else {
            pendingPayloads.push(json);
        }
    }

    // ── Intercept window.fetch ────────────────────────────────────────
    try {
        const origFetch = window.fetch;
        const w = window as any;
        if (origFetch && !w.__xdAnswersNaurokFetchHooked) {
            w.__xdAnswersNaurokFetchHooked = true;
            w.fetch = function (this: any, input: any, init?: any) {
                const url = (typeof input === 'string') ? input : (input && input.url) || '';
                const promise = origFetch.apply(this, arguments as any);
                if (url && /\/api2\/test\/sessions\//.test(url)) {
                    console.log('[xdAnswers/naurok] Fetch intercepted:', url);
                    promise.then(resp => {
                        try {
                            resp.clone().json().then(json => {
                                deliverSessionPayload(json);
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
        const origOpen = proto.open;
        const origSend = proto.send;
        if (!(window as any).__xdAnswersNaurokXHRHooked) {
            (window as any).__xdAnswersNaurokXHRHooked = true;
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
                            deliverSessionPayload(json);
                        } catch (e) { /* not json */ }
                    });
                }
                return origSend.apply(this, arguments as any);
            };
        }
    } catch (e) { /* XHR patch failed */ }

    function install(onSessionPayload: (json: unknown) => void): void {
        sink = onSessionPayload;
        while (pendingPayloads.length > 0) {
            const payload = pendingPayloads.shift();
            try { onSessionPayload(payload); } catch (e) { /* consumer error */ }
        }
    }

    ns.disabler = { install };
})();
