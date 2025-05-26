// popup.js

// --- КОНФІГУРАЦІЯ (дублюється з content.js для узгодженості) ---
const DEFAULT_SETTINGS = {
    activeService: 'MistralAI',
    Ollama: { host: '', model: '' },
    OpenAI: { apiKey: '', model: 'gpt-4o' },
    Gemini: { apiKey: '', model: 'gemini-2.0-flash' },
    MistralAI: { apiKey: '0RBrYMEMvvazK5iZ9sckIdLSoBnv7Yuj', model: 'pixtral-large-2411' },
    promptPrefix: 'Я даю питання з варіантами відповіді. Дай відповідь на це питання, прямо, без пояснень.'
};

// --- ЗМІННІ ДЛЯ UI ЕЛЕМЕНТІВ POPUP ---
let serviceTypeSelect, ollamaSettingsDiv, apiSettingsDiv, ollamaModelSelect,
    apiKeyInput, apiModelInput, promptPrefixTextarea, saveSettingsBtn, refreshModelsIcon;

let settings;
let availableModels = [];

// --- ОСНОВНІ ФУНКЦІЇ POPUP ---

/**
 * Надсилає запит через фоновий скрипт (background.js).
 */
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

/**
 * Асинхронно завантажує налаштування зі сховища розширення.
 */
async function loadSettings() {
    const data = await chrome.storage.local.get('xdAnswers_settings');
    let loadedSettings = DEFAULT_SETTINGS;
    if (data.xdAnswers_settings) {
        try {
            loadedSettings = JSON.parse(data.xdAnswers_settings);
        } catch (e) {
            console.error("Failed to parse settings, using defaults.", e);
        }
    }

    for (const serviceKey in DEFAULT_SETTINGS) {
        if (!['activeService', 'promptPrefix'].includes(serviceKey)) {
            if (!loadedSettings[serviceKey]) {
                loadedSettings[serviceKey] = { ...DEFAULT_SETTINGS[serviceKey] };
            } else {
                loadedSettings[serviceKey] = { ...DEFAULT_SETTINGS[serviceKey], ...loadedSettings[serviceKey] };
            }
        }
    }
    return loadedSettings;
}

/**
 * Зберігає налаштування у сховище розширення.
 */
async function saveSettings(settingsToSave) {
    await chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(settingsToSave) });
}

function toggleSettingsVisibility() {
    const selectedService = serviceTypeSelect.value;
    const currentServiceSettings = settings[selectedService] || DEFAULT_SETTINGS[selectedService] || { apiKey: '', model: '' };

    if (selectedService === 'Ollama') {
        ollamaSettingsDiv.style.display = 'block';
        apiSettingsDiv.style.display = 'none';
        document.getElementById('ollama-host').value = settings.Ollama.host;
    } else {
        ollamaSettingsDiv.style.display = 'none';
        apiSettingsDiv.style.display = 'block';
        apiKeyInput.value = currentServiceSettings.apiKey;
        apiModelInput.value = currentServiceSettings.model;
    }
}

function populateSettings() {
    serviceTypeSelect.value = settings.activeService;
    promptPrefixTextarea.value = settings.promptPrefix;

    document.getElementById('ollama-host').value = settings.Ollama.host || DEFAULT_SETTINGS.Ollama.host;
    const currentActiveServiceSettings = settings[settings.activeService] || DEFAULT_SETTINGS[settings.activeService];
    if (settings.activeService !== 'Ollama' && currentActiveServiceSettings) {
        apiKeyInput.value = currentActiveServiceSettings.apiKey;
        apiModelInput.value = currentActiveServiceSettings.model;
    }
    updateModelDropdown();
    toggleSettingsVisibility();
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

function attachEventListeners() {
    serviceTypeSelect.onchange = toggleSettingsVisibility;

    refreshModelsIcon.onclick = async () => {
        settings.Ollama.host = document.getElementById('ollama-host').value;
        await fetchModels();
    };

    saveSettingsBtn.onclick = async () => {
        settings.activeService = serviceTypeSelect.value;
        settings.promptPrefix = promptPrefixTextarea.value;
        if (settings.activeService === 'Ollama') {
            settings.Ollama.host = document.getElementById('ollama-host').value;
            settings.Ollama.model = ollamaModelSelect.value;
        } else {
            if (!settings[settings.activeService]) {
                settings[settings.activeService] = { apiKey: '', model: '' };
            }
            settings[settings.activeService].apiKey = apiKeyInput.value;
            settings[settings.activeService].model = apiModelInput.value;
        }

        await saveSettings(settings);

        // Повідомляємо активну вкладку, що налаштування оновилися
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { type: "settingsUpdated" }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Помилка може виникнути, якщо content script не запущено на сторінці (напр. нова вкладка)
                        // Це нормально, просто ігноруємо.
                    }
                });
            }
        });

        // Закриваємо popup
        window.close();
    };

    // Додамо довідкові повідомлення (можна розширити)
    document.getElementById('service-type-info-icon-btn').onclick = () => alert("💬-Текст 🖼️-Зображення 💰-Платний/Ліміти 🏠-Свій сервер 🆓-Безкоштовний");
    document.getElementById('prompt-prefix-info-icon-btn').onclick = () => alert("Це інструкція для ШІ, яка додається на початку кожного запиту. Вона допомагає ШІ краще зрозуміти, яку відповідь ви очікуєте.");
}


// --- ІНІЦІАЛІЗАЦІЯ POPUP ---
document.addEventListener('DOMContentLoaded', async () => {
    // Прив'язуємо змінні до елементів
    serviceTypeSelect = document.getElementById('service-type');
    ollamaSettingsDiv = document.getElementById('ollama-settings');
    apiSettingsDiv = document.getElementById('api-settings');
    ollamaModelSelect = document.getElementById('ollama-model');
    apiKeyInput = document.getElementById('api-key');
    apiModelInput = document.getElementById('api-model');
    promptPrefixTextarea = document.getElementById('prompt-prefix');
    saveSettingsBtn = document.getElementById('save-settings-btn');
    refreshModelsIcon = document.getElementById('refresh-models-icon');

    // Завантажуємо налаштування, заповнюємо поля і встановлюємо обробники
    settings = await loadSettings();
    populateSettings();
    attachEventListeners();
    
    // Якщо активний Ollama, пробуємо завантажити моделі
    if (settings.activeService === 'Ollama') {
        await fetchModels();
    }
});