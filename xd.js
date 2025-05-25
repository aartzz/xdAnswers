// ==UserScript==
// @name         xdAnswers
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  A script, that helps in tests.
// @author       aartzz
// @match        *://naurok.com.ua/test/testing/*
// @connect      localhost
// @connect      api.openai.com
// @connect      generativelanguage.googleapis.com
// @connect      api.mistral.ai
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
        activeService: 'MistralAI', // Default to MistralAI
        Ollama: {
            host: 'http://localhost:11434',
            model: ''
        },
        OpenAI: {
            apiKey: '',
            model: 'gpt-4o'
        },
        Gemini: {
            apiKey: '',
            model: 'gemini-2.0-flash'
        },
        MistralAI: {
            apiKey: '0RBrYMEMvvazK5iZ9sckIdLSoBnv7Yuj', // Pre-filled public key
            model: 'pixtral-large-2411' // Default model, can be changed
        },
        promptPrefix: 'Я даю питання з варіантами відповіді. Дай відповідь на це питання, прямо, без пояснень.'
    };

    let settings = JSON.parse(GM_getValue('xdAnswers_settings', JSON.stringify(DEFAULT_SETTINGS)));
    let isProcessing = false;
    let availableModels = [];
    let lastProcessedText = '';
    let lastRequestBody = null;
    let isDragging = false;
    let dragOffsetX, dragOffsetY;
    let settingsBtnOffsetX_relative, settingsBtnOffsetY_relative;


    // --- STYLES ---
    GM_addStyle(`
        :root {
            --futuristic-bg: #0a0a14; --futuristic-border: #00ffff; --futuristic-text: #00ff9d;
            --futuristic-glow: 0 0 5px var(--futuristic-border), 0 0 10px var(--futuristic-border), 0 0 15px var(--futuristic-border);
            --futuristic-font: 'Courier New', Courier, monospace;
        }
        .ollama-helper-container {
            position: fixed; bottom: 20px; right: 20px; width: 350px; max-height: 400px; background-color: var(--futuristic-bg);
            border: 2px solid var(--futuristic-border); border-radius: 10px; box-shadow: var(--futuristic-glow);
            color: var(--futuristic-text); font-family: var(--futuristic-font); z-index: 9999; display: flex; flex-direction: column;
            overflow: hidden; transition: box-shadow 0.3s ease; /* Changed transition for smoother drag without size change */
        }
        .ollama-helper-header {
            display: flex; justify-content: space-between; align-items: center; padding: 10px; background-color: #001f3f;
            border-bottom: 1px solid var(--futuristic-border); cursor: move;
        }
        .ollama-header-title { font-weight: bold; }
        .ollama-header-buttons button {
            background: none; border: 1px solid var(--futuristic-border); color: var(--futuristic-border); border-radius: 5px;
            cursor: pointer; margin-left: 5px; font-size: 14px; width: 30px; height: 25px;
        }
        .ollama-header-buttons button:hover { background-color: var(--futuristic-border); color: var(--futuristic-bg); }
        .ollama-helper-content { padding: 15px; overflow-y: auto; flex-grow: 1; white-space: pre-wrap; word-wrap: break-word; }
        .ollama-settings-button {
            position: fixed; bottom: 20px; right: 380px; width: 40px; height: 40px; background-color: var(--futuristic-bg);
            border: 2px solid var(--futuristic-border); border-radius: 50%; box-shadow: var(--futuristic-glow); color: var(--futuristic-text);
            font-size: 20px; cursor: pointer; z-index: 9998; display: flex; align-items: center; justify-content: center; /* Adjusted z-index */
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
        .loader {
            border: 4px solid #f3f3f3; border-top: 4px solid var(--futuristic-border); border-radius: 50%;
            width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto;
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
                <button id="show-request-btn" title="Показати запит до ШІ">ℹ️</button>
                <button id="refresh-answer-btn" title="Оновити відповідь">🔄</button>
            </div>
        </div>
        <div class="ollama-helper-content" id="ollama-answer-content">Очікую на запитання...</div>
    `;
    document.body.appendChild(helperContainer);

    const settingsButton = document.createElement('div'); // Renamed for clarity
    settingsButton.className = 'ollama-settings-button';
    settingsButton.innerHTML = '⚙️';
    document.body.appendChild(settingsButton);


    document.body.insertAdjacentHTML('beforeend', `
        <div class="ollama-settings-panel">
            <span class="close-btn" id="close-settings-btn">&times;</span>
            <h3>Налаштування</h3>
            <div class="form-group">
                <label for="service-type">Тип сервісу:</label>
                <select id="service-type">
                    <option value="MistralAI">Mistral 💬🖼️</option>
                    <option value="OpenAI">OpenAI 💬🖼️ 💰</option>
                    <option value="Gemini">Google 💬🖼️ 💰</option>
                    <option value="Ollama">Ollama 🏠</option>
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

    function startDrag(event) {
        isDragging = true;
        const clientX = event.clientX || event.touches[0].clientX;
        const clientY = event.clientY || event.touches[0].clientY;

        dragOffsetX = clientX - helperContainer.offsetLeft;
        dragOffsetY = clientY - helperContainer.offsetTop;

        // Calculate relative offset for settings button
        settingsBtnOffsetX_relative = settingsButton.offsetLeft - helperContainer.offsetLeft;
        settingsBtnOffsetY_relative = settingsButton.offsetTop - helperContainer.offsetTop;

        document.body.style.userSelect = 'none';
        if (event.type === 'touchstart') event.preventDefault();
    }

    function doDrag(event) {
        if (isDragging) {
            const clientX = event.clientX || event.touches[0].clientX;
            const clientY = event.clientY || event.touches[0].clientY;

            let newHelperLeft = clientX - dragOffsetX;
            let newHelperTop = clientY - dragOffsetY;

            helperContainer.style.left = newHelperLeft + 'px';
            helperContainer.style.top = newHelperTop + 'px';
            helperContainer.style.right = 'auto';
            helperContainer.style.bottom = 'auto';

            settingsButton.style.left = (newHelperLeft + settingsBtnOffsetX_relative) + 'px';
            settingsButton.style.top = (newHelperTop + settingsBtnOffsetY_relative) + 'px';
            settingsButton.style.right = 'auto';
            settingsButton.style.bottom = 'auto';
        }
    }

    function stopDrag() {
        isDragging = false;
        document.body.style.userSelect = '';
    }

    dragHeader.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);

    dragHeader.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', doDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);


    // --- UI LOGIC ---
    const serviceTypeSelect = document.getElementById('service-type');
    const ollamaSettingsDiv = document.getElementById('ollama-settings');
    const apiSettingsDiv = document.getElementById('api-settings');

    function toggleSettingsVisibility() {
        const selectedService = serviceTypeSelect.value;
        if (selectedService === 'Ollama') {
            ollamaSettingsDiv.style.display = 'block';
            apiSettingsDiv.style.display = 'none';
        } else { // For OpenAI, Gemini, MistralAI
            ollamaSettingsDiv.style.display = 'none';
            apiSettingsDiv.style.display = 'block';
            if (!settings[selectedService]) {
                settings[selectedService] = { apiKey: DEFAULT_SETTINGS[selectedService]?.apiKey || '', model: DEFAULT_SETTINGS[selectedService]?.model || '' };
            }
            document.getElementById('api-key').value = settings[selectedService].apiKey;
            document.getElementById('api-model').value = settings[selectedService].model;
        }
    }

    function populateSettings() {
        serviceTypeSelect.value = settings.activeService;
        document.getElementById('ollama-host').value = settings.Ollama.host; // Ollama specific
        document.getElementById('prompt-prefix').value = settings.promptPrefix;

        // Populate API specific fields if relevant
        if (settings.activeService !== 'Ollama') {
            if (!settings[settings.activeService]) { // Ensure structure exists
                 settings[settings.activeService] = { apiKey: DEFAULT_SETTINGS[settings.activeService]?.apiKey || '', model: DEFAULT_SETTINGS[settings.activeService]?.model || '' };
            }
            document.getElementById('api-key').value = settings[settings.activeService].apiKey;
            document.getElementById('api-model').value = settings[settings.activeService].model;
        }
        updateModelDropdown(); // For Ollama models
        toggleSettingsVisibility();
    }

    document.querySelector('.ollama-settings-button').onclick = () => {
        document.querySelector('.ollama-settings-panel').style.display = 'block';
        populateSettings();
    };
    document.getElementById('close-settings-btn').onclick = () => { document.querySelector('.ollama-settings-panel').style.display = 'none'; };
    document.getElementById('refresh-answer-btn').onclick = () => forceProcessQuestion();
    document.getElementById('show-request-btn').onclick = () => {
        let requestToShow = null;
        if (lastRequestBody) {
            if (lastRequestBody.prompt) { // Ollama
                requestToShow = lastRequestBody.prompt;
            } else if (lastRequestBody.messages && lastRequestBody.messages.length > 0) { // OpenAI, MistralAI
                 let contentToDisplay = "System: " + lastRequestBody.messages[0].content + "\n\nUser: ";
                 const userMessageContent = lastRequestBody.messages[1].content;
                 if (Array.isArray(userMessageContent)) {
                     userMessageContent.forEach(item => {
                         if (item.type === "text") contentToDisplay += item.text + "\n";
                         if (item.type === "image_url") contentToDisplay += "[IMAGE]\n";
                     });
                 } else {
                     contentToDisplay += userMessageContent; // Should not happen for multimodal
                 }
                 requestToShow = contentToDisplay;
            } else if (lastRequestBody.contents && lastRequestBody.contents.length > 0 && lastRequestBody.contents[0].parts) { // Gemini
                let contentToDisplay = "";
                lastRequestBody.contents[0].parts.forEach(part => {
                    if (part.text) contentToDisplay += part.text + "\n";
                    if (part.inline_data) contentToDisplay += "[IMAGE]\n";
                });
                requestToShow = contentToDisplay;
            }
        }
        if (requestToShow) {
            alert('Запит, відправлений до ШІ:\n\n' + requestToShow);
        } else {
            alert('Ще не було відправлено жодного запиту, або формат невідомий.');
        }
    };

    serviceTypeSelect.onchange = toggleSettingsVisibility;

    document.getElementById('save-settings-btn').onclick = () => {
        const activeService = serviceTypeSelect.value;
        const oldActiveService = settings.activeService;
        const oldPromptPrefix = settings.promptPrefix;

        settings.activeService = activeService;
        settings.promptPrefix = document.getElementById('prompt-prefix').value;

        if (activeService === 'Ollama') {
            settings.Ollama.host = document.getElementById('ollama-host').value;
            settings.Ollama.model = document.getElementById('ollama-model').value;
        } else { // For OpenAI, Gemini, MistralAI
            if (!settings[activeService]) {
                 settings[activeService] = { apiKey: DEFAULT_SETTINGS[activeService]?.apiKey || '', model: DEFAULT_SETTINGS[activeService]?.model || '' };
            }
            settings[activeService].apiKey = document.getElementById('api-key').value;
            settings[activeService].model = document.getElementById('api-model').value;
        }

        GM_setValue('xdAnswers_settings', JSON.stringify(settings));
        console.log('Налаштування збережено!');
        document.querySelector('.ollama-settings-panel').style.display = 'none';
        if (oldActiveService !== activeService || oldPromptPrefix !== settings.promptPrefix ||
            (activeService === 'Ollama' && (oldActiveService !== 'Ollama' || settings.Ollama.model !== document.getElementById('ollama-model').value)) ||
            (activeService !== 'Ollama' && (oldActiveService !== activeService || settings[activeService].model !== document.getElementById('api-model').value)) ) {
            forceProcessQuestion();
        }
    };
    document.getElementById('refresh-models-icon').onclick = function() {
        const icon = this;
        icon.classList.add('spinning');
        fetchModels(() => icon.classList.remove('spinning'));
    };

    function updateModelDropdown() {
        const select = document.getElementById('ollama-model');
        select.innerHTML = '';
        availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            if (model.name === settings.Ollama.model) option.selected = true;
            select.appendChild(option);
        });
    }

    // --- API & CORE LOGIC ---
    function fetchModels(onComplete) {
        if (settings.activeService !== 'Ollama') {
            if(onComplete) onComplete();
            return;
        }
        GM_xmlhttpRequest({
            method: 'GET', url: `${settings.Ollama.host}/api/tags`,
            onload: function(response) {
                if (response.status === 200) {
                    availableModels = JSON.parse(response.responseText).models;
                    if (availableModels.length > 0 && (!settings.Ollama.model || !availableModels.some(m => m.name === settings.Ollama.model))) {
                        settings.Ollama.model = availableModels[0].name;
                    }
                    updateModelDropdown();
                }
                if (onComplete) onComplete();
            },
            onerror: (error) => { if (onComplete) onComplete(); }
        });
    }

    function imageToBase64(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET', url: url, responseType: 'blob',
            onload: function(response) {
                if (response.status === 200 && response.response.size > 0) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (reader.result) callback(reader.result.split(',', 2)[1]);
                        else callback(null);
                    };
                    reader.onerror = () => callback(null);
                    reader.readAsDataURL(response.response);
                } else { callback(null); }
            },
            onerror: () => callback(null)
        });
    }

    function getAnswer(questionText, optionsText, allBase64Images, isMultiQuiz) {
        const service = settings.activeService;
        document.getElementById('ollama-answer-content').innerHTML = '<div class="loader"></div>';

        if (service === 'Ollama') {
            getAnswerFromOllama(questionText, optionsText, allBase64Images, isMultiQuiz);
        } else if (service === 'OpenAI') {
            getAnswerFromOpenAI(questionText, optionsText, allBase64Images, isMultiQuiz);
        } else if (service === 'Gemini') {
            getAnswerFromGemini(questionText, optionsText, allBase64Images, isMultiQuiz);
        } else if (service === 'MistralAI') {
            getAnswerFromMistralAI(questionText, optionsText, allBase64Images, isMultiQuiz);
        } else {
            document.getElementById('ollama-answer-content').textContent = 'Невідомий сервіс обрано.';
            isProcessing = false;
        }
    }

    function getAnswerFromOllama(questionText, optionsText, allBase64Images, isMultiQuiz) {
        if (!settings.Ollama.model) {
            document.getElementById('ollama-answer-content').textContent = "Модель Ollama не обрана.";
            isProcessing = false; return;
        }
        let instruction = settings.promptPrefix;
        if (isMultiQuiz) instruction += '\nЦе питання може мати ДЕКІЛЬКА правильних відповідей. Перерахуй їх.';
        let prompt = `${instruction}\n\nЗапитання: ${questionText}`;
        if (optionsText) prompt += `\n\nВаріанти відповідей:\n${optionsText}`;

        const requestBody = { model: settings.Ollama.model, prompt: prompt, stream: false };
        if (allBase64Images && allBase64Images.length > 0) requestBody.images = allBase64Images;
        lastRequestBody = { ...requestBody };

        GM_xmlhttpRequest({
            method: 'POST', url: `${settings.Ollama.host}/api/generate`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(requestBody), timeout: 60000,
            onload: (response) => {
                let answer = "Помилка отримання відповіді від Ollama.";
                if (response.status === 200) {
                    try { answer = JSON.parse(response.responseText).response.trim(); }
                    catch(e) { console.error("Ollama JSON parse error", e); }
                } else { answer = `Ollama API Error: ${response.status}`; }
                document.getElementById('ollama-answer-content').textContent = answer;
                isProcessing = false;
            },
            onerror: () => { isProcessing = false; document.getElementById('ollama-answer-content').textContent = "Помилка мережі (Ollama)."; },
            ontimeout: () => { isProcessing = false; document.getElementById('ollama-answer-content').textContent = "Тайм-аут запиту (Ollama)."; }
        });
    }

    function getAnswerFromOpenAI(questionText, optionsText, allBase64Images, isMultiQuiz) {
        if (!settings.OpenAI.apiKey || !settings.OpenAI.model) {
            document.getElementById('ollama-answer-content').textContent = "API Ключ або модель OpenAI не вказані.";
            isProcessing = false; return;
        }
        let instruction = settings.promptPrefix;
        if (isMultiQuiz) instruction += '\nЦе питання може мати ДЕКІЛЬКА правильних відповідей. Перерахуй їх.';
        let userTextContent = `Запитання: ${questionText}`;
        if (optionsText) userTextContent += `\n\nВаріанти відповідей:\n${optionsText}`;

        const contentForUserMessage = [{ type: 'text', text: userTextContent }];
        if (allBase64Images && allBase64Images.length > 0) {
            allBase64Images.forEach(img_b64 => {
                contentForUserMessage.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img_b64}` } });
            });
        }
        const requestBody = {
            model: settings.OpenAI.model,
            messages: [{ role: 'system', content: instruction }, { role: 'user', content: contentForUserMessage }],
            max_tokens: 500
        };
        lastRequestBody = { messages: requestBody.messages };

        GM_xmlhttpRequest({
            method: 'POST', url: 'https://api.openai.com/v1/chat/completions',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.OpenAI.apiKey}` },
            data: JSON.stringify(requestBody), timeout: 60000,
            onload: (response) => {
                let answer = "Помилка отримання відповіді від OpenAI.";
                if (response.status === 200) {
                     try { answer = JSON.parse(response.responseText).choices[0].message.content.trim(); }
                     catch(e) { console.error("OpenAI JSON parse error", e); }
                } else {
                    answer = `OpenAI API Error: ${response.status}`;
                    console.error("OpenAI Error:", response.responseText);
                }
                document.getElementById('ollama-answer-content').textContent = answer;
                isProcessing = false;
            },
            onerror: () => { isProcessing = false; document.getElementById('ollama-answer-content').textContent = "Помилка мережі (OpenAI)."; },
            ontimeout: () => { isProcessing = false; document.getElementById('ollama-answer-content').textContent = "Тайм-аут запиту (OpenAI)."; }
        });
    }

    function getAnswerFromGemini(questionText, optionsText, allBase64Images, isMultiQuiz) {
        if (!settings.Gemini.apiKey || !settings.Gemini.model) {
            document.getElementById('ollama-answer-content').textContent = "API Ключ або модель Gemini не вказані.";
            isProcessing = false; return;
        }
        let instruction = settings.promptPrefix;
        if (isMultiQuiz) instruction += '\nЦе питання може мати ДЕКІЛЬКА правильних відповідей. Перерахуй їх.';
        let userQueryText = `Запитання: ${questionText}`;
        if (optionsText) userQueryText += `\n\nВаріанти відповідей:\n${optionsText}`;

        const parts = [{ text: instruction }, { text: userQueryText }];
        if (allBase64Images && allBase64Images.length > 0) {
            allBase64Images.forEach(img_b64 => {
                parts.push({ inline_data: { mime_type: 'image/jpeg', data: img_b64 } });
            });
        }
        const requestBody = {
            contents: [{ role: "user", parts: parts }],
             safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        };
        lastRequestBody = { contents: requestBody.contents };

        GM_xmlhttpRequest({
            method: 'POST', url: `https://generativelanguage.googleapis.com/v1beta/models/${settings.Gemini.model}:generateContent?key=${settings.Gemini.apiKey}`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(requestBody), timeout: 60000,
            onload: (response) => {
                let answer = "Помилка отримання відповіді від Gemini.";
                if (response.status === 200) {
                    try {
                        const responseData = JSON.parse(response.responseText);
                        if (responseData.candidates && responseData.candidates[0].content && responseData.candidates[0].content.parts && responseData.candidates[0].content.parts[0]) {
                            answer = responseData.candidates[0].content.parts[0].text.trim();
                        } else if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
                            answer = `Запит заблоковано Gemini: ${responseData.promptFeedback.blockReason}`;
                        }
                    } catch(e) { console.error("Gemini JSON parse error", e); }
                } else {
                    answer = `Gemini API Error: ${response.status}`;
                    console.error("Gemini Error:", response.responseText);
                }
                document.getElementById('ollama-answer-content').textContent = answer;
                isProcessing = false;
            },
            onerror: () => { isProcessing = false; document.getElementById('ollama-answer-content').textContent = "Помилка мережі (Gemini)."; },
            ontimeout: () => { isProcessing = false; document.getElementById('ollama-answer-content').textContent = "Тайм-аут запиту (Gemini)."; }
        });
    }

    function getAnswerFromMistralAI(questionText, optionsText, allBase64Images, isMultiQuiz) {
        if (!settings.MistralAI.apiKey || !settings.MistralAI.model) {
            document.getElementById('ollama-answer-content').textContent = "API Ключ або модель Mistral AI не вказані.";
            isProcessing = false; return;
        }
        let instruction = settings.promptPrefix;
        if (isMultiQuiz) instruction += '\nЦе питання може мати ДЕКІЛЬКА правильних відповідей. Перерахуй їх.';
        let userTextContent = `Запитання: ${questionText}`;
        if (optionsText) userTextContent += `\n\nВаріанти відповідей:\n${optionsText}`;

        const contentForUserMessage = [{ type: 'text', text: userTextContent }];
        if (allBase64Images && allBase64Images.length > 0) {
            allBase64Images.forEach(img_b64 => {
                // Mistral API expects image_url for their "pixtral" like models.
                // For other models, this part might be ignored or cause error if not supported.
                contentForUserMessage.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img_b64}` } });
            });
        }

        const requestBody = {
            model: settings.MistralAI.model,
            messages: [
                { role: 'system', content: instruction },
                { role: 'user', content: contentForUserMessage }
            ],
            max_tokens: 500
        };
        lastRequestBody = { messages: requestBody.messages };

        GM_xmlhttpRequest({
            method: 'POST', url: 'https://api.mistral.ai/v1/chat/completions',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.MistralAI.apiKey}` },
            data: JSON.stringify(requestBody), timeout: 60000,
            onload: (response) => {
                let answer = "Помилка отримання відповіді від Mistral AI.";
                if (response.status === 200) {
                     try { answer = JSON.parse(response.responseText).choices[0].message.content.trim(); }
                     catch(e) { console.error("Mistral AI JSON parse error", e); }
                } else {
                    answer = `Mistral AI API Error: ${response.status}`;
                    console.error("Mistral AI Error:", response.responseText);
                }
                document.getElementById('ollama-answer-content').textContent = answer;
                isProcessing = false;
            },
            onerror: () => { isProcessing = false; document.getElementById('ollama-answer-content').textContent = "Помилка мережі (Mistral AI)."; },
            ontimeout: () => { isProcessing = false; document.getElementById('ollama-answer-content').textContent = "Тайм-аут запиту (Mistral AI)."; }
        });
    }


    function forceProcessQuestion() {
        lastProcessedText = '';
        processQuestion();
    }

    function processQuestion() {
        if (isProcessing) return;
        const questionTextElement = document.querySelector('.test-content-text-inner');
        if (!questionTextElement) return;
        const currentText = questionTextElement.innerText.trim();
        if (currentText === lastProcessedText || currentText === '') return;

        isProcessing = true;
        lastProcessedText = currentText;

        const mainImageElement = document.querySelector('.test-content-image img');
        const isMultiQuiz = document.querySelector("div[ng-if*='multiquiz']") !== null;
        const optionElements = document.querySelectorAll('.test-option');
        let allImageUrls = [];
        if (mainImageElement && mainImageElement.src) allImageUrls.push(mainImageElement.src);

        let optionLabels = [];
        optionElements.forEach((opt, index) => {
            const label = `Варіант ${index + 1}`;
            const imageDiv = opt.querySelector('.question-option-image');
            const textDiv = opt.querySelector('.question-option-inner-content');
            if (imageDiv && imageDiv.style.backgroundImage) {
                const urlMatch = imageDiv.style.backgroundImage.match(/url\("?(.+?)"?\)/);
                if (urlMatch && urlMatch[1]) {
                    allImageUrls.push(urlMatch[1]);
                    optionLabels.push(`${label} (зображення)`);
                }
            } else if (textDiv) {
                optionLabels.push(textDiv.innerText.trim());
            }
        });
        const optionsText = optionLabels.join('\n');
        const imagePromises = allImageUrls.map(url => new Promise(resolve => imageToBase64(url, resolve)));
        Promise.all(imagePromises).then(base64Images => {
            const validImages = base64Images.filter(img => img !== null);
            getAnswer(currentText, optionsText, validImages, isMultiQuiz);
        });
    }

    // --- OBSERVER ---
    const observerTarget = document.querySelector('body');
    if (observerTarget) {
        const observer = new MutationObserver(() => processQuestion());
        observer.observe(observerTarget, { childList: true, subtree: true });
    }

    // Initial load
    populateSettings();
    if (settings.activeService === 'Ollama') {
        fetchModels();
    }
})();
