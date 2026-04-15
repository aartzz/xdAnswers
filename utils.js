(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};

    const DEFAULT_SYSTEM_PROMPT = `Відповідай на тестові питання. Формат відповіді — тільки такі поля, кожне з нового рядка:
answer: правильна відповідь
explanation: коротке пояснення (1-3 речення)
solution: Дано: ... Розв'язок: ...
confidence: 0-100%

Правила:
- answer: точний текст правильного варіанту, якщо є варіанти відповідей
- Якщо варіанти позначені як [зображення] — в answer вкажи ЛІТЕРУ варіанту (A, B, C...)
- Для кількох правильних відповідей розділяй "; "
- Відповідай мовою питання
- solution пиши тільки для задач з розрахунками (фізика, хімія, математика)
- confidence необов'язкове
- Виводь ТІЛЬКИ ці поля, без JSON, markdown, списків і зайвого тексту`;

    const DEFAULT_BASE_URLS = {
        openai: 'https://api.openai.com/v1',
        anthropic: 'https://api.anthropic.com/v1',
        google: 'https://generativelanguage.googleapis.com/v1beta',
        deepseek: 'https://api.deepseek.com/v1',
        groq: 'https://api.groq.com/openai/v1',
        openrouter: 'https://openrouter.ai/api/v1',
        cerebras: 'https://api.cerebras.ai/v1',
        together: 'https://api.together.xyz/v1',
        fireworks: 'https://api.fireworks.ai/inference/v1',
        mistral: 'https://api.mistral.ai/v1',
        'unturf-hermes': 'https://hermes.ai.unturf.com/v1',
        'unturf-qwen': 'https://qwen.ai.unturf.com/v1',
        'unturf-vl': 'https://qwen-vl.ai.unturf.com/v1'
    };

    const API_FORMAT_MAP = {
        openai: 'openai', anthropic: 'anthropic', google: 'google',
        deepseek: 'openai', groq: 'openai', openrouter: 'openai',
        cerebras: 'openai', together: 'openai', fireworks: 'openai', mistral: 'openai',
        'unturf-hermes': 'openai', 'unturf-qwen': 'openai', 'unturf-vl': 'openai'
    };

    const DEFAULT_SETTINGS = {
        providers: [
            {
                id: 'unturf-hermes-default',
                type: 'unturf-hermes',
                name: 'Unturf Hermes',
                baseUrl: 'https://hermes.ai.unturf.com/v1',
                apiKey: 'free'
            },
            {
                id: 'unturf-qwen-default',
                type: 'unturf-qwen',
                name: 'Unturf Qwen',
                baseUrl: 'https://qwen.ai.unturf.com/v1',
                apiKey: 'free'
            },
            {
                id: 'unturf-vl-default',
                type: 'unturf-vl',
                name: 'Unturf Vision',
                baseUrl: 'https://qwen-vl.ai.unturf.com/v1',
                apiKey: 'free'
            }
        ],
        activeProviderId: 'unturf-vl-default',
        model: '',
        promptPrefix: DEFAULT_SYSTEM_PROMPT,
        autoAnswer: false,
        autoAnswerCooldown: 2000,
        highlightCorrect: true,
        silentMode: '',
        _silentModePreselect: 'indicators',
        customization: {
            glowEffect: false,
            borderColor: '#6366f1',
            contentColor: '#1e1e2e',
            headerColor: '#2a2a3e',
            textColor: '#cdd6f4'
        }
    };

    function getActiveProvider(s) {
        if (!s.providers || !s.providers.length) return null;
        return s.providers.find(p => p.id === s.activeProviderId) || s.providers[0];
    }

    function getEffectiveSettings(s) {
        const active = getActiveProvider(s);
        if (!active) return { apiFormat: 'openai', baseUrl: DEFAULT_BASE_URLS.openai, apiKey: '', model: s.model, promptPrefix: s.promptPrefix };
        const apiFormat = API_FORMAT_MAP[active.type] || (active.type === 'other' ? 'openai' : active.type);
        const baseUrl = active.baseUrl || DEFAULT_BASE_URLS[active.type] || DEFAULT_BASE_URLS.openai;
        return {
            apiFormat: apiFormat,
            baseUrl: baseUrl,
            apiKey: active.apiKey,
            model: s.model,
            promptPrefix: s.promptPrefix
        };
    }

    window.xdAnswers.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
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
    window.xdAnswers.lastParsedResponse = null;
    window.xdAnswers._cancelStream = null;
    window.xdAnswers._originalTitle = null;

    const defaultHelperState = {
        width: '380px', height: 'auto', maxHeight: '450px',
        bottom: '20px', right: '20px', top: 'auto', left: 'auto'
    };
    const maximizedHelperState = {
        width: '70vw', height: '70vh', maxHeight: 'none',
        top: '15vh', left: '15vw', bottom: 'auto', right: 'auto'
    };

    // ── Settings ──

    window.xdAnswers.loadSettings = async function() {
        const data = await chrome.storage.local.get('xdAnswers_settings');
        let s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        if (data.xdAnswers_settings) {
            try {
                const p = JSON.parse(data.xdAnswers_settings);

                // Migration from old flat format
                if (p.apiFormat && !p.providers) {
                    const oldDefaults = { openai: 'https://api.openai.com/v1', anthropic: 'https://api.anthropic.com', google: 'https://generativelanguage.googleapis.com' };
                    let baseUrl = p.baseUrl || DEFAULT_BASE_URLS[p.apiFormat] || '';
                    if (oldDefaults[p.apiFormat] === baseUrl) {
                        baseUrl = DEFAULT_BASE_URLS[p.apiFormat];
                    }
                    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                    const providerNames = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google (Gemini)' };
                    p.providers = [{
                        id: id,
                        type: p.apiFormat,
                        name: providerNames[p.apiFormat] || p.apiFormat,
                        baseUrl: baseUrl,
                        apiKey: p.apiKey || ''
                    }];
                    p.activeProviderId = id;
                    delete p.apiFormat;
                    delete p.baseUrl;
                    delete p.apiKey;
                }

                s = { ...s, ...p, providers: p.providers || [], customization: { ...s.customization, ...(p.customization || {}) } };

                // Міграція: додати безкоштовні unturf провайдери для юзерів з порожнім списком
                if (!s.providers || s.providers.length === 0) {
                    s.providers = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.providers));
                    s.activeProviderId = DEFAULT_SETTINGS.activeProviderId;
                }
                if (typeof s.promptPrefix !== 'string' || !s.promptPrefix.trim()) {
                    s.promptPrefix = DEFAULT_SETTINGS.promptPrefix;
                }
                // Migrate silentMode: true/false → string
                if (typeof s.silentMode === 'boolean') {
                    s.silentMode = s.silentMode ? 'ghost' : '';
                }
            } catch (e) {
                console.error('xdAnswers: Failed to parse settings.', e);
            }
        }
        window.xdAnswers.settings = s;
        // Update footer model name
        const footerModel = document.getElementById('xd-footer-model');
        if (footerModel) footerModel.textContent = s.model || 'select model ↗';
        return s;
    };

    // ── Network ──

    window.xdAnswers.makeRequest = function(options) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'fetch', payload: options }, (response) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else if (response && response.success) resolve(response);
                else {
                    const details = response.details ? '\n' + response.details : '';
                    reject(new Error((response.error || 'Unknown error') + details));
                }
            });
        });
    };

    window.xdAnswers.streamRequest = function(options, onChunk, onDone, onError) {
        const port = chrome.runtime.connect({ name: 'xdAnswers-stream' });
        port.postMessage({ type: 'fetch_stream', payload: options });
        port.onMessage.addListener((msg) => {
            if (msg.type === 'chunk') onChunk(msg.data);
            else if (msg.type === 'done') { onDone(); port.disconnect(); }
            else if (msg.type === 'error') { onError(msg.error, msg.details); port.disconnect(); }
        });
        return () => { try { port.disconnect(); } catch(e) {} };
    };

    // ── Utilities ──

    window.xdAnswers.addStyle = function(css) {
        let el = document.getElementById('xdAnswers-styles');
        if (!el) { el = document.createElement('style'); el.id = 'xdAnswers-styles'; document.head.appendChild(el); }
        if (el.textContent !== css) el.textContent = css;
    };

    window.xdAnswers.imageToBase64 = async function(url) {
        try {
            const response = await window.xdAnswers.makeRequest({ method: 'GET', url, responseType: 'blob' });
            if (response?.success && response.data && typeof response.data === 'string' && response.data.startsWith('data:')) {
                return response.data.split(',', 2)[1] || null;
            }
            return null;
        } catch { return null; }
    };

    // ── Markdown Renderer ──

    window.xdAnswers.renderMarkdown = function(text) {
        if (!text) return '';
        let h = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
            '<pre class="xd-code"><code>' + code.trim() + '</code></pre>');
        h = h.replace(/`([^`]+)`/g, '<code class="xd-icode">$1</code>');
        h = h.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="xd-latex-block">$1</div>');
        h = h.replace(/\$([^\$\n]+)\$/g, '<span class="xd-latex">$1</span>');
        h = h.replace(/^### (.+)$/gm, '<h4>$1</h4>');
        h = h.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        h = h.replace(/^# (.+)$/gm, '<h2>$1</h2>');
        h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        h = h.replace(/__(.+?)__/g, '<strong>$1</strong>');
        h = h.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
        h = h.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');
        h = h.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
        h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
        h = h.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        h = h.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        h = h.replace(/\n/g, '<br>');
        h = h.replace(/<br>(<\/ul>)/g, '$1').replace(/(<ul>)<br>/g, '$1');
        return h;
    };

    // ── AI Request Building ──

    function buildMessages(questionData) {
        const settings = window.xdAnswers.settings;
        let systemPrompt = questionData.customPromptPrefix || settings.promptPrefix;

        let userMsg = '';
        if (questionData.questionType === 'matching') {
            userMsg += 'Це завдання на відповідність. Зістав елементи.\n\n';
        } else if (questionData.isMultiQuiz) {
            userMsg += 'Це питання може мати КІЛЬКА правильних відповідей.\n\n';
        } else if (['short_text', 'paragraph', 'open_ended'].includes(questionData.questionType)) {
            userMsg += 'Це відкрите питання. Дай розгорнуту відповідь.\n\n';
        }

        userMsg += 'Питання: ' + questionData.text;
        if (questionData.optionsText) {
            userMsg += '\nВаріанти:\n' + questionData.optionsText;
            // Якщо є варіанти-зображення, підкажемо AI що вони серед прикріплених картинок
            if (questionData.optionsText.includes('[зображення]') && (questionData.base64Images || []).length > 0) {
                userMsg += '\nУВАГА: Варіанти позначені [зображення] — це картинки серед прикріплених зображень. Спочатку йде картинка запитання, потім картинки варіантів у порядку A, B, C...';
            }
        }

        return { systemPrompt, userMsg };
    }

    function buildStreamUrl(s) {
        if (s.apiFormat === 'openai') return s.baseUrl + '/chat/completions';
        if (s.apiFormat === 'anthropic') return s.baseUrl + '/messages';
        if (s.apiFormat === 'google') return s.baseUrl + '/models/' + s.model + ':streamGenerateContent?alt=sse&key=' + s.apiKey;
        throw new Error('Unknown API format: ' + s.apiFormat);
    }

    function buildNonStreamUrl(s) {
        if (s.apiFormat === 'openai') return s.baseUrl + '/chat/completions';
        if (s.apiFormat === 'anthropic') return s.baseUrl + '/messages';
        if (s.apiFormat === 'google') return s.baseUrl + '/models/' + s.model + ':generateContent?key=' + s.apiKey;
        throw new Error('Unknown API format: ' + s.apiFormat);
    }

    function buildHeaders(s) {
        const h = { 'Content-Type': 'application/json' };
        if (s.apiFormat === 'openai') {
            h['Authorization'] = 'Bearer ' + s.apiKey;
            // OpenRouter needs additional headers
            if (s.baseUrl && s.baseUrl.includes('openrouter.ai')) {
                h['HTTP-Referer'] = 'https://xdanswers.app';
                h['X-Title'] = 'xdAnswers';
            }
        }
        else if (s.apiFormat === 'anthropic') {
            h['x-api-key'] = s.apiKey;
            h['anthropic-version'] = '2023-06-01';
            h['anthropic-dangerous-direct-browser-access'] = 'true';
        }
        return h;
    }

    function buildRequestBody(s, systemPrompt, userMsg, images, stream) {
        if (s.apiFormat === 'openai') {
            const messages = [];
            if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
            const userContent = [{ type: 'text', text: userMsg }];
            images.forEach(img => userContent.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + img } }));
            messages.push({ role: 'user', content: images.length > 0 ? userContent : userMsg });
            const body = { model: s.model, messages, max_tokens: 4096 };
            if (stream) body.stream = true;
            return body;
        }

        if (s.apiFormat === 'anthropic') {
            const userContent = [{ type: 'text', text: userMsg }];
            images.forEach(img => userContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }));
            const body = { model: s.model, messages: [{ role: 'user', content: userContent }], max_tokens: 4096 };
            if (systemPrompt) body.system = systemPrompt;
            if (stream) body.stream = true;
            return body;
        }

        if (s.apiFormat === 'google') {
            const userParts = [];
            if (systemPrompt) userParts.push({ text: systemPrompt + '\n\n' + userMsg });
            else userParts.push({ text: userMsg });
            images.forEach(img => userParts.push({ inline_data: { mime_type: 'image/jpeg', data: img } }));
            return { contents: [{ parts: userParts }] };
        }

        throw new Error('Unknown API format: ' + s.apiFormat);
    }

    function parseSSEChunks(rawText, apiFormat) {
        const results = [];
        const lines = rawText.split('\n');

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') { results.push({ done: true }); continue; }

            try {
                const json = JSON.parse(data);

                if (apiFormat === 'openai') {
                    const choice = json.choices?.[0];
                    if (!choice) continue;
                    if (choice.finish_reason) { results.push({ done: true }); continue; }
                    const delta = choice.delta || {};
                    if (delta.reasoning_content) results.push({ thinking: delta.reasoning_content });
                    else if (delta.content) results.push({ content: delta.content });
                } else if (apiFormat === 'anthropic') {
                    if (json.type === 'content_block_delta') {
                        if (json.delta?.type === 'thinking_delta') results.push({ thinking: json.delta.thinking });
                        else if (json.delta?.type === 'text_delta') results.push({ content: json.delta.text });
                    } else if (json.type === 'message_stop') {
                        results.push({ done: true });
                    }
                } else if (apiFormat === 'google') {
                    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) results.push({ content: text });
                    if (json.candidates?.[0]?.finishReason === 'STOP') results.push({ done: true });
                }
            } catch (e) { /* partial JSON chunk, skip */ }
        }
        return results;
    }

    // ── AI Calls ──

    window.xdAnswers.getAnswer = async function(questionData) {
        const s = getEffectiveSettings(window.xdAnswers.settings);
        const { systemPrompt, userMsg } = buildMessages(questionData);
        const images = questionData.base64Images || [];
        const body = buildRequestBody(s, systemPrompt, userMsg, images, false);
        window.xdAnswers.lastRequestBody = body;

        const response = await window.xdAnswers.makeRequest({
            url: buildNonStreamUrl(s), method: 'POST', headers: buildHeaders(s), data: JSON.stringify(body)
        });

        const parsed = JSON.parse(response.data);
        if (s.apiFormat === 'openai') return parsed.choices[0].message.content;
        if (s.apiFormat === 'anthropic') {
            const tb = parsed.content.find(b => b.type === 'text');
            return tb ? tb.text : '';
        }
        if (s.apiFormat === 'google') return parsed.candidates[0].content.parts[0].text;
        throw new Error('Unknown API format');
    };

    window.xdAnswers.streamAnswer = function(questionData, outerStartTime) {
        return new Promise((resolve, reject) => {
            const s = getEffectiveSettings(window.xdAnswers.settings);
            const { systemPrompt, userMsg } = buildMessages(questionData);
            const images = questionData.base64Images || [];
            const body = buildRequestBody(s, systemPrompt, userMsg, images, true);
            window.xdAnswers.lastRequestBody = body;

             let fullContent = '';
            let fullThinking = '';
            const startTime = outerStartTime || Date.now();
            const contentDiv = window.xdAnswers.answerContentDiv;
            let thinkingStarted = false;
            let thinkingDone = false;
            let streamTimerInterval = null;
            let statusCleared = false;

            function getElapsed() {
                const sec = Math.floor((Date.now() - startTime) / 1000);
                return sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's';
            }

            // Single timer that always updates footer + thinking timer (stops thinking timer when thinking ends)
            function startStreamTimer() {
                if (streamTimerInterval) return;
                streamTimerInterval = setInterval(() => {
                    const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
                    if (footerElapsed) footerElapsed.textContent = '⏱ ' + getElapsed();
                    // Only update thinking timer while thinking is still in progress
                    if (!thinkingDone) {
                        const thinkingTimer = contentDiv?.querySelector('.xd-thinking-timer');
                        if (thinkingTimer) thinkingTimer.textContent = '(' + getElapsed() + ')';
                    }
                }, 1000);
            }

            function stopStreamTimer() {
                if (streamTimerInterval) { clearInterval(streamTimerInterval); streamTimerInterval = null; }
            }

            function clearStatus() {
                if (statusCleared) return;
                statusCleared = true;
                if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
                const status = contentDiv?.querySelector('.xd-status');
                const loader = contentDiv?.querySelector('.xd-loader');
                if (status) status.remove();
                if (loader) loader.remove();
                // Start persistent stream timer when status is cleared
                 startStreamTimer();
            }

            function ensureThinkingUI() {
                if (thinkingStarted || !contentDiv) return;
                clearStatus();
                thinkingStarted = true;
                contentDiv.innerHTML =
                    '<div class="xd-thinking">' +
                    '<div class="xd-thinking-header" style="cursor:pointer;">💭 Thinking... <span class="xd-thinking-timer">(0s)</span> <span class="xd-thinking-chars"></span> <span class="xd-thinking-toggle">▼</span></div>' +
                    '<div class="xd-thinking-content" style="display:none !important;"></div>' +
                    '</div>';
                const header = contentDiv.querySelector('.xd-thinking-header');
                header.addEventListener('click', function() { toggleThinkingContent(this); });
            }

            function updateStreamUI() {
                if (!contentDiv) return;
                clearStatus();
                
                const elapsed = getElapsed();
                let html = '';
                
                // Thinking block always first (at the top)
                if (thinkingStarted) {
                    html += '<div class="xd-thinking">' +
                        '<div class="xd-thinking-header" style="cursor:pointer;">💭 Thinking <span class="xd-thinking-timer">(' + elapsed + ')</span> <span class="xd-thinking-chars">(' + fullThinking.length + ' chars)</span> <span class="xd-thinking-toggle">▼</span></div>' +
                        '<div class="xd-thinking-content" style="display:none !important;">' + window.xdAnswers.renderMarkdown(fullThinking) + '</div></div>';
                }

                const parsed = parsePartialLabeled(fullContent) || salvagePartialJSON(fullContent);
                
                if (parsed) {
                    html += renderPartial(parsed);
                } else if (fullContent.trim()) {
                    html += '<div class="xd-answer xd-answer-partial">' + window.xdAnswers.renderMarkdown(fullContent) + '</div>';
                } else {
                    html += '<div class="xd-waiting">⏳ Waiting for answer...</div>';
                }
                
                contentDiv.innerHTML = html;
                const th = contentDiv.querySelector('.xd-thinking-header');
                if (th) th.addEventListener('click', function() { toggleThinkingContent(this); });
            }

            const cancel = window.xdAnswers.streamRequest(
                { url: buildStreamUrl(s), method: 'POST', headers: buildHeaders(s), data: JSON.stringify(body) },
                (chunk) => {
                    const events = parseSSEChunks(chunk, s.apiFormat);
                    for (const ev of events) {
                        if (ev.thinking) {
                            ensureThinkingUI();
                            fullThinking += ev.thinking;
                            const tc = contentDiv?.querySelector('.xd-thinking-content');
                            if (tc) tc.innerHTML = window.xdAnswers.renderMarkdown(fullThinking);
                            const chars = contentDiv?.querySelector('.xd-thinking-chars');
                            if (chars) chars.textContent = '(' + fullThinking.length + ' chars)';
                        }
                        if (ev.content) {
                            if (thinkingStarted && !thinkingDone) thinkingDone = true;
                            fullContent += ev.content;
                            updateStreamUI();
                        }
                    }
                },
                () => {
                    stopStreamTimer();
                    resolve({ content: fullContent, thinking: fullThinking });
                },
                (error, details) => {
                    stopStreamTimer();
                    reject(new Error(error + (details ? '\n' + details : '')));
                }
            );

            window.xdAnswers._cancelStream = cancel;
        });
    };

    // ── Response Parsing ──

    function parsePartialLabeled(text) {
        if (!text || !text.includes(':')) return null;

        const result = { answer: '', explanation: '', solution: '', confidence: '', isPartial: true };
        const lines = text.split('\n');
        let currentField = null;

        for (const line of lines) {
            const match = line.match(/^\s*([A-Za-zА-Яа-яІіЇїЄє'`]+)\s*:\s*(.*)$/);
            if (match) {
                const field = normalizeFieldName(match[1]);
                if (field && result.hasOwnProperty(field)) {
                    currentField = field;
                    result[field] = match[2].trim();
                    continue;
                }
            }
            if (currentField && line.trim()) {
                result[currentField] += (result[currentField] ? '\n' : '') + line.trim();
            }
        }

        const hasAny = result.answer || result.explanation || result.solution;
        return hasAny ? result : null;
    }

    function renderPartial(parsed) {
        let html = '';
        if (parsed.answer) html += '<div class="xd-answer xd-answer-partial">' + window.xdAnswers.renderMarkdown(parsed.answer) + '</div>';
        if (parsed.explanation) html += '<div class="xd-explanation">' + window.xdAnswers.renderMarkdown(parsed.explanation) + '</div>';
        if (parsed.solution) html += '<div class="xd-solution"><strong>Розв\'язок:</strong><br>' + window.xdAnswers.renderMarkdown(parsed.solution) + '</div>';
        if (parsed.confidence) html += '<div class="xd-confidence">Confidence: ' + parsed.confidence + '</div>';
        return html;
    }

    function formatError(msg) {
        if (!msg) return '<div class="xd-error">Unknown error</div>';
        
        const imageErrorMatch = msg.match(/Cannot read ["']([^"']+)["'].*does not support image input/i);
        if (imageErrorMatch) {
            return '<div class="xd-error"><strong>Image error:</strong> Model does not support image input. Try a vision-enabled model.</div>';
        }
        
        let code = 'Error';
        let detail = msg;
        try {
            const parsed = JSON.parse(msg);
            code = 'API ' + (parsed.status || parsed.code || parsed.error?.code || 'Error');
            detail = parsed.statusText || parsed.message || parsed.error?.message || parsed.responseText || msg;
            if (detail.length > 200) detail = detail.substring(0, 200) + '...';
        } catch {}
        if (!detail.startsWith('{')) {
            const m = msg.match(/^(API Error:\s*\d+)/);
            if (m) code = m[1];
            detail = msg.replace(/^API Error:\s*\d+\s*/, '').trim();
            if (detail.length > 200) detail = detail.substring(0, 200) + '...';
        }
        return '<div class="xd-error"><strong>' + code + ':</strong> ' + detail + '</div>';
    }

    function normalizeFieldName(name) {
        const normalized = (name || '').trim().toLowerCase();
        if (['answer', 'відповідь'].includes(normalized)) return 'answer';
        if (['explanation', 'пояснення'].includes(normalized)) return 'explanation';
        if (['solution', 'розв\'язок', 'розвязок'].includes(normalized)) return 'solution';
        if (['confidence', 'впевненість'].includes(normalized)) return 'confidence';
        return null;
    }

    function parseLabeledResponse(text) {
        if (!text) return null;

        const cleaned = text
            .replace(/```(?:json|yaml|txt)?/gi, '')
            .replace(/```/g, '')
            .trim();

        const lines = cleaned.split('\n');
        const result = { answer: '', explanation: '', solution: '', confidence: '', raw: text, isStructured: false };
        let currentField = null;

        for (const line of lines) {
            const match = line.match(/^\s*([A-Za-zА-Яа-яІіЇїЄє'`]+)\s*:\s*(.*)$/);
            if (match) {
                const field = normalizeFieldName(match[1]);
                if (field) {
                    currentField = field;
                    result[field] = match[2].trim();
                    result.isStructured = true;
                    continue;
                }
            }

            if (currentField && line.trim()) {
                result[currentField] += (result[currentField] ? '\n' : '') + line.trim();
            }
        }

        return result.isStructured ? result : null;
    }

    function extractJSONString(text) {
        if (!text) return '';
        const start = text.indexOf('{');
        if (start === -1) return '';

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < text.length; i++) {
            const ch = text[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (ch === '\\') {
                escaped = true;
                continue;
            }

            if (ch === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (ch === '{') depth++;
            if (ch === '}') {
                depth--;
                if (depth === 0) return text.slice(start, i + 1);
            }
        }

        return text.slice(start);
    }

    function extractFieldValue(text, fieldName) {
        const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
            new RegExp('"' + escapedField + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"', 'i'),
            new RegExp('"' + escapedField + '"\\s*:\\s*([\\s\\S]+?)(?:,\\s*"[^"]+"\\s*:|\\s*}$)', 'i'),
            new RegExp('"' + escapedField + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)$', 'i')
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match?.[1]) {
                return match[1]
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r')
                    .replace(/\\t/g, '\t')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\')
                    .trim();
            }
        }

        return '';
    }

    function salvagePartialJSON(text) {
        const candidate = extractJSONString(text) || text;
        const answer = extractFieldValue(candidate, 'answer');
        const explanation = extractFieldValue(candidate, 'explanation');
        const solution = extractFieldValue(candidate, 'solution');
        const confidence = extractFieldValue(candidate, 'confidence');

        if (answer || explanation || solution) {
            return {
                answer,
                explanation,
                solution,
                confidence,
                raw: text,
                isJSON: true,
                isPartialJSON: true
            };
        }

        return null;
    }

    function parseAIResponse(text) {
        if (!text) return { answer: '', explanation: '', solution: '', confidence: '', raw: text, parseFailed: true };

        const labeled = parseLabeledResponse(text);
        if (labeled) return labeled;

        let jsonStr = text.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();

        try {
            const p = JSON.parse(jsonStr);
            return { answer: p.answer || '', explanation: p.explanation || '', solution: p.solution || '', confidence: p.confidence, raw: text, isJSON: true };
        } catch {
            const salvaged = salvagePartialJSON(jsonStr);
            if (salvaged) return salvaged;

            return { answer: '', explanation: '', solution: '', confidence: '', raw: text, isJSON: false, parseFailed: true };
        }
    }

    function renderParsedResponse(parsed) {
        if ((parsed.isJSON || parsed.isStructured) && parsed.answer) {
            let html = '<div class="xd-answer">' + window.xdAnswers.renderMarkdown(parsed.answer) + '</div>';
            if (parsed.explanation) html += '<div class="xd-explanation">' + window.xdAnswers.renderMarkdown(parsed.explanation) + '</div>';
            if (parsed.solution) html += '<div class="xd-solution"><strong>Розв\'язок:</strong><br>' + window.xdAnswers.renderMarkdown(parsed.solution) + '</div>';
            return html;
        }
        if (parsed.answer || parsed.explanation || parsed.solution) {
            let html = '';
            if (parsed.answer) html += '<div class="xd-answer">' + window.xdAnswers.renderMarkdown(parsed.answer) + '</div>';
            if (parsed.explanation) html += '<div class="xd-explanation">' + window.xdAnswers.renderMarkdown(parsed.explanation) + '</div>';
            if (parsed.solution) html += '<div class="xd-solution"><strong>Розв\'язок:</strong><br>' + window.xdAnswers.renderMarkdown(parsed.solution) + '</div>';
            return html;
        }
        if (parsed.raw && parsed.raw.trim()) {
            return '<div class="xd-answer">' + window.xdAnswers.renderMarkdown(parsed.raw) + '</div>';
        }
        return '<div class="xd-error"><strong>Parse error:</strong> Model returned an unreadable response.</div>';
    }

    // ── Option Matching ──

    function findOptionElements() {
        const selectors = [
            '[data-xd-option="true"]',
            '.question-option-inner-content',
            '.question-option-inner',
            '.answer-text',
            '.t-text-guest',
            '.t-text',
            '.test-answer',
            'label[for]',
            '.v-test-questions-select-block .t-text',
            '.v-test-questions-select-block .t-text-guest',
            '.n-kahoot-p',
            '.v-block-answers-cross-block .numb-item',
            '.justkids-answer-text',
            '[role="radio"] span',
            '[role="checkbox"] span',
            '[role="option"] span'
        ];
        for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            if (els.length > 1) return Array.from(els);
        }
        // Fallback: find all radio/checkbox labels
        const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        if (inputs.length > 1) {
            const labels = Array.from(inputs).map(inp => {
                const label = inp.closest('label') || inp.parentElement;
                return label || null;
            }).filter(Boolean);
            if (labels.length > 1) return labels;
        }
        return [];
    }

    function normalizeText(t) {
        return (t || '').replace(/\s+/g, ' ').trim().toLowerCase()
            .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, '')  // zero-width / nbsp
            .replace(/[.,;:!?()\-–—]/g, '')                     // strip punctuation for matching
            .trim();
    }

    function levenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = b[i - 1] === a[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        return matrix[b.length][a.length];
    }

    function textSimilarity(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 1;
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        // Exact substring match
        if (a.includes(b) || b.includes(a)) {
            return Math.min(a.length, b.length) / maxLen;
        }
        // Levenshtein-based similarity
        const dist = levenshtein(a, b);
        return 1 - dist / maxLen;
    }

    function matchAnswerToOptions(answerText, optionElements) {
        if (!answerText || !optionElements.length) return [];
        const answers = answerText.split(';').map(a => a.trim()).filter(Boolean);
        const matched = [];
        const usedElements = new Set();
        const optionLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        for (const ans of answers) {
            const normAns = normalizeText(ans);
            if (!normAns) continue;

            // Спочатку перевіряємо відповідність за літерою (A, B, C...) —
            // для варіантів-зображень, де немає тексту
            const letterMatch = normAns.match(/^([a-z])$/i);
            if (letterMatch) {
                const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
                if (idx >= 0 && idx < optionElements.length && !usedElements.has(optionElements[idx])) {
                    matched.push(optionElements[idx]);
                    usedElements.add(optionElements[idx]);
                    continue;
                }
            }

            // Також перевіряємо "варіант A", "варіант a" тощо
            const variantMatch = normAns.match(/(?:варіант|вариант|option|variant)\s*([a-z])/i);
            if (variantMatch) {
                const idx = variantMatch[1].toUpperCase().charCodeAt(0) - 65;
                if (idx >= 0 && idx < optionElements.length && !usedElements.has(optionElements[idx])) {
                    matched.push(optionElements[idx]);
                    usedElements.add(optionElements[idx]);
                    continue;
                }
            }

            let best = null, bestScore = 0;

            for (const el of optionElements) {
                if (usedElements.has(el)) continue;
                const normEl = normalizeText(el.innerText || el.textContent);
                if (!normEl) continue;

                // Exact match
                if (normEl === normAns) {
                    best = el; bestScore = 1; break;
                }

                const score = textSimilarity(normEl, normAns);
                if (score > bestScore) {
                    bestScore = score;
                    best = el;
                }
            }

            if (best && bestScore > 0.4) {
                matched.push(best);
                usedElements.add(best);
            }
        }
        return matched;
    }

    function highlightCorrectAnswer(answerText) {
        // Only highlight when setting is enabled and not in any silent mode
        if (!window.xdAnswers.settings.highlightCorrect) return;
        const silentMode = window.xdAnswers.settings.silentMode || '';
        if (silentMode !== '') return; // silent mode handles its own indicators/title/clipboard
        // Clear previous highlights first
        document.querySelectorAll('.xd-highlight-correct').forEach(el => {
            el.classList.remove('xd-highlight-correct');
            el.style.removeProperty('outline');
            el.style.removeProperty('background-color');
            el.style.removeProperty('border-radius');
        });
        const elements = matchAnswerToOptions(answerText, findOptionElements());
        for (const el of elements) {
            const target = el.closest('.question-option, .answer-item, .v-test-questions-select-block, label, [role="radio"], [role="checkbox"]') || el;
            target.classList.add('xd-highlight-correct');
            target.style.setProperty('outline', '3px solid #22c55e', 'important');
            target.style.setProperty('background-color', 'rgba(34, 197, 94, 0.15)', 'important');
            target.style.setProperty('border-radius', '4px', 'important');
        }
    }

    function autoSelectAnswer(answerText) {
        if (!window.xdAnswers.settings.autoAnswer) return;
        const optionElements = findOptionElements();
        const elements = matchAnswerToOptions(answerText, optionElements);

        setTimeout(() => {
            for (const el of elements) {
                // Try multiple click target strategies
                const clickTarget = el.closest('.question-option, .answer-item, .v-test-questions-select-block, label, [role="radio"], [role="checkbox"]') || el;
                
                // Strategy 1: Direct click
                clickTarget.click();
                
                // Strategy 2: If there's a radio/checkbox input inside, click it too
                const input = clickTarget.querySelector('input[type="radio"], input[type="checkbox"]') 
                    || clickTarget.closest('label')?.querySelector('input[type="radio"], input[type="checkbox"]');
                if (input && !input.checked) {
                    input.click();
                }
                
                // Strategy 3: Dispatch events for React/Angular apps
                clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            }
        }, window.xdAnswers.settings.autoAnswerCooldown);
    }

    // Global thinking toggle handler (accessible from all scopes)
    function toggleThinkingContent(headerEl) {
        const c = headerEl.nextElementSibling;
        if (!c) return;
        const toggle = headerEl.querySelector('.xd-thinking-toggle');
        const isHidden = c.style.display === 'none' || getComputedStyle(c).display === 'none';
        c.style.setProperty('display', isHidden ? 'block' : 'none', 'important');
        if (toggle) toggle.textContent = isHidden ? '▲' : '▼';
    }

    // Mini exit-silent-mode button (barely visible, bottom-right corner)
    function addSilentExitButton() {
        if (document.getElementById('xd-silent-exit-btn')) return;
        const btn = document.createElement('div');
        btn.id = 'xd-silent-exit-btn';
        btn.style.cssText = 'position:fixed;bottom:4px;right:4px;width:6px;height:6px;background:rgba(100,100,100,0.25);border-radius:50%;z-index:2147483647;cursor:pointer;transition:all 0.2s;';
        btn.title = 'xdAnswers: exit silent mode';
        btn.addEventListener('mouseenter', () => {
            btn.style.width = '10px';
            btn.style.height = '10px';
            btn.style.background = 'rgba(100,100,100,0.6)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.width = '6px';
            btn.style.height = '6px';
            btn.style.background = 'rgba(100,100,100,0.25)';
        });
        btn.addEventListener('click', () => {
            window.xdAnswers.settings.silentMode = '';
            document.querySelectorAll('.xd-indicator-dot').forEach(el => el.remove());
            if (window.xdAnswers._originalTitle) document.title = window.xdAnswers._originalTitle;
            btn.remove();
            // Save (storage.onChanged will sync UI)
            chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(window.xdAnswers.settings) });
            // Show helper
            if (window.xdAnswers.helperContainer) {
                window.xdAnswers.helperContainer.style.setProperty('display', 'flex', 'important');
                const silentModeBtn = window.xdAnswers.helperContainer.querySelector('#silent-mode-btn');
                const silentModeSelect = window.xdAnswers.helperContainer.querySelector('#silent-mode-inline-select');
                if (silentModeBtn) { silentModeBtn.classList.remove('active'); silentModeBtn.title = 'Silent mode: Off'; }
                if (silentModeSelect) { silentModeSelect.value = ''; silentModeSelect.style.display = 'none'; }
            }
        });
        document.body.appendChild(btn);
    }

    function applySilentMode(answerText, parsed) {
        const mode = window.xdAnswers.settings.silentMode;
        if (!mode) return;

        // Clear previous silent mode artifacts
        document.querySelectorAll('.xd-indicator-dot').forEach(el => el.remove());

        // Ghost (Page title): only change page title, no dots or visual indicators
        if (mode === 'ghost') {
            if (!window.xdAnswers._originalTitle) window.xdAnswers._originalTitle = document.title;
            document.title = '[' + answerText.substring(0, 60) + '] ' + window.xdAnswers._originalTitle;
        }

        // Indicators: overlay dot next to correct answer (no text displacement)
        if (mode === 'indicators') {
            const optionElements = matchAnswerToOptions(answerText, findOptionElements());
            for (const el of optionElements) {
                const wrapper = el.closest('.question-option, .answer-item, .v-test-questions-select-block, label, [role="radio"], [role="checkbox"]') || el;
                wrapper.style.position = 'relative';
                const indicator = document.createElement('span');
                indicator.className = 'xd-indicator-dot';
                indicator.style.cssText = 'position:absolute;top:50%;right:8px;transform:translateY(-50%);width:6px;height:6px;background:#22c55e;border-radius:50%;box-shadow:0 0 4px rgba(34,197,94,0.4);pointer-events:none;z-index:1;';
                indicator.title = answerText;
                wrapper.appendChild(indicator);
            }
        }

        // Stealth: copy answer to clipboard, no visual indicators
        if (mode === 'stealth') {
            if (answerText) {
                try {
                    navigator.clipboard.writeText(answerText);
                } catch {}
            }
        }
    }

    // ── Main Process ──

    window.xdAnswers.processQuestion = async function(questionData) {
        if (window.xdAnswers.isProcessingAI) return;

        const silentMode = window.xdAnswers.settings.silentMode || '';
        const isSilent = silentMode !== '';

        if (!isSilent) {
            window.xdAnswers.createUI();
            window.xdAnswers.attachAndPositionHelper();
        }

        window.xdAnswers.isProcessingAI = true;
        const startTime = Date.now();

        function getElapsed() {
            const ms = Date.now() - startTime;
            const sec = Math.floor(ms / 1000);
            return sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's';
        }

        if (!isSilent && window.xdAnswers.answerContentDiv) {
            window.xdAnswers.answerContentDiv.innerHTML = '<div class="xd-loader"></div>';
            const statusDiv = document.createElement('div');
            statusDiv.className = 'xd-status';
            statusDiv.textContent = '⏳ Connecting...';
            window.xdAnswers.answerContentDiv.appendChild(statusDiv);
            const statusInterval = setInterval(() => {
                // Always update footer elapsed
                const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
                if (footerElapsed) footerElapsed.textContent = '⏱ ' + getElapsed();
                // Update status text if still showing
                const s = window.xdAnswers.answerContentDiv?.querySelector('.xd-status');
                if (s) s.textContent = '⏳ Waiting for response...';
            }, 1000);
            window.xdAnswers._statusInterval = statusInterval;
        }

        try {
            let result;
            try {
                result = await window.xdAnswers.streamAnswer(questionData, startTime);
            } catch (streamErr) {
                console.warn('xdAnswers: Streaming failed, falling back:', streamErr.message);
                const answer = await window.xdAnswers.getAnswer(questionData);
                result = { content: answer, thinking: '' };
            }

            if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }

            const elapsed = getElapsed();
            const parsed = parseAIResponse(result.content);
            window.xdAnswers.lastParsedResponse = parsed;

            if (isSilent) {
                applySilentMode(parsed.answer || parsed.explanation || 'Parse error', parsed);
            } else if (window.xdAnswers.answerContentDiv) {
                let html = '<div class="xd-elapsed">⏱ ' + elapsed + '</div>';
                // Update footer elapsed too
                const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
                if (footerElapsed) footerElapsed.textContent = '⏱ ' + elapsed;
                if (result.thinking) {
                    html += '<div class="xd-thinking">' +
                        '<div class="xd-thinking-header" style="cursor:pointer;">💭 Thinking <span class="xd-thinking-timer">(' + elapsed + ')</span> <span class="xd-thinking-chars">(' + result.thinking.length + ' chars)</span> <span class="xd-thinking-toggle">▼</span></div>' +
                        '<div class="xd-thinking-content" style="display:none !important;">' + window.xdAnswers.renderMarkdown(result.thinking) + '</div></div>';
                }
                html += renderParsedResponse(parsed);
                window.xdAnswers.answerContentDiv.innerHTML = html;

                const th = window.xdAnswers.answerContentDiv.querySelector('.xd-thinking-header');
                if (th) th.addEventListener('click', function() { toggleThinkingContent(this); });
            }

            if (parsed.answer) {
                if (!isSilent) {
                    highlightCorrectAnswer(parsed.answer);
                }
                autoSelectAnswer(parsed.answer);
            }
        } catch (error) {
            if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
            if (!isSilent && window.xdAnswers.answerContentDiv) {
                const errHtml = formatError(error.message);
                window.xdAnswers.answerContentDiv.innerHTML = errHtml;
            }
        } finally {
            window.xdAnswers.isProcessingAI = false;
        }
    };

    // ── Draggable Module ──

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
                container.style.top = initialTop + 'px'; container.style.left = initialLeft + 'px';
                container.style.right = 'auto'; container.style.bottom = 'auto';
                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('touchmove', onDragMove, { passive: false });
                document.addEventListener('mouseup', onDragEnd, { once: true });
                document.addEventListener('touchend', onDragEnd, { once: true });
            };

            const onDragMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const coords = getCoords(e);
                container.style.transform = 'translate(' + (coords.x - startX) + 'px, ' + (coords.y - startY) + 'px)';
            };

            const onDragEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('touchmove', onDragMove);
                const t = new DOMMatrix(getComputedStyle(container).transform);
                container.style.transform = '';
                container.style.top = (initialTop + t.m42) + 'px';
                container.style.left = (initialLeft + t.m41) + 'px';
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

    // ── UI ──

    window.xdAnswers.updateHelperBaseStyles = function() {
        const custom = window.xdAnswers.settings.customization;
        const isMax = window.xdAnswers.isHelperWindowMaximized;
        window.xdAnswers.addStyle(
            ':root {' +
            '--xd-bg:' + custom.contentColor + ';--xd-border:' + custom.borderColor + ';' +
            '--xd-text:' + custom.textColor + ';--xd-header:' + custom.headerColor + ';' +
            '--xd-glow:' + (custom.glowEffect ? '0 0 8px ' + custom.borderColor : 'none') + ';' +
            '--xd-font:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
            '}' +
            '.ollama-helper-container{margin:0;padding:0;border-width:1px;border-style:solid;font-weight:normal;text-align:left;transform:none;' +
            'position:fixed !important;z-index:2147483647 !important;display:flex !important;flex-direction:column !important;' +
            'background-color:var(--xd-bg) !important;border-color:var(--xd-border) !important;' +
            'border-radius:12px !important;box-shadow:var(--xd-glow),0 4px 24px rgba(0,0,0,0.4) !important;color:var(--xd-text) !important;' +
            'font-family:var(--xd-font) !important;font-size:14px !important;line-height:1.5 !important;overflow:hidden !important;' +
            'width:' + (isMax ? maximizedHelperState.width : defaultHelperState.width) + ' !important;' +
            'height:' + (isMax ? maximizedHelperState.height : defaultHelperState.height) + ' !important;' +
            'max-height:' + (isMax ? maximizedHelperState.maxHeight : defaultHelperState.maxHeight) + ' !important;' +
            '}' +
            '.ollama-helper-container *:not(.xd-loader),.ollama-helper-container *:before,.ollama-helper-container *:after:not(.xd-loader){' +
            'all:revert !important;font-family:var(--xd-font) !important;font-size:inherit !important;line-height:inherit !important;' +
            'color:var(--xd-text) !important;box-sizing:border-box !important;margin:0 !important;padding:0 !important;' +
            'background:none !important;border:none !important;}' +
            '.ollama-helper-header{display:flex !important;justify-content:space-between !important;align-items:center !important;' +
            'padding:10px 12px !important;background-color:var(--xd-header) !important;' +
            'border-bottom:1px solid var(--xd-border) !important;cursor:move !important;user-select:none;}' +
            '.ollama-header-title{font-weight:600 !important;margin-right:auto !important;font-size:13px !important;}' +
            '.ollama-header-buttons{display:flex !important;align-items:center !important;}' +
            '.ollama-header-buttons button{all:revert !important;background:none !important;border:1px solid rgba(255,255,255,0.15) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:12px !important;' +
            'border-radius:6px !important;cursor:pointer !important;margin-left:4px !important;width:28px !important;height:24px !important;' +
            'padding:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;line-height:1 !important;}' +
            '.ollama-header-buttons button:hover{background-color:rgba(255,255,255,0.1) !important;}' +
            '#silent-mode-btn.active{background:rgba(255,255,255,0.15) !important;border-color:rgba(255,255,255,0.35) !important;}' +
            '#silent-mode-inline-select{all:revert !important;background:rgba(0,0,0,0.25) !important;border:1px solid rgba(255,255,255,0.15) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:11px !important;' +
            'border-radius:6px !important;cursor:pointer !important;margin-left:4px !important;height:24px !important;' +
            'padding:0 4px !important;line-height:1 !important;display:none !important;}' +
            '#silent-mode-inline-select option{background:var(--xd-bg) !important;color:var(--xd-text) !important;}' +
            '.ollama-helper-footer{display:flex !important;justify-content:space-between !important;align-items:center !important;' +
            'padding:6px 12px !important;background-color:var(--xd-header) !important;border-top:1px solid var(--xd-border) !important;min-height:28px !important;}' +
            '.xd-footer-elapsed{font-size:11px !important;opacity:0.45 !important;font-variant-numeric:tabular-nums !important;pointer-events:none !important;flex-shrink:0 !important;}' +
            '.xd-footer-model{font-size:10px !important;opacity:0.35 !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;' +
            'text-align:center !important;flex:1 1 auto !important;margin:0 8px !important;pointer-events:none !important;min-width:0 !important;}' +
            '.xd-footer-copy{all:revert !important;background:none !important;border:1px solid rgba(255,255,255,0.15) !important;' +
            'color:var(--xd-text) !important;font-family:var(--xd-font) !important;font-size:11px !important;' +
            'border-radius:6px !important;cursor:pointer !important;padding:2px 8px !important;display:flex !important;' +
            'align-items:center !important;justify-content:center !important;line-height:1 !important;gap:4px !important;}' +
            '.xd-footer-copy:hover{background-color:rgba(255,255,255,0.1) !important;}' +
            '.ollama-helper-content{padding:14px !important;overflow-y:auto !important;flex-grow:1 !important;word-wrap:break-word !important;position:relative !important;}' +
            '.ollama-helper-content ul,.ollama-helper-content li{list-style:revert !important;margin-left:20px !important;padding-left:5px !important;}' +
            '.ollama-helper-content::-webkit-scrollbar{width:6px !important;}' +
            '.ollama-helper-content::-webkit-scrollbar-track{background:transparent !important;}' +
            '.ollama-helper-content::-webkit-scrollbar-thumb{background-color:rgba(255,255,255,0.15) !important;border-radius:3px !important;}' +
            '.xd-loader{box-sizing:border-box !important;border:3px solid rgba(255,255,255,0.1) !important;' +
            'border-top:3px solid var(--xd-border) !important;border-radius:50% !important;' +
            'width:28px !important;height:28px !important;animation:xd-spin 0.8s linear infinite !important;margin:20px auto !important;}' +
            '@keyframes xd-spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}' +
            '.xd-answer{font-size:18px !important;font-weight:700 !important;margin-bottom:10px !important;line-height:1.4 !important;}' +
            '.xd-answer-partial{font-size:16px !important;}' +
            '.xd-explanation{font-size:13px !important;opacity:0.85 !important;margin-bottom:8px !important;line-height:1.5 !important;}' +
            '.xd-solution{font-size:13px !important;opacity:0.85 !important;padding:8px !important;background:rgba(255,255,255,0.05) !important;border-radius:6px !important;margin-top:6px !important;white-space:pre-wrap !important;}' +
            '.xd-confidence{font-size:11px !important;opacity:0.5 !important;margin-top:4px !important;}' +
            '.xd-raw-preview{font-size:12px !important;opacity:0.4 !important;}' +
            '.xd-waiting{font-size:12px !important;opacity:0.4 !important;text-align:center !important;padding:10px !important;}' +
            '.xd-error{color:#f87171 !important;font-size:13px !important;padding:8px !important;background:rgba(248,113,113,0.08) !important;border-radius:6px !important;border-left:3px solid #f87171 !important;}' +
            '.xd-elapsed{display:none !important;}' +
            '.xd-status{text-align:center !important;font-size:12px !important;opacity:0.5 !important;margin-top:8px !important;}' +
            '.xd-thinking{margin-bottom:10px !important;padding:8px !important;background:rgba(255,255,255,0.03) !important;border-radius:6px !important;border-left:3px solid rgba(255,255,255,0.1) !important;}' +
            '.xd-thinking-header{color:#888 !important;font-style:italic !important;font-size:12px !important;display:flex !important;align-items:center !important;gap:6px !important;}' +
            '.xd-thinking-toggle{font-style:normal !important;opacity:0.5 !important;font-size:10px !important;margin-left:auto !important;}' +
            '.xd-thinking-timer{font-style:normal !important;opacity:0.6 !important;}' +
            '.xd-thinking-chars{font-style:normal !important;opacity:0.4 !important;font-size:10px !important;}' +
            '.xd-thinking-content{font-size:12px !important;opacity:0.7 !important;margin-top:6px !important;white-space:pre-wrap !important;}' +
            '.xd-code{background:rgba(0,0,0,0.3) !important;border-radius:6px !important;padding:10px !important;overflow-x:auto !important;font-family:"Fira Code",Consolas,monospace !important;font-size:12px !important;margin:8px 0 !important;white-space:pre !important;}' +
            '.xd-icode{background:rgba(255,255,255,0.1) !important;padding:1px 5px !important;border-radius:3px !important;font-family:"Fira Code",Consolas,monospace !important;font-size:0.9em !important;}' +
            '.xd-latex-block{background:rgba(255,255,255,0.05) !important;padding:8px !important;border-radius:4px !important;font-family:"Cambria Math","Latin Modern Math",serif !important;font-size:15px !important;text-align:center !important;margin:8px 0 !important;}' +
            '.xd-latex{font-family:"Cambria Math","Latin Modern Math",serif !important;font-size:1.05em !important;}'
        );
    };

    window.xdAnswers.createUI = function() {
        if (window.xdAnswers.helperContainer) return;

        const container = document.createElement('div');
        container.className = 'ollama-helper-container';
        container.innerHTML =
            '<div class="ollama-helper-header" id="ollama-helper-drag-header">' +
            '<span class="ollama-header-title">xdAnswers</span>' +
            '<div class="ollama-header-buttons">' +
            '<button id="silent-mode-btn" title="Silent mode: Off">✕</button>' +
            '<select id="silent-mode-inline-select" title="Silent mode">' +
            '<option value="">Off</option>' +
            '<option value="indicators">Indicators</option>' +
            '<option value="ghost">Page title</option>' +
            '<option value="stealth">Stealth</option>' +
            '</select>' +
            '<button id="show-request-btn" title="Show Request">📝</button>' +
            '<button id="refresh-answer-btn" title="Refresh">🔄</button>' +
            '<button id="resize-helper-btn" title="Resize">⬜</button>' +
            '</div></div>' +
            '<div class="ollama-helper-content" id="ollama-answer-content">Waiting for question...</div>' +
            '<div class="ollama-helper-footer" id="ollama-helper-footer">' +
            '<span class="xd-footer-elapsed" id="xd-footer-elapsed"></span>' +
            '<span class="xd-footer-model" id="xd-footer-model"></span>' +
            '<button class="xd-footer-copy" id="copy-answer-btn" title="Copy answer">📋</button>' +
            '</div>';

        window.xdAnswers.helperContainer = container;
        window.xdAnswers.answerContentDiv = container.querySelector('#ollama-answer-content');
        window.xdAnswers.dragHeader = container.querySelector('#ollama-helper-drag-header');
        // Set display:flex inline (removed from CSS to allow silent mode display:none to work)
        container.style.setProperty('display', 'flex', 'important');

        window.xdAnswers.attachHelperEventListeners();
        window.xdAnswers.updateHelperBaseStyles();
    };

    window.xdAnswers.attachHelperEventListeners = function() {
        const container = window.xdAnswers.helperContainer;
        if (!container) return;
        const silentModeBtn = container.querySelector('#silent-mode-btn');
        const silentModeSelect = container.querySelector('#silent-mode-inline-select');
        const resizeBtn = container.querySelector('#resize-helper-btn');
        const copyBtn = container.querySelector('#copy-answer-btn');
        const showReqBtn = container.querySelector('#show-request-btn');
        const refreshBtn = container.querySelector('#refresh-answer-btn');
        if (!resizeBtn) return;

        // Initialize silent mode button state
        const currentSilentMode = window.xdAnswers.settings.silentMode || '';
        // Pre-select mode from settings (even when silent mode is off)
        silentModeSelect.value = currentSilentMode || window.xdAnswers.settings._silentModePreselect || 'indicators';
        silentModeSelect.style.display = ''; // always visible
        if (currentSilentMode !== '') {
            silentModeBtn.classList.add('active');
        } else {
            silentModeBtn.classList.remove('active');
        }
        const modeLabels = { '': 'Off', 'indicators': 'Indicators', 'ghost': 'Page title', 'stealth': 'Stealth' };
        silentModeBtn.title = 'Silent mode: ' + (modeLabels[currentSilentMode] || 'Off');

        window.xdAnswers.Draggable.init(container, window.xdAnswers.dragHeader, () => {
            window.xdAnswers.isManuallyPositioned = true;
        });

        silentModeBtn.onclick = () => {
            const cur = window.xdAnswers.settings.silentMode || '';
            if (cur !== '') {
                // Turn off
                window.xdAnswers.settings.silentMode = '';
                silentModeBtn.classList.remove('active');
                silentModeBtn.title = 'Silent mode: Off';
                // Show helper
                container.style.setProperty('display', 'flex', 'important');
                // Remove silent indicators/dots/title changes
                document.querySelectorAll('.xd-indicator-dot').forEach(el => el.remove());
                if (window.xdAnswers._originalTitle) document.title = window.xdAnswers._originalTitle;
                // Remove mini exit button
                const miniBtn = document.getElementById('xd-silent-exit-btn');
                if (miniBtn) miniBtn.remove();
                // Save (storage.onChanged will sync UI)
                chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(window.xdAnswers.settings) });
            } else {
                // Toggle on using the mode currently selected in inline select
                const selectedMode = silentModeSelect.value;
                window.xdAnswers.settings.silentMode = selectedMode;
                silentModeBtn.classList.add('active');
                silentModeBtn.title = 'Silent mode: ' + (modeLabels[selectedMode] || selectedMode);
                // Hide helper
                container.style.setProperty('display', 'none', 'important');
                // Remove existing highlights (switching to silent mode indicators/title/clipboard instead)
                document.querySelectorAll('.xd-highlight-correct').forEach(el => {
                    el.classList.remove('xd-highlight-correct');
                    el.style.removeProperty('outline');
                    el.style.removeProperty('background-color');
                    el.style.removeProperty('border-radius');
                });
                // Add mini exit button
                addSilentExitButton();
                // Apply silent mode visuals immediately
                if (window.xdAnswers.lastParsedResponse) {
                    applySilentMode(window.xdAnswers.lastParsedResponse.answer || '', window.xdAnswers.lastParsedResponse);
                }
                // Save (storage.onChanged will sync UI)
                chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(window.xdAnswers.settings) });
            }
        };

        silentModeSelect.onchange = () => {
            const mode = silentModeSelect.value;
            window.xdAnswers.settings.silentMode = mode;
            silentModeBtn.title = 'Silent mode: ' + (modeLabels[mode] || 'Off');
            if (mode !== '') {
                silentModeBtn.classList.add('active');
                container.style.setProperty('display', 'none', 'important');
                // Remove existing highlights
                document.querySelectorAll('.xd-highlight-correct').forEach(el => {
                    el.classList.remove('xd-highlight-correct');
                    el.style.removeProperty('outline');
                    el.style.removeProperty('background-color');
                    el.style.removeProperty('border-radius');
                });
                addSilentExitButton();
                if (window.xdAnswers.lastParsedResponse) {
                    applySilentMode(window.xdAnswers.lastParsedResponse.answer || '', window.xdAnswers.lastParsedResponse);
                }
            } else {
                silentModeBtn.classList.remove('active');
                container.style.setProperty('display', 'flex', 'important');
                document.querySelectorAll('.xd-indicator-dot').forEach(el => el.remove());
                if (window.xdAnswers._originalTitle) document.title = window.xdAnswers._originalTitle;
                const miniBtn = document.getElementById('xd-silent-exit-btn');
                if (miniBtn) miniBtn.remove();
            }
            chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(window.xdAnswers.settings) });
            chrome.runtime.sendMessage({ type: 'settingsUpdated' });
        };

        resizeBtn.onclick = () => {
            window.xdAnswers.isHelperWindowMaximized = !window.xdAnswers.isHelperWindowMaximized;
            window.xdAnswers.isManuallyPositioned = false;
            window.xdAnswers.attachAndPositionHelper();
            resizeBtn.textContent = window.xdAnswers.isHelperWindowMaximized ? '🗗' : '⬜';
        };

        copyBtn.onclick = async () => {
            const div = window.xdAnswers.answerContentDiv;
            if (!div) return;
            const text = div.innerText;
            if (text && text !== 'Waiting for question...' && !div.querySelector('.xd-loader')) {
                try { await navigator.clipboard.writeText(text); copyBtn.textContent = '✅'; }
                catch { copyBtn.textContent = '❌'; }
                setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
            }
        };

        showReqBtn.onclick = () => {
            const body = window.xdAnswers.lastRequestBody;
            let display = 'No request data.';
            if (body) {
                if (body.messages) display = JSON.stringify(body.messages, null, 2);
                else if (body.contents) display = JSON.stringify(body.contents, null, 2);
                else if (body.prompt) display = body.prompt;
            }
            alert('Request:\n' + display);
        };

        refreshBtn.onclick = () => {
            if (window.xdAnswers.onRefresh) window.xdAnswers.onRefresh();
            else alert('No active question to refresh.');
        };
    };

    window.xdAnswers.attachAndPositionHelper = function(targetContainerOverride) {
        if (window.xdAnswers.isExtensionModifyingDOM) return;
        window.xdAnswers.isExtensionModifyingDOM = true;

        window.xdAnswers.createUI();
        const container = window.xdAnswers.helperContainer;

        if (window.xdAnswers.settings.silentMode && window.xdAnswers.settings.silentMode !== '') {
            container.style.setProperty('display', 'none', 'important');
            addSilentExitButton();
            window.xdAnswers.isExtensionModifyingDOM = false;
            return;
        }
        container.style.setProperty('display', 'flex', 'important');
        container.style.transform = '';

        let targetParent = targetContainerOverride || document.body;

        if (!targetContainerOverride && location.hostname.includes('vseosvita.ua') &&
            (location.pathname.includes('/test/go-olp') || location.pathname.startsWith('/test/start/'))) {
            targetParent = document.body;
        }

        if (!container.parentNode || container.parentNode !== targetParent) {
            if (container.parentNode) container.parentNode.removeChild(container);
            targetParent.appendChild(container);
            window.xdAnswers.isManuallyPositioned = false;
        }
        window.xdAnswers.currentHelperParentNode = targetParent;
        window.xdAnswers.updateHelperBaseStyles();

        if (!window.xdAnswers.isManuallyPositioned) {
            const isMax = window.xdAnswers.isHelperWindowMaximized;
            Object.assign(container.style, isMax ?
                { top: maximizedHelperState.top, left: maximizedHelperState.left, bottom: 'auto', right: 'auto' } :
                { top: 'auto', left: 'auto', bottom: defaultHelperState.bottom, right: defaultHelperState.right });
        }

        window.xdAnswers.isExtensionModifyingDOM = false;
    };

    // ── Listeners ──

    // Listen for settings changes via storage (works across all contexts)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.xdAnswers_settings) {
            window.xdAnswers.loadSettings().then(() => {
                if (!window.xdAnswers.helperContainer) return;
                window.xdAnswers.updateHelperBaseStyles();
                // Update footer model name
                const footerModel = document.getElementById('xd-footer-model');
                if (footerModel) footerModel.textContent = window.xdAnswers.settings.model || 'select model ↗';
                const silentMode = window.xdAnswers.settings.silentMode || '';
                if (silentMode !== '') {
                    window.xdAnswers.helperContainer.style.setProperty('display', 'none', 'important');
                    addSilentExitButton();
                } else {
                    window.xdAnswers.helperContainer.style.setProperty('display', 'flex', 'important');
                    const miniBtn = document.getElementById('xd-silent-exit-btn');
                    if (miniBtn) miniBtn.remove();
                }
                // Sync inline silent mode controls
                const silentModeBtn = window.xdAnswers.helperContainer.querySelector('#silent-mode-btn');
                const silentModeSelect = window.xdAnswers.helperContainer.querySelector('#silent-mode-inline-select');
                const modeLabels = { '': 'Off', 'indicators': 'Indicators', 'ghost': 'Page title', 'stealth': 'Stealth' };
                if (silentModeBtn) {
                    silentModeBtn.title = 'Silent mode: ' + (modeLabels[silentMode] || 'Off');
                    if (silentMode !== '') {
                        silentModeBtn.classList.add('active');
                    } else {
                        silentModeBtn.classList.remove('active');
                    }
                }
                if (silentModeSelect) {
                    silentModeSelect.value = silentMode || window.xdAnswers.settings._silentModePreselect || 'indicators';
                    silentModeSelect.style.display = ''; // always visible
                }
                // Live-apply settings changes without page reload
                const parsed = window.xdAnswers.lastParsedResponse;
                if (parsed && parsed.answer) {
                    if (window.xdAnswers.settings.autoAnswer) {
                        autoSelectAnswer(parsed.answer);
                    }
                    // Re-apply highlight only when not in silent mode
                    if (silentMode === '') {
                        highlightCorrectAnswer(parsed.answer);
                    } else {
                        // In silent mode: remove old highlights, apply silent mode visuals
                        document.querySelectorAll('.xd-highlight-correct').forEach(el => {
                            el.classList.remove('xd-highlight-correct');
                            el.style.removeProperty('outline');
                            el.style.removeProperty('background-color');
                            el.style.removeProperty('border-radius');
                        });
                        applySilentMode(parsed.answer || parsed.explanation || '', parsed);
                    }
                }
            });
        }
    });

    window.xdAnswers.loadSettings();
})();
