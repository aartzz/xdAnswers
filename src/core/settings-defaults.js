(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    const I = window.xdAnswers._internal;

    const DEFAULT_SETTINGS = {
        providers: [
            {
                id: 'unturf-hermes-default',
                type: 'unturf-hermes',
                name: 'Unturf Hermes',
                baseUrl: 'https://hermes.ai.unturf.com/v1',
                apiKey: ''
            },
            {
                id: 'opencode-zen-default',
                type: 'opencode-zen',
                name: 'OpenCode Zen',
                baseUrl: 'https://opencode.ai/zen/v1',
                apiKey: ''
            },
            {
                id: 'exa-default',
                kind: 'search',
                type: 'exa',
                name: 'Exa',
                baseUrl: 'https://api.exa.ai',
                apiKey: ''
            },
            {
                id: 'searxng-mdosch',
                kind: 'search',
                type: 'searxng',
                name: 'SearXNG (mdosch)',
                baseUrl: 'https://search.mdosch.de',
                apiKey: ''
            },
            {
                id: 'searxng-perennial',
                kind: 'search',
                type: 'searxng',
                name: 'SearXNG (perennialte.ch)',
                baseUrl: 'https://searx.perennialte.ch',
                apiKey: ''
            }
        ],
        activeProviderId: 'opencode-zen-default',
        model: 'big-pickle',
        promptPrefix: I.DEFAULT_SYSTEM_PROMPT,
        language: 'uk',
        autoAnswer: false,
        autoAnswerCooldown: 2000,
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

    const defaultHelperState = {
        width: '380px', height: 'auto', maxHeight: '450px',
        bottom: '20px', right: '20px', top: 'auto', left: 'auto'
    };
    const maximizedHelperState = {
        width: '70vw', height: '70vh', maxHeight: 'none',
        top: '15vh', left: '15vw', bottom: 'auto', right: 'auto'
    };

    window.xdAnswers._internal.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
    window.xdAnswers._internal.defaultHelperState = defaultHelperState;
    window.xdAnswers._internal.maximizedHelperState = maximizedHelperState;
})();
