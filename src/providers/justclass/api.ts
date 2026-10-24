// src/providers/justclass/api.ts
// Public homework answer key: fetch, decode and index it by answer id.
import type { JustclassDomApi } from './dom';

export interface JustclassOption {
    value: string;
    correct: boolean;
}

export interface JustclassEntry {
    answerId: string;
    options: JustclassOption[];
    correctValues: string[];
    tooltip: string;
}

export interface JustclassTraining {
    entries: JustclassEntry[];
}

export interface JustclassApiCache {
    hash: string;
    byId: Map<string, JustclassEntry>;
    trainings: JustclassTraining[];
}

export interface JustclassApi {
    ensureApi(): Promise<JustclassApiCache | null>;
    findEntry(widget: Element, index: number): JustclassEntry | null;
    getCachedHash(): string | null;
    reset(): void;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.justclass = I.providerModules.justclass || {});

    const API_PREFIX = '/b/api/public/homework/by-hash/';

    let apiCache: JustclassApiCache | null = null;
    let apiPromise: { hash: string; promise: Promise<JustclassApiCache> } | null = null;
    let apiError: { hash: string; at: number; message: string } | null = null;

    function domApi(): JustclassDomApi {
        return (I.providerModules as Record<string, any>).justclass.dom as JustclassDomApi;
    }

    function decodeValue(value: unknown): string {
        const text = String(value == null ? '' : value);
        try { return decodeURIComponent(text); } catch (e) { return text; }
    }

    function decodeTokens(html: unknown): Map<string, JustclassOption[]> {
        const map = new Map<string, JustclassOption[]>();
        const re = /\[#:([^:\]]+):([A-Za-z0-9+/=]+)\]/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(String(html || '')))) {
            try {
                const decoded = JSON.parse(window.atob(match[2]));
                let options = decoded && decoded.options;
                if (typeof options === 'string') options = JSON.parse(options);
                if (Array.isArray(options)) {
                    map.set(match[1], options.map((o: any) => ({
                        value: decodeValue(o && o.value),
                        correct: String(o && o.text).toLowerCase() === 'true'
                    })));
                }
            } catch (e) {
                // Ignore a malformed token; elements[] remains the primary source.
            }
        }
        return map;
    }

    function extractEntries(training: any): JustclassEntry[] {
        const norm = domApi().norm;
        const translations = training && training.translations || {};
        const locale = training.currentLocale || training.defaultLocale || 'uk';
        const translation = translations[locale]
            || translations.uk
            || Object.values(translations)[0]
            || {};
        const payload = (translation as any).payload || {};

        let elements: any[] = Array.isArray(payload.elements) ? payload.elements : [];
        const tokenOptions = decodeTokens(payload.html || '');

        if (!elements.length && tokenOptions.size) {
            elements = Array.from(tokenOptions.entries()).map(([answerId, options]) => ({
                answerId: answerId,
                options: options
            }));
        }

        return elements.map((el: any) => {
            const options = Array.isArray(el.options) ? el.options : [];
            let normalized: JustclassOption[] = options.map((o: any) => ({
                value: norm(o && o.value),
                correct: !!(o && o.correct)
            }));

            if (!normalized.length && tokenOptions.has(el.answerId)) {
                normalized = (tokenOptions.get(el.answerId) || []).map(o => ({
                    value: norm(o.value),
                    correct: !!o.correct
                }));
            }

            return {
                answerId: el.answerId,
                options: normalized,
                correctValues: normalized.filter(o => o.correct && o.value).map(o => o.value),
                tooltip: norm(el.tooltip)
            };
        });
    }

    function buildCache(hash: string, data: any): JustclassApiCache {
        const byId = new Map<string, JustclassEntry>();
        const trainings: JustclassTraining[] = [];
        const list: any[] = Array.isArray(data.trainings)
            ? data.trainings
            : (Array.isArray(data.sections)
                ? data.sections.flatMap((s: any) => Array.isArray(s.trainings) ? s.trainings : [])
                : []);

        for (const training of list) {
            const entries = extractEntries(training);
            entries.forEach(entry => {
                if (entry.answerId) byId.set(entry.answerId, entry);
            });
            trainings.push({ entries });
        }

        return { hash, byId, trainings };
    }

    async function fetchApi(hash: string): Promise<any> {
        const url = new URL(API_PREFIX + encodeURIComponent(hash), location.origin).href;
        let lastError: unknown = null;

        try {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json, text/plain, */*' }
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return await response.json();
        } catch (err) {
            lastError = err;
        }

        // Fallback through the extension background fetch (useful if page CSP
        // or a browser context blocks the direct same-origin request).
        try {
            const response = await window.xdAnswers.makeRequest({
                method: 'GET',
                url: url,
                headers: { 'Accept': 'application/json, text/plain, */*' },
                responseType: 'text',
                timeout: 30000
            });
            return JSON.parse(response.data as string);
        } catch (err) {
            throw lastError || err;
        }
    }

    async function ensureApi(): Promise<JustclassApiCache | null> {
        const hash = domApi().getHash();
        if (!hash) return null;
        if (apiCache && apiCache.hash === hash) return apiCache;

        if (apiError && apiError.hash === hash && Date.now() - apiError.at < 8000) {
            throw new Error(apiError.message);
        }

        if (apiPromise && apiPromise.hash === hash) return apiPromise.promise;

        const promise = fetchApi(hash)
            .then(data => {
                const cache = buildCache(hash, data);
                apiCache = cache;
                apiError = null;
                apiPromise = null;
                return cache;
            })
            .catch(err => {
                apiPromise = null;
                apiError = { hash, at: Date.now(), message: (err as Error).message || String(err) };
                throw err;
            });

        apiPromise = { hash, promise };
        return promise;
    }

    function findEntry(widget: Element, index: number): JustclassEntry | null {
        const api = apiCache;
        if (!api) return null;
        if (widget.id && api.byId.has(widget.id)) return api.byId.get(widget.id) || null;

        // Fallback for a widget without an id: the page shows one training at a
        // time, and training order matches the "N із M" counter.
        const number = domApi().getQuestionNumber();
        const training = number > 0 ? api.trainings[number - 1] : null;
        return (training && training.entries[index]) || null;
    }

    function getCachedHash(): string | null {
        return apiCache ? apiCache.hash : null;
    }

    function reset(): void {
        apiCache = null;
        apiPromise = null;
        apiError = null;
    }

    ns.api = {
        ensureApi,
        findEntry,
        getCachedHash,
        reset
    } as JustclassApi;
})();
