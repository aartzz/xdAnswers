// src/ai/parse/render.ts
// HTML rendering of parsed AI responses and error messages.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;

    function renderPartial(parsed: XdParsedResponse): string {
        let html = '';
        if (parsed.answer) html += '<div class="xd-answer xd-answer-partial">' + window.xdAnswers.renderMarkdown(parsed.answer) + '</div>';
        if (parsed.explanation) html += '<div class="xd-explanation">' + window.xdAnswers.renderMarkdown(parsed.explanation) + '</div>';
        if (parsed.solution) html += '<div class="xd-solution"><strong>Розв\'язок:</strong><br>' + window.xdAnswers.renderMarkdown(parsed.solution) + '</div>';
        if (parsed.confidence) html += '<div class="xd-confidence">Confidence: ' + parsed.confidence + '</div>';
        return html;
    }

    function formatError(msg: string | undefined): string {
        if (!msg) return '<div class="xd-error">Unknown error</div>';

        const imageErrorMatch = msg.match(/Cannot read ["']([^"']+)["'].*does not support image input/i);
        if (imageErrorMatch) {
            return '<div class="xd-error"><strong>Image error:</strong> Model does not support image input. Try a vision-enabled model.</div>';
        }

        let code = 'Error';
        let detail: any = msg;
        try {
            const parsed: any = JSON.parse(msg);
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

    function renderParsedResponse(parsed: XdParsedResponse): string {
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

    I.renderPartial = renderPartial;
    I.formatError = formatError;
    I.renderParsedResponse = renderParsedResponse;
})();
