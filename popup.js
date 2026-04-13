const PREDEFINED_THEMES = {
    'Indigo': { borderColor: '#6366f1', contentColor: '#1e1e2e', headerColor: '#2a2a3e', textColor: '#cdd6f4' },
    'AMOLED': { borderColor: '#ffffff', contentColor: '#000000', headerColor: '#111111', textColor: '#ffffff' },
    'Dark': { borderColor: '#cccccc', contentColor: '#1c1c1c', headerColor: '#333333', textColor: '#e0e0e0' },
    'Light': { borderColor: '#6366f1', contentColor: '#f5f5f7', headerColor: '#e8e6f0', textColor: '#1a1a2e' },
    'Rose': { borderColor: '#f43f5e', contentColor: '#1a0a10', headerColor: '#2a0a18', textColor: '#fecdd3' },
    'Emerald': { borderColor: '#10b981', contentColor: '#0a1a14', headerColor: '#0d2818', textColor: '#d1fae5' },
    'Amber': { borderColor: '#f59e0b', contentColor: '#140f00', headerColor: '#2a1f00', textColor: '#fef3c7' }
};

const DEFAULT_BASE_URLS = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta'
};

const API_PROVIDERS = [
    { id: 'openai', name: 'OpenAI-compatible', hint: 'OpenAI / OpenRouter / custom OpenAI API', logo: 'openai' },
    { id: 'anthropic', name: 'Anthropic', hint: 'Claude Messages API', logo: 'anthropic' },
    { id: 'google', name: 'Google (Gemini)', hint: 'Generative Language API', logo: 'google' }
];

const PROVIDER_ICON_MAP = {
    'openai': 'openai', 'anthropic': 'anthropic', 'google': 'google',
    'nvidia': 'nvidia', 'ollama-cloud': 'ollama', 'ollamacloud': 'ollama',
    'opencode-zen': 'openai', 'venice': 'venice', 'pollinations': 'pollinations',
    'publicai': 'openai', 'unturf': 'openai', 'g4f': 'openai',
    'deepseek-ai': 'deepseek', 'deepseek': 'deepseek',
    'meta': 'meta', 'moonshotai': 'moonshot', 'z-ai': 'zhipu',
    'mistralai': 'mistral', 'mistral': 'mistral',
    'aisingapore': 'ai-singapore', 'allenai': 'allennlp',
    'swiss-ai': 'swissai'
};

const NON_CHAT_TYPES = new Set(['embedding', 'rerank', 'audio', 'image', 'video', 'tts', 'stt', 'speech']);

let allModels = [];

function getApiProviderMeta(id) {
    return API_PROVIDERS.find(p => p.id === id) || API_PROVIDERS[0];
}

