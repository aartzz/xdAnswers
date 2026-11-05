// src/providers/testix/disabler.ts
// Page-world patches for Testix (testix.com.ua). Bundled into dist/disabler.js
// and gated on the hostname.
//
// Testix reports tab/fullscreen violations to /api/attempts/{token}/violation
// and shows rules/warning/fullscreen overlays. The global disabler already
// spoofs focus, visibility and fullscreen; this module drops the remaining
// reports and dismisses the Testix-specific gates.
(function() {
    'use strict';

    const host = location.hostname;
    if (host !== 'testix.com.ua' && !host.endsWith('.testix.com.ua')) return;

    const w = window as any;
    if (w.__xdAnswersTestixHooked) return;
    w.__xdAnswersTestixHooked = true;

    const VIOLATION_RE = /\/api\/attempts\/[^/?#]+\/violation(?:[?#]|$)/;

    // Never resolve violation reports. Resolving with a fake payload would make
    // the player update warnings/warned state, and rejecting produces an
    // unhandled rejection. A pending promise leaves the player state untouched.
    try {
        const origFetch = window.fetch;
        window.fetch = function(this: Window, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const url = typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.href
                    : input.url;
            if (VIOLATION_RE.test(url)) {
                return new Promise<Response>(() => {});
            }
            return origFetch.call(this, input, init);
        } as typeof window.fetch;
    } catch (e) { /* ignore */ }

    // Testix currently uses fetch for violation reports, but keep beacon/XHR
    // silent as well in case another player build switches transport.
    try {
        const origBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
        if (origBeacon) {
            navigator.sendBeacon = function(url: string | URL, data?: BodyInit | null): boolean {
                if (VIOLATION_RE.test(String(url))) return true;
                return origBeacon(url, data);
            };
        }
    } catch (e) { /* ignore */ }

    try {
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(
            this: XMLHttpRequest,
            method: string,
            url: string | URL,
            async?: boolean,
            username?: string | null,
            password?: string | null
        ): void {
            (this as any).__xdTestixViolation = VIOLATION_RE.test(String(url));
            return origOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
        } as typeof XMLHttpRequest.prototype.open;

        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
            if ((this as any).__xdTestixViolation) {
                // Drop the request without completing it; no load/error events
                // fire, so the player never applies a warning response.
                (this as any).__xdTestixViolation = false;
                return;
            }
            return origSend.call(this, body);
        } as typeof XMLHttpRequest.prototype.send;
    } catch (e) { /* ignore */ }

    // Hide the anti-cheat gates before Alpine paints them. The selector mirrors
    // the x-show expressions in the player markup.
    try {
        const style = document.createElement('style');
        style.setAttribute('data-xd-testix', 'true');
        style.textContent = [
            'div[x-show="showRules && ! blocked"],',
            'div[x-show="needsFullscreen && ! blocked"],',
            'div[x-show="warned && ! blocked"]',
            '{display:none!important;visibility:hidden!important;pointer-events:none!important}'
        ].join('');
        (document.head || document.documentElement).appendChild(style);
    } catch (e) { /* ignore */ }

    function playerData(): any {
        try {
            const alpine = w.Alpine;
            const root = document.querySelector<HTMLElement>('[x-data^="player("]');
            if (!alpine || typeof alpine.$data !== 'function' || !root) return null;
            return alpine.$data(root);
        } catch (e) {
            return null;
        }
    }

    function dismissGates(): void {
        const data = playerData();
        if (data) {
            // Do not force blocked=false: a genuinely blocked attempt should stay
            // visible to the student.
            if (data.showRules) data.showRules = false;
            if (data.needsFullscreen) data.needsFullscreen = false;
            if (data.warned) data.warned = false;
        }

        const accept = document.querySelector<HTMLButtonElement>('[data-test="accept-rules"]');
        if (accept) {
            try { accept.click(); } catch (e) { /* ignore */ }
        }

        // Fallback for builds where Alpine.$data is unavailable: click the
        // visible overlay buttons. Restrict to fixed overlays so unrelated
        // buttons with the same labels are not touched.
        const buttons = document.querySelectorAll<HTMLButtonElement>('div.fixed button');
        for (const button of buttons) {
            if (button.offsetParent === null) continue;
            const text = (button.textContent || '').trim();
            if (text === 'На весь екран' || text === 'Продовжити') {
                try { button.click(); } catch (e) { /* ignore */ }
                break;
            }
        }
    }

    setInterval(dismissGates, 500);
    dismissGates();

    console.log('[xdAnswers Disabler] Anti-detect active for Testix (focus/fullscreen spoofs, violation reports blocked, gates dismissed)');
})();
