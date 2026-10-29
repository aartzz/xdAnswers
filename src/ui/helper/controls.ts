// src/ui/helper/controls.ts
// Helper window button and select wiring: silent mode toggle, copy, refresh and drag.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    window.xdAnswers.attachHelperEventListeners = function(): void {
        const container = window.xdAnswers.helperContainer;
        if (!container) return;
        const silentModeBtn = (container.querySelector('#btn-silent') || container.querySelector('#silent-mode-btn')) as HTMLButtonElement;
        const silentModeSelect = (container.querySelector('#sel-silent') || container.querySelector('#silent-mode-inline-select')) as HTMLSelectElement;
        const copyBtn = (container.querySelector('#btn-copy') || container.querySelector('#copy-answer-btn')) as HTMLButtonElement;
        const refreshBtn = (container.querySelector('#btn-refresh') || container.querySelector('#refresh-answer-btn')) as HTMLButtonElement;
        if (!refreshBtn) return;

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
        const modeLabels: Record<string, string> = { '': 'Off', 'indicators': 'Indicators', 'ghost': 'Page title', 'stealth': 'Stealth', 'oneclick': 'One-click' };
        silentModeBtn.title = 'Silent mode: ' + (modeLabels[currentSilentMode] || 'Off');

        window.xdAnswers.Draggable.init(container, window.xdAnswers.dragHeader!, () => {
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
                I.clearOneClickHandlers();
                if (window.xdAnswers._originalTitle) document.title = window.xdAnswers._originalTitle;
                // Remove mini exit button
                if (window.xdAnswers._silentExitBtn) {
                    window.xdAnswers._silentExitBtn.remove();
                    window.xdAnswers._silentExitBtn = null;
                }
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
                document.querySelectorAll<HTMLElement>('.xd-highlight-correct').forEach(el => {
                    el.classList.remove('xd-highlight-correct');
                    el.style.removeProperty('outline');
                    el.style.removeProperty('background-color');
                    el.style.removeProperty('border-radius');
                });
                // Add mini exit button
                I.addSilentExitButton();
                // Apply silent mode visuals immediately
                if (window.xdAnswers.lastParsedResponse) {
                    I.applySilentMode(window.xdAnswers.lastParsedResponse.answer || '', window.xdAnswers.lastParsedResponse);
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
                document.querySelectorAll<HTMLElement>('.xd-highlight-correct').forEach(el => {
                    el.classList.remove('xd-highlight-correct');
                    el.style.removeProperty('outline');
                    el.style.removeProperty('background-color');
                    el.style.removeProperty('border-radius');
                });
                I.addSilentExitButton();
                if (window.xdAnswers.lastParsedResponse) {
                    I.applySilentMode(window.xdAnswers.lastParsedResponse.answer || '', window.xdAnswers.lastParsedResponse);
                }
            } else {
                silentModeBtn.classList.remove('active');
                container.style.setProperty('display', 'flex', 'important');
                document.querySelectorAll('.xd-indicator-dot').forEach(el => el.remove());
                I.clearOneClickHandlers();
                if (window.xdAnswers._originalTitle) document.title = window.xdAnswers._originalTitle;
                if (window.xdAnswers._silentExitBtn) {
                    window.xdAnswers._silentExitBtn.remove();
                    window.xdAnswers._silentExitBtn = null;
                }
            }
            chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(window.xdAnswers.settings) });
        };

        copyBtn.onclick = async () => {
            const div = window.xdAnswers.answerContentDiv;
            if (!div) return;
            const text = div.innerText;
            if (text && text !== 'Waiting for question...' && !div.querySelector('.xd-loader')) {
                try { await navigator.clipboard.writeText(text); copyBtn.innerHTML = '<span class="xd-icon" style="color:#4ade80;">check</span>'; }
                catch { copyBtn.innerHTML = '<span class="xd-icon" style="color:#f87171;">close</span>'; }
                setTimeout(() => { copyBtn.innerHTML = '<span class="xd-icon">content_copy</span>'; }, 1500);
            }
        };

        refreshBtn.onclick = () => {
            if (window.xdAnswers.onRefresh) {
                if (window.xdAnswers.isProcessingAI) {
                    if (window.xdAnswers._cancelStream) {
                        try { window.xdAnswers._cancelStream(); } catch (e) {}
                    }
                    if (window.xdAnswers._statusInterval) {
                        clearInterval(window.xdAnswers._statusInterval);
                        window.xdAnswers._statusInterval = null;
                    }
                    window.xdAnswers.isProcessingAI = false;
                }
                if (window.xdAnswers.answerContentDiv) {
                    window.xdAnswers.answerContentDiv.innerHTML = '<div class="xd-loader"></div>';
                }
                window.xdAnswers.onRefresh();
            }
            else alert('No active question to refresh.');
        };
    };
})();
