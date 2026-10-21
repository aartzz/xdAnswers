// src/popup/settings.ts
// @ts-nocheck — popup UI module. Settings load/save and autoSave().
import { generateId } from './utils';
import { getApiProviderMeta } from './providers';
import { settings, uiElements } from './state';

export async function loadSettings() {
    const data = await chrome.storage.local.get('xdAnswers_settings');
    let loaded = JSON.parse(JSON.stringify(window.xdAnswers._internal.DEFAULT_SETTINGS));
    if (data.xdAnswers_settings) {
        try {
            const parsed = JSON.parse(data.xdAnswers_settings);

            // Migration from old flat format (apiFormat/baseUrl/apiKey at root)
            if (parsed.apiFormat && !parsed.providers) {
                const oldDefaults = {
                    openai: 'https://api.openai.com/v1',
                    anthropic: 'https://api.anthropic.com',
                    google: 'https://generativelanguage.googleapis.com'
                };
                let baseUrl = parsed.baseUrl || window.xdAnswers._internal.DEFAULT_BASE_URLS[parsed.apiFormat] || '';
                if (oldDefaults[parsed.apiFormat] === baseUrl) {
                    baseUrl = window.xdAnswers._internal.DEFAULT_BASE_URLS[parsed.apiFormat];
                }
                const meta = getApiProviderMeta(parsed.apiFormat);
                const migratedProvider = {
                    id: generateId(),
                    type: parsed.apiFormat,
                    name: meta.name,
                    baseUrl: baseUrl,
                    apiKey: parsed.apiKey || ''
                };
                parsed.providers = [migratedProvider];
                parsed.activeProviderId = migratedProvider.id;
                parsed.model = parsed.model || 'gpt-4o';
                delete parsed.apiFormat;
                delete parsed.baseUrl;
                delete parsed.apiKey;
            }

            loaded = {
                ...loaded,
                ...parsed,
                providers: parsed.providers || [],
                customization: { ...loaded.customization, ...(parsed.customization || {}) },
                consensus: { ...loaded.consensus, ...(parsed.consensus || {}) }
            };

            // Очистити закриті Unturf Qwen / Vision провайдери
            if (Array.isArray(loaded.providers)) {
                loaded.providers = loaded.providers.filter(pr => pr.type !== 'unturf-qwen' && pr.type !== 'unturf-vl');
                // Додати Exa якщо відсутній серед search-провайдерів
                if (!loaded.providers.some(pr => pr.type === 'exa')) {
                    loaded.providers.push({
                        id: 'exa-default',
                        kind: 'search',
                        type: 'exa',
                        name: 'Exa',
                        baseUrl: 'https://api.exa.ai',
                        apiKey: ''
                    });
                }
            }

            // Міграція: додати дефолтні провайдери для юзерів з порожнім списком
            if (!loaded.providers || loaded.providers.length === 0) {
                loaded.providers = JSON.parse(JSON.stringify(window.xdAnswers._internal.DEFAULT_SETTINGS.providers));
                loaded.activeProviderId = window.xdAnswers._internal.DEFAULT_SETTINGS.activeProviderId;
            }

            const activePr = loaded.providers.find(p => p.id === loaded.activeProviderId);
            if (!activePr || activePr.kind === 'search') {
                const nonSearch = loaded.providers.filter(p => p.kind !== 'search');
                loaded.activeProviderId = nonSearch[0]?.id || window.xdAnswers._internal.DEFAULT_SETTINGS.activeProviderId;
            }
            if (typeof loaded.promptPrefix !== 'string' || !loaded.promptPrefix.trim()) {
                loaded.promptPrefix = window.xdAnswers._internal.DEFAULT_SETTINGS.promptPrefix;
            }
            // Migrate silentMode: true/false → string
            if (typeof loaded.silentMode === 'boolean') {
                loaded.silentMode = loaded.silentMode ? 'ghost' : '';
            }
            if (!Array.isArray(loaded.customThemes)) {
                loaded.customThemes = [];
            }
            // Migration: add consensus defaults if missing
            if (!loaded.consensus || typeof loaded.consensus !== 'object') {
                loaded.consensus = { enabled: false, runs: [] };
            }
            if (!Array.isArray(loaded.consensus.runs)) {
                loaded.consensus.runs = [];
            }
        } catch (e) {
            console.error('Failed to parse settings', e);
        }
    }
    return loaded;
}

export async function saveSettingsAndNotify(s) {
    await chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(s) });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'settingsUpdated' }, () => chrome.runtime.lastError && undefined);
        }
    });
}

export async function autoSave(overrides) {
    const el = uiElements;
    settings.model = el.modelName.value;
    settings.language = el.languageSelect?.value || settings.language || 'uk';
    settings.autoAnswer = el.autoAnswerToggle.checked;
    settings.autoAnswerCooldown = parseInt(el.autoAnswerCooldown.value, 10) || 2000;
    settings.highlightCorrect = el.highlightCorrectToggle.checked;
    settings.showAnswerOnly = el.showAnswerOnlyToggle.checked;
    settings.silentMode = el.silentModeToggle.checked ? (el.silentModeSelect.value || 'indicators') : '';
    settings._silentModePreselect = el.silentModeSelect.value || 'indicators';
    settings.webSearchEnabled = el.webSearchToggle?.checked ?? settings.webSearchEnabled;
    settings.calculatorEnabled = el.calculatorToggle?.checked ?? (settings.calculatorEnabled !== false);
    settings.disablerEnabled = el.disablerToggle?.checked ?? settings.disablerEnabled;
    settings.themeEngine = el.themeEngineSelect?.value || settings.themeEngine || 'material3';
    settings.consensus.enabled = el.consensusToggle?.checked ?? !!(settings.consensus && settings.consensus.enabled);
    settings.customization.glowEffect = el.glowEffectToggle.checked;

    if (overrides) {
        for (const [k, v] of Object.entries(overrides)) {
            if (k.startsWith('customization.')) {
                settings.customization[k.split('.')[1]] = v;
            } else {
                settings[k] = v;
            }
        }
    }

    await saveSettingsAndNotify(settings);
}
