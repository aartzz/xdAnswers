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
- Для кількох правильних відповідей розділяй "; "
- Відповідай мовою питання
- solution пиши тільки для задач з розрахунками (фізика, хімія, математика)
- confidence необов'язкове
- Виводь ТІЛЬКИ ці поля, без JSON, markdown, списків і зайвого тексту`;

    const DEFAULT_BASE_URLS = {
        openai: 'https://api.openai.com/v1',
        anthropic: 'https://api.anthropic.com/v1',
        google: 'https://generativelanguage.googleapis.com/v1beta'
    };

    const DEFAULT_SETTINGS = {
        apiFormat: 'openai',
        baseUrl: DEFAULT_BASE_URLS.openai,
        apiKey: '',
        model: 'gpt-4o',
        promptPrefix: DEFAULT_SYSTEM_PROMPT,
        autoAnswer: false,
        autoAnswerCooldown: 2000,
        highlightCorrect: true,
        silentMode: false,
        customization: {
            glowEffect: false,
            borderColor: '#6366f1',
            contentColor: '#1e1e2e',
            headerColor: '#2a2a3e',
            textColor: '#cdd6f4'
        }
    };

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
                s = { ...s, ...p, customization: { ...s.customization, ...(p.customization || {}) } };
                if (typeof s.promptPrefix !== 'string' || !s.promptPrefix.trim()) {
                    s.promptPrefix = DEFAULT_SETTINGS.promptPrefix;
                }
                const oldDefaults = { openai: 'https://api.openai.com/v1', anthropic: 'https://api.anthropic.com', google: 'https://generativelanguage.googleapis.com' };
                if (s.apiFormat && oldDefaults[s.apiFormat] === s.baseUrl) {
                    s.baseUrl = DEFAULT_BASE_URLS[s.apiFormat];
                }
            } catch (e) {
                console.error('xdAnswers: Failed to parse settings.', e);
            }
        }
        window.xdAnswers.settings = s;
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
        if (questionData.optionsText) userMsg += '\nВаріанти:\n' + questionData.optionsText;

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
        if (s.apiFormat === 'openai') h['Authorization'] = 'Bearer ' + s.apiKey;
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
        const s = window.xdAnswers.settings;
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
            const s = window.xdAnswers.settings;
            const { systemPrompt, userMsg } = buildMessages(questionData);
            const images = questionData.base64Images || [];
            const body = buildRequestBody(s, systemPrompt, userMsg, images, true);
            window.xdAnswers.lastRequestBody = body;

            let fullContent = '';
            let fullThinking = '';
            const startTime = outerStartTime || Date.now();
            const contentDiv = window.xdAnswers.answerContentDiv;
            let thinkingStarted = false;
            let thinkingTimerInterval = null;
            let statusCleared = false;

            function getElapsed() {
                const sec = Math.floor((Date.now() - startTime) / 1000);
                return sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's';
            }

            function clearStatus() {
                if (statusCleared) return;
                statusCleared = true;
                if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
                const status = contentDiv?.querySelector('.xd-status');
                const loader = contentDiv?.querySelector('.xd-loader');
                if (status) status.remove();
                if (loader) loader.remove();
            }

            function ensureThinkingUI() {
                if (thinkingStarted || !contentDiv) return;
                clearStatus();
                thinkingStarted = true;
                contentDiv.innerHTML =
                    '<div class="xd-thinking">' +
                    '<div class="xd-thinking-header">💭 Thinking... (0s)</div>' +
                    '<div class="xd-thinking-content" style="display:none;"></div>' +
                    '</div>';
                const header = contentDiv.querySelector('.xd-thinking-header');
                header.style.cursor = 'pointer';
                header.addEventListener('click', function() {
                    const c = this.nextElementSibling;
                    c.style.display = c.style.display === 'none' ? 'block' : 'none';
                });
                thinkingTimerInterval = setInterval(() => {
                    const h = contentDiv.querySelector('.xd-thinking-header');
                    if (h) h.textContent = '💭 Thinking... (' + getElapsed() + ')';
                }, 1000);
            }

            function updateStreamUI() {
                if (!contentDiv) return;
                clearStatus();
                
                const elapsed = getElapsed();
                let html = '';
                
                const parsed = parsePartialLabeled(fullContent) || salvagePartialJSON(fullContent);
                
                if (parsed) {
                    html += renderPartial(parsed);
                } else if (fullContent.trim()) {
                    html += '<div class="xd-answer xd-answer-partial">' + window.xdAnswers.renderMarkdown(fullContent) + '</div>';
                } else {
                    html += '<div class="xd-waiting">⏳ Waiting for answer... (' + elapsed + ')</div>';
                }

                if (thinkingStarted) {
                    html += '<div class="xd-thinking">' +
                        '<div class="xd-thinking-header" style="cursor:pointer;">💭 Thinking (' + elapsed + ')</div>' +
                        '<div class="xd-thinking-content" style="display:none;">' + window.xdAnswers.renderMarkdown(fullThinking) + '</div></div>';
                }
                
                contentDiv.innerHTML = html;
                const th = contentDiv.querySelector('.xd-thinking-header');
                if (th) th.addEventListener('click', function() {
                    const c = this.nextElementSibling;
                    c.style.display = c.style.display === 'none' ? 'block' : 'none';
                });
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
                        }
                        if (ev.content) {
                            if (thinkingTimerInterval) { clearInterval(thinkingTimerInterval); thinkingTimerInterval = null; }
                            fullContent += ev.content;
                            updateStreamUI();
                        }
                    }
                },
                () => {
                    if (thinkingTimerInterval) clearInterval(thinkingTimerInterval);
                    resolve({ content: fullContent, thinking: fullThinking });
                },
                (error, details) => {
                    if (thinkingTimerInterval) clearInterval(thinkingTimerInterval);
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
            '.answer-text',
            '.t-text-guest',
            '.t-text',
            '.test-answer',
            'label[for]'
        ];
        for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            if (els.length > 1) return Array.from(els);
        }
        return [];
    }

    function normalizeText(t) {
        return (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function matchAnswerToOptions(answerText, optionElements) {
        if (!answerText || !optionElements.length) return [];
        const answers = answerText.split(';').map(a => a.trim()).filter(Boolean);
        const matched = [];

        for (const ans of answers) {
            const normAns = normalizeText(ans);
            let best = null, bestScore = 0;

            for (const el of optionElements) {
                const normEl = normalizeText(el.innerText || el.textContent);
                if (!normEl) continue;
                if (normEl === normAns) { best = el; bestScore = 1; break; }
                if (normEl.includes(normAns) || normAns.includes(normEl)) {
                    const score = Math.min(normEl.length, normAns.length) / Math.max(normEl.length, normAns.length);
                    if (score > bestScore) { bestScore = score; best = el; }
                }
            }
            if (best && bestScore > 0.3) matched.push(best);
        }
        return matched;
    }

    function highlightCorrectAnswer(answerText) {
        if (!window.xdAnswers.settings.highlightCorrect) return;
        const elements = matchAnswerToOptions(answerText, findOptionElements());
        for (const el of elements) {
            const target = el.closest('.question-option, .answer-item, .v-test-questions-select-block, label, [role="radio"], [role="checkbox"]') || el;
            target.style.cssText += 'outline: 3px solid #22c55e !important; background-color: rgba(34, 197, 94, 0.15) !important; border-radius: 4px !important;';
        }
    }

    function autoSelectAnswer(answerText) {
        if (!window.xdAnswers.settings.autoAnswer) return;
        const elements = matchAnswerToOptions(answerText, findOptionElements());
        setTimeout(() => {
            for (const el of elements) {
                const clickTarget = el.closest('.question-option, .answer-item, label, [role="radio"], [role="checkbox"]') || el;
                clickTarget.click();
            }
        }, window.xdAnswers.settings.autoAnswerCooldown);
    }

    function showSilentAnswer(answerText) {
        if (!window.xdAnswers.settings.silentMode) return;

        if (!window.xdAnswers._originalTitle) window.xdAnswers._originalTitle = document.title;
        document.title = '[' + answerText.substring(0, 50) + '] ' + window.xdAnswers._originalTitle;

        let dot = document.getElementById('xd-silent-dot');
        let tooltip = document.getElementById('xd-silent-tooltip');
        if (!dot) {
            dot = document.createElement('div');
            dot.id = 'xd-silent-dot';
            dot.style.cssText = 'position:fixed;bottom:5px;right:5px;width:12px;height:12px;background:#22c55e;border-radius:50%;z-index:2147483647;cursor:pointer;opacity:0.6;transition:all 0.2s;';
            tooltip = document.createElement('div');
            tooltip.id = 'xd-silent-tooltip';
            tooltip.style.cssText = 'position:fixed;bottom:24px;right:5px;background:#1e1e2e;color:#cdd6f4;padding:8px 12px;border-radius:6px;font-size:13px;z-index:2147483647;display:none;max-width:320px;border:1px solid #444;font-family:system-ui,-apple-system,sans-serif;word-break:break-word;';
            dot.addEventListener('mouseenter', () => { tooltip.style.display = 'block'; dot.style.opacity = '1'; dot.style.transform = 'scale(1.5)'; });
            dot.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; dot.style.opacity = '0.6'; dot.style.transform = 'scale(1)'; });
            document.body.appendChild(tooltip);
            document.body.appendChild(dot);
        }
        tooltip = document.getElementById('xd-silent-tooltip');
        if (tooltip) tooltip.textContent = answerText;
    }

    // ── Main Process ──

    window.xdAnswers.processQuestion = async function(questionData) {
        if (window.xdAnswers.isProcessingAI) return;

        const isSilent = window.xdAnswers.settings.silentMode;

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
                const s = window.xdAnswers.answerContentDiv?.querySelector('.xd-status');
                if (s) s.textContent = '⏳ Waiting for response... (' + getElapsed() + ')';
                else clearInterval(statusInterval);
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
                showSilentAnswer(parsed.answer || parsed.explanation || 'Parse error');
            } else if (window.xdAnswers.answerContentDiv) {
                let html = '<div class="xd-elapsed">⏱ ' + elapsed + '</div>';
                if (result.thinking) {
                    html += '<div class="xd-thinking">' +
                        '<div class="xd-thinking-header" style="cursor:pointer;">💭 Thinking (click to expand)</div>' +
                        '<div class="xd-thinking-content" style="display:none;">' + window.xdAnswers.renderMarkdown(result.thinking) + '</div></div>';
                }
                html += renderParsedResponse(parsed);
                window.xdAnswers.answerContentDiv.innerHTML = html;

                const th = window.xdAnswers.answerContentDiv.querySelector('.xd-thinking-header');
                if (th) th.addEventListener('click', function() {
                    const c = this.nextElementSibling;
                    c.style.display = c.style.display === 'none' ? 'block' : 'none';
                });
            }

            if (parsed.answer) {
                highlightCorrectAnswer(parsed.answer);
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
            '.ollama-helper-container *,.ollama-helper-container *:before,.ollama-helper-container *:after{' +
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
            '.xd-elapsed{position:absolute !important;top:10px !important;right:14px !important;font-size:11px !important;opacity:0.45 !important;margin:0 !important;line-height:1 !important;font-variant-numeric:tabular-nums !important;pointer-events:none !important;}' +
            '.xd-status{text-align:center !important;font-size:12px !important;opacity:0.5 !important;margin-top:8px !important;}' +
            '.xd-thinking{margin-bottom:10px !important;padding:8px !important;background:rgba(255,255,255,0.03) !important;border-radius:6px !important;border-left:3px solid rgba(255,255,255,0.1) !important;}' +
            '.xd-thinking-header{color:#888 !important;font-style:italic !important;font-size:12px !important;}' +
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
            '<button id="resize-helper-btn" title="Resize">⬜</button>' +
            '<button id="copy-answer-btn" title="Copy">📋</button>' +
            '<button id="show-request-btn" title="Show Request">📝</button>' +
            '<button id="refresh-answer-btn" title="Refresh">🔄</button>' +
            '</div></div>' +
            '<div class="ollama-helper-content" id="ollama-answer-content">Waiting for question...</div>';

        window.xdAnswers.helperContainer = container;
        window.xdAnswers.answerContentDiv = container.querySelector('#ollama-answer-content');
        window.xdAnswers.dragHeader = container.querySelector('#ollama-helper-drag-header');

        window.xdAnswers.attachHelperEventListeners();
        window.xdAnswers.updateHelperBaseStyles();
    };

    window.xdAnswers.attachHelperEventListeners = function() {
        const container = window.xdAnswers.helperContainer;
        if (!container) return;
        const resizeBtn = container.querySelector('#resize-helper-btn');
        const copyBtn = container.querySelector('#copy-answer-btn');
        const showReqBtn = container.querySelector('#show-request-btn');
        const refreshBtn = container.querySelector('#refresh-answer-btn');
        if (!resizeBtn) return;

        window.xdAnswers.Draggable.init(container, window.xdAnswers.dragHeader, () => {
            window.xdAnswers.isManuallyPositioned = true;
        });

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

        if (window.xdAnswers.settings.silentMode) {
            container.style.display = 'none';
            window.xdAnswers.isExtensionModifyingDOM = false;
            return;
        }
        container.style.display = '';
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

    chrome.runtime.onMessage.addListener(async (message) => {
        if (message.type === 'settingsUpdated') {
            await window.xdAnswers.loadSettings();
            if (window.xdAnswers.helperContainer) {
                window.xdAnswers.updateHelperBaseStyles();
                if (window.xdAnswers.settings.silentMode) {
                    window.xdAnswers.helperContainer.style.display = 'none';
                } else {
                    window.xdAnswers.helperContainer.style.display = '';
                }
            }
        }
    });

    window.xdAnswers.loadSettings();
})();
