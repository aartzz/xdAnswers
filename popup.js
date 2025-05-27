// popup.js

// --- КОНФІГУРАЦІЯ ---
const PREDEFINED_THEMES = {
    'За замовчуванням': {
        borderColor: '#00ffff',
        contentColor: '#0a0a14',
        headerColor: '#001f3f',
        textColor: '#00ff9d'
    },
    'AMOLED': {
        borderColor: '#ffffff',
        contentColor: '#000000',
        headerColor: '#111111',
        textColor: '#ffffff'
    },
    'Чорний': {
        borderColor: '#cccccc',
        contentColor: '#1c1c1c',
        headerColor: '#333333',
        textColor: '#e0e0e0'
    },
    'Білий': {
        borderColor: '#888888',
        contentColor: '#f5f5f5',
        headerColor: '#e0e0e0',
        textColor: '#111111'
    },
    'Вампір': {
        borderColor: '#ff0055',
        contentColor: '#1a1a1a',
        headerColor: '#2a0000',
        textColor: '#ffcdd2'
    },
    'Ектоплазма': {
        borderColor: '#9eff00',
        contentColor: '#0d1a00',
        headerColor: '#1a3300',
        textColor: '#d4ff99'
    },
    'Соляріс': {
        borderColor: '#ff9900',
        contentColor: '#140f00',
        headerColor: '#3d2e00',
        textColor: '#ffff99'
    }
};

const DEFAULT_SETTINGS = {
    activeService: 'MistralAI',
    Ollama: { host: '', model: '' },
    OpenAI: { apiKey: '', model: 'gpt-4o' },
    Gemini: { apiKey: '', model: 'gemini-2.0-flash' },
    MistralAI: { apiKey: '0RBrYMEMvvazK5iZ9sckIdLSoBnv7Yuj', model: 'pixtral-large-2411' },
    promptPrefix: 'Я даю питання з варіантами відповіді. Дай відповідь на це питання, прямо, без пояснень.',
    customization: {
        glowEffect: true,
        ...PREDEFINED_THEMES['За замовчуванням']
    }
};

// --- ЗМІННІ ДЛЯ UI ЕЛЕМЕНТІВ ---
let serviceTypeSelect, ollamaSettingsDiv, apiSettingsDiv, ollamaModelSelect,
    apiKeyInput, apiModelInput, promptPrefixTextarea, saveSettingsBtn, refreshModelsIcon,
    glowEffectToggle, headerColorInput, contentColorInput, textColorInput, borderColorInput;

let settings;
let availableModels = [];

// --- ОСНОВНІ ФУНКЦІЇ ---

async function loadSettings() {
    const data = await chrome.storage.local.get('xdAnswers_settings');
    let loadedSettings = { ...DEFAULT_SETTINGS };
    if (data.xdAnswers_settings) {
        try {
            const parsedSettings = JSON.parse(data.xdAnswers_settings);
            loadedSettings = {
                ...DEFAULT_SETTINGS,
                ...parsedSettings,
                Ollama: { ...DEFAULT_SETTINGS.Ollama, ...(parsedSettings.Ollama || {}) },
                OpenAI: { ...DEFAULT_SETTINGS.OpenAI, ...(parsedSettings.OpenAI || {}) },
                Gemini: { ...DEFAULT_SETTINGS.Gemini, ...(parsedSettings.Gemini || {}) },
                MistralAI: { ...DEFAULT_SETTINGS.MistralAI, ...(parsedSettings.MistralAI || {}) },
                customization: {
                    ...DEFAULT_SETTINGS.customization,
                    ...(parsedSettings.customization || {})
                }
            };
        } catch (e) {
            console.error("Failed to parse settings, using defaults.", e);
        }
    }
    return loadedSettings;
}

async function saveSettingsAndNotify(settingsToSave) {
    await chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(settingsToSave) });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "settingsUpdated" }, () => {
                if (chrome.runtime.lastError) {} // Ignore
            });
        }
    });
}

function applyTheme() {
    const root = document.documentElement;
    const custom = settings.customization;
    root.style.setProperty('--popup-bg', custom.contentColor);
    root.style.setProperty('--header-bg', custom.headerColor);
    root.style.setProperty('--popup-text', custom.textColor);
    root.style.setProperty('--popup-border', custom.borderColor);
}

function populateUI() {
    // AI Tab
    serviceTypeSelect.value = settings.activeService;
    promptPrefixTextarea.value = settings.promptPrefix;
    document.getElementById('ollama-host').value = settings.Ollama.host;
    
    // Style Tab
    glowEffectToggle.checked = settings.customization.glowEffect;
    borderColorInput.value = settings.customization.borderColor;
    headerColorInput.value = settings.customization.headerColor;
    contentColorInput.value = settings.customization.contentColor;
    textColorInput.value = settings.customization.textColor;
    
    // Themes Tab
    populateThemesGrid();

    // Застосувати всі налаштування вигляду
    updateModelDropdown();
    toggleSettingsVisibility();
    applyTheme();
}

