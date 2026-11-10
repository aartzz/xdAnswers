// src/core/answer-cache.ts
// Local answer cache shared by every provider and the popup.
//
// The cache key is a hash of the question text, answer options, question type
// and image fingerprints. It never contains the raw question text. Choice
// options are sorted (and their A/B/C labels stripped) so a shuffled question
// still hits the same entry, while a different option set can never receive a
// cached answer.

export const ANSWER_CACHE_STORAGE_KEY = 'xdAnswers_answerCache';

const CACHE_VERSION = 3;
const MAX_ENTRIES = 1500;
// chrome.storage.local is limited to 10 MB without unlimitedStorage. Keep a
// margin for settings, stats and the browser's own serialization overhead.
const MAX_STORE_CHARS = 4 * 1024 * 1024;
const DEFAULT_TTL_DAYS = 30;
const MAX_ANSWER_LENGTH = 8000;
const MAX_EXPLANATION_LENGTH = 2000;
const MAX_SOLUTION_LENGTH = 4000;

export interface XdCachedAnswer {
    answer: string;
    explanation?: string;
    solution?: string;
    confidence?: string | number;
    at: number;
    model?: string;
}

interface XdAnswerCacheEntry extends XdCachedAnswer {
    key?: string;
}

interface XdAnswerCacheStore {
    version: number;
    entries: Record<string, XdAnswerCacheEntry>;
}

export interface XdAnswerCacheStats {
    count: number;
    oldest: number | null;
    newest: number | null;
}

function emptyStore(): XdAnswerCacheStore {
    return { version: CACHE_VERSION, entries: {} };
}

// Serialize read-modify-write cycles inside one page. Without this, two quick
// answers can race and the later write can drop the earlier cache entry.
let writeChain: Promise<void> = Promise.resolve();

function enqueueWrite(task: () => Promise<void>): Promise<void> {
    const run = writeChain.then(task, task);
    writeChain = run.catch(() => {});
    return run;
}

function readStorage(): Promise<unknown> {
    return new Promise((resolve) => {
        try {
            chrome.storage.local.get(ANSWER_CACHE_STORAGE_KEY, (data) => {
                resolve(data && data[ANSWER_CACHE_STORAGE_KEY]);
            });
        } catch {
            resolve(undefined);
        }
    });
}

function writeStorage(store: XdAnswerCacheStore): Promise<void> {
    return new Promise((resolve) => {
        try {
            chrome.storage.local.set({ [ANSWER_CACHE_STORAGE_KEY]: store }, () => resolve());
        } catch {
            resolve();
        }
    });
}

function normalizeStore(raw: unknown): XdAnswerCacheStore {
    if (!raw || typeof raw !== 'object') return emptyStore();
    const value = raw as Partial<XdAnswerCacheStore>;
    if (value.version !== CACHE_VERSION || !value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries)) {
        return emptyStore();
    }
    const entries: Record<string, XdAnswerCacheEntry> = {};
    for (const [key, entry] of Object.entries(value.entries)) {
        if (!entry || typeof entry !== 'object') continue;
        const candidate = entry as XdAnswerCacheEntry;
        if (typeof candidate.answer !== 'string' || !candidate.answer.trim()) continue;
        entries[key] = candidate;
    }
    return { version: CACHE_VERSION, entries };
}

function ttlMs(days: unknown): number {
    const value = Number(days);
    const safeDays = Number.isFinite(value) && value >= 1 ? Math.min(value, 3650) : DEFAULT_TTL_DAYS;
    return safeDays * 24 * 60 * 60 * 1000;
}

function normalizeText(value: unknown): string {
    let text = String(value == null ? '' : value);
    try {
        text = text.normalize('NFKC');
    } catch {
        // Older engines without String.normalize still work with the raw text.
    }
    return text
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(ch)))
        .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(ch)))
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

const CONFUSABLES: Record<string, string> = {
    a: 'а', c: 'с', e: 'е', h: 'н', i: 'і', k: 'к', m: 'м',
    o: 'о', p: 'р', t: 'т', x: 'х', y: 'у',
    A: 'А', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М',
    O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У'
};

function foldConfusables(value: string): string {
    return String(value || '').replace(/[A-Za-z]/g, ch => CONFUSABLES[ch] || ch);
}

