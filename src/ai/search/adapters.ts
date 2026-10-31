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

    // ── Remote MCP search (Streamable HTTP, JSON-RPC over POST) ──
    // No stdio, no local bridge: the background fetch proxy does the HTTP part.
    const MCP_TOOL_TTL = 10 * 60 * 1000;
    const MCP_TOOL_CACHE: Record<string, { tools: any[]; ts: number }> = {};

    function mcpHeaders(sp: XdProviderConfig): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
        };
        const key = (sp.apiKey || '').trim();
        const url = (sp.baseUrl || '').toLowerCase();
        if (key) {
            if (url.indexOf('tinyfish') !== -1) {
                headers['X-API-Key'] = key;
                headers['Authorization'] = 'Bearer ' + key;
            } else if (url.indexOf('exa.ai') !== -1) headers['x-api-key'] = key;
            else headers['Authorization'] = 'Bearer ' + key;
        } else if (url.indexOf('tavily') !== -1) {
            // Tavily's hosted MCP has a free keyless mode selected by this header.
            headers['X-Tavily-Access-Mode'] = 'keyless';
        }
        return headers;
    }

    function parseMcpMessages(raw: string): any[] {
        const text = String(raw || '').trim();
        if (!text) return [];
        if (text.charAt(0) === '{' || text.charAt(0) === '[') {
            try {
                const parsed = JSON.parse(text);
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) { /* fall through to SSE parsing */ }
        }

        const messages: any[] = [];
        let dataLines: string[] = [];
        const flush = function() {
            if (!dataLines.length) return;
            const payload = dataLines.join('\n');
            dataLines = [];
            try {
                const parsed = JSON.parse(payload);
                if (Array.isArray(parsed)) messages.push.apply(messages, parsed);
                else messages.push(parsed);
            } catch (e) { /* ignore malformed event */ }
        };

        text.split(/\r?\n/).forEach(function(line) {
            if (!line) { flush(); return; }
            if (line.charAt(0) === ':') return;
            if (line.indexOf('data:') === 0) dataLines.push(line.slice(5).replace(/^ /, ''));
        });
        flush();

        if (!messages.length) {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end > start) {
                try { messages.push(JSON.parse(text.slice(start, end + 1))); } catch (e) { /* ignore */ }
            }
        }
        return messages;
    }

    function parseMcpResponse(raw: string, id: number): any {
        const messages = parseMcpMessages(raw);
        let fallback: any = null;
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (!msg || typeof msg !== 'object') continue;
            if (msg.id !== undefined && msg.id !== id) continue;
            if (msg.error) {
                const message = msg.error && (msg.error.message || msg.error.code);
                throw new Error('MCP error: ' + (message || 'unknown'));
            }
            if (msg.result !== undefined) {
                if (msg.id === id) return msg.result;
                fallback = msg.result;
            }
        }
        if (fallback !== null) return fallback;
        throw new Error('MCP: empty or invalid JSON-RPC response');
    }

    async function mcpRpc(sp: XdProviderConfig, method: string, params: Record<string, unknown>, id: number, timeout: number): Promise<any> {
        if (!sp.baseUrl) throw new Error('MCP server URL is empty');
        const resp = await window.xdAnswers.makeRequest({
            url: sp.baseUrl,
            method: 'POST',
            headers: mcpHeaders(sp),
            data: JSON.stringify({ jsonrpc: '2.0', id: id, method: method, params: params }),
            responseType: 'text',
            timeout: timeout
        });
        return parseMcpResponse(resp.data, id);
    }

    async function mcpNotify(sp: XdProviderConfig, method: string): Promise<void> {
        if (!sp.baseUrl) return;
        try {
            await window.xdAnswers.makeRequest({
                url: sp.baseUrl,
                method: 'POST',
                headers: mcpHeaders(sp),
                data: JSON.stringify({ jsonrpc: '2.0', method: method }),
                responseType: 'text',
                timeout: 10000
            });
        } catch (e) { /* notification failures are harmless */ }
    }

    async function getMcpTools(sp: XdProviderConfig): Promise<any[]> {
        const cacheKey = (sp.baseUrl || '') + '|' + (sp.apiKey ? 'key' : 'anon');
        const cached = MCP_TOOL_CACHE[cacheKey];
        if (cached && Date.now() - cached.ts < MCP_TOOL_TTL) return cached.tools;

        // Stateless Streamable HTTP servers accept tools/list without a session.
        // Try initialize first for spec-compliant servers, but do not fail if it
        // reports an unsupported version — tools/list is the real probe.
        try {
            await mcpRpc(sp, 'initialize', {
                protocolVersion: '2025-03-26',
                capabilities: {},
                clientInfo: { name: 'xdAnswers', version: '6.0.0' }
            }, 1, 20000);
            await mcpNotify(sp, 'notifications/initialized');
        } catch (e) {
            console.log('[xdAnswers] MCP initialize skipped for ' + (sp.name || sp.baseUrl) + ': ' + (e instanceof Error ? e.message : String(e)));
        }

        const result = await mcpRpc(sp, 'tools/list', {}, 2, 20000);
        const tools = result && Array.isArray(result.tools) ? result.tools : [];
        MCP_TOOL_CACHE[cacheKey] = { tools: tools, ts: Date.now() };
        return tools;
    }

    function chooseSearchTool(tools: any[]): any {
        const scored = tools.map(function(tool) {
            const name = String(tool && tool.name || '').toLowerCase();
            const desc = String(tool && tool.description || '').toLowerCase();
            if (!name) return { tool: tool, score: -1 };
            let score = 0;
            if (/^(web_)?search$/.test(name)) score += 120;
            if (name === 'web_search_exa') score += 110;
            if (name === 'tavily_search') score += 110;
            if (name.indexOf('search') !== -1) score += 60;
            if (/extract|fetch|crawl|map|research|agent|browse|scrape|read/.test(name)) score -= 100;
            if (/search/.test(desc)) score += 10;
            return { tool: tool, score: score };
        }).sort(function(a, b) { return b.score - a.score; });
        if (!scored.length || scored[0].score <= 0) {
            throw new Error('MCP server exposes no search tool');
        }
        return scored[0].tool;
    }

    function buildMcpArguments(tool: any, query: string, num: number): Record<string, unknown> {
        const schema = tool && tool.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : {};
        const props = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
        const args: Record<string, unknown> = {};

        const assign = function(keys: string[], value: unknown) {
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (props[key] !== undefined && args[key] === undefined) args[key] = value;
            }
        };
        assign(['query', 'q', 'search_query', 'searchQuery', 'text', 'prompt', 'question', 'input'], query);
        assign(['objective', 'goal', 'purpose'], query);
        assign(['search_queries', 'queries', 'searchQueries'], [query]);
        assign(['max_results', 'maxResults', 'numResults', 'num_results', 'limit', 'count', 'num', 'n', 'top_k', 'topK'], num);

        const required: string[] = Array.isArray(schema.required) ? schema.required : [];
        for (let i = 0; i < required.length; i++) {
            const key = required[i];
            if (args[key] !== undefined) continue;
            const prop = props[key] || {};
            if (prop.type === 'array' || prop.items) args[key] = [query];
            else if (prop.type === 'number' || prop.type === 'integer') args[key] = num;
            else if (prop.type === 'boolean') args[key] = false;
            else if (prop.type === 'object') args[key] = {};
            else args[key] = query;
        }
        if (!Object.keys(args).length) args.query = query;
        return args;
    }

    function truncateText(value: unknown, max: number): string {
        const text = String(value === undefined || value === null ? '' : value).trim();
        return text.length > max ? text.slice(0, max - 1) + '…' : text;
    }

    function mcpText(result: any): string {
        const content = result && Array.isArray(result.content) ? result.content : [];
        return content.filter(function(part: any) {
            return part && part.type === 'text' && typeof part.text === 'string';
        }).map(function(part: any) { return part.text; }).join('\n');
    }

    function parseJsonLoose(text: string): any | null {
        const trimmed = String(text || '').trim();
        if (!trimmed) return null;
        try { return JSON.parse(trimmed); } catch (e) { /* not pure JSON */ }
        const start = trimmed.search(/[\[{]/);
        const end = trimmed.lastIndexOf('}');
        const endArr = trimmed.lastIndexOf(']');
        const close = Math.max(end, endArr);
        if (start !== -1 && close > start) {
            try { return JSON.parse(trimmed.slice(start, close + 1)); } catch (e) { /* give up */ }
        }
        return null;
    }

    function extractSearchItems(value: any, depth: number): SearchResultItem[] {
        if (!value || depth > 5) return [];
        if (Array.isArray(value)) {
            const out: SearchResultItem[] = [];
            for (let i = 0; i < value.length; i++) {
                const item = value[i];
                if (item && typeof item === 'object' && (item.url || item.link || item.href)) {
                    out.push(mapSearchItem(item));
                } else {
                    out.push.apply(out, extractSearchItems(item, depth + 1));
                }
            }
            return out;
        }
        if (typeof value !== 'object') return [];

        const out: SearchResultItem[] = [];
        const containers = ['results', 'organic', 'items', 'documents', 'pages', 'web', 'data'];
        for (let i = 0; i < containers.length; i++) {
            const child = value[containers[i]];
            if (child && typeof child === 'object') out.push.apply(out, extractSearchItems(child, depth + 1));
        }
        if (value.url || value.link || value.href) out.push(mapSearchItem(value));
        return out;
    }

    function mapSearchItem(item: any): SearchResultItem {
        const rawSnippet = item.snippet !== undefined ? item.snippet
            : item.content !== undefined ? item.content
            : item.text !== undefined ? item.text
            : item.description !== undefined ? item.description
            : item.excerpt !== undefined ? item.excerpt
            : Array.isArray(item.excerpts) ? item.excerpts.join('\n\n')
            : item.summary !== undefined ? item.summary
            : '';
        return {
            title: String(item.title || item.name || item.heading || ''),
            url: String(item.url || item.link || item.href || ''),
            snippet: truncateText(rawSnippet, 900),
            date: (item.publish_date || item.publishedDate || item.published || item.date || null) as string | null
        };
    }

    function parseExaText(text: string): SearchResultItem[] {
        return String(text || '').split(/\n-{3,}\n/).map(function(block) {
            const title = /^Title:\s*(.+)$/m.exec(block);
            const url = /^URL:\s*(\S+)/m.exec(block);
            const published = /^Published:\s*(.+)$/m.exec(block);
            const highlights = block.split(/\nHighlights:\s*\n?/);
            return {
                title: title ? title[1].trim() : '',
                url: url ? url[1].trim() : '',
                snippet: truncateText(highlights.length > 1 ? highlights.slice(1).join('\n') : block, 900),
                date: published && published[1].trim() !== 'N/A' ? published[1].trim() : null
            };
        }).filter(function(item) { return !!item.url; });
    }

    function mcpErrorText(value: any): string {
        if (!value || typeof value !== 'object') return '';
        if (value.error) {
            return typeof value.error === 'string' ? value.error : (value.error.message || JSON.stringify(value.error));
        }
        if (value.code && !value.results && !value.organic) {
            return String(value.message || value.code);
        }
        return '';
    }

    function normalizeMcpSearchResult(result: any, num: number): NormalizedSearchResults {
        if (result && result.isError) {
            const errorText = mcpText(result) || 'MCP search tool returned an error';
            throw new Error(truncateText(errorText, 300));
        }

        const text = mcpText(result);
        const parsedText = parseJsonLoose(text);
        const structuredError = mcpErrorText(result && result.structuredContent) || mcpErrorText(parsedText);
        if (structuredError) throw new Error('MCP search error: ' + truncateText(structuredError, 300));

        let items: SearchResultItem[] = extractSearchItems(result && (result.structuredContent || result.result || result), 0);
        if (!items.length && text) {
            const parsed = parsedText || parseJsonLoose(text);
            if (parsed) items = extractSearchItems(parsed, 0);
            if (!items.length) items = parseExaText(text);
        }

        const normalized: NormalizedSearchResults = {
            organic: items.slice(0, num).map(function(item) {
                return { title: item.title, url: item.url, snippet: item.snippet, date: item.date };
            })
        };
        if (!normalized.organic.length && text) {
            normalized.answerBox = truncateText(text, 2000);
        }
        return normalized;
    }

    async function searchMcp(sp: XdProviderConfig, query: string, num: number): Promise<string> {
        const tools = await getMcpTools(sp);
        const tool = chooseSearchTool(tools);
        const args = buildMcpArguments(tool, query, num);
        console.log('[xdAnswers] MCP search:', sp.name || sp.baseUrl, '| tool=' + tool.name, '| args=' + JSON.stringify(args));
        const result = await mcpRpc(sp, 'tools/call', { name: tool.name, arguments: args }, 3, 60000);
        const normalized = normalizeMcpSearchResult(result, num);
        console.log('[xdAnswers] MCP results:', normalized.organic.length, 'items');
        return JSON.stringify(normalized);
    }

    async function searchWithProvider(sp: XdProviderConfig, query: string, num: number, DEFAULT_BASE_URLS: Record<string, string>): Promise<string> {
        switch (sp.type) {
            case 'mcp': return searchMcp(sp, query, num);
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
