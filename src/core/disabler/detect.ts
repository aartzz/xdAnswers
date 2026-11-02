// @ts-nocheck — page-world module bundled into dist/disabler.js (see src/core/disabler/page.ts).
// Hides common anti-cheat signals that are readable from stable Web APIs.
import { makeNative, definePrototypeGetter } from './stealth';

export function installDetectionBypass() {
    // ── Picture-in-Picture ────────────────────────────────────────────────
    // Some exams flag a floating video as a split-screen/overlay violation.
    // Report no active PiP element and no Document PiP window.
    definePrototypeGetter(Document.prototype, 'pictureInPictureElement', () => null, 'get pictureInPictureElement');
    try {
        if ('documentPictureInPicture' in window) {
            Object.defineProperty(window, 'documentPictureInPicture', {
                get: makeNative(() => undefined, 'get documentPictureInPicture'),
                configurable: true
            });
        }
    } catch (e) { /* ignore */ }

    // ── Incognito heuristics ───────────────────────────────────────────────
    // Chrome private mode reports a small storage quota. Exams use the quota
    // as an incognito signal, so keep it in the normal-profile range.
    try {
        const storageProto = Object.getPrototypeOf(navigator.storage || {});
        if (storageProto && typeof storageProto.estimate === 'function') {
            const origEstimate = storageProto.estimate;
            storageProto.estimate = makeNative(function () {
                return origEstimate.apply(this, arguments).then((result: StorageEstimate) => {
                    const quota = Number(result.quota) || 0;
                    return { ...result, quota: Math.max(quota, 512 * 1024 * 1024) };
                });
            }, 'estimate');
        }
    } catch (e) { /* ignore */ }

    // ── Automation marker ─────────────────────────────────────────────────
    try {
        Object.defineProperty(Navigator.prototype, 'webdriver', {
            get: makeNative(() => false, 'get webdriver'),
            configurable: true
        });
    } catch (e) { /* ignore */ }
}
