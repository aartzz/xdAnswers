// src/ui/helper.js
// Helper window creation, event wiring, positioning, listeners, kickoff.
// Extracted from legacy utils.js (lines 2154-2454).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    window.xdAnswers.createUI = function() {
        if (window.xdAnswers.helperContainer) return;

        const container = document.createElement('div');
        container.className = 'ollama-helper-container';
        container.innerHTML =
            '<div class="ollama-helper-header" id="ollama-helper-drag-header">' +
            '<span class="ollama-header-title">xdAnswers <small class="xd-version"></small></span>' +
            '<div class="ollama-header-buttons">' +
            '<button id="silent-mode-btn" title="Silent mode: Off">✕</button>' +
            '<select id="silent-mode-inline-select" title="Silent mode">' +
            '<option value="">Off</option>' +
            '<option value="indicators">Indicators</option>' +
            '<option value="ghost">Page title</option>' +
            '<option value="stealth">Stealth</option>' +
            '<option value="oneclick">One-click</option>' +
            '</select>' +
            '<button id="refresh-answer-btn" title="Refresh">⟳</button>' +
            '</div></div>' +
            '<div class="ollama-helper-content" id="ollama-answer-content">Waiting for question...</div>' +
            '<div class="ollama-helper-footer" id="ollama-helper-footer">' +
            '<span class="xd-footer-elapsed" id="xd-footer-elapsed"></span>' +
            '<span class="xd-footer-model" id="xd-footer-model"></span>' +
            '<button class="xd-footer-copy" id="copy-answer-btn" title="Copy answer">🗎</button>' +
            '</div>';

        window.xdAnswers.helperContainer = container;
        window.xdAnswers.answerContentDiv = container.querySelector('#ollama-answer-content');
        window.xdAnswers.dragHeader = container.querySelector('#ollama-helper-drag-header');
        // Set display:flex inline (removed from CSS to allow silent mode display:none to work)
        container.style.setProperty('display', 'flex', 'important');

        window.xdAnswers.attachHelperEventListeners();
        window.xdAnswers.updateHelperBaseStyles();
        // Set current model name in footer
        const footerModelEl = container.querySelector('#xd-footer-model');
        if (footerModelEl) footerModelEl.textContent = window.xdAnswers.settings.model || 'select model ↗';
        // Set version string in header
        const versionEl = container.querySelector('.xd-version');
        if (versionEl) versionEl.textContent = window.xdAnswers._internal.getVersionString();
    };

    window.xdAnswers.attachHelperEventListeners = function() {
        const I = window.xdAnswers._internal;
        const container = window.xdAnswers.helperContainer;
        if (!container) return;
        const silentModeBtn = container.querySelector('#silent-mode-btn');
        const silentModeSelect = container.querySelector('#silent-mode-inline-select');
        const copyBtn = container.querySelector('#copy-answer-btn');
        const refreshBtn = container.querySelector('#refresh-answer-btn');
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
        const modeLabels = { '': 'Off', 'indicators': 'Indicators', 'ghost': 'Page title', 'stealth': 'Stealth', 'oneclick': 'One-click' };
        silentModeBtn.title = 'Silent mode: ' + (modeLabels[currentSilentMode] || 'Off');

        window.xdAnswers.Draggable.init(container, window.xdAnswers.dragHeader, () => {
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
                const miniBtn = document.getElementById('xd-silent-exit-btn');
                if (miniBtn) miniBtn.remove();
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
                document.querySelectorAll('.xd-highlight-correct').forEach(el => {
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
                document.querySelectorAll('.xd-highlight-correct').forEach(el => {
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
                const miniBtn = document.getElementById('xd-silent-exit-btn');
                if (miniBtn) miniBtn.remove();
            }
            chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(window.xdAnswers.settings) });
        };

        copyBtn.onclick = async () => {
            const div = window.xdAnswers.answerContentDiv;
            if (!div) return;
            const text = div.innerText;
            if (text && text !== 'Waiting for question...' && !div.querySelector('.xd-loader')) {
                try { await navigator.clipboard.writeText(text); copyBtn.textContent = '✓'; }
                catch { copyBtn.textContent = '✗'; }
                setTimeout(() => { copyBtn.textContent = '🗎'; }, 1500);
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

    window.xdAnswers.attachAndPositionHelper = function(targetContainerOverride) {
        const I = window.xdAnswers._internal;
        if (window.xdAnswers.isExtensionModifyingDOM) return;
        window.xdAnswers.isExtensionModifyingDOM = true;

        window.xdAnswers.createUI();
        const container = window.xdAnswers.helperContainer;

        if (window.xdAnswers.settings.silentMode && window.xdAnswers.settings.silentMode !== '') {
            container.style.setProperty('display', 'none', 'important');
            I.addSilentExitButton();
            window.xdAnswers.isExtensionModifyingDOM = false;
            return;
        }
        container.style.setProperty('display', 'flex', 'important');

        let targetParent = targetContainerOverride || document.body;

        if (!targetContainerOverride && location.hostname.includes('vseosvita.ua') &&
            (location.pathname.includes('/test/go-olp') || location.pathname.startsWith('/test/start/'))) {
            targetParent = document.body;
        }

        // When an element is in fullscreen mode, append helper to it
        // so it renders on top of the fullscreen layer instead of behind it
        if (!targetContainerOverride && document.fullscreenElement) {
            targetParent = document.fullscreenElement;
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
            if (isMax) {
                Object.assign(container.style, { top: I.maximizedHelperState.top, left: I.maximizedHelperState.left, bottom: 'auto', right: 'auto', transform: '' });
            } else {
                const s = window.xdAnswers.settings || {};
                // Prefer saved drag coords only when user enabled remember-drag
                if (s.rememberDragPosition && s.savedPosition && typeof s.savedPosition.top === 'string' && typeof s.savedPosition.left === 'string') {
                    Object.assign(container.style, { top: s.savedPosition.top, left: s.savedPosition.left, bottom: 'auto', right: 'auto', transform: '' });
                } else {
                    const pos = I.resolvePositionPreset(s.defaultPosition || 'bottom-right');
                    const tx = pos.translate === 'x' ? 'translateX(-50%)' :
                               pos.translate === 'y' ? 'translateY(-50%)' :
                               pos.translate === 'xy' ? 'translate(-50%, -50%)' : '';
                    Object.assign(container.style, {
                        top: pos.top || 'auto',
                        left: pos.left || 'auto',
                        right: pos.right || 'auto',
                        bottom: pos.bottom || 'auto',
                        transform: tx
                    });
                }
            }
        }

        window.xdAnswers.isExtensionModifyingDOM = false;
    };

    // ── Listeners ──

    // Re-attach helper when entering/exiting fullscreen mode
    document.addEventListener('fullscreenchange', () => {
        if (window.xdAnswers.helperContainer) {
            window.xdAnswers.attachAndPositionHelper();
        }
    });

    // Listen for settings changes via storage (works across all contexts)
    chrome.storage.onChanged.addListener((changes, area) => {
        const I = window.xdAnswers._internal;
        if (area === 'local' && changes.xdAnswers_settings) {
            window.xdAnswers.loadSettings().then(() => {
                if (!window.xdAnswers.helperContainer) return;
                window.xdAnswers.updateHelperBaseStyles();
                // Update footer model name
                const footerModel = document.getElementById('xd-footer-model');
                if (footerModel) footerModel.textContent = window.xdAnswers.settings.model || 'select model ↗';
                const silentMode = window.xdAnswers.settings.silentMode || '';
                if (silentMode !== '') {
                    window.xdAnswers.helperContainer.style.setProperty('display', 'none', 'important');
                    I.addSilentExitButton();
                } else {
                    window.xdAnswers.helperContainer.style.setProperty('display', 'flex', 'important');
                    const miniBtn = document.getElementById('xd-silent-exit-btn');
                    if (miniBtn) miniBtn.remove();
                }
                // Sync inline silent mode controls
                const silentModeBtn = window.xdAnswers.helperContainer.querySelector('#silent-mode-btn');
                const silentModeSelect = window.xdAnswers.helperContainer.querySelector('#silent-mode-inline-select');
                const modeLabels = { '': 'Off', 'indicators': 'Indicators', 'ghost': 'Page title', 'stealth': 'Stealth', 'oneclick': 'One-click' };
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
                        document.querySelectorAll('.xd-highlight-correct').forEach(el => {
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
