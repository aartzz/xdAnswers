(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    function getActiveProvider(s) {
        if (!s.providers || !s.providers.length) return null;
        const active = s.providers.find(p => p.id === s.activeProviderId);
        if (active && active.kind !== 'search') return active;
        // Fallback: first non-search provider
        return s.providers.find(p => p.kind !== 'search') || null;
    }

    function getEffectiveSettings(s) {
        const I = window.xdAnswers._internal;
        const DEFAULT_BASE_URLS = I.DEFAULT_BASE_URLS;
        const API_FORMAT_MAP = I.API_FORMAT_MAP;
        const getActiveSearchProvider = I.getActiveSearchProvider;

        const active = getActiveProvider(s);
        if (!active) return { apiFormat: 'openai', baseUrl: DEFAULT_BASE_URLS.openai, apiKey: '', model: s.model, promptPrefix: s.promptPrefix, webSearchEnabled: s.webSearchEnabled || false };
        const apiFormat = API_FORMAT_MAP[active.type] || (active.type === 'other' ? 'openai' : active.type);
        const baseUrl = active.baseUrl || DEFAULT_BASE_URLS[active.type] || DEFAULT_BASE_URLS.openai;
        return {
            apiFormat: apiFormat,
            baseUrl: baseUrl,
            apiKey: active.apiKey,
            model: s.model,
            promptPrefix: s.promptPrefix,
            webSearchEnabled: (s.webSearchEnabled || false) && !!(getActiveSearchProvider && getActiveSearchProvider(s))
        };
    }

    window.xdAnswers.loadSettings = async function() {
        const I = window.xdAnswers._internal;
        const DEFAULT_SETTINGS = I.DEFAULT_SETTINGS;
        const DEFAULT_BASE_URLS = I.DEFAULT_BASE_URLS;

        const data = await chrome.storage.local.get('xdAnswers_settings');
        let s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        if (data.xdAnswers_settings) {
            try {
                const p = JSON.parse(data.xdAnswers_settings);

                // Migration from old flat format
                if (p.apiFormat && !p.providers) {
                    const oldDefaults = { openai: 'https://api.openai.com/v1', anthropic: 'https://api.anthropic.com', google: 'https://generativelanguage.googleapis.com' };
                    let baseUrl = p.baseUrl || DEFAULT_BASE_URLS[p.apiFormat] || '';
                    if (oldDefaults[p.apiFormat] === baseUrl) {
                        baseUrl = DEFAULT_BASE_URLS[p.apiFormat];
                    }
                    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                    const providerNames = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google (Gemini)' };
                    p.providers = [{
                        id: id,
                        type: p.apiFormat,
                        name: providerNames[p.apiFormat] || p.apiFormat,
                        baseUrl: baseUrl,
                        apiKey: p.apiKey || ''
                    }];
                    p.activeProviderId = id;
                    delete p.apiFormat;
                    delete p.baseUrl;
                    delete p.apiKey;
                }

                s = { ...s, ...p, providers: p.providers || [], customization: { ...s.customization, ...(p.customization || {}) } };

                // Міграція: додати безкоштовні unturf провайдери для юзерів з порожнім списком
                if (!s.providers || s.providers.length === 0) {
                    s.providers = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.providers));
                    s.activeProviderId = DEFAULT_SETTINGS.activeProviderId;
                }
                if (typeof s.promptPrefix !== 'string' || !s.promptPrefix.trim()) {
                    s.promptPrefix = DEFAULT_SETTINGS.promptPrefix;
                }
                // Migrate silentMode: true/false → string
                if (typeof s.silentMode === 'boolean') {
                    s.silentMode = s.silentMode ? 'ghost' : '';
                }
            } catch (e) {
                console.error('xdAnswers: Failed to parse settings.', e);
            }
        }
        window.xdAnswers.settings = s;
        // Update footer model name
        const footerModel = document.getElementById('xd-footer-model');
        if (footerModel) footerModel.textContent = s.model || 'select model ↗';
        return s;
    };

    window.xdAnswers._internal.getActiveProvider = getActiveProvider;
    window.xdAnswers._internal.getEffectiveSettings = getEffectiveSettings;
})();
