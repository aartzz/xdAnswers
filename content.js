(async function() {
    'use strict';

    // --- Помічники ---
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

    let styleElement = null;
    function addStyle(css) {
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'xdAnswers-styles';
            document.head.appendChild(styleElement);
        }
        if (styleElement.textContent !== css) {
            styleElement.textContent = css;
        }
    }

    // --- Конфігурація та Налаштування ---
    const DEFAULT_SETTINGS = {
        activeService: 'MistralAI',
        Ollama: { host: '', model: '' },
        OpenAI: { apiKey: '', model: 'gpt-4o' },
        Gemini: { apiKey: '', model: 'gemini-2.0-flash' },
        MistralAI: { apiKey: '0RBrYMEMvvazK5iZ9sckIdLSoBnv7Yuj', model: 'pixtral-large-2411' },
        promptPrefix: 'Я даю питання з варіантами відповіді. Дай відповідь на це питання, прямо, без пояснень.'
    };

    async function loadSettings() {
        const data = await chrome.storage.local.get('xdAnswers_settings');
        let loadedSettings = { ...DEFAULT_SETTINGS };
        if (data.xdAnswers_settings) {
            try {
                const parsedSettings = JSON.parse(data.xdAnswers_settings);
                loadedSettings = { ...loadedSettings, ...parsedSettings };
                for (const serviceKey in DEFAULT_SETTINGS) {
                    if (typeof DEFAULT_SETTINGS[serviceKey] === 'object' && DEFAULT_SETTINGS[serviceKey] !== null) {
                        loadedSettings[serviceKey] = { ...DEFAULT_SETTINGS[serviceKey], ...(loadedSettings[serviceKey] || {}) };
                    }
                }
            } catch (e) {
                console.error("xdAnswers: Failed to parse settings, using defaults.", e);
            }
        }
        const validServices = ['Ollama', 'OpenAI', 'Gemini', 'MistralAI'];
        if (!validServices.includes(loadedSettings.activeService)) {
            loadedSettings.activeService = DEFAULT_SETTINGS.activeService;
        }
        return loadedSettings;
    }

    let settings = await loadSettings();

    // --- Змінні стану ---
    let isProcessingAI = false;
    let lastProcessedNaurokText = '';
    let processedGFormQuestionIds = new Set();
    let lastRequestBody = null;
    let isDragging = false;
    let dragOffsetX, dragOffsetY;
    let observerDebounceTimeout = null;
    let isHelperWindowMaximized = false;
    let lastProcessedVseosvitaKey = '';
    let currentHelperParentNode = null;
    let isManuallyPositioned = false;
    let isExtensionModifyingDOM = false; // Головний прапорець для блокування MutationObserver

    const defaultHelperState = {
        width: '350px', height: 'auto', maxHeight: '400px',
        bottom: '20px', right: '20px', top: 'auto', left: 'auto'
    };
    const maximizedHelperState = {
        width: '70vw', height: '70vh', maxHeight: 'none',
        top: '15vh', left: '15vw', bottom: 'auto', right: 'auto'
    };

    // --- UI елементи ---
    let showRequestBtn, refreshAnswerBtn, resizeHelperBtn, copyAnswerBtn,
        answerContentDiv, dragHeader, helperContainer;

    // --- Стилі та UI ---
    function updateHelperBaseStyles() {
         addStyle(`
            :root {
                --futuristic-bg: #0a0a14;
                --futuristic-border: #00ffff;
                --futuristic-text: #00ff9d;
                --futuristic-glow: 0 0 5px var(--futuristic-border), 0 0 10px var(--futuristic-border), 0 0 15px var(--futuristic-border);
                --futuristic-font: 'Courier New', Courier, monospace;
            }
            .ollama-helper-container {
                all: initial !important; 
                position: fixed !important; 
                width: ${isHelperWindowMaximized ? maximizedHelperState.width : defaultHelperState.width} !important;
                height: ${isHelperWindowMaximized ? maximizedHelperState.height : defaultHelperState.height} !important;
                max-height: ${isHelperWindowMaximized ? maximizedHelperState.maxHeight : defaultHelperState.maxHeight} !important;
                background-color: var(--futuristic-bg) !important;
                border: 2px solid var(--futuristic-border) !important;
                border-radius: 10px !important;
                box-shadow: var(--futuristic-glow) !important;
                color: var(--futuristic-text) !important;
                font-family: var(--futuristic-font) !important;
                font-size: 14px !important; 
                line-height: 1.3 !important; 
                z-index: 2147483647 !important; 
                display: flex !important; 
                flex-direction: column !important;
                overflow: hidden !important;
            }
            .ollama-helper-container *, .ollama-helper-container *:before, .ollama-helper-container *:after {
                all: revert !important; 
                font-family: var(--futuristic-font) !important; 
                font-size: inherit !important; 
                line-height: inherit !important; 
                color: var(--futuristic-text) !important;
                box-sizing: border-box !important; 
                margin: 0 !important; 
                padding: 0 !important;
                background: none !important;
                border: none !important; 
            }
            .ollama-helper-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                padding: 8px 10px !important;
                background-color: #001f3f !important;
                border-bottom: 1px solid var(--futuristic-border) !important;
                cursor: move !important;
                user-select: none; 
                -webkit-user-select: none; 
                -ms-user-select: none; 
            }
            .ollama-header-title {
                font-weight: bold !important;
                margin-right: auto !important;
            }
            .ollama-header-buttons {
                display: flex !important;
                align-items: center !important;
            }
            .ollama-header-buttons button {
                all: revert !important;
                background: none !important;
                border: 1px solid var(--futuristic-border) !important;
                color: var(--futuristic-text) !important; 
                font-family: var(--futuristic-font) !important; 
                font-size: 12px !important; 
                border-radius: 5px !important;
                cursor: pointer !important;
                margin-left: 5px !important;
                width: 28px !important;
                height: 22px !important;
                padding: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                line-height: 1 !important; 
            }
            .ollama-header-buttons button:hover {
                background-color: var(--futuristic-border) !important;
                color: var(--futuristic-bg) !important;
            }
            .ollama-helper-content {
                padding: 15px !important;
                overflow-y: auto !important;
                flex-grow: 1 !important;
                white-space: pre-wrap !important;
                word-wrap: break-word !important;
            }
            .ollama-helper-content ul {
                margin-left: 20px !important;
                padding-left: 10px !important;
                list-style-type: disc !important;
            }
            .ollama-helper-content li {
                margin-bottom: 4px !important;
            }
            .ollama-helper-content::-webkit-scrollbar { width: 8px !important; }
            .ollama-helper-content::-webkit-scrollbar-track { background: var(--futuristic-bg) !important; }
            .ollama-helper-content::-webkit-scrollbar-thumb {
                background-color: var(--futuristic-border) !important;
                border-radius: 10px !important;
                border: 2px solid var(--futuristic-bg) !important;
            }
            .loader {
                all: revert !important; box-sizing: border-box !important; border: 4px solid #f3f3f3 !important;
                border-top: 4px solid var(--futuristic-border) !important; border-radius: 50% !important;
                width: 30px !important; height: 30px !important; animation: spin 1s linear infinite !important;
                margin: 20px auto !important;
            }
            .loader-inline {
                all: revert !important; box-sizing: border-box !important; border: 2px solid #f3f3f3 !important;
                border-top: 2px solid var(--futuristic-border) !important; border-radius: 50% !important;
                width: 12px !important; height: 12px !important; animation: spin 1s linear infinite !important;
                display: inline-block !important; margin-left: 5px !important; vertical-align: middle !important;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `);
    }
    
    function createUI() {
        if (!helperContainer) { 
            helperContainer = document.createElement('div');
            helperContainer.className = 'ollama-helper-container'; 
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
        }
        
        answerContentDiv = helperContainer.querySelector('#ollama-answer-content');
        dragHeader = helperContainer.querySelector('#ollama-helper-drag-header');
        resizeHelperBtn = helperContainer.querySelector('#resize-helper-btn');
        copyAnswerBtn = helperContainer.querySelector('#copy-answer-btn');
        showRequestBtn = helperContainer.querySelector('#show-request-btn');
        refreshAnswerBtn = helperContainer.querySelector('#refresh-answer-btn');

        attachHelperEventListeners();
        updateHelperBaseStyles(); 
    }

    function attachAndPositionHelper(forcePositionRecalculation = false) {
        if (isExtensionModifyingDOM && !forcePositionRecalculation) return; 
        isExtensionModifyingDOM = true;

        if (!helperContainer) {
            createUI(); 
        }

        let determinedTargetParent = document.body;
        let useDefaultPositioning = true;

        if (location.hostname.includes('vseosvita.ua') &&
            (location.pathname.includes('/test/go-olp') || location.pathname.startsWith('/test/start/'))) {
            
            const vseosvitaFullScreenContainer = document.querySelector('.full-screen-container');
            
            if (vseosvitaFullScreenContainer && document.body.contains(vseosvitaFullScreenContainer)) {
                determinedTargetParent = vseosvitaFullScreenContainer;
                useDefaultPositioning = false; 
            } else {
                 determinedTargetParent = document.body;
                 useDefaultPositioning = true;
                 if (currentHelperParentNode !== document.body) isManuallyPositioned = false; 
            }
        } else {
            determinedTargetParent = document.body;
            useDefaultPositioning = true;
            if (currentHelperParentNode !== document.body) isManuallyPositioned = false;
        }
        
        // Переміщуємо, тільки якщо батько змінився АБО хелпер ще не в DOM
        if (!helperContainer.parentNode || helperContainer.parentNode !== determinedTargetParent) {
            if (helperContainer.parentNode) {
                helperContainer.parentNode.removeChild(helperContainer);
            }
            if (determinedTargetParent === document.querySelector('.full-screen-container') && determinedTargetParent.firstChild) {
                determinedTargetParent.insertBefore(helperContainer, determinedTargetParent.firstChild); // Вставляємо НА ПОЧАТКУ .full-screen-container
            } else {
                determinedTargetParent.appendChild(helperContainer); // Інакше в кінець
            }
            isManuallyPositioned = false; 
        } else {
             // Якщо батько той самий, але це .full-screen-container, переконуємося, що він перший
            if (determinedTargetParent === document.querySelector('.full-screen-container') && helperContainer !== determinedTargetParent.firstChild) {
                 determinedTargetParent.insertBefore(helperContainer, determinedTargetParent.firstChild);
            } else if (determinedTargetParent === document.body) {
                 determinedTargetParent.appendChild(helperContainer); // Для body завжди в кінець
            }
        }
        currentHelperParentNode = determinedTargetParent;

        helperContainer.style.setProperty('display', 'flex', 'important');
        helperContainer.style.setProperty('position', 'fixed', 'important'); 
        helperContainer.style.setProperty('z-index', '2147483647', 'important');
        
        updateHelperBaseStyles(); 

        if (!isManuallyPositioned || forcePositionRecalculation) {
            if (useDefaultPositioning) { 
                if (isHelperWindowMaximized) {
                    helperContainer.style.top = maximizedHelperState.top;
                    helperContainer.style.left = maximizedHelperState.left;
                    helperContainer.style.bottom = 'auto';
                    helperContainer.style.right = 'auto';
                } else {
                    helperContainer.style.bottom = defaultHelperState.bottom;
                    helperContainer.style.right = defaultHelperState.right;
                    helperContainer.style.top = 'auto'; 
                    helperContainer.style.left = 'auto';
                }
            } else { 
                // Для Всеосвіти, коли "вшито", прив'язуємо до правого нижнього кута
                // батьківського елемента (.full-screen-container)
                helperContainer.style.bottom = '10px'; 
                helperContainer.style.right = '10px';
                helperContainer.style.top = 'auto'; 
                helperContainer.style.left = 'auto'; 
                
                if (!isHelperWindowMaximized) { 
                     helperContainer.style.width = defaultHelperState.width; 
                     helperContainer.style.maxHeight = defaultHelperState.maxHeight;
                }
            }
            if (forcePositionRecalculation && !isDragging) isManuallyPositioned = false;
        }
        isExtensionModifyingDOM = false;
    }

    function attachDragLogic() {
        if (!dragHeader || !helperContainer) return;
        
        dragHeader.onmousedown = null; 
        document.onmousemove = null; 
        document.onmouseup = null;
        dragHeader.ontouchstart = null;
        document.ontouchmove = null;
        document.ontouchend = null;

        dragHeader.onmousedown = function(event) {
            if (event.target.tagName === 'BUTTON' || (event.target.parentElement && event.target.parentElement.tagName === 'BUTTON')) return;
            isDragging = true;
            isManuallyPositioned = true; 
            const rect = helperContainer.getBoundingClientRect();
            dragOffsetX = event.clientX - rect.left;
            dragOffsetY = event.clientY - rect.top;
            document.body.style.userSelect = 'none';
        };
        document.onmousemove = function(event) {
            if (isDragging) {
                let newTop = event.clientY - dragOffsetY;
                let newLeft = event.clientX - dragOffsetX;
                helperContainer.style.top = newTop + 'px';
                helperContainer.style.left = newLeft + 'px';
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
            isManuallyPositioned = true; 
            const touch = event.touches[0];
            const rect = helperContainer.getBoundingClientRect();
            dragOffsetX = touch.clientX - rect.left;
            dragOffsetY = touch.clientY - rect.top;
            document.body.style.userSelect = 'none';
            event.preventDefault();
        };
        document.ontouchmove = function(event) {
            if (isDragging) {
                const touch = event.touches[0];
                let newTop = touch.clientY - dragOffsetY;
                let newLeft = touch.clientX - dragOffsetX;
                helperContainer.style.top = newTop + 'px';
                helperContainer.style.left = newLeft + 'px';
                helperContainer.style.right = 'auto';
                helperContainer.style.bottom = 'auto';
            }
        };
        document.ontouchend = function() {
            if (isDragging) { isDragging = false; document.body.style.userSelect = ''; }
        };
    }

    function attachHelperEventListeners() {
        if (!helperContainer) return;
        
        resizeHelperBtn = helperContainer.querySelector('#resize-helper-btn');
        copyAnswerBtn = helperContainer.querySelector('#copy-answer-btn');
        showRequestBtn = helperContainer.querySelector('#show-request-btn');
        refreshAnswerBtn = helperContainer.querySelector('#refresh-answer-btn');
        dragHeader = helperContainer.querySelector('#ollama-helper-drag-header');

        if (!resizeHelperBtn || !dragHeader) return; 

        resizeHelperBtn.onclick = null;
        copyAnswerBtn.onclick = null;
        showRequestBtn.onclick = null;
        refreshAnswerBtn.onclick = null;

        attachDragLogic(); 

        resizeHelperBtn.onclick = () => {
            isHelperWindowMaximized = !isHelperWindowMaximized;
            isManuallyPositioned = false; 
            attachAndPositionHelper(true); 
            resizeHelperBtn.textContent = isHelperWindowMaximized ? '➖' : '➕';
        };
        copyAnswerBtn.onclick = async () => {
            if (!answerContentDiv) return;
            const textToCopy = answerContentDiv.innerText;
            if (textToCopy && textToCopy !== 'Waiting for question...' && !answerContentDiv.querySelector('.loader')) {
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    copyAnswerBtn.textContent = '✅';
                } catch (err) {
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
    
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        if (isExtensionModifyingDOM) { sendResponse({status: "dom_update_in_progress"}); return true;}

        if (message.type === "settingsUpdated") {
            settings = await loadSettings();
            forceProcessQuestion();
            sendResponse({ status: "ok" });
        } else if (message.type === "gform_url_changed") {
            handlePageContentChange(true); 
            sendResponse({ status: "ok" });
        }
        return true; 
    });

    async function imageToBase64(url) {
        try {
            const response = await makeRequest({
                method: 'GET',
                url: url,
                responseType: 'blob'
            });
            return response.data ? response.data.split(',', 2)[1] : null;
        } catch (error) {
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

    async function getAnswer(questionData) {
        const service = settings.activeService;
        let responseText = "";
        let instruction = questionData.customPromptPrefix || settings.promptPrefix;

        if (!questionData.customPromptPrefix) {
            if (questionData.questionType === "short_text" || questionData.questionType === "paragraph" || questionData.questionType === "open_ended") {
                instruction = "Дай розгорнуту відповідь на наступне відкрите питання:";
            } else if (questionData.isMultiQuiz) {
                instruction += '\nЦе питання може мати ДЕКІЛЬКА правильних відповідей. Перерахуй їх.';
            }
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
            responseText = `Service error ${service}. Check console for details.`;
        }
        return responseText;
    }

    async function getAnswerFromOllama(instruction, questionText, optionsText, base64Images) {
        if (!settings.Ollama.host || !settings.Ollama.model) return "Ollama host or model not selected.";
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
            return `MistralAI API Error: ${error.message}`;
        }
    }
    
    function forceProcessQuestion() {
        if (isExtensionModifyingDOM) return;
        processedGFormQuestionIds.clear();
        lastProcessedNaurokText = '';
        lastProcessedVseosvitaKey = '';
        if (answerContentDiv) {
             answerContentDiv.innerHTML = 'Updating...';
        } else if (helperContainer) { 
            const tempAnswerDiv = helperContainer.querySelector('#ollama-answer-content');
            if (tempAnswerDiv) tempAnswerDiv.innerHTML = 'Updating...';
        }
        handlePageContentChange(true); 
    }

    let isHandlePageContentRunning = false; 
    function handlePageContentChange(isNavigationEvent = false) {
        if (observerDebounceTimeout) clearTimeout(observerDebounceTimeout);
        
        observerDebounceTimeout = setTimeout(() => {
            if (isExtensionModifyingDOM || isHandlePageContentRunning) return; 
            isHandlePageContentRunning = true;

            if (!document.body) { 
                isHandlePageContentRunning = false;
                return; 
            }
            if (!helperContainer) createUI();


            attachAndPositionHelper(isNavigationEvent); 

            let siteProcessed = false;
            if (location.hostname.includes('docs.google.com')) {
                processGFormQuestionsSequentially();
                siteProcessed = true;
            } else if (location.hostname.includes('naurok.com.ua') || location.hostname.includes('naurok.ua')) {
                processNaurokQuestion();
                siteProcessed = true;
            } else if (location.hostname.includes('vseosvita.ua') && 
                       (location.pathname.includes('/test/go-olp') || location.pathname.startsWith('/test/start/'))) {
                processVseosvitaQuestion();
                siteProcessed = true;
            }
            
            if ((isNavigationEvent || !siteProcessed) && !document.fullscreenElement) { 
                attachAndPositionHelper();
            }
            isHandlePageContentRunning = false;
        }, isNavigationEvent ? 100 : 500); 
    }

    async function processNaurokQuestion() { 
        if (isExtensionModifyingDOM) return;
        if (isProcessingAI) return;
        if (!answerContentDiv && helperContainer) answerContentDiv = helperContainer.querySelector('#ollama-answer-content');
        if (!answerContentDiv) return;
        
        const questionTextElement = document.querySelector('.test-content-text-inner');
        if (!questionTextElement) {
            if(!document.fullscreenElement) attachAndPositionHelper(); 
            return;
        }
        const currentText = questionTextElement.innerText.trim();
        if (currentText === lastProcessedNaurokText || currentText === '') {
            if(helperContainer && getComputedStyle(helperContainer).display !== 'none' && !document.fullscreenElement) attachAndPositionHelper();
            return;
        }
        isExtensionModifyingDOM = true;
        isProcessingAI = true;
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
            answerContentDiv.innerHTML = formatAIResponse("Image processing error (Naurok).");
        } finally {
            isProcessingAI = false;
            isExtensionModifyingDOM = false;
            if(!document.fullscreenElement) attachAndPositionHelper();
        }
    }
    async function processGFormQuestionsSequentially() { 
        if (isExtensionModifyingDOM) return;
        if (isProcessingAI) return;
        if (!answerContentDiv && helperContainer) answerContentDiv = helperContainer.querySelector('#ollama-answer-content');
        if (!answerContentDiv) return;
        
        isExtensionModifyingDOM = true;
        isProcessingAI = true;

        const questionBlocks = document.querySelectorAll('div.Qr7Oae');
        if (!questionBlocks.length) {
            isProcessingAI = false;
            isExtensionModifyingDOM = false;
            if (answerContentDiv.innerHTML.includes("loader") || answerContentDiv.innerText === 'Updating...' || answerContentDiv.innerText === 'Waiting for question...') {
                answerContentDiv.innerHTML = formatAIResponse('No questions found on page.');
            }
            if(!document.fullscreenElement) attachAndPositionHelper();
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
        isProcessingAI = false;
        isExtensionModifyingDOM = false;
        if(!document.fullscreenElement) attachAndPositionHelper();
    }

    async function processVseosvitaQuestion() {
        if (isExtensionModifyingDOM) return;
        if (isProcessingAI) return;
        if (!answerContentDiv && helperContainer) answerContentDiv = helperContainer.querySelector('#ollama-answer-content');
        if (!answerContentDiv) { return; }

        const questionContainer = document.querySelector('div[id^="i-test-question-"]');
        if (!questionContainer) {
            if (!document.fullscreenElement) attachAndPositionHelper();
            return;
        }

        const questionNumberElement = document.querySelector('span.v-numbertest span.occasional_class occ1 span.occasional_class occ2'); 
        const questionTitleElement = questionContainer.querySelector('.v-test-questions-title .content-box p');
        
        const currentQuestionNumberText = questionNumberElement ? questionNumberElement.innerText.trim() : Math.random().toString(); 
        const currentQuestionTitleText = questionTitleElement ? questionTitleElement.innerText.trim() : '';
        
        const questionTextSample = currentQuestionTitleText.substring(0, 50); 
        const currentVseosvitaKey = `${currentQuestionNumberText}#${questionTextSample}`;


        if (currentVseosvitaKey === lastProcessedVseosvitaKey && currentQuestionTitleText !== '') { 
             if (helperContainer && getComputedStyle(helperContainer).display !== 'none' && !document.fullscreenElement){
                attachAndPositionHelper(); 
            }
            return;
        }
        
        isExtensionModifyingDOM = true;
        isProcessingAI = true;
        lastProcessedVseosvitaKey = currentVseosvitaKey;
        answerContentDiv.innerHTML = '<div class="loader"></div>';

        let questionTextForAI = currentQuestionTitleText;
        let optionsTextForAI = "";
        let questionType = "unknown";
        let isMultiQuiz = false;
        let customPromptPrefix = null; 

        const radioBlock = questionContainer.querySelector('.v-test-questions-radio-block');
        const checkboxBlock = questionContainer.querySelector('.v-test-questions-checkbox-block');
        const matchingBlock = questionContainer.querySelector('.v-block-answers-cross-wrapper');

        if (matchingBlock) {
            questionType = "matching";
            customPromptPrefix = "Встанови відповідність. Відповідь надай у форматі 'Цифра - Буква'. Наприклад: 1-А, 2-В, 3-Б. Не пиши нічого зайвого, лише пари.";
            let leftColumnText = "Завдання:\n";
            const leftItems = matchingBlock.querySelectorAll('.v-block-answers-cross_row .v-col-6:not(.v-col-last) .v-block-answers-cross-block');
            leftItems.forEach(item => {
                const num = item.querySelector('.rk-cross__item .numb-item')?.innerText.trim();
                const text = item.querySelector('.n-kahoot-p')?.innerText.trim();
                if (num && text) leftColumnText += `${num}. ${text}\n`;
            });
            let rightColumnText = "\nВаріанти:\n";
            const rightItems = matchingBlock.querySelectorAll('.v-block-answers-cross_row .v-col-6.v-col-last .v-block-answers-cross-block');
            rightItems.forEach(item => {
                const letter = item.querySelector('.rk-cross__item .numb-item')?.innerText.trim();
                const text = item.querySelector('.n-kahoot-p')?.innerText.trim();
                if (letter && text) rightColumnText += `${letter}. ${text}\n`;
            });
            optionsTextForAI = leftColumnText + rightColumnText;
        } else if (radioBlock) {
            questionType = "radio";
            const options = questionContainer.querySelectorAll('.v-test-questions-radio-block');
            options.forEach((opt, index) => {
                const text = opt.querySelector('label p')?.innerText.trim();
                if (text) optionsTextForAI += `${index + 1}. ${text}\n`;
            });
        } else if (checkboxBlock) {
            questionType = "checkbox";
            isMultiQuiz = true;
            const options = questionContainer.querySelectorAll('.v-test-questions-checkbox-block');
            options.forEach((opt, index) => {
                const text = opt.querySelector('label p')?.innerText.trim();
                if (text) optionsTextForAI += `${index + 1}. ${text}\n`;
            });
        } else {
             questionType = "open_ended";
        }
        
        optionsTextForAI = optionsTextForAI.trim();
        const base64Images = []; 

        const questionData = {
            text: questionTextForAI,
            optionsText: optionsTextForAI,
            base64Images: base64Images,
            isMultiQuiz: isMultiQuiz,
            questionType: questionType,
            customPromptPrefix: customPromptPrefix 
        };
        
        try {
            const answer = await getAnswer(questionData);
            if (answerContentDiv) answerContentDiv.innerHTML = formatAIResponse(answer);
        } catch (error) {
            if (answerContentDiv) answerContentDiv.innerHTML = formatAIResponse("Помилка отримання відповіді.");
        } finally {
            isProcessingAI = false;
            isExtensionModifyingDOM = false;
            if (!document.fullscreenElement) {
                attachAndPositionHelper(); 
            }
        }
    }


    let observer; 
    let previousVseosvitaFsContainerState = false; 

    function initializeObserver() {
        if (observer) {
            observer.disconnect(); 
        }
        const observerTarget = document.documentElement; 
        if (observerTarget) {
            observer = new MutationObserver((mutationsList) => {
                if (isExtensionModifyingDOM) return; 

                let triggerHandlePageChange = false;

                if (location.hostname.includes('vseosvita.ua')) {
                    const vseosvitaFsContainer = document.querySelector('.full-screen-container');
                    const isVseosvitaFsPresent = vseosvitaFsContainer && document.body.contains(vseosvitaFsContainer);
                    if (isVseosvitaFsPresent !== previousVseosvitaFsContainerState) {
                        triggerHandlePageChange = true;
                        previousVseosvitaFsContainerState = isVseosvitaFsPresent;
                    }
                }

                if (!triggerHandlePageChange) {
                    for (const mutation of mutationsList) {
                        // Ігноруємо мутації, якщо їх ціль - наш хелпер або його нащадки
                        if (helperContainer && (mutation.target === helperContainer || helperContainer.contains(mutation.target))) {
                            continue;
                        }
                        // Ігноруємо мутації, якщо наш хелпер додається або видаляється
                        if (helperContainer && 
                            ( (mutation.addedNodes && Array.from(mutation.addedNodes).some(node => node === helperContainer || (node.contains && node.contains(helperContainer)))) ||
                              (mutation.removedNodes && Array.from(mutation.removedNodes).some(node => node === helperContainer || (node.contains && node.contains(helperContainer))))
                            )) {
                            continue; 
                         }

                        if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                            triggerHandlePageChange = true;
                            break; 
                        }
                    }
                }

                if (triggerHandlePageChange) {
                    handlePageContentChange(true); 
                }
            });
            observer.observe(observerTarget, { childList: true, subtree: true });
        }
    }

    function reinitializeExtensionUI(forceRecreateDOM = false) {
        if (isExtensionModifyingDOM && !forceRecreateDOM) return;
        isExtensionModifyingDOM = true;

        if (!helperContainer || forceRecreateDOM) {
            const existingHelper = document.querySelector('.ollama-helper-container');
            if (existingHelper) {
                const oldDragHeader = existingHelper.querySelector('#ollama-helper-drag-header');
                if (oldDragHeader) {
                    oldDragHeader.onmousedown = null;
                    oldDragHeader.ontouchstart = null;
                    document.onmousemove = null; // Очищаємо глобальні обробники
                    document.onmouseup = null;
                    document.ontouchmove = null;
                    document.ontouchend = null;
                }
                existingHelper.remove();
            }
            helperContainer = null; 
            createUI(); 
        } else {
             answerContentDiv = helperContainer.querySelector('#ollama-answer-content');
             dragHeader = helperContainer.querySelector('#ollama-helper-drag-header');
             resizeHelperBtn = helperContainer.querySelector('#resize-helper-btn');
             copyAnswerBtn = helperContainer.querySelector('#copy-answer-btn');
             showRequestBtn = helperContainer.querySelector('#show-request-btn');
             refreshAnswerBtn = helperContainer.querySelector('#refresh-answer-btn');
             attachHelperEventListeners();
             updateHelperBaseStyles();
        }
        
        initializeObserver(); 
        attachAndPositionHelper(true); 
        handlePageContentChange(true); 
        isExtensionModifyingDOM = false;
    }
    
    function handleFullscreenChange() {
        if (isExtensionModifyingDOM) return;

        if (document.fullscreenElement) {
            if (helperContainer) { 
                 if (!document.body.contains(helperContainer) && 
                     document.fullscreenElement !== helperContainer && 
                     document.fullscreenElement !== document.documentElement) {
                    try { document.body.appendChild(helperContainer); } catch (e) { /* ігноруємо */ }
                } else if (document.fullscreenElement === document.documentElement && 
                           !document.body.contains(helperContainer)){
                     try { document.body.appendChild(helperContainer); } catch (e) { /* ігноруємо */ }
                }
                helperContainer.style.setProperty('display', 'flex', 'important');
                helperContainer.style.setProperty('z-index', '2147483647', 'important');
            }
        } else {
            reinitializeExtensionUI(true); 
        }
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            if (observerDebounceTimeout) {
                clearTimeout(observerDebounceTimeout); 
            }
        } else {
            // При поверненні на вкладку, перевіряємо, чи є хелпер і чи він у правильному місці
            if (helperContainer && document.body.contains(helperContainer)) {
                 handlePageContentChange(true); 
            } else { 
                reinitializeExtensionUI(true);
            }
        }
    });

    reinitializeExtensionUI(true); 
    document.addEventListener('fullscreenchange', handleFullscreenChange);

})();