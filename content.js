(async function() {
    'use strict';

    const DEFAULT_SETTINGS = {
        activeService: 'MistralAI',
        Ollama: { host: '', model: '' },
        OpenAI: { apiKey: '', model: 'gpt-4o' },
        Gemini: { apiKey: '', model: 'gemini-2.0-flash' },
        MistralAI: { apiKey: '0RBrYMEMvvazK5iZ9sckIdLSoBnv7Yuj', model: 'pixtral-large-2411' },
        promptPrefix: 'Я даю питання, ти повинен на його відповісти, написавши тільки варіант відповіді, без пояснень.',
        customization: {
            glowEffect: true,
            borderColor: '#00ffff',
            contentColor: '#0a0a14',
            headerColor: '#001f3f',
            textColor: '#00ff9d'
        }
    };

    // --- Cache for JustClass API Answers ---
    let justClassApiCache = null;
    let justClassHash = null;

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

            const getCoords = (e) => {
                if (e.touches && e.touches.length) {
                    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
                return { x: e.clientX, y: e.clientY };
            };

            const onDragStart = (e) => {
                if (e.target.tagName === 'BUTTON' || (e.target.parentElement && e.target.parentElement.tagName === 'BUTTON')) {
                    return;
                }
                if (e.type === 'touchstart') {
                    e.preventDefault();
                }

                isDragging = true;
                if (onDragStartCallback) {
                    onDragStartCallback();
                }

                const coords = getCoords(e);
                const rect = container.getBoundingClientRect();
                initialTop = rect.top;
                initialLeft = rect.left;
                startX = coords.x;
                startY = coords.y;

                container.style.top = `${initialTop}px`;
                container.style.left = `${initialLeft}px`;
                container.style.right = 'auto';
                container.style.bottom = 'auto';

                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('touchmove', onDragMove, { passive: false });
                document.addEventListener('mouseup', onDragEnd, { once: true });
                document.addEventListener('touchend', onDragEnd, { once: true });
            };

            const onDragMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();

                const coords = getCoords(e);
                const dx = coords.x - startX;
                const dy = coords.y - startY;
                container.style.transform = `translate(${dx}px, ${dy}px)`;
            };

            const onDragEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('touchmove', onDragMove);

                const currentTransform = new DOMMatrix(getComputedStyle(container).transform);
                const finalTop = initialTop + currentTransform.m42;
                const finalLeft = initialLeft + currentTransform.m41;

                container.style.transform = '';
                container.style.top = `${finalTop}px`;
                container.style.left = `${finalLeft}px`;
            };

            const destroy = () => {
                handle.removeEventListener('mousedown', onDragStart);
                handle.removeEventListener('touchstart', onDragStart);
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('touchmove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd);
                document.removeEventListener('touchend', onDragEnd);
            };

            handle.addEventListener('mousedown', onDragStart);
            handle.addEventListener('touchstart', onDragStart, { passive: false });

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
        
        let determinedTargetParent = document.body;
        let useDefaultPositioning = true;

        if (location.hostname.includes('vseosvita.ua') && (location.pathname.includes('/test/go-olp') || location.pathname.startsWith('/test/start/'))) {
            const vseosvitaFullScreenContainer = document.querySelector('.full-screen-container');
            if (vseosvitaFullScreenContainer && document.body.contains(vseosvitaFullScreenContainer)) {
                determinedTargetParent = vseosvitaFullScreenContainer; useDefaultPositioning = false;
            } else {
                 if (currentHelperParentNode !== document.body) isManuallyPositioned = false;
            }
        }
        
        // Force attach to body if not already there
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
            if (!isManuallyPositioned) {
                Object.assign(helperContainer.style, { top: 'auto', left: 'auto', bottom: '10px', right: '10px' });
            }
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
        
        Draggable.init(helperContainer, dragHeader, () => {
             isManuallyPositioned = true;
        });

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
        try {
            const response = await makeRequest({ method: 'GET', url: url, responseType: 'blob' });
            if (response && response.success && response.data) {
                if (typeof response.data === 'string' && response.data.startsWith('data:')) {
                    const base64Part = response.data.split(',', 2)[1];
                    return base64Part || null;
                }
            }
            return null;
        } catch (error) {
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
                let itemContent = listItemMatch[1].trim()
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/__(.*?)__/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/_(.*?)_/g, '<i>$1</i>');
                htmlOutput += `<li>${itemContent}</li>`;
            } else {
                if (inList) { htmlOutput += '</ul>'; inList = false; }
                let regularLine = line
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/__(.*?)__/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/_(.*?)_/g, '<i>$1</i>');
                htmlOutput += regularLine + (i < lines.length - 1 && line.trim() !== '' ? '<br>' : '');
            }
        }
        if (inList) htmlOutput += '</ul>';
        return htmlOutput.trim();
    }

    async function getAnswer(questionData) {
        const service = settings.activeService;
        let responseText = "", instruction = questionData.customPromptPrefix || settings.promptPrefix;
        
        if (!questionData.customPromptPrefix) {
            if (["short_text", "paragraph", "open_ended"].includes(questionData.questionType)) {
                instruction = "Provide a detailed answer to the following open-ended question:";
            } else if (questionData.isMultiQuiz) {
                instruction += `\nThis question may have MULTIPLE correct answers. List them.`;
            } else if (questionData.questionType === 'matching') {
                instruction += `\nThis is a matching task. Match items from Column A to Column B.`;
            }
        }
        try {
            if (service === 'Ollama') responseText = await getAnswerFromOllama(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            else if (service === 'OpenAI') responseText = await getAnswerFromOpenAI(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            else if (service === 'Gemini') responseText = await getAnswerFromGemini(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            else if (service === 'MistralAI') responseText = await getAnswerFromMistralAI(instruction, questionData.text, questionData.optionsText, questionData.base64Images);
            else responseText = 'Unknown service selected.';
        } catch (error) { 
            responseText = `Service error ${service}. Error: ${error.message}`; 
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
        }
        const requestBody = { model: settings.OpenAI.model, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: contentForUserMessage }], max_tokens: 500 };
        lastRequestBody = { messages: requestBody.messages };
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
        }
        const requestBody = { contents: [{ role: "user", parts: userParts }], systemInstruction: { parts: [{ text: systemInstructionText }] }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ] };
        lastRequestBody = requestBody;
        try {
            const response = await makeRequest({ method: 'POST', url: `https://generativelanguage.googleapis.com/v1beta/models/${settings.Gemini.model}:generateContent?key=${settings.Gemini.apiKey}`, headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(requestBody), timeout: 60000 });
            return JSON.parse(response.data).candidates[0].content.parts[0].text.trim();
        } catch (error) { return `Gemini API Error: ${error.message}`; }
    }

    async function getAnswerFromMistralAI(systemInstruction, questionText, optionsText, base64Images) {
        if (!settings.MistralAI.apiKey || !settings.MistralAI.model) return "API Key or Model for MistralAI not specified.";
        let userTextContent = `Question: ${questionText}`;
        if (optionsText) userTextContent += `\n\nOptions:\n${optionsText}`;
        const contentForUserMessage = [{ type: 'text', text: userTextContent }];
        if (base64Images && base64Images.length > 0) {
            base64Images.forEach(img_b64 => contentForUserMessage.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img_b64}` } }));
        }
        const requestBody = { model: settings.MistralAI.model, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: contentForUserMessage }], max_tokens: 500 };
        lastRequestBody = { messages: requestBody.messages };
        try {
            const response = await makeRequest({ method: 'POST', url: 'https://api.mistral.ai/v1/chat/completions', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.MistralAI.apiKey}` }, data: JSON.stringify(requestBody), timeout: 60000 });
            return JSON.parse(response.data).choices[0].message.content.trim();
        } catch (error) { return `MistralAI API Error: ${error.message}`; }
    }

    function forceProcessQuestion() {
        if (isExtensionModifyingDOM) return;
        processedGFormQuestionIds.clear();
        lastProcessedNaurokText = '';
        lastProcessedVseosvitaKey = '';
        if (answerContentDiv) answerContentDiv.innerHTML = 'Updating...';
        handlePageContentChange(true);
    }

    // --- JustClass API Utils ---
    
    function cleanText(str) {
        if (!str) return "";
        // Remove HTML tags
        let clean = str.replace(/<[^>]*>/g, ' ');
        // Decode entities
        const txt = document.createElement('textarea');
        txt.innerHTML = clean;
        clean = txt.value;
        // Normalize spaces and lowercase
        return clean.replace(/\s+/g, ' ').trim().toLowerCase();
    }

    async function fetchJustClassAPIData() {
        const match = location.href.match(/hw\/([a-zA-Z0-9]+)/);
        if (!match) return;
        
        const hash = match[1];
        if (hash === justClassHash && justClassApiCache) return; 
        
        justClassHash = hash;
        const apiUrl = `https://api.justschool.me/api/public/homework/by-hash/${hash}`;
        
        try {
            const response = await makeRequest({ method: 'GET', url: apiUrl });
            if (response && response.success) {
                const data = JSON.parse(response.data);
                justClassApiCache = parseJustClassData(data);
            }
        } catch (e) {
            console.error("[xdAnswers] Failed to fetch JustClass API:", e);
        }
    }

    function parseJustClassData(data) {
        const cheatSheet = {};
        if (!data || !data.sections) return cheatSheet;

        data.sections.forEach(section => {
            if (!section.trainings) return;
            section.trainings.forEach(training => {
                const locale = training.defaultLocale || 'uk';
                const translation = training.translations && training.translations[locale];
                if (!translation || !translation.payload) return;

                // 1. Radio / Checkbox questions
                if (training.type === 'radio-question' || training.type === 'checkbox-question') {
                    if (translation.payload.questions) {
                        translation.payload.questions.forEach(q => {
                            const qText = cleanText(q.question);
                            const correctAnswers = q.answers
                                .filter(a => a.correct)
                                .map(a => a.text.trim());
                            
                            if (correctAnswers.length > 0) {
                                cheatSheet[qText] = {
                                    type: 'simple',
                                    answers: correctAnswers
                                };
                            }
                        });
                    }
                }
                
                // 2. Matching questions (point-group)
                if (training.type === 'point-group') {
                    if (translation.payload.rows) {
                        translation.payload.rows.forEach(row => {
                            if (row.items && row.items.length === 2) {
                                const item1 = row.items[0];
                                const item2 = row.items[1];
                                const text1 = cleanText(item1.text);
                                const text2 = cleanText(item2.text);
                                cheatSheet[text1] = { type: 'match_item', pair: item2.text };
                                cheatSheet[text2] = { type: 'match_item', pair: item1.text };
                            }
                        });
                    }
                }
            });
        });
        return cheatSheet;
    }

    function handlePageContentChange(isNavigationEvent = false) {
        if (observerDebounceTimeout) clearTimeout(observerDebounceTimeout);
        observerDebounceTimeout = setTimeout(() => {
            if (isExtensionModifyingDOM) return;
            
            if (!document.fullscreenElement) {
                if (location.hostname.includes('naurok') || 
                    location.hostname.includes('docs.google.com') || 
                    location.hostname.includes('vseosvita.ua') || 
                    location.hostname.includes('justclass.com.ua')) {
                    attachAndPositionHelper();
                }
            }

            if (location.hostname.includes('naurok')) {
                processNaurokQuestion();
            } else if (location.hostname.includes('docs.google.com')) {
                processGFormQuestionsSequentially();
            } else if (location.hostname.includes('vseosvita.ua')) {
                processVseosvitaQuestion();
            } else if (location.hostname.includes('justclass.com.ua')) {
                processJustClassQuestion();
            }
        }, 500);
    }

    // ... (processNaurok, processGForm, processVseosvita remain the same) ...
    async function processNaurokQuestion() {
        if (isExtensionModifyingDOM || isProcessingAI) return;
        if (!answerContentDiv && helperContainer) answerContentDiv = helperContainer.querySelector('#ollama-answer-content');
        if (!answerContentDiv) return;

        const questionContent = document.querySelector('.test-content-text');
        if (!questionContent) return;

        const currentQuestionText = questionContent.innerText.trim();
        if (currentQuestionText === lastProcessedNaurokText && currentQuestionText !== '') return;

        isExtensionModifyingDOM = true;
        isProcessingAI = true;
        lastProcessedNaurokText = currentQuestionText;
        answerContentDiv.innerHTML = '<div class="loader"></div>';

        let questionData = {
            text: currentQuestionText,
            optionsText: "",
            questionType: "unknown",
            isMultiQuiz: false,
            base64Images: [],
            customPromptPrefix: null
        };

        let allImageUrls = [];
        const mainImageElement = document.querySelector('.test-content-image img');
        questionData.isMultiQuiz = document.querySelector(".question-option-inner-multiple") !== null || document.querySelector("div[ng-if*='multiquiz']") !== null;
        if (questionData.isMultiQuiz) { questionData.questionType = "checkbox"; }

        const optionElements = document.querySelectorAll('.test-option');
        if (mainImageElement && mainImageElement.src) { allImageUrls.push(mainImageElement.src); }

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
            } else if (textDiv) { optionLabels.push(textDiv.innerText.trim()); }
        });
        questionData.optionsText = optionLabels.join('\n');

        const imagePromises = allImageUrls.map(url => imageToBase64(url));
        try {
            questionData.base64Images = (await Promise.all(imagePromises)).filter(img => img !== null);
            const answer = await getAnswer(questionData);
            answerContentDiv.innerHTML = formatAIResponse(answer);
        } catch (err) {
            answerContentDiv.innerHTML = formatAIResponse("Error processing question.");
        } finally {
            isProcessingAI = false;
            isExtensionModifyingDOM = false;
        }
    }

    async function processGFormQuestionsSequentially() {
        if (isExtensionModifyingDOM || isProcessingAI) return;
        if (!answerContentDiv && helperContainer) answerContentDiv = helperContainer.querySelector('#ollama-answer-content');
        if (!answerContentDiv) return;

        isExtensionModifyingDOM = true;
        isProcessingAI = true;

        const visibleQuestions = Array.from(document.querySelectorAll('div[role="listitem"]')).filter(el => el.offsetParent !== null);
        if (visibleQuestions.length === 0) {
            isExtensionModifyingDOM = false;
            isProcessingAI = false;
            return;
        }

        let newQuestionsFoundThisRun = 0;
        let questionNumberForDisplay = processedGFormQuestionIds.size;
        let accumulatedAnswersHTML = answerContentDiv.innerHTML === 'Waiting for question...' || answerContentDiv.innerHTML === 'Updating...' ? '' : answerContentDiv.innerHTML;

        try {
            for (const questionBlock of visibleQuestions) {
                const questionTitleElement = questionBlock.querySelector('div[role="heading"] span.M7eMe');
                const currentQuestionText = questionTitleElement ? questionTitleElement.innerText.trim() : '';
                let uniqueId = null;
                const dataParams = questionBlock.getAttribute('data-params');
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
                answerContentDiv.innerHTML = accumulatedAnswersHTML + (accumulatedAnswersHTML.endsWith('\n') || accumulatedAnswersHTML === "" ? "" : "\n") + `Processing Question ${questionNumberForDisplay}... <div class="loader-inline"></div>\n`;
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
                if (mainImageElement && mainImageElement.src) { allImageUrls.push(mainImageElement.src); }

                let optionLabels = [];
                if (isRadioQuiz || isCheckboxQuiz) {
                    const gformOptionContainers = questionBlock.querySelectorAll('div[role="radiogroup"] .docssharedWizToggleLabeledContainer, div[role="listbox"] .docssharedWizToggleLabeledContainer, .Y6Myld div[role="list"] .docssharedWizToggleLabeledContainer, .UHZXDe');
                    gformOptionContainers.forEach((optContainer, optIdx) => {
                        const textEl = optContainer.querySelector('span.aDTYNe, span.snByac');
                        const imgEl = optContainer.querySelector('img.QU5LQc');
                        if (imgEl && imgEl.src) {
                            allImageUrls.push(imgEl.src);
                            optionLabels.push(`Option ${optIdx + 1} (image)`);
                        } else if (textEl) {
                            optionLabels.push(textEl.innerText.trim());
                        }
                    });
                }

                let questionData = {
                    text: currentQuestionText,
                    optionsText: optionLabels.join('\n'),
                    questionType: questionType,
                    isMultiQuiz: isCheckboxQuiz,
                    base64Images: [],
                    customPromptPrefix: null
                };

                const imagePromises = allImageUrls.map(url => imageToBase64(url));
                questionData.base64Images = (await Promise.all(imagePromises)).filter(img => img !== null);

                const answer = await getAnswer(questionData);
                const formattedAnswer = formatAIResponse(answer);
                
                accumulatedAnswersHTML = answerContentDiv.innerHTML.replace(`Processing Question ${questionNumberForDisplay}... <div class="loader-inline"></div>\n`, "");
                accumulatedAnswersHTML += `<b>Q${questionNumberForDisplay}:</b> ${currentQuestionText}<br><b>A:</b> ${formattedAnswer}<br><hr>`;
                answerContentDiv.innerHTML = accumulatedAnswersHTML;
                answerContentDiv.scrollTop = answerContentDiv.scrollHeight;
                processedGFormQuestionIds.add(uniqueId);
            }
        } catch (err) {
            answerContentDiv.innerHTML += `<br>Error processing questions.`;
        } finally {
            if (newQuestionsFoundThisRun === 0 && processedGFormQuestionIds.size === 0) {
                answerContentDiv.innerHTML = 'No active questions found on the page.';
            }
            isProcessingAI = false;
            isExtensionModifyingDOM = false;
        }
    }

    async function processVseosvitaQuestion() {
        if (isExtensionModifyingDOM || isProcessingAI) return;
        if (!answerContentDiv && helperContainer) answerContentDiv = helperContainer.querySelector('#ollama-answer-content');
        if (!answerContentDiv) return;

        const questionContainer = document.querySelector('div[id^="i-test-question-"]');
        if (!questionContainer) return;

        const questionNumberElement = document.querySelector('span.v-numbertest span.occasional_class occ1 span.occasional_class occ2');
        const questionTitleElement = questionContainer.querySelector('.v-test-questions-title .content-box p, .v-test-questions-title .content-box div');
        const currentQuestionNumberText = questionNumberElement ? questionNumberElement.innerText.trim() : Math.random().toString();
        const currentQuestionTitleText = questionTitleElement ? questionTitleElement.innerText.trim() : '';
        const questionTextSample = currentQuestionTitleText.substring(0, 50);
        const currentVseosvitaKey = `${currentQuestionNumberText}#${questionTextSample}`;

        if (currentVseosvitaKey === lastProcessedVseosvitaKey && currentQuestionTitleText !== '') return;

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
        const matchingBlock = questionContainer.querySelector('.v-test-questions-matching-block');
        const inputBlock = questionContainer.querySelector('.v-test-questions-input-block');

        let allImageUrls = [];
        const mainImage = questionContainer.querySelector('.v-test-questions-title img');
        if (mainImage) allImageUrls.push(mainImage.src);

        if (radioBlock) {
            questionType = "radio";
            const options = radioBlock.querySelectorAll('.v-test-questions-radio-item');
            options.forEach(opt => {
                const text = opt.querySelector('label') ? opt.querySelector('label').innerText : '';
                optionsTextForAI += `- ${text}\n`;
                const img = opt.querySelector('img');
                if (img) allImageUrls.push(img.src);
            });
        } else if (checkboxBlock) {
            questionType = "checkbox";
            isMultiQuiz = true;
            const options = checkboxBlock.querySelectorAll('.v-test-questions-checkbox-item');
            options.forEach(opt => {
                const text = opt.querySelector('label') ? opt.querySelector('label').innerText : '';
                optionsTextForAI += `- ${text}\n`;
                const img = opt.querySelector('img');
                if (img) allImageUrls.push(img.src);
            });
        } else if (matchingBlock) {
            questionType = "matching";
            customPromptPrefix = "Це завдання на встановлення відповідності. Знайди пари між лівою та правою колонками.";
            const leftCol = matchingBlock.querySelectorAll('.v-test-questions-matching-left .v-test-questions-matching-item');
            const rightCol = matchingBlock.querySelectorAll('.v-test-questions-matching-right .v-test-questions-matching-item');
            
            questionTextForAI += "\nЛіва колонка:\n";
            leftCol.forEach((item, i) => { questionTextForAI += `${i+1}. ${item.innerText}\n`; });
            optionsTextForAI += "\nПрава колонка:\n";
            rightCol.forEach((item, i) => { optionsTextForAI += `${String.fromCharCode(65+i)}. ${item.innerText}\n`; });
        } else if (inputBlock) {
            questionType = "short_text";
        }

        let questionData = {
            text: questionTextForAI,
            optionsText: optionsTextForAI,
            questionType: questionType,
            isMultiQuiz: isMultiQuiz,
            base64Images: [],
            customPromptPrefix: customPromptPrefix
        };

        const imagePromises = allImageUrls.map(url => imageToBase64(url));
        try {
            questionData.base64Images = (await Promise.all(imagePromises)).filter(img => img !== null);
            const answer = await getAnswer(questionData);
            answerContentDiv.innerHTML = formatAIResponse(answer);
        } catch (error) {
            answerContentDiv.innerHTML = formatAIResponse("Error processing question.");
        } finally {
            isProcessingAI = false;
            isExtensionModifyingDOM = false;
        }
    }

    // --- REFACTORED JUSTCLASS LOGIC FOR MULTIPLE QUESTIONS ---
    async function processJustClassQuestion() {
        if (!helperContainer || !helperContainer.parentNode) {
            attachAndPositionHelper();
        }

        if (isExtensionModifyingDOM || isProcessingAI) return;
        if (!answerContentDiv && helperContainer) answerContentDiv = helperContainer.querySelector('#ollama-answer-content');
        if (!answerContentDiv) return;

        // Fetch API if needed
        await fetchJustClassAPIData();

        const mainContainer = document.querySelector('justkids-homework-training, justkids-training-preview, .main');
        // Less strict check: allow processing if JustClass text is present
        if (!mainContainer && !document.body.innerText.includes('JustClass')) return;

        const currentTextContent = mainContainer ? mainContainer.innerText : document.body.innerText;
        // Include 'from' counter in hash to detect page switches
        const counterElement = document.querySelector('.from.ng-star-inserted');
        const counterText = counterElement ? counterElement.innerText : '';
        const currentJustClassKey = `justclass-${counterText}-${currentTextContent.substring(0, 100)}`;
        
        // Only run if content actually changed
        if (currentJustClassKey === lastProcessedNaurokText) return;

        isExtensionModifyingDOM = true;
        isProcessingAI = true;
        lastProcessedNaurokText = currentJustClassKey;

        answerContentDiv.innerHTML = '<div class="loader"></div>';

        // --- Build Output for ALL Visible Questions ---
        let outputHTML = "";
        let foundAnyApiAnswer = false;

        // 1. Process Simple Questions (Radio/Checkbox)
        const questionsOnPage = document.querySelectorAll('.question');
        questionsOnPage.forEach((q, idx) => {
            const titleEl = q.querySelector('.title');
            if (titleEl) {
                const rawTitle = titleEl.innerText;
                const cleanTitle = cleanText(rawTitle);
                
                // Lookup in API cache
                let cached = null;
                if (justClassApiCache) {
                    cached = justClassApiCache[cleanTitle];
                    // Fallback fuzzy search
                    if (!cached) {
                        for (const k in justClassApiCache) {
                            if (k.includes(cleanTitle) || cleanTitle.includes(k)) {
                                cached = justClassApiCache[k];
                                break;
                            }
                        }
                    }
                }

                if (cached && cached.type === 'simple') {
                    foundAnyApiAnswer = true;
                    // Build nice output with spacing
                    outputHTML += `<div style="margin-bottom: 25px; border-bottom: 1px solid #444; padding-bottom: 15px;">`;
                    outputHTML += `<b>Q:</b> ${rawTitle.length > 50 ? rawTitle.substring(0,50)+'...' : rawTitle}<br>`;
                    outputHTML += `<b>A:</b> <span style="color:#00ff9d; font-weight:bold;">${cached.answers.join(', ')}</span>`;
                    outputHTML += `</div>`;
                }
            }
        });

        // 2. Process Matching Questions (Point Groups)
        const matchingGroups = document.querySelectorAll('justkids-point-group');
        matchingGroups.forEach((group, idx) => {
            let matchesFoundInThisGroup = [];
            const items = group.querySelectorAll('.item .content');
            
            items.forEach(item => {
                const itemText = item.innerText.trim();
                const cleanItem = cleanText(itemText);
                
                if (justClassApiCache) {
                    const cached = justClassApiCache[cleanItem];
                    if (cached && cached.type === 'match_item') {
                        // Prevent duplicates (A-B vs B-A)
                        const pairText = `${itemText} <span style="color:yellow">⟷</span> ${cached.pair}`;
                        let isDuplicate = false;
                        matchesFoundInThisGroup.forEach(m => {
                            // Simple duplicate check string based
                            if (m.includes(itemText) && m.includes(cached.pair)) isDuplicate = true;
                        });

                        if (!isDuplicate) {
                            matchesFoundInThisGroup.push(pairText);
                        }
                    }
                }
            });

            if (matchesFoundInThisGroup.length > 0) {
                foundAnyApiAnswer = true;
                outputHTML += `<div style="margin-bottom: 25px; border-bottom: 1px solid #444; padding-bottom: 15px;">`;
                outputHTML += `<b>Matching Task:</b><ul>`;
                matchesFoundInThisGroup.forEach(m => outputHTML += `<li>${m}</li>`);
                outputHTML += `</ul></div>`;
            }
        });

        // --- Result Handling ---
        if (foundAnyApiAnswer) {
            answerContentDiv.innerHTML = outputHTML;
            isProcessingAI = false;
            isExtensionModifyingDOM = false;
            return;
        }

        // --- Fallback to AI if NO API answers found on screen ---
        // Extract text for AI
        let aiQuestionText = "";
        let aiOptionsText = "";
        let imageUrls = [];

        const textBlocks = document.querySelectorAll('justkids-text');
        textBlocks.forEach(block => { aiQuestionText += block.innerText + "\n"; });

        questionsOnPage.forEach((q, idx) => {
            const title = q.querySelector('.title');
            if (title) aiQuestionText += `Question ${idx+1}: ${title.innerText}\n`;
            const answers = q.querySelectorAll('.answers mat-radio-button, .answers mat-checkbox');
            if (answers.length > 0) {
                aiOptionsText += `\nOptions for Q${idx+1}:\n`;
                answers.forEach(opt => aiOptionsText += `- ${opt.innerText.trim()}\n`);
            }
        });

        const contentImages = (mainContainer || document.body).querySelectorAll('img');
        contentImages.forEach(img => {
            if (!imageUrls.includes(img.src) && img.width > 50 && img.height > 50 && !img.src.includes('icon') && !img.src.includes('logo')) {
                imageUrls.push(img.src);
            }
        });

        const questionData = {
            text: aiQuestionText.trim(),
            optionsText: aiOptionsText.trim(),
            questionType: (matchingGroups.length > 0) ? 'matching' : 'multiple_choice',
            isMultiQuiz: false,
            base64Images: [],
            customPromptPrefix: null
        };

        const imagePromises = imageUrls.map(url => imageToBase64(url));
        try {
            questionData.base64Images = (await Promise.all(imagePromises)).filter(img => img !== null);
            const answer = await getAnswer(questionData);
            answerContentDiv.innerHTML = formatAIResponse(answer);
        } catch (err) {
            answerContentDiv.innerHTML = formatAIResponse("Error processing question.");
        } finally {
            isProcessingAI = false;
            isExtensionModifyingDOM = false;
        }
    }

    let observer;
    function initializeObserver() {
        if (observer) observer.disconnect();
        const observerTarget = document.documentElement;
        if (observerTarget) {
            observer = new MutationObserver((mutationsList) => {
                if (isExtensionModifyingDOM) return;
                handlePageContentChange();
            });
            observer.observe(observerTarget, { childList: true, subtree: true });
        }
    }

    initializeObserver();
    window.addEventListener('load', () => handlePageContentChange(true));
    window.addEventListener('popstate', () => handlePageContentChange(true));
    
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
             const match = url.match(/hw\/([a-zA-Z0-9]+)/);
             if (match && match[1] !== justClassHash) {
                 justClassApiCache = null;
                 justClassHash = null;
             }
            handlePageContentChange(true);
        }
    }).observe(document, {subtree: true, childList: true});
})();