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

    interface TokenEntry {
        options: JustclassOption[];
        answers: string[];
        tooltip: string;
    }

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

    function parseBoolean(value: unknown): boolean {
        if (typeof value === 'boolean') return value;
        return /^(true|1|yes|так|вірно|правильно)$/i.test(String(value == null ? '' : value).trim());
    }

    function parseList(raw: unknown): any[] {
        let list = raw;
        if (typeof list === 'string') {
            try { list = JSON.parse(list); } catch (e) { return []; }
        }
        return Array.isArray(list) ? list : [];
    }

    function normalizeOptions(raw: unknown): JustclassOption[] {
        return parseList(raw).map(item => {
            if (typeof item === 'string') {
                return { value: decodeValue(item), correct: false };
            }
            const correctFlag = item && item.correct !== undefined
                ? item.correct
                : (item && item.isCorrect !== undefined
                    ? item.isCorrect
                    : (item && item.text !== undefined ? item.text : item && item.right));
            return {
                value: decodeValue(item && (item.value !== undefined ? item.value : item.label)),
                correct: parseBoolean(correctFlag)
            };
        }).filter(option => option.value);
    }

    function normalizeAnswers(raw: unknown): string[] {
        return parseList(raw).map(item => {
            if (typeof item === 'string') return decodeValue(item);
            if (item && typeof item === 'object') {
                return decodeValue(item.value !== undefined ? item.value : (item.answer !== undefined ? item.answer : item.text));
            }
            return decodeValue(item);
        }).filter(Boolean);
    }

    function decodeTokenPayload(raw: string): any {
        const binary = window.atob(raw);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return JSON.parse(new TextDecoder('utf-8').decode(bytes));
    }

    function decodeTokens(html: unknown): Map<string, TokenEntry> {
        const map = new Map<string, TokenEntry>();
        const re = /\[#:([^:\]]+):([A-Za-z0-9+/=]+)\]/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(String(html || '')))) {
            try {
                const decoded = decodeTokenPayload(match[2]);
                map.set(match[1], {
                    options: normalizeOptions(decoded && decoded.options),
                    answers: normalizeAnswers(
                        decoded && (decoded.answers
                            || decoded.rightAnswers
                            || decoded.correctAnswers
                            || (typeof decoded.text === 'string' && !/^(true|false)$/i.test(decoded.text) ? [decoded.text] : null))
                    ),
                    tooltip: decodeValue(decoded && decoded.tooltip)
                });
            } catch (e) {
                // Ignore a malformed token; elements[] remains the primary source.
            }
        }
        return map;
    }

    function uniqueValues(values: string[]): string[] {
        const d = domApi();
        const seen = new Set<string>();
        const result: string[] = [];
        values.forEach(value => {
            const clean = d.norm(value);
            if (!clean) return;
            const key = d.lower(clean);
            if (seen.has(key)) return;
            seen.add(key);
            result.push(clean);
        });
        return result;
    }

    function hasAnswerData(el: any): boolean {
        const options = normalizeOptions(el && el.options);
        const answers = normalizeAnswers(el && (el.answers || el.rightAnswers || el.correctAnswers));
        return answers.length > 0
            || options.some(option => option.correct)
            || (typeof (el && el.text) === 'string' && !!el.text);
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

        let html = payload.html || '';
        let elements: any[] = Array.isArray(payload.elements) ? payload.elements : [];
        let legacyElements: any[] = [];

        // Older payloads can outlive the visible one; recover answers if the
        // primary payload was stripped or emptied.
        if (translation.legacySerializedPayload && (!html || !elements.length || !elements.some(hasAnswerData))) {
            try {
                const legacy = JSON.parse(translation.legacySerializedPayload);
                if (!html && legacy && typeof legacy.html === 'string') html = legacy.html;
                if (Array.isArray(legacy && legacy.elements)) {
                    legacyElements = legacy.elements;
                    if (!elements.length) elements = legacyElements;
                }
            } catch (e) {
                // Ignore a malformed legacy payload.
            }
        }

        const tokenEntries = decodeTokens(html);
        const legacyById = new Map<string, any>();
        legacyElements.forEach(el => {
            if (el && el.answerId) legacyById.set(String(el.answerId), el);
        });

        if (!elements.length && tokenEntries.size) {
            elements = Array.from(tokenEntries.entries()).map(([answerId, token]) => ({
                answerId: answerId,
                options: token.options,
                answers: token.answers,
                tooltip: token.tooltip
            }));
        }

        return elements.map((el: any) => {
            const token = tokenEntries.get(el.answerId);
            let options = normalizeOptions(el.options);
            let answers = normalizeAnswers(el.answers || el.rightAnswers || el.correctAnswers);

            if (token) {
                if (!options.length) options = token.options;
                if (!answers.length) answers = token.answers;

                // Token carries the "correct" flag for older text-select payloads.
                if (options.length && !options.some(option => option.correct) && token.options.length) {
                    const flags = new Map(token.options.map(option => [domApi().lower(option.value), option.correct]));
                    options = options.map(option => ({
                        value: option.value,
                        correct: flags.get(domApi().lower(option.value)) || option.correct
                    }));
                }
            }

            let correctValues = answers.length
                ? answers
                : options.filter(option => option.correct).map(option => option.value);

            if (!correctValues.length && token) {
                correctValues = token.options.filter(option => option.correct).map(option => option.value);
            }

            if (!correctValues.length) {
                const legacy = legacyById.get(String(el.answerId));
                if (legacy) {
                    const legacyOptions = normalizeOptions(legacy.options);
                    const legacyAnswers = normalizeAnswers(legacy.answers || legacy.rightAnswers || legacy.correctAnswers);
                    if (!options.length) options = legacyOptions;
                    if (!answers.length) answers = legacyAnswers;
                    correctValues = answers.length
                        ? answers
                        : legacyOptions.filter(option => option.correct).map(option => option.value);
                    if (!correctValues.length && typeof legacy.text === 'string' && legacy.text) {
                        correctValues = [decodeValue(legacy.text)];
                    }
                }
            }

            // Drag-and-drop elements store the correct pair as {answerId, text}.
            if (!correctValues.length && typeof el.text === 'string' && el.text) {
                correctValues = [decodeValue(el.text)];
            }

            return {
                answerId: el.answerId ? String(el.answerId) : '',
                options: options,
                correctValues: uniqueValues(correctValues),
                tooltip: norm(el.tooltip || (token && token.tooltip) || '')
            };
        });
    }

    function sortByPosition<T extends { position?: unknown }>(items: T[]): T[] {
        return items.slice().sort((a, b) => {
            const left = Number(a && a.position);
            const right = Number(b && b.position);
            if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
            return 0;
        });
    }

    function collectTrainings(data: any): any[] {
        if (Array.isArray(data.sections)) {
            const result: any[] = [];
            sortByPosition(data.sections).forEach((section: any) => {
                const list = Array.isArray(section && section.trainings) ? sortByPosition(section.trainings) : [];
                list.forEach((training: any) => result.push(training));
            });
            if (result.length) return result;
        }
        return Array.isArray(data.trainings) ? data.trainings : [];
    }

    function buildCache(hash: string, data: any): JustclassApiCache {
        const byId = new Map<string, JustclassEntry>();
        const trainings: JustclassTraining[] = [];
        const list = collectTrainings(data || {});

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

        const answerId = widget.getAttribute('answer-id') || widget.getAttribute('data-answer-id');
        if (answerId && api.byId.has(answerId)) return api.byId.get(answerId) || null;
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
