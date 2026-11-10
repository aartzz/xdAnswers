// src/ai/batch/main.ts
// Background test pre-solver. It asks the active model for a chunk of
// questions, parses the indexed JSON reply and writes every usable answer to
// the local answer cache. It never touches processQuestion or isProcessingAI,
// so the helper stays usable while the batch runs.
import {
    ANSWER_CACHE_STORAGE_KEY,
    buildAnswerCacheKey,
    findUsableCachedKeys,
    isAnswerPlausiblyUsable,
    normalizeAnswerForCache,
    storeAnswerCache
} from '../../core/answer-cache';
import { parseBatchAnswers } from './parse';

const BATCH_SYSTEM_PROMPT = `Ти розв'язуєш тест. Нижче кілька питань.
Повертай ТІЛЬКИ рядки JSON, по одному об'єкту на рядок, без масиву, markdown і пояснень:
{"i":1,"answer":"точний текст відповіді"}
{"i":2,"answer":"..."}

Правила:
- i — номер питання з тексту (1, 2, 3, ...).
- answer — ТІЛЬКИ точний текст вибраного варіанту зі списку. Не перефразовуй, не скорочуй і не додавай пояснень.
- Якщо варіанти — числа або слова, скопіюй один із них повністю.
- Якщо правильних варіантів кілька — розділяй їх "; ".
- Для завдань зі спеціальним форматом дотримуйся інструкції всередині питання.
- Зображення додаються групами в порядку питань. Для питання N використовуй лише його групу зображень.
- Не додавай пояснень поза JSON. Якщо не знаєш відповіді — answer: "".`;

interface BatchEntry {
    questionData: XdQuestionData;
    key: string;
}

