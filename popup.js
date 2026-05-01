const PREDEFINED_THEMES = {
    'Dark': { borderColor: '#cccccc', contentColor: '#1c1c1c', headerColor: '#333333', textColor: '#e0e0e0' },
    'AMOLED': { borderColor: '#ffffff', contentColor: '#000000', headerColor: '#111111', textColor: '#ffffff' },
    'Indigo': { borderColor: '#6366f1', contentColor: '#1e1e2e', headerColor: '#2a2a3e', textColor: '#cdd6f4' },
    'Light': { borderColor: '#6366f1', contentColor: '#f5f5f7', headerColor: '#e8e6f0', textColor: '#1a1a2e' },
    'Rose': { borderColor: '#f43f5e', contentColor: '#1a0a10', headerColor: '#2a0a18', textColor: '#fecdd3' },
    'Emerald': { borderColor: '#10b981', contentColor: '#0a1a14', headerColor: '#0d2818', textColor: '#d1fae5' },
    'Amber': { borderColor: '#f59e0b', contentColor: '#140f00', headerColor: '#2a1f00', textColor: '#fef3c7' }
};

const TRANSLATIONS = {
    uk: {
        // Tab names
        tabAI: 'ШІ',
        tabProviders: 'Провайдери',
        tabFeatures: 'Функції',
        tabThemes: 'Теми',
        // AI tab
        providerLabel: 'Провайдер:',
        modelsLabel: 'Моделі:',
        searchModel: 'Пошук або введіть модель...',
        // Features tab
        languageLabel: 'Мова:',
        autoAnswer: 'Автовідповідь',
        autoAnswerHint: 'Автоматично обирати правильну відповідь на сторінці.',
        cooldownLabel: 'Затримка (мс):',
        highlightCorrect: 'Підсвітити правильну відповідь',
        highlightCorrectHint: 'Підсвітити правильний варіант зеленою рамкою, коли UI видимий.',
        showAnswerOnly: 'Лише відповідь',
        showAnswerOnlyHint: 'Просити ШІ повертати лише відповідь — без пояснень. Економить токени.',
        silentMode: 'Тихий режим',
        silentModeLabel: 'Режим:',
        silentIndicators: 'Індикатори',
        silentGhost: 'Заголовок сторінки',
        silentStealth: 'Стелс',
        silentOneclick: 'Один клік',
        silentIndicatorsHint: 'Маркер поруч з правильною відповіддю.',
        silentGhostHint: 'Сховати вікно. Відповідь лише в заголовку вкладки.',
        silentStealthHint: 'Повністю невидимо. Відповідь автоматично копіюється.',
        silentOneclickHint: 'Натисніть на питання — правильна відповідь обереться автоматично.',
        // Position
        defaultPositionLabel: 'Позиція за замовчуванням',
        defaultPositionHint: 'Де зявляється картка відповіді при відкритті.',
        rememberDrag: 'Запамятати перетягнуту позицію',
        rememberDragHint: 'Якщо ви перетягнете картку, зберегти те місце. Інакше скидатиметься до позиції вище.',
        // Themes tab
        themesDesc: 'Оберіть готову тему або натисніть <strong>+</strong> щоб створити свою.',
        newTheme: 'Нова тема',
        themeNameLabel: 'Назва:',
        themeNamePlaceholder: 'Моя тема',
        accentLabel: 'Акцент:',
        headerLabel: 'Шапка:',
        backgroundLabel: 'Фон:',
        textLabel: 'Текст:',
        cancelBtn: 'Скасувати',
        saveThemeBtn: 'Зберегти тему',
        glowEffect: 'Ефект світіння',
        glowEffectHint: 'Мяке світіння акцентного кольору навколо картки відповіді.',
        // Theme dynamic
        addThemeLabel: 'Нова тема',
        deleteTheme: 'Видалити тему',
        createTheme: 'Створити свою тему',
        untitled: 'Без назви',
        customPrefix: 'Користувацька',
        // Donate tab
        donateText: 'Якщо вам подобається розширення, підтримайте розробника.',
        donateBtn: 'Підписатись в Telegram',
        // Providers tab
        providersHeader: 'Провайдери',
        otherHeader: 'Інші',
        otherHint: 'Користувацькі OpenAI-сумісні ендпоінти',
        addProvider: '+ Додати провайдер',
        addCustomProvider: '+ Додати свій провайдер',
        noProviders: 'Провайдерів ще немає',
        // Provider form
        providerTypeLabel: 'Тип:',
        providerNameLabel: 'Назва:',
        providerNamePlaceholder: 'Мій провайдер',
        providerBaseUrlLabel: 'Base URL:',
        providerApiKeyLabel: 'API Key:',
        providerApiKeyPlaceholder: 'sk-...',
        providerCustomName: 'Користувацький провайдер',
        removeProvider: 'Видалити',
        saveProvider: 'Зберегти',
        addProviderType: 'Додати тип',
        // Model badges
        badgeVision: 'Підтримує зображення',
        badgeReasoning: 'Модель з мисленням',
        badgeCostInput: 'Ввід',
        badgeCostOutput: 'Вивід',
        customModel: 'користувацька модель',
        // Context length
        ctxThousand: 'тис.',
        ctxMillion: 'млн',
        // Web Search + Hotkey
        webSearchLabel: 'Веб-пошук',
        webSearchHint: 'Дозволити ШІ шукати в інтернеті актуальну інформацію. Потрібен пошуковий провайдер (LangSearch, Serper, Perplexity, Exa, Tavily, Linkup або SearchAPI) з API-ключем у вкладці Провайдери.',
        consensusLabel: 'Режим консенсусу',
        consensusHint: '',
        consensusAddRun: '+ Додати модель',
        consensusProviderLabel: 'Провайдер:',
        consensusModelLabel: 'Модель:',
        consensusAnswerOnly: 'Лише відповідь',
        consensusRemoveRun: 'Видалити',
        consensusNoProviders: 'Немає провайдерів',
        hotkeyLabel: 'Гаряча клавіша',
        hotkeyHint: 'Натисніть на комбінацію клавіш вище, щоб перепризначити.',
        hotkeyRecording: 'Натисніть комбінацію клавіш…',
        hotkeyClear: 'Скинути',
        searchProviderBadge: 'ПОШУК'
    },
    ru: {
        tabAI: 'ИИ',
        tabProviders: 'Провайдеры',
        tabFeatures: 'Функции',
        tabThemes: 'Темы',
        providerLabel: 'Провайдер:',
        modelsLabel: 'Модели:',
        searchModel: 'Поиск или введите модель...',
        languageLabel: 'Язык:',
        autoAnswer: 'Автоответ',
        autoAnswerHint: 'Автоматически выбирать правильный ответ на странице.',
        cooldownLabel: 'Задержка (мс):',
        highlightCorrect: 'Подсветить правильный ответ',
        highlightCorrectHint: 'Подсветить правильный вариант зелёной рамкой, когда UI видим.',
        showAnswerOnly: 'Только ответ',
        showAnswerOnlyHint: 'Просить ИИ возвращать только ответ — без объяснений. Экономит токены.',
        silentMode: 'Тихий режим',
        silentModeLabel: 'Режим:',
        silentIndicators: 'Индикаторы',
        silentGhost: 'Заголовок страницы',
        silentStealth: 'Стелс',
        silentOneclick: 'Один клик',
        silentIndicatorsHint: 'Маркер рядом с правильным ответом.',
        silentGhostHint: 'Скрыть окно. Ответ только в заголовке вкладки.',
        silentStealthHint: 'Полностью невидимо. Ответ автоматически копируется.',
        silentOneclickHint: 'Нажмите на вопрос — правильный ответ выберется автоматически.',
        // Position
        defaultPositionLabel: 'Позиция по умолчанию',
        defaultPositionHint: 'Где появляется карточка ответа при открытии.',
        rememberDrag: 'Запомнить перетянутую позицию',
        rememberDragHint: 'Если вы перетащите карточку, сохранить то место. Иначе сбрасывается к позиции выше.',
        themesDesc: 'Выберите готовую тему или нажмите <strong>+</strong> чтобы создать свою.',
        newTheme: 'Новая тема',
        themeNameLabel: 'Название:',
        themeNamePlaceholder: 'Моя тема',
        accentLabel: 'Акцент:',
        headerLabel: 'Шапка:',
        backgroundLabel: 'Фон:',
        textLabel: 'Текст:',
        cancelBtn: 'Отмена',
        saveThemeBtn: 'Сохранить тему',
        glowEffect: 'Эффект свечения',
        glowEffectHint: 'Мягкое свечение акцентного цвета вокруг карточки ответа.',
        addThemeLabel: 'Новая тема',
        deleteTheme: 'Удалить тему',
        createTheme: 'Создать свою тему',
        untitled: 'Без названия',
        customPrefix: 'Пользовательская',
        donateText: 'Если вам нравится расширение, поддержите разработчика.',
        donateBtn: 'Подписаться в Telegram',
        providersHeader: 'Провайдеры',
        otherHeader: 'Другие',
        otherHint: 'Пользовательские OpenAI-совместимые эндпоинты',
        addProvider: '+ Добавить провайдер',
        addCustomProvider: '+ Добавить свой провайдер',
        noProviders: 'Провайдеров пока нет',
        providerTypeLabel: 'Тип:',
        providerNameLabel: 'Название:',
        providerNamePlaceholder: 'Мой провайдер',
        providerBaseUrlLabel: 'Base URL:',
        providerApiKeyLabel: 'API Key:',
        providerApiKeyPlaceholder: 'sk-...',
        providerCustomName: 'Пользовательский провайдер',
        removeProvider: 'Удалить',
        saveProvider: 'Сохранить',
        addProviderType: 'Добавить тип',
        badgeVision: 'Поддерживает изображения',
        badgeReasoning: 'Модель с мышлением',
        badgeCostInput: 'Ввод',
        badgeCostOutput: 'Вывод',
        customModel: 'пользовательская модель',
        ctxThousand: 'тыс.',
        ctxMillion: 'млн',
        webSearchLabel: 'Веб-поиск',
        webSearchHint: 'Разрешить ИИ искать в интернете актуальную информацию. Нужен поисковый провайдер (LangSearch, Serper, Perplexity, Exa, Tavily, Linkup или SearchAPI) с API-ключом во вкладке Провайдеры.',
        consensusLabel: 'Режим консенсуса',
        consensusHint: '',
        consensusAddRun: '+ Добавить модель',
        consensusProviderLabel: 'Провайдер:',
        consensusModelLabel: 'Модель:',
        consensusAnswerOnly: 'Только ответ',
        consensusRemoveRun: 'Удалить',
        consensusNoProviders: 'Нет провайдеров',
        hotkeyLabel: 'Горячая клавиша',
        hotkeyHint: 'Нажмите на комбинацию клавиш выше, чтобы переназначить.',
        hotkeyRecording: 'Нажмите комбинацию клавиш…',
        hotkeyClear: 'Сбросить',
        searchProviderBadge: 'ПОИСК'
    },
    en: {
        tabAI: 'AI',
        tabProviders: 'Providers',
        tabFeatures: 'Features',
        tabThemes: 'Themes',
        providerLabel: 'Provider:',
        modelsLabel: 'Models:',
        searchModel: 'Search or type custom model...',
        languageLabel: 'Language:',
        autoAnswer: 'Auto-answer',
        autoAnswerHint: 'Automatically select the correct answer on the page.',
        cooldownLabel: 'Cooldown (ms):',
        highlightCorrect: 'Highlight correct answer',
        highlightCorrectHint: 'Highlight the correct option with a green border when UI is visible.',
        showAnswerOnly: 'Show answer only',
        showAnswerOnlyHint: 'Ask AI to return only the answer — no explanation, no reasoning. Saves tokens.',
        silentMode: 'Silent mode',
        silentModeLabel: 'Mode:',
        silentIndicators: 'Indicators',
        silentGhost: 'Page title',
        silentStealth: 'Stealth',
        silentOneclick: 'One-click',
        silentIndicatorsHint: 'Overlay dot next to the correct answer.',
        silentGhostHint: 'Hide window. Answer shown only in browser tab title.',
        silentStealthHint: 'Completely invisible. Answer auto-copied to clipboard.',
        silentOneclickHint: 'Click on a question to instantly select the correct answer.',
        // Position
        defaultPositionLabel: 'Default position',
        defaultPositionHint: 'Where the answer card appears when it opens.',
        rememberDrag: 'Remember dragged position',
        rememberDragHint: 'If you move the card by dragging, save that exact spot. Otherwise it resets to the default position above.',
        themesDesc: 'Choose a preset or click <strong>+</strong> to build your own.',
        newTheme: 'New theme',
        themeNameLabel: 'Name:',
        themeNamePlaceholder: 'My theme',
        accentLabel: 'Accent:',
        headerLabel: 'Header:',
        backgroundLabel: 'Background:',
        textLabel: 'Text:',
        cancelBtn: 'Cancel',
        saveThemeBtn: 'Save theme',
        glowEffect: 'Glow effect',
        glowEffectHint: 'Soft accent-colored glow around the on-page answer card.',
        addThemeLabel: 'New theme',
        deleteTheme: 'Delete theme',
        createTheme: 'Create custom theme',
        untitled: 'Untitled',
        customPrefix: 'Custom',
        donateText: 'If you like this extension, consider supporting the developer.',
        donateBtn: 'Subscribe on Telegram',
        providersHeader: 'Providers',
        otherHeader: 'Other',
        otherHint: 'Custom OpenAI-compatible endpoints',
        addProvider: '+ Add Provider',
        addCustomProvider: '+ Add Custom Provider',
        noProviders: 'No providers added yet',
        providerTypeLabel: 'Type:',
        providerNameLabel: 'Name:',
        providerNamePlaceholder: 'My Custom Provider',
        providerBaseUrlLabel: 'Base URL:',
        providerApiKeyLabel: 'API Key:',
        providerApiKeyPlaceholder: 'sk-...',
        providerCustomName: 'Custom Provider',
        removeProvider: 'Remove',
        saveProvider: 'Save',
        addProviderType: 'Add type',
        badgeVision: 'Supports image input',
        badgeReasoning: 'Reasoning/thinking model',
        badgeCostInput: 'Input',
        badgeCostOutput: 'Output',
        customModel: 'custom model',
        ctxThousand: 'K',
        ctxMillion: 'M',
        webSearchLabel: 'Web Search',
        webSearchHint: 'Enable AI to search the web for up-to-date information. Requires a search provider (LangSearch, Serper, Perplexity, Exa, Tavily, Linkup or SearchAPI) with API key in the Providers tab.',
        consensusLabel: 'Consensus mode',
        consensusHint: '',
        consensusAddRun: '+ Add model',
        consensusProviderLabel: 'Provider:',
        consensusModelLabel: 'Model:',
        consensusAnswerOnly: 'Answer only',
        consensusRemoveRun: 'Remove',
        consensusNoProviders: 'No providers',
        hotkeyLabel: 'Hotkey',
        hotkeyHint: 'Click the key combination above to rebind.',
        hotkeyRecording: 'Press a key combination…',
        hotkeyClear: 'Reset',
        searchProviderBadge: 'SEARCH'
    }
};

