// src/popup/main.ts
// @ts-nocheck — popup UI module. Popup entry point: boot, initial data loads and render.
import { allModels, modelsDevCache, providerModelsCache, setSettings, settings, uiElements } from './core/state';
import { attachEventListeners } from './core/events';
import { fetchModels, fetchModelsForProvider, loadModelsDevCache, renderModelList } from './models';
import { initAospSettingsNavigation } from './core/navigation';
import { loadSettings } from './core/settings';
import { populateUI } from './core/ui';
import { renderConsensusRuns } from './consensus';
import { getStats, normalizeStats, STATS_KEY } from '../core/stats';

import '../core/constants';
import '../core/settings-defaults';
import '../ui/i18n';

document.addEventListener('DOMContentLoaded', async () => {
    // Home tab: populate environment info
    const browserInfoEl = document.getElementById('home-browser-info');
    const osInfoEl = document.getElementById('home-os-info');

    // Home tab: lifetime counters kept in chrome.storage.local.
    const bypassedCountEl = document.getElementById('home-bypassed-count');
    const answeredCountEl = document.getElementById('home-answered-count');
    const renderHomeStats = (stats: { bypassed: number; answered: number }): void => {
        if (bypassedCountEl) bypassedCountEl.textContent = String(stats.bypassed);
        if (answeredCountEl) answeredCountEl.textContent = String(stats.answered);
    };
    getStats(renderHomeStats);
    try {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local' || !changes[STATS_KEY]) return;
            renderHomeStats(normalizeStats(changes[STATS_KEY].newValue));
        });
    } catch { /* storage events unavailable */ }

    if (browserInfoEl) {
        try {
            const ua = navigator.userAgent;
            let browser = 'Unknown';
            const match = ua.match(/(Firefox|Chrome|Edg|Safari|OPR)[\/ ]([\d.]+)/);
            if (match) {
                const name = match[1] === 'OPR' ? 'Opera' : match[1] === 'Edg' ? 'Edge' : match[1];
                browser = `${name} ${match[2]}`;
            }
            browserInfoEl.textContent = browser;
        } catch { browserInfoEl.textContent = 'Unknown'; }
    }

    if (osInfoEl) {
        try {
            const pf = navigator.platform || '';
            const ua = navigator.userAgent;
            let os = pf;
            if (ua.includes('Win')) os = 'Windows';
            else if (ua.includes('Mac')) os = 'macOS';
            else if (ua.includes('Linux')) os = 'Linux';
            else if (ua.includes('Android')) os = 'Android';
            else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
            osInfoEl.textContent = os || 'Unknown';
        } catch { osInfoEl.textContent = 'Unknown'; }
    }

    // Global fallback for broken model/provider icons — hide gracefully without layout thrashing
    document.addEventListener('error', (e) => {
        const img = e.target;
        if (img && (img.classList.contains('provider-icon') || img.classList.contains('model-icon'))) {
            img.style.display = 'none';
        }
    }, true);

    Object.assign(uiElements, {
        activeProviderTrigger: document.getElementById('active-provider-trigger'),
        activeProviderDropdown: document.getElementById('active-provider-dropdown'),
        modelName: document.getElementById('model-name'),
        fetchModelsBtn: document.getElementById('fetch-models-btn'),
        providersContainer: document.getElementById('providers-container'),
        autoAnswerToggle: document.getElementById('auto-answer-toggle'),
        autoAnswerCooldown: document.getElementById('auto-answer-cooldown'),
        cooldownGroup: document.getElementById('cooldown-group'),
        languageSelect: document.getElementById('language-select'),
        highlightCorrectToggle: document.getElementById('highlight-correct-toggle'),
        showAnswerOnlyToggle: document.getElementById('show-answer-only-toggle'),
        silentModeToggle: document.getElementById('silent-mode-toggle'),
        silentModeSelect: document.getElementById('silent-mode-select'),
        silentModeSelectGroup: document.getElementById('silent-mode-select-group'),
        webSearchToggle: document.getElementById('web-search-toggle'),
        calculatorToggle: document.getElementById('calculator-toggle'),
        consensusToggle: document.getElementById('consensus-toggle'),
        consensusRunsContainer: document.getElementById('consensus-runs-container'),
        addConsensusRunBtn: document.getElementById('add-consensus-run-btn'),
        positionGrid: document.getElementById('position-grid'),
        rememberDragToggle: document.getElementById('remember-drag-toggle'),
        themesGrid: document.getElementById('themes-grid'),
        themeEngineSelect: document.getElementById('theme-engine-select'),
        glowEffectToggle: document.getElementById('glow-effect-toggle'),
        themeEditor: document.getElementById('theme-editor'),
        themeEditorClose: document.getElementById('theme-editor-close'),
        themeEditorCancel: document.getElementById('theme-editor-cancel'),
        themeEditorSave: document.getElementById('theme-editor-save'),
        editorName: document.getElementById('theme-editor-name'),
        editorBorderInput: document.getElementById('editor-border-input'),
        editorBorderPicker: document.getElementById('editor-border-picker'),
        editorHeaderInput: document.getElementById('editor-header-input'),
        editorHeaderPicker: document.getElementById('editor-header-picker'),
        editorContentInput: document.getElementById('editor-content-input'),
        editorContentPicker: document.getElementById('editor-content-picker'),
        editorTextInput: document.getElementById('editor-text-input'),
        editorTextPicker: document.getElementById('editor-text-picker'),
        hotkeyRecorder: document.getElementById('hotkey-recorder'),
        hotkeyRecorderKbd: document.getElementById('hotkey-recorder-kbd'),
        hotkeyClear: document.getElementById('hotkey-clear'),
        disablerToggle: document.getElementById('disabler-toggle')
    });

    setSettings(await loadSettings());
    await loadModelsDevCache();
    populateUI();
    attachEventListeners();
    initAospSettingsNavigation();

    // Home tab: dynamic status based on active tab URL
    const SUPPORTED_HOSTS: RegExp[] = [
        /^(.*\.)?vseosvita\.ua$/,
        /^kahoot\.it$/,
        /^classtime\.com$/,
        /^justclass\.com\.ua$/,
        /^justclass\.me$/,
        /^miyklas\.com\.ua$/,
        /^lcloud\.in\.ua$/,
        /^(.*\.)?naurok\.com\.ua$/,
        /^(.*\.)?naurok\.ua$/,
        /^quizlet\.com$/,
        /^(.*\.)?testportal\.pl$/,
        /^(.*\.)?testportal\.net$/,
        /^(.*\.)?szkolawchmurze\.org$/,
        /^(.*\.)?blooket\.com$/,
        /^(.*\.)?gimkit\.com$/,
        /^(.*\.)?wayground\.com$/,
        /^(.*\.)?mriia\.gov\.ua$/,
        /^(.*\.)?wordwall\.net$/,
        /^schoolos-test\.vercel\.app$/,
        /^schoolos\.vercel\.app$/,
        /^schoolosua\.github\.io$/,
        /^docs\.google\.com$/,
        /^forms\.office\.com$/,
    ];

    function isSupportedHost(hostname: string): boolean {
        return SUPPORTED_HOSTS.some(re => re.test(hostname));
    }

    const statusCard = document.getElementById('home-status-card');
    const statusEmoji = document.getElementById('home-status-emoji');
    const statusLabel = document.getElementById('home-status-label');

    function applyStatus(type: 'active' | 'inactive' | 'error' | 'settings'): void {
        if (!statusCard || !statusEmoji || !statusLabel) return;
        statusCard.classList.remove('status-error', 'status-inactive');
        const tFn = (window.xdAnswers?._internal?.TRANSLATIONS as any)?.[settings?.language || 'uk'];
        if (type === 'active') {
            statusEmoji.textContent = 'sentiment_satisfied';
            statusLabel.textContent = tFn?.homeStatusActive || 'Активний';
        } else if (type === 'inactive') {
            statusCard.classList.add('status-inactive');
            statusEmoji.textContent = 'sentiment_dissatisfied';
            statusLabel.textContent = tFn?.homeStatusInactive || 'Не підтримується';
        } else if (type === 'settings') {
            statusEmoji.textContent = 'settings';
            statusLabel.textContent = tFn?.navSettings || 'Налаштування';
        } else {
            statusCard.classList.add('status-error');
            statusEmoji.textContent = 'error';
            statusLabel.textContent = tFn?.homeStatusError || 'Помилка';
        }
    }

    try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            try {
                const tab = tabs && tabs[0];
                if (!tab || !tab.url) {
                    applyStatus('error');
                    return;
                }
                let extensionBase = '';
                try { extensionBase = chrome.runtime.getURL(''); } catch { /* silent */ }
                if (extensionBase && tab.url.startsWith(extensionBase)) {
                    applyStatus('settings');
                    return;
                }
                let hostname = '';
                try {
                    hostname = new URL(tab.url).hostname;
                } catch {
                    applyStatus('error');
                    return;
                }
                if (isSupportedHost(hostname)) {
                    applyStatus('active');
                } else {
                    applyStatus('inactive');
                }
            } catch {
                applyStatus('error');
            }
        });
    } catch {
        applyStatus('error');
    }

    // Home tab: show active provider name
    const homeProviderInfoEl = document.getElementById('home-provider-info');
    if (homeProviderInfoEl && settings) {
        try {
            const activeProv = (settings.providers || []).find((p: any) => p.id === settings.activeProviderId);
            if (activeProv) {
                homeProviderInfoEl.textContent = activeProv.name || activeProv.type || 'Unknown';
            } else {
                homeProviderInfoEl.textContent = 'Not configured';
            }
        } catch { /* silent */ }
    }
    // Trigger background models.dev sync silently if missing
    if (!modelsDevCache) {
        chrome.runtime.sendMessage({ type: 'forceModelSync' });
    }
    // Auto-fetch models from provider API
    if (!allModels.length) {
        fetchModels().then(() => renderModelList());
    }
    // Pre-fetch models for existing consensus run providers
    if (settings.consensus?.runs?.length) {
        const providerIds = [...new Set(settings.consensus.runs.map(r => r.providerId).filter(Boolean))];
        for (const pid of providerIds) {
            const prov = settings.providers.find(p => p.id === pid);
            if (prov && !providerModelsCache[pid]) {
                fetchModelsForProvider(prov).then(models => {
                    providerModelsCache[pid] = models;
                    renderConsensusRuns();
                }).catch(() => {});
            }
        }
    }
});
