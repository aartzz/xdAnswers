(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    const DEFAULT_SETTINGS: XdSettings = {
        providers: [
            {
                id: 'unturf-hermes-default',
                type: 'unturf-hermes',
                name: 'Unturf Hermes',
                baseUrl: 'https://hermes.ai.unturf.com/v1',
                apiKey: ''
            },
            {
                id: 'pollinations-default',
                type: 'pollinations',
                name: 'Pollinations',
                baseUrl: 'https://text.pollinations.ai/v1',
                apiKey: ''
            },
            {
                id: 'mcp-exa',
                kind: 'search',
                type: 'mcp',
                name: 'Exa MCP',
                baseUrl: 'https://mcp.exa.ai/mcp',
                apiKey: ''
            },
            {
                id: 'mcp-tavily',
                kind: 'search',
                type: 'mcp',
                name: 'Tavily MCP',
                baseUrl: 'https://mcp.tavily.com/mcp/',
                apiKey: ''
            },
            {
                id: 'mcp-parallel',
                kind: 'search',
                type: 'mcp',
                name: 'Parallel MCP',
                baseUrl: 'https://mcp.parallel.ai/mcp',
                apiKey: ''
            },
            {
                id: 'mcp-tinyfish',
                kind: 'search',
                type: 'mcp',
                name: 'TinyFish MCP',
                baseUrl: 'https://agent.tinyfish.ai/mcp',
                apiKey: ''
            }
        ],
        activeProviderId: 'pollinations-default',
        model: 'openai-fast',
        promptPrefix: I.DEFAULT_SYSTEM_PROMPT,
        language: 'uk',
        autoAnswer: false,
        autoAnswerCooldown: 2000,
        answerCacheEnabled: true,
        answerCacheTtlDays: 30,
        highlightCorrect: true,
        showAnswerOnly: false,
        silentMode: '',
        _silentModePreselect: 'indicators',
        hotkey: 'Ctrl+Shift+X',
        webSearchEnabled: true,
        calculatorEnabled: true,
        themeEngine: 'material3',
        defaultPosition: 'bottom-right',
        rememberDragPosition: false,
        savedPosition: null,
        disablerEnabled: false,
        customization: {
            glowEffect: false,
            borderColor: '#cccccc',
            contentColor: '#1c1c1c',
            headerColor: '#333333',
            textColor: '#e0e0e0'
        },
        consensus: {
            enabled: false,
            runs: []
        },
        customThemes: []
    };

    const defaultHelperState: XdHelperState = {
        width: '380px', height: 'auto', maxHeight: '450px',
        bottom: '20px', right: '20px', top: 'auto', left: 'auto'
    };
    const maximizedHelperState: XdHelperState = {
        width: '70vw', height: '70vh', maxHeight: 'none',
        top: '15vh', left: '15vw', bottom: 'auto', right: 'auto'
    };

    // Pollinations is the keyless default. Existing installs that still point at
    // the OpenCode Zen free tier are moved over once, so the extension keeps
    // working without an API key. Paid Zen installs are left alone.
    function applyProviderDefaultMigrations(s: XdSettings): XdSettings {
        if (!s || !Array.isArray(s.providers)) return s;
        const defaultPollinations = DEFAULT_SETTINGS.providers.find(p => p.type === 'pollinations');
        if (defaultPollinations && !s.providers.some(p => p.type === 'pollinations')) {
            s.providers.push(JSON.parse(JSON.stringify(defaultPollinations)));
        }
        const active = s.providers.find(p => p.id === s.activeProviderId);
        if (active && active.type === 'pollinations') {
            s._pollinationsDefaultApplied = true;
        }
        const freeZen = active && active.type === 'opencode-zen' && !active.apiKey;
        if (freeZen && !s._pollinationsDefaultApplied) {
            const pollinations = s.providers.find(p => p.type === 'pollinations');
            if (pollinations) {
                s.activeProviderId = pollinations.id;
                s.model = 'openai-fast';
                s._pollinationsDefaultApplied = true;
            }
        }
        return s;
    }

    window.xdAnswers._internal.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
    window.xdAnswers._internal.defaultHelperState = defaultHelperState;
    window.xdAnswers._internal.maximizedHelperState = maximizedHelperState;
    window.xdAnswers._internal.applyProviderDefaultMigrations = applyProviderDefaultMigrations;
})();
