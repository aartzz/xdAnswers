// popup.js

const PREDEFINED_THEMES = {
    'Default': { borderColor: '#00ffff', contentColor: '#0a0a14', headerColor: '#001f3f', textColor: '#00ff9d' },
    'AMOLED': { borderColor: '#ffffff', contentColor: '#000000', headerColor: '#111111', textColor: '#ffffff' },
    'Black': { borderColor: '#cccccc', contentColor: '#1c1c1c', headerColor: '#333333', textColor: '#e0e0e0' },
    'White': { borderColor: '#888888', contentColor: '#f5f5f5', headerColor: '#e0e0e0', textColor: '#111111' },
    'Vampire': { borderColor: '#ff0055', contentColor: '#1a1a1a', headerColor: '#2a0000', textColor: '#ffcdd2' },
    'Ectoplasm': { borderColor: '#9eff00', contentColor: '#0d1a00', headerColor: '#1a3300', textColor: '#d4ff99' },
    'Solaris': { borderColor: '#ff9900', contentColor: '#140f00', headerColor: '#3d2e00', textColor: '#ffff99' }
};

const DEFAULT_SETTINGS = {
    activeService: 'MistralAI',
    Ollama: { host: '', model: '' },
    OpenAI: { apiKey: '', model: 'gpt-4o' },
    Gemini: { apiKey: '', model: 'gemini-2.0-flash' },
    MistralAI: { apiKey: '0RBrYMEMvvazK5iZ9sckIdLSoBnv7Yuj', model: 'pixtral-large-2411' },
    promptPrefix: 'I am providing a question with answer choices. Answer this question directly, without explanation.',
    customization: {
        glowEffect: true,
        ...PREDEFINED_THEMES['Default']
    }
};

let settings;
let availableModels = [];
let uiElements = {};

async function loadSettings() {
    const data = await chrome.storage.local.get('xdAnswers_settings');
    let loadedSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (data.xdAnswers_settings) {
        try {
            const parsed = JSON.parse(data.xdAnswers_settings);
            loadedSettings = {
                ...loadedSettings, ...parsed,
                Ollama: { ...loadedSettings.Ollama, ...(parsed.Ollama || {}) },
                OpenAI: { ...loadedSettings.OpenAI, ...(parsed.OpenAI || {}) },
                Gemini: { ...loadedSettings.Gemini, ...(parsed.Gemini || {}) },
                MistralAI: { ...loadedSettings.MistralAI, ...(parsed.MistralAI || {}) },
                customization: { ...loadedSettings.customization, ...(parsed.customization || {}) }
            };
            if (typeof loadedSettings.promptPrefix !== 'string' || loadedSettings.promptPrefix.trim() === '') {
                loadedSettings.promptPrefix = DEFAULT_SETTINGS.promptPrefix;
            }
        } catch (e) { 
            console.error("Popup: Failed to parse settings.", e); 
            loadedSettings.promptPrefix = DEFAULT_SETTINGS.promptPrefix;
        }
    } else {
         loadedSettings.promptPrefix = DEFAULT_SETTINGS.promptPrefix;
    }
    return loadedSettings;
}

async function saveSettingsAndNotify(s) {
    await chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(s) });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "settingsUpdated" }, () => chrome.runtime.lastError && undefined);
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
    const { activeService, Ollama, customization } = settings;
    const { serviceType, ollamaHost, apiKey, apiModel, promptPrefix, glowEffectToggle, borderColor, headerColor, contentColor, textColor } = uiElements;

    serviceType.value = activeService;
    ollamaHost.value = Ollama.host;
    promptPrefix.value = settings.promptPrefix;
    
    glowEffectToggle.checked = customization.glowEffect;
    borderColor.value = customization.borderColor;
    headerColor.value = customization.headerColor;
    contentColor.value = customization.contentColor;
    textColor.value = customization.textColor;
    
    populateThemesGrid();
    updateModelDropdown();
    toggleSettingsVisibility();
    applyThemeToPopup();
}

function populateThemesGrid() {
    if (!uiElements.themesGrid) return;
    uiElements.themesGrid.innerHTML = '';
    for (const themeName in PREDEFINED_THEMES) {
        const theme = PREDEFINED_THEMES[themeName];
        const card = document.createElement('div');
        card.className = 'theme-card';
        card.onclick = async () => {
            settings.customization = { ...settings.customization, ...theme };
            populateUI();
            await saveSettingsAndNotify(settings);
        };
        card.innerHTML = `<div class="theme-name">${themeName}</div><div class="theme-preview">
            <div class="theme-color-chip" style="background-color: ${theme.borderColor};"></div>
            <div class="theme-color-chip" style="background-color: ${theme.contentColor};"></div>
            <div class="theme-color-chip" style="background-color: ${theme.headerColor};"></div>
            <div class="theme-color-chip" style="background-color: ${theme.textColor};"></div></div>`;
        uiElements.themesGrid.appendChild(card);
    }
}

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'fetch', payload: options }, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (response && response.success) resolve(response);
            else reject(new Error(response.error || 'Unknown error during fetch'));
        });
    });
}