function escapeHTML(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatModelName(id) {
    return id
        .replace(/^[^/]+\//, '')
        .replace(/[_:]/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\b(\d+)\b/g, ' $1 ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
}

function getProviderIcon(ownedBy) {
    const key = (ownedBy || '').toLowerCase();
    for (const [pattern, icon] of Object.entries(PROVIDER_ICON_MAP)) {
        if (key === pattern || key.startsWith(pattern)) return icon;
    }
    return null;
}

function getModelFamilyIcon(modelId) {
    const id = (modelId || '').toLowerCase();
    const root = id.split('/').pop() || id;
    const families = [
        ['gpt', 'openai'], ['o1', 'openai'], ['o3', 'openai'], ['o4', 'openai'],
        ['claude', 'anthropic'], ['gemini', 'google'], ['gemma', 'google'],
        ['deepseek', 'deepseek'], ['llama', 'meta'], ['qwen', 'qwen'],
        ['mistral', 'mistral'], ['mixtral', 'mistral'], ['ministral', 'mistral'],
        ['kimi', 'moonshot'], ['moonshot', 'moonshot'], ['grok', 'xai'],
        ['command', 'cohere'], ['cohere', 'cohere'], ['minimax', 'minimax'],
        ['phi', 'microsoft'], ['nemo', 'nvidia']
    ];
    for (const [needle, icon] of families) {
        if (root.includes(needle)) return icon;
    }
    return getProviderIcon(id.split('/')[0]) || null;
}

function formatContextLength(ctx) {
    if (!ctx) return '';
    if (ctx >= 1000000) return (ctx / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (ctx >= 1000) return (ctx / 1000).toFixed(0) + 'K';
    return String(ctx);
}

function processModels(rawModels, format) {
    let models;
    if (format === 'google') {
        models = (rawModels.models || []).map(m => ({
            id: m.name?.replace('models/', '') || m.name,
            ownedBy: 'google',
            contextLength: m.inputTokenLimit || null,
            type: null
        }));
    } else {
        models = (rawModels.data || []).map(m => ({
            id: m.id,
            ownedBy: m.owned_by || '',
            root: m.root || m.id,
            contextLength: m.context_length || null,
            capabilities: m.capabilities || null,
            type: m.type || null
        }));
    }

    const seen = new Set();
    return models.filter(m => {
        if (!m.id) return false;
        if (m.type && NON_CHAT_TYPES.has(m.type)) return false;
        if (m.type === 'embedding' || m.type === 'rerank') return false;
        const key = m.id.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

const DEFAULT_SETTINGS = {
    apiFormat: 'openai',
    baseUrl: DEFAULT_BASE_URLS.openai,
    apiKey: '',
    model: 'gpt-4o',
    promptPrefix: 'Відповідай на тестові питання. Відповідь — ТІЛЬКИ валідний JSON об\'єкт, без markdown, без ```json, без зайвого тексту.\n\nФормат:\n{"answer": "правильна відповідь", "explanation": "коротке пояснення (1-3 речення)", "solution": "Дано: ... Розв\'язок: ...", "confidence": "0-100%"}\n\nПравила:\n- answer: точний текст правильного варіанту, якщо є варіанти відповідей\n- Для кількох правильних відповідей розділяй "; "\n- Відповідай мовою питання\n- solution пиши тільки для задач з розрахунками (фізика, хімія, математика)\n- confidence необов\'язкове\n- Виводь ТІЛЬКИ JSON об\'єкт, нічого більше',
    autoAnswer: false,
    autoAnswerCooldown: 2000,
    highlightCorrect: true,
    silentMode: false,
    customization: {
        glowEffect: false,
        ...PREDEFINED_THEMES['Indigo']
    }
};

let settings;
let uiElements = {};

async function loadSettings() {
    const data = await chrome.storage.local.get('xdAnswers_settings');
    let loaded = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (data.xdAnswers_settings) {
        try {
            const parsed = JSON.parse(data.xdAnswers_settings);
            loaded = {
                ...loaded,
                ...parsed,
                customization: { ...loaded.customization, ...(parsed.customization || {}) }
            };
            if (typeof loaded.promptPrefix !== 'string' || !loaded.promptPrefix.trim()) {
                loaded.promptPrefix = DEFAULT_SETTINGS.promptPrefix;
            }
            // Migration: fix old base URLs missing version prefix
            const oldDefaults = {
                openai: 'https://api.openai.com/v1',
                anthropic: 'https://api.anthropic.com',
                google: 'https://generativelanguage.googleapis.com'
            };
            if (loaded.apiFormat && oldDefaults[loaded.apiFormat] === loaded.baseUrl) {
                loaded.baseUrl = DEFAULT_BASE_URLS[loaded.apiFormat];
            }
        } catch (e) {
            console.error('Failed to parse settings', e);
        }
    }
    return loaded;
}

async function saveSettingsAndNotify(s) {
    await chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(s) });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'settingsUpdated' }, () => chrome.runtime.lastError && undefined);
        }
    });
}

function applyThemeToPopup() {
    const root = document.documentElement;
    const c = settings.customization;
    root.style.setProperty('--popup-bg', c.contentColor);
    root.style.setProperty('--header-bg', c.headerColor);
    root.style.setProperty('--popup-text', c.textColor);
    root.style.setProperty('--popup-border', c.borderColor);
}

function populateUI() {
    const el = uiElements;
    renderProviderDropdown();
    updateProviderTrigger();
    el.baseUrl.value = settings.baseUrl;
    el.apiKey.value = settings.apiKey;
    el.modelName.value = settings.model;
    el.promptPrefix.value = settings.promptPrefix;

    el.autoAnswerToggle.checked = settings.autoAnswer;
    el.autoAnswerCooldown.value = settings.autoAnswerCooldown;
    el.cooldownGroup.style.display = settings.autoAnswer ? 'block' : 'none';
    el.highlightCorrectToggle.checked = settings.highlightCorrect;
    el.silentModeToggle.checked = settings.silentMode;

    el.glowEffectToggle.checked = settings.customization.glowEffect;
    el.borderColor.value = settings.customization.borderColor;
    el.headerColor.value = settings.customization.headerColor;
    el.contentColor.value = settings.customization.contentColor;
    el.textColor.value = settings.customization.textColor;

    populateThemesGrid();
    applyThemeToPopup();
}

