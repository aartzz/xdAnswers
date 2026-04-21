// src/dom/silent.js
// Silent mode (ghost/indicators/stealth). Extracted from legacy utils.js (lines 1642-1732).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    function toggleThinkingContent(headerEl) {
        const c = headerEl.nextElementSibling;
        if (!c) return;
        const toggle = headerEl.querySelector('.xd-thinking-toggle');
        const isHidden = c.style.display === 'none' || getComputedStyle(c).display === 'none';
        c.style.setProperty('display', isHidden ? 'block' : 'none', 'important');
        if (toggle) toggle.textContent = isHidden ? '▲' : '▼';
    }

    // Mini exit-silent-mode button (barely visible, bottom-right corner)
    function addSilentExitButton() {
        if (document.getElementById('xd-silent-exit-btn')) return;
        const btn = document.createElement('div');
        btn.id = 'xd-silent-exit-btn';
        btn.style.cssText = 'position:fixed;bottom:4px;right:4px;width:6px;height:6px;background:rgba(100,100,100,0.25);border-radius:50%;z-index:2147483647;cursor:pointer;transition:all 0.2s;';
        btn.title = 'xdAnswers: exit silent mode';
        btn.addEventListener('mouseenter', () => {
            btn.style.width = '10px';
            btn.style.height = '10px';
            btn.style.background = 'rgba(100,100,100,0.6)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.width = '6px';
            btn.style.height = '6px';
            btn.style.background = 'rgba(100,100,100,0.25)';
        });
        btn.addEventListener('click', () => {
            window.xdAnswers.settings.silentMode = '';
            document.querySelectorAll('.xd-indicator-dot').forEach(el => el.remove());
            window.xdAnswers._internal.clearOneClickHandlers();
            if (window.xdAnswers._originalTitle) document.title = window.xdAnswers._originalTitle;
            btn.remove();
            // Save (storage.onChanged will sync UI)
            chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(window.xdAnswers.settings) });
            // Show helper
            if (window.xdAnswers.helperContainer) {
                window.xdAnswers.helperContainer.style.setProperty('display', 'flex', 'important');
                const silentModeBtn = window.xdAnswers.helperContainer.querySelector('#silent-mode-btn');
                const silentModeSelect = window.xdAnswers.helperContainer.querySelector('#silent-mode-inline-select');
                if (silentModeBtn) { silentModeBtn.classList.remove('active'); silentModeBtn.title = 'Silent mode: Off'; }
                if (silentModeSelect) { silentModeSelect.value = ''; silentModeSelect.style.display = 'none'; }
            }
        });
        document.body.appendChild(btn);
    }

    function applySilentMode(answerText, parsed) {
        const I = window.xdAnswers._internal;
        const mode = window.xdAnswers.settings.silentMode;
        if (!mode) return;

        // Clear previous silent mode artifacts (but keep oneclick handlers — they persist across questions)
        document.querySelectorAll('.xd-indicator-dot').forEach(el => el.remove());
        if (mode !== 'oneclick') I.clearOneClickHandlers();

        // Ghost (Page title): only change page title, no dots or visual indicators
        if (mode === 'ghost') {
            if (!window.xdAnswers._originalTitle) window.xdAnswers._originalTitle = document.title;
            document.title = '[' + answerText.substring(0, 60) + '] ' + window.xdAnswers._originalTitle;
        }

        // Indicators: overlay dot next to correct answer (no text displacement)
        if (mode === 'indicators') {
            const allOptEls = I.findOptionElements();
            const scopedContainer = window.xdAnswers._oneClickContainer || window.xdAnswers._answerContainer;
            const optionElements = scopedContainer
                ? allOptEls.filter(el => scopedContainer.contains(el))
                : allOptEls;
            const matched = I.matchAnswerToOptions(answerText, optionElements);
            for (const el of matched) {
                const wrapper = el.closest('.question-option, .answer-item, .v-test-questions-select-block, .v-test-questions-radio-block, .v-test-questions-checkbox-block, label, [role="radio"], [role="checkbox"], [data-automation-id="choiceItem"]') || el;
                wrapper.style.position = 'relative';
                const indicator = document.createElement('span');
                indicator.className = 'xd-indicator-dot';
                indicator.style.cssText = 'position:absolute;top:50%;right:8px;transform:translateY(-50%);width:6px;height:6px;background:#22c55e;border-radius:50%;box-shadow:0 0 4px rgba(34,197,94,0.4);pointer-events:none;z-index:1;';
                indicator.title = answerText;
                wrapper.appendChild(indicator);
            }
        }

        // Stealth: copy answer to clipboard, no visual indicators
        if (mode === 'stealth') {
            if (answerText) {
                try {
                    navigator.clipboard.writeText(answerText);
                } catch {}
            }
        }

        // One-click mode is handled differently — click triggers AI processing,
        // then autoSelectAnswer fires. No deferred selection needed here.
    }

    // Export to _internal for cross-file access
    window.xdAnswers._internal.toggleThinkingContent = toggleThinkingContent;
    window.xdAnswers._internal.addSilentExitButton = addSilentExitButton;
    window.xdAnswers._internal.applySilentMode = applySilentMode;
})();
