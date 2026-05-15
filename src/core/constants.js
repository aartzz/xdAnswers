(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    const DEFAULT_SYSTEM_PROMPT = `Ти обираєш правильні відповіді в тестах. УВАЖНО: коли питання супроводжується списком Варіанти: — твоє єдине завдання ОБРАТИ один або кілька пунктів із цього списку.

Формат відповіді — суворо поля, кожне з нового рядка:
answer: <скопіюй точний текст обраного варіанту>
explanation: чому саме цей варіант (1-3 речення)
solution: Дано: ... Розв'язок: ... (лише для математики/фізики/хімії)
confidence: число 0-100

Правила вибору варіанту:
- answer МАЄ містити дослівний текст зі списку Варіанти — не перефразовуй
- Якщо варіанти це [зображення] — в answer став літеру: A, B, C...
- Кілька правильних — розділяй "; " 
- Відповідай мовою питання
- Жодного JSON, markdown, лапок, зайвого тексту поза полями`;

    const ANSWER_ONLY_SYSTEM_PROMPT = `Ти обираєш правильну відповідь у тесті. Коли бачиш Варіанти: — обери пункт зі списку.

Формат — СТРОГО один рядок:
answer: <скопіюй точний текст вибраного варіанту>

- answer = дослівно як у списку Варіанти
- Якщо варіанти це [зображення] — літера: A, B, C...
- Кілька — через "; "
- Мова питання
- ТІЛЬКИ "answer: ..." — без пояснень`;

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
