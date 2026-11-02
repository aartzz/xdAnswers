// src/providers/schoolos/disabler.ts
// Page-world patches for SchoolOS INTEGRITY (schoolos-test.vercel.app). Bundled
// into dist/disabler.js (see scripts/build.js) and gated on the hostname.
//
// The exam page keeps its anti-cheat state in local closures, so the patches
// below target the APIs it consumes instead of the functions themselves:
// focus/visibility/fullscreen are covered by the universal disabler, while this
// file drops the remaining page listeners, detector intervals, ResizeObserver
// split-screen checks and violation reports.
(function () {
    'use strict';

    const host = location.hostname;
    if (!/^schoolos(?:-[a-z0-9-]+)?\.vercel\.app$/.test(host) && host !== 'schoolosua.github.io') return;

    const w = window as any;
    if (w.__xdAnswersSchoolosHooked) return;
    w.__xdAnswersSchoolosHooked = true;

    // 1. Split-screen / PiP / debugger detectors run on setInterval. The exam
    // script passes each detector callback directly, so its source identifies
    // the check. Keep the timer id valid (0) so clearInterval() stays harmless.
    try {
        const origSetInterval = window.setInterval;
        window.setInterval = function (this: Window, handler: TimerHandler, timeout?: number) {
            try {
                if (typeof handler === 'function') {
                    const source = Function.prototype.toString.call(handler);
                    if (/Розділений екран|Плаваюче вікно|Picture-in-Picture|Виявлено паузу виконання|Верхня шторка|Системна шторка/.test(source)) {
                        return 0;
                    }
                }
            } catch (e) { /* ignore */ }
            return origSetInterval.apply(this, arguments as any);
        } as typeof window.setInterval;
    } catch (e) { /* ignore */ }

    // 2. ResizeObserver is used only for the split-screen check on this page.
    try {
        if (typeof w.ResizeObserver === 'function') {
            w.ResizeObserver = class {
                observe() {}
                unobserve() {}
                disconnect() {}
            };
        }
    } catch (e) { /* ignore */ }

    // 3. Drop page listeners used only by anti-cheat: pagehide/pageshow, window
    // resize, visualViewport resize and orientation change.
    try {
        const origAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (
            this: EventTarget,
            type: string,
            listener: EventListenerOrEventListenerObject,
            options?: boolean | AddEventListenerOptions
        ) {
            try {
                if (this === window || this === document) {
                    if (type === 'pagehide' || type === 'pageshow' || type === 'resize' ||
                        type === 'orientationchange') {
                        return;
                    }
                }
                if (type === 'resize' && window.visualViewport && this === window.visualViewport) return;
                if (type === 'change' && this && (this as any).constructor &&
                    (this as any).constructor.name === 'ScreenOrientation') {
                    return;
                }
            } catch (e) { /* ignore */ }
            return origAddEventListener.apply(this, arguments as any);
        } as typeof EventTarget.prototype.addEventListener;
    } catch (e) { /* ignore */ }

    // 3b. Violation auto-finish is scheduled with setTimeout. Skip that callback
    // so a single detector hit cannot end the exam; real submissions still use
    // finishExam('submit' | 'time' | 'force') directly.
    try {
        const origSetTimeout = window.setTimeout;
        window.setTimeout = function (this: Window, handler: TimerHandler, timeout?: number) {
            try {
                if (typeof handler === 'function') {
                    const source = Function.prototype.toString.call(handler);
                    if (/finishExam\(\s*['"]violations['"]\s*\)/.test(source)) {
                        return 0;
                    }
                }
            } catch (e) { /* ignore */ }
            return origSetTimeout.apply(this, arguments as any);
        } as typeof window.setTimeout;
    } catch (e) { /* ignore */ }

    // 3c. Auto-dismiss the violation overlay if a detector still fires.
    try {
        setInterval(function () {
            const overlay = document.getElementById('secOverlay');
            if (!overlay || !overlay.classList.contains('show')) return;
            const button = overlay.querySelector<HTMLButtonElement>('.btn-cont');
            if (button) button.click();
        }, 500);
    } catch (e) { /* ignore */ }

    // 4. Violation reports must never reach the teacher dashboard. Heartbeat,
    // finish and join requests are left untouched except for the violation
    // counters that the finish payload carries from the local exam state.
    function stripViolations(body: string): string {
        try {
            const data = JSON.parse(body);
            if (data && typeof data === 'object') {
                data.violations_count = 0;
                data.violations_log = [];
                return JSON.stringify(data);
            }
        } catch (e) { /* not JSON */ }
        return body;
    }

    try {
        const origFetch = window.fetch;
        window.fetch = function (this: Window, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const url = typeof input === 'string' ? input : (input && (input as Request).url) || '';
            if (/\/api\/violation(?:[?#]|$)/.test(url)) {
                return Promise.resolve(new Response('{"ok":true}', {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }));
            }
            if (/\/api\/finish(?:[?#]|$)/.test(url) && init && typeof init.body === 'string') {
                init = { ...init, body: stripViolations(init.body) };
            }
            return origFetch.call(this, input, init);
        } as typeof window.fetch;
    } catch (e) { /* ignore */ }

    try {
        const origBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
        if (origBeacon) {
            navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null): boolean {
                const target = String(url);
                if (/\/api\/violation(?:[?#]|$)/.test(target)) return true;
                if (/\/api\/finish(?:[?#]|$)/.test(target) && typeof Blob !== 'undefined' && data instanceof Blob) {
                    data.text().then(text => {
                        origBeacon(target, new Blob([stripViolations(text)], { type: 'application/json' }));
                    }).catch(() => origBeacon(target, data));
                    return true;
                }
                return origBeacon(url, data);
            };
        }
    } catch (e) { /* ignore */ }

    console.log('[xdAnswers Disabler] Anti-detect active for SchoolOS INTEGRITY (listeners + detectors + violation reports)');
})();
