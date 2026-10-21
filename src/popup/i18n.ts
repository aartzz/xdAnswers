// src/popup/i18n.ts
// @ts-nocheck — popup UI module. Popup translations lookup and applyLanguage() DOM pass.
import { settings } from './state';

export function t(key) {
    const I = window.xdAnswers._internal;
    const tr = I.TRANSLATIONS || {};
    return (tr[settings.language || 'uk'] || tr.uk || {})[key] || key;
}

export function applyLanguage() {
    const lang = settings.language || 'uk';
    document.documentElement.lang = lang === 'uk' ? 'uk' : (lang === 'ru' ? 'ru' : 'en');

    // Tab buttons
    const tabs = document.querySelectorAll('.tab-button');
    const tabKeys = ['tabAI', 'tabProviders', 'tabFeatures', null]; // last = ♥ (no translation)
    tabs.forEach((btn, i) => {
        const text = tabKeys[i] ? t(tabKeys[i]) : '♥';
        btn.setAttribute('title', text);
        btn.setAttribute('aria-label', text);
        let labelSpan = btn.querySelector('.tab-label');
        if (!labelSpan) {
            btn.textContent = '';
            labelSpan = document.createElement('span');
            labelSpan.className = 'tab-label';
            btn.appendChild(labelSpan);
        }
        labelSpan.textContent = text;
    });

    // AOSP Search & Categories translations
    const searchInp = document.getElementById('settings-search-input');
    if (searchInp) searchInp.placeholder = t('settingsSearchPlaceholder');
    const catTitles = {
        'cat-title-general': 'sectionGeneral',
        'cat-desc-general': 'sectionGeneralDesc',
        'cat-title-automation': 'sectionAutomation',
        'cat-desc-automation': 'sectionAutomationDesc',
        'cat-title-ai-tools': 'sectionAiTools',
        'cat-desc-ai-tools': 'sectionAiToolsDesc',
        'cat-title-stealth': 'sectionStealth',
        'cat-desc-stealth': 'sectionStealthDesc',
        'cat-title-appearance': 'sectionAppearance',
        'cat-desc-appearance': 'sectionAppearanceDesc'
    };
    for (const [id, key] of Object.entries(catTitles)) {
        const el = document.getElementById(id);
        if (el) el.textContent = t(key);
    }

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
    const calcSpan = document.querySelector('#calculator-toggle + span');
    if (calcSpan) calcSpan.textContent = t('calculatorLabel');
    const calcHintEl = document.getElementById('calculator-hint');
    if (calcHintEl) calcHintEl.textContent = t('calculatorHint');
    const disablerSpan = document.querySelector('#disabler-toggle + span');
    if (disablerSpan) disablerSpan.textContent = t('disablerLabel');
    const disablerHintEl = document.getElementById('disabler-hint');
    if (disablerHintEl) disablerHintEl.textContent = t('disablerHint');
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
    const themeEngineLabel = document.getElementById('theme-engine-label');
    if (themeEngineLabel) themeEngineLabel.textContent = t('themeEngineLabel');
    const themeEngineHint = document.getElementById('theme-engine-hint');
    if (themeEngineHint) themeEngineHint.textContent = t('themeEngineHint');
    const themeEngineSelect = document.getElementById('theme-engine-select');
    if (themeEngineSelect) {
        const optM3 = themeEngineSelect.querySelector('option[value="material3"]');
        if (optM3) optM3.textContent = t('themeEngineM3');
        const optLegacy = themeEngineSelect.querySelector('option[value="legacy"]');
        if (optLegacy) optLegacy.textContent = t('themeEngineLegacy');
    }
    const themeModeLabel = document.getElementById('theme-mode-label');
    if (themeModeLabel) themeModeLabel.textContent = t('themeModeLabel');
    const themeModeDarkText = document.getElementById('theme-mode-dark-text');
    if (themeModeDarkText) themeModeDarkText.textContent = t('themeModeDark');
    const themeModeLightText = document.getElementById('theme-mode-light-text');
    if (themeModeLightText) themeModeLightText.textContent = t('themeModeLight');
    const themeModeHint = document.getElementById('theme-mode-hint');
    if (themeModeHint) themeModeHint.textContent = t('themeModeHint');

    const themePaletteLabel = document.getElementById('theme-palette-label');
    if (themePaletteLabel) themePaletteLabel.textContent = t('themePaletteLabel');
    const themePaletteHint = document.getElementById('theme-palette-hint');
    if (themePaletteHint) themePaletteHint.textContent = t('themePaletteHint');

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