function t(key) {
    return (TRANSLATIONS[settings.language || 'uk'] || TRANSLATIONS.uk)[key] || key;
}

function applyLanguage() {
    const lang = settings.language || 'uk';
    document.documentElement.lang = lang === 'uk' ? 'uk' : (lang === 'ru' ? 'ru' : 'en');

    // Tab buttons
    const tabs = document.querySelectorAll('.tab-button');
    const tabKeys = ['tabAI', 'tabProviders', 'tabFeatures', 'tabThemes', null]; // last = ♥ (no translation)
    tabs.forEach((btn, i) => { if (tabKeys[i]) btn.textContent = t(tabKeys[i]); });

    // AI tab
    const providerLabel = document.querySelector('label[for="active-provider-trigger"]');
    if (providerLabel) providerLabel.textContent = t('providerLabel');
    const modelsLabelText = document.getElementById('models-label-text');
    if (modelsLabelText) modelsLabelText.textContent = t('modelsLabel');
    const modelInput = document.getElementById('model-name');
    if (modelInput) modelInput.placeholder = t('searchModel');

    // Features tab
    const langLabel = document.querySelector('label[for="language-select"]');
    if (langLabel) langLabel.textContent = t('languageLabel');
    const langSelect = document.getElementById('language-select');
    if (langSelect) langSelect.value = lang;
    document.querySelector('#auto-answer-toggle + span').textContent = t('autoAnswer');
    document.querySelector('#auto-answer-toggle').closest('.toggle-group').querySelector('.field-hint').textContent = t('autoAnswerHint');
    const cooldownLabel = document.querySelector('label[for="auto-answer-cooldown"]');
    if (cooldownLabel) cooldownLabel.textContent = t('cooldownLabel');
    document.querySelector('#highlight-correct-toggle + span').textContent = t('highlightCorrect');
    document.querySelector('#highlight-correct-toggle').closest('.toggle-group').querySelector('.field-hint').textContent = t('highlightCorrectHint');
    document.querySelector('#show-answer-only-toggle + span').textContent = t('showAnswerOnly');
    document.querySelector('#show-answer-only-toggle').closest('.toggle-group').querySelector('.field-hint').textContent = t('showAnswerOnlyHint');
    document.querySelector('#silent-mode-toggle + span').textContent = t('silentMode');
    const silentModeLabel = document.querySelector('label[for="silent-mode-select"]');
    if (silentModeLabel) silentModeLabel.textContent = t('silentModeLabel');

    // Silent mode options
    const silentOpts = document.querySelectorAll('#silent-mode-select option');
    const optKeys = ['silentIndicators', 'silentGhost', 'silentStealth', 'silentOneclick'];
    silentOpts.forEach((opt, i) => { if (optKeys[i]) opt.textContent = t(optKeys[i]); });

    // Silent mode hints
    const silentHint = document.querySelector('#silent-mode-select-group .field-hint');
    if (silentHint) {
        silentHint.innerHTML = `<strong>${t('silentIndicators')}:</strong> ${t('silentIndicatorsHint')}<br><strong>${t('silentGhost')}:</strong> ${t('silentGhostHint')}<br><strong>${t('silentStealth')}:</strong> ${t('silentStealthHint')}<br><strong>${t('silentOneclick')}:</strong> ${t('silentOneclickHint')}`;
    }

    // Position settings
    const posLabel = document.querySelector('#position-grid')?.closest('.form-group')?.querySelector('label');
    if (posLabel) posLabel.textContent = t('defaultPositionLabel');
    const posHint = document.querySelector('#position-grid')?.closest('.form-group')?.querySelector('.field-hint');
    if (posHint) posHint.textContent = t('defaultPositionHint');
    const rememberDragSpan = document.querySelector('#remember-drag-toggle + span');
    if (rememberDragSpan) rememberDragSpan.textContent = t('rememberDrag');
    const rememberDragHint = document.querySelector('#remember-drag-toggle')?.closest('.toggle-group')?.querySelector('.field-hint');
    if (rememberDragHint) rememberDragHint.textContent = t('rememberDragHint');

    // Web search toggle
    const webSearchSpan = document.querySelector('#web-search-toggle + span');
    if (webSearchSpan) webSearchSpan.textContent = t('webSearchLabel');
    const webSearchHintEl = document.getElementById('web-search-hint');
    if (webSearchHintEl) webSearchHintEl.textContent = t('webSearchHint');
    const addConsensusBtn = document.getElementById('add-consensus-run-btn');
    if (addConsensusBtn) addConsensusBtn.textContent = t('consensusAddRun');
    document.querySelector('#consensus-toggle + span').textContent = t('consensusLabel');
    // Hotkey
    const hotkeyLabel = document.getElementById('hotkey-label');
    if (hotkeyLabel) hotkeyLabel.textContent = t('hotkeyLabel');
    const hotkeyHintEl = document.getElementById('hotkey-hint');
    if (hotkeyHintEl) hotkeyHintEl.textContent = t('hotkeyHint');
    const hotkeyClearBtn = document.getElementById('hotkey-clear');
    if (hotkeyClearBtn) hotkeyClearBtn.title = t('hotkeyClear');

    // Themes tab
    const themesDesc = document.querySelector('.tab-description');
    if (themesDesc) themesDesc.innerHTML = t('themesDesc');
    const editorTitle = document.querySelector('.theme-editor-title');
    if (editorTitle) editorTitle.textContent = t('newTheme');
    const editorNameLabel = document.querySelector('label[for="theme-editor-name"]');
    if (editorNameLabel) editorNameLabel.textContent = t('themeNameLabel');
    const editorNameInput = document.getElementById('theme-editor-name');
    if (editorNameInput) editorNameInput.placeholder = t('themeNamePlaceholder');
    const editorBorderLabel = document.querySelector('label[for="editor-border-input"]');
    if (editorBorderLabel) editorBorderLabel.textContent = t('accentLabel');
    const editorHeaderLabel = document.querySelector('label[for="editor-header-input"]');
    if (editorHeaderLabel) editorHeaderLabel.textContent = t('headerLabel');
    const editorContentLabel = document.querySelector('label[for="editor-content-input"]');
    if (editorContentLabel) editorContentLabel.textContent = t('backgroundLabel');
    const editorTextLabel = document.querySelector('label[for="editor-text-input"]');
    if (editorTextLabel) editorTextLabel.textContent = t('textLabel');
    const cancelBtn = document.getElementById('theme-editor-cancel');
    if (cancelBtn) cancelBtn.textContent = t('cancelBtn');
    const saveBtn = document.getElementById('theme-editor-save');
    if (saveBtn) saveBtn.textContent = t('saveThemeBtn');
    document.querySelector('#glow-effect-toggle + span').textContent = t('glowEffect');
    document.querySelector('#glow-effect-toggle').closest('.toggle-group').querySelector('.field-hint').textContent = t('glowEffectHint');

    // Donate tab
    const donateText = document.querySelector('.donate-content > p');
    if (donateText) donateText.textContent = t('donateText');
    const donateBtnSpan = document.querySelector('.donate-button span');
    if (donateBtnSpan) donateBtnSpan.textContent = t('donateBtn');
}

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
    langsearch: 'https://api.langsearch.com/v1',
    serper: 'https://google.serper.dev'
};

const API_FORMAT_MAP = {
    openai: 'openai', anthropic: 'anthropic', google: 'google',
    deepseek: 'openai', groq: 'openai', openrouter: 'openai',
    cerebras: 'openai', together: 'openai', fireworks: 'openai', mistral: 'openai',
    'unturf-hermes': 'openai', 'unturf-qwen': 'openai', 'unturf-vl': 'openai'
};

