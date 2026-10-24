// src/ai/parse/json.ts
// Partial and malformed JSON recovery for AI responses.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;

    function extractJSONString(text: string): string {
        if (!text) return '';
        const start = text.indexOf('{');
        if (start === -1) return '';

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < text.length; i++) {
            const ch = text[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (ch === '\\') {
                escaped = true;
                continue;
            }

            if (ch === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (ch === '{') depth++;
            if (ch === '}') {
                depth--;
                if (depth === 0) return text.slice(start, i + 1);
            }
        }

        return text.slice(start);
    }

    function extractFieldValue(text: string, fieldName: string): string {
        const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
            new RegExp('"' + escapedField + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"', 'i'),
            new RegExp('"' + escapedField + '"\\s*:\\s*([\\s\\S]+?)(?:,\\s*"[^"]+"\\s*:|\\s*}$)', 'i'),
            new RegExp('"' + escapedField + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)$', 'i')
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match?.[1]) {
                return match[1]
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r')
                    .replace(/\\t/g, '\t')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\')
                    .trim();
            }
        }

        return '';
    }

    function salvagePartialJSON(text: string): XdParsedResponse | null {
        const candidate = extractJSONString(text) || text;
        const answer = extractFieldValue(candidate, 'answer');
        const explanation = extractFieldValue(candidate, 'explanation');
        const solution = extractFieldValue(candidate, 'solution');
        const confidence = extractFieldValue(candidate, 'confidence');

        if (answer || explanation || solution) {
            return {
                answer,
                explanation,
                solution,
                confidence,
                raw: text,
                isJSON: true,
                isPartialJSON: true
            };
        }

        return null;
    }

    I.extractJSONString = extractJSONString;
    I.extractFieldValue = extractFieldValue;
    I.salvagePartialJSON = salvagePartialJSON;
})();
