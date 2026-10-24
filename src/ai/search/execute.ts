// src/ai/search/execute.ts
// Search execution with provider selection and fallback across configured providers.
(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;

    const getEligibleProviders = I.getEligibleProviders;
    const getActiveSearchProvider = I.getActiveSearchProvider;
    const searchWithProvider = I.searchWithProvider;

    function findProviderBySource(s: XdSettings, source?: string | null): XdProviderConfig | null {
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

    async function executeSearch(query: string, count?: number, preferredSource?: string | null): Promise<string> {
        var DEFAULT_BASE_URLS = window.xdAnswers._internal.DEFAULT_BASE_URLS;
        var s: XdSettings = window.xdAnswers.settings || ({} as XdSettings);
        var sp = preferredSource
            ? findProviderBySource(s, preferredSource)
            : getActiveSearchProvider(s);

        if (!sp) throw new Error('No search provider configured');

        var num = Math.min(Math.max(count || 5, 1), 10);
        var lastError: unknown = null;

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
                var errMsg = e instanceof Error ? e.message : String(e);
                console.warn('[xdAnswers] Search provider ' + p.name + ' (' + p.type + ') failed:', errMsg);
                lastError = e;
                // Continue to next provider
            }
        }

        throw lastError || new Error('All search providers failed');
    }

    I.executeSearch = executeSearch;
})();
