(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    function getEligibleProviders(s) {
        if (!s.providers) return [];
        return s.providers.filter(function(p) {
            return p.kind === 'search' && (p.apiKey || p.type === 'searxng');
        });
    }

    function getActiveSearchProvider(s) {
        var all = getEligibleProviders(s);
        return all.length > 0 ? all[0] : null;
    }

    function findProviderBySource(s, source) {
        var all = getEligibleProviders(s);
        if (!source) return all.length > 0 ? all[0] : null;
        var src = source.toLowerCase().trim();
        var match = all.find(function(p) {
            var name = (p.name || '').toLowerCase();
            var type = (p.type || '').toLowerCase();
            return name.indexOf(src) !== -1 || type.indexOf(src) !== -1;
        });
        return match || (all.length > 0 ? all[0] : null);
    }

    function buildWebSearchTool(apiFormat) {
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

    async function executeSearch(query, count, preferredSource) {
        var DEFAULT_BASE_URLS = window.xdAnswers._internal.DEFAULT_BASE_URLS;
        var s = window.xdAnswers.settings || {};
        var sp = preferredSource
            ? findProviderBySource(s, preferredSource)
            : getActiveSearchProvider(s);

        if (!sp) throw new Error('No search provider configured');

        var num = Math.min(Math.max(count || 5, 1), 10);
        var lastError = null;

        // Try the requested provider first; on failure, fall through to others
        var providers = getEligibleProviders(s);

        // If a specific source was requested, start with it; otherwise start from beginning
        var startIdx = 0;
        if (preferredSource && sp) {
            startIdx = providers.indexOf(sp);
            if (startIdx < 0) startIdx = 0;
        }

        for (var i = startIdx; i < providers.length; i++) {
            var p = providers[i];
            try {
                console.log('[xdAnswers] executeSearch:', p.type, '(' + p.name + ')', '| query="' + query + '" | count=' + num);
                var result = await searchWithProvider(p, query, num, DEFAULT_BASE_URLS);
                return result;
            } catch (e) {
                var errMsg = e && e.message ? e.message : String(e);
                console.warn('[xdAnswers] Search provider ' + p.name + ' (' + p.type + ') failed:', errMsg);
                lastError = e;
                // Continue to next provider
            }
        }

        throw lastError || new Error('All search providers failed');
    }

    async function searchWithProvider(sp, query, num, DEFAULT_BASE_URLS) {
        switch (sp.type) {
            case 'langsearch': return searchLangSearch(sp, query, num, DEFAULT_BASE_URLS);
            case 'serper': return searchSerper(sp, query, num, DEFAULT_BASE_URLS);
            case 'perplexity': return searchPerplexity(sp, query, num, DEFAULT_BASE_URLS);
            case 'exa': return searchExa(sp, query, num, DEFAULT_BASE_URLS);
            case 'tavily': return searchTavily(sp, query, num, DEFAULT_BASE_URLS);
            case 'linkup': return searchLinkup(sp, query, num, DEFAULT_BASE_URLS);
            case 'searchapi': return searchSearchApi(sp, query, num, DEFAULT_BASE_URLS);
            case 'searxng': return searchSearxng(sp, query, num, DEFAULT_BASE_URLS);
            default: throw new Error('Unknown search provider type: ' + sp.type);
        }
    }

    async function searchLangSearch(sp, query, num, DEFAULT_BASE_URLS) {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.langsearch) + '/web-search';
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sp.apiKey },
            data: JSON.stringify({ query: query, count: num, summary: true }),
            responseType: 'text', timeout: 15000
        });
        var parsed = JSON.parse(resp.data);
        var items = parsed.data && parsed.data.webPages ? (parsed.data.webPages.value || []) : [];
        var normalized = {
            organic: items.map(function(v) {
                return { title: v.name || '', url: v.url || '', snippet: v.snippet || v.summary || '', date: v.datePublished || null };
            })
        };
        console.log('[xdAnswers] LangSearch results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchSerper(sp, query, num, DEFAULT_BASE_URLS) {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.serper) + '/search';
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': sp.apiKey },
            data: JSON.stringify({ q: query, num: num }),
            responseType: 'text', timeout: 15000
        });
        var parsed = JSON.parse(resp.data);
        var normalized = {
            organic: (parsed.organic || []).map(function(r) {
                return { title: r.title || '', url: r.link || '', snippet: r.snippet || '', date: r.date || null };
            }),
            knowledge: parsed.knowledgeGraph ? {
                title: parsed.knowledgeGraph.title || '',
                description: parsed.knowledgeGraph.description || ''
            } : undefined,
            peopleAlsoAsk: (parsed.peopleAlsoAsk || []).map(function(a) {
                return { title: a.title || '', snippet: a.snippet || '' };
            })
        };
        console.log('[xdAnswers] Serper results:', normalized.organic.length, 'organic');
        return JSON.stringify(normalized);
    }

    async function searchPerplexity(sp, query, num, DEFAULT_BASE_URLS) {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.perplexity) + '/search';
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sp.apiKey },
            data: JSON.stringify({ query: query, max_results: num }),
            responseType: 'text', timeout: 15000
        });
        var parsed = JSON.parse(resp.data);
        var items = parsed.results || [];
        var normalized = {
            organic: items.map(function(r) {
                return { title: r.title || '', url: r.url || '', snippet: r.snippet || '', date: r.date || r.last_updated || null };
            })
        };
        console.log('[xdAnswers] Perplexity results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchExa(sp, query, num, DEFAULT_BASE_URLS) {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.exa) + '/search';
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': sp.apiKey },
            data: JSON.stringify({ query: query, type: 'auto', numResults: num,
                contents: { text: { maxCharacters: 500 }, highlights: true } }),
            responseType: 'text', timeout: 15000
        });
        var parsed = JSON.parse(resp.data);
        var items = parsed.results || [];
        var normalized = {
            organic: items.map(function(r) {
                return { title: r.title || '', url: r.url || '', snippet: r.text || (r.highlights || []).join(' … ') || '', date: r.publishedDate || null };
            })
        };
        console.log('[xdAnswers] Exa results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchTavily(sp, query, num, DEFAULT_BASE_URLS) {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.tavily) + '/search';
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sp.apiKey },
            data: JSON.stringify({ query: query, search_depth: 'basic', max_results: num, include_answer: false }),
            responseType: 'text', timeout: 15000
        });
        var parsed = JSON.parse(resp.data);
        var items = parsed.results || [];
        var normalized = {
            organic: items.map(function(r) {
                return { title: r.title || '', url: r.url || '', snippet: r.content || '', date: null };
            })
        };
        console.log('[xdAnswers] Tavily results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchLinkup(sp, query, num, DEFAULT_BASE_URLS) {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.linkup) + '/search';
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sp.apiKey },
            data: JSON.stringify({ q: query, depth: 'standard', outputType: 'searchResults', maxResults: num }),
            responseType: 'text', timeout: 15000
        });
        var parsed = JSON.parse(resp.data);
        var items = parsed.results || [];
        var normalized = {
            organic: items.map(function(r) {
                return { title: r.name || '', url: r.url || '', snippet: r.content || r.snippet || '', date: null };
            })
        };
        console.log('[xdAnswers] Linkup results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchSearchApi(sp, query, num, DEFAULT_BASE_URLS) {
        var baseUrl = sp.baseUrl || DEFAULT_BASE_URLS.searchapi;
        var engine = (sp.name && /bing/i.test(sp.name)) ? 'bing'
            : (sp.name && /yahoo/i.test(sp.name)) ? 'yahoo'
            : (sp.name && /duckduckgo/i.test(sp.name)) ? 'duckduckgo'
            : 'google';
        var url = baseUrl + '/search?engine=' + engine + '&q=' + encodeURIComponent(query) + '&num=' + num + '&api_key=' + encodeURIComponent(sp.apiKey);
        var resp = await window.xdAnswers.makeRequest({ url: url, method: 'GET', responseType: 'text', timeout: 15000 });
        var parsed = JSON.parse(resp.data);
        var items = parsed.organic_results || [];
        var normalized = {
            organic: items.map(function(r) {
                return { title: r.title || '', url: r.link || '', snippet: r.snippet || '', date: r.date || null };
            }),
            knowledge: parsed.knowledge_graph ? {
                title: parsed.knowledge_graph.title || '',
                description: parsed.knowledge_graph.description || ''
            } : undefined,
            peopleAlsoAsk: (parsed.related_searches || []).map(function(s) {
                return { title: s.query || s.title || '', snippet: '' };
            })
        };
        console.log('[xdAnswers] SearchAPI results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchSearxng(sp, query, num, DEFAULT_BASE_URLS) {
        var baseUrl = sp.baseUrl || DEFAULT_BASE_URLS.searxng;
        var url = baseUrl.replace(/\/+$/, '') + '/search?q=' + encodeURIComponent(query) + '&format=json&pageno=1';
        var resp = await window.xdAnswers.makeRequest({ url: url, method: 'GET', responseType: 'text', timeout: 15000 });
        var parsed = JSON.parse(resp.data);
        var items = parsed.results || [];
        var normalized = {
            organic: items.map(function(r) {
                return { title: r.title || '', url: r.url || '', snippet: r.content || r.snippet || '', date: r.publishedDate || null };
            })
        };
        if (parsed.infoboxes && parsed.infoboxes.length > 0) {
            var ib = parsed.infoboxes[0];
            normalized.knowledge = { title: ib.title || ib.infobox || '', description: ib.content || '' };
        }
        if (parsed.answers && parsed.answers.length > 0) {
            normalized.answerBox = parsed.answers.map(function(a) { return a.answer || ''; }).join('; ');
        }
        console.log('[xdAnswers] SearXNG results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    window.xdAnswers._internal.getActiveSearchProvider = getActiveSearchProvider;
    window.xdAnswers._internal.getEligibleProviders = getEligibleProviders;
    window.xdAnswers._internal.buildWebSearchTool = buildWebSearchTool;
    window.xdAnswers._internal.executeSearch = executeSearch;
})();
