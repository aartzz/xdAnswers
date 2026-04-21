// src/ai/parse.js
// Response parsing utilities. Extracted from legacy utils.js (lines 1111-1339).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    function parsePartialLabeled(text) {
        if (!text || !text.includes(':')) return null;

        const result = { answer: '', explanation: '', solution: '', confidence: '', isPartial: true };
        const lines = text.split('\n');
        let currentField = null;

        for (const line of lines) {
            const match = line.match(/^\s*([A-Za-zА-Яа-яІіЇїЄє'`]+)\s*:\s*(.*)$/);
            if (match) {
                const field = normalizeFieldName(match[1]);
                if (field && result.hasOwnProperty(field)) {
                    currentField = field;
                    result[field] = match[2].trim();
                    continue;
                }
            }
            if (currentField && line.trim()) {
                result[currentField] += (result[currentField] ? '\n' : '') + line.trim();
            }
        }

        const hasAny = result.answer || result.explanation || result.solution;
        return hasAny ? result : null;
    }

    function renderPartial(parsed) {
        let html = '';
        if (parsed.answer) html += '<div class="xd-answer xd-answer-partial">' + window.xdAnswers.renderMarkdown(parsed.answer) + '</div>';
        if (parsed.explanation) html += '<div class="xd-explanation">' + window.xdAnswers.renderMarkdown(parsed.explanation) + '</div>';
        if (parsed.solution) html += '<div class="xd-solution"><strong>Розв\'язок:</strong><br>' + window.xdAnswers.renderMarkdown(parsed.solution) + '</div>';
        if (parsed.confidence) html += '<div class="xd-confidence">Confidence: ' + parsed.confidence + '</div>';
        return html;
    }

    function formatError(msg) {
        if (!msg) return '<div class="xd-error">Unknown error</div>';

        const imageErrorMatch = msg.match(/Cannot read ["']([^"']+)["'].*does not support image input/i);
        if (imageErrorMatch) {
            return '<div class="xd-error"><strong>Image error:</strong> Model does not support image input. Try a vision-enabled model.</div>';
        }

        let code = 'Error';
        let detail = msg;
        try {
            const parsed = JSON.parse(msg);
            code = 'API ' + (parsed.status || parsed.code || parsed.error?.code || 'Error');
            detail = parsed.statusText || parsed.message || parsed.error?.message || parsed.responseText || msg;
            if (detail.length > 200) detail = detail.substring(0, 200) + '...';
        } catch {}
        if (!detail.startsWith('{')) {
            const m = msg.match(/^(API Error:\s*\d+)/);
            if (m) code = m[1];
            detail = msg.replace(/^API Error:\s*\d+\s*/, '').trim();
            if (detail.length > 200) detail = detail.substring(0, 200) + '...';
        }
        return '<div class="xd-error"><strong>' + code + ':</strong> ' + detail + '</div>';
    }

    function normalizeFieldName(name) {
        const normalized = (name || '').trim().toLowerCase();
        if (['answer', 'відповідь'].includes(normalized)) return 'answer';
        if (['explanation', 'пояснення'].includes(normalized)) return 'explanation';
        if (['solution', 'розв\'язок', 'розвязок'].includes(normalized)) return 'solution';
        if (['confidence', 'впевненість'].includes(normalized)) return 'confidence';
        return null;
    }

    function parseLabeledResponse(text) {
        if (!text) return null;

        const cleaned = text
            .replace(/```(?:json|yaml|txt)?/gi, '')
            .replace(/```/g, '')
            .trim();

        const lines = cleaned.split('\n');
        const result = { answer: '', explanation: '', solution: '', confidence: '', raw: text, isStructured: false };
        let currentField = null;

        for (const line of lines) {
            const match = line.match(/^\s*([A-Za-zА-Яа-яІіЇїЄє'`]+)\s*:\s*(.*)$/);
            if (match) {
                const field = normalizeFieldName(match[1]);
                if (field) {
                    currentField = field;
                    result[field] = match[2].trim();
                    result.isStructured = true;
                    continue;
                }
            }

            if (currentField && line.trim()) {
                result[currentField] += (result[currentField] ? '\n' : '') + line.trim();
            }
        }

        return result.isStructured ? result : null;
    }

    function extractJSONString(text) {
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

    function extractFieldValue(text, fieldName) {
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

    function salvagePartialJSON(text) {
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

    function parseAIResponse(text) {
        if (!text) return { answer: '', explanation: '', solution: '', confidence: '', raw: text, parseFailed: true };

        const labeled = parseLabeledResponse(text);
        if (labeled) return labeled;

        let jsonStr = text.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();

        try {
            const p = JSON.parse(jsonStr);
            return { answer: p.answer || '', explanation: p.explanation || '', solution: p.solution || '', confidence: p.confidence, raw: text, isJSON: true };
        } catch {
            const salvaged = salvagePartialJSON(jsonStr);
            if (salvaged) return salvaged;

            return { answer: '', explanation: '', solution: '', confidence: '', raw: text, isJSON: false, parseFailed: true };
        }
    }

    function renderParsedResponse(parsed) {
        if ((parsed.isJSON || parsed.isStructured) && parsed.answer) {
            let html = '<div class="xd-answer">' + window.xdAnswers.renderMarkdown(parsed.answer) + '</div>';
            if (parsed.explanation) html += '<div class="xd-explanation">' + window.xdAnswers.renderMarkdown(parsed.explanation) + '</div>';
            if (parsed.solution) html += '<div class="xd-solution"><strong>Розв\'язок:</strong><br>' + window.xdAnswers.renderMarkdown(parsed.solution) + '</div>';
            return html;
        }
        if (parsed.answer || parsed.explanation || parsed.solution) {
            let html = '';
            if (parsed.answer) html += '<div class="xd-answer">' + window.xdAnswers.renderMarkdown(parsed.answer) + '</div>';
            if (parsed.explanation) html += '<div class="xd-explanation">' + window.xdAnswers.renderMarkdown(parsed.explanation) + '</div>';
            if (parsed.solution) html += '<div class="xd-solution"><strong>Розв\'язок:</strong><br>' + window.xdAnswers.renderMarkdown(parsed.solution) + '</div>';
            return html;
        }
        if (parsed.raw && parsed.raw.trim()) {
            return '<div class="xd-answer">' + window.xdAnswers.renderMarkdown(parsed.raw) + '</div>';
        }
        // If we couldn't parse anything and have no raw text, don't overwrite the
        // streaming UI with "Parse error" — the stream already showed partial content.
        // Return empty string to preserve whatever the stream UI rendered.
        return '';
    }

    // Export all parsing helpers to _internal
    window.xdAnswers._internal.parsePartialLabeled = parsePartialLabeled;
    window.xdAnswers._internal.renderPartial = renderPartial;
    window.xdAnswers._internal.formatError = formatError;
    window.xdAnswers._internal.normalizeFieldName = normalizeFieldName;
    window.xdAnswers._internal.parseLabeledResponse = parseLabeledResponse;
    window.xdAnswers._internal.extractJSONString = extractJSONString;
    window.xdAnswers._internal.extractFieldValue = extractFieldValue;
    window.xdAnswers._internal.salvagePartialJSON = salvagePartialJSON;
    window.xdAnswers._internal.parseAIResponse = parseAIResponse;
    window.xdAnswers._internal.renderParsedResponse = renderParsedResponse;
})();