const API_PROVIDERS = [
    { id: 'openai', name: 'OpenAI', hint: 'OpenAI API', logo: 'openai' },
    { id: 'anthropic', name: 'Anthropic', hint: 'Claude Messages API', logo: 'anthropic' },
    { id: 'google', name: 'Google (Gemini)', hint: 'Generative Language API', logo: 'google' },
    { id: 'deepseek', name: 'DeepSeek', hint: 'DeepSeek API', logo: 'deepseek' },
    { id: 'groq', name: 'Groq', hint: 'Groq API (fast inference)', logo: 'groq' },
    { id: 'openrouter', name: 'OpenRouter', hint: 'OpenRouter API (multi-provider)', logo: 'openrouter' },
    { id: 'cerebras', name: 'Cerebras', hint: 'Cerebras API (fast inference)', logo: 'cerebras' },
    { id: 'together', name: 'Together AI', hint: 'Together API', logo: 'together-ai' },
    { id: 'fireworks', name: 'Fireworks AI', hint: 'Fireworks API', logo: 'fireworks-ai' },
    { id: 'mistral', name: 'Mistral', hint: 'Mistral API', logo: 'mistral' },
    { id: 'unturf-hermes', name: 'Unturf Hermes', hint: 'Free — Hermes 3 Llama 3.1 8B', logo: 'unturf' },
    { id: 'unturf-qwen', name: 'Unturf Qwen', hint: 'Free — Qwen3 Coder + Gemma 4', logo: 'unturf' },
    { id: 'unturf-vl', name: 'Unturf Vision', hint: 'Free — Qwen VL (image support)', logo: 'unturf' },
    // Web Search providers (kind: 'search' — not LLM, used for tool-calling)
    { id: 'langsearch', name: 'LangSearch', hint: 'Web Search — Free API', logo: 'openai', kind: 'search' },
    { id: 'serper', name: 'Serper.dev', hint: 'Web Search — 2,500 free/month', logo: 'openai', kind: 'search' },
    { id: 'perplexity', name: 'Perplexity', hint: 'Web Search — pplx- API key', logo: 'openai', kind: 'search' },
    { id: 'exa', name: 'Exa', hint: 'Web Search — neural/fast search', logo: 'openai', kind: 'search' },
    { id: 'tavily', name: 'Tavily', hint: 'Web Search — tvly- API key', logo: 'openai', kind: 'search' },
    { id: 'linkup', name: 'Linkup', hint: 'Web Search — fast/standard/deep', logo: 'openai', kind: 'search' },
    { id: 'searchapi', name: 'SearchAPI', hint: 'Web Search — Google/Bing/Yahoo', logo: 'openai', kind: 'search' }
];

const PROVIDER_ICON_MAP = {
    'openai': 'openai', 'anthropic': 'anthropic', 'google': 'google',
    'nvidia': 'nvidia', 'ollama-cloud': 'ollama', 'ollamacloud': 'ollama',
    'opencode-zen': 'openai', 'venice': 'venice', 'pollinations': 'pollinations',
    'publicai': 'openai', 'unturf': 'unturf', 'unturf-hermes': 'unturf',
    'unturf-qwen': 'unturf', 'unturf-vl': 'unturf', 'g4f': 'openai',
    'deepseek-ai': 'deepseek', 'deepseek': 'deepseek',
    'meta': 'meta', 'moonshotai': 'moonshot', 'z-ai': 'zhipu',
    'mistralai': 'mistral', 'mistral': 'mistral',
    'aisingapore': 'ai-singapore', 'allenai': 'allennlp',
    'swiss-ai': 'swissai',
    'groq': 'groq', 'openrouter': 'openrouter',
    'cerebras': 'cerebras', 'together': 'together-ai',
    'fireworks': 'fireworks-ai'
};

const NON_CHAT_TYPES = new Set(['embedding', 'rerank', 'audio', 'image', 'video', 'tts', 'stt', 'speech']);

let allModels = [];
let modelsDevCache = null; // { modelId: { n, f, a, r, c, l, m, p } }
const providerModelsCache = {}; // providerId → [model objects] from API fetch

function getApiProviderMeta(id) {
    return API_PROVIDERS.find(p => p.id === id) || API_PROVIDERS[0];
}

// Load models.dev cache from storage
async function loadModelsDevCache() {
    try {
        const data = await chrome.storage.local.get('xdAnswers_modelsDev');
        if (data.xdAnswers_modelsDev) {
            modelsDevCache = JSON.parse(data.xdAnswers_modelsDev);
        }
    } catch {}
}

// Get models.dev info for a model ID (tries multiple key formats)
function getModelDevInfo(modelId) {
    if (!modelsDevCache || !modelId) return null;
    return modelsDevCache[modelId] ||
           modelsDevCache[modelId.replace(/^[^/]+\//, '')] ||
           null;
}

function escapeHTML(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const MODEL_NAME_ACRONYMS = new Set([
    'gpt', 'glm', 'qwq', 'gpu', 'api', 'llm', 'llms', 'ai', 'xai',
    'mai', 'rlhf', 'moe', 'vlm', 'hd', 'sdk', 'gguf', 'fp8', 'fp16',
    'int4', 'int8', 'ocr', 'tts', 'stt', 'oss', 'mlx', 'awq',
    'gptq', 'bnb', 'cpu', 'tpu', 'npu', 'mtp'
]);

function formatModelName(id) {
    if (!id) return '';
    // Strip provider prefix ("google/...", "openai/...").
    let name = id.replace(/^[^/]+\//, '');
    // Normalise common separators to spaces, but keep dots (decimals) intact.
    name = name.replace(/[_:]+/g, ' ').replace(/-+/g, ' ').replace(/\s+/g, ' ').trim();
    // Title-case each whitespace-separated token, with a few tweaks:
    //  - Preserve pure-numeric tokens (including decimals like "3.1").
    //  - Uppercase well-known acronyms (gpt → GPT).
    //  - Keep letter+digits tokens like "k2.5" / "4o" readable: capitalise
    //    the leading letter(s), keep the rest as-is.
    return name.split(' ').map((token) => {
        if (!token) return token;
        const lower = token.toLowerCase();
        if (MODEL_NAME_ACRONYMS.has(lower)) return lower.toUpperCase();
        if (/^\d+(\.\d+)*$/.test(token)) return token;           // 3.1, 2024, 05
        // Capitalise leading alphabetic run, preserve the rest.
        return token.replace(/^([a-z]+)/i, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
    }).join(' ');
}

function getProviderIcon(ownedBy) {
    const key = (ownedBy || '').toLowerCase();
    for (const [pattern, icon] of Object.entries(PROVIDER_ICON_MAP)) {
        if (key === pattern || key.startsWith(pattern)) return icon;
    }
    return null;
}

function getModelFamilyIcon(modelId) {
    const id = (modelId || '').toLowerCase();
    const root = id.split('/').pop() || id;
    const families = [
        ['gpt', 'openai'], ['o1', 'openai'], ['o3', 'openai'], ['o4', 'openai'],
        ['claude', 'anthropic'], ['gemini', 'google'], ['gemma', 'google'],
        ['deepseek', 'deepseek'], ['llama', 'meta'], ['qwen', 'qwen'],
        ['mistral', 'mistral'], ['mixtral', 'mistral'], ['ministral', 'mistral'],
        ['kimi', 'moonshot'], ['moonshot', 'moonshot'], ['grok', 'xai'],
        ['command', 'cohere'], ['cohere', 'cohere'], ['minimax', 'minimax'],
        ['phi', 'microsoft'], ['nemo', 'nvidia']
    ];
    for (const [needle, icon] of families) {
        if (root.includes(needle)) return icon;
    }
    return getProviderIcon(id.split('/')[0]) || null;
}

function formatContextLength(ctx) {
    if (!ctx) return '';
    if (ctx >= 1000000) return (ctx / 1000000).toFixed(1).replace(/\.0$/, '') + t('ctxMillion');
    if (ctx >= 1000) return (ctx / 1000).toFixed(0) + t('ctxThousand');
    return String(ctx);
}

function processModels(rawModels, format) {
    let models;
    if (format === 'google') {
        models = (rawModels.models || []).map(m => ({
            id: m.name?.replace('models/', '') || m.name,
            ownedBy: 'google',
            contextLength: m.inputTokenLimit || null,
            type: null
        }));
    } else {
        models = (rawModels.data || []).map(m => ({
            id: m.id,
            ownedBy: m.owned_by || '',
            root: m.root || m.id,
            parent: m.parent || null,
            contextLength: m.context_length || null,
            capabilities: m.capabilities || null,
            type: m.type || null
        }));
    }

    // Filter out non-chat types (embedding, image, audio, rerank, etc.)
    models = models.filter(m => {
        if (!m.id) return false;
        if (m.type && NON_CHAT_TYPES.has(m.type)) return false;
        if (m.type === 'embedding' || m.type === 'rerank') return false;
        return true;
    });

    // Deduplicate by root — keep the primary model (parent === null),
    // drop aliases (parent !== null) that point to the same root.
    const byRoot = new Map(); // root → primary model entry
    const byId = new Map();   // id (lowercase) → model entry (fallback dedup)
    for (const m of models) {
        const root = m.root || m.id;
        const idKey = m.id.toLowerCase();
        // Exact ID dedup (case-insensitive)
        if (byId.has(idKey)) continue;
        byId.set(idKey, m);

        if (!byRoot.has(root)) {
            byRoot.set(root, m);
        } else {
            const existing = byRoot.get(root);
            // Prefer the model WITHOUT a parent (primary) over one with a parent (alias)
            if (existing.parent && !m.parent) {
                byRoot.set(root, m);
            }
            // If both or neither have parent, keep the first one (shorter prefix = cleaner)
        }
    }

    // Collect deduplicated results: unique by root, plus any leftover unique-by-id entries
    const seenRoots = new Set();
    const result = [];
    for (const m of byId.values()) {
        const root = m.root || m.id;
        if (!seenRoots.has(root)) {
            seenRoots.add(root);
            result.push(byRoot.get(root) || m);
        }
    }

    return result;
}

const DEFAULT_PROMPT = 'Відповідай на тестові питання. Відповідь — ТІЛЬКИ валідний JSON об\'єкт, без markdown, без ```json, без зайвого тексту.\n\nФормат:\n{"answer": "правильна відповідь", "explanation": "коротке пояснення (1-3 речення)", "solution": "Дано: ... Розв\'язок: ...", "confidence": "0-100%"}\n\nПравила:\n- answer: точний текст правильного варіанту, якщо є варіанти відповідей\n- Для кількох правильних відповідей розділяй "; "\n- Відповідай мовою питання\n- solution пиши тільки для задач з розрахунками (фізика, хімія, математика)\n- confidence необов\'язкове\n- Виводь ТІЛЬКИ JSON об\'єкт, нічого більше';

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

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
    promptPrefix: DEFAULT_PROMPT,
    language: 'uk',
    autoAnswer: false,
    autoAnswerCooldown: 2000,
    highlightCorrect: true,
    showAnswerOnly: false,
    silentMode: '',
    _silentModePreselect: 'indicators',
    hotkey: 'Ctrl+Shift+X',
    webSearchEnabled: false,
    defaultPosition: 'bottom-right',
    rememberDragPosition: false,
    savedPosition: null,
    customization: {
        glowEffect: false,
        ...PREDEFINED_THEMES['Dark']
    },
    customThemes: [],
    consensus: {
        enabled: false,
        runs: []
    }
};

let settings;
let uiElements = {};

function getActiveProvider(s) {
    if (!s.providers || !s.providers.length) return null;
    const active = s.providers.find(p => p.id === s.activeProviderId);
    if (active && active.kind !== 'search') return active;
    return s.providers.find(p => p.kind !== 'search') || null;
}

async function loadSettings() {
    const data = await chrome.storage.local.get('xdAnswers_settings');
    let loaded = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (data.xdAnswers_settings) {
        try {
            const parsed = JSON.parse(data.xdAnswers_settings);

            // Migration from old flat format (apiFormat/baseUrl/apiKey at root)
            if (parsed.apiFormat && !parsed.providers) {
                const oldDefaults = {
                    openai: 'https://api.openai.com/v1',
                    anthropic: 'https://api.anthropic.com',
                    google: 'https://generativelanguage.googleapis.com'
                };
                let baseUrl = parsed.baseUrl || DEFAULT_BASE_URLS[parsed.apiFormat] || '';
                if (oldDefaults[parsed.apiFormat] === baseUrl) {
                    baseUrl = DEFAULT_BASE_URLS[parsed.apiFormat];
                }
                const meta = getApiProviderMeta(parsed.apiFormat);
                const migratedProvider = {
                    id: generateId(),
                    type: parsed.apiFormat,
                    name: meta.name,
                    baseUrl: baseUrl,
                    apiKey: parsed.apiKey || ''
                };
                parsed.providers = [migratedProvider];
                parsed.activeProviderId = migratedProvider.id;
                parsed.model = parsed.model || 'gpt-4o';
                delete parsed.apiFormat;
                delete parsed.baseUrl;
                delete parsed.apiKey;
            }

            loaded = {
                ...loaded,
                ...parsed,
                providers: parsed.providers || [],
                customization: { ...loaded.customization, ...(parsed.customization || {}) },
                consensus: { ...loaded.consensus, ...(parsed.consensus || {}) }
            };

            // Міграція: додати безкоштовні unturf провайдери для юзерів з порожнім списком
            if (!loaded.providers || loaded.providers.length === 0) {
                loaded.providers = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.providers));
                loaded.activeProviderId = DEFAULT_SETTINGS.activeProviderId;
            }
            if (typeof loaded.promptPrefix !== 'string' || !loaded.promptPrefix.trim()) {
                loaded.promptPrefix = DEFAULT_SETTINGS.promptPrefix;
            }
            // Migrate silentMode: true/false → string
            if (typeof loaded.silentMode === 'boolean') {
                loaded.silentMode = loaded.silentMode ? 'ghost' : '';
            }
            if (!Array.isArray(loaded.customThemes)) {
                loaded.customThemes = [];
            }
            // Migration: add consensus defaults if missing
            if (!loaded.consensus || typeof loaded.consensus !== 'object') {
                loaded.consensus = { enabled: false, runs: [] };
            }
            if (!Array.isArray(loaded.consensus.runs)) {
                loaded.consensus.runs = [];
            }
        } catch (e) {
            console.error('Failed to parse settings', e);
        }
    }
    return loaded;
}

async function saveSettingsAndNotify(s) {
    await chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(s) });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'settingsUpdated' }, () => chrome.runtime.lastError && undefined);
        }
    });
}

