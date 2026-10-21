(function() {
    'use strict';

    // This content script runs in the ISOLATED world.
    // We read settings here, then inject the actual disabler code
    // into the PAGE world via an inline <script> tag so it can
    // intercept addEventListener calls made by Vue and other
    // page scripts. The page script bundles the generic anti-detect
    // with every src/providers/<name>/disabler.ts module.

    function shouldApplyDisabler(callback: (enabled: boolean) => void): void {
        try {
            chrome.storage.local.get('xdAnswers_settings', (data) => {
                let enabled = false;
                if (data && data.xdAnswers_settings) {
                    try {
                        const parsed = JSON.parse(data.xdAnswers_settings as string);
                        if (typeof parsed.disablerEnabled === 'boolean') {
                            enabled = parsed.disablerEnabled;
                        }
                    } catch (e) {}
                }
                callback(enabled);
            });
        } catch (e) {
            callback(false);
        }
    }

    function injectDisablerIntoPage(): void {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('disabler.js');
        script.onload = function() {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };
        (document.head || document.documentElement).appendChild(script);
    }

    function runIfEnabled(): void {
        shouldApplyDisabler(function(enabled) {
            if (!enabled) return;
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', injectDisablerIntoPage);
            } else {
                injectDisablerIntoPage();
            }
        });
    }

    // Run as soon as possible
    runIfEnabled();
})();
