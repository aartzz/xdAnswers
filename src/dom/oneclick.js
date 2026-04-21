// src/dom/oneclick.js
// One-click silent mode handlers. Extracted from legacy utils.js (lines 1737-1838).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    const _oneClickHandlers = [];
    window.xdAnswers._oneClickUserTriggered = false;
    window.xdAnswers._oneClickContainer = null;

    function clearOneClickHandlers() {
        for (const { container, handler } of _oneClickHandlers) {
            container.removeEventListener('click', handler, true);
            container.classList.remove('xd-oneclick-ready');
            container.style.removeProperty('cursor');
        }
        _oneClickHandlers.length = 0;
    }

    // Expose for providers to call when question changes
    window.xdAnswers.clearOneClickHandlers = clearOneClickHandlers;

    // Register a question container for one-click mode.
    // getQuestionDataFn: async () => questionData (called on click)
    window.xdAnswers.setupOneClickHandler = function(container, getQuestionDataFn) {
        if (!container) return;
        // Don't re-register the same container
        if (_oneClickHandlers.some(h => h.container === container)) return;

        container.classList.add('xd-oneclick-ready');
        container.style.cursor = 'pointer';

        const handler = async (e) => {
            // Don't re-trigger when autoSelectAnswer clicks an option inside this container
            if (window.xdAnswers._autoSelecting) return;
            // Set flag so processQuestion guard passes
            window.xdAnswers._oneClickUserTriggered = true;
            // Scope autoSelectAnswer to this container only
            window.xdAnswers._oneClickContainer = container;

            try {
                const questionData = await getQuestionDataFn();
                if (questionData) {
                    window.xdAnswers.processQuestion(questionData);
                } else {
                    window.xdAnswers._oneClickUserTriggered = false;
                }
            } catch (err) {
                console.error('xdAnswers oneclick error:', err);
                window.xdAnswers._oneClickUserTriggered = false;
            }
        };

        container.addEventListener('click', handler, true);
        // Store getQuestionDataFn so the hotkey can bypass the click in oneclick silent mode.
        _oneClickHandlers.push({ container, handler, getQuestionDataFn });
    };

    // Trigger the answer flow from anywhere (e.g. global Ctrl+Shift+X hotkey).
    // - In oneclick silent mode: bypass the click — reuse the most recently registered
    //   oneclick container, call its getQuestionDataFn, and run processQuestion directly.
    // - In every other mode: fall back to the provider-supplied onRefresh hook
    //   (same code path as the helper's refresh button).
    window.xdAnswers.triggerHotkey = async function() {
        try {
            const silentMode = (window.xdAnswers.settings && window.xdAnswers.settings.silentMode) || '';
            if (silentMode === 'oneclick' && _oneClickHandlers.length > 0) {
                // Prefer the last-registered container (current question in SPA flows).
                const entry = _oneClickHandlers[_oneClickHandlers.length - 1];
                if (!entry || !entry.container) return;
                if (window.xdAnswers._autoSelecting) return;
                window.xdAnswers._oneClickUserTriggered = true;
                window.xdAnswers._oneClickContainer = entry.container;
                try {
                    const questionData = entry.getQuestionDataFn
                        ? await entry.getQuestionDataFn()
                        : null;
                    if (questionData) {
                        window.xdAnswers.processQuestion(questionData);
                    } else {
                        // No data available — fall back to a synthetic click so the
                        // provider's own click handler can re-detect.
                        window.xdAnswers._oneClickUserTriggered = false;
                        try { entry.container.click(); } catch (e) {}
                    }
                } catch (err) {
                    console.warn('xdAnswers hotkey oneclick failed:', err);
                    window.xdAnswers._oneClickUserTriggered = false;
                }
                return;
            }
            // Default: re-run the provider's refresh flow.
            if (typeof window.xdAnswers.onRefresh === 'function') {
                window.xdAnswers.onRefresh();
            }
        } catch (err) {
            console.warn('xdAnswers.triggerHotkey error:', err);
        }
    };

    // Listen for the hotkey dispatched by background.js (chrome.commands.onCommand).
    if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message && message.type === 'xd_hotkey' && message.command === 'xd-trigger-answer') {
                window.xdAnswers.triggerHotkey();
            }
        });
    }

    // Export to _internal for cross-file access
    window.xdAnswers._internal.clearOneClickHandlers = clearOneClickHandlers;
})();
