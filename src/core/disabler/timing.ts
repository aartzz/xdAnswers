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
}
