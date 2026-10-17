// src/providers/vseosvita/disabler.ts
// vseosvita ships the test title and description inside JSON responses of its own
// POST endpoints (/ext/test-designer/testing-pupil/active-screen-data and
// /start-execution). This module patches window.fetch and XMLHttpRequest at load
// time to sniff those payloads and publishes the parsed values on
// window.xdAnswers._internal.providerModules.vseosvita.disabler for main.ts.

export interface VseosvitaDisablerApi {
    getTopic(): string | null;
    getDescription(): string | null;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.vseosvita = I.providerModules.vseosvita || {});

    let _vseosvitaTopic: string | null = null;       // string | null
    let _vseosvitaDescription: string | null = null; // string | null (HTML stripped)

    function stripHtml(html: unknown): string {
        try {
            if (!html || typeof html !== 'string') return '';
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            return (tmp.textContent || (tmp as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim();
        } catch (e) { return ''; }
    }

    function extractTopicFromVseosvitaPayload(payload: unknown): void {
        try {
            if (!payload || typeof payload !== 'object') return;
            const data = (payload as { data?: unknown }).data;
            if (!data || typeof data !== 'object') return;
            const d = data as Record<string, unknown>;
            if (typeof d.testing_title === 'string' && d.testing_title.trim()) {
                _vseosvitaTopic = d.testing_title.trim();
                console.log('[xdAnswers/vseosvita] Topic extracted:', _vseosvitaTopic);
            }
            if (typeof d.description_start === 'string' && d.description_start.trim()) {
                const plain = stripHtml(d.description_start);
                if (plain) {
                    _vseosvitaDescription = plain;
                    console.log('[xdAnswers/vseosvita] Description:', plain.slice(0, 80) + (plain.length > 80 ? '...' : ''));
                }
            }
        } catch (e) { console.warn('[xdAnswers/vseosvita] extractTopicFromVseosvitaPayload error:', e); }
    }

    const w = window as any;

    try {
        const origFetch = window.fetch;
        if (origFetch && !w.__xdAnswersVseosvitaFetchHooked) {
            w.__xdAnswersVseosvitaFetchHooked = true;
            window.fetch = function (this: Window, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
                const url = (typeof input === 'string') ? input : (input && (input as Request).url) || '';
                const promise = origFetch.apply(this, arguments as any) as Promise<Response>;
                if (url && /\/ext\/test-designer\/testing-pupil\/(active-screen-data|start-execution)/.test(url)) {
                    console.log('[xdAnswers/vseosvita] Fetch intercepted:', url);
                    promise.then(resp => {
                        try {
                            resp.clone().json().then(json => {
                                extractTopicFromVseosvitaPayload(json);
                            }).catch(() => {});
                        } catch (e) {}
                    }).catch(() => {});
                }
                return promise;
            } as typeof window.fetch;
        }
    } catch (e) { /* fetch patch failed — topic will simply be missing */ }

    // ── Intercept XMLHttpRequest (some frameworks use XHR instead of fetch) ──
    type XhrWithUrl = XMLHttpRequest & { __xdUrl?: string | URL };

    try {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        if (!w.__xdAnswersVseosvitaXHRHooked) {
            w.__xdAnswersVseosvitaXHRHooked = true;
            XMLHttpRequest.prototype.open = function (this: XhrWithUrl, method: string, url: string | URL) {
                this.__xdUrl = url;
                return origOpen.apply(this, arguments as any);
            } as typeof XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.send = function (this: XhrWithUrl) {
                if (this.__xdUrl && /\/ext\/test-designer\/testing-pupil\/(active-screen-data|start-execution)/.test(String(this.__xdUrl))) {
                    console.log('[xdAnswers/vseosvita] XHR intercepted:', this.__xdUrl);
                    this.addEventListener('load', function (this: XMLHttpRequest) {
                        try {
                            const json = JSON.parse(this.responseText);
                            extractTopicFromVseosvitaPayload(json);
                        } catch (e) {}
                    });
                }
                return origSend.apply(this, arguments as any);
            } as typeof XMLHttpRequest.prototype.send;
        }
    } catch (e) { /* XHR patch failed */ }

    ns.disabler = {
        getTopic: () => _vseosvitaTopic,
        getDescription: () => _vseosvitaDescription
    } as VseosvitaDisablerApi;
})();
