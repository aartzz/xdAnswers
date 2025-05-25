// ==UserScript==
// @name         xdAnswers
// @namespace    http://tampermonkey.net/
// @version      4.10.1
// @description  A script, that helps in tests.
// @author       aartzz
// @match        *://naurok.com.ua/test/testing/*
// @match        *://docs.google.com/forms/d/e/*/viewform*
// @connect      localhost
// @connect      api.openai.com
// @connect      generativelanguage.googleapis.com
// @connect      api.mistral.ai
// @connect      *.googleusercontent.com // For Google Forms images
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const DEFAULT_SETTINGS = {
        activeService: 'MistralAI',
        Ollama: { host: '', model: '' },
        OpenAI: { apiKey: '', model: 'gpt-4o' },
        Gemini: { apiKey: '', model: 'gemini-2.0-flash' }, // Forced as requested by user
        MistralAI: { apiKey: '0RBrYMEMvvazK5iZ9sckIdLSoBnv7Yuj', model: 'pixtral-large-2411' }, // Forced as requested by user
        promptPrefix: 'Я даю питання з варіантами відповіді. Дай відповідь на це питання, прямо, без пояснень.'
        // outputLanguage setting removed
    };

    let settings = JSON.parse(GM_getValue('xdAnswers_settings', JSON.stringify(DEFAULT_SETTINGS)));
    // Ensure all service settings structures exist based on DEFAULT_SETTINGS after loading
    for (const serviceKey in DEFAULT_SETTINGS) {
        if (!['activeService', 'promptPrefix'].includes(serviceKey)) { // Removed outputLanguage from here
            if (!settings[serviceKey]) {
                settings[serviceKey] = { ...DEFAULT_SETTINGS[serviceKey] };
            } else {
                settings[serviceKey] = { ...DEFAULT_SETTINGS[serviceKey], ...settings[serviceKey] };
            }
        }
    }
    // Remove outputLanguage from settings if it exists from older versions
    if (settings.hasOwnProperty('outputLanguage')) {
        delete settings.outputLanguage;
    }

    const validServices = ['Ollama', 'OpenAI', 'Gemini', 'MistralAI'];
    if (!validServices.includes(settings.activeService)) {
        settings.activeService = DEFAULT_SETTINGS.activeService;
    }

    let isProcessing = false;
    let availableModels = [];
    let lastProcessedNaurokText = '';
    let processedGFormQuestionIds = new Set();
    let lastRequestBody = null;
    let isDragging = false;
    let dragOffsetX, dragOffsetY;
    let observerDebounceTimeout = null;
    let isHelperWindowMaximized = false;

    const defaultHelperState = {
        width: '350px', height: 'auto', maxHeight: '400px',
        bottom: '20px', right: '20px', top: 'auto', left: 'auto'
    };
    const maximizedHelperState = {
        width: '70vw', height: '70vh', maxHeight: 'none',
        top: '15vh', left: '15vw', bottom: 'auto', right: 'auto'
    };

    // --- STYLES ---
    GM_addStyle(`
        :root {
            --futuristic-bg: #0a0a14; --futuristic-border: #00ffff; --futuristic-text: #00ff9d;
            --futuristic-glow: 0 0 5px var(--futuristic-border), 0 0 10px var(--futuristic-border), 0 0 15px var(--futuristic-border);
            --futuristic-font: 'Courier New', Courier, monospace;
        }
        .ollama-helper-container { position: fixed; width: ${defaultHelperState.width}; height: ${defaultHelperState.height}; max-height: ${defaultHelperState.maxHeight}; bottom: ${defaultHelperState.bottom}; right: ${defaultHelperState.right}; top: ${defaultHelperState.top}; left: ${defaultHelperState.left}; background-color: var(--futuristic-bg); border: 2px solid var(--futuristic-border); border-radius: 10px; box-shadow: var(--futuristic-glow); color: var(--futuristic-text); font-family: var(--futuristic-font); z-index: 9999; display: flex; flex-direction: column; overflow: hidden; transition: width 0.3s ease, height 0.3s ease, max-height 0.3s ease, top 0.3s ease, left 0.3s ease, bottom 0.3s ease, right 0.3s ease; }
        .ollama-helper-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background-color: #001f3f; border-bottom: 1px solid var(--futuristic-border); cursor: move; }
        .ollama-header-title { font-weight: bold; margin-right: auto; }
        .ollama-header-buttons { display: flex; align-items: center; }
        .ollama-header-buttons button { background: none; border: 1px solid var(--futuristic-border); color: var(--futuristic-border); border-radius: 5px; cursor: pointer; margin-left: 5px; font-size: 12px; width: 28px; height: 22px; padding: 0; display: flex; align-items: center; justify-content: center; }
        .ollama-header-buttons button:hover { background-color: var(--futuristic-border); color: var(--futuristic-bg); }
        .ollama-helper-content { padding: 15px; overflow-y: auto; flex-grow: 1; white-space: pre-wrap; word-wrap: break-word; }
        .ollama-helper-content ul { margin-left: 20px; padding-left: 10px; list-style-type: disc; }
        .ollama-helper-content li { margin-bottom: 4px; }
        .ollama-helper-content::-webkit-scrollbar { width: 8px; }
        .ollama-helper-content::-webkit-scrollbar-track { background: var(--futuristic-bg); }
        .ollama-helper-content::-webkit-scrollbar-thumb { background-color: var(--futuristic-border); border-radius: 10px; border: 2px solid var(--futuristic-bg); }
        .ollama-settings-panel { display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 450px; background-color: var(--futuristic-bg); border: 2px solid var(--futuristic-border); box-shadow: var(--futuristic-glow); border-radius: 10px; z-index: 10000; padding: 20px; color: var(--futuristic-text); font-family: var(--futuristic-font); }
        .ollama-settings-panel h3 { text-align: center; margin-top: 0; color: var(--futuristic-border); }
        .ollama-settings-panel .form-group { margin-bottom: 15px; }
        .ollama-settings-panel label { display: block; margin-bottom: 5px; }
        .info-icon {
            cursor: pointer; margin-left: 8px; font-style: normal;
            color: var(--futuristic-text);
            padding: 1px 5px; font-size: 0.9em; display: inline-block;
            line-height: 1; vertical-align: middle;
        }
        .info-icon:hover { color: var(--futuristic-border); }
        #refresh-models-icon {
            cursor: pointer; margin-left: 10px; display: inline-block;
            transition: transform 0.5s ease;
            padding: 1px 4px; line-height: 1; vertical-align: middle;
            font-style: normal; color: var(--futuristic-text); font-size: 0.9em;
        }
        #refresh-models-icon.spinning { animation: spin 1s linear infinite; }
        #refresh-models-icon:hover { color: var(--futuristic-border); }
        .ollama-settings-panel input, .ollama-settings-panel select, .ollama-settings-panel textarea { width: 100%; padding: 8px; background-color: #001f3f; border: 1px solid var(--futuristic-border); color: var(--futuristic-text); border-radius: 5px; box-sizing: border-box; font-family: var(--futuristic-font); }
        .ollama-settings-panel textarea { min-height: 80px; resize: vertical; }
        .ollama-settings-panel button#save-settings-btn { width: 100%; padding: 10px; background-color: var(--futuristic-border); border: none; color: var(--futuristic-bg); font-weight: bold; cursor: pointer; border-radius: 5px; margin-top: 10px; transition: all 0.2s ease; }
        .ollama-settings-panel button#save-settings-btn:hover { box-shadow: var(--futuristic-glow); color: #fff; }
        .ollama-settings-panel .close-btn { position: absolute; top: 10px; right: 15px; font-size: 24px; cursor: pointer; }
        .service-specific-settings { border-top: 1px solid var(--futuristic-border); padding-top: 15px; margin-top: 15px; }
        .loader { border: 4px solid #f3f3f3; border-top: 4px solid var(--futuristic-border); border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto; }
        .loader-inline { border: 2px solid #f3f3f3; border-top: 2px solid var(--futuristic-border); border-radius: 50%; width: 12px; height: 12px; animation: spin 1s linear infinite; display: inline-block; margin-left: 5px; vertical-align: middle; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .xdanswers-info-modal-container { display: none; position: fixed; z-index: 10001; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.7); padding-top: 60px; }
        .xdanswers-info-modal-content { background-color: var(--futuristic-bg); color: var(--futuristic-text); margin: 5% auto; padding: 25px; border: 1px solid var(--futuristic-border); box-shadow: var(--futuristic-glow); border-radius: 10px; width: 80%; max-width: 500px; font-family: var(--futuristic-font); position: relative; font-size: 0.9em; }
        .xdanswers-info-modal-close-btn { color: var(--futuristic-text); float: right; font-size: 30px; font-weight: bold; line-height: 0.7; user-select: none; }
        .xdanswers-info-modal-close-btn:hover, .xdanswers-info-modal-close-btn:focus { color: var(--futuristic-border); text-decoration: none; cursor: pointer; }
        .xdanswers-info-modal-content h4 { margin-top: 0; color: var(--futuristic-border); margin-bottom: 15px; }
        .xdanswers-info-modal-content p { white-space: pre-wrap; line-height: 1.6; }
    `);

    // --- UI ELEMENTS ---
    const helperContainer = document.createElement('div');
    helperContainer.className = 'ollama-helper-container';
    helperContainer.innerHTML = `
        <div class="ollama-helper-header" id="ollama-helper-drag-header">
            <span class="ollama-header-title">xdAnswers</span>
            <div class="ollama-header-buttons">
                <button id="resize-helper-btn" title="Resize">➕</button>
                <button id="copy-answer-btn" title="Copy Answer">📋</button>
                <button id="show-request-btn" title="Show AI Request">ℹ️</button>
                <button id="refresh-answer-btn" title="Refresh Answer">🔄</button>
                <button id="open-settings-btn" title="Settings">⚙️</button>
            </div>
        </div>
        <div class="ollama-helper-content" id="ollama-answer-content">Waiting for question...</div>
    `;
    document.body.appendChild(helperContainer);

    const settingsPanelElement = document.createElement('div');
    settingsPanelElement.className = 'ollama-settings-panel';
    settingsPanelElement.innerHTML = `
        <span class="close-btn" id="close-settings-btn">&times;</span>
        <h3>Settings</h3>
        <div class="form-group">
            <label for="service-type">Service Type:
                <span class="info-icon" id="service-type-info-icon-btn">ℹ️</span>
            </label>
            <select id="service-type">
                <option value="MistralAI">Mistral 💬🖼️ 💰🆓</option>
                <option value="OpenAI">OpenAI 💬🖼️ 💰</option>
                <option value="Gemini">Google 💬🖼️ 💰</option>
                <option value="Ollama">Ollama 🏠</option>
            </select>
        </div>
        <div id="ollama-settings" class="service-specific-settings">
            <div class="form-group">
                <label for="ollama-host">Ollama Host:</label>
                <input type="text" id="ollama-host" placeholder="E.g. http://localhost:11434">
            </div>
            <div class="form-group">
                <label for="ollama-model">
                    Local Model: <span id="refresh-models-icon" title="Refresh model list">🔄</span>
                </label>
                <select id="ollama-model"></select>
            </div>
        </div>
        <div id="api-settings" class="service-specific-settings">
             <div class="form-group">
                <label for="api-key">API Key:</label>
                <input type="password" id="api-key">
            </div>
            <div class="form-group">
                <label for="api-model">Model Name:</label>
                <input type="text" id="api-model">
            </div>
        </div>
        <div class="form-group" style="border-top: 1px solid var(--futuristic-border); padding-top: 15px; margin-top: 15px;">
            <label for="prompt-prefix">Prompt:
                 <span class="info-icon" id="prompt-prefix-info-icon-btn">ℹ️</span>
            </label>
            <textarea id="prompt-prefix"></textarea>
        </div>
        <button id="save-settings-btn">Save</button>
    `;
    document.body.appendChild(settingsPanelElement);

    const infoModal = document.createElement('div');
    infoModal.id = 'xdAnswers-info-modal';
    infoModal.className = 'xdanswers-info-modal-container';
    infoModal.innerHTML = `
        <div class="xdanswers-info-modal-content">
            <span class="xdanswers-info-modal-close-btn" id="xdAnswers-modal-close-btn">&times;</span>
            <h4 id="xdAnswers-info-modal-title"></h4>
            <p id="xdAnswers-info-modal-text"></p>
        </div>`;
    document.body.appendChild(infoModal);

    // Assign variables AFTER elements are in DOM
    const serviceTypeSelect = document.getElementById('service-type');
    const ollamaSettingsDiv = document.getElementById('ollama-settings');
    const apiSettingsDiv = document.getElementById('api-settings');
    const showRequestBtn = document.getElementById('show-request-btn');
    const refreshAnswerBtn = document.getElementById('refresh-answer-btn');
    const resizeHelperBtn = document.getElementById('resize-helper-btn');
    const copyAnswerBtn = document.getElementById('copy-answer-btn');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const ollamaModelSelect = document.getElementById('ollama-model');
    const apiKeyInput = document.getElementById('api-key');
    const apiModelInput = document.getElementById('api-model');
    const promptPrefixTextarea = document.getElementById('prompt-prefix');
    // const outputLanguageSelect = document.getElementById('output-language'); // Removed
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const refreshModelsIcon = document.getElementById('refresh-models-icon');
    const answerContentDiv = document.getElementById('ollama-answer-content');
    const modalTitleEl = document.getElementById('xdAnswers-info-modal-title');
    const modalTextEl = document.getElementById('xdAnswers-info-modal-text');
    const modalCloseBtn = document.getElementById('xdAnswers-modal-close-btn');
    const dragHeader = document.getElementById('ollama-helper-drag-header');


    // --- DRAGGING LOGIC ---
    dragHeader.onmousedown = function(event) {
        if (event.target.tagName === 'BUTTON' || (event.target.parentElement && event.target.parentElement.tagName === 'BUTTON')) return;
        isDragging = true;
        dragOffsetX = event.clientX - helperContainer.offsetLeft;
        dragOffsetY = event.clientY - helperContainer.offsetTop;
        document.body.style.userSelect = 'none';
    };
    document.onmousemove = function(event) {
        if (isDragging) {
            let newHelperLeft = event.clientX - dragOffsetX;
            let newHelperTop = event.clientY - dragOffsetY;
            helperContainer.style.left = newHelperLeft + 'px';
            helperContainer.style.top = newHelperTop + 'px';
            helperContainer.style.right = 'auto'; helperContainer.style.bottom = 'auto';
        }
    };
    document.onmouseup = function() {
        if (isDragging) { isDragging = false; document.body.style.userSelect = ''; }
    };
    dragHeader.ontouchstart = function(event) {
        if (event.target.tagName === 'BUTTON' || (event.target.parentElement && event.target.parentElement.tagName === 'BUTTON')) return;
        isDragging = true;
        const touch = event.touches[0];
        dragOffsetX = touch.clientX - helperContainer.offsetLeft;
        dragOffsetY = touch.clientY - helperContainer.offsetTop;
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
        }
    };
    document.ontouchend = function() {
        if (isDragging) { isDragging = false; document.body.style.userSelect = ''; }
    };

    // --- UI LOGIC (common) ---
    function showInfoModal(title, text) {
        modalTitleEl.textContent = title;
        modalTextEl.textContent = text;
        infoModal.style.display = 'block';
    }
    modalCloseBtn.onclick = function() { infoModal.style.display = 'none'; }
    window.addEventListener('click', function(event) {
        if (event.target == infoModal) { infoModal.style.display = 'none'; }
    });
     window.addEventListener('keydown', function(event) {
        if (event.key === "Escape" && infoModal.style.display === 'block') {
            infoModal.style.display = 'none';
        }
    });
    document.getElementById('service-type-info-icon-btn').onclick = function() {
        showInfoModal('Service Type Legend',
            "💬 - Text support\n" +
            "🖼️ - Image support\n" +
            "💰 - Usage limits (requests/words per day)\n" +
            "🏠 - Self-hosted (requires your own server)\n" +
            "🆓 - Free tier provided out-of-the-box"
        );
    };
    document.getElementById('prompt-prefix-info-icon-btn').onclick = function() {
        showInfoModal('Prompt Field Information',
            "This field is for adjusting the request to the AI so it understands what is expected. This prompt is added at the beginning."
        );
    };

    resizeHelperBtn.onclick = () => {
        isHelperWindowMaximized = !isHelperWindowMaximized;
        const targetState = isHelperWindowMaximized ? maximizedHelperState : defaultHelperState;
        Object.keys(targetState).forEach(key => helperContainer.style[key] = targetState[key]);
        resizeHelperBtn.textContent = isHelperWindowMaximized ? '➖' : '➕';
        if (!isHelperWindowMaximized) {
            const currentBounds = helperContainer.getBoundingClientRect();
            const defaultRightNum = parseFloat(defaultHelperState.right);
            const defaultBottomNum = parseFloat(defaultHelperState.bottom);
            if (helperContainer.style.left !== 'auto' && helperContainer.style.top !== 'auto' &&
                !(Math.abs(window.innerWidth - currentBounds.left - parseFloat(defaultHelperState.width) - defaultRightNum) < 50 &&
                  Math.abs(window.innerHeight - currentBounds.top - parseFloat(defaultHelperState.maxHeight) - defaultBottomNum) < 50)) {
            } else {
                 Object.keys(defaultHelperState).forEach(key => helperContainer.style[key] = defaultHelperState[key]);
            }
        }
    };
    copyAnswerBtn.onclick = () => {
        const textToCopy = answerContentDiv.innerText;
        if (textToCopy && textToCopy !== 'Waiting for question...' && !answerContentDiv.querySelector('.loader')) {
            GM_setClipboard(textToCopy);
            copyAnswerBtn.textContent = '✅';
            setTimeout(() => { copyAnswerBtn.textContent = '📋'; }, 1500);
        } else {
            copyAnswerBtn.textContent = '❌';
            setTimeout(() => { copyAnswerBtn.textContent = '📋'; }, 1500);
        }
    };
    openSettingsBtn.onclick = () => {
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
        if (requestToShow) alert('Request sent to AI:\n\n' + requestToShow);
        else alert('No request has been sent yet, or format is unknown.');
    };
    serviceTypeSelect.onchange = () => {
        const selectedService = serviceTypeSelect.value;
        if (!settings[selectedService]) {
            settings[selectedService] = { ...(DEFAULT_SETTINGS[selectedService] || { apiKey: '', model: '' }) };
        }
        toggleSettingsVisibility();
    };
    saveSettingsBtn.onclick = () => {
        const activeService = serviceTypeSelect.value;
        const oldActiveService = settings.activeService;
        const oldPromptPrefix = settings.promptPrefix;
        let modelChanged = false;

        settings.activeService = activeService;
        settings.promptPrefix = promptPrefixTextarea.value;
        // settings.outputLanguage = outputLanguageSelect.value; // outputLanguage select removed

        if (activeService === 'Ollama') {
            const oldOllamaModel = settings.Ollama.model;
            settings.Ollama.host = document.getElementById('ollama-host').value;
            settings.Ollama.model = ollamaModelSelect.value;
            if (oldOllamaModel !== settings.Ollama.model) modelChanged = true;
        } else {
            if (!settings[activeService]) {
                 settings[activeService] = { ...(DEFAULT_SETTINGS[activeService] || { apiKey: '', model: '' }) };
            }
            const oldApiModel = settings[activeService].model;
            settings[activeService].apiKey = apiKeyInput.value;
            settings[activeService].model = apiModelInput.value;
            if (oldApiModel !== settings[activeService].model) modelChanged = true;
        }
        GM_setValue('xdAnswers_settings', JSON.stringify(settings));
        console.log('Settings saved!');
        settingsPanelElement.style.display = 'none';

        if (oldActiveService !== activeService || oldPromptPrefix !== settings.promptPrefix || modelChanged /*|| oldOutputLanguage !== settings.outputLanguage*/) {
            forceProcessQuestion();
        }
    };
    refreshModelsIcon.onclick = function() {
        const icon = this;
        icon.classList.add('spinning');
        fetchModels(() => icon.classList.remove('spinning'));
    };

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
        // outputLanguageSelect.value = settings.outputLanguage; // outputLanguage select removed

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
    function formatAIResponse(text) {
        if (typeof text !== 'string' || !text) return "";
        let lines = text.split('\n');
        let htmlOutput = '';
        let inList = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.match(/^#{1,3}\s+.*/)) { continue; }
            const listItemMatch = line.match(/^\*\s+(.*)/);
            if (listItemMatch) {
                if (!inList) { htmlOutput += '<ul>'; inList = true; }
                let itemContent = listItemMatch[1].trim();
                itemContent = itemContent.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                itemContent = itemContent.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<i>$1</i>');
                itemContent = itemContent.replace(/_(.+?)_/g, '<i>$1</i>');
                htmlOutput += `<li>${itemContent}</li>`;
            } else {
                if (inList) { htmlOutput += '</ul>'; inList = false; }
                let regularLine = line;
                regularLine = regularLine.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                regularLine = regularLine.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<i>$1</i>');
                regularLine = regularLine.replace(/_(.+?)_/g, '<i>$1</i>');
                htmlOutput += regularLine + (i < lines.length - 1 && line.trim() !== '' ? '<br>' : '');
            }
        }
        if (inList) { htmlOutput += '</ul>'; }
        return htmlOutput.trim();
    }

    // --- MAIN DISPATCHER ---
    async function getAnswer(questionData) {
        const service = settings.activeService;
        let responseText = "";
        let instruction = settings.promptPrefix;

        // Language instruction is now removed from here as per user request

        if (questionData.questionType === "short_text" || questionData.questionType === "paragraph") {
            instruction = "Дай розгорнуту відповідь на наступне відкрите питання:"; // This will be the primary instruction
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
                responseText = 'Unknown service selected.';
            }
        } catch (error) {
            console.error(`Error getting answer from ${service}:`, error);
            responseText = `Service error ${service}.`;
        }
        return responseText;
    }

    // --- SERVICE-SPECIFIC API HANDLERS (returning Promises with raw text) ---
    function getAnswerFromOllama(instruction, questionText, optionsText, base64Images) {
        return new Promise((resolve) => {
            if (!settings.Ollama.model) { resolve("Ollama model not selected."); return; }
            let prompt = `${instruction}\n\nQuestion: ${questionText}`;
            if (optionsText) prompt += `\n\nOptions:\n${optionsText}`;
            const requestBody = { model: settings.Ollama.model, prompt: prompt, stream: false };
            if (base64Images && base64Images.length > 0) requestBody.images = base64Images;
            lastRequestBody = { ...requestBody };
            GM_xmlhttpRequest({
                method: 'POST', url: `${settings.Ollama.host}/api/generate`,
                headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(requestBody), timeout: 60000,
                onload: (r) => {
                    if (r.status === 200) try { resolve(JSON.parse(r.responseText).response.trim()); } catch(e){ console.error("Ollama JSON parse error", e, r.responseText); resolve("Parse Error Ollama"); }
                    else resolve(`Ollama API Error: ${r.status}`);
                },
                onerror: () => resolve("Network Error (Ollama)."),
                ontimeout: () => resolve("Request Timeout (Ollama).")
            });
        });
    }
    function getAnswerFromOpenAI(systemInstruction, questionText, optionsText, base64Images) {
         return new Promise((resolve) => {
            if (!settings.OpenAI.apiKey || !settings.OpenAI.model) { resolve("API Key or Model for OpenAI not specified."); return; }
            let userTextContent = `Question: ${questionText}`;
            if (optionsText) userTextContent += `\n\nOptions:\n${optionsText}`;
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
                    if (r.status === 200) try { resolve(JSON.parse(r.responseText).choices[0].message.content.trim()); } catch(e){ console.error("OpenAI JSON parse error", e, r.responseText); resolve("Parse Error OpenAI"); }
                    else resolve(`OpenAI API Error: ${r.status} ${r.responseText}`);
                },
                onerror: () => resolve("Network Error (OpenAI)."),
                ontimeout: () => resolve("Request Timeout (OpenAI).")
            });
        });
    }
    function getAnswerFromGemini(systemInstructionText, questionText, optionsText, base64Images) {
        return new Promise((resolve) => {
            if (!settings.Gemini.apiKey || !settings.Gemini.model) { resolve("API Key or Model for Gemini not specified."); return; }
            let userQueryText = `Question: ${questionText}`;
            if (optionsText) userQueryText += `\n\nOptions:\n${optionsText}`;
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
                            else if (d.promptFeedback && d.promptFeedback.blockReason) resolve(`Request blocked by Gemini: ${d.promptFeedback.blockReason}`);
                            else if (d.candidates && d.candidates[0].finishReason !== "STOP") resolve(`Gemini finished with reason: ${d.candidates[0].finishReason}`);
                            else if (!d.candidates || d.candidates.length === 0) resolve("Gemini provided no answer candidates.");
                            else resolve("Unknown Gemini response.");
                        } catch(e){ console.error("Gemini JSON parse error", e, r.responseText); resolve("Parse Error Gemini");}
                    } else resolve(`Gemini API Error: ${r.status} ${r.responseText}`);
                },
                onerror: () => resolve("Network Error (Gemini)."),
                ontimeout: () => resolve("Request Timeout (Gemini).")
            });
        });
    }
    function getAnswerFromMistralAI(systemInstruction, questionText, optionsText, base64Images) {
         return new Promise((resolve) => {
            if (!settings.MistralAI.apiKey || !settings.MistralAI.model) { resolve("API Key or Model for Mistral AI not specified."); return; }
            let userTextContent = `Question: ${questionText}`;
            if (optionsText) userTextContent += `\n\nOptions:\n${optionsText}`;
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
                    if (r.status === 200) try { resolve(JSON.parse(r.responseText).choices[0].message.content.trim()); } catch(e){ console.error("MistralAI JSON parse error", e, r.responseText); resolve("Parse Error MistralAI"); }
                    else resolve(`MistralAI API Error: ${r.status} ${r.responseText}`);
                },
                onerror: () => resolve("Network Error (MistralAI)."),
                ontimeout: () => resolve("Request Timeout (MistralAI).")
            });
        });
    }

    // --- SITE-SPECIFIC PROCESSING ---
    function forceProcessQuestion() {
        processedGFormQuestionIds.clear();
        lastProcessedNaurokText = '';
        answerContentDiv.innerHTML = 'Updating...';
        handlePageContentChange();
    }

    function handlePageContentChange() {
        if (observerDebounceTimeout) clearTimeout(observerDebounceTimeout);
        observerDebounceTimeout = setTimeout(() => {
            if (isProcessing && !location.hostname.includes('docs.google.com')) {
                return;
            }
            if (location.hostname.includes('docs.google.com')) {
                processGFormQuestionsSequentially();
            } else if (location.hostname.includes('naurok.com.ua')) {
                 if (isProcessing) return;
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
                    optionLabels.push(`Option ${index + 1} (image)`);
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
                answerContentDiv.innerHTML = formatAIResponse(answer);
                isProcessing = false;
            });
        }).catch(err => {
            isProcessing = false;
            answerContentDiv.innerHTML = formatAIResponse("Image processing error (Naurok).");
        });
    }

    async function processGFormQuestionsSequentially() {
        if (isProcessing) return;
        isProcessing = true;

        const questionBlocks = document.querySelectorAll('div.Qr7Oae');
        if (!questionBlocks.length) {
            isProcessing = false;
             if (answerContentDiv.innerHTML.includes("loader") || answerContentDiv.innerText === 'Updating...' || answerContentDiv.innerText === 'Waiting for question...') {
                answerContentDiv.innerHTML = formatAIResponse('No questions found on page.');
            }
            return;
        }

        let accumulatedAnswersHTML = answerContentDiv.innerHTML; // Use innerHTML to preserve formatting
        if (accumulatedAnswersHTML.includes('Updating...') ||
            accumulatedAnswersHTML.includes('Waiting for question...') ||
            accumulatedAnswersHTML.includes('No questions found on page.')) {
            accumulatedAnswersHTML = "";
        }
        accumulatedAnswersHTML = accumulatedAnswersHTML.replace(/Processing question \d+\.\.\. <div class="loader-inline"><\/div>\n?/g, "");


        let newQuestionsFoundThisRun = 0;
        let questionNumberForDisplay = (accumulatedAnswersHTML.match(/^\d+:/gm) || []).length;


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

            newQuestionsFoundThisRun++;
            questionNumberForDisplay++;

            answerContentDiv.innerHTML = accumulatedAnswersHTML +
                                      (accumulatedAnswersHTML.endsWith('\n') || accumulatedAnswersHTML === "" ? "" : "\n") +
                                      `Processing question ${questionNumberForDisplay}... <div class="loader-inline"></div>\n`;
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
                        let lblText = `Option ${optIdx + 1} (image ${allImageUrls.length})`;
                        if (textEl && textEl.innerText.trim() && optContainer.closest('.UHZXDe')) {
                           lblText = `${textEl.innerText.trim()} (labeled as Option ${optIdx + 1}, is image ${allImageUrls.length})`;
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

            const aiResponseText = await getAnswer(questionData);

            const processingTextRegex = new RegExp(`Processing question ${questionNumberForDisplay}\\.\\.\\. <div class="loader-inline"></div>\\n?`);
            accumulatedAnswersHTML = answerContentDiv.innerHTML.replace(processingTextRegex, "");

            accumulatedAnswersHTML += `${questionNumberForDisplay}: ${formatAIResponse(aiResponseText)}\n`;
            answerContentDiv.innerHTML = accumulatedAnswersHTML;
            answerContentDiv.scrollTop = answerContentDiv.scrollHeight;
            processedGFormQuestionIds.add(uniqueId);
        }

        if (answerContentDiv.innerHTML.includes("loader-inline")) {
             answerContentDiv.innerHTML = answerContentDiv.innerHTML.replace(/Processing question \d+\.\.\. <div class="loader-inline"><\/div>\n?/g, "");
        }

        if (!newQuestionsFoundThisRun && questionBlocks.length > 0) {
             if (accumulatedAnswersHTML.trim() === '' || accumulatedAnswersHTML === 'Оновлення...') {
                 answerContentDiv.innerHTML = 'All questions on this page have been processed. Press 🔄 to reprocess all.';
            }
            // No else needed here, as we don't want to append "All questions processed" if there's existing content.
        } else if (questionBlocks.length === 0 && accumulatedAnswersHTML.trim() === '') {
             answerContentDiv.innerHTML = 'No questions found on the page.';
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
    createUI(); // Create UI elements
    populateSettings(); // Populate settings fields
    if (settings.activeService === 'Ollama') {
        fetchModels();
    }
})();
