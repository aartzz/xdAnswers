(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};

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

    window.xdAnswers.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    window.xdAnswers.isProcessingAI = false;
    window.xdAnswers.helperContainer = null;
    window.xdAnswers.answerContentDiv = null;
    window.xdAnswers.dragHeader = null;
    window.xdAnswers.isHelperWindowMaximized = false;
    window.xdAnswers.isManuallyPositioned = false;
    window.xdAnswers.currentHelperParentNode = null;
    window.xdAnswers.isExtensionModifyingDOM = false;
    window.xdAnswers.lastRequestBody = null;
    window.xdAnswers.onRefresh = null;

    const defaultHelperState = {
        width: '350px', height: 'auto', maxHeight: '400px',
        bottom: '20px', right: '20px', top: 'auto', left: 'auto'
    };
    const maximizedHelperState = {
        width: '70vw', height: '70vh', maxHeight: 'none',
        top: '15vh', left: '15vw', bottom: 'auto', right: 'auto'
    };

    // --- Core Functions ---

    window.xdAnswers.loadSettings = async function() {
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
                console.error("xdAnswers: Failed to parse settings.", e);
            }
        }
        window.xdAnswers.settings = loadedSettings;
        return loadedSettings;
    };

    window.xdAnswers.makeRequest = function(options) {
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
    };

    window.xdAnswers.addStyle = function(css) {
        let styleElement = document.getElementById('xdAnswers-styles');
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'xdAnswers-styles';
            document.head.appendChild(styleElement);
        }
        if (styleElement.textContent !== css) {
            styleElement.textContent = css;
        }
    };

    window.xdAnswers.imageToBase64 = async function(url) {
        try {
            const response = await window.xdAnswers.makeRequest({ method: 'GET', url: url, responseType: 'blob' });
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
    };

    window.xdAnswers.formatAIResponse = function(text) {
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
    };

    // --- Draggable Module ---
    window.xdAnswers.Draggable = (function() {
        let instance;
        function createDraggable(container, handle, onDragStartCallback) {
            let isDragging = false;
            let startX, startY, initialTop, initialLeft;

            const getCoords = (e) => {
                if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
                return { x: e.clientX, y: e.clientY };
            };

            const onDragStart = (e) => {
                if (e.target.tagName === 'BUTTON' || (e.target.parentElement && e.target.parentElement.tagName === 'BUTTON')) return;
                if (e.type === 'touchstart') e.preventDefault();
                isDragging = true;
                if (onDragStartCallback) onDragStartCallback();
                const coords = getCoords(e);
                const rect = container.getBoundingClientRect();
                initialTop = rect.top; initialLeft = rect.left;
                startX = coords.x; startY = coords.y;
                container.style.top = `${initialTop}px`; container.style.left = `${initialLeft}px`;
                container.style.right = 'auto'; container.style.bottom = 'auto';
                document.addEventListener('mousemove', onDragMove); document.addEventListener('touchmove', onDragMove, { passive: false });
                document.addEventListener('mouseup', onDragEnd, { once: true }); document.addEventListener('touchend', onDragEnd, { once: true });
            };

            const onDragMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const coords = getCoords(e);
                const dx = coords.x - startX; const dy = coords.y - startY;
                container.style.transform = `translate(${dx}px, ${dy}px)`;
            };

            const onDragEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                document.removeEventListener('mousemove', onDragMove); document.removeEventListener('touchmove', onDragMove);
                const currentTransform = new DOMMatrix(getComputedStyle(container).transform);
                const finalTop = initialTop + currentTransform.m42;
                const finalLeft = initialLeft + currentTransform.m41;
                container.style.transform = ''; container.style.top = `${finalTop}px`; container.style.left = `${finalLeft}px`;
            };

            const destroy = () => {
                handle.removeEventListener('mousedown', onDragStart); handle.removeEventListener('touchstart', onDragStart);
                document.removeEventListener('mousemove', onDragMove); document.removeEventListener('touchmove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd); document.removeEventListener('touchend', onDragEnd);
            };

            handle.addEventListener('mousedown', onDragStart); handle.addEventListener('touchstart', onDragStart, { passive: false });
            return { destroy };
        }
        return {
            init: function(c, h, cb) { if (instance) instance.destroy(); instance = createDraggable(c, h, cb); },
            destroy: function() { if (instance) { instance.destroy(); instance = null; } }
        };
    })();

    // --- UI Logic ---
    window.xdAnswers.updateHelperBaseStyles = function() {
        const custom = window.xdAnswers.settings.customization;
        const isMaximized = window.xdAnswers.isHelperWindowMaximized;
        window.xdAnswers.addStyle(`:root {
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
            width:${isMaximized ? maximizedHelperState.width : defaultHelperState.width} !important;
            height:${isMaximized ? maximizedHelperState.height : defaultHelperState.height} !important;
            max-height:${isMaximized ? maximizedHelperState.maxHeight : defaultHelperState.maxHeight} !important;
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
        @keyframes spin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }`);
    };

    window.xdAnswers.createUI = function() {
        if (!window.xdAnswers.helperContainer) {
            const container = document.createElement('div');
            container.className = 'ollama-helper-container';
            container.innerHTML = `
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
            
            window.xdAnswers.helperContainer = container;
            window.xdAnswers.answerContentDiv = container.querySelector('#ollama-answer-content');
            window.xdAnswers.dragHeader = container.querySelector('#ollama-helper-drag-header');
            
            window.xdAnswers.attachHelperEventListeners();
            window.xdAnswers.updateHelperBaseStyles();
        }
    };

    window.xdAnswers.attachHelperEventListeners = function() {
        const container = window.xdAnswers.helperContainer;
        if (!container) return;
        let resizeBtn = container.querySelector('#resize-helper-btn');
        let copyBtn = container.querySelector('#copy-answer-btn');
        let showReqBtn = container.querySelector('#show-request-btn');
        let refreshAnsBtn = container.querySelector('#refresh-answer-btn');

        if (!resizeBtn) return;
        window.xdAnswers.Draggable.init(container, window.xdAnswers.dragHeader, () => {
            window.xdAnswers.isManuallyPositioned = true;
        });
        resizeBtn.onclick = () => {
            window.xdAnswers.isHelperWindowMaximized = !window.xdAnswers.isHelperWindowMaximized;
            window.xdAnswers.isManuallyPositioned = false;
            window.xdAnswers.attachAndPositionHelper();
            resizeBtn.textContent = window.xdAnswers.isHelperWindowMaximized ? '➖' : '➕';
        };
        copyBtn.onclick = async () => {
            const div = window.xdAnswers.answerContentDiv;
            if (!div) return;
            const text = div.innerText;
            if (text && text !== 'Waiting for question...' && !div.querySelector('.loader')) {
                try { await navigator.clipboard.writeText(text); copyBtn.textContent = '✅'; } catch (err) { copyBtn.textContent = '❌'; }
                setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
            }
        };
        showReqBtn.onclick = () => {
            let requestToShow = null;
            const body = window.xdAnswers.lastRequestBody;
            if (body) {
                if (body.prompt) requestToShow = body.prompt;
                else if (body.messages) requestToShow = JSON.stringify(body.messages, null, 2);
                else if (body.contents) requestToShow = JSON.stringify(body.contents, null, 2);
            }
            alert(requestToShow ? `Request:\n${requestToShow}` : 'No request data.');
        };
        refreshAnsBtn.onclick = () => {
            if (window.xdAnswers.onRefresh) window.xdAnswers.onRefresh();
            else alert("No active question to refresh.");
        };
    };

    window.xdAnswers.attachAndPositionHelper = function(targetContainerOverride) {
        if (window.xdAnswers.isExtensionModifyingDOM) return;
        window.xdAnswers.isExtensionModifyingDOM = true;
        
        window.xdAnswers.createUI();
        const container = window.xdAnswers.helperContainer;
        container.style.transform = '';

        let determinedTargetParent = targetContainerOverride || document.body;
        let useDefaultPositioning = true;

        if (!targetContainerOverride && location.hostname.includes('vseosvita.ua') && (location.pathname.includes('/test/go-olp') || location.pathname.startsWith('/test/start/'))) {
            const vseosvitaFullScreenContainer = document.querySelector('.full-screen-container');
            if (vseosvitaFullScreenContainer && document.body.contains(vseosvitaFullScreenContainer)) {
                determinedTargetParent = vseosvitaFullScreenContainer;
                useDefaultPositioning = false;
            }
        }

        if (!container.parentNode || container.parentNode !== determinedTargetParent) {
            if (container.parentNode) container.parentNode.removeChild(container);
            determinedTargetParent.appendChild(container);
            window.xdAnswers.isManuallyPositioned = false;
        }
        window.xdAnswers.currentHelperParentNode = determinedTargetParent;
        window.xdAnswers.updateHelperBaseStyles();

        if (useDefaultPositioning) {
            if (!window.xdAnswers.isManuallyPositioned) {
                const isMax = window.xdAnswers.isHelperWindowMaximized;
                Object.assign(container.style, isMax ? 
                    { top: maximizedHelperState.top, left: maximizedHelperState.left, bottom: 'auto', right: 'auto' } :
                    { top: 'auto', left: 'auto', bottom: defaultHelperState.bottom, right: defaultHelperState.right });
            }
        } else {
            if (!window.xdAnswers.isManuallyPositioned) {
                Object.assign(container.style, { top: 'auto', left: 'auto', bottom: '10px', right: '10px' });
            }
        }
        window.xdAnswers.isExtensionModifyingDOM = false;
    };

    // --- AI Logic ---
    window.xdAnswers.getAnswer = async function(questionData) {
        const settings = window.xdAnswers.settings;
        const service = settings.activeService;
        let instruction = questionData.customPromptPrefix || settings.promptPrefix;
        
        if (!questionData.customPromptPrefix) {
            if (["short_text", "paragraph", "open_ended"].includes(questionData.questionType)) {
                instruction = "Provide a detailed answer to the following open-ended question:";
            } else if (questionData.isMultiQuiz) {
                instruction += `\nThis question may have MULTIPLE correct answers. List them.`;
            } else if (questionData.questionType === 'matching') {
                instruction += `\nThis is a matching task. Match items from Column A to Column B.`;
            }
        }

        let prompt = instruction + "\n\nQuestion: " + questionData.text;
        if (questionData.optionsText) prompt += "\nOptions:\n" + questionData.optionsText;

        const images = questionData.base64Images || [];
        window.xdAnswers.lastRequestBody = {};
        
        // !!! FIX: Changed 'body' to 'data' in makeRequest calls !!!

        if (service === 'Ollama') {
             const body = { model: settings.Ollama.model, prompt: prompt, stream: false };
             if (images.length > 0) body.images = images;
             window.xdAnswers.lastRequestBody = body;
             
             const response = await window.xdAnswers.makeRequest({
                url: `${settings.Ollama.host}/api/generate`,
                method: 'POST',
                data: JSON.stringify(body) // FIXED
            });
            return JSON.parse(response.data).response;
        } 
        else if (service === 'OpenAI') {
            const content = [{ type: "text", text: prompt }];
            images.forEach(img => content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img}` } }));
            const body = { model: settings.OpenAI.model, messages: [{ role: "user", content: content }], max_tokens: 1000 };
            window.xdAnswers.lastRequestBody = body;

            const response = await window.xdAnswers.makeRequest({
                url: "https://api.openai.com/v1/chat/completions",
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${settings.OpenAI.apiKey}`,
                    "Content-Type": "application/json" // ADDED
                },
                data: JSON.stringify(body) // FIXED
            });
            return JSON.parse(response.data).choices[0].message.content;
        }
        else if (service === 'Gemini') {
            const parts = [{ text: prompt }];
            images.forEach(img => parts.push({ inline_data: { mime_type: "image/jpeg", data: img } }));
            const body = { contents: [{ parts: parts }] };
            window.xdAnswers.lastRequestBody = body;

            const response = await window.xdAnswers.makeRequest({
                url: `https://generativelanguage.googleapis.com/v1beta/models/${settings.Gemini.model}:generateContent?key=${settings.Gemini.apiKey}`,
                method: "POST",
                headers: { "Content-Type": "application/json" }, // ADDED
                data: JSON.stringify(body) // FIXED
            });
            return JSON.parse(response.data).candidates[0].content.parts[0].text;
        }
        else if (service === 'MistralAI') {
            const content = [{ type: "text", text: prompt }];
            images.forEach(img => content.push({ type: "image_url", image_url: `data:image/jpeg;base64,${img}` }));
            const body = { model: settings.MistralAI.model, messages: [{ role: "user", content: content }], max_tokens: 1000 };
            window.xdAnswers.lastRequestBody = body;

            const response = await window.xdAnswers.makeRequest({
                url: "https://api.mistral.ai/v1/chat/completions",
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${settings.MistralAI.apiKey}`,
                    "Content-Type": "application/json" // ADDED
                },
                data: JSON.stringify(body) // FIXED
            });
            return JSON.parse(response.data).choices[0].message.content;
        }
        throw new Error("Unknown Service Selected");
    };

    window.xdAnswers.processQuestion = async function(questionData) {
        if (window.xdAnswers.isProcessingAI) return;
        window.xdAnswers.createUI();
        window.xdAnswers.attachAndPositionHelper();
        window.xdAnswers.isProcessingAI = true;
        window.xdAnswers.answerContentDiv.innerHTML = '<div class="loader"></div>';
        
        try {
            const answer = await window.xdAnswers.getAnswer(questionData);
            window.xdAnswers.answerContentDiv.innerHTML = window.xdAnswers.formatAIResponse(answer);
        } catch (error) {
            window.xdAnswers.answerContentDiv.innerHTML = "Error: " + error.message;
        } finally {
            window.xdAnswers.isProcessingAI = false;
        }
    };

    chrome.runtime.onMessage.addListener(async (message) => {
        if (message.type === "settingsUpdated") {
            await window.xdAnswers.loadSettings();
            window.xdAnswers.updateHelperBaseStyles();
        }
    });

    window.xdAnswers.loadSettings();
})();