function isColorDark(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.45;
}

function applyThemeToPopup() {
    const root = document.documentElement;
    const c = settings.customization;
    root.style.setProperty('--popup-bg', c.contentColor);
    root.style.setProperty('--header-bg', c.headerColor);
    root.style.setProperty('--popup-text', c.textColor);
    root.style.setProperty('--popup-border', c.borderColor);
    root.classList.toggle('xd-dark-icons', isColorDark(c.contentColor));
    root.classList.toggle('xd-light-icons', !isColorDark(c.contentColor));
}

function populateUI() {
    const el = uiElements;
    renderActiveProviderSelector();
    el.modelName.value = settings.model;
    renderModelList();

    el.autoAnswerToggle.checked = settings.autoAnswer;
    el.autoAnswerCooldown.value = settings.autoAnswerCooldown;
    el.cooldownGroup.style.display = settings.autoAnswer ? 'block' : 'none';
    el.highlightCorrectToggle.checked = settings.highlightCorrect;
    el.showAnswerOnlyToggle.checked = !!settings.showAnswerOnly;
    const silentModeValue = settings.silentMode || '';
    el.silentModeToggle.checked = silentModeValue !== '';
    // Select always visible so user can pre-choose mode
    el.silentModeSelectGroup.style.display = 'block';
    el.silentModeSelect.value = silentModeValue || 'indicators';

    // Web search toggle
    if (el.webSearchToggle) el.webSearchToggle.checked = !!settings.webSearchEnabled;

    // Consensus toggle
    if (el.consensusToggle) el.consensusToggle.checked = !!(settings.consensus && settings.consensus.enabled);

    // Consensus mode run cards
    renderConsensusRuns();

    el.glowEffectToggle.checked = settings.customization.glowEffect;

    // Position grid: mark active cell, sync remember-drag toggle
    if (el.positionGrid) {
        const activePosition = settings.defaultPosition || 'bottom-right';
        el.positionGrid.querySelectorAll('.position-cell').forEach(cell => {
            const isActive = cell.dataset.position === activePosition;
            cell.classList.toggle('active', isActive);
            cell.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
    }
    if (el.rememberDragToggle) el.rememberDragToggle.checked = !!settings.rememberDragPosition;

    // Hotkey display
    if (el.hotkeyRecorderKbd) el.hotkeyRecorderKbd.textContent = settings.hotkey || 'Ctrl+Shift+X';

    applyLanguage();
    populateThemesGrid();
    renderProvidersTab();
    applyThemeToPopup();
}

function renderActiveProviderSelector() {
    const trigger = uiElements.activeProviderTrigger;
    const dropdown = uiElements.activeProviderDropdown;
    if (!trigger || !dropdown) return;

    const active = getActiveProvider(settings);
    if (active) {
        const logo = getProviderLogo(active);
        const isOther = active.type === 'other';
        const hintLine = isOther ? escapeHTML(active.baseUrl) : (getApiProviderMeta(active.type)?.hint || '');
        trigger.innerHTML = `<span class="provider-trigger-value">
            <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" loading="lazy">
            <span class="provider-option-text">
                <span class="provider-option-title">${escapeHTML(active.name)}</span>
                <span class="provider-option-hint">${hintLine}</span>
            </span>
        </span><span class="provider-caret">▾</span>`;
    } else {
        trigger.innerHTML = `<span class="provider-trigger-value">
            <span class="provider-option-text">
                <span class="provider-option-title">—</span>
                <span class="provider-option-hint">—</span>
            </span>
        </span><span class="provider-caret">▾</span>`;
    }

    dropdown.innerHTML = settings.providers.filter(p => p.kind !== 'search').map(p => {
        const isActive = p.id === settings.activeProviderId ? ' active' : '';
        const logo = getProviderLogo(p);
        const isOther = p.type === 'other';
        const hint = isOther ? escapeHTML(p.baseUrl) : (getApiProviderMeta(p.type)?.hint || '');
        return `<button type="button" class="provider-option${isActive}" data-provider-id="${p.id}">
            <span class="provider-option-main">
                <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" loading="lazy">
                <span class="provider-option-text">
                    <span class="provider-option-title">${escapeHTML(p.name)}</span>
                    <span class="provider-option-hint">${hint}</span>
                </span>
            </span>
        </button>`;
    }).join('');

    if (!settings.providers.length) {
        dropdown.innerHTML = '<div class="provider-empty">No providers configured</div>';
    }

    dropdown.querySelectorAll('.provider-option').forEach(button => {
        button.addEventListener('click', async () => {
            settings.activeProviderId = button.dataset.providerId;
            renderActiveProviderSelector();
            dropdown.classList.add('hidden');
            allModels = [];
            await autoSave({ activeProviderId: settings.activeProviderId });
            fetchModels().then(() => renderModelList());
        });
    });
}

function renderProvidersTab() {
    const container = uiElements.providersContainer;
    if (!container) return;

    const standard = settings.providers.filter(p => p.type !== 'other' && p.kind !== 'search');
    const search = settings.providers.filter(p => p.kind === 'search');
    const custom = settings.providers.filter(p => p.type === 'other' && p.kind !== 'search');

    let html = '<div class="providers-section">';
    html += `<div class="providers-section-header">${t('providersHeader')}</div>`;
    if (standard.length) {
        html += standard.map(p => renderProviderCard(p)).join('');
    } else {
        html += `<div class="provider-empty-hint">${t('noProviders')}</div>`;
    }
    html += `<button type="button" class="add-provider-btn" data-section="standard">${t('addProvider')}</button>`;
    html += '</div>';

    // Web Search providers section (always show with add button)
    html += '<div class="providers-section">';
    html += `<div class="providers-section-header">🔍 ${t('webSearchLabel')}</div>`;
    if (search.length) {
        html += search.map(p => renderProviderCard(p)).join('');
    }
    html += `<button type="button" class="add-provider-btn" data-section="search">${t('addProvider')}</button>`;
    html += '</div>';

    html += '<div class="providers-section">';
    html += `<div class="providers-section-header">${t('otherHeader')} <span class="providers-section-hint">${t('otherHint')}</span></div>`;
    if (custom.length) {
        html += custom.map(p => renderProviderCard(p)).join('');
    }
    html += `<button type="button" class="add-provider-btn" data-section="other">${t('addCustomProvider')}</button>`;
    html += '</div>';

    container.innerHTML = html;
    attachProviderCardListeners(container);
}

function getProviderLogo(p) {
    if (p.type === 'other') return 'openai';
    const meta = getApiProviderMeta(p.type);
    return meta ? meta.logo : 'openai';
}

function renderProviderCard(p) {
    const logo = getProviderLogo(p);
    const isActive = p.id === settings.activeProviderId;
    const activeBadge = isActive ? '<span class="provider-active-badge">active</span>' : '';
    const searchBadge = p.kind === 'search' ? '<span class="provider-search-badge">🔍 SEARCH</span>' : '';
    const keyPreview = p.apiKey ? '••••' + p.apiKey.slice(-4) : '—';
    const isOther = p.type === 'other';
    const urlLine = isOther ? `<span class="provider-card-url">${escapeHTML(p.baseUrl)}</span>` : '';

    const isSearch = p.kind === 'search';
    const activateBtn = isSearch ? '' : '<button type="button" class="provider-card-btn provider-activate-btn" data-id="' + p.id + '" title="Set active">✓</button>';

    return `<div class="provider-card${isActive && !isSearch ? ' active' : ''}" data-id="${p.id}">
        <div class="provider-card-header">
            <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" loading="lazy">
            <div class="provider-card-info">
                <span class="provider-card-name">${escapeHTML(p.name)}${activeBadge}${searchBadge}</span>
                ${urlLine}
                <span class="provider-card-key">${keyPreview}</span>
            </div>
            <div class="provider-card-actions">
                ${activateBtn}
                <button type="button" class="provider-card-btn provider-edit-btn" data-id="${p.id}" title="Edit">✎</button>
                <button type="button" class="provider-card-btn provider-delete-btn" data-id="${p.id}" title="Delete">✕</button>
            </div>
        </div>
    </div>`;
}

function attachProviderCardListeners(container) {
    container.querySelectorAll('.provider-activate-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            settings.activeProviderId = btn.dataset.id;
            allModels = [];
            renderProvidersTab();
            renderActiveProviderSelector();
            await autoSave({ activeProviderId: settings.activeProviderId });
            fetchModels().then(() => renderModelList());
        });
    });

    container.querySelectorAll('.provider-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const provider = settings.providers.find(p => p.id === btn.dataset.id);
            if (provider) showProviderForm(provider);
        });
    });

    container.querySelectorAll('.provider-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            settings.providers = settings.providers.filter(p => p.id !== btn.dataset.id);
            if (settings.activeProviderId === btn.dataset.id) {
                settings.activeProviderId = settings.providers[0]?.id || '';
            }
            renderProvidersTab();
            renderActiveProviderSelector();
            await autoSave();
        });
    });

    container.querySelectorAll('.add-provider-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const isOther = btn.dataset.section === 'other';
            const isSearch = btn.dataset.section === 'search';
            showProviderForm(null, isOther, isSearch);
        });
    });
}

