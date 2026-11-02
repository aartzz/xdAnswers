// @ts-nocheck — page-world module bundled into dist/disabler.js (see src/core/disabler/page.ts).
// Keeps timing-based bot detection from seeing time go backwards.
import { makeNative } from './stealth';

export function installTimingGuard() {
    // ═══════════════════════════════════════════════════════════════════════════════
    //  GENERAL: Block common detection techniques
    // ═══════════════════════════════════════════════════════════════════════════════

    // Prevent sites from using performance.now() for timing analysis
    try {
        const origPerformanceNow = performance.now.bind(performance);
        let lastNow = 0;
        performance.now = makeNative(function() {
            const now = origPerformanceNow();
            // Add tiny jitter to prevent timing-based bot detection
            lastNow = Math.max(lastNow, now);
            return lastNow;
        }, 'now');
    } catch (e) { /* ignore */ }

    // ── requestAnimationFrame pause detector ────────────────────────────
    // Exams compare consecutive RAF timestamps and flag long gaps as a
    // system shade, overlay or debugger pause. Feed callbacks a monotonic
    // timeline that never jumps more than one frame interval.
    try {
        const w = window as any;
        if (!w.__xdAnswersRafGuard) {
            w.__xdAnswersRafGuard = true;
            const origRaf = window.requestAnimationFrame.bind(window);
            let lastRealTs = 0;
            let logicalTs = 0;

            window.requestAnimationFrame = makeNative(function(callback: FrameRequestCallback): number {
                return origRaf(function(realTs: number) {
                    if (!lastRealTs) {
                        lastRealTs = realTs;
                        logicalTs = realTs;
                    }
                    const delta = Math.max(0, realTs - lastRealTs);
                    lastRealTs = Math.max(lastRealTs, realTs);
                    logicalTs += Math.min(delta, 100);
                    callback(logicalTs);
                });
            }, 'requestAnimationFrame');
        }
    } catch (e) { /* ignore */ }
}
