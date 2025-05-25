// ==UserScript==
// @name         xdAnswers
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  A script, that helps in tests. Works with Ollama.
// @author       aartzz
// @match        *://naurok.com.ua/test/testing/*
// @connect      localhost
// @connect      *
// @icon         data:image/png;base64,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
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const DEFAULT_SETTINGS = {
        host: 'http://localhost:11434',
        model: '',
        promptPrefix: 'Я даю питання з варіантами відповіді. Дай відповідь на це питання, прямо, без пояснень.'
    };

    let settings = {
        host: GM_getValue('ollama_host', DEFAULT_SETTINGS.host),
        model: GM_getValue('ollama_model', DEFAULT_SETTINGS.model),
        promptPrefix: GM_getValue('ollama_prompt_prefix', DEFAULT_SETTINGS.promptPrefix)
    };

    let isProcessing = false;
    let availableModels = [];
    let lastProcessedText = '';
    let lastRequestBody = null;

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
            overflow: hidden; transition: all 0.3s ease;
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
        .ollama-helper-content::-webkit-scrollbar { width: 8px; }
        .ollama-helper-content::-webkit-scrollbar-track { background: var(--futuristic-bg); }
        .ollama-helper-content::-webkit-scrollbar-thumb { background-color: var(--futuristic-border); border-radius: 10px; border: 2px solid var(--futuristic-bg); }
        .ollama-settings-button {
            position: fixed; bottom: 20px; right: 380px; width: 40px; height: 40px; background-color: var(--futuristic-bg);
            border: 2px solid var(--futuristic-border); border-radius: 50%; box-shadow: var(--futuristic-glow); color: var(--futuristic-text);
            font-size: 20px; cursor: pointer; z-index: 9999; display: flex; align-items: center; justify-content: center;
        }
        .ollama-settings-panel {
            display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px;
            background-color: var(--futuristic-bg); border: 2px solid var(--futuristic-border); box-shadow: var(--futuristic-glow);
            border-radius: 10px; z-index: 10000; padding: 20px; color: var(--futuristic-text); font-family: var(--futuristic-font);
        }
        .ollama-settings-panel h3 { text-align: center; margin-top: 0; color: var(--futuristic-border); }
        .ollama-settings-panel .form-group { margin-bottom: 15px; }
        .ollama-settings-panel label { display: block; margin-bottom: 5px; }
        #refresh-models-icon {
            cursor: pointer; margin-left: 10px; display: inline-block;
            transition: transform 0.5s ease;
        }
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
        <div class="ollama-helper-header">
            <span class="ollama-header-title">xdAnswers</span>
            <div class="ollama-header-buttons">
                <button id="show-request-btn" title="Показати запит до ШІ">ℹ️</button>
                <button id="refresh-answer-btn" title="Оновити відповідь">🔄</button>
            </div>
        </div>
        <div class="ollama-helper-content" id="ollama-answer-content">Очікую на запитання...</div>
    `;
    document.body.appendChild(helperContainer);

    const settingsButton = document.createElement('div');
    settingsButton.className = 'ollama-settings-button';
    settingsButton.innerHTML = '⚙️';
    document.body.appendChild(settingsButton);

    const settingsPanel = document.createElement('div');
    settingsPanel.className = 'ollama-settings-panel';
    settingsPanel.innerHTML = `
        <span class="close-btn" id="close-settings-btn">&times;</span>
        <h3>Налаштування</h3>
        <div class="form-group">
            <label for="ollama-host">Ollama Host:</label>
            <input type="text" id="ollama-host">
        </div>
        <div class="form-group">
            <label for="ollama-model">
                Модель: <span id="refresh-models-icon" title="Оновити список моделей">🔄</span>
            </label>
            <select id="ollama-model"></select>
        </div>
        <div class="form-group">
            <label for="ollama-prompt-prefix">Уточнення надання відповіді (промпт):</label>
            <textarea id="ollama-prompt-prefix"></textarea>
        </div>
        <button id="save-settings-btn">Зберегти</button>
    `;
    document.body.appendChild(settingsPanel);

    // --- UI LOGIC ---
    settingsButton.onclick = () => { settingsPanel.style.display = 'block'; };
    document.getElementById('close-settings-btn').onclick = () => { settingsPanel.style.display = 'none'; };
    document.getElementById('refresh-answer-btn').onclick = () => forceProcessQuestion();
    document.getElementById('show-request-btn').onclick = () => {
        if (lastRequestBody && lastRequestBody.prompt) {
            alert('Промпт, відправлений до ШІ:\n\n' + lastRequestBody.prompt);
        } else {
            alert('Ще не було відправлено жодного запиту.');
        }
    };
    document.getElementById('ollama-host').value = settings.host;
    document.getElementById('ollama-prompt-prefix').value = settings.promptPrefix;
    document.getElementById('save-settings-btn').onclick = () => {
        const oldPromptPrefix = settings.promptPrefix;
        const newPromptPrefix = document.getElementById('ollama-prompt-prefix').value;
        settings.host = document.getElementById('ollama-host').value;
        settings.model = document.getElementById('ollama-model').value;
        settings.promptPrefix = newPromptPrefix;
        GM_setValue('ollama_host', settings.host);
        GM_setValue('ollama_model', settings.model);
        GM_setValue('ollama_prompt_prefix', settings.promptPrefix);
        alert('Налаштування збережено!');
        settingsPanel.style.display = 'none';
        if (oldPromptPrefix !== newPromptPrefix) forceProcessQuestion();
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
            if (model.name === settings.model) option.selected = true;
            select.appendChild(option);
        });
    }

    // --- API & CORE LOGIC ---
    function fetchModels(onComplete) {
        GM_xmlhttpRequest({
            method: 'GET', url: `${settings.host}/api/tags`,
            onload: function(response) {
                if (response.status === 200) {
                    availableModels = JSON.parse(response.responseText).models;
                    if (availableModels.length > 0 && (!settings.model || !availableModels.some(m => m.name === settings.model))) {
                        settings.model = availableModels[0].name;
                        GM_setValue('ollama_model', settings.model);
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
        if (!settings.model) {
            document.getElementById('ollama-answer-content').innerHTML = "Помилка: модель не обрана.";
            isProcessing = false; return;
        }
        let instruction = settings.promptPrefix;
        if (isMultiQuiz) {
            instruction += '\nЦе питання може мати ДЕКІЛЬКА правильних відповідей. Перерахуй їх.';
        }
        let prompt = `${instruction}\n\nЗапитання: ${questionText}`;
        if (optionsText) {
            prompt += `\n\nВаріанти відповідей:\n${optionsText}`;
        }
        const requestBody = { model: settings.model, prompt: prompt, stream: false };
        if (allBase64Images && allBase64Images.length > 0) {
            requestBody.images = allBase64Images;
        }
        lastRequestBody = { ...requestBody };
        GM_xmlhttpRequest({
            method: 'POST', url: `${settings.host}/api/generate`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(requestBody), timeout: 60000,
            onload: function(response) {
                if (response.status === 200) {
                    const data = JSON.parse(response.responseText);
                    document.getElementById('ollama-answer-content').textContent = data.response.trim();
                } else {
                    document.getElementById('ollama-answer-content').innerHTML = `Помилка від API: ${response.status}`;
                }
                isProcessing = false;
            },
            onerror: () => {
                document.getElementById('ollama-answer-content').innerHTML = "Помилка відповіді від Ollama API.";
                isProcessing = false;
            },
            ontimeout: () => {
                document.getElementById('ollama-answer-content').innerHTML = "Тайм-аут запиту до Ollama.";
                isProcessing = false;
            }
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
        document.getElementById('ollama-answer-content').innerHTML = '<div class="loader"></div>';

        const mainImageElement = document.querySelector('.test-content-image img');
        const isMultiQuiz = document.querySelector("div[ng-if*='multiquiz']") !== null;
        const optionElements = document.querySelectorAll('.test-option');

        let allImageUrls = [];
        if (mainImageElement && mainImageElement.src) {
            allImageUrls.push(mainImageElement.src);
        }

        let optionLabels = [];
        optionElements.forEach((opt, index) => {
            const imageDiv = opt.querySelector('.question-option-image');
            const textDiv = opt.querySelector('.question-option-inner-content');

            if (imageDiv && imageDiv.style.backgroundImage) {
                const urlMatch = imageDiv.style.backgroundImage.match(/url\("?(.+?)"?\)/);
                if (urlMatch && urlMatch[1]) {
                    allImageUrls.push(urlMatch[1]);
                    // --- CHANGE: Only label image options with a number ---
                    const label = `Варіант ${index + 1}`;
                    optionLabels.push(`${label} (зображення)`);
                }
            } else if (textDiv) {
                // --- CHANGE: Add raw text for text options without a label ---
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

    fetchModels();
})();
