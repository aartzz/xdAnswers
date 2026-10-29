// src/popup/core/events.ts
// @ts-nocheck — popup UI module. Event wiring for every popup control.
import { applyLanguage, t } from './i18n';
import { applyThemeToPopup, closeThemeEditor, normaliseHex, populateThemesGrid, renderThemeSettings, saveCustomTheme } from '../themes';
import { autoSave } from './settings';
import { fetchModels, renderModelList } from '../models';
import { generateId } from './utils';
import { initM3Selects } from './ui';
import { renderConsensusRuns } from '../consensus';
import { renderProvidersTab } from '../providers';
import { settings, uiElements } from './state';


export function attachEventListeners() {
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
        { el: el.webSearchToggle, key: 'webSearchEnabled' },
        { el: el.calculatorToggle, key: 'calculatorEnabled' },
        { el: el.disablerToggle, key: 'disablerEnabled' }
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

    // Design system / Theme engine switch
    if (el.themeEngineSelect) {
        el.themeEngineSelect.onchange = () => {
            settings.themeEngine = el.themeEngineSelect.value;
            applyThemeToPopup();
            initM3Selects();
            autoSave({ themeEngine: el.themeEngineSelect.value });
        };
    }

    // Theme mode switch (dark / light)
    document.querySelectorAll('.theme-mode-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const mode = btn.dataset.mode;
            const isDarkTarget = mode === 'dark';
            if (isDarkTarget) {
                settings.customization.contentColor = '#1c1c1c';
                settings.customization.headerColor = '#333333';
                settings.customization.textColor = '#e0e0e0';
                applyThemeToPopup();
                renderThemeSettings();
                await autoSave({
                    'customization.contentColor': '#1c1c1c',
                    'customization.headerColor': '#333333',
                    'customization.textColor': '#e0e0e0'
                });
            } else {
                settings.customization.contentColor = '#f5f5f7';
                settings.customization.headerColor = '#e8e6f0';
                settings.customization.textColor = '#1a1a2e';
                applyThemeToPopup();
                renderThemeSettings();
                await autoSave({
                    'customization.contentColor': '#f5f5f7',
                    'customization.headerColor': '#e8e6f0',
                    'customization.textColor': '#1a1a2e'
                });
            }
        });
    });

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

    let modelSearchTimer = null;
    el.modelName.oninput = () => {
        if (modelSearchTimer) clearTimeout(modelSearchTimer);
        modelSearchTimer = setTimeout(() => {
            renderModelList();
        }, 120);
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
