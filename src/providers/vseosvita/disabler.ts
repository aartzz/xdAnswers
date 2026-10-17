// src/providers/vseosvita/disabler.ts
// Page-world patches for vseosvita. This file is bundled into the injected
// page disabler (see scripts/build.js) and gated on location.hostname.
//
// Two concerns live here:
//   1. vseosvita ships the test title and description inside JSON responses of
//      its own POST endpoints (/ext/test-designer/testing-pupil/active-screen-data
//      and /start-execution). window.fetch and XMLHttpRequest are patched to
//      sniff those payloads and forward the parsed values to the content script
//      through a postMessage bridge (source: 'xd-disabler', provider: 'vseosvita').
//   2. vseosvita uses Vue with fullscreen computed properties; those instances
//      are patched here (plus a small layout fix for the fixed header).
(function () {
    'use strict';

    if (location.hostname.indexOf('vseosvita.ua') === -1) return;

    // ── Topic sniffing ────────────────────────────────────────────────
    let _vseosvitaTopic: string | null = null;
    let _vseosvitaDescription: string | null = null;

    function stripHtml(html: unknown): string {
        try {
            if (!html || typeof html !== 'string') return '';
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            return (tmp.textContent || (tmp as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim();
        } catch (e) { return ''; }
    }

    function postTopic(): void {
        if (!_vseosvitaTopic && !_vseosvitaDescription) return;
        try {
            window.postMessage({
                source: 'xd-disabler',
                provider: 'vseosvita',
                type: 'topic',
                topic: _vseosvitaTopic,
                description: _vseosvitaDescription
            }, '*');
        } catch (e) { /* ignore */ }
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
            postTopic();
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

    // ── Vue instance patches (vseosvita uses Vue with fullscreen computed properties) ──
    function patchVueInstance(): void {
        const vueEls = document.querySelectorAll('*');
        for (const el of vueEls) {
            const vm = (el as any).__vue__;
            if (vm) {
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
    function addTopPadding(): void {
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
})();
