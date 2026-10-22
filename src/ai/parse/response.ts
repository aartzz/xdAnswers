// src/ai/parse/response.ts
// Top-level AI response parsing: inline thinking strip, FINAL_ANSWER fallback, JSON fallback.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;

    const parseLabeledResponse = I.parseLabeledResponse;
    const salvagePartialJSON = I.salvagePartialJSON;

    function extractFinalAnswerRegex(text: string): XdParsedResponse | null {
        if (!text) return null;
        let m = text.match(/FINAL_ANSWER:\s*(.+?)(?:\n|$)/i);
        if (!m) m = text.match(/Відповідь:\s*(.+?)(?:\n|$)/i);
        if (!m) m = text.match(/Ответ:\s*(.+?)(?:\n|$)/i);
        if (!m) m = text.match(/ANSWER:\s*(.+?)(?:\n|$)/i);
        if (!m) m = text.match(/(?:Therefore|Thus|So),?\s*(?:the\s+)?(?:correct\s+)?(?:answer|option)\s*(?:is|=)\s*:?\s*(.+?)(?:\n|$)/i);
        if (!m) m = text.match(/(?:Option|Варіант)\s+([A-DА-Яа-яІіЇїЄє0-9])\s*(?:is\s+correct|є\s+правильн)/i);
        if (!m) return null;

        const answer = m[1].trim();
        const explanation = text.substring(0, m.index).trim().replace(/\n{3,}/g, '\n\n');

        return {
            answer: answer,
            explanation: explanation,
            solution: '',
            confidence: '',
            raw: text,
            isStructured: true,
            extractedBy: 'final_answer_regex'
        };
    }

    function stripInlineThinking(text: string): string {
        if (!text) return '';
        // Strip <think>...</think>
        let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        const proseHeaderRegex = /(?:Here's a thinking process|Thinking Process:|Thinking:|The user (?:is asking|asks|wants|is trying)|I need to (?:select|choose|find|determine|identify)|Let's think|First, let's|Let's analyze|We need to (?:answer|find|determine|identify|select|choose))/i;
        const proseTransitionRegex = /\n(?:\s*---|(?:\*{0,2}(?:Answer|Final Answer|Correct Answer|Відповідь|Ответ|Summary)\*{0,2}\s*:)|(?:\{[\s\r\n]*"answer")|(?:\*{0,2}(?:Therefore|Thus|So),?\s*(?:the\s+)?(?:correct\s+)?(?:answer|option)\s+(?:is|=)\*{0,2}\s*:?)|(?:Conclusion\s*:)|(?:The\s+correct\s+option\s+is\s*:?))/i;

        // 1. Strip leading prose thinking when transition to answer exists
        if (proseHeaderRegex.test(cleaned)) {
            const transition = cleaned.match(proseTransitionRegex);
            if (transition) {
                cleaned = cleaned.substring((transition.index ?? 0) + 1).trim();
            } else {
                // Look for trailing option conclusion or answer in prose
                const trailingAnswer = cleaned.match(/(?:(?:\*{0,2}(?:Answer|Final Answer|Correct Answer|Відповідь|Ответ)\*{0,2}\s*:\s*)|(?:(?:Therefore|Thus|So),?\s*(?:the\s+)?(?:correct\s+)?(?:answer|option)\s+is\s*:?\s*)|(?:The\s+correct\s+option\s+is\s*:?\s*))([A-DА-Яа-яІіЇїЄє0-9][^\n\.]*)/i);
                if (trailingAnswer) {
                    return 'Answer: ' + trailingAnswer[1].trim();
                }
            }
        }

        // If prose thinking was appended after confidence / fields: e.g. "Confidence: 0-100 The user asks for..."
        cleaned = cleaned.replace(/\b(The user (?:is asking|asks|wants|is trying)[\s\S]*|Here's a thinking process[\s\S]*)/i, '').trim();

        return cleaned || text;
    }

    function parseAIResponse(text: string): XdParsedResponse {
        if (!text) return { answer: '', explanation: '', solution: '', confidence: '', raw: text, parseFailed: true };

        text = stripInlineThinking(text);

        const labeled = parseLabeledResponse(text);
        if (labeled) return labeled;

        const finalAnswerExtracted = extractFinalAnswerRegex(text);
        if (finalAnswerExtracted && finalAnswerExtracted.answer) return finalAnswerExtracted;

        let jsonStr = text.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();

        try {
            const p: any = JSON.parse(jsonStr);
            return { answer: p.answer || '', explanation: p.explanation || '', solution: p.solution || '', confidence: p.confidence, raw: text, isJSON: true };
        } catch (e) {
            const salvaged = salvagePartialJSON(jsonStr);
            if (salvaged) return salvaged;

            return { answer: '', explanation: '', solution: '', confidence: '', raw: text, isJSON: false, parseFailed: true };
        }
    }

    I.parseAIResponse = parseAIResponse;
})();
