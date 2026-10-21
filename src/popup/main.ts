// src/popup/main.ts
// @ts-nocheck — popup UI module. Popup entry point: boot, initial data loads and render.
import { allModels, modelsDevCache, providerModelsCache, setSettings, settings, uiElements } from './core/state';
import { attachEventListeners } from './core/events';
import { fetchModels, fetchModelsForProvider, loadModelsDevCache, renderModelList } from './models';
import { initAospSettingsNavigation } from './core/navigation';
import { loadSettings } from './core/settings';
import { populateUI } from './core/ui';
import { renderConsensusRuns } from './consensus';

import '../../version.js';
import '../core/constants';
import '../core/settings-defaults';
import '../ui/i18n';

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

    Object.assign(uiElements, {
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
        calculatorToggle: document.getElementById('calculator-toggle'),
        consensusToggle: document.getElementById('consensus-toggle'),
        consensusRunsContainer: document.getElementById('consensus-runs-container'),
        addConsensusRunBtn: document.getElementById('add-consensus-run-btn'),
        positionGrid: document.getElementById('position-grid'),
        rememberDragToggle: document.getElementById('remember-drag-toggle'),
        themesGrid: document.getElementById('themes-grid'),
        themeEngineSelect: document.getElementById('theme-engine-select'),
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
        hotkeyClear: document.getElementById('hotkey-clear'),
        disablerToggle: document.getElementById('disabler-toggle')
    });

    setSettings(await loadSettings());
    await loadModelsDevCache();
    populateUI();
    attachEventListeners();
    initAospSettingsNavigation();
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
