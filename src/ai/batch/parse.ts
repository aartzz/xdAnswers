// src/ai/batch/parse.ts
// Parses the model's batch reply into indexed answers.
//
// The preferred format is a JSON array:
//   [{"i":1,"answer":"..."},{"i":2,"answer":"..."}]
// Models still occasionally wrap it in markdown or answer with a numbered list,
// so both shapes are accepted. Out-of-range and duplicate indexes are ignored.

export interface XdBatchParsedAnswer {
    index: number;
    answer: string;
}

function cleanAnswer(value: unknown): string {
    return String(value == null ? '' : value)
        .replace(/^\s*(?:answer|відповідь|ответ)\s*[:\-]\s*/i, '')
        .replace(/^[\s"'«»`*]+|[\s"'«»`*]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function answerFromObject(item: Record<string, unknown>): { index: number; answer: string } | null {
    const rawIndex = item.i ?? item.index ?? item.n ?? item.number ?? item.num ?? item.q ?? item.id
        ?? item.question_number ?? item.question;
    const rawAnswer = item.answer ?? item.a ?? item.value ?? item.text ?? item.response;
    const index = Number(rawIndex);
    const answer = cleanAnswer(Array.isArray(rawAnswer) ? rawAnswer.join('; ') : rawAnswer);
    if (!Number.isInteger(index) || index < 1 || !answer) return null;
    return { index, answer };
}

function collectAnswers(value: unknown): XdBatchParsedAnswer[] {
    if (Array.isArray(value)) {
        const answers: XdBatchParsedAnswer[] = [];
        value.forEach((item, position) => {
            if (typeof item === 'string') {
                const answer = cleanAnswer(item);
                if (answer) answers.push({ index: position + 1, answer });
                return;
            }
            if (item && typeof item === 'object') {
                const parsed = answerFromObject(item as Record<string, unknown>);
                if (parsed) answers.push(parsed);
            }
        });
        return answers;
    }

    if (value && typeof value === 'object') {
        const object = value as Record<string, unknown>;
        // A single NDJSON object: {"i":1,"answer":"..."}.
        const single = answerFromObject(object);
        if (single) return [single];
        if (Array.isArray(object.answers)) return collectAnswers(object.answers);
        const answers: XdBatchParsedAnswer[] = [];
        for (const [key, raw] of Object.entries(object)) {
            const index = Number(key);
            if (!Number.isInteger(index) || index < 1) continue;
            const answer = typeof raw === 'string'
                ? cleanAnswer(raw)
                : (raw && typeof raw === 'object' ? cleanAnswer((raw as Record<string, unknown>).answer) : '');
            if (answer) answers.push({ index, answer });
        }
        return answers;
    }

    return [];
}

function parseJsonCandidates(raw: string): XdBatchParsedAnswer[] {
    const candidates: string[] = [];
    const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    while ((match = fenceRe.exec(raw))) candidates.push(match[1].trim());

    const firstBracket = raw.indexOf('[');
    const lastBracket = raw.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
        candidates.push(raw.slice(firstBracket, lastBracket + 1));
    }

    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        candidates.push(raw.slice(firstBrace, lastBrace + 1));
    }

    for (const candidate of candidates) {
        try {
            const answers = collectAnswers(JSON.parse(candidate));
            if (answers.length) return answers;
        } catch {
            // Try the next candidate, then the line fallback.
        }
    }

    // Some models emit newline-delimited JSON objects instead of an array.
    const ndjson: XdBatchParsedAnswer[] = [];
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim().replace(/,$/, '');
        if (!trimmed.startsWith('{')) continue;
        try {
            const parsed = answerFromObject(JSON.parse(trimmed));
            if (parsed) ndjson.push(parsed);
        } catch {
            // Not a complete JSON object; ignore this line.
        }
    }
    return ndjson;
}

function parseNumberedLines(raw: string): XdBatchParsedAnswer[] {
    const answers: XdBatchParsedAnswer[] = [];
    const re = /^\s*(?:питання|question|q)?\s*(\d{1,3})\s*[\).:\-=]\s*(.+)$/iu;
    for (const line of raw.split(/\r?\n/)) {
        const match = line.match(re);
        if (!match) continue;
        const index = parseInt(match[1], 10);
        const answer = cleanAnswer(match[2]);
        if (index >= 1 && answer) answers.push({ index, answer });
    }
    return answers;
}

export function parseBatchAnswers(raw: string, count: number): XdBatchParsedAnswer[] {
    if (!raw || count < 1) return [];
    const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const jsonAnswers = parseJsonCandidates(text);
    const answers = jsonAnswers.length ? jsonAnswers : parseNumberedLines(text);

    const seen = new Set<number>();
    return answers
        .filter(item => item.index >= 1 && item.index <= count && !!item.answer)
        .filter(item => {
            if (seen.has(item.index)) return false;
            seen.add(item.index);
            return true;
        })
        .sort((a, b) => a.index - b.index);
}
