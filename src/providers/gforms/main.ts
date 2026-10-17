// src/providers/gforms/main.ts
// Google Forms provider entry: per-question Solve buttons, one-click mode, observers.
import type { GformsDomApi } from './dom';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initGForms();
        }
    }, 50);

    function initGForms() {
        const domApi = window.xdAnswers._internal.providerModules?.gforms?.dom as GformsDomApi;
        if (!domApi) {
            console.warn('[xdAnswers] gforms: dom module missing');
            return;
        }

        window.xdAnswers.onRefresh = () => console.log("Refreshed");
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === "gform_url_changed") setTimeout(scanAndInjectButtons, 1500);
            return true; // keep channel open for async responses
        });

        function scanAndInjectButtons() {
            let questionContainers: Element[] = Array.from(document.querySelectorAll('.geS5n'));
            if (questionContainers.length === 0) {
                questionContainers = Array.from(document.querySelectorAll('div[role="listitem"]'))
                    .filter(el => el.querySelector('[role="radio"], [role="checkbox"], [role="heading"]'));
            }
            const isOneClick = window.xdAnswers.settings.silentMode === 'oneclick';

            questionContainers.forEach((container) => {
                // Mark option text elements so findOptionElements can find them
                const optionLabels = container.querySelectorAll('[role="radio"], [role="checkbox"], [role="option"]');
                optionLabels.forEach(el => {
                    if (domApi.isHiddenOrDisabled(el)) return;
                    // Put data-xd-option on the .snByac span (which has the actual text),
                    // not the role=radio div (which has empty innerText). Grid cells
                    // have no .snByac and get the attribute themselves.
                    const textSpan = el.querySelector('.snByac') || el.closest('label')?.querySelector('.snByac');
                    if (textSpan) {
                        textSpan.setAttribute('data-xd-option', 'true');
                    } else {
                        el.setAttribute('data-xd-option', 'true');
                    }
                });

                if (isOneClick) {
                    // One-click mode: click on question triggers AI → auto-select
                    if (container.classList.contains('xd-oneclick-ready')) return;
                    window.xdAnswers.setupOneClickHandler(container as HTMLElement, () => domApi.buildQuestionData(container));
                } else {
                    // Normal mode: add Solve button
                    if (container.querySelector('.xd-solve-btn')) return;
                    const button = document.createElement('button');
                    button.className = 'xd-btn xd-solve-btn';
                    button.innerText = '✨ Solve';
                    button.style.cssText = `background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.5);color:#6366f1;padding:6px 14px;border-radius:6px;cursor:pointer;margin-top:10px;font-family:system-ui,-apple-system,sans-serif;font-weight:600;font-size:13px;z-index:9999;position:relative;transition:all 0.15s;`;
                    button.onclick = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        window.xdAnswers._answerContainer = container as HTMLElement;
                        domApi.buildQuestionData(container).then(data => {
                            window.xdAnswers.processQuestion(data);
                        });
                    };
                    container.appendChild(button);
                }
            });
        }

        const observer = new MutationObserver(() => {
            scanAndInjectButtons();
            if (window.xdAnswers.helperContainer && !document.body.contains(window.xdAnswers.helperContainer)) {
                document.body.appendChild(window.xdAnswers.helperContainer);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        scanAndInjectButtons();
    }
})();
