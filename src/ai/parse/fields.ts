// src/ai/parse/fields.ts
// Labeled field parsing (Answer / Explanation / Solution / Confidence) for AI responses.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;

    type FieldName = 'answer' | 'explanation' | 'solution' | 'confidence';
    interface LabeledFields {
        answer: string;
        explanation: string;
        solution: string;
        confidence: string;
    }

    function parsePartialLabeled(text: string): XdParsedResponse | null {
        if (!text || !text.includes(':')) return null;

        const result: XdParsedResponse & LabeledFields = { answer: '', explanation: '', solution: '', confidence: '', isPartial: true };
        const lines = text.split('\n');
        let currentField: FieldName | null = null;

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

        for (const f of ['answer', 'explanation', 'solution', 'confidence'] as FieldName[]) {
            result[f] = cleanFieldContent(f, result[f]);
        }

        const hasAny = result.answer || result.explanation || result.solution;
        return hasAny ? result : null;
    }

    function normalizeFieldName(name: string): FieldName | null {
        const normalized = (name || '').trim().toLowerCase();
        if (['answer', 'відповідь'].includes(normalized)) return 'answer';
        if (['explanation', 'пояснення'].includes(normalized)) return 'explanation';
        if (['solution', 'розв\'язок', 'розвязок'].includes(normalized)) return 'solution';
        if (['confidence', 'впевненість'].includes(normalized)) return 'confidence';
        return null;
    }

    function cleanFieldContent(field: string, val: string): string {
        if (!val) return '';
        let s = val.trim();
        if (field === 'solution') {
            s = s.replace(/^\s*\.{2,}\s*(?:\([^\)]*\))?\s*/i, '');
            if (/^(?:\.{2,}|none|нічого|немає|-|n\/a)$/i.test(s)) return '';
        }
        if (field === 'confidence') {
            const numMatch = s.match(/^(\d{1,3})/);
            if (numMatch) {
                return numMatch[1];
            }
            if (/^0-100/i.test(s)) {
                return '';
            }
        }
        return s;
    }

    function parseLabeledResponse(text: string): XdParsedResponse | null {
        if (!text) return null;

        const cleaned = text
            .replace(/```(?:json|yaml|txt)?/gi, '')
            .replace(/```/g, '')
            .trim();

        const lines = cleaned.split('\n');
        const result: XdParsedResponse & LabeledFields = { answer: '', explanation: '', solution: '', confidence: '', raw: text, isStructured: false };
        let currentField: FieldName | null = null;

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

        if (result.isStructured) {
            for (const f of ['answer', 'explanation', 'solution', 'confidence'] as FieldName[]) {
                result[f] = cleanFieldContent(f, result[f]);
            }
        }

        return result.isStructured ? result : null;
    }

    I.parsePartialLabeled = parsePartialLabeled;
    I.normalizeFieldName = normalizeFieldName;
    I.parseLabeledResponse = parseLabeledResponse;
})();
