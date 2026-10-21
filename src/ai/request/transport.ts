// src/ai/request/transport.ts
// Endpoint URLs, request headers and provider-specific request bodies.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;

    function buildStreamUrl(s: XdEffectiveSettings): string {
        if (s.apiFormat === 'openai') return s.baseUrl + '/chat/completions';
        if (s.apiFormat === 'anthropic') return s.baseUrl + '/messages';
        if (s.apiFormat === 'google') return s.baseUrl + '/models/' + s.model + ':streamGenerateContent?alt=sse&key=' + s.apiKey;
        throw new Error('Unknown API format: ' + s.apiFormat);
    }

    function buildNonStreamUrl(s: XdEffectiveSettings): string {
        if (s.apiFormat === 'openai') return s.baseUrl + '/chat/completions';
        if (s.apiFormat === 'anthropic') return s.baseUrl + '/messages';
        if (s.apiFormat === 'google') return s.baseUrl + '/models/' + s.model + ':generateContent?key=' + s.apiKey;
        throw new Error('Unknown API format: ' + s.apiFormat);
    }

    function buildHeaders(s: XdEffectiveSettings): Record<string, string> {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        const providerType = (s as XdEffectiveSettings & { type?: string }).type;
        if (s.apiFormat === 'openai') {
            h['Authorization'] = 'Bearer ' + s.apiKey;
            // OpenRouter needs additional headers
            if (s.baseUrl && s.baseUrl.includes('openrouter.ai')) {
                h['HTTP-Referer'] = 'https://xdanswers.app';
                h['X-Title'] = 'xdAnswers';
            }
            // OpenCode Zen / Go endpoints require session headers
            if (s.baseUrl && (s.baseUrl.includes('opencode.ai') || providerType === 'opencode-zen' || providerType === 'opencode-go')) {
                const sessionId = 'ses_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                h['x-session-id'] = sessionId;
                h['x-opencode-session'] = sessionId;
                h['x-opencode-client'] = 'opencode';
                h['User-Agent'] = 'opencode/1.18.29';
            }
        }
        else if (s.apiFormat === 'anthropic') {
            h['x-api-key'] = s.apiKey;
            h['anthropic-version'] = '2023-06-01';
            h['anthropic-dangerous-direct-browser-access'] = 'true';
            if (s.baseUrl && (s.baseUrl.includes('opencode.ai') || providerType === 'opencode-zen' || providerType === 'opencode-go')) {
                const sessionId = 'ses_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                h['x-session-id'] = sessionId;
                h['x-opencode-session'] = sessionId;
                h['x-opencode-client'] = 'opencode';
                h['User-Agent'] = 'opencode/1.18.29';
            }
        }
        return h;
    }

    function buildRequestBody(s: XdEffectiveSettings, systemPrompt: string, userMsg: string, images: Array<string | null>, stream: boolean): unknown {
        const availableTools = I.buildTools ? I.buildTools(s, s.apiFormat) : [];
        const includeTools = availableTools.length > 0 && s.apiFormat !== 'google';

        if (s.apiFormat === 'openai') {
            const messages: Array<Record<string, unknown>> = [];
            if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
            const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: userMsg }];
            images.forEach(img => userContent.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + img } }));
            messages.push({ role: 'user', content: images.length > 0 ? userContent : userMsg });
            const body: Record<string, unknown> = { model: s.model, messages, max_tokens: 4096, stream: !!stream };
            // Request reasoning tokens from OpenRouter and OpenAI-compatible providers
            if (s.baseUrl && s.baseUrl.includes('openrouter.ai')) {
                body.include_reasoning = true;
            }
            if (includeTools) body.tools = availableTools;
            return body;
        }

        if (s.apiFormat === 'anthropic') {
            const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: userMsg }];
            images.forEach(img => userContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }));
            const body: Record<string, unknown> = { model: s.model, messages: [{ role: 'user', content: userContent }], max_tokens: 4096, stream: !!stream };
            if (systemPrompt) body.system = systemPrompt;
            if (includeTools) body.tools = availableTools;
            return body;
        }

        if (s.apiFormat === 'google') {
            const userParts: Array<Record<string, unknown>> = [{ text: userMsg }];
            images.forEach(img => userParts.push({ inline_data: { mime_type: 'image/jpeg', data: img } }));
            const body: Record<string, unknown> = { contents: [{ parts: userParts }] };
            if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
            if (availableTools.length > 0) body.tools = availableTools;
            return body;
        }

        throw new Error('Unknown API format: ' + s.apiFormat);
    }

    I.buildStreamUrl = buildStreamUrl;
    I.buildNonStreamUrl = buildNonStreamUrl;
    I.buildHeaders = buildHeaders;
    I.buildRequestBody = buildRequestBody;
})();