function updateModelDropdown() {
    if (!uiElements.ollamaModel) return;
    uiElements.ollamaModel.innerHTML = '';
    availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name; option.textContent = model.name;
        if (settings.Ollama && model.name === settings.Ollama.model) option.selected = true;
        uiElements.ollamaModel.appendChild(option);
    });
    if (availableModels.length === 0 && settings.Ollama.model) {
        const option = document.createElement('option');
        option.value = settings.Ollama.model; option.textContent = settings.Ollama.model; option.selected = true;
        uiElements.ollamaModel.appendChild(option);
    }
}

async function fetchModels() {
    if (settings.Ollama && settings.Ollama.host && uiElements.refreshModels) {
        uiElements.refreshModels.classList.add('spinning');
        try {
            const response = await makeRequest({ method: 'GET', url: `${settings.Ollama.host}/api/tags` });
            if (response.data) {
                availableModels = JSON.parse(response.data).models;
                updateModelDropdown();
            }
        } catch (error) { console.error("Fetch Ollama models network error: ", error); }
        finally { uiElements.refreshModels.classList.remove('spinning'); }
    }
}

function toggleSettingsVisibility() {
    const { serviceType, ollamaSettings, apiSettings, apiKey, apiModel } = uiElements;
    const selected = serviceType.value;
    ollamaSettings.style.display = selected === 'Ollama' ? 'block' : 'none';
    apiSettings.style.display = selected !== 'Ollama' ? 'block' : 'none';
    if (selected !== 'Ollama' && settings[selected]) {
        apiKey.value = settings[selected].apiKey;
        apiModel.value = settings[selected].model;
    }
}

function setupColorInput(input, settingKey, cssVar) {
    input.addEventListener('input', async (e) => {
        const newColor = e.target.value;
        if (/^#([0-9A-F]{3}){1,2}$/i.test(newColor)) {
            document.documentElement.style.setProperty(cssVar, newColor);
            settings.customization[settingKey] = newColor;
            await saveSettingsAndNotify(settings);
        }
    });
}

function attachEventListeners() {
    const { serviceType, refreshModels, glowEffectToggle, borderColor, headerColor, contentColor, textColor, saveSettingsBtn } = uiElements;

    document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.tab-button, .tab-content').forEach(el => el.classList.remove('active'));
        b.classList.add('active');
        document.getElementById(b.dataset.tab).classList.add('active');
    }));
    
    serviceType.onchange = toggleSettingsVisibility;
    if (refreshModels) {
      refreshModels.onclick = async () => {
          settings.Ollama.host = uiElements.ollamaHost.value;
          await fetchModels();
      };
    }
    
    glowEffectToggle.onchange = async (e) => { settings.customization.glowEffect = e.target.checked; await saveSettingsAndNotify(settings); };
    setupColorInput(borderColor, 'borderColor', '--popup-border');
    setupColorInput(headerColor, 'headerColor', '--header-bg');
    setupColorInput(contentColor, 'contentColor', '--popup-bg');
    setupColorInput(textColor, 'textColor', '--popup-text');

    saveSettingsBtn.onclick = async () => {
        settings.activeService = uiElements.serviceType.value;
        settings.promptPrefix = uiElements.promptPrefix.value;
        if (settings.activeService === 'Ollama') {
            settings.Ollama.host = uiElements.ollamaHost.value;
            settings.Ollama.model = uiElements.ollamaModel.value;
        } else {
            const s = settings.activeService;
            if (!settings[s]) settings[s] = {apiKey:'', model:''}; // Забезпечуємо існування об'єкта
            settings[s].apiKey = uiElements.apiKey.value;
            settings[s].model = uiElements.apiModel.value;
        }
        await saveSettingsAndNotify(settings);
        window.close();
    };

    document.getElementById('service-type-info-icon-btn').onclick = () => {
        alert("💬-Text 🖼️-Image 💰-Paid/Limits 🏠-Own Server 🆓-Free");
    };
    document.getElementById('prompt-prefix-info-icon-btn').onclick = () => {
        alert("This is an instruction for the AI that is added at the beginning of each request. It helps the AI better understand what kind of response you expect.");
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    uiElements = {
        serviceType: document.getElementById('service-type'),
        ollamaSettings: document.getElementById('ollama-settings'),
        apiSettings: document.getElementById('api-settings'),
        ollamaHost: document.getElementById('ollama-host'),
        ollamaModel: document.getElementById('ollama-model'),
        apiKey: document.getElementById('api-key'),
        apiModel: document.getElementById('api-model'),
        promptPrefix: document.getElementById('prompt-prefix'),
        refreshModels: document.getElementById('refresh-models-icon'),
        themesGrid: document.getElementById('themes-grid'),
        glowEffectToggle: document.getElementById('glow-effect-toggle'),
        borderColor: document.getElementById('border-color-input'),
        headerColor: document.getElementById('header-color-input'),
        contentColor: document.getElementById('content-color-input'),
        textColor: document.getElementById('text-color-input'),
        saveSettingsBtn: document.getElementById('save-settings-btn')
    };

    settings = await loadSettings();
    populateUI(); 
    attachEventListeners();

    if (settings.activeService === 'Ollama') {
        await fetchModels();
    }
});