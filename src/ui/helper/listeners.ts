// src/ui/helper/listeners.ts
// Global helper listeners (fullscreen, storage settings sync) and settings kickoff on load.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    // Re-attach helper when entering/exiting fullscreen mode
    document.addEventListener('fullscreenchange', () => {
        if (window.xdAnswers.helperContainer) {
            window.xdAnswers.attachAndPositionHelper();
        }
    });

    // Listen for settings changes via storage (works across all contexts)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.xdAnswers_settings) {
            window.xdAnswers.loadSettings().then(() => {
                if (!window.xdAnswers.helperContainer) return;
                window.xdAnswers.updateHelperBaseStyles();
                // Update footer model name
                const footerModel = window.xdAnswers.helperContainer.querySelector('#lbl-model, #xd-footer-model');
                if (footerModel) footerModel.textContent = window.xdAnswers.settings.model || 'select model ↗';
                const silentMode = window.xdAnswers.settings.silentMode || '';
                if (silentMode !== '') {
                    window.xdAnswers.helperContainer.style.setProperty('display', 'none', 'important');
                    I.addSilentExitButton();
                } else {
                    window.xdAnswers.helperContainer.style.setProperty('display', 'flex', 'important');
                    if (window.xdAnswers._silentExitBtn) {
                        window.xdAnswers._silentExitBtn.remove();
                        window.xdAnswers._silentExitBtn = null;
                    }
                }
                // Sync inline silent mode controls
                const silentModeBtn = window.xdAnswers.helperContainer.querySelector('#btn-silent, #silent-mode-btn') as HTMLButtonElement | null;
                const silentModeSelect = window.xdAnswers.helperContainer.querySelector('#sel-silent, #silent-mode-inline-select') as HTMLSelectElement | null;
                const modeLabels: Record<string, string> = { '': 'Off', 'indicators': 'Indicators', 'ghost': 'Page title', 'stealth': 'Stealth', 'oneclick': 'One-click' };
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
                // In oneclick mode, user clicks to select — don't auto-select
                if (silentMode !== 'oneclick') {
                    I.autoSelectAnswer(parsed.answer);
                }
                    }
                    // Re-apply highlight only when not in silent mode
                    if (silentMode === '') {
                        I.highlightCorrectAnswer(parsed.answer);
                    } else {
                        // In silent mode: remove old highlights, apply silent mode visuals
                        document.querySelectorAll<HTMLElement>('.xd-highlight-correct').forEach(el => {
                            el.classList.remove('xd-highlight-correct');
                            el.style.removeProperty('outline');
                            el.style.removeProperty('background-color');
                            el.style.removeProperty('border-radius');
                        });
                        I.applySilentMode(parsed.answer || parsed.explanation || '', parsed);
                    }
                }
            });
        }
    });

    // Kickoff: load settings on script load
    window.xdAnswers.loadSettings();
})();