function showProviderForm(existing, isOther, isSearch) {
    const container = uiElements.providersContainer;
    if (!container) return;

    const isEdit = !!existing;
    const initialType = existing?.type || (isSearch ? 'langsearch' : (isOther ? 'other' : 'openai'));
    const isOtherType = initialType === 'other';
    const defaultUrl = existing?.baseUrl || (isOtherType ? '' : (DEFAULT_BASE_URLS[initialType] || ''));
    const urlDisplay = isOtherType ? '' : ' style="display:none"';

    // For search providers, only show search-type providers in the dropdown
    const providerOptions = isSearch
        ? API_PROVIDERS.filter(p => p.kind === 'search')
        : (isOther
            ? []
            : API_PROVIDERS.filter(p => p.kind !== 'search'));

    const providerListHtml = isOther
        ? `<div class="pf-type-selected">
                <img class="provider-icon large" src="https://models.dev/logos/openai.svg" alt="" loading="lazy">
                <span class="provider-option-text"><span class="provider-option-title">Custom (OpenAI-compatible)</span></span>
            </div>`
        : (() => {
            const sel = API_PROVIDERS.find(p => p.id === initialType) || API_PROVIDERS[0];
            return `<button type="button" class="pf-type-trigger" id="pf-type-trigger">
                <span class="provider-trigger-value">
                    <img class="provider-icon large" src="https://models.dev/logos/${sel.logo}.svg" alt="" loading="lazy">
                    <span class="provider-option-text">
                        <span class="provider-option-title">${escapeHTML(sel.name)}</span>
                        <span class="provider-option-hint">${escapeHTML(sel.hint)}</span>
                    </span>
                </span><span class="provider-caret">▾</span>
            </button>
            <div class="pf-type-dropdown hidden" id="pf-type-dropdown">
                ${providerOptions.map(p => `<button type="button" class="pf-type-option${p.id === initialType ? ' active' : ''}" data-type="${p.id}">
                    <img class="provider-icon large" src="https://models.dev/logos/${p.logo}.svg" alt="" loading="lazy">
                    <span class="provider-option-text">
                        <span class="provider-option-title">${escapeHTML(p.name)}</span>
                        <span class="provider-option-hint">${escapeHTML(p.hint)}</span>
                    </span>
                </button>`).join('')}
            </div>`;
        })();

    const formHtml = `<div class="provider-form">
        <div class="form-group">
            <label>${t('providerTypeLabel')}</label>
            <div class="pf-type-wrapper">${providerListHtml}</div>
            <input type="hidden" id="pf-type" value="${initialType}">
        </div>
        <div class="form-group">
            <label>${t('providerNameLabel')}</label>
            <input type="text" id="pf-name" value="${escapeHTML(existing?.name || '')}" placeholder="${isOtherType ? t('providerNamePlaceholder') : getApiProviderMeta(initialType)?.name || 'Provider'}">
        </div>
        <div class="form-group pf-url-group"${urlDisplay}>
            <label>${t('providerBaseUrlLabel')}</label>
            <input type="text" id="pf-url" value="${escapeHTML(defaultUrl)}" placeholder="https://api.example.com/v1">
        </div>
        <div class="form-group">
            <label>${t('providerApiKeyLabel')}</label>
            <input type="password" id="pf-key" value="${escapeHTML(existing?.apiKey || '')}" placeholder="${t('providerApiKeyPlaceholder')}">
        </div>
        <div class="provider-form-actions">
            <button type="button" id="pf-save" class="pf-btn pf-save-btn">${isEdit ? t('saveProvider') : t('addProviderType')}</button>
            <button type="button" id="pf-cancel" class="pf-btn pf-cancel-btn">${t('cancelBtn')}</button>
        </div>
    </div>`;

    const formWrapper = document.createElement('div');
    formWrapper.className = 'provider-form-overlay';
    formWrapper.innerHTML = formHtml;
    // Remove any existing overlay first
    document.querySelector('.provider-form-overlay')?.remove();
    document.body.appendChild(formWrapper);

    // Close on backdrop click (outside the form card)
    formWrapper.addEventListener('click', (e) => {
        if (e.target === formWrapper) formWrapper.remove();
    });

    const pfType = formWrapper.querySelector('#pf-type');
    const pfUrl = formWrapper.querySelector('#pf-url');
    const pfTypeTrigger = formWrapper.querySelector('#pf-type-trigger');
    const pfTypeDropdown = formWrapper.querySelector('#pf-type-dropdown');

    if (pfTypeTrigger && pfTypeDropdown) {
        pfTypeTrigger.addEventListener('click', () => {
            pfTypeDropdown.classList.toggle('hidden');
        });

        pfTypeDropdown.querySelectorAll('.pf-type-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const newType = btn.dataset.type;
                const meta = getApiProviderMeta(newType);
                pfType.value = newType;
                const logo = meta?.logo || 'openai';
                pfTypeTrigger.innerHTML = `<span class="provider-trigger-value">
                    <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" loading="lazy">
                    <span class="provider-option-text">
                        <span class="provider-option-title">${escapeHTML(meta?.name || newType)}</span>
                        <span class="provider-option-hint">${escapeHTML(meta?.hint || '')}</span>
                    </span>
                </span><span class="provider-caret">▾</span>`;
                pfTypeDropdown.querySelectorAll('.pf-type-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                pfTypeDropdown.classList.add('hidden');
                pfUrl.value = DEFAULT_BASE_URLS[newType] || '';
                const nameInput = formWrapper.querySelector('#pf-name');
                if (!nameInput.value.trim()) nameInput.placeholder = meta?.name || 'Provider';
            });
        });

        document.addEventListener('click', function closeTypeDropdown(e) {
            if (!formWrapper.contains(e.target)) {
                pfTypeDropdown.classList.add('hidden');
            }
            if (!document.contains(formWrapper)) {
                document.removeEventListener('click', closeTypeDropdown);
            }
        });
    }

    formWrapper.querySelector('#pf-cancel').addEventListener('click', () => {
        formWrapper.remove();
    });

    formWrapper.querySelector('#pf-save').addEventListener('click', async () => {
        const selectedType = isOther ? 'other' : pfType.value;
        const name = formWrapper.querySelector('#pf-name').value.trim();
        const key = formWrapper.querySelector('#pf-key').value.trim();

        const isOtherSave = selectedType === 'other';
        const meta = getApiProviderMeta(selectedType);
        const finalName = name || (isOtherSave ? t('providerCustomName') : (meta?.name || selectedType));
        const finalUrl = isOtherSave
            ? (pfUrl.value.trim() || 'https://api.openai.com/v1')
            : (DEFAULT_BASE_URLS[selectedType] || '');

        if (isEdit) {
            existing.type = selectedType;
            existing.name = finalName;
            existing.baseUrl = finalUrl;
            existing.apiKey = key;
            // Update kind based on new type
            const editMeta = getApiProviderMeta(selectedType);
            if (editMeta?.kind === 'search') existing.kind = 'search';
            else delete existing.kind;
        } else {
            const newProvider = {
                id: generateId(),
                type: selectedType,
                name: finalName,
                baseUrl: finalUrl,
                apiKey: key
            };
            // Tag search providers
            const meta = getApiProviderMeta(selectedType);
            if (meta?.kind === 'search') newProvider.kind = 'search';
            settings.providers.push(newProvider);
            if (!settings.activeProviderId) {
                settings.activeProviderId = newProvider.id;
            }
            // Auto-enable web search when first search provider is added with an API key
            if (meta?.kind === 'search' && key && !settings.webSearchEnabled) {
                settings.webSearchEnabled = true;
                if (uiElements.webSearchToggle) uiElements.webSearchToggle.checked = true;
            }
        }

        formWrapper.remove();
        renderProvidersTab();
        renderActiveProviderSelector();
        await autoSave();
    });
}

function themesAreEqual(a, b) {
    if (!a || !b) return false;
    return a.borderColor === b.borderColor
        && a.contentColor === b.contentColor
        && a.headerColor === b.headerColor
        && a.textColor === b.textColor;
}

function buildThemeCard(name, theme, { custom = false, index = -1 } = {}) {
    const card = document.createElement('div');
    card.className = 'theme-card' + (custom ? ' custom' : '');
    if (themesAreEqual(theme, settings.customization)) {
        card.classList.add('active');
    }

    const deleteBtn = custom
        ? `<button type="button" class="theme-delete" data-idx="${index}" title="${t('deleteTheme')}" aria-label="${t('deleteTheme')}">×</button>`
        : '';

    card.innerHTML = `${deleteBtn}<div class="theme-name">${escapeHTML(name)}</div><div class="theme-preview">
        <div class="theme-color-chip" style="background:${theme.borderColor}"></div>
        <div class="theme-color-chip" style="background:${theme.contentColor}"></div>
        <div class="theme-color-chip" style="background:${theme.headerColor}"></div>
        <div class="theme-color-chip" style="background:${theme.textColor}"></div></div>`;

    card.addEventListener('click', async (e) => {
        if (e.target.closest('.theme-delete')) return;
        settings.customization = {
            ...settings.customization,
            borderColor: theme.borderColor,
            contentColor: theme.contentColor,
            headerColor: theme.headerColor,
            textColor: theme.textColor
        };
        populateUI();
        await saveSettingsAndNotify(settings);
    });

    if (custom) {
        card.querySelector('.theme-delete').addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(e.currentTarget.dataset.idx, 10);
            if (!Number.isInteger(idx)) return;
            settings.customThemes.splice(idx, 1);
            populateThemesGrid();
            await saveSettingsAndNotify(settings);
        });
    }

    return card;
}

function buildAddThemeCard() {
    const card = document.createElement('div');
    card.className = 'theme-card add';
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', t('createTheme'));
    card.innerHTML = `<div class="theme-add-plus">+</div><div class="theme-add-label">${t('addThemeLabel')}</div>`;
    card.addEventListener('click', () => openThemeEditor());
    return card;
}

function populateThemesGrid() {
    const grid = uiElements.themesGrid;
    if (!grid) return;
    grid.innerHTML = '';
    for (const name in PREDEFINED_THEMES) {
        grid.appendChild(buildThemeCard(name, PREDEFINED_THEMES[name]));
    }
    (settings.customThemes || []).forEach((theme, idx) => {
        grid.appendChild(buildThemeCard(theme.name || t('untitled'), theme, { custom: true, index: idx }));
    });
    grid.appendChild(buildAddThemeCard());
}

function openThemeEditor() {
    const el = uiElements;
    if (!el.themeEditor) return;
    const base = settings.customization;
    const fields = [
        ['editorName', base.borderColor /* unused */, null],
    ];
    el.editorName.value = '';
    const defaults = {
        editorBorderInput: base.borderColor,
        editorHeaderInput: base.headerColor,
        editorContentInput: base.contentColor,
        editorTextInput: base.textColor
    };
    const pickers = {
        editorBorderInput: el.editorBorderPicker,
        editorHeaderInput: el.editorHeaderPicker,
        editorContentInput: el.editorContentPicker,
        editorTextInput: el.editorTextPicker
    };
    for (const [key, val] of Object.entries(defaults)) {
        el[key].value = val;
        const normalised = normaliseHex(val);
        if (pickers[key] && normalised) pickers[key].value = normalised;
    }
    el.themeEditor.classList.remove('hidden');
    el.editorName.focus();
}

function closeThemeEditor() {
    const el = uiElements;
    if (!el.themeEditor) return;
    el.themeEditor.classList.add('hidden');
}

async function saveCustomTheme() {
    const el = uiElements;
    const name = (el.editorName.value || '').trim() || `${t('customPrefix')} ${(settings.customThemes?.length || 0) + 1}`;
    const borderColor = normaliseHex(el.editorBorderInput.value);
    const headerColor = normaliseHex(el.editorHeaderInput.value);
    const contentColor = normaliseHex(el.editorContentInput.value);
    const textColor = normaliseHex(el.editorTextInput.value);
    if (!borderColor || !headerColor || !contentColor || !textColor) {
        // Visual hint: flash invalid inputs red
        [el.editorBorderInput, el.editorHeaderInput, el.editorContentInput, el.editorTextInput].forEach(inp => {
            const val = normaliseHex(inp.value);
            inp.classList.toggle('invalid', !val);
        });
        return;
    }

    const theme = { name, borderColor, headerColor, contentColor, textColor };
    if (!Array.isArray(settings.customThemes)) settings.customThemes = [];
    settings.customThemes.push(theme);

    // Apply the newly saved theme immediately
    settings.customization = { ...settings.customization, borderColor, headerColor, contentColor, textColor };

    closeThemeEditor();
    populateUI();
    await saveSettingsAndNotify(settings);
}

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'fetch', payload: options }, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (response?.success) resolve(response);
            else reject(new Error(response?.error || 'Fetch failed'));
        });
    });
}

