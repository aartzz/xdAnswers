// Shared lifetime counters for the popup Home tab.
// Stored in chrome.storage.local so every tab and the popup read the same values.

export const STATS_KEY = 'xdAnswers_stats';

export interface XdStats {
    bypassed: number;
    answered: number;
}

function toCount(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

export function normalizeStats(value: unknown): XdStats {
    const raw = value && typeof value === 'object'
        ? value as Record<string, unknown>
        : {};
    return {
        bypassed: toCount(raw.bypassed),
        answered: toCount(raw.answered)
    };
}

export function getStats(callback?: (stats: XdStats) => void): Promise<XdStats> {
    return new Promise((resolve) => {
        const fallback: XdStats = { bypassed: 0, answered: 0 };
        try {
            chrome.storage.local.get(STATS_KEY, (data) => {
                const stats = normalizeStats(data && data[STATS_KEY]);
                callback?.(stats);
                resolve(stats);
            });
        } catch {
            callback?.(fallback);
            resolve(fallback);
        }
    });
}

export function incrementStat(field: keyof XdStats, by = 1): void {
    getStats((stats) => {
        const next: XdStats = { ...stats, [field]: stats[field] + by };
        try {
            chrome.storage.local.set({ [STATS_KEY]: next });
        } catch {
            // Stats are best-effort; never block answering a question.
        }
    });
}
