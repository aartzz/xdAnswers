(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    // Find the first search provider that has a non-empty apiKey.
    function getActiveSearchProvider(s) {
        if (!s.providers) return null;
        return s.providers.find(p => p.kind === 'search' && p.apiKey) || null;
    }

    // Build a web_search tool definition for the current API format.
    function buildWebSearchTool(apiFormat) {
        const desc = 'Search the web for current information. Use this when you need up-to-date facts, references, or details that may not be in your training data. Call this before answering if you are unsure about something.';
        const params = {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search query to look up on the web' }
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

    // Execute a web search via the active search provider (through background.js fetch proxy).
    // Returns a JSON-stringified normalized result object.
    async function executeSearch(query, count) {
        const DEFAULT_BASE_URLS = window.xdAnswers._internal.DEFAULT_BASE_URLS;
        const s = window.xdAnswers.settings || {};
        const sp = getActiveSearchProvider(s);
        if (!sp) throw new Error('No search provider configured');

        const num = Math.min(Math.max(count || 5, 1), 10);
        console.log('[xdAnswers] executeSearch:', sp.type, '| query="' + query + '" | count=' + num);

        if (sp.type === 'langsearch') {
            const url = (sp.baseUrl || DEFAULT_BASE_URLS.langsearch) + '/web-search';
            const resp = await window.xdAnswers.makeRequest({
                url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + sp.apiKey
                },
                data: JSON.stringify({ query, count: num, summary: true }),
                responseType: 'text',
                timeout: 15000
            });
            const parsed = JSON.parse(resp.data);
            const items = parsed.data?.webPages?.value || [];
            const normalized = {
                organic: items.map(v => ({
                    title: v.name || '',
                    url: v.url || '',
                    snippet: v.snippet || v.summary || '',
                    date: v.datePublished || null
                }))
            };
            console.log('[xdAnswers] LangSearch results:', normalized.organic.length, 'items');
            return JSON.stringify(normalized);
        }

        if (sp.type === 'serper') {
            const url = (sp.baseUrl || DEFAULT_BASE_URLS.serper) + '/search';
            const resp = await window.xdAnswers.makeRequest({
                url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': sp.apiKey
                },
                data: JSON.stringify({ q: query, num }),
                responseType: 'text',
                timeout: 15000
            });
            const parsed = JSON.parse(resp.data);
            const normalized = {
                organic: (parsed.organic || []).map(r => ({
                    title: r.title || '',
                    url: r.link || '',
                    snippet: r.snippet || '',
                    date: r.date || null
                })),
                knowledge: parsed.knowledgeGraph ? {
                    title: parsed.knowledgeGraph.title || '',
                    description: parsed.knowledgeGraph.description || ''
                } : undefined,
                peopleAlsoAsk: (parsed.peopleAlsoAsk || []).map(a => ({
                    title: a.title || '',
                    snippet: a.snippet || ''
                }))
            };
            console.log('[xdAnswers] Serper results:', normalized.organic.length, 'organic' + (normalized.knowledge ? ' + knowledgeGraph' : '') + (normalized.peopleAlsoAsk?.length ? ' + ' + normalized.peopleAlsoAsk.length + ' peopleAlsoAsk' : ''));
            return JSON.stringify(normalized);
        }

        if (sp.type === 'perplexity') {
            const url = (sp.baseUrl || DEFAULT_BASE_URLS.perplexity) + '/search';
            const resp = await window.xdAnswers.makeRequest({
                url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + sp.apiKey
                },
                data: JSON.stringify({ query, max_results: num }),
                responseType: 'text',
                timeout: 15000
            });
            const parsed = JSON.parse(resp.data);
            const items = parsed.results || [];
            const normalized = {
                organic: items.map(r => ({
                    title: r.title || '',
                    url: r.url || '',
                    snippet: r.snippet || '',
                    date: r.date || r.last_updated || null
                }))
            };
            console.log('[xdAnswers] Perplexity results:', normalized.organic.length, 'items');
            return JSON.stringify(normalized);
        }

        if (sp.type === 'exa') {
            const url = (sp.baseUrl || DEFAULT_BASE_URLS.exa) + '/search';
            const resp = await window.xdAnswers.makeRequest({
                url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': sp.apiKey
                },
                data: JSON.stringify({
                    query,
                    type: 'auto',
                    numResults: num,
                    contents: { text: { maxCharacters: 500 }, highlights: true }
                }),
                responseType: 'text',
                timeout: 15000
            });
            const parsed = JSON.parse(resp.data);
            const items = parsed.results || [];
            const normalized = {
                organic: items.map(r => ({
                    title: r.title || '',
                    url: r.url || '',
                    snippet: r.text || (r.highlights || []).join(' … ') || '',
                    date: r.publishedDate || null
                }))
            };
            console.log('[xdAnswers] Exa results:', normalized.organic.length, 'items');
            return JSON.stringify(normalized);
        }

        if (sp.type === 'tavily') {
            const url = (sp.baseUrl || DEFAULT_BASE_URLS.tavily) + '/search';
            const resp = await window.xdAnswers.makeRequest({
                url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + sp.apiKey
                },
                data: JSON.stringify({
                    query,
                    search_depth: 'basic',
                    max_results: num,
                    include_answer: false
                }),
                responseType: 'text',
                timeout: 15000
            });
            const parsed = JSON.parse(resp.data);
            const items = parsed.results || [];
            const normalized = {
                organic: items.map(r => ({
                    title: r.title || '',
                    url: r.url || '',
                    snippet: r.content || '',
                    date: null
                }))
            };
            console.log('[xdAnswers] Tavily results:', normalized.organic.length, 'items');
            return JSON.stringify(normalized);
        }

        if (sp.type === 'linkup') {
            const url = (sp.baseUrl || DEFAULT_BASE_URLS.linkup) + '/search';
            const resp = await window.xdAnswers.makeRequest({
                url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + sp.apiKey
                },
                data: JSON.stringify({
                    q: query,
                    depth: 'standard',
                    outputType: 'searchResults',
                    maxResults: num
                }),
                responseType: 'text',
                timeout: 15000
            });
            const parsed = JSON.parse(resp.data);
            // searchResults format
            const items = parsed.results || [];
            const normalized = {
                organic: items.map(r => ({
                    title: r.name || '',
                    url: r.url || '',
                    snippet: r.content || r.snippet || '',
                    date: null
                }))
            };
            console.log('[xdAnswers] Linkup results:', normalized.organic.length, 'items');
            return JSON.stringify(normalized);
        }

        if (sp.type === 'searchapi') {
            const baseUrl = sp.baseUrl || DEFAULT_BASE_URLS.searchapi;
            // Engine can be changed via provider name: "SearchAPI (Bing)" → engine=bing
            const engine = (sp.name && /bing/i.test(sp.name)) ? 'bing'
                : (sp.name && /yahoo/i.test(sp.name)) ? 'yahoo'
                : (sp.name && /duckduckgo/i.test(sp.name)) ? 'duckduckgo'
                : 'google';
            const resp = await window.xdAnswers.makeRequest({
                url: baseUrl + '/search?engine=' + engine + '&q=' + encodeURIComponent(query) + '&num=' + num + '&api_key=' + encodeURIComponent(sp.apiKey),
                method: 'GET',
                responseType: 'text',
                timeout: 15000
            });
            const parsed = JSON.parse(resp.data);
            const items = parsed.organic_results || [];
            const normalized = {
                organic: items.map(r => ({
                    title: r.title || '',
                    url: r.link || '',
                    snippet: r.snippet || '',
                    date: r.date || null
                })),
                knowledge: parsed.knowledge_graph ? {
                    title: parsed.knowledge_graph.title || '',
                    description: parsed.knowledge_graph.description || ''
                } : undefined,
                peopleAlsoAsk: (parsed.related_searches || []).map(s => ({
                    title: s.query || s.title || '',
                    snippet: ''
                }))
            };
            console.log('[xdAnswers] SearchAPI results:', normalized.organic.length, 'items');
            return JSON.stringify(normalized);
        }

        throw new Error('Unknown search provider type: ' + sp.type);
    }

    window.xdAnswers._internal.getActiveSearchProvider = getActiveSearchProvider;
    window.xdAnswers._internal.buildWebSearchTool = buildWebSearchTool;
    window.xdAnswers._internal.executeSearch = executeSearch;
})();