function populateThemesGrid() {
    const grid = document.getElementById('themes-grid');
    grid.innerHTML = '';
    for (const themeName in PREDEFINED_THEMES) {
        const theme = PREDEFINED_THEMES[themeName];
        const card = document.createElement('div');
        card.className = 'theme-card';
        card.onclick = async () => {
            settings.customization = { ...settings.customization, ...theme };
            populateUI();
            await saveSettingsAndNotify(settings);
        };
        card.innerHTML = `
            <div class="theme-name">${themeName}</div>
            <div class="theme-preview">
                <div class="theme-color-chip" style="background-color: ${theme.borderColor};"></div>
                <div class="theme-color-chip" style="background-color: ${theme.contentColor};"></div>
                <div class="theme-color-chip" style="background-color: ${theme.headerColor};"></div>
                <div class="theme-color-chip" style="background-color: ${theme.textColor};"></div>
            </div>
        `;
        grid.appendChild(card);
    }
}

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'fetch', payload: options }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
                resolve(response);
            } else {
                reject(new Error(response.error || 'Unknown error during fetch'));
            }
        });
    });
}

function updateModelDropdown() {
    if (!ollamaModelSelect) return;
    ollamaModelSelect.innerHTML = '';
    availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        if (settings.Ollama && model.name === settings.Ollama.model) option.selected = true;
        ollamaModelSelect.appendChild(option);
    });
    if (availableModels.length === 0 && settings.Ollama.model) {
        const option = document.createElement('option');
        option.value = settings.Ollama.model;
        option.textContent = settings.Ollama.model;
        option.selected = true;
        ollamaModelSelect.appendChild(option);
    }
}

async function fetchModels() {
    if (settings.Ollama && settings.Ollama.host) {
        refreshModelsIcon.classList.add('spinning');
        try {
            const response = await makeRequest({
                method: 'GET',
                url: `${settings.Ollama.host}/api/tags`
            });
            if (response.data) {
                availableModels = JSON.parse(response.data).models;
                updateModelDropdown();
            }
        } catch (error) {
            console.error("Fetch Ollama models network error: ", error);
        } finally {
            refreshModelsIcon.classList.remove('spinning');
        }
    }
}

// --- ОСНОВНЕ ВИПРАВЛЕННЯ ТУТ ---
function toggleSettingsVisibility() {
    const selectedService = serviceTypeSelect.value;
    
    if (selectedService === 'Ollama') {
        ollamaSettingsDiv.style.display = 'block';
        apiSettingsDiv.style.display = 'none';
    } else {
        ollamaSettingsDiv.style.display = 'none';
        apiSettingsDiv.style.display = 'block';
        
        // Оновлюємо поля відповідно до обраного сервісу
        const serviceSettings = settings[selectedService];
        apiKeyInput.value = serviceSettings.apiKey;
        apiModelInput.value = serviceSettings.model;
    }
}
// ---------------------------------

function setupColorInput(inputElement, settingKey, cssVariable) {
    inputElement.addEventListener('input', async (e) => {
        const newColor = e.target.value;
        if (/^#([0-9A-F]{3}){1,2}$/i.test(newColor)) {
            document.documentElement.style.setProperty(cssVariable, newColor);
            settings.customization[settingKey] = newColor;
            await saveSettingsAndNotify(settings);
        }
    });
}

function attachEventListeners() {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
        });
    });

    // AI Tab Logic
    serviceTypeSelect.onchange = toggleSettingsVisibility; // Цей виклик тепер працює правильно
    refreshModelsIcon.onclick = async () => {
        settings.Ollama.host = document.getElementById('ollama-host').value;
        await fetchModels();
    };

    // Style Tab Logic
    glowEffectToggle.addEventListener('change', async (e) => {
        settings.customization.glowEffect = e.target.checked;
        await saveSettingsAndNotify(settings);
    });
    setupColorInput(borderColorInput, 'borderColor', '--popup-border');
    setupColorInput(headerColorInput, 'headerColor', '--header-bg');
    setupColorInput(contentColorInput, 'contentColor', '--popup-bg');
    setupColorInput(textColorInput, 'textColor', '--popup-text');

    // Main Save Button
    saveSettingsBtn.onclick = async () => {
        settings.activeService = serviceTypeSelect.value;
        settings.promptPrefix = promptPrefixTextarea.value;
        if (settings.activeService === 'Ollama') {
            settings.Ollama.host = document.getElementById('ollama-host').value;
            settings.Ollama.model = ollamaModelSelect.value;
        } else {
            const currentService = settings.activeService;
            if (!settings[currentService]) settings[currentService] = {};
            settings[currentService].apiKey = apiKeyInput.value;
            settings[currentService].model = apiModelInput.value;
        }
        await saveSettingsAndNotify(settings);
        window.close();
    };
}

// --- ІНІЦІАЛІЗАЦІЯ ---
document.addEventListener('DOMContentLoaded', async () => {
    // AI
    serviceTypeSelect = document.getElementById('service-type');
    ollamaSettingsDiv = document.getElementById('ollama-settings');
    apiSettingsDiv = document.getElementById('api-settings');
    ollamaModelSelect = document.getElementById('ollama-model');
    apiKeyInput = document.getElementById('api-key');
    apiModelInput = document.getElementById('api-model');
    promptPrefixTextarea = document.getElementById('prompt-prefix');
    refreshModelsIcon = document.getElementById('refresh-models-icon');
    
    // Style
    glowEffectToggle = document.getElementById('glow-effect-toggle');
    borderColorInput = document.getElementById('border-color-input');
    headerColorInput = document.getElementById('header-color-input');
    contentColorInput = document.getElementById('content-color-input');
    textColorInput = document.getElementById('text-color-input');
    
    // General
    saveSettingsBtn = document.getElementById('save-settings-btn');

    settings = await loadSettings();
    populateUI();
    attachEventListeners();

    if (settings.activeService === 'Ollama') {
        await fetchModels();
    }
});