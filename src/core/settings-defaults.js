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
                id: 'unturf-qwen-default',
                type: 'unturf-qwen',
                name: 'Unturf Qwen',
                baseUrl: 'https://qwen.ai.unturf.com/v1',
                apiKey: ''
            },
            {
                id: 'unturf-vl-default',
                type: 'unturf-vl',
                name: 'Unturf Vision',
                baseUrl: 'https://qwen-vl.ai.unturf.com/v1',
                apiKey: ''
            },
            {
                id: 'opencode-zen-default',
                type: 'opencode-zen',
                name: 'OpenCode Zen',
                baseUrl: 'https://opencode.ai/zen/v1',
                apiKey: ''
            }
        ],
        activeProviderId: 'opencode-zen-default',
        model: '',
        promptPrefix: I.DEFAULT_SYSTEM_PROMPT,
        language: 'uk',
        autoAnswer: false,
        autoAnswerCooldown: 2000,
        highlightCorrect: true,
        showAnswerOnly: false,
        silentMode: '',
        _silentModePreselect: 'indicators',
        hotkey: 'Ctrl+Shift+X',
        webSearchEnabled: false,
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
        }
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
