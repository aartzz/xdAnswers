// src/providers/naurok-round/main.ts
// НаУрок олімпіади / конкурси provider entry (naurok.ua/round/*): extracts each
// question, wires the ✨ Solve button (or the one-click handler) and forwards
// answers through the AI pipeline. Extraction lives in ./dom.ts, answer
// application in ./apply.ts.
import type { NaurokRoundDomApi } from './dom';
import type { NaurokRoundApplyApi } from './apply';

(function () {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;
    const modules = I.providerModules || (I.providerModules = {});
    const roundModules = modules['naurok-round'] || (modules['naurok-round'] = {});
    const dom = roundModules.dom as NaurokRoundDomApi;
    const applyApi = roundModules.apply as NaurokRoundApplyApi;

    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initNaurokRound();
        }
    }, 50);

    function prepareQuestionData(questionEl: Element): Promise<XdQuestionData | null> {
        const meta = dom.collectMeta(questionEl);
        if (!meta) return Promise.resolve(null);
        window.xdAnswers._customAutoAnswer = (answerText) => applyApi.applyAnswer(meta, answerText, questionEl);
        const urls = [...new Set(meta.images)];
        const imgPromises = urls.map(u => Promise.resolve(window.xdAnswers.imageToBase64(u)).catch(() => null));
        return Promise.all(imgPromises).then(images => {
            return dom.buildQuestionData(meta, images.filter(Boolean) as string[]);
        });
    }

    function scanAndInject(): void {
        const questionEl = document.querySelector('question') || document.querySelector('.sth-question');
        if (!questionEl) return;
        const controls = questionEl.querySelector('.sth-question-controls');
        if (!controls) return;

        if (window.xdAnswers.settings.silentMode === 'oneclick') {
            if (!questionEl.classList.contains('xd-oneclick-ready')) {
                window.xdAnswers.setupOneClickHandler(questionEl as HTMLElement, () => prepareQuestionData(questionEl));
            }
            return;
        }

        if (controls.querySelector('.xd-solve-btn')) return;
        const button = document.createElement('button');
        button.className = 'xd-btn xd-solve-btn';
        button.innerText = '✨ Solve';
        button.style.cssText = `background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.5);color:#6366f1;padding:6px 14px;border-radius:6px;cursor:pointer;margin-top:10px;margin-left:10px;font-family:system-ui,-apple-system,sans-serif;font-weight:600;font-size:13px;z-index:9999;position:relative;transition:all 0.15s;`;
        button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.xdAnswers._answerContainer = questionEl as HTMLElement;
            prepareQuestionData(questionEl).then(data => {
                if (data) window.xdAnswers.processQuestion(data);
            });
        };
        controls.appendChild(button);
    }

    function initNaurokRound(): void {
        console.log('[xdAnswers] Naurok round provider loaded');
        window.xdAnswers.onRefresh = () => scanAndInject();

        let scanTimer: number | undefined;
        const debouncedScan = () => {
            clearTimeout(scanTimer);
            scanTimer = setTimeout(scanAndInject, 300);
        };

        const observer = new MutationObserver(() => {
            debouncedScan();
            if (window.xdAnswers.helperContainer && !document.body.contains(window.xdAnswers.helperContainer)) {
                document.body.appendChild(window.xdAnswers.helperContainer);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        scanAndInject();
    }
})();
