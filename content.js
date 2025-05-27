(async function() {
    'use strict';

    const DEFAULT_SETTINGS = {
        activeService: 'MistralAI',
        Ollama: { host: '', model: '' },
        OpenAI: { apiKey: '', model: 'gpt-4o' },
        Gemini: { apiKey: '', model: 'gemini-2.0-flash' },
        MistralAI: { apiKey: '0RBrYMEMvvazK5iZ9sckIdLSoBnv7Yuj', model: 'pixtral-large-2411' },
        promptPrefix: 'I am providing a question with answer choices. Answer this question directly, without explanation.',
        customization: {
            glowEffect: true,
            borderColor: '#00ffff',
            contentColor: '#0a0a14',
            headerColor: '#001f3f',
            textColor: '#00ff9d'
        }
    };

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
                console.error("xdAnswers content: Failed to parse settings.", e);
                loadedSettings.promptPrefix = DEFAULT_SETTINGS.promptPrefix;
             }
        } else {
            loadedSettings.promptPrefix = DEFAULT_SETTINGS.promptPrefix;
        }
        return loadedSettings;
    }
    
    let settings = await loadSettings();

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

    const Draggable = (function() {
        let instance;
        function createDraggable(container, handle, onDragStartCallback) {
            let isDragging = false;
            let startX, startY, initialTop, initialLeft;
            const onMouseDown = (e) => {
                if (e.target.tagName === 'BUTTON' || (e.target.parentElement && e.target.parentElement.tagName === 'BUTTON')) {
                    return;
                }
                e.preventDefault();
                isDragging = true;
                if (onDragStartCallback) {
                    onDragStartCallback();
                }
                const rect = container.getBoundingClientRect();
                initialTop = rect.top;
                initialLeft = rect.left;
                startX = e.clientX;
                startY = e.clientY;
                container.style.top = `${initialTop}px`;
                container.style.left = `${initialLeft}px`;
                container.style.right = 'auto';
                container.style.bottom = 'auto';
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp, { once: true });
            };
            const onMouseMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                container.style.transform = `translate(${dx}px, ${dy}px)`;
            };
            const onMouseUp = () => {
                if (!isDragging) return;
                isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                const currentTransform = new DOMMatrix(getComputedStyle(container).transform);
                const finalTop = initialTop + currentTransform.m42;
                const finalLeft = initialLeft + currentTransform.m41;
                container.style.transform = '';
                container.style.top = `${finalTop}px`;
                container.style.left = `${finalLeft}px`;
            };
            const destroy = () => {
                handle.removeEventListener('mousedown', onMouseDown);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            handle.addEventListener('mousedown', onMouseDown);
            return { destroy };
        }
        return {
            init: function(c, h, cb) { if (instance) instance.destroy(); instance = createDraggable(c, h, cb); },
            destroy: function() { if (instance) { instance.destroy(); instance = null; } }
        };
    })();

    let isProcessingAI = false;
    let lastProcessedNaurokText = '';
    let processedGFormQuestionIds = new Set();
    let lastRequestBody = null;
    let observerDebounceTimeout = null;
    let isHelperWindowMaximized = false;
    let lastProcessedVseosvitaKey = '';
    let currentHelperParentNode = null;
    let isManuallyPositioned = false;
    let isExtensionModifyingDOM = false;
    const defaultHelperState = {
        width: '350px', height: 'auto', maxHeight: '400px',
        bottom: '20px', right: '20px', top: 'auto', left: 'auto'
    };
    const maximizedHelperState = {
        width: '70vw', height: '70vh', maxHeight: 'none',
        top: '15vh', left: '15vw', bottom: 'auto', right: 'auto'
    };
    let answerContentDiv, dragHeader, helperContainer;

    function updateHelperBaseStyles() {
         const custom = settings.customization;
         addStyle(`:root {
                --futuristic-bg: ${custom.contentColor}; --futuristic-border: ${custom.borderColor};
                --futuristic-text: ${custom.textColor};
                --futuristic-glow: ${custom.glowEffect ? `0 0 5px ${custom.borderColor}, 0 0 10px ${custom.borderColor}` : 'none'};
                --futuristic-font: 'Courier New', Courier, monospace; --header-bg: ${custom.headerColor};
            }
            .ollama-helper-container { margin:0; padding:0; border-width:2px; border-style:solid; font-weight:normal; text-align:left; transform:none;
                position:fixed !important; z-index:2147483647 !important; display:flex !important; flex-direction:column !important;
                background-color:var(--futuristic-bg) !important; border-color:var(--futuristic-border) !important;
                border-radius:10px !important; box-shadow:var(--futuristic-glow) !important; color:var(--futuristic-text) !important;
                font-family:var(--futuristic-font) !important; font-size:14px !important; line-height:1.3 !important; overflow:hidden !important;
                width:${isHelperWindowMaximized ? maximizedHelperState.width : defaultHelperState.width} !important;
                height:${isHelperWindowMaximized ? maximizedHelperState.height : defaultHelperState.height} !important;
                max-height:${isHelperWindowMaximized ? maximizedHelperState.maxHeight : defaultHelperState.maxHeight} !important;
            }
            .ollama-helper-container *, .ollama-helper-container *:before, .ollama-helper-container *:after {
                all:revert !important; font-family:var(--futuristic-font) !important; font-size:inherit !important; line-height:inherit !important;
                color:var(--futuristic-text) !important; box-sizing:border-box !important; margin:0 !important; padding:0 !important;
                background:none !important; border:none !important; 
            }
            .ollama-helper-header { display:flex !important; justify-content:space-between !important; align-items:center !important;
                padding:8px 10px !important; background-color:var(--header-bg) !important;
                border-bottom:1px solid var(--futuristic-border) !important; cursor:move !important; user-select:none;
            }
            .ollama-header-title { font-weight:bold !important; margin-right:auto !important;}
            .ollama-header-buttons { display:flex !important; align-items:center !important; }
            .ollama-header-buttons button { all:revert !important; background:none !important; border:1px solid var(--futuristic-border) !important;
                color:var(--futuristic-text) !important; font-family:var(--futuristic-font) !important; font-size:12px !important; 
                border-radius:5px !important; cursor:pointer !important; margin-left:5px !important; width:28px !important; height:22px !important;
                padding:0 !important; display:flex !important; align-items:center !important; justify-content:center !important; line-height:1 !important; 
            }
            .ollama-header-buttons button:hover { background-color:var(--futuristic-border) !important; color:var(--futuristic-bg) !important; }
            .ollama-helper-content { padding:15px !important; overflow-y:auto !important; flex-grow:1 !important; white-space:pre-wrap !important; word-wrap:break-word !important; }
            .ollama-helper-content ul, .ollama-helper-content li { list-style:revert !important; margin-left:20px !important; padding-left:5px !important; }
            .ollama-helper-content::-webkit-scrollbar { width:8px !important; }
            .ollama-helper-content::-webkit-scrollbar-track { background:var(--futuristic-bg) !important; }
            .ollama-helper-content::-webkit-scrollbar-thumb { background-color:var(--futuristic-border) !important; border-radius:10px !important; border:2px solid var(--futuristic-bg) !important; }
            .loader { all:revert !important; box-sizing:border-box !important; border:4px solid #f3f3f3 !important;
                border-top:4px solid var(--futuristic-border) !important; border-radius:50% !important;
                width:30px !important; height:30px !important; animation:spin 1s linear infinite !important; margin:20px auto !important;
            }
            .loader-inline { all:revert !important; box-sizing:border-box !important; border:2px solid #f3f3f3 !important;
                border-top:2px solid var(--futuristic-border) !important; border-radius:50% !important;
                width:12px !important; height:12px !important; animation:spin 1s linear infinite !important;
                display:inline-block !important; margin-left:5px !important; vertical-align:middle !important;
            }
            @keyframes spin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }`);
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
        attachHelperEventListeners();
        updateHelperBaseStyles(); 
    }

    function attachAndPositionHelper() {
        if (isExtensionModifyingDOM) return;
        isExtensionModifyingDOM = true;
        if (!helperContainer) createUI();
        helperContainer.style.transform = '';
        let determinedTargetParent = document.body, useDefaultPositioning = true;
        if (location.hostname.includes('vseosvita.ua') && (location.pathname.includes('/test/go-olp') || location.pathname.startsWith('/test/start/'))) {
            const vseosvitaFullScreenContainer = document.querySelector('.full-screen-container');
            if (vseosvitaFullScreenContainer && document.body.contains(vseosvitaFullScreenContainer)) {
                determinedTargetParent = vseosvitaFullScreenContainer; useDefaultPositioning = false;
            } else {
                 determinedTargetParent = document.body; useDefaultPositioning = true;
                 if (currentHelperParentNode !== document.body) isManuallyPositioned = false;
            }
        } else {
            determinedTargetParent = document.body; useDefaultPositioning = true;
            if (currentHelperParentNode !== document.body) isManuallyPositioned = false;
        }
        if (!helperContainer.parentNode || helperContainer.parentNode !== determinedTargetParent) {
            if (helperContainer.parentNode) helperContainer.parentNode.removeChild(helperContainer);
            determinedTargetParent.appendChild(helperContainer);
            isManuallyPositioned = false;
        }
        currentHelperParentNode = determinedTargetParent;
        updateHelperBaseStyles();
        if (useDefaultPositioning) {
            if (!isManuallyPositioned) {
                Object.assign(helperContainer.style, isHelperWindowMaximized ? 
                    { top: maximizedHelperState.top, left: maximizedHelperState.left, bottom: 'auto', right: 'auto' } :
                    { top: 'auto', left: 'auto', bottom: defaultHelperState.bottom, right: defaultHelperState.right });
            }
        } else {
            Object.assign(helperContainer.style, { top: 'auto', left: 'auto', bottom: '10px', right: '10px' });
            isManuallyPositioned = false;
        }
        isExtensionModifyingDOM = false;
    }

    function attachHelperEventListeners() {
        if (!helperContainer) return;
        let resizeBtn = helperContainer.querySelector('#resize-helper-btn');
        let copyBtn = helperContainer.querySelector('#copy-answer-btn');
        let showReqBtn = helperContainer.querySelector('#show-request-btn');
        let refreshAnsBtn = helperContainer.querySelector('#refresh-answer-btn');
        if (!resizeBtn) return;
        resizeBtn.onclick = () => {
            isHelperWindowMaximized = !isHelperWindowMaximized; isManuallyPositioned = false; 
            attachAndPositionHelper(); resizeBtn.textContent = isHelperWindowMaximized ? '➖' : '➕';
        };
        copyBtn.onclick = async () => {
            if (!answerContentDiv) return;
            const text = answerContentDiv.innerText;
            if (text && text !== 'Waiting for question...' && !answerContentDiv.querySelector('.loader')) {
                try { await navigator.clipboard.writeText(text); copyBtn.textContent = '✅'; } catch (err) { copyBtn.textContent = '❌'; }
                setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
            } else { copyBtn.textContent = '❌'; setTimeout(() => { copyBtn.textContent = '📋'; }, 1500); }
        };
        showReqBtn.onclick = () => {
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
            alert(requestToShow ? `Request sent to AI:\n\n${requestToShow}` : 'No request has been sent yet, or format is unknown.');
        };
        refreshAnsBtn.onclick = () => forceProcessQuestion();
    }
    
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        if (isExtensionModifyingDOM) { sendResponse({status: "dom_update_in_progress"}); return true; }
        switch (message.type) {
            case "settingsUpdated":
                settings = await loadSettings();
                if (!settings.promptPrefix) { 
                    settings.promptPrefix = DEFAULT_SETTINGS.promptPrefix;
                }
                updateHelperBaseStyles(); 
                forceProcessQuestion();
                sendResponse({ status: "ok" });
                break;
            case "gform_url_changed":
                handlePageContentChange(true); sendResponse({ status: "ok" }); break;
        }
        return true;
    });

    async function imageToBase64(url) {
        console.log('[xdAnswers Debug] imageToBase64: Attempting for URL:', url);
        try {
            const response = await makeRequest({
                method: 'GET',
                url: url,
                responseType: 'blob'
            });
            console.log('[xdAnswers Debug] imageToBase64: Response from makeRequest for URL', url, response); 

            if (response && response.success && response.data) {
                if (typeof response.data === 'string' && response.data.startsWith('data:')) {
                    const base64Part = response.data.split(',', 2)[1];
                    if (base64Part) {
                        console.log('[xdAnswers Debug] imageToBase64: Conversion SUCCESS for URL:', url, '(Base64 part length:', base64Part.length, ')');
                        return base64Part;
                    } else {
                        console.warn('[xdAnswers Debug] imageToBase64: Base64 part is empty after split for URL:', url, 'Data received:', response.data.substring(0, 100) + "...");
                        return null;
                    }
                } else {
                     console.warn('[xdAnswers Debug] imageToBase64: response.data is not a valid Data URL string for URL:', url, 'Received data type:', typeof response.data, 'Data preview:', String(response.data).substring(0,100)+"...");
                    return null;
                }
            } else {
                console.warn('[xdAnswers Debug] imageToBase64: makeRequest was not successful or no data for URL:', url, 'Response success:', response ? response.success : 'no response', 'Response data:', response ? response.data : 'no response');
                return null;
            }
        } catch (error) {
            console.error('[xdAnswers Debug] imageToBase64: CRITICAL ERROR converting image to Base64 for URL:', url, error);
            return null;
        }
    }

    function formatAIResponse(text) {
        if (typeof text !== 'string' || !text) return "";
        let lines = text.split('\n'), htmlOutput = '', inList = false;
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.match(/^#{1,3}\s+.*/)) continue;
            const listItemMatch = line.match(/^[\*\-]\s+(.*)/);
            if (listItemMatch) {
                if (!inList) { htmlOutput += '<ul>'; inList = true; }
                let itemContent = listItemMatch[1].trim();
                itemContent = itemContent
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') 
                    .replace(/__(.*?)__/g, '<b>$1</b>')   
                    .replace(/\*(.*?)\*/g, '<i>$1</i>')     
                    .replace(/_(.*?)_/g, '<i>$1</i>');
                htmlOutput += `<li>${itemContent}</li>`;
            } else {
                if (inList) { htmlOutput += '</ul>'; inList = false; }
                let regularLine = line
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/__(.*?)__/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>')
                    .replace(/_(.*?)_/g, '<i>$1</i>');
                htmlOutput += regularLine + (i < lines.length - 1 && line.trim() !== '' ? '<br>' : '');
            }
        }
        if (inList) htmlOutput += '</ul>';
        return htmlOutput.trim();
    }

    async function getAnswer(questionData) {
        const service = settings.activeService;
        let responseText = "", instruction = questionData.customPromptPrefix || settings.promptPrefix;
        console.log('[xdAnswers Debug] Preparing to get answer. Instruction:', instruction, 'Question Data:', questionData);
        
        if (!questionData.customPromptPrefix) {
            if (["short_text", "paragraph", "open_ended"].includes(questionData.questionType)) {
                instruction = "Provide a detailed answer to the following open-ended question:";
            } else if (questionData.isMultiQuiz) {
                instruction += `\nThis question may have MULTIPLE correct answers. List them.`;
            }
        }
        try {
            if (service === 'Ollama') responseText = await getAnswerFromOllama(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            else if (service === 'OpenAI') responseText = await getAnswerFromOpenAI(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            else if (service === 'Gemini') responseText = await getAnswerFromGemini(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            else if (service === 'MistralAI') responseText = await getAnswerFromMistralAI(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            else responseText = 'Unknown service selected.';
        } catch (error) { 
            console.error('[xdAnswers Debug] Error getting answer from AI service:', service, error);
            responseText = `Service error ${service}. Check console for details. Error: ${error.message}`; 
        }
        console.log('[xdAnswers Debug] Received response from AI:', responseText.substring(0,100) + "...");
        return responseText;
    }

    async function getAnswerFromOllama(instruction, questionText, optionsText, base64Images) {
        if (!settings.Ollama.host || !settings.Ollama.model) return "Ollama host or model not selected.";
        let prompt = `${instruction}\n\nQuestion: ${questionText}`;
        if (optionsText) prompt += `\n\nOptions:\n${optionsText}`;
        const requestBody = { model: settings.Ollama.model, prompt: prompt, stream: false };
        if (base64Images && base64Images.length > 0) {
            requestBody.images = base64Images;
            console.log('[xdAnswers Debug] Ollama: Sending', base64Images.length, 'images.');
        } else {
            console.log('[xdAnswers Debug] Ollama: No images to send.');
        }
        lastRequestBody = { ...requestBody };
        console.log('[xdAnswers Debug] Ollama Request Body:', JSON.stringify(lastRequestBody, (key, value) => (key === 'images' && Array.isArray(value)) ? value.map(img => img.substring(0,30) + '...') : value, 2));
        try {
            const response = await makeRequest({ method: 'POST', url: `${settings.Ollama.host}/api/generate`, headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(requestBody), timeout: 60000 });
            return JSON.parse(response.data).response.trim();
        } catch (error) { return `Ollama API Error: ${error.message}`; }
    }

    async function getAnswerFromOpenAI(systemInstruction, questionText, optionsText, base64Images) {
        if (!settings.OpenAI.apiKey || !settings.OpenAI.model) return "API Key or Model for OpenAI not specified.";
        let userTextContent = `Question: ${questionText}`;
        if (optionsText) userTextContent += `\n\nOptions:\n${optionsText}`;
        const contentForUserMessage = [{ type: 'text', text: userTextContent }];
        if (base64Images && base64Images.length > 0) {
            base64Images.forEach(img_b64 => contentForUserMessage.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img_b64}` } }));
            console.log('[xdAnswers Debug] OpenAI: Preparing', base64Images.length, 'images for request.');
        } else {
            console.log('[xdAnswers Debug] OpenAI: No images to send.');
        }
        const requestBody = { model: settings.OpenAI.model, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: contentForUserMessage }], max_tokens: 500 };
        lastRequestBody = { messages: requestBody.messages };
        console.log('[xdAnswers Debug] OpenAI Request Body:', JSON.stringify(lastRequestBody, (key, value) => (key === 'url' && typeof value === 'string' && value.startsWith('data:image')) ? value.substring(0,50) + '...' : value, 2));
        try {
            const response = await makeRequest({ method: 'POST', url: 'https://api.openai.com/v1/chat/completions', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.OpenAI.apiKey}` }, data: JSON.stringify(requestBody), timeout: 60000 });
            return JSON.parse(response.data).choices[0].message.content.trim();
        } catch (error) { return `OpenAI API Error: ${error.message}`; }
    }

    async function getAnswerFromGemini(systemInstructionText, questionText, optionsText, base64Images) {
        if (!settings.Gemini.apiKey || !settings.Gemini.model) return "API Key or Model for Gemini not specified.";
        let userQueryText = `Question: ${questionText}`;
        if (optionsText) userQueryText += `\n\nOptions:\n${optionsText}`;
        const userParts = [{ text: userQueryText }];
        if (base64Images && base64Images.length > 0) {
            base64Images.forEach(img_b64 => userParts.push({ inline_data: { mime_type: 'image/jpeg', data: img_b64 } }));
            console.log('[xdAnswers Debug] Gemini: Preparing', base64Images.length, 'images for request.');
        } else {
            console.log('[xdAnswers Debug] Gemini: No images to send.');
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
        console.log('[xdAnswers Debug] Gemini Request Body:', JSON.stringify(lastRequestBody, (key, value) => (key === 'data' && typeof value === 'string') ? value.substring(0,30) + '...' : value, 2));
        try {
            const response = await makeRequest({ method: 'POST', url: `https://generativelanguage.googleapis.com/v1beta/models/${settings.Gemini.model}:generateContent?key=${settings.Gemini.apiKey}`, headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(requestBody), timeout: 60000 });
            const d = JSON.parse(response.data);
            if (d.candidates && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0]) return d.candidates[0].content.parts[0].text.trim();
            if (d.promptFeedback && d.promptFeedback.blockReason) return `Request blocked by Gemini: ${d.promptFeedback.blockReason}`;
            if (d.candidates && d.candidates[0].finishReason !== "STOP") return `Gemini finished with reason: ${d.candidates[0].finishReason}`;
            if (!d.candidates || d.candidates.length === 0) return "Gemini provided no answer candidates.";
            return "Unknown Gemini response.";
        } catch (error) { return `Gemini API Error: ${error.message}`; }
    }

    async function getAnswerFromMistralAI(systemInstruction, questionText, optionsText, base64Images) {
        if (!settings.MistralAI.apiKey || !settings.MistralAI.model) return "API Key or Model for Mistral AI not specified.";
        let userTextContent = `Question: ${questionText}`;
        if (optionsText) userTextContent += `\n\nOptions:\n${optionsText}`;
        const contentForUserMessage = [{ type: 'text', text: userTextContent }];
        if (base64Images && base64Images.length > 0) {
            base64Images.forEach(img_b64 => contentForUserMessage.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img_b64}` } }));
            console.log('[xdAnswers Debug] MistralAI: Preparing', base64Images.length, 'images for request.');
        } else {
            console.log('[xdAnswers Debug] MistralAI: No images to send.');
        }
        const requestBody = { model: settings.MistralAI.model, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: contentForUserMessage }], max_tokens: 500 };
        lastRequestBody = { messages: requestBody.messages };
        console.log('[xdAnswers Debug] MistralAI Request Body:', JSON.stringify(lastRequestBody, (key, value) => (key === 'url' && typeof value === 'string' && value.startsWith('data:image')) ? value.substring(0,50) + '...' : value, 2));
        try {
            const response = await makeRequest({ method: 'POST', url: 'https://api.mistral.ai/v1/chat/completions', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.MistralAI.apiKey}` }, data: JSON.stringify(requestBody), timeout: 60000 });
            return JSON.parse(response.data).choices[0].message.content.trim();
        } catch (error) { return `MistralAI API Error: ${error.message}`; }
    }
    
    function forceProcessQuestion() {
        if (isExtensionModifyingDOM) return;
        processedGFormQuestionIds.clear(); lastProcessedNaurokText = ''; lastProcessedVseosvitaKey = '';
        if (answerContentDiv) answerContentDiv.innerHTML = 'Updating...';
        else if (helperContainer) { 
            const tempDiv = helperContainer.querySelector('#ollama-answer-content');
            if (tempDiv) tempDiv.innerHTML = 'Updating...';
        }
        handlePageContentChange(true); 
    }

    let isHandlePageContentRunning = false; 
    function handlePageContentChange(isNavigationEvent = false) {
        if (observerDebounceTimeout) clearTimeout(observerDebounceTimeout);
        observerDebounceTimeout = setTimeout(() => {
            if (isExtensionModifyingDOM || isHandlePageContentRunning) return; 
            isHandlePageContentRunning = true;
            if (!document.body) { isHandlePageContentRunning = false; return; }
            if (!helperContainer) createUI();
            attachAndPositionHelper(); 
            let siteProcessed = false;
            if (location.hostname.includes('docs.google.com')) { processGFormQuestionsSequentially(); siteProcessed = true; }
            else if (location.hostname.includes('naurok.com.ua') || location.hostname.includes('naurok.ua')) { processNaurokQuestion(); siteProcessed = true; }
            else if (location.hostname.includes('vseosvita.ua') && (location.pathname.includes('/test/go-olp') || location.pathname.startsWith('/test/start/'))) { processVseosvitaQuestion(); siteProcessed = true; }
            if ((isNavigationEvent || !siteProcessed) && !document.fullscreenElement) attachAndPositionHelper();
            isHandlePageContentRunning = false;
        }, isNavigationEvent ? 100 : 500); 
    }

    async function processNaurokQuestion() { 
        if (isExtensionModifyingDOM || isProcessingAI) return;
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
        isExtensionModifyingDOM = true; isProcessingAI = true; lastProcessedNaurokText = currentText;
        answerContentDiv.innerHTML = '<div class="loader"></div>';

        const mainImageElement = document.querySelector('.test-content-image img');
        const isMultiQuiz = document.querySelector(".question-option-inner-multiple") !== null ||
            document.querySelector("div[ng-if*='multiquiz']") !== null;
        const optionElements = document.querySelectorAll('.test-option');
        let allImageUrls = [];
        if (mainImageElement && mainImageElement.src) {
            console.log('[xdAnswers Debug] Naurok: Found main image:', mainImageElement.src);
            allImageUrls.push(mainImageElement.src);
        }

        let optionLabels = [];
        optionElements.forEach((opt, index) => {
            const imageDiv = opt.querySelector('.question-option-image');
            const textDiv = opt.querySelector('.question-option-inner-content');
            if (imageDiv && imageDiv.style.backgroundImage) {
                const urlMatch = imageDiv.style.backgroundImage.match(/url\("?(.+?)"?\)/);
                if (urlMatch && urlMatch[1]) {
                    console.log('[xdAnswers Debug] Naurok: Found option image:', urlMatch[1]);
                    allImageUrls.push(urlMatch[1]);
                    optionLabels.push(`Option ${index + 1} (image)`);
                }
            } else if (textDiv) {
                optionLabels.push(textDiv.innerText.trim());
            }
        });
        console.log('[xdAnswers Debug] Naurok: Total images found:', allImageUrls.length);
        const optionsText = optionLabels.join('\n');
        const imagePromises = allImageUrls.map(url => imageToBase64(url));
        try {
            const base64Images = (await Promise.all(imagePromises)).filter(img => img !== null);
            console.log('[xdAnswers Debug] Naurok: Successfully converted', base64Images.length, 'images to Base64.');
            const questionData = {
                text: currentText,
                optionsText: optionsText,
                base64Images: base64Images,
                isMultiQuiz: isMultiQuiz,
                questionType: isMultiQuiz ? "checkbox" : "radio"
            };
            const answer = await getAnswer(questionData);
            answerContentDiv.innerHTML = formatAIResponse(answer);
        } catch (err) {
            console.error("Error processing Naurok question:", err);
            answerContentDiv.innerHTML = formatAIResponse("Error processing question.");
        } finally {
            isProcessingAI = false; isExtensionModifyingDOM = false;
            if(!document.fullscreenElement) attachAndPositionHelper();
        }
    }

    async function processGFormQuestionsSequentially() { 
        if (isExtensionModifyingDOM || isProcessingAI) return;
        if (!answerContentDiv && helperContainer) answerContentDiv = helperContainer.querySelector('#ollama-answer-content');
        if (!answerContentDiv) return;
        
        isExtensionModifyingDOM = true; isProcessingAI = true;

        const questionBlocks = document.querySelectorAll('div.Qr7Oae');
        if (!questionBlocks.length) {
            isProcessingAI = false; isExtensionModifyingDOM = false;
            if (answerContentDiv.innerHTML.includes("loader") || 
                answerContentDiv.innerText === 'Updating...' || 
                answerContentDiv.innerText === 'Waiting for question...') {
                answerContentDiv.innerHTML = formatAIResponse('No questions found on page.');
            }
            if(!document.fullscreenElement) attachAndPositionHelper();
            return;
        }

        let accumulatedAnswersHTML = answerContentDiv.innerHTML;
        if (['Updating...', 
             'Waiting for question...',
             'No questions found on page.',
             'All questions on this page have been processed. Press 🔄 to reprocess all.'
            ].some(s => accumulatedAnswersHTML.includes(s))) {
            accumulatedAnswersHTML = "";
        }
        
        const processingQuestionText = 'Processing question';
        const processingRegex = new RegExp(`${processingQuestionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+\\.\\.\\. <div class="loader-inline"></div>\\n?`, "g");
        accumulatedAnswersHTML = accumulatedAnswersHTML.replace(processingRegex, "");

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
            if (!uniqueId) uniqueId = currentQuestionText + questionBlock.innerHTML.slice(0,100);

            if (currentQuestionText === '' || uniqueId === '') continue;
            if (processedGFormQuestionIds.has(uniqueId)) continue;

            newQuestionsFoundThisRun++;
            questionNumberForDisplay++;

            answerContentDiv.innerHTML = accumulatedAnswersHTML +
                (accumulatedAnswersHTML.endsWith('\n') || accumulatedAnswersHTML === "" ? "" : "\n") +
                `${processingQuestionText} ${questionNumberForDisplay}... <div class="loader-inline"></div>\n`;
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
            if (mainImageElement && mainImageElement.src) {
                 console.log('[xdAnswers Debug] GForm: Found main image:', mainImageElement.src);
                allImageUrls.push(mainImageElement.src);
            }
            let optionLabels = [];
            if (isRadioQuiz || isCheckboxQuiz) {
                const gformOptionContainers = questionBlock.querySelectorAll('div[role="radiogroup"] .docssharedWizToggleLabeledContainer, div[role="listbox"] .docssharedWizToggleLabeledContainer, .Y6Myld div[role="list"] .docssharedWizToggleLabeledContainer, .UHZXDe');
                gformOptionContainers.forEach((optContainer, optIdx) => {
                    const textEl = optContainer.querySelector('span.aDTYNe, span.snByac');
                    const imgEl = optContainer.querySelector('img.QU5LQc');
                    if (imgEl && imgEl.src) {
                        console.log('[xdAnswers Debug] GForm: Found option image:', imgEl.src);
                        allImageUrls.push(imgEl.src);
                        let lblText = `Option (image ${allImageUrls.length})`;
                        if (textEl && textEl.innerText.trim()) {
                            lblText = `${textEl.innerText.trim()} (labeled as Option ${optIdx + 1}, is image ${allImageUrls.length})`;
                        }
                        optionLabels.push(lblText);
                    } else if (textEl && textEl.innerText.trim()) {
                        optionLabels.push(textEl.innerText.trim());
                    }
                });
            }
            console.log('[xdAnswers Debug] GForm: Total images found:', allImageUrls.length);
            const optionsText = optionLabels.length > 0 ? optionLabels.join('\n') : null;
            const imagePromises = allImageUrls.map(url => imageToBase64(url));
            const base64Images = (await Promise.all(imagePromises)).filter(img => img !== null);
            console.log('[xdAnswers Debug] GForm: Successfully converted', base64Images.length, 'images to Base64.');
            const questionData = {
                text: currentQuestionText,
                optionsText: optionsText,
                base64Images: base64Images,
                isMultiQuiz: isCheckboxQuiz,
                questionType: questionType
            };

            const aiResponseText = await getAnswer(questionData);
            
            const currentProcessingRegex = new RegExp(`${processingQuestionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ${questionNumberForDisplay}\\.\\.\\. <div class="loader-inline"></div>\\n?`);
            accumulatedAnswersHTML = answerContentDiv.innerHTML.replace(currentProcessingRegex, "");

            accumulatedAnswersHTML += `${questionNumberForDisplay}: ${formatAIResponse(aiResponseText)}\n`;
            answerContentDiv.innerHTML = accumulatedAnswersHTML;
            answerContentDiv.scrollTop = answerContentDiv.scrollHeight;
            processedGFormQuestionIds.add(uniqueId);
        }

        if (answerContentDiv.innerHTML.includes("loader-inline")) {
            answerContentDiv.innerHTML = answerContentDiv.innerHTML.replace(processingRegex, "");
        }

        if (!newQuestionsFoundThisRun && questionBlocks.length > 0) {
            if (accumulatedAnswersHTML.trim() === '') {
                answerContentDiv.innerHTML = 'All questions on this page have been processed. Press 🔄 to reprocess all.';
            }
        } else if (questionBlocks.length === 0 && accumulatedAnswersHTML.trim() === '') {
            answerContentDiv.innerHTML = 'No questions found on the page.';
        }
        isProcessingAI = false; isExtensionModifyingDOM = false;
        if(!document.fullscreenElement) attachAndPositionHelper();
    }

    async function processVseosvitaQuestion() {
        if (isExtensionModifyingDOM || isProcessingAI) return;
        if (!answerContentDiv && helperContainer) answerContentDiv = helperContainer.querySelector('#ollama-answer-content');
        if (!answerContentDiv) { return; }

        const questionContainer = document.querySelector('div[id^="i-test-question-"]');
        if (!questionContainer) {
            if (!document.fullscreenElement) attachAndPositionHelper();
            return;
        }

        const questionNumberElement = document.querySelector('span.v-numbertest span.occasional_class occ1 span.occasional_class occ2'); 
        const questionTitleElement = questionContainer.querySelector('.v-test-questions-title .content-box p, .v-test-questions-title .content-box div');
        
        const currentQuestionNumberText = questionNumberElement ? questionNumberElement.innerText.trim() : Math.random().toString(); 
        const currentQuestionTitleText = questionTitleElement ? questionTitleElement.innerText.trim() : '';
        
        const questionTextSample = currentQuestionTitleText.substring(0, 50); 
        const currentVseosvitaKey = `${currentQuestionNumberText}#${questionTextSample}`;

        if (currentVseosvitaKey === lastProcessedVseosvitaKey && currentQuestionTitleText !== '') { 
             if (helperContainer && getComputedStyle(helperContainer).display !== 'none' && !document.fullscreenElement) attachAndPositionHelper(); 
            return;
        }
        
        isExtensionModifyingDOM = true; isProcessingAI = true;
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
            customPromptPrefix = "Match the items. Provide the answer in the format 'Number - Letter'. For example: 1-A, 2-C, 3-B. Do not write anything else, only the pairs.";
            let leftColumnText = "Tasks:\n";
            const leftItems = matchingBlock.querySelectorAll('.v-block-answers-cross_row .v-col-6:not(.v-col-last) .v-block-answers-cross-block');
            leftItems.forEach(item => {
                const num = item.querySelector('.rk-cross__item .numb-item')?.innerText.trim();
                const text = item.querySelector('.n-kahoot-p')?.innerText.trim();
                if (num && text) leftColumnText += `${num}. ${text}\n`;
            });
            let rightColumnText = "\nOptions:\n";
            const rightItems = matchingBlock.querySelectorAll('.v-block-answers-cross_row .v-col-6.v-col-last .v-block-answers-cross-block');
            rightItems.forEach(item => {
                const letter = item.querySelector('.rk-cross__item .numb-item')?.innerText.trim();
                const text = item.querySelector('.n-kahoot-p')?.innerText.trim();
                if (letter && text) rightColumnText += `${letter}. ${text}\n`;
            });
            optionsTextForAI = leftColumnText + rightColumnText;
        } else if (radioBlock || checkboxBlock) {
            questionType = radioBlock ? "radio" : "checkbox";
            isMultiQuiz = !!checkboxBlock;
            const options = questionContainer.querySelectorAll('.v-test-questions-radio-block, .v-test-questions-checkbox-block');
            options.forEach((opt, index) => {
                const text = opt.querySelector('label p, label div')?.innerText.trim();
                if (text) optionsTextForAI += `${index + 1}. ${text}\n`;
            });
        } else {
             questionType = "open_ended";
        }
        
        optionsTextForAI = optionsTextForAI.trim();
        const base64Images = []; 
        console.log('[xdAnswers Debug] Vseosvita: Image processing is currently not implemented for this site. Sending 0 images.');

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
            console.error("Error processing Vseosvita question:", error);
            if (answerContentDiv) answerContentDiv.innerHTML = formatAIResponse("Error processing question.");
        } finally {
            isProcessingAI = false; isExtensionModifyingDOM = false;
            if (!document.fullscreenElement) attachAndPositionHelper(); 
        }
    }

    let observer; 
    let previousVseosvitaFsContainerState = false; 

    function initializeObserver() {
        if (observer) observer.disconnect(); 
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
                        if (helperContainer && (mutation.target === helperContainer || helperContainer.contains(mutation.target))) continue;
                        if (helperContainer && ((mutation.addedNodes && Array.from(mutation.addedNodes).some(node => node === helperContainer || (node.contains && node.contains(helperContainer)))) || (mutation.removedNodes && Array.from(mutation.removedNodes).some(node => node === helperContainer || (node.contains && node.contains(helperContainer)))))) continue; 
                        if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                            triggerHandlePageChange = true; break; 
                        }
                    }
                }
                if (triggerHandlePageChange) handlePageContentChange(true); 
            });
            observer.observe(observerTarget, { childList: true, subtree: true });
        }
    }

    function reinitializeExtensionUI(forceRecreateDOM = false) {
        if (isExtensionModifyingDOM && !forceRecreateDOM) return;
        isExtensionModifyingDOM = true;
        Draggable.destroy();
        if (!helperContainer || forceRecreateDOM) {
            const existing = document.querySelector('.ollama-helper-container');
            if (existing) existing.remove();
            helperContainer = null; 
            createUI(); 
        } else {
             attachHelperEventListeners(); updateHelperBaseStyles();
        }
        Draggable.init(helperContainer, dragHeader, () => { isManuallyPositioned = true; });
        initializeObserver(); attachAndPositionHelper(); handlePageContentChange(true); 
        isExtensionModifyingDOM = false;
    }
    
    function handleFullscreenChange() { reinitializeExtensionUI(true); }

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'visible') {
            reinitializeExtensionUI(true);
        }
    });

    reinitializeExtensionUI(true); 
    document.addEventListener('fullscreenchange', handleFullscreenChange);

})();