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
            if (message.type === "gform_url_changed") {
                batchSignature = '';
                window.xdAnswers.cancelBatchPrefetch();
                setTimeout(() => {
                    scanAndInjectButtons();
                    scheduleBatch(600);
                }, 1500);
            }
            if (message.type === "settingsUpdated") {
                batchSignature = '';
                window.xdAnswers.cancelBatchPrefetch();
                window.xdAnswers.loadSettings()
                    .then(() => scheduleBatch(400))
                    .catch(() => scheduleBatch(400));
            }
            return true; // keep channel open for async responses
        });

        let batchSignature = '';
        let batchTimer: ReturnType<typeof setTimeout> | null = null;
        let batchRunning = false;
        let batchPending = false;

        function getQuestionContainers(): Element[] {
            let containers: Element[] = Array.from(document.querySelectorAll('.geS5n'));
            if (containers.length === 0) {
                containers = Array.from(document.querySelectorAll('div[role="listitem"]'))
                    .filter(el => el.querySelector('[role="radio"], [role="checkbox"], [role="heading"]'));
            }
            return containers;
        }

        async function collectBatchQuestions(): Promise<XdQuestionData[]> {
            const includeImages = window.xdAnswers.settings.batchIncludeImages === true;
            const containers = getQuestionContainers();
            const questions = await Promise.all(containers.map(container =>
                domApi.buildQuestionData(container, { skipImages: !includeImages })
            ));
            return questions.filter(question =>
                question && (question.text || question.optionsText || (question.base64Images && question.base64Images.length))
            );
        }

        function scheduleBatch(delay = 1200): void {
            if (window.xdAnswers.settings.batchEnabled && !batchSignature) {
                window.xdAnswers._internal.markBatchPending?.();
            }
            if (batchTimer) clearTimeout(batchTimer);
            if (batchRunning) {
                batchPending = true;
                return;
            }
            batchTimer = setTimeout(runBatch, delay);
        }

        async function runBatch(): Promise<void> {
            batchTimer = null;
            if (batchRunning) {
                batchPending = true;
                return;
            }
            if (!window.xdAnswers.settings.batchEnabled) return;
            if (window.xdAnswers.settings.answerCacheEnabled === false) return;
            if (!window.xdAnswers.prefetchQuestions) return;

            const containers = getQuestionContainers();
            if (!containers.length) return;
            const needsOptionScan = containers.some(container =>
                !!container.querySelector('[role="radio"], [role="checkbox"], [role="option"]')
                && !container.querySelector('[data-xd-option="true"]')
            );
            if (needsOptionScan) {
                scheduleBatch(600);
                return;
            }
            const signature = containers
                .map(container => ((container as HTMLElement).innerText || '').trim())
                .join('\u0000');
            if (!signature || signature === batchSignature) return;

            batchSignature = signature;
            batchRunning = true;
            try {
                const questions = await collectBatchQuestions();
                const currentSignature = getQuestionContainers()
                    .map(container => ((container as HTMLElement).innerText || '').trim())
                    .join('\u0000');
                if (signature !== currentSignature) {
                    batchSignature = '';
                    scheduleBatch(600);
                    return;
                }
                window.xdAnswers._internal.markBatchPending?.();
                await window.xdAnswers.prefetchQuestions(questions, { source: 'gforms' });
            } catch (error) {
                console.warn('[xdAnswers] GForms batch failed:', error);
                batchSignature = '';
            } finally {
                batchRunning = false;
                if (batchPending) {
                    batchPending = false;
                    scheduleBatch(400);
                }
            }
        }

        function scanAndInjectButtons() {
            const questionContainers = getQuestionContainers();
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

            if (questionContainers.length && window.xdAnswers.settings.batchEnabled) scheduleBatch();
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
