(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    function buildMessages(questionData, showAnswerOnlyOverride) {
        const I = window.xdAnswers._internal;
        const ANSWER_ONLY_SYSTEM_PROMPT = I.ANSWER_ONLY_SYSTEM_PROMPT;
        const getActiveSearchProvider = I.getActiveSearchProvider;

        const settings = window.xdAnswers.settings;
        let systemPrompt = questionData.customPromptPrefix || settings.promptPrefix;
        if (showAnswerOnlyOverride !== undefined ? showAnswerOnlyOverride : (settings.showAnswerOnly || settings.silentMode === 'oneclick')) {
            systemPrompt = ANSWER_ONLY_SYSTEM_PROMPT;
        }

        // When web search is enabled, append tool usage instructions to system prompt
        if (settings.webSearchEnabled && getActiveSearchProvider(settings)) {
            systemPrompt += '\n\nУ тебе є доступ до інструмент web_search для пошуку в інтернеті. Використовуй його, коли потрібно знайти актуальну інформацію, факти, дати або деталі, яких може не бути у твоїх навчальних даних. Це особливо корисно для питань про поточні події, історичні дати, наукові факти тощо. Не викликай пошук, якщо впевнений у відповіді.';
        }

        let userMsg = '';
        // Inject test topic context when available (extracted by provider from page/API)
        if (questionData.topic) {
            console.log('[xdAnswers] Topic context injected:', questionData.topic, questionData.topicDescription ? '| ' + questionData.topicDescription.slice(0, 80) + '...' : '');
            userMsg += 'Тема тесту: ' + questionData.topic + '\n';
            if (questionData.topicDescription) {
                userMsg += 'Опис: ' + questionData.topicDescription + '\n';
            }
            userMsg += '\n';
        } else {
            console.log('[xdAnswers] No topic context available for this question');
        }
        if (questionData.questionType === 'matching') {
            userMsg += 'Це завдання на відповідність. Зістав елементи.\n\n';
        } else if (questionData.questionType === 'true_false') {
            userMsg += 'Це питання на "Правда / Неправда". Відповідай СТРОГО одним словом у полі answer: "Правда" АБО "Неправда".\n\n';
        } else if (questionData.questionType === 'fill_blank') {
            userMsg += 'У питанні є пропуски з ключами A0, A1, A2 тощо (див. текст питання). '
                + 'У полі answer перерахуй заповнення для кожного ключа у форматі: A0=значення1; A1=значення2; A2=значення3. '
                + 'Значення — коротке слово або фраза, яка підходить у пропуск.\n\n';
        } else if (questionData.questionType === 'select_in_text') {
            userMsg += 'У питанні є пропуски з ключами A0, A1, A2 — для кожного вказано список доступних варіантів у квадратних дужках [варіант1 | варіант2 | ...]. '
                + 'Обери ОДИН варіант зі списку для кожного пропуску. У полі answer вкажи: A0=обраний_варіант; A1=обраний_варіант.\n\n';
        } else if (questionData.questionType === 'order_words') {
            userMsg += 'Розташуй слова/фрагменти у правильному порядку. У полі answer перерахуй їх через крапку з комою у потрібному порядку: слово1; слово2; слово3. '
                + 'Використовуй точно ті слова, що перелічені у варіантах.\n\n';
        } else if (questionData.questionType === 'text_input_multi') {
            userMsg += 'Це питання з кількома полями для відповідей (перелічені у варіантах). '
                + 'У полі answer дай відповіді у тому ж порядку через крапку з комою: відповідь1; відповідь2; відповідь3.\n\n';
        } else if (questionData.isMultiQuiz || questionData.isMulti) {
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
        const buildWebSearchTool = window.xdAnswers._internal.buildWebSearchTool;
        // Determine whether to include web_search tool
        const includeTools = s.webSearchEnabled && s.apiFormat !== 'google'; // Google tools handled separately (non-stream)

        if (s.apiFormat === 'openai') {
            const messages = [];
            if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
            const userContent = [{ type: 'text', text: userMsg }];
            images.forEach(img => userContent.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + img } }));
            messages.push({ role: 'user', content: images.length > 0 ? userContent : userMsg });
            const body = { model: s.model, messages, max_tokens: 4096, stream: !!stream };
            if (includeTools) body.tools = buildWebSearchTool('openai');
            return body;
        }

        if (s.apiFormat === 'anthropic') {
            const userContent = [{ type: 'text', text: userMsg }];
            images.forEach(img => userContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }));
            const body = { model: s.model, messages: [{ role: 'user', content: userContent }], max_tokens: 4096, stream: !!stream };
            if (systemPrompt) body.system = systemPrompt;
            if (includeTools) body.tools = buildWebSearchTool('anthropic');
            return body;
        }

        if (s.apiFormat === 'google') {
            const userParts = [];
            if (systemPrompt) userParts.push({ text: systemPrompt + '\n\n' + userMsg });
            else userParts.push({ text: userMsg });
            images.forEach(img => userParts.push({ inline_data: { mime_type: 'image/jpeg', data: img } }));
            const body = { contents: [{ parts: userParts }] };
            // Google: include tools in non-stream path only (streaming tool calls unreliable)
            if (s.webSearchEnabled) body.tools = buildWebSearchTool('google');
            return body;
        }

        throw new Error('Unknown API format: ' + s.apiFormat);
    }

    window.xdAnswers._internal.buildMessages = buildMessages;
    window.xdAnswers._internal.buildStreamUrl = buildStreamUrl;
    window.xdAnswers._internal.buildNonStreamUrl = buildNonStreamUrl;
    window.xdAnswers._internal.buildHeaders = buildHeaders;
    window.xdAnswers._internal.buildRequestBody = buildRequestBody;
})();