async function fetchModelsForProvider(provider) {
    const format = API_FORMAT_MAP[provider.type] || (provider.type === 'other' ? 'openai' : provider.type);
    const base = provider.baseUrl.replace(/\/+$/, '');
    const key = provider.apiKey;
    let url, headers = {};

    if (format === 'openai') {
        url = `${base}/models`;
        if (key) headers['Authorization'] = `Bearer ${key}`;
    } else if (format === 'anthropic') {
        url = `${base}/models`;
        if (key) {
            headers['x-api-key'] = key;
            headers['anthropic-version'] = '2023-06-01';
        }
    } else if (format === 'google') {
        url = `${base}/models${key ? '?key=' + key : ''}`;
    } else {
        return [];
    }

    const fullText = await new Promise((resolve, reject) => {
        const port = chrome.runtime.connect({ name: 'xdAnswers-stream' });
        let data = '';
        port.onMessage.addListener((msg) => {
            if (msg.type === 'chunk') data += msg.data;
            else if (msg.type === 'done') { resolve(data); port.disconnect(); }
            else if (msg.type === 'error') { reject(new Error(msg.error + (msg.details ? ': ' + msg.details : ''))); port.disconnect(); }
        });
        port.onDisconnect.addListener(() => {
            if (data) resolve(data);
            else reject(new Error('Port disconnected'));
        });
        port.postMessage({ type: 'fetch_stream', payload: { url, method: 'GET', headers } });
    });

    const parsed = JSON.parse(fullText);
    return processModels(parsed, format);
}

async function fetchModels() {
    const btn = uiElements.fetchModelsBtn;
    if (!btn) return;
    btn.classList.add('spinning');
    try {
        const active = getActiveProvider(settings);
        if (!active) { btn.classList.remove('spinning'); return; }
        allModels = await fetchModelsForProvider(active);
        providerModelsCache[active.id] = allModels;
        renderModelList();
    } catch (e) {
        console.error('Failed to fetch models:', e);
    } finally {
        btn.classList.remove('spinning');
    }
}

