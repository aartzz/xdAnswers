// ==UserScript==
// @name         xdAnswers
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  A script, that helps in tests.
// @author       aartzz
// @match        *://naurok.com.ua/test/testing/*
// @match        *://docs.google.com/forms/d/e/*/viewform*
// @connect      localhost
// @connect      api.openai.com
// @connect      generativelanguage.googleapis.com
// @connect      api.mistral.ai
// @connect      *.googleusercontent.com
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const DEFAULT_SETTINGS = {
        activeService: 'MistralAI',
        Ollama: { host: 'http://localhost:11434', model: '' },
        OpenAI: { apiKey: '', model: 'gpt-4o' },
        Gemini: { apiKey: '', model: 'gemini-2.0-flash' },
        MistralAI: { apiKey: '0RBrYMEMvvazK5iZ9sckIdLSoBnv7Yuj', model: 'pixtral-large-2411' },
        promptPrefix: 'Я даю питання з варіантами відповіді. Дай відповідь на це питання, прямо, без пояснень.'
    };

    let settings = JSON.parse(GM_getValue('xdAnswers_settings', JSON.stringify(DEFAULT_SETTINGS)));
    let isProcessing = false;
    let availableModels = [];
    let lastProcessedNaurokText = '';
    let processedGFormQuestionIds = new Set();
    let lastRequestBody = null;
    let isDragging = false;
    let dragOffsetX, dragOffsetY;
    let settingsBtnOffsetX_relative, settingsBtnOffsetY_relative;
    let observerDebounceTimeout = null;
    let isHelperWindowMaximized = false;
    const defaultHelperState = { width: '350px', height: '400px', bottom: '20px', right: '20px', top: 'auto', left: 'auto' };
    const maximizedHelperState = { width: '70vw', height: '70vh', top: '15vh', left: '15vw', bottom: 'auto', right: 'auto' };

    // --- STYLES ---
    GM_addStyle(`
        :root {
            --futuristic-bg: #0a0a14; --futuristic-border: #00ffff; --futuristic-text: #00ff9d;
            --futuristic-glow: 0 0 5px var(--futuristic-border), 0 0 10px var(--futuristic-border), 0 0 15px var(--futuristic-border);
            --futuristic-font: 'Courier New', Courier, monospace;
        }
        .ollama-helper-container {
            position: fixed;
            width: ${defaultHelperState.width}; height: ${defaultHelperState.height};
            bottom: ${defaultHelperState.bottom}; right: ${defaultHelperState.right};
            top: ${defaultHelperState.top}; left: ${defaultHelperState.left};
            background-color: var(--futuristic-bg);
            border: 2px solid var(--futuristic-border); border-radius: 10px; box-shadow: var(--futuristic-glow);
            color: var(--futuristic-text); font-family: var(--futuristic-font); z-index: 9999; display: flex; flex-direction: column;
            overflow: hidden; transition: width 0.3s ease, height 0.3s ease, top 0.3s ease, left 0.3s ease, bottom 0.3s ease, right 0.3s ease;
        }
        .ollama-helper-header {
            display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background-color: #001f3f;
            border-bottom: 1px solid var(--futuristic-border); cursor: move;
        }
        .ollama-header-title { font-weight: bold; margin-right: auto; }
        .ollama-header-buttons { display: flex; align-items: center; }
        .ollama-header-buttons button {
            background: none; border: 1px solid var(--futuristic-border); color: var(--futuristic-border); border-radius: 5px;
            cursor: pointer; margin-left: 5px; font-size: 12px; width: 28px; height: 22px; padding: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .ollama-header-buttons button:hover { background-color: var(--futuristic-border); color: var(--futuristic-bg); }
        .ollama-helper-content { padding: 15px; overflow-y: auto; flex-grow: 1; white-space: pre-wrap; word-wrap: break-word; }
        .ollama-helper-content::-webkit-scrollbar { width: 8px; }
        .ollama-helper-content::-webkit-scrollbar-track { background: var(--futuristic-bg); }
        .ollama-helper-content::-webkit-scrollbar-thumb { background-color: var(--futuristic-border); border-radius: 10px; border: 2px solid var(--futuristic-bg); }
        .ollama-settings-button {
            position: fixed; bottom: 20px; right: 380px; width: 40px; height: 40px; background-color: var(--futuristic-bg);
            border: 2px solid var(--futuristic-border); border-radius: 50%; box-shadow: var(--futuristic-glow); color: var(--futuristic-text);
            font-size: 20px; cursor: pointer; z-index: 9998; display: flex; align-items: center; justify-content: center;
             transition: box-shadow 0.3s ease;
        }
        .ollama-settings-panel {
            display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 450px;
            background-color: var(--futuristic-bg); border: 2px solid var(--futuristic-border); box-shadow: var(--futuristic-glow);
            border-radius: 10px; z-index: 10000; padding: 20px; color: var(--futuristic-text); font-family: var(--futuristic-font);
        }
        .ollama-settings-panel h3 { text-align: center; margin-top: 0; color: var(--futuristic-border); }
        .ollama-settings-panel .form-group { margin-bottom: 15px; }
        .ollama-settings-panel label { display: block; margin-bottom: 5px; }
        #refresh-models-icon { cursor: pointer; margin-left: 10px; display: inline-block; transition: transform 0.5s ease; }
        #refresh-models-icon.spinning { animation: spin 1s linear infinite; }
        .ollama-settings-panel input, .ollama-settings-panel select, .ollama-settings-panel textarea {
            width: 100%; padding: 8px; background-color: #001f3f; border: 1px solid var(--futuristic-border);
            color: var(--futuristic-text); border-radius: 5px; box-sizing: border-box; font-family: var(--futuristic-font);
        }
        .ollama-settings-panel textarea { min-height: 80px; resize: vertical; }
        .ollama-settings-panel button {
            width: 100%; padding: 10px; background-color: var(--futuristic-border); border: none; color: var(--futuristic-bg);
            font-weight: bold; cursor: pointer; border-radius: 5px; margin-top: 10px; transition: all 0.2s ease;
        }
        .ollama-settings-panel button:hover { box-shadow: var(--futuristic-glow); color: #fff; }
        .ollama-settings-panel .close-btn { position: absolute; top: 10px; right: 15px; font-size: 24px; cursor: pointer; }
        .service-specific-settings { border-top: 1px solid var(--futuristic-border); padding-top: 15px; margin-top: 15px; }
        .loader { /* Centered loader */
            border: 4px solid #f3f3f3; border-top: 4px solid var(--futuristic-border); border-radius: 50%;
            width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto;
        }
        .loader-inline { /* Inline loader for GForms sequential processing */
            border: 2px solid #f3f3f3; border-top: 2px solid var(--futuristic-border); border-radius: 50%;
            width: 12px; height: 12px; animation: spin 1s linear infinite;
            display: inline-block; margin-left: 5px; vertical-align: middle;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `);

    // --- UI ELEMENTS ---
    const helperContainer = document.createElement('div');
    helperContainer.className = 'ollama-helper-container';
    helperContainer.innerHTML = `
        <div class="ollama-helper-header" id="ollama-helper-drag-header">
            <span class="ollama-header-title">xdAnswers</span>
            <div class="ollama-header-buttons">
                <button id="resize-helper-btn" title="Змінити розмір">➕</button>
                <button id="show-request-btn" title="Показати запит до ШІ">ℹ️</button>
                <button id="refresh-answer-btn" title="Оновити відповідь">🔄</button>
            </div>
        </div>
        <div class="ollama-helper-content" id="ollama-answer-content">Очікую на запитання...</div>
    `;
    document.body.appendChild(helperContainer);

    const settingsButtonElement = document.createElement('div');
    settingsButtonElement.className = 'ollama-settings-button';
    settingsButtonElement.innerHTML = '⚙️';
    document.body.appendChild(settingsButtonElement);

    document.body.insertAdjacentHTML('beforeend', `
        <div class="ollama-settings-panel">
            <span class="close-btn" id="close-settings-btn">&times;</span>
            <h3>Налаштування</h3>
            <div class="form-group">
                <label for="service-type">Тип сервісу:</label>
                <select id="service-type">
                    <option value="MistralAI">Mistral AI 🖼️ 💰</option>
                    <option value="OpenAI">OpenAI 💬🖼️ 💰</option>
                    <option value="Gemini">Google 💬🖼️</option>
                    <option value="Ollama">Ollama 🖼️ 🏠</option>
                </select>
            </div>
            <div id="ollama-settings" class="service-specific-settings">
                <div class="form-group">
                    <label for="ollama-host">Ollama Host:</label>
                    <input type="text" id="ollama-host">
                </div>
                <div class="form-group">
                    <label for="ollama-model">
                        Локальна модель: <span id="refresh-models-icon" title="Оновити список моделей">🔄</span>
                    </label>
                    <select id="ollama-model"></select>
                </div>
            </div>
            <div id="api-settings" class="service-specific-settings">
                 <div class="form-group">
                    <label for="api-key">API Ключ:</label>
                    <input type="password" id="api-key">
                </div>
                <div class="form-group">
                    <label for="api-model">Назва моделі:</label>
                    <input type="text" id="api-model">
                </div>
            </div>
            <div class="form-group" style="border-top: 1px solid var(--futuristic-border); padding-top: 15px; margin-top: 15px;">
                <label for="prompt-prefix">Системний промпт:</label>
                <textarea id="prompt-prefix"></textarea>
            </div>
            <button id="save-settings-btn">Зберегти</button>
        </div>
    `);

    // --- DRAGGING LOGIC ---
    const dragHeader = document.getElementById('ollama-helper-drag-header');
    // ... (Dragging logic is the same as v3.8, so I'll omit for brevity here but include in final script)
    dragHeader.onmousedown = function(event) {
        isDragging = true;
        dragOffsetX = event.clientX - helperContainer.offsetLeft;
        dragOffsetY = event.clientY - helperContainer.offsetTop;
        settingsBtnOffsetX_relative = settingsButtonElement.offsetLeft - helperContainer.offsetLeft;
        settingsBtnOffsetY_relative = settingsButtonElement.offsetTop - helperContainer.offsetTop;
        document.body.style.userSelect = 'none';
    };
    document.onmousemove = function(event) {
        if (isDragging) {
            let newHelperLeft = event.clientX - dragOffsetX;
            let newHelperTop = event.clientY - dragOffsetY;
            helperContainer.style.left = newHelperLeft + 'px';
            helperContainer.style.top = newHelperTop + 'px';
            helperContainer.style.right = 'auto'; helperContainer.style.bottom = 'auto';
            settingsButtonElement.style.left = (newHelperLeft + settingsBtnOffsetX_relative) + 'px';
            settingsButtonElement.style.top = (newHelperTop + settingsBtnOffsetY_relative) + 'px';
            settingsButtonElement.style.right = 'auto'; settingsButtonElement.style.bottom = 'auto';
        }
    };
    document.onmouseup = function() {
        isDragging = false;
        document.body.style.userSelect = '';
    };
    dragHeader.ontouchstart = function(event) {
        isDragging = true;
        const touch = event.touches[0];
        dragOffsetX = touch.clientX - helperContainer.offsetLeft;
        dragOffsetY = touch.clientY - helperContainer.offsetTop;
        settingsBtnOffsetX_relative = settingsButtonElement.offsetLeft - helperContainer.offsetLeft;
        settingsBtnOffsetY_relative = settingsButtonElement.offsetTop - helperContainer.offsetTop;
        document.body.style.userSelect = 'none';
        event.preventDefault();
    };
    document.ontouchmove = function(event) {
        if (isDragging) {
            const touch = event.touches[0];
            let newHelperLeft = touch.clientX - dragOffsetX;
            let newHelperTop = touch.clientY - dragOffsetY;
            helperContainer.style.left = newHelperLeft + 'px';
            helperContainer.style.top = newHelperTop + 'px';
            helperContainer.style.right = 'auto'; helperContainer.style.bottom = 'auto';
            settingsButtonElement.style.left = (newHelperLeft + settingsBtnOffsetX_relative) + 'px';
            settingsButtonElement.style.top = (newHelperTop + settingsBtnOffsetY_relative) + 'px';
            settingsButtonElement.style.right = 'auto'; settingsButtonElement.style.bottom = 'auto';
        }
    };
    document.ontouchend = function() {
        isDragging = false;
        document.body.style.userSelect = '';
    };

    // --- UI LOGIC (common) ---
    const serviceTypeSelect = document.getElementById('service-type');
    const ollamaSettingsDiv = document.getElementById('ollama-settings');
    const apiSettingsDiv = document.getElementById('api-settings');
    const showRequestBtn = document.getElementById('show-request-btn');
    const refreshAnswerBtn = document.getElementById('refresh-answer-btn');
    const resizeHelperBtn = document.getElementById('resize-helper-btn');
    const ollamaModelSelect = document.getElementById('ollama-model');
    const apiKeyInput = document.getElementById('api-key');
    const apiModelInput = document.getElementById('api-model');
    const promptPrefixTextarea = document.getElementById('prompt-prefix');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const settingsPanelElement = document.querySelector('.ollama-settings-panel');
    const refreshModelsIcon = document.getElementById('refresh-models-icon');
    const answerContentDiv = document.getElementById('ollama-answer-content');

    resizeHelperBtn.onclick = () => {
        isHelperWindowMaximized = !isHelperWindowMaximized;
        const targetState = isHelperWindowMaximized ? maximizedHelperState : defaultHelperState;
        Object.keys(targetState).forEach(key => helperContainer.style[key] = targetState[key]);
        resizeHelperBtn.textContent = isHelperWindowMaximized ? '➖' : '➕';
        if (!isHelperWindowMaximized) { // When minimizing, try to restore original fixed pos if not dragged
             // A simple check: if left/top are significantly away from initial 'auto'
            if (helperContainer.style.left !== 'auto' || helperContainer.style.top !== 'auto') {
                // If it was dragged, it stays where it was, just sized down.
                // If it was maximized and then minimized without dragging, this logic is okay.
            } else { // If it was never dragged from initial pos
                helperContainer.style.left = defaultHelperState.left;
                helperContainer.style.top = defaultHelperState.top;
                helperContainer.style.bottom = defaultHelperState.bottom;
                helperContainer.style.right = defaultHelperState.right;
            }
        }
    };

    function toggleSettingsVisibility() {
        const selectedService = serviceTypeSelect.value;
        if (selectedService === 'Ollama') {
            ollamaSettingsDiv.style.display = 'block';
            apiSettingsDiv.style.display = 'none';
        } else {
            ollamaSettingsDiv.style.display = 'none';
            apiSettingsDiv.style.display = 'block';
            if (!settings[selectedService]) {
                settings[selectedService] = { apiKey: DEFAULT_SETTINGS[selectedService]?.apiKey || '', model: DEFAULT_SETTINGS[selectedService]?.model || '' };
            }
            apiKeyInput.value = settings[selectedService].apiKey;
            apiModelInput.value = settings[selectedService].model;
        }
    }

    function populateSettings() {
        serviceTypeSelect.value = settings.activeService;
        document.getElementById('ollama-host').value = settings.Ollama.host;
        promptPrefixTextarea.value = settings.promptPrefix;
        if (settings.activeService !== 'Ollama') {
            if (!settings[settings.activeService]) {
                 settings[settings.activeService] = { apiKey: DEFAULT_SETTINGS[settings.activeService]?.apiKey || '', model: DEFAULT_SETTINGS[settings.activeService]?.model || '' };
            }
            apiKeyInput.value = settings[settings.activeService].apiKey;
            apiModelInput.value = settings[settings.activeService].model;
        }
        updateModelDropdown();
        toggleSettingsVisibility();
    }

    settingsButtonElement.onclick = () => {
        settingsPanelElement.style.display = 'block';
        populateSettings();
    };
    document.getElementById('close-settings-btn').onclick = () => { settingsPanelElement.style.display = 'none'; };
    refreshAnswerBtn.onclick = () => forceProcessQuestion();
    showRequestBtn.onclick = () => {
        let requestToShow = null;
        if (lastRequestBody) {
            if (lastRequestBody.prompt) { requestToShow = lastRequestBody.prompt; }
            else if (lastRequestBody.messages && lastRequestBody.messages.length > 0) {
                 let contentToDisplay = "System: " + lastRequestBody.messages[0].content + "\n\nUser: ";
                 const userMessageContent = lastRequestBody.messages[1].content;
                 if (Array.isArray(userMessageContent)) {
                     userMessageContent.forEach(item => {
                         if (item.type === "text") contentToDisplay += item.text + "\n";
                         if (item.type === "image_url") contentToDisplay += "[IMAGE]\n";
                     });
                 } else { contentToDisplay += userMessageContent; }
                 requestToShow = contentToDisplay;
            } else if (lastRequestBody.contents && lastRequestBody.contents.length > 0 && lastRequestBody.contents[0].parts) {
                let contentToDisplay = "";
                 if(lastRequestBody.systemInstruction && lastRequestBody.systemInstruction.parts && lastRequestBody.systemInstruction.parts[0].text) {
                    contentToDisplay += "System: " + lastRequestBody.systemInstruction.parts[0].text + "\n\n";
                }
                contentToDisplay += "User: ";
                lastRequestBody.contents[0].parts.forEach(part => {
                    if (part.text) contentToDisplay += part.text + "\n";
                    if (part.inline_data) contentToDisplay += "[IMAGE]\n";
                });
                requestToShow = contentToDisplay;
            }
        }
        if (requestToShow) alert('Запит, відправлений до ШІ:\n\n' + requestToShow);
        else alert('Ще не було відправлено жодного запиту, або формат невідомий.');
    };
    serviceTypeSelect.onchange = toggleSettingsVisibility;
    saveSettingsBtn.onclick = () => {
        const activeService = serviceTypeSelect.value;
        const oldActiveService = settings.activeService;
        const oldPromptPrefix = settings.promptPrefix;
        let modelChanged = false;
        settings.activeService = activeService;
        settings.promptPrefix = promptPrefixTextarea.value;
        if (activeService === 'Ollama') {
            const oldOllamaModel = settings.Ollama.model;
            settings.Ollama.host = document.getElementById('ollama-host').value;
            settings.Ollama.model = ollamaModelSelect.value;
            if (oldOllamaModel !== settings.Ollama.model) modelChanged = true;
        } else {
            if (!settings[activeService]) {
                 settings[activeService] = { apiKey: DEFAULT_SETTINGS[activeService]?.apiKey || '', model: DEFAULT_SETTINGS[activeService]?.model || '' };
            }
            const oldApiModel = settings[activeService].model;
            settings[activeService].apiKey = apiKeyInput.value;
            settings[activeService].model = apiModelInput.value;
            if (oldApiModel !== settings[activeService].model) modelChanged = true;
        }
        GM_setValue('xdAnswers_settings', JSON.stringify(settings));
        console.log('Налаштування збережено!');
        settingsPanelElement.style.display = 'none';
        if (oldActiveService !== activeService || oldPromptPrefix !== settings.promptPrefix || modelChanged) {
            forceProcessQuestion();
        }
    };
    refreshModelsIcon.onclick = function() {
        const icon = this;
        icon.classList.add('spinning');
        fetchModels(() => icon.classList.remove('spinning'));
    };

    function updateModelDropdown() {
        const select = ollamaModelSelect;
        select.innerHTML = '';
        availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            if (model.name === settings.Ollama.model) option.selected = true;
            select.appendChild(option);
        });
    }

    // --- API & CORE LOGIC (common functions) ---
    function fetchModels(onComplete) {
        if (settings.activeService !== 'Ollama' || !settings.Ollama.host) {
             if(onComplete) onComplete(); return;
        }
        GM_xmlhttpRequest({
            method: 'GET', url: `${settings.Ollama.host}/api/tags`,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        availableModels = JSON.parse(response.responseText).models;
                        if (availableModels.length > 0 && (!settings.Ollama.model || !availableModels.some(m => m.name === settings.Ollama.model))) {
                            settings.Ollama.model = availableModels[0].name;
                        }
                        updateModelDropdown();
                    } catch (e) { console.error("Error parsing Ollama models:", e); }
                } else { console.error("Error fetching Ollama models, status:", response.status); }
                if (onComplete) onComplete();
            },
            onerror: (error) => { console.error("Fetch Ollama models network error: ", error); if (onComplete) onComplete(); }
        });
    }

    function imageToBase64(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET', url: url, responseType: 'blob',
            onload: function(response) {
                if (response.status === 200 && response.response && response.response.size > 0) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (reader.result) callback(reader.result.split(',', 2)[1]);
                        else { console.warn("FileReader empty result for", url); callback(null); }
                    };
                    reader.onerror = (e) => { console.error("FileReader error for", url, e); callback(null); };
                    try { reader.readAsDataURL(response.response); } catch (e) { console.error("Error calling readAsDataURL", e); callback(null); }
                } else { console.warn("Failed to fetch image or empty response for", url, "Status:", response.status); callback(null); }
            },
            onerror: (e) => { console.error("GM_xmlhttpRequest error for image", url, e); callback(null); }
        });
    }

    // --- MAIN DISPATCHER ---
    async function getAnswer(questionData) {
        const service = settings.activeService;
        let responseText = "";
        let instruction = settings.promptPrefix;

        if (questionData.questionType === "short_text" || questionData.questionType === "paragraph") {
            instruction = "Дай розгорнуту відповідь на наступне відкрите питання:";
        } else if (questionData.isMultiQuiz) {
             instruction += '\nЦе питання може мати ДЕКІЛЬКА правильних відповідей. Перерахуй їх.';
        }

        try {
            if (service === 'Ollama') {
                responseText = await getAnswerFromOllama(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            } else if (service === 'OpenAI') {
                responseText = await getAnswerFromOpenAI(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            } else if (service === 'Gemini') {
                responseText = await getAnswerFromGemini(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            } else if (service === 'MistralAI') {
                responseText = await getAnswerFromMistralAI(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            } else {
                responseText = 'Невідомий сервіс обрано.';
            }
        } catch (error) {
            console.error(`Error getting answer from ${service}:`, error);
            responseText = `Помилка сервісу ${service}.`;
        }
        return responseText;
    }


    // --- SERVICE-SPECIFIC API HANDLERS (returning Promises) ---
    function getAnswerFromOllama(instruction, questionText, optionsText, base64Images) {
        return new Promise((resolve) => {
            if (!settings.Ollama.model) { resolve("Модель Ollama не обрана."); return; }
            let prompt = `${instruction}\n\nЗапитання: ${questionText}`;
            if (optionsText) prompt += `\n\nВаріанти відповідей:\n${optionsText}`;
            const requestBody = { model: settings.Ollama.model, prompt: prompt, stream: false };
            if (base64Images && base64Images.length > 0) requestBody.images = base64Images;
            lastRequestBody = { ...requestBody };
            GM_xmlhttpRequest({
                method: 'POST', url: `${settings.Ollama.host}/api/generate`,
                headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(requestBody), timeout: 60000,
                onload: (r) => {
                    if (r.status === 200) try { resolve(JSON.parse(r.responseText).response.trim()); } catch(e){ resolve("Parse Error Ollama"); }
                    else resolve(`Ollama API Error: ${r.status}`);
                },
                onerror: () => resolve("Помилка мережі (Ollama)."),
                ontimeout: () => resolve("Тайм-аут запиту (Ollama).")
            });
        });
    }

    function getAnswerFromOpenAI(systemInstruction, questionText, optionsText, base64Images) {
         return new Promise((resolve) => {
            if (!settings.OpenAI.apiKey || !settings.OpenAI.model) { resolve("API Ключ або модель OpenAI не вказані."); return; }
            let userTextContent = `Запитання: ${questionText}`;
            if (optionsText) userTextContent += `\n\nВаріанти відповідей:\n${optionsText}`;
            const contentForUserMessage = [{ type: 'text', text: userTextContent }];
            if (base64Images && base64Images.length > 0) {
                base64Images.forEach(img_b64 => contentForUserMessage.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img_b64}` } }));
            }
            const requestBody = {
                model: settings.OpenAI.model,
                messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: contentForUserMessage }],
                max_tokens: 500
            };
            lastRequestBody = { messages: requestBody.messages };
            GM_xmlhttpRequest({
                method: 'POST', url: 'https://api.openai.com/v1/chat/completions',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.OpenAI.apiKey}` },
                data: JSON.stringify(requestBody), timeout: 60000,
                onload: (r) => {
                    if (r.status === 200) try { resolve(JSON.parse(r.responseText).choices[0].message.content.trim()); } catch(e){ resolve("Parse Error OpenAI"); }
                    else resolve(`OpenAI API Error: ${r.status} ${r.responseText}`);
                },
                onerror: () => resolve("Помилка мережі (OpenAI)."),
                ontimeout: () => resolve("Тайм-аут запиту (OpenAI).")
            });
        });
    }

    function getAnswerFromGemini(systemInstructionText, questionText, optionsText, base64Images) {
        return new Promise((resolve) => {
            if (!settings.Gemini.apiKey || !settings.Gemini.model) { resolve("API Ключ або модель Gemini не вказані."); return; }
            let userQueryText = `Запитання: ${questionText}`;
            if (optionsText) userQueryText += `\n\nВаріанти відповідей:\n${optionsText}`;
            const userParts = [{ text: userQueryText }];
            if (base64Images && base64Images.length > 0) {
                base64Images.forEach(img_b64 => userParts.push({ inline_data: { mime_type: 'image/jpeg', data: img_b64 } }));
            }
            const requestBody = {
                contents: [{ role: "user", parts: userParts }],
                systemInstruction: { parts: [{text: systemInstructionText}] },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            };
            lastRequestBody = { contents: requestBody.contents, systemInstruction: requestBody.systemInstruction };
            GM_xmlhttpRequest({
                method: 'POST', url: `https://generativelanguage.googleapis.com/v1beta/models/${settings.Gemini.model}:generateContent?key=${settings.Gemini.apiKey}`,
                headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(requestBody), timeout: 60000,
                onload: (r) => {
                    if (r.status === 200) {
                        try {
                            const d = JSON.parse(r.responseText);
                            if (d.candidates && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0]) resolve(d.candidates[0].content.parts[0].text.trim());
                            else if (d.promptFeedback && d.promptFeedback.blockReason) resolve(`Запит заблоковано Gemini: ${d.promptFeedback.blockReason}`);
                            else if (d.candidates && d.candidates[0].finishReason !== "STOP") resolve(`Gemini завершив з причиною: ${d.candidates[0].finishReason}`);
                            else if (!d.candidates || d.candidates.length === 0) resolve("Gemini не надав кандидатів.");
                            else resolve("Невідома відповідь Gemini.");
                        } catch(e){ resolve("Parse Error Gemini"); }
                    } else resolve(`Gemini API Error: ${r.status} ${r.responseText}`);
                },
                onerror: () => resolve("Помилка мережі (Gemini)."),
                ontimeout: () => resolve("Тайм-аут запиту (Gemini).")
            });
        });
    }

    function getAnswerFromMistralAI(systemInstruction, questionText, optionsText, base64Images) {
         return new Promise((resolve) => {
            if (!settings.MistralAI.apiKey || !settings.MistralAI.model) { resolve("API Ключ або модель Mistral AI не вказані."); return; }
            let userTextContent = `Запитання: ${questionText}`;
            if (optionsText) userTextContent += `\n\nВаріанти відповідей:\n${optionsText}`;
            const contentForUserMessage = [{ type: 'text', text: userTextContent }];
            if (base64Images && base64Images.length > 0) {
                base64Images.forEach(img_b64 => contentForUserMessage.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img_b64}` }}));
            }
            const requestBody = {
                model: settings.MistralAI.model,
                messages: [ { role: 'system', content: systemInstruction }, { role: 'user', content: contentForUserMessage } ],
                max_tokens: 500
            };
            lastRequestBody = { messages: requestBody.messages };
            GM_xmlhttpRequest({
                method: 'POST', url: 'https://api.mistral.ai/v1/chat/completions',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.MistralAI.apiKey}` },
                data: JSON.stringify(requestBody), timeout: 60000,
                onload: (r) => {
                    if (r.status === 200) try { resolve(JSON.parse(r.responseText).choices[0].message.content.trim()); } catch(e){ resolve("Parse Error MistralAI"); }
                    else resolve(`MistralAI API Error: ${r.status} ${r.responseText}`);
                },
                onerror: () => resolve("Помилка мережі (MistralAI)."),
                ontimeout: () => resolve("Тайм-аут запиту (MistralAI).")
            });
        });
    }

    // --- SITE-SPECIFIC PROCESSING ---
    function forceProcessQuestion() {
        processedGFormQuestionIds.clear();
        lastProcessedNaurokText = '';
        if (location.hostname.includes('docs.google.com')) {
            answerContentDiv.innerHTML = 'Очікую на запитання Google Forms...'; // Clear content for GForms sequential display
        } else {
            answerContentDiv.innerHTML = 'Очікую на запитання Naurok...';
        }
        handlePageContentChange();
    }

    function handlePageContentChange() {
        if (observerDebounceTimeout) clearTimeout(observerDebounceTimeout);
        observerDebounceTimeout = setTimeout(() => {
            if (location.hostname.includes('docs.google.com')) {
                if (isProcessing) { // Check before starting GForm sequence
                    console.log("GForms: Sequence currently in progress, deferring new trigger.");
                    return;
                }
                processGFormQuestionsSequentially();
            } else if (location.hostname.includes('naurok.com.ua')) {
                if (isProcessing) {
                     console.log("Naurok: Still processing, skipping new trigger.");
                    return;
                }
                processNaurokQuestion();
            }
        }, 1000);
    }

    function processNaurokQuestion() {
        const questionTextElement = document.querySelector('.test-content-text-inner');
        if (!questionTextElement) return;
        const currentText = questionTextElement.innerText.trim();
        if (currentText === lastProcessedNaurokText || currentText === '') return;

        isProcessing = true;
        lastProcessedNaurokText = currentText;
        answerContentDiv.innerHTML = '<div class="loader"></div>';

        const mainImageElement = document.querySelector('.test-content-image img');
        const isMultiQuiz = document.querySelector("div[ng-if*='multiquiz']") !== null;
        const optionElements = document.querySelectorAll('.test-option');
        let allImageUrls = [];
        if (mainImageElement && mainImageElement.src) allImageUrls.push(mainImageElement.src);

        let optionLabels = [];
        optionElements.forEach((opt, index) => {
            const imageDiv = opt.querySelector('.question-option-image');
            const textDiv = opt.querySelector('.question-option-inner-content');
            if (imageDiv && imageDiv.style.backgroundImage) {
                const urlMatch = imageDiv.style.backgroundImage.match(/url\("?(.+?)"?\)/);
                if (urlMatch && urlMatch[1]) {
                    allImageUrls.push(urlMatch[1]);
                    optionLabels.push(`Варіант ${index + 1} (зображення)`);
                }
            } else if (textDiv) {
                optionLabels.push(textDiv.innerText.trim());
            }
        });
        const optionsText = optionLabels.join('\n');
        const imagePromises = allImageUrls.map(url => new Promise(resolve => imageToBase64(url, resolve)));

        Promise.all(imagePromises).then(base64Images => {
            const validImages = base64Images.filter(img => img !== null);
            const questionData = {
                text: currentText, optionsText: optionsText, base64Images: validImages,
                isMultiQuiz: isMultiQuiz, questionType: isMultiQuiz ? "checkbox" : "radio"
            };
            getAnswer(questionData).then(answer => {
                answerContentDiv.textContent = answer;
                isProcessing = false;
            });
        }).catch(err => {
            isProcessing = false;
            answerContentDiv.textContent = "Помилка обробки зображень (Naurok).";
        });
    }

    async function processGFormQuestionsSequentially() {
        if (isProcessing) return;
        isProcessing = true;

        const questionBlocks = document.querySelectorAll('div.Qr7Oae');
        if (!questionBlocks.length) {
            isProcessing = false; return;
        }

        let currentAccumulatedAnswers = answerContentDiv.innerHTML;
        if (currentAccumulatedAnswers.includes('<div class="loader-inline"></div>')) { // If previous run was interrupted
            currentAccumulatedAnswers = currentAccumulatedAnswers.replace(/Обробка питання \d+\.\.\. <div class="loader-inline"><\/div>\n?/, "");
        }


        let newQuestionsFound = false;
        for (let i = 0; i < questionBlocks.length; i++) {
            const questionBlock = questionBlocks[i];
            const questionTextElement = questionBlock.querySelector('.M7eMe, .ThX1ff, div[role="heading"] span');
            if (!questionTextElement) continue;
            const currentQuestionText = questionTextElement.innerText.trim();

            let uniqueId = null;
            const dataParams = questionBlock.dataset.params;
            if (dataParams) {
                const match = dataParams.match(/%.@\.\[(\d+),"/);
                if (match && match[1]) uniqueId = `param-${match[1]}`;
            }
            if (!uniqueId) {
                const hiddenInput = questionBlock.querySelector('input[type="hidden"][name^="entry."]');
                if (hiddenInput && hiddenInput.name) uniqueId = hiddenInput.name;
            }
            if (!uniqueId) uniqueId = currentQuestionText;

            if (currentQuestionText === '' || uniqueId === '') continue;
            if (processedGFormQuestionIds.has(uniqueId)) continue;

            newQuestionsFound = true;
            answerContentDiv.innerHTML = (currentAccumulatedAnswers.endsWith('\n') || currentAccumulatedAnswers === "" ? currentAccumulatedAnswers : currentAccumulatedAnswers + "\n") +
                                      `Обробка питання ${i + 1}... <div class="loader-inline"></div>\n`;
            answerContentDiv.scrollTop = answerContentDiv.scrollHeight;

            const mainImageElement = questionBlock.querySelector('img.HxhGpf');
            const isRadioQuiz = questionBlock.querySelector('div[role="radiogroup"]') !== null;
            const isCheckboxQuiz = questionBlock.querySelector('div[role="listbox"], div.Y6Myld div[role="list"]') !== null;
            const isShortText = questionBlock.querySelector('input.whsOnd[type="text"]') !== null;
            const isParagraph = questionBlock.querySelector('textarea.KHxj8b') !== null;
            let questionType = "unknown";
            if(isRadioQuiz) questionType = "radio"; else if(isCheckboxQuiz) questionType = "checkbox";
            else if(isShortText) questionType = "short_text"; else if(isParagraph) questionType = "paragraph";

            let allImageUrls = [];
            if (mainImageElement && mainImageElement.src) allImageUrls.push(mainImageElement.src);
            let optionLabels = [];
            if (isRadioQuiz || isCheckboxQuiz) {
                const gformOptionContainers = questionBlock.querySelectorAll('.nWQGrd.zwllIb, .Y6Myld .eBFwI');
                gformOptionContainers.forEach((optContainer, optIdx) => {
                    const textEl = optContainer.querySelector('span.aDTYNe, span.snByac');
                    const imgEl = optContainer.querySelector('img.QU5LQc');
                    if (imgEl && imgEl.src) {
                        allImageUrls.push(imgEl.src);
                        let lblText = `Варіант ${optIdx + 1} (зображення ${allImageUrls.length})`;
                        if (textEl && textEl.innerText.trim() && optContainer.closest('.UHZXDe')) {
                           lblText = `${textEl.innerText.trim()} (позначено як Варіант ${optIdx + 1}, є зображенням ${allImageUrls.length})`;
                        }
                        optionLabels.push(lblText);
                    } else if (textEl && textEl.innerText.trim()) {
                        optionLabels.push(textEl.innerText.trim());
                    }
                });
            }
            const optionsText = optionLabels.length > 0 ? optionLabels.join('\n') : null;
            const imagePromises = allImageUrls.map(url => new Promise(resolve => imageToBase64(url, resolve)));
            const base64Images = (await Promise.all(imagePromises)).filter(img => img !== null);

            const questionData = {
                text: currentQuestionText, optionsText: optionsText, base64Images: base64Images,
                isMultiQuiz: isCheckboxQuiz, questionType: questionType
            };

            const aiResponse = await getAnswer(questionData);

            const processingTextRegex = new RegExp(`Обробка питання ${i + 1}\\.\\.\\. <div class="loader-inline"></div>\\n?`);
            currentAccumulatedAnswers = answerContentDiv.innerHTML.replace(processingTextRegex, "");

            let newAnswerBlock = `${i + 1}: ${aiResponse}\n`;
            currentAccumulatedAnswers += newAnswerBlock;
            answerContentDiv.innerHTML = currentAccumulatedAnswers;
            answerContentDiv.scrollTop = answerContentDiv.scrollHeight;
            processedGFormQuestionIds.add(uniqueId);
        }

        if (!newQuestionsFound) {
            console.log("GForms: No new questions to process in this batch.");
            if (answerContentDiv.innerHTML.includes("loader-inline")) { // Clean up if no new q but loader was visible
                 answerContentDiv.innerHTML = answerContentDiv.innerHTML.replace(/Обробка питання \d+\.\.\. <div class="loader-inline"><\/div>\n?/g, "");
            }
        }
        isProcessing = false;
    }

    // --- OBSERVER ---
    const observerTarget = document.body;
    if (observerTarget) {
        const observer = new MutationObserver((mutationsList, obs) => handlePageContentChange());
        observer.observe(observerTarget, { childList: true, subtree: true });
    }

    // Initial load
    populateSettings();
    if (settings.activeService === 'Ollama') fetchModels();
})();