function splitOptionLines(optionsText: unknown): string[] {
    return String(optionsText == null ? '' : optionsText)
        .split(/\r?\n/)
        .map(normalizeText)
        .filter(Boolean);
}

// Providers prefix choice options with A:, B:, 1. etc. Strip that prefix for
// the key only: the cached answer keeps the exact option text.
function stripOptionLabel(line: string): string {
    return line.replace(/^\s*(?:[a-zа-яіїєґ]|\d{1,2})\s*[:.)]\s+/iu, '').trim();
}

const IMAGE_PLACEHOLDER_RE = /^\[(?:запитання-зображення|зображення(?:\s+\d+)?|изображение(?:\s+\d+)?|image(?:\s+\d+)?)\]$/iu;

function isPlaceholderImageQuestion(text: string, options: string[]): boolean {
    if (IMAGE_PLACEHOLDER_RE.test(text)) return true;
    return options.length > 0 && options.every(line => IMAGE_PLACEHOLDER_RE.test(stripOptionLabel(line)));
}

function hasImageOptionPlaceholders(options: string[]): boolean {
    // Letter answers for image options are positional. A shuffled set has the
    // same option text, so caching could apply the letter to the wrong image.
    return options.some(line => IMAGE_PLACEHOLDER_RE.test(stripOptionLabel(line)));
}

export function isChoiceQuestion(questionData: XdQuestionData): boolean {
    const type = normalizeText(questionData.questionType || '');
    const special = new Set([
        'grid', 'match_pairs', 'match', 'true_false_multi', 'fill_blank',
        'select_in_text', 'order_words', 'ordering', 'categorization',
        'text_input_multi', 'range', 'fill_word', 'matching'
    ]);
    if (special.has(type)) return false;
    if (type === 'quiz' || type === 'multiquiz' || type === 'true_false' || type === 'choice') return true;
    if (questionData.isMulti || (questionData as { isMultiQuiz?: boolean }).isMultiQuiz) return true;
    return !type && splitOptionLines(questionData.optionsText).length > 0;
}

function questionFlags(questionData: XdQuestionData): string {
    // Providers use either isMulti (gforms) or isMultiQuiz (naurok) for the
    // same semantic flag. Normalize both to one value so a batch answer and a
    // foreground answer produce the same cache key.
    const multi = questionData.isMulti
        || (questionData as { isMultiQuiz?: boolean }).isMultiQuiz
        || normalizeText(questionData.questionType || '') === 'multiquiz';
    return multi ? 'multi' : '';
}