function renderModelList() {
    const list = document.getElementById('model-list');
    const input = document.getElementById('model-name');
    if (!list || !input) return;

    const currentValue = settings.model || '';
    const query = input.value.toLowerCase().trim();

    // Merge API models + models.dev cache models
    let mergedModels = [...allModels];

    // If allModels is empty, build list from models.dev cache for current provider
    if (!mergedModels.length && modelsDevCache) {
        const active = getActiveProvider(settings);
        const provId = active?.type || '';
        const provKeyLookup = {
            openai: 'openai', anthropic: 'anthropic', google: 'google',
            deepseek: 'deepseek', groq: 'groq', openrouter: 'openrouter',
            cerebras: 'cerebras', together: 'together-ai', fireworks: 'fireworks-ai', mistral: 'mistral'
        };
        const devProvId = provKeyLookup[provId] || provId;
        for (const [key, info] of Object.entries(modelsDevCache)) {
            // Only take entries where p matches the provider, and key doesn't contain '/'
            if (key.includes('/')) continue; // skip composite keys
            if (info.p === devProvId || !devProvId) {
                mergedModels.push({
                    id: key,
                    ownedBy: info.p || 'other',
                    root: key,
                    contextLength: info.l?.c || null
                });
            }
        }
    }

    // Filter by query
    let filtered = mergedModels;
    if (query) {
        filtered = mergedModels.filter(m =>
            m.id.toLowerCase().includes(query) ||
            formatModelName(m.id).toLowerCase().includes(query) ||
            (m.ownedBy || '').toLowerCase().includes(query)
        );
    }

    const groups = {};
    for (const m of filtered) {
        const provider = m.ownedBy || 'other';
        if (!groups[provider]) groups[provider] = [];
        groups[provider].push(m);
    }

    const sortedProviders = Object.keys(groups).sort();
    const MAX_VISIBLE = 60;
    let count = 0;
    let html = '';

    // Add custom model entry if input doesn't match any model exactly
    const exactMatch = mergedModels.some(m => m.id.toLowerCase() === input.value.trim().toLowerCase());
    if (input.value.trim() && !exactMatch) {
        html += `<div class="model-item custom" data-model-id="${escapeHTML(input.value.trim())}">
            <span class="model-item-main"><span class="provider-icon-fallback">✎</span><span class="model-item-subtext"><span class="model-item-name">${escapeHTML(input.value.trim())}</span><span class="model-item-provider">${t('customModel')}</span></span></span>
        </div>`;
        count++;
    }

    for (const provider of sortedProviders) {
        if (count >= MAX_VISIBLE) break;
        const icon = getProviderIcon(provider);
        const iconHtml = icon
            ? `<img class="provider-icon" src="https://models.dev/logos/${icon}.svg" alt="" loading="lazy">`
            : `<span class="provider-icon-fallback">${(provider[0] || '?').toUpperCase()}</span>`;
        html += `<div class="model-provider-group">
            <div class="model-provider-header">${iconHtml}<span>${provider}</span>
            <span class="model-provider-count">${groups[provider].length}</span></div>`;

        for (const m of groups[provider]) {
            if (count >= MAX_VISIBLE) break;
            const ctxHtml = m.contextLength ? `<span class="model-ctx">${formatContextLength(m.contextLength)}</span>` : '';
            const familyIcon = getModelFamilyIcon(m.id);
            const modelIcon = familyIcon
                ? `<img class="model-icon" src="https://models.dev/logos/${familyIcon}.svg" alt="" loading="lazy">`
                : `<span class="provider-icon-fallback">${(formatModelName(m.root || m.id)[0] || '?').toUpperCase()}</span>`;
            const providerLabel = escapeHTML(m.ownedBy || 'other');
            const isSelected = m.id === currentValue;

            // Enrich with models.dev data
            const devInfo = getModelDevInfo(m.id);
            const badges = [];
            if (devInfo) {
                if (devInfo.a) badges.push(`<span class="model-badge vision" title="${t('badgeVision')}">🖼️</span>`);
                if (devInfo.r) badges.push(`<span class="model-badge reasoning" title="${t('badgeReasoning')}">🧠</span>`);
                if (devInfo.c) {
                    const inp = devInfo.c.i, out = devInfo.c.o;
                    if (inp !== undefined && out !== undefined) {
                        const fmtCost = v => v === 0 ? '$0' : (v < 0.01 ? `$${v.toFixed(3)}` : `$${v}`);
                        const costStr = fmtCost(inp);
                        badges.push(`<span class="model-badge cost" title="${t('badgeCostInput')}: ${fmtCost(inp)}/M  ${t('badgeCostOutput')}: ${fmtCost(out)}/M">${costStr}/M</span>`);
                    }
                }
                if (devInfo.l && devInfo.l.c && !m.contextLength) {
                    badges.push(`<span class="model-ctx">${formatContextLength(devInfo.l.c)}</span>`);
                }
            } else if (m.capabilities?.vision) {
                badges.push(`<span class="model-badge vision" title="${t('badgeVision')}">🖼️</span>`);
            }
            const badgesHtml = badges.join('');
            const selectedClass = isSelected ? ' selected' : '';

            html += `<div class="model-item${selectedClass}" data-model-id="${m.id}">
                <span class="model-item-main">${modelIcon}<span class="model-item-subtext"><span class="model-item-name">${escapeHTML(formatModelName(m.root || m.id))}</span><span class="model-item-provider">${providerLabel}</span></span></span><span class="model-badges">${badgesHtml}${ctxHtml}</span>
            </div>`;
            count++;
        }
        html += '</div>';
    }

    if (filtered.length > MAX_VISIBLE) {
        html += `<div class="model-more">+${filtered.length - MAX_VISIBLE} more — type to filter</div>`;
    }
    if (count === 0 && !input.value.trim()) {
        html = '<div class="model-empty">No models loaded — click ↻ to fetch from API</div>';
    } else if (count === 0) {
        html = '<div class="model-empty">No models found</div>';
    }

    list.innerHTML = html;

    // Scroll selected into view
    const selectedEl = list.querySelector('.model-item.selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });

    list.querySelectorAll('.model-item').forEach(el => {
        el.addEventListener('click', async () => {
            input.value = el.dataset.modelId;
            await autoSave({ model: el.dataset.modelId });
            renderModelList();
        });
    });
}

const consensusModelSaveTimers = {};

function getConsensusProviderDevKey(providerType) {
    const provKeyLookup = {
        openai: 'openai', anthropic: 'anthropic', google: 'google',
        deepseek: 'deepseek', groq: 'groq', openrouter: 'openrouter',
        cerebras: 'cerebras', together: 'together-ai', fireworks: 'fireworks-ai', mistral: 'mistral'
    };
    return provKeyLookup[providerType] || providerType || '';
}

function renderConsensusModelList(runIdx) {
    const container = uiElements.consensusRunsContainer;
    if (!container) return;

    const card = container.querySelector(`.consensus-run-card[data-run-index="${runIdx}"]`);
    if (!card) return;

    const run = settings.consensus?.runs?.[runIdx];
    if (!run) return;

    const list = card.querySelector('.consensus-run-model-list');
    const input = card.querySelector('.consensus-run-model-input');
    if (!list || !input) return;

    const currentValue = run.model || '';
    const query = input.value.toLowerCase().trim();

    const effectiveProviderId = run.providerId || settings.activeProviderId || '';
    const provider = (settings.providers || []).find(p => p.id === effectiveProviderId);
    const devProvId = getConsensusProviderDevKey(provider?.type || '');

    // Use cached API models first, fallback to modelsDevCache
    const cachedModels = providerModelsCache[run.providerId];
    let providerModels = cachedModels ? [...cachedModels] : [];

    if (!providerModels.length && devProvId && modelsDevCache) {
        for (const [key, info] of Object.entries(modelsDevCache)) {
            if (key.includes('/')) continue;
            if (info.p === devProvId) {
                providerModels.push({
                    id: key,
                    ownedBy: info.p || 'other',
                    root: key,
                    contextLength: info.l?.c || null
                });
            }
        }
    }

    const hasModels = providerModels.length > 0;
    let filtered = providerModels;
    if (query) {
        filtered = providerModels.filter(m =>
            m.id.toLowerCase().includes(query) ||
            formatModelName(m.id).toLowerCase().includes(query) ||
            (m.ownedBy || '').toLowerCase().includes(query)
        );
    }

    const groups = {};
    for (const m of filtered) {
        const providerKey = m.ownedBy || 'other';
        if (!groups[providerKey]) groups[providerKey] = [];
        groups[providerKey].push(m);
    }

    const sortedProviders = Object.keys(groups).sort();
    const MAX_VISIBLE = 60;
    let count = 0;
    let html = '';

    if (!provider || !hasModels) {
        html = '<div class="model-empty">No models available</div>';
        list.innerHTML = html;
        return;
    }

    const exactMatch = providerModels.some(m => m.id.toLowerCase() === input.value.trim().toLowerCase());
    if (input.value.trim() && !exactMatch) {
        html += `<div class="model-item custom" data-model-id="${escapeHTML(input.value.trim())}">
            <span class="model-item-main"><span class="provider-icon-fallback">✎</span><span class="model-item-subtext"><span class="model-item-name">${escapeHTML(input.value.trim())}</span><span class="model-item-provider">${t('customModel')}</span></span></span>
        </div>`;
        count++;
    }

    for (const providerKey of sortedProviders) {
        if (count >= MAX_VISIBLE) break;
        const icon = getProviderIcon(providerKey);
        const iconHtml = icon
            ? `<img class="provider-icon" src="https://models.dev/logos/${icon}.svg" alt="" loading="lazy">`
            : `<span class="provider-icon-fallback">${(providerKey[0] || '?').toUpperCase()}</span>`;
        html += `<div class="model-provider-group">
            <div class="model-provider-header">${iconHtml}<span>${providerKey}</span>
            <span class="model-provider-count">${groups[providerKey].length}</span></div>`;

        for (const m of groups[providerKey]) {
            if (count >= MAX_VISIBLE) break;
            const ctxHtml = m.contextLength ? `<span class="model-ctx">${formatContextLength(m.contextLength)}</span>` : '';
            const familyIcon = getModelFamilyIcon(m.id);
            const modelIcon = familyIcon
                ? `<img class="model-icon" src="https://models.dev/logos/${familyIcon}.svg" alt="" loading="lazy">`
                : `<span class="provider-icon-fallback">${(formatModelName(m.root || m.id)[0] || '?').toUpperCase()}</span>`;
            const providerLabel = escapeHTML(m.ownedBy || 'other');
            const isSelected = m.id === currentValue;

            const devInfo = getModelDevInfo(m.id);
            const badges = [];
            if (devInfo) {
                if (devInfo.a) badges.push(`<span class="model-badge vision" title="${t('badgeVision')}">🖼️</span>`);
                if (devInfo.r) badges.push(`<span class="model-badge reasoning" title="${t('badgeReasoning')}">🧠</span>`);
                if (devInfo.c) {
                    const inp = devInfo.c.i, out = devInfo.c.o;
                    if (inp !== undefined && out !== undefined) {
                        const fmtCost = v => v === 0 ? '$0' : (v < 0.01 ? `$${v.toFixed(3)}` : `$${v}`);
                        const costStr = fmtCost(inp);
                        badges.push(`<span class="model-badge cost" title="${t('badgeCostInput')}: ${fmtCost(inp)}/M  ${t('badgeCostOutput')}: ${fmtCost(out)}/M">${costStr}/M</span>`);
                    }
                }
                if (devInfo.l && devInfo.l.c && !m.contextLength) {
                    badges.push(`<span class="model-ctx">${formatContextLength(devInfo.l.c)}</span>`);
                }
            } else if (m.capabilities?.vision) {
                badges.push(`<span class="model-badge vision" title="${t('badgeVision')}">🖼️</span>`);
            }
            const badgesHtml = badges.join('');
            const selectedClass = isSelected ? ' selected' : '';

            html += `<div class="model-item${selectedClass}" data-model-id="${m.id}">
                <span class="model-item-main">${modelIcon}<span class="model-item-subtext"><span class="model-item-name">${escapeHTML(formatModelName(m.root || m.id))}</span><span class="model-item-provider">${providerLabel}</span></span></span><span class="model-badges">${badgesHtml}${ctxHtml}</span>
            </div>`;
            count++;
        }
        html += '</div>';
    }

    if (filtered.length > MAX_VISIBLE) {
        html += `<div class="model-more">+${filtered.length - MAX_VISIBLE} more — type to filter</div>`;
    }
    if (count === 0 && !input.value.trim()) {
        html = '<div class="model-empty">No models available</div>';
    } else if (count === 0) {
        html = '<div class="model-empty">No models found</div>';
    }

    list.innerHTML = html;

    const selectedEl = list.querySelector('.model-item.selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });

    list.querySelectorAll('.model-item').forEach(el => {
        el.addEventListener('click', async () => {
            input.value = el.dataset.modelId;
            settings.consensus.runs[runIdx].model = el.dataset.modelId;
            await autoSave();
            renderConsensusModelList(runIdx);
        });
    });
}

function normaliseHex(val) {
    if (!val) return null;
    const m = val.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    let hex = m[1];
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    return '#' + hex.toLowerCase();
}

function setupColorInput(input, settingKey, cssVar, picker) {
    // Text input: validate on every keystroke, apply when valid.
    input.addEventListener('input', async (e) => {
        const val = e.target.value;
        const normalised = normaliseHex(val);
        if (!normalised) return;
        document.documentElement.style.setProperty(cssVar, normalised);
        settings.customization[settingKey] = normalised;
        if (picker) picker.value = normalised;
        await saveSettingsAndNotify(settings);
    });

    if (!picker) return;

    // Initial sync: expand/normalise whatever's in the text input.
    const initial = normaliseHex(input.value);
    if (initial) picker.value = initial;

    // Picker: fires continuously while dragging (input) and on close (change).
    // Write through to the text input + settings so both reflect the new colour.
    const applyFromPicker = async () => {
        const val = picker.value;
        if (!/^#[0-9a-f]{6}$/i.test(val)) return;
        const normalised = val.toLowerCase();
        input.value = normalised;
        document.documentElement.style.setProperty(cssVar, normalised);
        settings.customization[settingKey] = normalised;
        await saveSettingsAndNotify(settings);
    };
    picker.addEventListener('input', applyFromPicker);
    picker.addEventListener('change', applyFromPicker);
}

function renderConsensusRuns() {
    const container = uiElements.consensusRunsContainer;
    if (!container) return;

    const enabled = !!(settings.consensus && settings.consensus.enabled);
    container.style.display = enabled ? 'block' : 'none';
    if (uiElements.addConsensusRunBtn) {
        uiElements.addConsensusRunBtn.style.display = enabled ? 'inline-block' : 'none';
    }
    if (!enabled) {
        container.innerHTML = '';
        return;
    }

    const nonSearchProviders = (settings.providers || []).filter(p => p.kind !== 'search');
    const runs = (settings.consensus && settings.consensus.runs) || [];

    container.innerHTML = runs.map((run, idx) => {
        const effectiveProviderId = run.providerId || '';
        const selectedProvider = (settings.providers || []).find(p => p.id === effectiveProviderId);
        const providerOptions = nonSearchProviders.map(p => 
            '<option value="' + escapeHTML(p.id) + '" ' + (p.id === effectiveProviderId ? 'selected' : '') + '>' + escapeHTML(p.name) + '</option>'
        ).join('') || '<option value="">' + escapeHTML(t('consensusNoProviders')) + '</option>';

        return '<div class="consensus-run-card" data-run-index="' + idx + '">' +
            '<div class="consensus-run-model-panel">' +
                '<div class="consensus-run-provider-row">' +
                    '<select class="consensus-run-provider-select">' + providerOptions + '</select>' +
                '</div>' +
                '<div class="consensus-run-model-search">' +
                    '<input type="text" class="consensus-run-model-input" value="' + escapeHTML(run.model || '') + '" placeholder="' + escapeHTML(t('searchModel')) + '" autocomplete="off">' +
                '</div>' +
                '<div class="consensus-run-model-list"></div>' +
            '</div>' +
            '<div class="consensus-run-bottom">' +
                '<div class="consensus-run-info">' +
                    '<span class="consensus-run-icon">' + escapeHTML(selectedProvider ? selectedProvider.name.charAt(0).toUpperCase() : '🤖') + '</span>' +
                    '<div class="consensus-run-meta">' +
                        '<span class="consensus-run-model-name">' + escapeHTML(run.model || '') + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="consensus-run-actions">' +
                    '<div class="consensus-answeronly-wrap">' +
                        '<label class="consensus-answeronly-toggle"><input type="checkbox" class="consensus-run-answeronly"' + (run.showAnswerOnly ? ' checked' : '') + '><span class="toggle-slider"></span></label>' +
                        '<span class="consensus-answeronly-label">' + escapeHTML(t('consensusAnswerOnly')) + '</span>' +
                    '</div>' +
                    '<button type="button" class="consensus-run-remove" title="' + t('consensusRemoveRun') + '">✕</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');

    // Wire events for run cards
    container.querySelectorAll('.consensus-run-card').forEach((card, idx) => {
        const modelInput = card.querySelector('.consensus-run-model-input');
        const answerOnlyCheckbox = card.querySelector('.consensus-run-answeronly');
        const removeBtn = card.querySelector('.consensus-run-remove');
        const modelNameEl = card.querySelector('.consensus-run-model-name');

        const run = settings.consensus.runs[idx];

        // Pre-fetch models for this run's provider if needed
        const effectiveProviderId = run.providerId || '';
        const provider = (settings.providers || []).find(p => p.id === effectiveProviderId);
        if (provider && !providerModelsCache[provider.id]) {
            fetchModelsForProvider(provider).then(models => {
                providerModelsCache[provider.id] = models;
                renderConsensusModelList(idx);
            }).catch(() => {});
        }

        const providerSelect = card.querySelector('.consensus-run-provider-select');
        if (providerSelect) providerSelect.onchange = async () => {
            settings.consensus.runs[idx].providerId = providerSelect.value;
            const newProvider = (settings.providers || []).find(p => p.id === providerSelect.value);
            const iconSpan = card.querySelector('.consensus-run-icon');
            if (iconSpan) iconSpan.textContent = newProvider ? newProvider.name.charAt(0).toUpperCase() : '🤖';
            if (newProvider && !providerModelsCache[newProvider.id]) {
                try {
                    const models = await fetchModelsForProvider(newProvider);
                    providerModelsCache[newProvider.id] = models;
                } catch (e) {}
            }
            renderConsensusModelList(idx);
            autoSave();
        };

        if (modelInput) modelInput.oninput = () => {
            settings.consensus.runs[idx].model = modelInput.value.trim();
            if (modelNameEl) modelNameEl.textContent = modelInput.value.trim() || '';
            renderConsensusModelList(idx);
            clearTimeout(consensusModelSaveTimers[idx]);
            consensusModelSaveTimers[idx] = setTimeout(() => autoSave(), 300);
        };
        if (modelInput) modelInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                settings.consensus.runs[idx].model = modelInput.value.trim();
                if (modelNameEl) modelNameEl.textContent = modelInput.value.trim() || '';
                clearTimeout(consensusModelSaveTimers[idx]);
                autoSave();
                renderConsensusModelList(idx);
            }
        };
        if (answerOnlyCheckbox) answerOnlyCheckbox.onchange = () => {
            settings.consensus.runs[idx].showAnswerOnly = answerOnlyCheckbox.checked;
            autoSave();
        };
        if (removeBtn) removeBtn.onclick = () => {
            settings.consensus.runs.splice(idx, 1);
            renderConsensusRuns();
            autoSave();
        };

        renderConsensusModelList(idx);
    });
}

function attachEventListeners() {
    const el = uiElements;

    document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.tab-button, .tab-content').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        document.getElementById(b.dataset.tab).classList.add('active');
    }));

    el.activeProviderTrigger.onclick = () => {
        el.activeProviderDropdown.classList.toggle('hidden');
    };

    el.fetchModelsBtn.onclick = async () => {
        await autoSave();
        await fetchModels();
        // Also trigger background models.dev sync
        chrome.runtime.sendMessage({ type: 'forceModelSync' });
    };

    const autoInputs = [
        { el: el.modelName, key: 'model' },
        { el: el.autoAnswerCooldown, key: 'autoAnswerCooldown', parse: v => parseInt(v, 10) || 2000 }
    ];
    for (const { el: inp, key, parse } of autoInputs) {
        inp.addEventListener('change', () => autoSave({ [key]: parse ? parse(inp.value) : inp.value }));
    }
    el.modelName.addEventListener('input', () => {
        clearTimeout(autoSave._modelTimer);
        autoSave._modelTimer = setTimeout(() => autoSave({ model: el.modelName.value.trim() }), 300);
    });

    const autoToggles = [
        { el: el.autoAnswerToggle, key: 'autoAnswer' },
        { el: el.highlightCorrectToggle, key: 'highlightCorrect' },
        { el: el.showAnswerOnlyToggle, key: 'showAnswerOnly' },
        { el: el.glowEffectToggle, key: 'customization.glowEffect' },
        { el: el.rememberDragToggle, key: 'rememberDragPosition' },
        { el: el.webSearchToggle, key: 'webSearchEnabled' }
    ];
    for (const { el: toggle, key } of autoToggles) {
        if (!toggle) continue;
        toggle.onchange = () => {
            el.cooldownGroup.style.display = el.autoAnswerToggle.checked ? 'block' : 'none';
            autoSave({ [key]: toggle.checked });
        };
    }

    // Consensus toggle
    if (el.consensusToggle) {
        el.consensusToggle.onchange = () => {
            if (!settings.consensus) settings.consensus = { enabled: false, runs: [] };
            settings.consensus.enabled = el.consensusToggle.checked;
            renderConsensusRuns();
            autoSave();
        };
    }

    // Add consensus run
    if (el.addConsensusRunBtn) {
        el.addConsensusRunBtn.onclick = () => {
            if (!settings.consensus) settings.consensus = { enabled: false, runs: [] };
            const nonSearchProviders = (settings.providers || []).filter(p => p.kind !== 'search');
            const isActiveNonSearch = nonSearchProviders.some(p => p.id === settings.activeProviderId);
            const defaultProviderId = isActiveNonSearch ? settings.activeProviderId : (nonSearchProviders[0]?.id || '');
            settings.consensus.runs.push({
                id: generateId(),
                providerId: defaultProviderId,
                model: '',
                showAnswerOnly: false
            });
            renderConsensusRuns();
            autoSave();
        };
    }

    // Position grid: click cell → set defaultPosition, highlight active
    if (el.positionGrid) {
        el.positionGrid.addEventListener('click', (ev) => {
            const cell = ev.target.closest('.position-cell');
            if (!cell || !el.positionGrid.contains(cell)) return;
            const pos = cell.dataset.position;
            if (!pos) return;
            el.positionGrid.querySelectorAll('.position-cell').forEach(c => {
                const isActive = c === cell;
                c.classList.toggle('active', isActive);
                c.setAttribute('aria-checked', isActive ? 'true' : 'false');
            });
            // Clear saved drag coords so preset applies on next show
            autoSave({ defaultPosition: pos, savedPosition: null });
        });
    }

    // Language switch
    el.languageSelect.onchange = () => {
        settings.language = el.languageSelect.value;
        applyLanguage();
        populateThemesGrid();
        renderProvidersTab();
        renderModelList();
        renderConsensusRuns();
        autoSave();
    };

    // Silent mode: checkbox toggles on/off, select chooses mode (always visible)
    el.silentModeToggle.onchange = () => {
        const isOn = el.silentModeToggle.checked;
        // Select always visible — user can pre-choose mode before enabling
        if (isOn) {
            autoSave({ silentMode: el.silentModeSelect.value || 'indicators' });
        } else {
            autoSave({ silentMode: '' });
        }
    };

    el.silentModeSelect.onchange = () => {
        if (el.silentModeToggle.checked) {
            autoSave({ silentMode: el.silentModeSelect.value });
        }
        // When toggle is off, select change just pre-selects mode for next enable
    };

    el.modelName.oninput = () => {
        renderModelList();
    };
    el.modelName.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            autoSave({ model: el.modelName.value.trim() });
            renderModelList();
        }
    };

    document.addEventListener('click', (e) => {
        if (el.activeProviderDropdown && !document.querySelector('.provider-select-wrapper')?.contains(e.target)) {
            el.activeProviderDropdown.classList.add('hidden');
        }
    });

    // Theme editor color pairs (sync text <-> picker, no settings writes)
    const editorPairs = [
        [el.editorBorderInput, el.editorBorderPicker],
        [el.editorHeaderInput, el.editorHeaderPicker],
        [el.editorContentInput, el.editorContentPicker],
        [el.editorTextInput, el.editorTextPicker]
    ];
    for (const [input, picker] of editorPairs) {
        if (!input || !picker) continue;
        input.addEventListener('input', () => {
            const n = normaliseHex(input.value);
            if (n) picker.value = n;
            input.classList.remove('invalid');
        });
        const syncFromPicker = () => {
            input.value = picker.value;
            input.classList.remove('invalid');
        };
        picker.addEventListener('input', syncFromPicker);
        picker.addEventListener('change', syncFromPicker);
    }

    if (el.themeEditorClose) el.themeEditorClose.addEventListener('click', closeThemeEditor);
    if (el.themeEditorCancel) el.themeEditorCancel.addEventListener('click', closeThemeEditor);
    if (el.themeEditorSave) el.themeEditorSave.addEventListener('click', saveCustomTheme);

    // Close theme editor on backdrop click
    if (el.themeEditor) {
        el.themeEditor.addEventListener('click', (e) => {
            if (e.target === el.themeEditor) closeThemeEditor();
        });
    }

    // Hotkey recorder: click to enter recording mode, capture keydown, save
    if (el.hotkeyRecorder) {
        let isRecording = false;

        el.hotkeyRecorder.addEventListener('click', () => {
            if (isRecording) return;
            isRecording = true;
            el.hotkeyRecorder.classList.add('recording');
            el.hotkeyRecorderKbd.textContent = t('hotkeyRecording');
            el.hotkeyRecorder.focus();
        });

        el.hotkeyRecorder.addEventListener('keydown', (e) => {
            if (!isRecording) return;
            e.preventDefault();
            e.stopPropagation();

            // Ignore lone modifier presses
            const modKeys = ['Control', 'Alt', 'Shift', 'Meta'];
            if (modKeys.includes(e.key)) return;

            // Build combination string
            const parts = [];
            if (e.ctrlKey || e.metaKey) parts.push(e.metaKey ? 'Cmd' : 'Ctrl');
            if (e.altKey) parts.push('Alt');
            if (e.shiftKey) parts.push('Shift');

            // Map key code to readable name
            let keyName = e.key;
            if (e.code === 'Space') keyName = 'Space';
            else if (e.key.length === 1) keyName = e.key.toUpperCase();
            else keyName = e.key;

            parts.push(keyName);
            const combo = parts.join('+');

            settings.hotkey = combo;
            el.hotkeyRecorderKbd.textContent = combo;
            isRecording = false;
            el.hotkeyRecorder.classList.remove('recording');
            autoSave({ hotkey: combo });
        });

        // Cancel recording on blur or Escape
        el.hotkeyRecorder.addEventListener('blur', () => {
            if (!isRecording) return;
            isRecording = false;
            el.hotkeyRecorder.classList.remove('recording');
            el.hotkeyRecorderKbd.textContent = settings.hotkey || 'Ctrl+Shift+X';
        });

        el.hotkeyRecorder.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isRecording) {
                e.preventDefault();
                isRecording = false;
                el.hotkeyRecorder.classList.remove('recording');
                el.hotkeyRecorderKbd.textContent = settings.hotkey || 'Ctrl+Shift+X';
            }
        });
    }

    // Hotkey clear/reset button
    if (el.hotkeyClear) {
        el.hotkeyClear.addEventListener('click', () => {
            settings.hotkey = 'Ctrl+Shift+X';
            if (el.hotkeyRecorderKbd) el.hotkeyRecorderKbd.textContent = 'Ctrl+Shift+X';
            autoSave({ hotkey: 'Ctrl+Shift+X' });
        });
    }
}

