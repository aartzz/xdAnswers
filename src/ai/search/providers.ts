// src/ai/search/providers.ts
// Search provider selection and the web_search tool schema.
(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;

    function getEligibleProviders(s: XdSettings): XdProviderConfig[] {
        if (!s.providers) return [];
        return s.providers.filter(function(p) {
            return p.kind === 'search' && (p.apiKey || p.type === 'searxng' || p.type === 'exa');
        });
    }

    function getActiveSearchProvider(s: XdSettings): XdProviderConfig | null {
        var all = getEligibleProviders(s);
        return all.length > 0 ? all[0] : null;
    }

    function buildWebSearchTool(apiFormat: string): unknown[] {
        var desc = 'Search the web for current information. Use this when you need up-to-date facts, references, or details that may not be in your training data. Call this before answering if you are unsure about something.';
        var params = {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search query to look up on the web' },
                source: { type: 'string', description: 'Optional: which search provider to use (SearXNG, Serper, LangSearch, etc.). Leave empty to auto-select.' }
            },
            required: ['query'],
            additionalProperties: false
        };

        if (apiFormat === 'openai') {
            return [{ type: 'function', function: { name: 'web_search', description: desc, parameters: params, strict: true } }];
        }
        if (apiFormat === 'anthropic') {
            return [{ name: 'web_search', description: desc, input_schema: params }];
        }
        if (apiFormat === 'google') {
            return [{ function_declarations: [{ name: 'web_search', description: desc, parameters: params }] }];
        }
        return [];
    }

    I.getActiveSearchProvider = getActiveSearchProvider;
    I.getEligibleProviders = getEligibleProviders;
    I.buildWebSearchTool = buildWebSearchTool;
})();