function fallbackHash(text: string): string {
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        h1 ^= code;
        h1 = Math.imul(h1, 16777619);
        h2 ^= code + i;
        h2 = Math.imul(h2, 2246822519);
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

async function hashText(text: string): Promise<string> {
    try {
        if (window.crypto && window.crypto.subtle) {
            const bytes = new TextEncoder().encode(text);
            const digest = await window.crypto.subtle.digest('SHA-256', bytes);
            return Array.from(new Uint8Array(digest))
                .map(byte => byte.toString(16).padStart(2, '0'))
                .join('');
        }
    } catch {
        // Non-secure contexts may not expose crypto.subtle; use the fallback.
    }
    return fallbackHash(text);
}

export async function buildAnswerCacheKey(questionData: XdQuestionData): Promise<string> {
    const text = normalizeText(questionData.text || '');
    const type = normalizeText(questionData.questionType || '');
    // Short-answer providers sometimes add a placeholder hint ("Поле
    // відповіді...") to optionsText. It is not part of the question identity.
    const rawOptions = splitOptionLines(questionData.optionsText);
    const placeholderOnly = type === 'short_text' && rawOptions.every(line =>
        /^(?:поле відповіді|answer field|field answer|введіть відповідь)/iu.test(line)
    );
    const options = placeholderOnly ? [] : rawOptions;
    const images = (questionData.base64Images || []).filter((image): image is string => !!image);
    if (!text && !options.length && !images.length) return '';
    // Image-only questions with failed image loads must not share a key.
    if (!images.length && isPlaceholderImageQuestion(text, options)) return '';

    // Image options are answered by position. They are safe to cache only when
    // the image content is part of the key and the option order is preserved.
    const imageOptions = hasImageOptionPlaceholders(options);
    if (imageOptions && !images.length) return '';

    const choice = isChoiceQuestion(questionData) && !imageOptions;
    const optionKey = choice
        ? Array.from(new Set(options.map(stripOptionLabel).filter(Boolean))).sort().join('\u0001')
        : options.join('\u0001');
    const imageKey = images.length
        ? (await Promise.all(images.map(image => hashText(image)))).join(',')
        : '';

    const fingerprint = [
        'v3',
        type,
        text,
        optionKey,
        questionFlags(questionData),
        imageKey,
        normalizeText(questionData.cacheScope || ''),
        normalizeText(questionData.topic || ''),
        normalizeText(questionData.topicDescription || ''),
        normalizeText(questionData.customPromptPrefix || '')
    ].join('\u0000');

    return 'v3:' + await hashText(fingerprint);
}

function normalizeAnswerPart(value: string): string {
    const cleaned = normalizeText(value)
        .replace(/^(?:answer|відповідь|ответ)\s*:\s*/i, '')
        .replace(/^[\s"'«»`*]+|[\s"'«»`*]+$/g, '')
        .trim();
    // Tolerate "B: exact option text" answers from models that echo the label.
    return stripOptionLabel(cleaned) || cleaned;
}

function answerParts(answer: string): string[] {
    const parts = String(answer || '')
        .split(/;/)
        .map(normalizeAnswerPart)
        .filter(Boolean);
    if (parts.length === 1 && /^[a-zа-яіїєґ](\s*[,;]\s*[a-zа-яіїєґ])+$/iu.test(parts[0])) {
        return parts[0].split(',').map(normalizeAnswerPart).filter(Boolean);
    }
    return parts;
}

function stripOptionLabelPreserveCase(line: string): string {
    return line.replace(/^\s*(?:[a-zа-яіїєґ]|\d{1,2})\s*[:.)]\s+/iu, '').trim();
}

function commonPrefixLength(a: string, b: string): number {
    const length = Math.min(a.length, b.length);
    let index = 0;
    while (index < length && a[index] === b[index]) index++;
    return index;
}

function bestWordPrefix(part: string, option: string): number {
    const partWords = part.split(/\s+/).filter(word => word.length >= 3);
    const optionWords = option.split(/\s+/).filter(Boolean);
    let best = 0;
    for (const partWord of partWords) {
        for (const optionWord of optionWords) {
            best = Math.max(best, commonPrefixLength(partWord, optionWord));
        }
    }
    return best;
}

// The model often answers a choice question with a sentence ("Гліцерол ...
// тому є представником трьохатомних спиртів") instead of the exact option.
// Resolve it to the option text when exactly one option is identifiable.
function resolveOptionFromText(originalOptions: string[], part: string): string | null {
    const normalizedPart = foldConfusables(normalizeText(part));
    if (!normalizedPart) return null;

    const candidates: Array<{ text: string; score: number }> = [];
    for (const original of originalOptions) {
        const option = foldConfusables(normalizeText(original));
        if (!option) continue;
        if (option === normalizedPart) return original;

        const standalone = (' ' + normalizedPart + ' ').includes(' ' + option + ' ');
        if (option.length >= 2 ? normalizedPart.includes(option) : standalone) {
            let score = option.length;
            if (normalizedPart.startsWith(option + ' ') || normalizedPart.startsWith(option + ':')) score += 100;
            else if (standalone) score += 10;
            candidates.push({ text: original, score });
            continue;
        }
        if (normalizedPart.length >= 3 && option.includes(normalizedPart)) {
            candidates.push({ text: original, score: normalizedPart.length });
            continue;
        }

        const prefix = bestWordPrefix(normalizedPart, option);
        if (prefix >= 5 || (prefix >= 4 && normalizedPart.length <= 6)) {
            candidates.push({ text: original, score: prefix });
        }
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null;
    return candidates[0].text;
}

// Models sometimes answer a text-choice question with "A" instead of the full
// option text. Cache keys are order-insensitive for text choices, so storing a
// raw letter would point at a different option after a shuffle. Resolve letters
// to the exact option text before caching. Image options keep the letter: their
// key includes image order and content.
export function normalizeAnswerForCache(questionData: XdQuestionData, answer: string): string {
    const rawAnswer = String(answer || '').trim();
    if (!rawAnswer || !isChoiceQuestion(questionData)) return rawAnswer;

    const originalLines = String(questionData.optionsText || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    if (!originalLines.length) return rawAnswer;
    if (hasImageOptionPlaceholders(originalLines.map(normalizeText))) return rawAnswer;

    const multi = !!questionData.isMulti
        || !!(questionData as { isMultiQuiz?: boolean }).isMultiQuiz
        || normalizeText(questionData.questionType || '') === 'multiquiz';
    let parts = multi
        ? rawAnswer.split(';').map(part => part.trim()).filter(Boolean)
        : [rawAnswer];
    if (multi && parts.length === 1 && /^[a-zа-яіїєґ](\s*[,]\s*[a-zа-яіїєґ])+$/iu.test(normalizeText(rawAnswer))) {
        parts = rawAnswer.split(',').map(part => part.trim()).filter(Boolean);
    }
    if (!parts.length) return rawAnswer;
    const optionTexts = originalLines.map(stripOptionLabelPreserveCase).filter(Boolean);
    return parts.map(part => {
        const cleaned = normalizeAnswerPart(part);
        const label = cleaned.match(/^([a-zа-яіїєґ]|\d{1,2})$/iu);
        if (label) {
            const wanted = label[1].toLowerCase();
            const line = originalLines.find(option => {
                const normalized = normalizeText(option);
                return normalized.startsWith(wanted + ':')
                    || normalized.startsWith(wanted + ')')
                    || normalized.startsWith(wanted + '.');
            });
            if (line) return stripOptionLabelPreserveCase(line);
        }
        return resolveOptionFromText(optionTexts, part) || stripOptionLabelPreserveCase(part);
    }).join('; ');
}

// Checks both option membership and the rough shape of a short answer. A
// 200-character explanation in the answer field is not a valid short answer
// even though there are no options to compare it against.
export function isAnswerPlausiblyUsable(questionData: XdQuestionData, answer: string): boolean {
    const clean = String(answer || '').trim();
    if (!clean) return false;
    if (!isAnswerCompatibleWithQuestion(questionData, clean)) return false;

    const type = normalizeText(questionData.questionType || '');
    const shortTypes = new Set([
        'short_text', 'numeric', 'date_time', 'range',
        'fill_word', 'fill_blank', 'select_in_text', 'text'
    ]);
    if (!shortTypes.has(type)) return true;
    if (clean.length > 180 && type !== 'text') return false;
    if (clean.length > 320) return false;
    const sentenceEnds = (clean.match(/[.!?]/g) || []).length;
    if (sentenceEnds >= 2) return false;
    if (/(?:тому|оскільки|малюнку|центральний атом|найдовший ланцюг|пояснення|explanation|because)/iu.test(clean)) {
        return false;
    }
    return true;
}

// A cached answer is usable only when every answer part still exists in the
// current question's options. This is the last line of defence against a hash
// collision or a question whose wording stayed the same but options changed.
export function isAnswerCompatibleWithQuestion(questionData: XdQuestionData, answer: string): boolean {
    if (!isChoiceQuestion(questionData)) return true;

    const rawOptions = splitOptionLines(questionData.optionsText);
    const options = rawOptions
        .map(stripOptionLabel)
        .filter(Boolean)
        .map(foldConfusables);
    if (!options.length) return true;

    // A single-choice option may itself contain a semicolon ("Cu(OH)2 ;
    // синій колір"). Check the whole answer first before splitting it.
    const whole = foldConfusables(normalizeAnswerPart(answer));
    if (options.includes(whole)) return true;

    const parts = answerParts(answer);
    if (!parts.length) return false;

    return parts.every((part) => {
        const foldedPart = foldConfusables(part);
        if (options.includes(foldedPart)) return true;
        // Image options are answered with a letter: "A", "B"...
        if (/^[a-zа-яіїєґ]$/iu.test(part)) {
            return rawOptions.some(line => line.startsWith(part + ':') || line.startsWith(part + ')') || line.startsWith(part + '.'));
        }
        return false;
    });
}

function trimText(value: unknown, limit: number): string {
    const text = String(value == null ? '' : value).trim();
    return text.length > limit ? text.slice(0, limit) : text;
}

function pruneStore(store: XdAnswerCacheStore, days: unknown): void {
    const cutoff = Date.now() - ttlMs(days);
    for (const [key, entry] of Object.entries(store.entries)) {
        if (!entry.at || entry.at < cutoff) delete store.entries[key];
    }

    const keys = Object.keys(store.entries);
    if (keys.length <= MAX_ENTRIES && JSON.stringify(store).length <= MAX_STORE_CHARS) return;

    keys.sort((a, b) => (store.entries[a].at || 0) - (store.entries[b].at || 0));
    let total = JSON.stringify(store).length;
    let count = keys.length;
    for (const key of keys) {
        if (count <= MAX_ENTRIES && total <= MAX_STORE_CHARS) break;
        total -= JSON.stringify(store.entries[key]).length + key.length + 6;
        delete store.entries[key];
        count--;
    }
}

export async function findUsableCachedKeys(
    items: Array<{ key: string; questionData: XdQuestionData }>,
    settings: XdSettings
): Promise<Set<string>> {
    const usable = new Set<string>();
    if (settings.answerCacheEnabled === false || !items.length) return usable;

    const store = normalizeStore(await readStorage());
    const cutoff = Date.now() - ttlMs(settings.answerCacheTtlDays);
    for (const item of items) {
        const entry = store.entries[item.key];
        if (!entry || !entry.at || entry.at < cutoff) continue;
        if (isAnswerCompatibleWithQuestion(item.questionData, entry.answer)) usable.add(item.key);
    }
    return usable;
}

export async function lookupAnswerCache(
    key: string,
    questionData: XdQuestionData,
    settings: XdSettings
): Promise<XdCachedAnswer | null> {
    if (!key || settings.answerCacheEnabled === false) return null;

    const store = normalizeStore(await readStorage());
    const entry = store.entries[key];
    if (!entry) return null;

    const cutoff = Date.now() - ttlMs(settings.answerCacheTtlDays);
    if (!entry.at || entry.at < cutoff || !isAnswerCompatibleWithQuestion(questionData, entry.answer)) {
        // Leave the entry alone here: another tab may be writing the same
        // storage object right now. Pruning happens on the next cache write.
        return null;
    }

    return {
        answer: entry.answer,
        explanation: entry.explanation,
        solution: entry.solution,
        confidence: entry.confidence,
        at: entry.at,
        model: entry.model
    };
}

export async function storeAnswerCache(
    key: string,
    questionData: XdQuestionData,
    parsed: XdParsedResponse,
    settings: XdSettings,
    options?: { force?: boolean }
): Promise<void> {
    if (!key || settings.answerCacheEnabled === false || parsed._cached) return;

    const answer = trimText(normalizeAnswerForCache(questionData, parsed.answer || ''), MAX_ANSWER_LENGTH);
    if (!answer || parsed.parseFailed) return;

    // A manual refresh is an explicit user request: store its result even when
    // the model reports low confidence.
    const confidence = Number(parsed.confidence);
    if (!options?.force && Number.isFinite(confidence) && confidence > 0 && confidence < 60) return;

    await enqueueWrite(async () => {
        const store = normalizeStore(await readStorage());
        store.entries[key] = {
            answer,
            explanation: parsed.explanation ? trimText(parsed.explanation, MAX_EXPLANATION_LENGTH) : undefined,
            solution: parsed.solution ? trimText(parsed.solution, MAX_SOLUTION_LENGTH) : undefined,
            confidence: parsed.confidence,
            at: Date.now(),
            model: settings.model || ''
        };
        pruneStore(store, settings.answerCacheTtlDays);
        await writeStorage(store);
    });
}

export async function clearAnswerCache(): Promise<void> {
    try {
        await new Promise<void>((resolve) => {
            chrome.storage.local.remove(ANSWER_CACHE_STORAGE_KEY, () => resolve());
        });
    } catch {
        // Storage may be unavailable in a restricted context.
    }
}

export async function getAnswerCacheStats(ttlDays: unknown): Promise<XdAnswerCacheStats> {
    const store = normalizeStore(await readStorage());
    const cutoff = Date.now() - ttlMs(ttlDays);
    const entries = Object.values(store.entries).filter(entry => entry.at && entry.at >= cutoff);
    if (!entries.length) return { count: 0, oldest: null, newest: null };

    let oldest = entries[0].at;
    let newest = entries[0].at;
    for (const entry of entries) {
        if (entry.at < oldest) oldest = entry.at;
        if (entry.at > newest) newest = entry.at;
    }
    return { count: entries.length, oldest, newest };
}
