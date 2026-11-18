// src/providers/smileandtask/disabler.ts
// Page-world patches for Smile&Task (smileandtask.com / school.smileandtask.com).
// Bundled into dist/disabler.js and gated on the hostname.
//
// The S&T Guard hook (useStGuard) reports violations to
// https://api.smileandtask.com/api/sessions/{id}/violation and opens a
// "Порушення академічної доброчесності" dialog. The global disabler already
// spoofs focus, visibility and fullscreen; this module covers the remaining
// triggers (mouse leaving the page, resize/orientation/popstate checks,
// selection/copy blockers) and drops the reports.
import { makeNative } from '../../core/disabler/stealth';

(function() {
    'use strict';

    const host = location.hostname;
    if (host !== 'smileandtask.com' && !host.endsWith('.smileandtask.com')) return;

    const w = window as any;
    if (w.__xdAnswersSmileAndTaskHooked) return;
    w.__xdAnswersSmileAndTaskHooked = true;

    const VIOLATION_RE = /\/api\/sessions\/[^/?#]+\/violation(?:[?#]|$)/;
    const GUARD_LISTENER_RE = /window_resize|url_changed|orientation_change|mouse_leave_top|mouse_leave_screen|exit_fullscreen|printscreen/;

    // Never resolve violation reports: a fake payload would feed the player's
    // "blocked" handling, and a rejection becomes an unhandled promise error.
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
            (this as any).__xdStViolation = VIOLATION_RE.test(String(url));
            return origOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
        } as typeof XMLHttpRequest.prototype.open;

        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
            if ((this as any).__xdStViolation) {
                (this as any).__xdStViolation = false;
                return;
            }
            return origSend.call(this, body);
        } as typeof XMLHttpRequest.prototype.send;
    } catch (e) { /* ignore */ }

    // Drop the S&T Guard listeners (mouse leaving the viewport, window resize,
    // orientation change, popstate, printscreen/copy blocker) while leaving
    // ordinary application listeners untouched.
    try {
        const origToString = Function.prototype.toString;
        const origAdd = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = makeNative(function(
            this: EventTarget,
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions
        ): void {
            if (listener && (this === document || this === window)) {
                if (this === document && (type === 'selectstart' || type === 'dragstart')) {
                    return;
                }
                if (typeof listener === 'function') {
                    try {
                        if (GUARD_LISTENER_RE.test(origToString.call(listener))) return;
                    } catch (e) { /* ignore */ }
                }
                if (this === document && (type === 'mouseleave' || type === 'mouseout')) {
                    const original = listener;
                    const wrappedListener = function(this: unknown, event: Event): void {
                        const mouse = event as MouseEvent;
                        if (type === 'mouseleave' || mouse.relatedTarget === null) return;
                        if (typeof original === 'function') original.call(this, event);
                        else original.handleEvent(event);
                    };
                    return origAdd.call(this, type, wrappedListener, options);
                }
            }
            return origAdd.call(this, type, listener, options);
        }, 'addEventListener');
    } catch (e) { /* ignore */ }

    // Restore text selection inside .join-test-no-select.
    try {
        const style = document.createElement('style');
        style.setAttribute('data-xd-smileandtask', 'true');
        style.textContent = [
            'html body .join-test-no-select,',
            'html body .join-test-no-select * {',
            '  -webkit-user-select: text !important;',
            '  -moz-user-select: text !important;',
            '  -ms-user-select: text !important;',
            '  user-select: text !important;',
            '}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(style);
    } catch (e) { /* ignore */ }

    // Backstop: close the violation dialog if one still gets opened.
    function dismissViolationDialog(): void {
        const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
        dialogs.forEach(dialog => {
            if (!dialog.querySelector('span.tracking-wide') || !/S&T Guard/.test(dialog.textContent || '')) return;
            const button = dialog.querySelector<HTMLButtonElement>('button');
            if (button) button.click();
        });
    }

    try {
        const start = () => {
            const observer = new MutationObserver(dismissViolationDialog);
            observer.observe(document.documentElement, { childList: true, subtree: true });
        };
        if (document.documentElement) start();
        else document.addEventListener('DOMContentLoaded', start, { once: true });
    } catch (e) { /* ignore */ }
})();