function renderProviderDropdown() {
    const dropdown = uiElements.apiFormatDropdown;
    if (!dropdown) return;
    dropdown.innerHTML = API_PROVIDERS.map(provider => {
        const active = provider.id === settings.apiFormat ? ' active' : '';
        return `<button type="button" class="provider-option${active}" data-provider-id="${provider.id}">
            <span class="provider-option-main">
                <img class="provider-icon large" src="https://models.dev/logos/${provider.logo}.svg" alt="" loading="lazy">
                <span class="provider-option-text">
                    <span class="provider-option-title">${escapeHTML(provider.name)}</span>
                    <span class="provider-option-hint">${escapeHTML(provider.hint)}</span>
                </span>
            </span>
        </button>`;
    }).join('');

    dropdown.querySelectorAll('.provider-option').forEach(button => {
        button.addEventListener('click', async () => {
            settings.apiFormat = button.dataset.providerId;
            const meta = getApiProviderMeta(settings.apiFormat);
            if (!uiElements.baseUrl.value || Object.values(DEFAULT_BASE_URLS).includes(uiElements.baseUrl.value)) {
                uiElements.baseUrl.value = DEFAULT_BASE_URLS[settings.apiFormat];
            }
            updateProviderTrigger();
            dropdown.classList.add('hidden');
            await autoSave({ apiFormat: settings.apiFormat, baseUrl: uiElements.baseUrl.value });
        });
    });
}

function updateProviderTrigger() {
    const trigger = uiElements.apiFormatTrigger;
    if (!trigger) return;
    const meta = getApiProviderMeta(settings.apiFormat);
    trigger.innerHTML = `<span class="provider-trigger-value">
        <img class="provider-icon large" src="https://models.dev/logos/${meta.logo}.svg" alt="" loading="lazy">
        <span class="provider-option-text">
            <span class="provider-option-title">${escapeHTML(meta.name)}</span>
            <span class="provider-option-hint">${escapeHTML(meta.hint)}</span>
        </span>
    </span><span class="provider-caret">▾</span>`;
}

function populateThemesGrid() {
    const grid = uiElements.themesGrid;
    if (!grid) return;
    grid.innerHTML = '';
    for (const name in PREDEFINED_THEMES) {
        const theme = PREDEFINED_THEMES[name];
        const card = document.createElement('div');
        card.className = 'theme-card';
        card.onclick = async () => {
            settings.customization = { ...settings.customization, ...theme };
            populateUI();
            await saveSettingsAndNotify(settings);
        };
        card.innerHTML = `<div class="theme-name">${name}</div><div class="theme-preview">
            <div class="theme-color-chip" style="background:${theme.borderColor}"></div>
            <div class="theme-color-chip" style="background:${theme.contentColor}"></div>
            <div class="theme-color-chip" style="background:${theme.headerColor}"></div>
            <div class="theme-color-chip" style="background:${theme.textColor}"></div></div>`;
        grid.appendChild(card);
    }
}

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'fetch', payload: options }, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (response?.success) resolve(response);
            else reject(new Error(response?.error || 'Fetch failed'));
        });
    });
}

async function fetchModels() {
    const btn = uiElements.fetchModelsBtn;
    if (!btn) return;
    btn.classList.add('spinning');
    try {
        const format = settings.apiFormat;
        const base = settings.baseUrl.replace(/\/+$/, '');
        const key = settings.apiKey;
        let url, headers = {};

        if (format === 'openai') {
            url = `${base}/models`;
            if (key) headers['Authorization'] = `Bearer ${key}`;
        } else if (format === 'anthropic') {
            url = `${base}/models`;
            if (key) {
                headers['x-api-key'] = key;
                headers['anthropic-version'] = '2023-06-01';
            }
        } else if (format === 'google') {
            url = `${base}/models${key ? '?key=' + key : ''}`;
        }

        const fullText = await new Promise((resolve, reject) => {
            const port = chrome.runtime.connect({ name: 'xdAnswers-stream' });
            let data = '';
            port.onMessage.addListener((msg) => {
                if (msg.type === 'chunk') data += msg.data;
                else if (msg.type === 'done') { resolve(data); port.disconnect(); }
                else if (msg.type === 'error') { reject(new Error(msg.error + (msg.details ? ': ' + msg.details : ''))); port.disconnect(); }
            });
            port.onDisconnect.addListener(() => {
                if (data) resolve(data);
                else reject(new Error('Port disconnected'));
            });
            port.postMessage({ type: 'fetch_stream', payload: { url, method: 'GET', headers } });
        });

        const parsed = JSON.parse(fullText);
        allModels = processModels(parsed, format);
        document.getElementById('model-name').value = '';
        renderModelDropdown();
    } catch (e) {
        console.error('Failed to fetch models:', e);
    } finally {
        btn.classList.remove('spinning');
    }
}