async function autoSave(overrides) {
    const el = uiElements;
    settings.model = el.modelName.value;
    settings.language = el.languageSelect?.value || settings.language || 'uk';
    settings.autoAnswer = el.autoAnswerToggle.checked;
    settings.autoAnswerCooldown = parseInt(el.autoAnswerCooldown.value, 10) || 2000;
    settings.highlightCorrect = el.highlightCorrectToggle.checked;
    settings.showAnswerOnly = el.showAnswerOnlyToggle.checked;
    settings.silentMode = el.silentModeToggle.checked ? (el.silentModeSelect.value || 'indicators') : '';
    settings._silentModePreselect = el.silentModeSelect.value || 'indicators';
    settings.webSearchEnabled = el.webSearchToggle?.checked ?? settings.webSearchEnabled;
    settings.consensus.enabled = el.consensusToggle?.checked ?? !!(settings.consensus && settings.consensus.enabled);
    settings.customization.glowEffect = el.glowEffectToggle.checked;

    if (overrides) {
        for (const [k, v] of Object.entries(overrides)) {
            if (k.startsWith('customization.')) {
                settings.customization[k.split('.')[1]] = v;
            } else {
                settings[k] = v;
            }
        }
    }

    await saveSettingsAndNotify(settings);
}

document.addEventListener('DOMContentLoaded', async () => {
    // Populate version string in popup header
    const versionEl = document.querySelector('.xd-popup-version');
    if (versionEl) {
        try {
            // _buildVersion is set by version.js (debug: git hash, release: manifest version)
            let v = window.xdAnswers && window.xdAnswers._buildVersion;
            if (!v) {
                v = chrome.runtime.getManifest().version;
                v = v ? 'v' + v : '';
            }
            versionEl.textContent = v;
        } catch (e) {}
    }

    // Global fallback for broken model/provider icons
    document.addEventListener('error', (e) => {
        const img = e.target;
        if (img && (img.classList.contains('provider-icon') || img.classList.contains('model-icon'))) {
            const span = document.createElement('span');
            span.className = 'provider-icon-fallback';
            span.textContent = '?';
            img.replaceWith(span);
        }
    }, true);

    uiElements = {
        activeProviderTrigger: document.getElementById('active-provider-trigger'),
        activeProviderDropdown: document.getElementById('active-provider-dropdown'),
        modelName: document.getElementById('model-name'),
        fetchModelsBtn: document.getElementById('fetch-models-btn'),
        providersContainer: document.getElementById('providers-container'),
        autoAnswerToggle: document.getElementById('auto-answer-toggle'),
        autoAnswerCooldown: document.getElementById('auto-answer-cooldown'),
        cooldownGroup: document.getElementById('cooldown-group'),
        languageSelect: document.getElementById('language-select'),
        highlightCorrectToggle: document.getElementById('highlight-correct-toggle'),
        showAnswerOnlyToggle: document.getElementById('show-answer-only-toggle'),
        silentModeToggle: document.getElementById('silent-mode-toggle'),
        silentModeSelect: document.getElementById('silent-mode-select'),
        silentModeSelectGroup: document.getElementById('silent-mode-select-group'),
        webSearchToggle: document.getElementById('web-search-toggle'),
        consensusToggle: document.getElementById('consensus-toggle'),
        consensusRunsContainer: document.getElementById('consensus-runs-container'),
        addConsensusRunBtn: document.getElementById('add-consensus-run-btn'),
        positionGrid: document.getElementById('position-grid'),
        rememberDragToggle: document.getElementById('remember-drag-toggle'),
        themesGrid: document.getElementById('themes-grid'),
        glowEffectToggle: document.getElementById('glow-effect-toggle'),
        themeEditor: document.getElementById('theme-editor'),
        themeEditorClose: document.getElementById('theme-editor-close'),
        themeEditorCancel: document.getElementById('theme-editor-cancel'),
        themeEditorSave: document.getElementById('theme-editor-save'),
        editorName: document.getElementById('theme-editor-name'),
        editorBorderInput: document.getElementById('editor-border-input'),
        editorBorderPicker: document.getElementById('editor-border-picker'),
        editorHeaderInput: document.getElementById('editor-header-input'),
        editorHeaderPicker: document.getElementById('editor-header-picker'),
        editorContentInput: document.getElementById('editor-content-input'),
        editorContentPicker: document.getElementById('editor-content-picker'),
        editorTextInput: document.getElementById('editor-text-input'),
        editorTextPicker: document.getElementById('editor-text-picker'),
        hotkeyRecorder: document.getElementById('hotkey-recorder'),
        hotkeyRecorderKbd: document.getElementById('hotkey-recorder-kbd'),
        hotkeyClear: document.getElementById('hotkey-clear')
    };

    settings = await loadSettings();
    await loadModelsDevCache();
    populateUI();
    attachEventListeners();
    // Auto-sync models.dev cache if missing
    if (!modelsDevCache) {
        chrome.runtime.sendMessage({ type: 'forceModelSync' }, () => {
            setTimeout(async () => {
                await loadModelsDevCache();
                renderModelList();
            }, 2000);
        });
    }
    // Auto-fetch models from provider API
    if (!allModels.length) {
        fetchModels().then(() => renderModelList());
    }
    // Pre-fetch models for existing consensus run providers
    if (settings.consensus?.runs?.length) {
        const providerIds = [...new Set(settings.consensus.runs.map(r => r.providerId).filter(Boolean))];
        for (const pid of providerIds) {
            const prov = settings.providers.find(p => p.id === pid);
            if (prov && !providerModelsCache[pid]) {
                fetchModelsForProvider(prov).then(models => {
                    providerModelsCache[pid] = models;
                    renderConsensusRuns();
                }).catch(() => {});
            }
        }
    }
});
