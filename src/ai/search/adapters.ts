// src/ai/search/adapters.ts
// Per-provider search HTTP adapters that normalize results to a shared JSON shape.
(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;

    interface SearchResultItem {
        title: string;
        url: string;
        snippet: string;
        date: string | null;
    }

    interface SearchKnowledge {
        title: string;
        description: string;
    }

    interface NormalizedSearchResults {
        organic: SearchResultItem[];
        knowledge?: SearchKnowledge;
        peopleAlsoAsk?: Array<{ title: string; snippet: string }>;
        answerBox?: string;
    }

    async function searchWithProvider(sp: XdProviderConfig, query: string, num: number, DEFAULT_BASE_URLS: Record<string, string>): Promise<string> {
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

    async function searchLangSearch(sp: XdProviderConfig, query: string, num: number, DEFAULT_BASE_URLS: Record<string, string>): Promise<string> {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.langsearch) + '/web-search';
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sp.apiKey },
            data: JSON.stringify({ query: query, count: num, summary: true }),
            responseType: 'text', timeout: 15000
        });
        var parsed: any = JSON.parse(resp.data);
        var items = parsed.data && parsed.data.webPages ? (parsed.data.webPages.value || []) : [];
        var normalized: NormalizedSearchResults = {
            organic: items.map(function(v: any) {
                return { title: v.name || '', url: v.url || '', snippet: v.snippet || v.summary || '', date: v.datePublished || null };
            })
        };
        console.log('[xdAnswers] LangSearch results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchSerper(sp: XdProviderConfig, query: string, num: number, DEFAULT_BASE_URLS: Record<string, string>): Promise<string> {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.serper) + '/search';
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': sp.apiKey },
            data: JSON.stringify({ q: query, num: num }),
            responseType: 'text', timeout: 15000
        });
        var parsed: any = JSON.parse(resp.data);
        var normalized: NormalizedSearchResults = {
            organic: (parsed.organic || []).map(function(r: any) {
                return { title: r.title || '', url: r.link || '', snippet: r.snippet || '', date: r.date || null };
            }),
            knowledge: parsed.knowledgeGraph ? {
                title: parsed.knowledgeGraph.title || '',
                description: parsed.knowledgeGraph.description || ''
            } : undefined,
            peopleAlsoAsk: (parsed.peopleAlsoAsk || []).map(function(a: any) {
                return { title: a.title || '', snippet: a.snippet || '' };
            })
        };
        console.log('[xdAnswers] Serper results:', normalized.organic.length, 'organic');
        return JSON.stringify(normalized);
    }

    async function searchPerplexity(sp: XdProviderConfig, query: string, num: number, DEFAULT_BASE_URLS: Record<string, string>): Promise<string> {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.perplexity) + '/search';
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sp.apiKey },
            data: JSON.stringify({ query: query, max_results: num }),
            responseType: 'text', timeout: 15000
        });
        var parsed: any = JSON.parse(resp.data);
        var items = parsed.results || [];
        var normalized: NormalizedSearchResults = {
            organic: items.map(function(r: any) {
                return { title: r.title || '', url: r.url || '', snippet: r.snippet || '', date: r.date || r.last_updated || null };
            })
        };
        console.log('[xdAnswers] Perplexity results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchExa(sp: XdProviderConfig, query: string, num: number, DEFAULT_BASE_URLS: Record<string, string>): Promise<string> {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.exa) + '/search';
        var headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sp.apiKey) {
            headers['x-api-key'] = sp.apiKey;
        }
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: headers,
            data: JSON.stringify({ query: query, type: 'auto', numResults: num,
                contents: { text: { maxCharacters: 500 }, highlights: true } }),
            responseType: 'text', timeout: 15000
        });
        var parsed: any = JSON.parse(resp.data);
        var items = parsed.results || [];
        var normalized: NormalizedSearchResults = {
            organic: items.map(function(r: any) {
                return { title: r.title || '', url: r.url || '', snippet: r.text || (r.highlights || []).join(' … ') || '', date: r.publishedDate || null };
            })
        };
        console.log('[xdAnswers] Exa results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchTavily(sp: XdProviderConfig, query: string, num: number, DEFAULT_BASE_URLS: Record<string, string>): Promise<string> {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.tavily) + '/search';
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sp.apiKey },
            data: JSON.stringify({ query: query, search_depth: 'basic', max_results: num, include_answer: false }),
            responseType: 'text', timeout: 15000
        });
        var parsed: any = JSON.parse(resp.data);
        var items = parsed.results || [];
        var normalized: NormalizedSearchResults = {
            organic: items.map(function(r: any) {
                return { title: r.title || '', url: r.url || '', snippet: r.content || '', date: null };
            })
        };
        console.log('[xdAnswers] Tavily results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchLinkup(sp: XdProviderConfig, query: string, num: number, DEFAULT_BASE_URLS: Record<string, string>): Promise<string> {
        var url = (sp.baseUrl || DEFAULT_BASE_URLS.linkup) + '/search';
        var resp = await window.xdAnswers.makeRequest({
            url: url, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sp.apiKey },
            data: JSON.stringify({ q: query, depth: 'standard', outputType: 'searchResults', maxResults: num }),
            responseType: 'text', timeout: 15000
        });
        var parsed: any = JSON.parse(resp.data);
        var items = parsed.results || [];
        var normalized: NormalizedSearchResults = {
            organic: items.map(function(r: any) {
                return { title: r.name || '', url: r.url || '', snippet: r.content || r.snippet || '', date: null };
            })
        };
        console.log('[xdAnswers] Linkup results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchSearchApi(sp: XdProviderConfig, query: string, num: number, DEFAULT_BASE_URLS: Record<string, string>): Promise<string> {
        var baseUrl = sp.baseUrl || DEFAULT_BASE_URLS.searchapi;
        var engine = (sp.name && /bing/i.test(sp.name)) ? 'bing'
            : (sp.name && /yahoo/i.test(sp.name)) ? 'yahoo'
            : (sp.name && /duckduckgo/i.test(sp.name)) ? 'duckduckgo'
            : 'google';
        var url = baseUrl + '/search?engine=' + engine + '&q=' + encodeURIComponent(query) + '&num=' + num + '&api_key=' + encodeURIComponent(sp.apiKey);
        var resp = await window.xdAnswers.makeRequest({ url: url, method: 'GET', responseType: 'text', timeout: 15000 });
        var parsed: any = JSON.parse(resp.data);
        var items = parsed.organic_results || [];
        var normalized: NormalizedSearchResults = {
            organic: items.map(function(r: any) {
                return { title: r.title || '', url: r.link || '', snippet: r.snippet || '', date: r.date || null };
            }),
            knowledge: parsed.knowledge_graph ? {
                title: parsed.knowledge_graph.title || '',
                description: parsed.knowledge_graph.description || ''
            } : undefined,
            peopleAlsoAsk: (parsed.related_searches || []).map(function(s: any) {
                return { title: s.query || s.title || '', snippet: '' };
            })
        };
        console.log('[xdAnswers] SearchAPI results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchSearxng(sp: XdProviderConfig, query: string, num: number, DEFAULT_BASE_URLS: Record<string, string>): Promise<string> {
        var baseUrl = sp.baseUrl || DEFAULT_BASE_URLS.searxng;
        var url = baseUrl.replace(/\/+$/, '') + '/search?q=' + encodeURIComponent(query) + '&format=json&pageno=1';
        var resp = await window.xdAnswers.makeRequest({ url: url, method: 'GET', responseType: 'text', timeout: 15000 });
        var parsed: any = JSON.parse(resp.data);
        var items = parsed.results || [];
        var normalized: NormalizedSearchResults = {
            organic: items.map(function(r: any) {
                return { title: r.title || '', url: r.url || '', snippet: r.content || r.snippet || '', date: r.publishedDate || null };
            })
        };
        if (parsed.infoboxes && parsed.infoboxes.length > 0) {
            var ib = parsed.infoboxes[0];
            normalized.knowledge = { title: ib.title || ib.infobox || '', description: ib.content || '' };
        }
        if (parsed.answers && parsed.answers.length > 0) {
            normalized.answerBox = parsed.answers.map(function(a: any) { return a.answer || ''; }).join('; ');
        }
        console.log('[xdAnswers] SearXNG results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    I.searchWithProvider = searchWithProvider;
})();
