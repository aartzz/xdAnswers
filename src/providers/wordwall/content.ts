// src/providers/wordwall/content.ts
// Wordwall content model fetch and normalization: pairs and quiz data from user.cdn.wordwall.net.
export interface WordwallItem {
    primary: string;
    secondary: string;
    primaryImage: string | null;
    secondaryImage: string | null;
}

export interface WordwallContent {
    kind: 'pairs' | 'unknown';
    items: WordwallItem[];
    instruction: string | null;
    raw: unknown;
}

export interface WordwallContentApi {
    fetchContent(baseUrl: string): Promise<WordwallContent | null>;
}

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const modules = (window.xdAnswers._internal.providerModules = window.xdAnswers._internal.providerModules || {});

    // <n> markers and light HTML in Wordwall texts
    function clean(text: unknown): string {
        if (typeof text !== 'string') return '';
        const el = document.createElement('div');
        el.innerHTML = text.replace(/<n>/gi, '<br>').replace(/<\/n>/gi, '');
        return (el.textContent || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function imageToUrl(userCdn: string, image: unknown): string | null {
        if (typeof image !== 'string' || !image) return null;
        return userCdn.replace(/\/$/, '') + '/' + image.replace(/^\/+/, '');
    }

    function parsePairs(data: unknown, userCdn: string): WordwallItem[] | null {
        const pairs = (data as { content?: { pairs?: unknown[] } })?.content?.pairs;
        if (!Array.isArray(pairs) || pairs.length < 2) return null;
        const items: WordwallItem[] = [];
        for (const p of pairs) {
            const pair = p as { primary?: { text?: unknown; image?: unknown }; secondary?: { text?: unknown; image?: unknown } };
            const primary = clean(pair.primary?.text);
            const secondary = clean(pair.secondary?.text);
            if (!primary && !secondary) continue;
            items.push({
                primary,
                secondary,
                primaryImage: imageToUrl(userCdn, pair.primary?.image),
                secondaryImage: imageToUrl(userCdn, pair.secondary?.image)
            });
        }
        return items.length >= 2 ? items : null;
    }

    async function fetchContent(baseUrl: string): Promise<WordwallContent | null> {
        try {
            const resp = await fetch(baseUrl, { credentials: 'omit' });
            if (!resp.ok) return null;
            const data: unknown = await resp.json();
            const userCdn = baseUrl.match(/^(https?:\/\/[^/]+)/)?.[1] || 'https://user.cdn.wordwall.net';
            const pairs = parsePairs(data, userCdn);
            if (pairs) {
                return {
                    kind: 'pairs',
                    items: pairs,
                    instruction: clean((data as { instruction?: unknown }).instruction) || null,
                    raw: data
                };
            }
            return { kind: 'unknown', items: [], instruction: null, raw: data };
        } catch {
            return null;
        }
    }

    modules.wordwall = modules.wordwall || {};
    modules.wordwall.content = { fetchContent } as WordwallContentApi;
})();
