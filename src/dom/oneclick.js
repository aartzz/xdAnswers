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
    window.xdAnswers.setupOneClickHandler = function(container, getQuestionDataFn, setCursor = true) {
        if (!container) return;
        // Don't re-register the same container
        if (_oneClickHandlers.some(h => h.container === container)) return;

        container.classList.add('xd-oneclick-ready');
        if (setCursor) container.style.cursor = 'pointer';

        const handler = async (e) => {
            // Don't re-trigger when autoSelectAnswer clicks an option inside this container
            if (window.xdAnswers._autoSelecting) return;
            // Don't trigger when user clicks an answer option — let the site handle it
            if (e.target.closest('.question-option-inner, .test-option, .question-option-inner-content')) return;
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

            // In oneclick mode: always set the flag so processQuestion doesn't block
            if (silentMode === 'oneclick') {
                window.xdAnswers._oneClickUserTriggered = true;
            }

            if (silentMode === 'oneclick' && _oneClickHandlers.length > 0) {
                // Prefer the last-registered container (current question in SPA flows).
                const entry = _oneClickHandlers[_oneClickHandlers.length - 1];
                if (!entry || !entry.container) return;
                if (window.xdAnswers._autoSelecting) return;
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

    // Parse a hotkey string like "Ctrl+Shift+X" into { ctrlKey, altKey, shiftKey, metaKey, key }
    function parseHotkey(hotkey) {
        if (!hotkey) return null;
        const parts = hotkey.split('+').map(p => p.trim());
        const result = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, key: '' };
        for (const part of parts) {
            const lower = part.toLowerCase();
            if (lower === 'ctrl' || lower === 'control') result.ctrlKey = true;
            else if (lower === 'cmd' || lower === 'meta' || lower === 'command') result.metaKey = true;
            else if (lower === 'alt') result.altKey = true;
            else if (lower === 'shift') result.shiftKey = true;
            else result.key = part;
        }
        if (!result.key) return null;
        return result;
    }

    // Check if a KeyboardEvent matches the stored hotkey
    function eventMatchesHotkey(e) {
        const settings = window.xdAnswers.settings;
        const hotkey = settings && settings.hotkey;
        if (!hotkey) return false;
        const parsed = parseHotkey(hotkey);
        if (!parsed) return false;

        // Match key (case-insensitive for single chars)
        const eKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
        const pKey = parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key;
        if (eKey !== pKey) return false;

        // Match modifiers exactly
        if (e.ctrlKey !== parsed.ctrlKey) return false;
        if (e.altKey !== parsed.altKey) return false;
        if (e.shiftKey !== parsed.shiftKey) return false;
        if (e.metaKey !== parsed.metaKey) return false;

        return true;
    }

    // Listen for custom hotkey on the page
    document.addEventListener('keydown', (e) => {
        // Don't trigger in input/textarea/contenteditable
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.target && e.target.isContentEditable) return;

        if (eventMatchesHotkey(e)) {
            e.preventDefault();
            e.stopPropagation();
            window.xdAnswers.triggerHotkey();
        }
    }, true);

    // Export to _internal for cross-file access
    window.xdAnswers._internal.clearOneClickHandlers = clearOneClickHandlers;
})();
