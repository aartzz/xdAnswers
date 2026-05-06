(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

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

    const ANSWER_ONLY_SYSTEM_PROMPT = `Відповідай на тестові питання. Формат відповіді — ТІЛЬКИ одне поле:
answer: правильна відповідь

Правила:
- answer: точний текст правильного варіанту, якщо є варіанти відповідей
- Якщо варіанти позначені як [зображення] — в answer вкажи ЛІТЕРУ варіанту (A, B, C...)
- Для кількох правильних відповідей розділяй "; "
- Відповідай мовою питання
- Виводь ТІЛЬКИ "answer: ...", без пояснень, розв'язку, міркувань, JSON, markdown і зайвого тексту`;

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
        'unturf-vl': 'https://qwen-vl.ai.unturf.com/v1',
        'opencode-zen': 'https://opencode.ai/zen/v1',
        'opencode-go': 'https://opencode.ai/zen/go/v1',
        'ollama-cloud': 'https://ollama.com/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
        langsearch: 'https://api.langsearch.com/v1',
        serper: 'https://google.serper.dev',
        perplexity: 'https://api.perplexity.ai',
        exa: 'https://api.exa.ai',
        tavily: 'https://api.tavily.com',
        linkup: 'https://api.linkup.so/v1',
        searchapi: 'https://www.searchapi.io/api/v1'
    };

    const API_FORMAT_MAP = {
        openai: 'openai', anthropic: 'anthropic', google: 'google',
        deepseek: 'openai', groq: 'openai', openrouter: 'openai',
        cerebras: 'openai', together: 'openai', fireworks: 'openai', mistral: 'openai',
        'unturf-hermes': 'openai', 'unturf-qwen': 'openai', 'unturf-vl': 'openai',
        'opencode-zen': 'openai', 'opencode-go': 'openai', 'ollama-cloud': 'openai', nvidia: 'openai'
    };

    window.xdAnswers._internal.DEFAULT_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT;
    window.xdAnswers._internal.ANSWER_ONLY_SYSTEM_PROMPT = ANSWER_ONLY_SYSTEM_PROMPT;
    window.xdAnswers._internal.DEFAULT_BASE_URLS = DEFAULT_BASE_URLS;
    window.xdAnswers._internal.API_FORMAT_MAP = API_FORMAT_MAP;
})();