function renderModelDropdown() {
    const dropdown = document.getElementById('model-dropdown');
    const input = document.getElementById('model-name');
    if (!dropdown || !input) return;

    const query = input.value.toLowerCase().trim();
    let filtered = allModels;
    if (query) {
        filtered = allModels.filter(m =>
            m.id.toLowerCase().includes(query) ||
            formatModelName(m.id).toLowerCase().includes(query) ||
            (m.ownedBy || '').toLowerCase().includes(query)
        );
    }

    const groups = {};
    for (const m of filtered) {
        const provider = m.ownedBy || 'other';
        if (!groups[provider]) groups[provider] = [];
        groups[provider].push(m);
    }

    const sortedProviders = Object.keys(groups).sort();
    const MAX_VISIBLE = 50;
    let count = 0;
    let html = '';

    for (const provider of sortedProviders) {
        if (count >= MAX_VISIBLE) break;
        const icon = getProviderIcon(provider);
        const iconHtml = icon
            ? `<img class="provider-icon" src="https://models.dev/logos/${icon}.svg" alt="" loading="lazy">`
            : `<span class="provider-icon-fallback">${(provider[0] || '?').toUpperCase()}</span>`;
        html += `<div class="model-provider-group">
            <div class="model-provider-header">${iconHtml}<span>${provider}</span>
            <span class="model-provider-count">${groups[provider].length}</span></div>`;

        for (const m of groups[provider]) {
            if (count >= MAX_VISIBLE) break;
            const ctxHtml = m.contextLength ? `<span class="model-ctx">${formatContextLength(m.contextLength)}</span>` : '';
            const familyIcon = getModelFamilyIcon(m.id);
            const modelIcon = familyIcon
                ? `<img class="model-icon" src="https://models.dev/logos/${familyIcon}.svg" alt="" loading="lazy">`
                : `<span class="provider-icon-fallback">${(formatModelName(m.root || m.id)[0] || '?').toUpperCase()}</span>`;
            const providerLabel = escapeHTML(m.ownedBy || 'other');
            const visionBadge = m.capabilities?.vision ? '<span class="model-ctx">vision</span>' : '';
            html += `<div class="model-item" data-model-id="${m.id}">
                <span class="model-item-main">${modelIcon}<span class="model-item-subtext"><span class="model-item-name">${escapeHTML(formatModelName(m.root || m.id))}</span><span class="model-item-provider">${providerLabel}</span></span></span>${visionBadge}${ctxHtml}
            </div>`;
            count++;
        }
        html += '</div>';
    }

    if (filtered.length > MAX_VISIBLE) {
        html += `<div class="model-more">+${filtered.length - MAX_VISIBLE} more — type to filter</div>`;
    }
    if (filtered.length === 0) {
        html = '<div class="model-empty">No models found</div>';
    }

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');

    dropdown.querySelectorAll('.model-item').forEach(el => {
        el.addEventListener('click', async () => {
            input.value = el.dataset.modelId;
            dropdown.classList.add('hidden');
            await autoSave({ model: el.dataset.modelId });
        });
    });
}

function setupColorInput(input, settingKey, cssVar) {
    input.addEventListener('input', async (e) => {
        const val = e.target.value;
        if (/^#([0-9a-f]{3}){1,2}$/i.test(val)) {
            document.documentElement.style.setProperty(cssVar, val);
            settings.customization[settingKey] = val;
            await saveSettingsAndNotify(settings);
        }
    });
}

