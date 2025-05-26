// content.js
// Повна версія, адаптована для роботи з popup-налаштуваннями
(async function() {
    'use strict';

    // --- ДОПОМІЖНІ ФУНКЦІЇ, ЩО ЗАМІНЮЮТЬ GM_* ---

    /**
     * Надсилає запит через фоновий скрипт (background.js).
     * @param {object} options - Параметри запиту (url, method, headers, data, etc.).
     * @returns {Promise<object>} - Проміс, що повертає відповідь.
     */
    function makeRequest(options) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'fetch', payload: options }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    resolve(response);
                } else {
                    const errorDetails = response.details ? `\nDetails: ${response.details}` : '';
                    reject(new Error((response.error || 'Unknown error') + errorDetails));
                }
            });
        });
    }

    /**
     * Додає стилі на сторінку.
     * @param {string} css - Рядок CSS для додавання.
     */
    function addStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    // --- КОНФІГУРАЦІЯ ---
    const DEFAULT_SETTINGS = {
        activeService: 'MistralAI',
        Ollama: { host: '', model: '' },
        OpenAI: { apiKey: '', model: 'gpt-4o' },
        Gemini: { apiKey: '', model: 'gemini-2.0-flash' },
        MistralAI: { apiKey: '0RBrYMEMvvazK5iZ9sckIdLSoBnv7Yuj', model: 'pixtral-large-2411' },
        promptPrefix: 'Я даю питання з варіантами відповіді. Дай відповідь на це питання, прямо, без пояснень.'
    };

    /**
     * Асинхронно завантажує налаштування зі сховища розширення.
     * @returns {Promise<object>} - Об'єкт з налаштуваннями.
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
        const validServices = ['Ollama', 'OpenAI', 'Gemini', 'MistralAI'];
        if (!validServices.includes(loadedSettings.activeService)) {
            loadedSettings.activeService = DEFAULT_SETTINGS.activeService;
        }
        return loadedSettings;
    }

    let settings = await loadSettings();

    // --- ЗМІННІ СТАНУ ---
    let isProcessing = false;
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

    // --- СТИЛІ (тільки для головного вікна-помічника) ---
    addStyle(`
        :root {
            --futuristic-bg: #0a0a14;
            --futuristic-border: #00ffff;
            --futuristic-text: #00ff9d;
            --futuristic-glow: 0 0 5px var(--futuristic-border), 0 0 10px var(--futuristic-border), 0 0 15px var(--futuristic-border);
            --futuristic-font: 'Courier New', Courier, monospace;
        }
        .ollama-helper-container {
            position: fixed;
            width: ${defaultHelperState.width};
            height: ${defaultHelperState.height};
            max-height: ${defaultHelperState.maxHeight};
            bottom: ${defaultHelperState.bottom};
            right: ${defaultHelperState.right};
            top: ${defaultHelperState.top};
            left: ${defaultHelperState.left};
            background-color: var(--futuristic-bg);
            border: 2px solid var(--futuristic-border);
            border-radius: 10px;
            box-shadow: var(--futuristic-glow);
            color: var(--futuristic-text);
            font-family: var(--futuristic-font);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: width 0.3s ease, height 0.3s ease, max-height 0.3s ease, top 0.3s ease, left 0.3s ease, bottom 0.3s ease, right 0.3s ease;
        }
        .ollama-helper-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 10px;
            background-color: #001f3f;
            border-bottom: 1px solid var(--futuristic-border);
            cursor: move;
        }
        .ollama-header-title {
            font-weight: bold;
            margin-right: auto;
        }
        .ollama-header-buttons {
            display: flex;
            align-items: center;
        }
        .ollama-header-buttons button {
            background: none;
            border: 1px solid var(--futuristic-border);
            color: var(--futuristic-border);
            border-radius: 5px;
            cursor: pointer;
            margin-left: 5px;
            font-size: 12px;
            width: 28px;
            height: 22px;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .ollama-header-buttons button:hover {
            background-color: var(--futuristic-border);
            color: var(--futuristic-bg);
        }
        .ollama-helper-content {
            padding: 15px;
            overflow-y: auto;
            flex-grow: 1;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .ollama-helper-content ul {
            margin-left: 20px;
            padding-left: 10px;
            list-style-type: disc;
        }
        .ollama-helper-content li {
            margin-bottom: 4px;
        }
        .ollama-helper-content::-webkit-scrollbar { width: 8px; }
        .ollama-helper-content::-webkit-scrollbar-track { background: var(--futuristic-bg); }
        .ollama-helper-content::-webkit-scrollbar-thumb {
            background-color: var(--futuristic-border);
            border-radius: 10px;
            border: 2px solid var(--futuristic-bg);
        }
        .loader {
            border: 4px solid #f3f3f3;
            border-top: 4px solid var(--futuristic-border);
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        .loader-inline {
            border: 2px solid #f3f3f3;
            border-top: 2px solid var(--futuristic-border);
            border-radius: 50%;
            width: 12px;
            height: 12px;
            animation: spin 1s linear infinite;
            display: inline-block;
            margin-left: 5px;
            vertical-align: middle;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `);

    // --- ЗМІННІ ДЛЯ UI ЕЛЕМЕНТІВ ---
    let showRequestBtn, refreshAnswerBtn, resizeHelperBtn, copyAnswerBtn,
        answerContentDiv, dragHeader, helperContainer;

    // --- СТВОРЕННЯ UI ---
    function createUI() {
        helperContainer = document.createElement('div');
        helperContainer.className = 'ollama-helper-container';
        // HTML тепер без кнопки налаштувань
        helperContainer.innerHTML = `
            <div class="ollama-helper-header" id="ollama-helper-drag-header">
                <span class="ollama-header-title">xdAnswers</span>
                <div class="ollama-header-buttons">
                    <button id="resize-helper-btn" title="Resize">➕</button>
                    <button id="copy-answer-btn" title="Copy Answer">📋</button>
                    <button id="show-request-btn" title="Show AI Request">ℹ️</button>
                    <button id="refresh-answer-btn" title="Refresh Answer">🔄</button>
                </div>
            </div>
            <div class="ollama-helper-content" id="ollama-answer-content">Waiting for question...</div>`;
        document.body.appendChild(helperContainer);

        // Прив'язуємо змінні до елементів
        answerContentDiv = document.getElementById('ollama-answer-content');
        dragHeader = document.getElementById('ollama-helper-drag-header');
        resizeHelperBtn = document.getElementById('resize-helper-btn');
        copyAnswerBtn = document.getElementById('copy-answer-btn');
        showRequestBtn = document.getElementById('show-request-btn');
        refreshAnswerBtn = document.getElementById('refresh-answer-btn');

        attachHelperEventListeners();
    }

    // --- ОБРОБНИКИ ПОДІЙ ---
    function attachDragLogic() {
        if (!dragHeader) return;
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
                helperContainer.style.right = 'auto';
                helperContainer.style.bottom = 'auto';
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
                helperContainer.style.right = 'auto';
                helperContainer.style.bottom = 'auto';
            }
        };
        document.ontouchend = function() {
            if (isDragging) { isDragging = false; document.body.style.userSelect = ''; }
        };
    }

    function attachHelperEventListeners() {
        if (!resizeHelperBtn) return;
        attachDragLogic();
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
        copyAnswerBtn.onclick = async () => {
            const textToCopy = answerContentDiv.innerText;
            if (textToCopy && textToCopy !== 'Waiting for question...' && !answerContentDiv.querySelector('.loader')) {
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    copyAnswerBtn.textContent = '✅';
                } catch (err) {
                    console.error('Failed to copy text: ', err);
                    copyAnswerBtn.textContent = '❌';
                }
                setTimeout(() => { copyAnswerBtn.textContent = '📋'; }, 1500);
            } else {
                copyAnswerBtn.textContent = '❌';
                setTimeout(() => { copyAnswerBtn.textContent = '📋'; }, 1500);
            }
        };
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
        refreshAnswerBtn.onclick = () => forceProcessQuestion();
    }
    
    // --- ПРОСЛУХОВУВАЧ ПОВІДОМЛЕНЬ ВІД POPUP ---
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        if (message.type === "settingsUpdated") {
            console.log("Settings updated, reloading and reprocessing...");
            settings = await loadSettings();
            forceProcessQuestion();
            sendResponse({ status: "ok" });
        }
        return true; // для асинхронної відповіді
    });

    // --- API & ОСНОВНА ЛОГІКА ---
    async function imageToBase64(url) {
        try {
            const response = await makeRequest({
                method: 'GET',
                url: url,
                responseType: 'blob'
            });
            // response.data буде містити Data URL
            return response.data ? response.data.split(',', 2)[1] : null;
        } catch (error) {
            console.error("Error converting image to base64 for", url, error);
            return null;
        }
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

    // --- ГОЛОВНИЙ ДИСПЕТЧЕР ---
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
                responseText = 'Unknown service selected.';
            }
        } catch (error) {
            console.error(`Error getting answer from ${service}:`, error);
            responseText = `Service error ${service}. Check console for details.`;
        }
        return responseText;
    }

    // --- ОБРОБНИКИ API ДЛЯ КОНКРЕТНИХ СЕРВІСІВ ---
    async function getAnswerFromOllama(instruction, questionText, optionsText, base64Images) {
        if (!settings.Ollama.model) return "Ollama model not selected.";
        let prompt = `${instruction}\n\nQuestion: ${questionText}`;
        if (optionsText) prompt += `\n\nOptions:\n${optionsText}`;
        const requestBody = { model: settings.Ollama.model, prompt: prompt, stream: false };
        if (base64Images && base64Images.length > 0) requestBody.images = base64Images;
        lastRequestBody = { ...requestBody };

        try {
            const response = await makeRequest({
                method: 'POST',
                url: `${settings.Ollama.host}/api/generate`,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(requestBody),
                timeout: 60000
            });
            return JSON.parse(response.data).response.trim();
        } catch (error) {
            console.error("Ollama API Error:", error);
            return `Ollama API Error: ${error.message}`;
        }
    }

    async function getAnswerFromOpenAI(systemInstruction, questionText, optionsText, base64Images) {
        if (!settings.OpenAI.apiKey || !settings.OpenAI.model) return "API Key or Model for OpenAI not specified.";
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
        try {
            const response = await makeRequest({
                method: 'POST',
                url: 'https://api.openai.com/v1/chat/completions',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.OpenAI.apiKey}` },
                data: JSON.stringify(requestBody),
                timeout: 60000
            });
            return JSON.parse(response.data).choices[0].message.content.trim();
        } catch (error) {
            console.error("OpenAI API Error:", error);
            return `OpenAI API Error: ${error.message}`;
        }
    }

    async function getAnswerFromGemini(systemInstructionText, questionText, optionsText, base64Images) {
        if (!settings.Gemini.apiKey || !settings.Gemini.model) return "API Key or Model for Gemini not specified.";
        let userQueryText = `Question: ${questionText}`;
        if (optionsText) userQueryText += `\n\nOptions:\n${optionsText}`;
        const userParts = [{ text: userQueryText }];
        if (base64Images && base64Images.length > 0) {
            base64Images.forEach(img_b64 => userParts.push({ inline_data: { mime_type: 'image/jpeg', data: img_b64 } }));
        }
        const requestBody = {
            contents: [{ role: "user", parts: userParts }],
            systemInstruction: { parts: [{ text: systemInstructionText }] },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        };
        lastRequestBody = { contents: requestBody.contents, systemInstruction: requestBody.systemInstruction };
        try {
            const response = await makeRequest({
                method: 'POST',
                url: `https://generativelanguage.googleapis.com/v1beta/models/${settings.Gemini.model}:generateContent?key=${settings.Gemini.apiKey}`,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(requestBody),
                timeout: 60000
            });
            const d = JSON.parse(response.data);
            if (d.candidates && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0]) return d.candidates[0].content.parts[0].text.trim();
            if (d.promptFeedback && d.promptFeedback.blockReason) return `Request blocked by Gemini: ${d.promptFeedback.blockReason}`;
            if (d.candidates && d.candidates[0].finishReason !== "STOP") return `Gemini finished with reason: ${d.candidates[0].finishReason}`;
            if (!d.candidates || d.candidates.length === 0) return "Gemini provided no answer candidates.";
            return "Unknown Gemini response.";
        } catch (error) {
            console.error("Gemini API Error:", error);
            return `Gemini API Error: ${error.message}`;
        }
    }

    async function getAnswerFromMistralAI(systemInstruction, questionText, optionsText, base64Images) {
        if (!settings.MistralAI.apiKey || !settings.MistralAI.model) return "API Key or Model for Mistral AI not specified.";
        let userTextContent = `Question: ${questionText}`;
        if (optionsText) userTextContent += `\n\nOptions:\n${optionsText}`;
        const contentForUserMessage = [{ type: 'text', text: userTextContent }];
        if (base64Images && base64Images.length > 0) {
            base64Images.forEach(img_b64 => contentForUserMessage.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img_b64}` } }));
        }
        const requestBody = {
            model: settings.MistralAI.model,
            messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: contentForUserMessage }],
            max_tokens: 500
        };
        lastRequestBody = { messages: requestBody.messages };
        try {
            const response = await makeRequest({
                method: 'POST',
                url: 'https://api.mistral.ai/v1/chat/completions',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.MistralAI.apiKey}` },
                data: JSON.stringify(requestBody),
                timeout: 60000
            });
            return JSON.parse(response.data).choices[0].message.content.trim();
        } catch (error) {
            console.error("MistralAI API Error:", error);
            return `MistralAI API Error: ${error.message}`;
        }
    }

    // --- ОБРОБКА ДЛЯ КОНКРЕТНИХ САЙТІВ ---
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
            } else if (location.hostname.includes('naurok.com.ua') || location.hostname.includes('naurok.ua')) {
                if (isProcessing) return;
                processNaurokQuestion();
            }
        }, 1000);
    }

    async function processNaurokQuestion() {
        const questionTextElement = document.querySelector('.test-content-text-inner');
        if (!questionTextElement) return;
        const currentText = questionTextElement.innerText.trim();
        if (currentText === lastProcessedNaurokText || currentText === '') return;

        isProcessing = true;
        lastProcessedNaurokText = currentText;
        answerContentDiv.innerHTML = '<div class="loader"></div>';

        const mainImageElement = document.querySelector('.test-content-image img');
        const isMultiQuiz = document.querySelector(".question-option-inner-multiple") !== null ||
            document.querySelector("div[ng-if*='multiquiz']") !== null;

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
        const imagePromises = allImageUrls.map(url => imageToBase64(url));

        try {
            const base64Images = await Promise.all(imagePromises);
            const validImages = base64Images.filter(img => img !== null);
            const questionData = {
                text: currentText,
                optionsText: optionsText,
                base64Images: validImages,
                isMultiQuiz: isMultiQuiz,
                questionType: isMultiQuiz ? "checkbox" : "radio"
            };
            const answer = await getAnswer(questionData);
            answerContentDiv.innerHTML = formatAIResponse(answer);
        } catch (err) {
            console.error("Image processing error on Naurok", err);
            answerContentDiv.innerHTML = formatAIResponse("Image processing error (Naurok).");
        } finally {
            isProcessing = false;
        }
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

        let accumulatedAnswersHTML = answerContentDiv.innerHTML;
        if (accumulatedAnswersHTML.includes('Updating...') ||
            accumulatedAnswersHTML.includes('Waiting for question...') ||
            accumulatedAnswersHTML.includes('No questions found on page.') ||
            accumulatedAnswersHTML.includes('All questions on this page have been processed.')) {
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
            if (isRadioQuiz) questionType = "radio";
            else if (isCheckboxQuiz) questionType = "checkbox";
            else if (isShortText) questionType = "short_text";
            else if (isParagraph) questionType = "paragraph";

            let allImageUrls = [];
            if (mainImageElement && mainImageElement.src) allImageUrls.push(mainImageElement.src);
            let optionLabels = [];
            if (isRadioQuiz || isCheckboxQuiz) {
                const gformOptionContainers = questionBlock.querySelectorAll('div[role="radiogroup"] .docssharedWizToggleLabeledContainer, div[role="listbox"] .docssharedWizToggleLabeledContainer, .Y6Myld div[role="list"] .docssharedWizToggleLabeledContainer, .UHZXDe');
                gformOptionContainers.forEach((optContainer, optIdx) => {
                    const textEl = optContainer.querySelector('span.aDTYNe, span.snByac');
                    const imgEl = optContainer.querySelector('img.QU5LQc');
                    if (imgEl && imgEl.src) {
                        allImageUrls.push(imgEl.src);
                        let lblText = `Option ${optIdx + 1} (image ${allImageUrls.length})`;
                        if (textEl && textEl.innerText.trim()) {
                            lblText = `${textEl.innerText.trim()} (labeled as Option ${optIdx + 1}, is image ${allImageUrls.length})`;
                        }
                        optionLabels.push(lblText);
                    } else if (textEl && textEl.innerText.trim()) {
                        optionLabels.push(textEl.innerText.trim());
                    }
                });
            }
            const optionsText = optionLabels.length > 0 ? optionLabels.join('\n') : null;
            const imagePromises = allImageUrls.map(url => imageToBase64(url));
            const base64Images = (await Promise.all(imagePromises)).filter(img => img !== null);

            const questionData = {
                text: currentQuestionText,
                optionsText: optionsText,
                base64Images: base64Images,
                isMultiQuiz: isCheckboxQuiz,
                questionType: questionType
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
            if (accumulatedAnswersHTML.trim() === '') {
                answerContentDiv.innerHTML = 'All questions on this page have been processed. Press 🔄 to reprocess all.';
            }
        } else if (questionBlocks.length === 0 && accumulatedAnswersHTML.trim() === '') {
            answerContentDiv.innerHTML = 'No questions found on the page.';
        }
        isProcessing = false;
    }

    // --- СПОСТЕРІГАЧ ---
    const observerTarget = document.body;
    if (observerTarget) {
        const observer = new MutationObserver(handlePageContentChange);
        observer.observe(observerTarget, { childList: true, subtree: true });
    }

    // --- ІНІЦІАЛІЗАЦІЯ ---
    createUI();
    // Не потрібно завантажувати моделі чи налаштування при старті,
    // оскільки це відбувається в popup або при отриманні повідомлення.

})();