interface BatchStateInternal extends XdBatchState {
    lastSignature: string;
}

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;

    interface BatchMemoryEntry {
        answer: string;
        at: number;
    }

    const MEMORY_TTL_MS = 6 * 60 * 60 * 1000;
    const memoryAnswers = new Map<string, BatchMemoryEntry>();
    const plannedKeys = new Set<string>();

    let runToken = 0;
    let activePromise: Promise<void> | null = null;
    let activeSignature = '';
    let lastSignature = '';
    let batchPendingUntil = 0;
    let state: BatchStateInternal = {
        running: false,
        source: '',
        total: 0,
        done: 0,
        failed: 0,
        startedAt: 0,
        lastSignature: ''
    };

    function clampInt(value: unknown, min: number, max: number, fallback: number): number {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.max(min, Math.min(max, Math.floor(number)));
    }

    function sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function questionSignature(questions: XdQuestionData[], settings: XdSettings): string {
        const config = [
            settings.batchChunkSize,
            settings.batchMaxQuestions,
            settings.batchIncludeImages ? 'images' : 'text'
        ].join(':');
        return config + '|' + questions
            .map(question => [
                question.cacheScope || '',
                question.batchKey || '',
                question.topic || '',
                question.text || '',
                question.optionsText || '',
                question.hasImages ? 'image' : '',
                (question.base64Images || []).length
            ].join('\u0000'))
            .join('\u0001');
    }

    function stripTopicContext(userMsg: string): string {
        return userMsg.replace(/^Тема тесту:[^\n]*(?:\nОпис:[^\n]*)?\n\n?/u, '');
    }

    // buildMessages appends a single-question "answer: <text>" reminder. Batch
    // asks for JSON instead, so drop that trailing reminder to avoid mixing
    // answer formats in one response.
    function stripBatchFormatHints(userMsg: string): string {
        return userMsg
            .replace(/\n*(?:Нагадування|Напоминание|Reminder)\s*:[^\n]*$/u, '')
            .trim();
    }

    function memoryNormalize(value: string): string {
        return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function memoryStripOptionLabel(line: string): string {
        return line.replace(/^\s*(?:[a-zа-яіїєґ]|\d{1,2})\s*[:.)]\s+/iu, '').trim();
    }

    function looseMemoryKey(questionData: XdQuestionData): string {
        // Image answers are positional; only the persistent cache key includes
        // the image hashes needed for a safe lookup.
        if (hasImages(questionData)) return '';

        const text = memoryNormalize(questionData.text || '');
        const type = memoryNormalize(questionData.questionType || '');
        const safeTypes = new Set([
            'quiz', 'multiquiz', 'true_false', 'choice',
            'short_text', 'general', 'text', 'open_ended', 'paragraph'
        ]);
        if (!safeTypes.has(type)) return '';
        const options = String(questionData.optionsText || '')
            .split(/\r?\n/)
            .map(memoryNormalize)
            .filter(Boolean);
        const choice = type === 'quiz' || type === 'multiquiz' || type === 'true_false'
            || type === 'choice' || !!questionData.isMulti
            || !!(questionData as { isMultiQuiz?: boolean }).isMultiQuiz;
        const optionKey = choice
            ? Array.from(new Set(options.map(memoryStripOptionLabel).filter(Boolean))).sort().join('\u0001')
            : options.join('\u0001');
        if (!text && !optionKey) return '';
        return 'text:' + type + '\u0000' + text + '\u0000' + optionKey;
    }

    function memoryKeys(questionData: XdQuestionData): string[] {
        // Image answers are positional. The persistent key carries the image
        // hashes and option order, so never use the loose in-memory fallback.
        if (hasImages(questionData)) return [];
        const keys: string[] = [];
        if (questionData.batchKey) keys.push('id:' + questionData.batchKey);
        const loose = looseMemoryKey(questionData);
        if (loose) keys.push(loose);
        return keys;
    }

    function rememberBatchAnswer(questionData: XdQuestionData, answer: string): void {
        if (!answer) return;
        for (const key of memoryKeys(questionData)) {
            memoryAnswers.set(key, { answer, at: Date.now() });
        }
    }

    function lookupBatchAnswer(questionData: XdQuestionData): string | null {
        for (const key of memoryKeys(questionData)) {
            const entry = memoryAnswers.get(key);
            if (!entry) continue;
            if (Date.now() - entry.at > MEMORY_TTL_MS) {
                memoryAnswers.delete(key);
                continue;
            }
            return entry.answer;
        }
        return null;
    }

    function isBatchPlanned(questionData: XdQuestionData): boolean {
        return memoryKeys(questionData).some(key => plannedKeys.has(key));
    }

    function markBatchPending(): void {
        batchPendingUntil = Date.now() + 4000;
    }

    function isBatchActive(): boolean {
        return batchPendingUntil > Date.now() || !!activePromise || state.running;
    }

    async function waitForBatchAnswer(
        questionData: XdQuestionData,
        timeoutMs: number,
        allowUnplanned = false
    ): Promise<string | null> {
        const immediate = lookupBatchAnswer(questionData);
        if (immediate) return immediate;

        let planned = isBatchPlanned(questionData);
        if (!planned && !allowUnplanned) return null;

        const end = Date.now() + Math.max(0, timeoutMs);
        const plannedDeadline = Date.now() + 1200;
        while (Date.now() < end) {
            await sleep(120);
            const answer = lookupBatchAnswer(questionData);
            if (answer) return answer;

            if (isBatchPlanned(questionData)) planned = true;
            if (!planned) {
                if (!isBatchActive() || Date.now() > plannedDeadline) return null;
                continue;
            }
            if (!isBatchActive() && !isBatchPlanned(questionData)) return null;
        }
        return null;
    }

    function batchEffectiveSettings(settings: XdSettings): XdEffectiveSettings {
        const effective = I.getEffectiveSettings(settings);
        return { ...effective, webSearchEnabled: false, calculatorEnabled: false };
    }

    function hasImages(questionData: XdQuestionData): boolean {
        return !!questionData.hasImages || !!(questionData.base64Images && questionData.base64Images.length);
    }

    function chunkEntries(entries: BatchEntry[], chunkSize: number): BatchEntry[][] {
        const chunks: BatchEntry[][] = [];
        let current: BatchEntry[] = [];
        let imageCount = 0;
        const maxImages = Math.min(2, chunkSize);
        const flush = (): void => {
            if (current.length) {
                chunks.push(current);
                current = [];
                imageCount = 0;
            }
        };

        for (const entry of entries) {
            const imageQuestion = hasImages(entry.questionData);
            if (imageQuestion && imageCount >= maxImages) flush();
            current.push(entry);
            if (imageQuestion) imageCount++;
            if (current.length >= chunkSize) flush();
        }
        flush();
        return chunks;
    }

    function streamBatchText(
        questionData: XdQuestionData,
        effective: XdEffectiveSettings,
        showAnswerOnly: boolean,
        onDelta?: (delta: string) => void
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const { systemPrompt, userMsg } = I.buildMessages(questionData, showAnswerOnly);
            const images = questionData.base64Images || [];
            const body = I.buildRequestBody(effective, systemPrompt, userMsg, images, true, questionData);

            let buffer = '';
            let content = '';
            let settled = false;
            let abort: ((abort?: boolean) => void) | null = null;
            const timer = setTimeout(() => fail(new Error('Batch stream timeout')), 120000);

            function cleanup(): void {
                clearTimeout(timer);
                try { abort?.(); } catch { /* already disconnected */ }
            }

            function finish(): void {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(content);
            }

            function fail(error: unknown): void {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error instanceof Error ? error : new Error(String(error)));
            }

            function consume(text: string): void {
                if (settled) return;
                buffer += text;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    for (const event of I.parseSSEChunks(line + '\n', effective.apiFormat)) {
                        if (event.content) {
                            content += event.content;
                            if (onDelta) onDelta(event.content);
                        }
                        if (event.done) {
                            finish();
                            return;
                        }
                    }
                }
            }

            try {
                abort = window.xdAnswers.streamRequest({
                    url: I.buildStreamUrl(effective),
                    method: 'POST',
                    headers: I.buildHeaders(effective),
                    data: JSON.stringify(body)
                }, chunk => consume(String(chunk || '')), () => {
                    if (buffer) {
                        for (const event of I.parseSSEChunks(buffer, effective.apiFormat)) {
                            if (event.content) {
                                content += event.content;
                                if (onDelta) onDelta(event.content);
                            }
                        }
                        buffer = '';
                    }
                    finish();
                }, (error, details) => {
                    fail(new Error(String(error) + (details ? ': ' + String(details) : '')));
                });
            } catch (error) {
                fail(error);
            }
        });
    }

    async function requestBatchText(
        questionData: XdQuestionData,
        settings: XdSettings,
        showAnswerOnly: boolean
    ): Promise<string> {
        const effective = batchEffectiveSettings(settings);
        if (I.isOpenCodeFreeModel && I.isOpenCodeFreeModel(effective)) {
            return streamBatchText(questionData, effective, showAnswerOnly);
        }
        return window.xdAnswers.getAnswer(questionData, effective, showAnswerOnly);
    }

    async function solveChunk(
        chunk: BatchEntry[],
        settings: XdSettings,
        onAnswer: (entry: BatchEntry, answer: string) => Promise<void> | void
    ): Promise<void> {
        const blocks = chunk.map((entry, index) => {
            const { userMsg } = I.buildMessages(entry.questionData, false);
            const images = entry.questionData.base64Images || [];
            const imageNote = images.length
                ? `\n[До цього питання додано ${images.length} зображень: спочатку зображення питання, далі варіанти A, B, C...]`
                : '';
            return `Питання ${index + 1}:\n${stripBatchFormatHints(stripTopicContext(userMsg))}${imageNote}`;
        });
        const topic = chunk.map(entry => entry.questionData.topic).find(Boolean) || '';
        const batchQuestion: XdQuestionData = {
            text: blocks.join('\n\n'),
            topic: topic || undefined,
            questionType: 'batch',
            customPromptPrefix: BATCH_SYSTEM_PROMPT,
            disableTools: true,
            base64Images: chunk.flatMap(entry => (entry.questionData.base64Images || []).filter((image): image is string => !!image))
        };
        const effective = batchEffectiveSettings(settings);

        const handled = new Set<number>();
        const pending: Array<Promise<void>> = [];
        let fullContent = '';
        let scanPosition = 0;

        const emit = (raw: string): void => {
            const answers = parseBatchAnswers(raw, chunk.length);
            if (!answers.length && chunk.length === 1 && raw.trim()) {
                const parsed = I.parseAIResponse(raw);
                const fallback = parsed.answer || raw.replace(/^\s*(?:answer|відповідь|ответ)\s*[:\-]\s*/i, '').trim();
                if (fallback) {
                    handled.add(1);
                    pending.push(Promise.resolve(onAnswer(chunk[0], fallback)));
                }
                return;
            }
            for (const answer of answers) {
                if (handled.has(answer.index)) continue;
                const entry = chunk[answer.index - 1];
                if (!entry) continue;
                handled.add(answer.index);
                pending.push(Promise.resolve(onAnswer(entry, answer.answer)));
            }
        };

        // Extract every complete top-level JSON object as soon as its closing
        // brace arrives. This works for NDJSON, a pretty-printed array and a
        // streamed array alike, so each answer is cached before the chunk ends.
        const scanCompleteObjects = (): void => {
            while (true) {
                const start = fullContent.indexOf('{', scanPosition);
                if (start === -1) {
                    scanPosition = fullContent.length;
                    return;
                }
                let depth = 0;
                let inString = false;
                let escaped = false;
                let end = -1;
                for (let index = start; index < fullContent.length; index++) {
                    const char = fullContent[index];
                    if (inString) {
                        if (escaped) escaped = false;
                        else if (char === '\\') escaped = true;
                        else if (char === '"') inString = false;
                        continue;
                    }
                    if (char === '"') inString = true;
                    else if (char === '{') depth++;
                    else if (char === '}') {
                        depth--;
                        if (depth === 0) {
                            end = index;
                            break;
                        }
                    }
                }
                if (end === -1) {
                    scanPosition = start;
                    return;
                }
                emit(fullContent.slice(start, end + 1));
                scanPosition = end + 1;
            }
        };

        const onDelta = (delta: string): void => {
            fullContent += delta;
            scanCompleteObjects();
        };

        try {
            await streamBatchText(batchQuestion, effective, false, onDelta);
        } catch (error) {
            console.warn('[xdAnswers/batch] stream failed, falling back:', (error as Error)?.message || error);
            fullContent = await window.xdAnswers.getAnswer(batchQuestion, effective, false);
        }

        scanCompleteObjects();
        if (fullContent) emit(fullContent);
        await Promise.all(pending);
    }

    async function solveSingle(entry: BatchEntry, settings: XdSettings): Promise<string> {
        const singleQuestion: XdQuestionData = {
            ...entry.questionData,
            disableTools: true
        };
        const raw = await requestBatchText(singleQuestion, settings, true);
        const parsed = I.parseAIResponse(raw);
        return parsed.answer || String(raw || '').replace(/^\s*(?:answer|відповідь|ответ)\s*[:\-]\s*/i, '').trim();
    }

    async function saveAnswer(entry: BatchEntry, answer: string, settings: XdSettings): Promise<boolean> {
        if (window.xdAnswers.settings.answerCacheEnabled === false) return false;
        const clean = String(answer || '').trim();
        if (!clean) return false;
        const normalized = normalizeAnswerForCache(entry.questionData, clean);
        if (!normalized || !isAnswerPlausiblyUsable(entry.questionData, normalized)) {
            console.warn('[xdAnswers/batch] answer does not match current options, skipping:', entry.questionData.text.slice(0, 60));
            return false;
        }
        await storeAnswerCache(entry.key, entry.questionData, {
            answer: normalized,
            raw: '',
            isStructured: true
        }, settings, { force: true });
        rememberBatchAnswer(entry.questionData, normalized);
        console.log('[xdAnswers/batch] cached:', entry.questionData.text.slice(0, 60));
        return true;
    }

    async function runBatch(
        rawQuestions: XdQuestionData[],
        token: number,
        settings: XdSettings,
        force: boolean,
        source: string
    ): Promise<void> {
        const includeImages = settings.batchIncludeImages === true;
        const maxQuestions = clampInt(settings.batchMaxQuestions, 1, 200, 40);
        const chunkSize = clampInt(settings.batchChunkSize, 1, 30, 6);
        const delayMs = clampInt(settings.batchDelayMs, 0, 5000, 400);
        const concurrency = clampInt(settings.batchConcurrency, 1, 3, 2);

        const selected: BatchEntry[] = [];
        const seenKeys = new Set<string>();
        let skippedImages = 0;
        for (const questionData of rawQuestions) {
            if (token !== runToken) return;
            if (!force && !window.xdAnswers.settings.batchEnabled) return;
            if (window.xdAnswers.settings.answerCacheEnabled === false) return;

            const imageQuestion = hasImages(questionData);
            if (imageQuestion && !includeImages) {
                skippedImages++;
                continue;
            }
            if (imageQuestion && !(questionData.base64Images && questionData.base64Images.length)) {
                skippedImages++;
                continue;
            }

            // A previous chunk run may have answered this question under a
            // slightly different persistent key (for example, before the test
            // topic was discovered). Do not spend tokens on it again.
            if (lookupBatchAnswer(questionData)) continue;

            const key = await buildAnswerCacheKey(questionData);
            if (!key || seenKeys.has(key)) continue;
            seenKeys.add(key);
            selected.push({ questionData, key });
        }

        if (skippedImages) {
            console.warn(`[xdAnswers/batch] skipped ${skippedImages} image questions (enable Include image questions)`);
        }
        if (!selected.length) return;

        const cachedKeys = await findUsableCachedKeys(
            selected.map(entry => ({ key: entry.key, questionData: entry.questionData })),
            settings
        );
        const pending = selected
            .filter(entry => !cachedKeys.has(entry.key))
            .slice(0, maxQuestions);
        console.log(`[xdAnswers/batch] ${source}: ${selected.length} candidates, ${cachedKeys.size} cached, ${pending.length} pending`);
        if (!pending.length) {
            console.log('[xdAnswers/batch] all questions already cached');
            return;
        }

        plannedKeys.clear();
        for (const entry of pending) {
            for (const key of memoryKeys(entry.questionData)) plannedKeys.add(key);
        }

        const chunks = chunkEntries(pending, chunkSize);
        state = {
            running: true,
            source,
            total: pending.length,
            done: 0,
            failed: 0,
            startedAt: Date.now(),
            lastSignature
        };
        console.log(`[xdAnswers/batch] ${source}: ${pending.length} questions in ${chunks.length} chunks (size=${chunkSize}, images=${includeImages}, concurrency=${concurrency})`);

        const processChunk = async (chunk: BatchEntry[], index: number): Promise<void> => {
            const visionChunk = chunk.some(entry => hasImages(entry.questionData));
            console.log(`[xdAnswers/batch] chunk ${index + 1}/${chunks.length}: ${chunk.length} questions${visionChunk ? ' (vision)' : ''}`);
            try {
                if (chunk.length === 1 && hasImages(chunk[0].questionData)) {
                    const answer = await solveSingle(chunk[0], settings);
                    if (token !== runToken) return;
                    if (answer && await saveAnswer(chunk[0], answer, settings)) state.done++;
                    else state.failed++;
                } else {
                    await solveChunk(chunk, settings, async (entry, answer) => {
                        if (token !== runToken) return;
                        try {
                            if (await saveAnswer(entry, answer, settings)) state.done++;
                            else state.failed++;
                        } catch {
                            state.failed++;
                        }
                    });
                }
            } catch (error) {
                state.failed += chunk.length;
                console.warn('[xdAnswers/batch] chunk failed:', (error as Error)?.message || error);
            }
        };

        let nextChunk = 0;
        const worker = async (): Promise<void> => {
            while (true) {
                if (token !== runToken) return;
                if (!force && !window.xdAnswers.settings.batchEnabled) return;
                if (window.xdAnswers.settings.answerCacheEnabled === false) return;
                const index = nextChunk++;
                if (index >= chunks.length) return;
                await processChunk(chunks[index], index);
                if (delayMs > 0) await sleep(delayMs);
            }
        };

        await Promise.all(Array.from(
            { length: Math.min(concurrency, chunks.length) },
            () => worker()
        ));

        state.running = false;
        plannedKeys.clear();
        console.log(`[xdAnswers/batch] finished: ${state.done} cached, ${state.failed} failed`);
    }

    async function prefetchQuestions(questions: XdQuestionData[], options?: XdBatchOptions): Promise<void> {
        if (!Array.isArray(questions) || !questions.length) return;
        const settings = window.xdAnswers.settings;
        if (!options?.force && !settings.batchEnabled) return;
        if (settings.answerCacheEnabled === false) return;

        const usable = questions.filter(question =>
            question && (question.text || question.optionsText || (question.base64Images && question.base64Images.length))
        );
        if (!usable.length) return;

        const signature = questionSignature(usable, settings);
        if (!options?.force && signature === lastSignature) return;

        if (activePromise) {
            if (signature === activeSignature) return activePromise;
            // A new test/question set arrived: stop the old loop at its next
            // checkpoint and start the new one.
            runToken++;
        }

        lastSignature = signature;
        activeSignature = signature;
        batchPendingUntil = 0;
        const token = ++runToken;
        const promise = runBatch(usable, token, settings, !!options?.force, options?.source || 'test');
        activePromise = promise;
        try {
            await promise;
        } finally {
            if (activePromise === promise) {
                activePromise = null;
                activeSignature = '';
                batchPendingUntil = 0;
            }
        }
    }

    function cancelBatchPrefetch(): void {
        runToken++;
        activePromise = null;
        activeSignature = '';
        lastSignature = '';
        memoryAnswers.clear();
        plannedKeys.clear();
        batchPendingUntil = 0;
        state.running = false;
    }

    window.xdAnswers.prefetchQuestions = prefetchQuestions;
    window.xdAnswers.cancelBatchPrefetch = cancelBatchPrefetch;
    I.prefetchQuestions = prefetchQuestions;
    I.cancelBatchPrefetch = cancelBatchPrefetch;
    I.lookupBatchAnswer = lookupBatchAnswer;
    I.isBatchPlanned = isBatchPlanned;
    I.isBatchActive = isBatchActive;
    I.markBatchPending = markBatchPending;
    I.waitForBatchAnswer = waitForBatchAnswer;

    // A cache flush from the popup must also drop the in-memory fallback,
    // otherwise a cached answer would survive the explicit clear.
    try {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local' || !changes[ANSWER_CACHE_STORAGE_KEY]) return;
            if (!changes[ANSWER_CACHE_STORAGE_KEY].newValue) {
                memoryAnswers.clear();
                lastSignature = '';
            }
        });
    } catch {
        // Storage events are unavailable in a restricted context.
    }

    // Exposed for debugging from the page console without affecting the UI.
    Object.defineProperty(I, 'batchState', {
        configurable: true,
        get: () => ({ ...state })
    });
})();