function attachEventListeners() {
    const el = uiElements;

    document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.tab-button, .tab-content').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        document.getElementById(b.dataset.tab).classList.add('active');
    }));

    el.apiFormatTrigger.onclick = () => {
        el.apiFormatDropdown.classList.toggle('hidden');
    };

    el.fetchModelsBtn.onclick = async () => {
        await autoSave();
        await fetchModels();
    };

    const autoInputs = [
        { el: el.baseUrl, key: 'baseUrl' },
        { el: el.apiKey, key: 'apiKey' },
        { el: el.modelName, key: 'model' },
        { el: el.promptPrefix, key: 'promptPrefix' },
        { el: el.autoAnswerCooldown, key: 'autoAnswerCooldown', parse: v => parseInt(v, 10) || 2000 }
    ];
    for (const { el: inp, key, parse } of autoInputs) {
        inp.addEventListener('change', () => autoSave({ [key]: parse ? parse(inp.value) : inp.value }));
    }
    el.modelName.addEventListener('input', () => {
        clearTimeout(autoSave._modelTimer);
        autoSave._modelTimer = setTimeout(() => autoSave({ model: el.modelName.value.trim() }), 300);
    });
    el.promptPrefix.addEventListener('input', () => {
        clearTimeout(autoSave._timer);
        autoSave._timer = setTimeout(() => autoSave({ promptPrefix: el.promptPrefix.value }), 600);
    });

    const autoToggles = [
        { el: el.autoAnswerToggle, key: 'autoAnswer' },
        { el: el.highlightCorrectToggle, key: 'highlightCorrect' },
        { el: el.silentModeToggle, key: 'silentMode' },
        { el: el.glowEffectToggle, key: 'customization.glowEffect' }
    ];
    for (const { el: toggle, key } of autoToggles) {
        toggle.onchange = () => {
            el.cooldownGroup.style.display = el.autoAnswerToggle.checked ? 'block' : 'none';
            autoSave({ [key]: toggle.checked });
        };
    }

    el.modelName.onfocus = () => {
        if (allModels.length) renderModelDropdown();
    };
    el.modelName.oninput = () => {
        if (allModels.length) renderModelDropdown();
    };

    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('model-dropdown');
        const wrapper = document.querySelector('.model-select-wrapper');
        if (dropdown && !wrapper?.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
        if (uiElements.apiFormatDropdown && !document.querySelector('.provider-select-wrapper')?.contains(e.target)) {
            uiElements.apiFormatDropdown.classList.add('hidden');
        }
    });

    setupColorInput(el.borderColor, 'borderColor', '--popup-border');
    setupColorInput(el.headerColor, 'headerColor', '--header-bg');
    setupColorInput(el.contentColor, 'contentColor', '--popup-bg');
    setupColorInput(el.textColor, 'textColor', '--popup-text');
}

async function autoSave(overrides) {
    const el = uiElements;
    settings.apiFormat = settings.apiFormat || 'openai';
    settings.baseUrl = el.baseUrl.value;
    settings.apiKey = el.apiKey.value;
    settings.model = el.modelName.value;
    settings.promptPrefix = el.promptPrefix.value;
    settings.autoAnswer = el.autoAnswerToggle.checked;
    settings.autoAnswerCooldown = parseInt(el.autoAnswerCooldown.value, 10) || 2000;
    settings.highlightCorrect = el.highlightCorrectToggle.checked;
    settings.silentMode = el.silentModeToggle.checked;
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

document.addEventListener('DOMContentLoaded', async () => {
    uiElements = {
        apiFormatTrigger: document.getElementById('api-format-trigger'),
        apiFormatDropdown: document.getElementById('api-format-dropdown'),
        baseUrl: document.getElementById('base-url'),
        apiKey: document.getElementById('api-key'),
        modelName: document.getElementById('model-name'),
        promptPrefix: document.getElementById('prompt-prefix'),
        fetchModelsBtn: document.getElementById('fetch-models-btn'),
        autoAnswerToggle: document.getElementById('auto-answer-toggle'),
        autoAnswerCooldown: document.getElementById('auto-answer-cooldown'),
        cooldownGroup: document.getElementById('cooldown-group'),
        highlightCorrectToggle: document.getElementById('highlight-correct-toggle'),
        silentModeToggle: document.getElementById('silent-mode-toggle'),
        themesGrid: document.getElementById('themes-grid'),
        glowEffectToggle: document.getElementById('glow-effect-toggle'),
        borderColor: document.getElementById('border-color-input'),
        headerColor: document.getElementById('header-color-input'),
        contentColor: document.getElementById('content-color-input'),
        textColor: document.getElementById('text-color-input')
    };

    settings = await loadSettings();
    populateUI();
    attachEventListeners();
});
