// src/providers/wordwall/main.ts
// Wordwall provider entry: fetches the content model for the current activity and
// renders the complete answer sheet in the floating helper (known-content mode,
// like JustClass). Pairs-based templates (match up, anagram, find the match...)
// are fully covered by the content JSON — no AI round-trip needed.
import type { WordwallDomApi, WordwallPageInfo } from './dom';
import type { WordwallContentApi, WordwallContent } from './content';

(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    const I = window.xdAnswers._internal;
    I.providerModules = I.providerModules || {};
    const ns = (I.providerModules.wordwall = I.providerModules.wordwall || {});

    let lastRenderKey = '';
    let currentContent: WordwallContent | null = null;
    let fetchError: string | null = null;
    const waitForUtils = setInterval(async () => {
        if (window.xdAnswers && window.xdAnswers.loadSettings) {
            clearInterval(waitForUtils);
            await window.xdAnswers.loadSettings();
            initWordwall();
        }
    }, 50);

    function domApi(): WordwallDomApi {
        return (I.providerModules as Record<string, any>).wordwall.dom as WordwallDomApi;
    }

    function contentApi(): WordwallContentApi {
        return (I.providerModules as Record<string, any>).wordwall.content as WordwallContentApi;
    }

    function contentUrl(info: WordwallPageInfo): string | null {
        if (!info.authorUserId || !info.activityGuid) return null;
        // userCdn may start with //: normalize in case the page is served over https
        let cdn = info.userCdn || 'https://user.cdn.wordwall.net';
        if (cdn.startsWith('//')) cdn = 'https:' + cdn;
        return cdn + '/content-models/' + info.authorUserId + '/' + info.activityGuid + '.json';
    }

    function buildParsed(content: WordwallContent): XdParsedResponse {
        const lines: string[] = [];
        content.items.forEach((item, i) => {
            const left = item.primary || '(картинка)';
            const right = item.secondary || '(картинка)';
            lines.push((i + 1) + '. **' + left + '** — ' + right);
        });
        if (!lines.length) {
            return {
                answer: '',
                explanation: 'Не вдалося витягти пари з контенту Wordwall для цієї гри (можливо, тип гри ще не підтримується).',
                _wordwall: true
            };
        }
        const explanation = content.instruction ? 'Інструкція: ' + content.instruction : '';
        return {
            answer: lines.join('\n'),
            explanation,
            _wordwall: true,
            _wordwallShort: content.items.map(i => i.primary + ' — ' + i.secondary).join('; '),
            isStructured: true
        };
    }

    function renderHelper(parsed: XdParsedResponse, force: boolean): void {
        const key = (parsed.answer || '') + '|' + (parsed.explanation || '');
        if (!force && key === lastRenderKey
            && window.xdAnswers.helperContainer
            && document.body.contains(window.xdAnswers.helperContainer)) {
            return;
        }
        lastRenderKey = key;

        if (!window.xdAnswers.helperContainer) window.xdAnswers.createUI();
        if (!document.body.contains(window.xdAnswers.helperContainer)) {
            window.xdAnswers.attachAndPositionHelper();
        }

        const div = window.xdAnswers.answerContentDiv;
        if (!div) return;
        const html = I.renderParsedResponse(parsed);
        div.innerHTML = html || '<div class="xd-answer">Готово.</div>';
    }

    function renderError(message: string): void {
        const parsed: XdParsedResponse = {
            answer: '',
            explanation: message,
            _wordwall: true
        };
        window.xdAnswers.lastParsedResponse = parsed;
        renderHelper(parsed, true);
    }

    /** Best-effort: outline DOM tiles whose text matches a pair side. Works when the
     * engine renders real DOM elements; no-op on canvas-only screens. */
    function markTiles(): void {
        if (!currentContent || currentContent.kind !== 'pairs') return;
        document.querySelectorAll<HTMLElement>('[class*="tile" i], .word-label, [class*="word" i]').forEach(el => {
            if (el.closest('[class*="xd-"]')) return;
            const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text) return;
            const match = currentContent!.items.some(i => i.primary === text || i.secondary === text);
            if (!match) {
                el.style.removeProperty('outline');
                return;
            }
            el.style.setProperty('outline', '2px solid #22c55e', 'important');
            el.style.setProperty('outline-offset', '1px', 'important');
        });
    }

    function contentPathInfo(): string | null {
        const info = domApi().readPageInfo();
        if (!info) return null;
        const url = contentUrl(info);
        return url;
    }

    function initWordwall(): void {
        if (!domApi() || !contentApi()) {
            console.warn('[xdAnswers] wordwall: modules missing');
            return;
        }

        window.xdAnswers.onRefresh = () => { lastRenderKey = ''; run(true); };

        // Pages are mostly static once loaded; light polling covers late content fetches.
        run(false);
        setInterval(() => { run(false); markTiles(); }, 1500);
        new MutationObserver(() => markTiles()).observe(document.documentElement, { childList: true, subtree: true });

        async function run(force: boolean): Promise<void> {
            const info = domApi().readPageInfo();
            console.log('[xdAnswers] wordwall: page info', info);
            if (!info || !info.activityGuid) return;
            const url = contentUrl(info);
            if (!url) { console.warn('[xdAnswers] wordwall: no content url', info); return; }

            if (!currentContent) {
                const content = await contentApi().fetchContent(url);
                if (!content) {
                    console.warn('[xdAnswers] wordwall: fetch failed', url);
                    if (force || !fetchError) {
                        fetchError = 'Не вдалося завантажити контент Wordwall: помилка мережі або ресурс приватний.';
                        renderError(fetchError);
                    }
                    return;
                }
                console.log('[xdAnswers] wordwall: content kind=' + content.kind, content.raw);
                currentContent = content;
                if (content.kind === 'pairs') {
                    renderHelper(buildParsed(content), true);
                } else {
                    // Unknown shape: let the standard AI pipeline help with whatever is on screen
                    const strings = collectStrings(content.raw, 60);
                    if (!fetchError) {
                        fetchError = 'Тип гри ще не підтримується локально. Натисніть гарячих клавіш (Ctrl+Shift+X) — відповість ШІ.';
                        renderError(fetchError);
                    }
                    if (window.xdAnswers.settings.silentMode !== 'oneclick') {
                        window.xdAnswers.processQuestion({
                            text: info.activityTitle || domApi().title(),
                            optionsText: strings.join('\n'),
                            questionType: 'choice',
                            topic: info.activityTitle || undefined
                        });
                    }
                }
                return;
            }

            if (force && currentContent.kind === 'pairs') renderHelper(buildParsed(currentContent), true);
        }
    }

    function collectStrings(node: unknown, depth: number, out: string[] = []): string[] {
        if (depth < 0 || out.length > 80) return out;
        if (typeof node === 'string') {
            const s = node.replace(/<[^>]*>/g, '').trim();
            if (s) out.push(s);
        } else if (Array.isArray(node)) {
            node.forEach(n => collectStrings(n, depth - 1, out));
        } else if (node && typeof node === 'object') {
            Object.values(node).forEach(n => collectStrings(n, depth - 1, out));
        }
        return out;
    }

})();
