// src/providers/naurok/topic.ts
// Naurok test metadata discovery: session ID extraction and topic discovery from API or postMessage.
import type { NaurokDomApi } from './dom';

export interface NaurokTopicManager {
    getTopic(): string | null;
    fetchTopic(dom: NaurokDomApi): Promise<string | null>;
    initMessageListener(dom: NaurokDomApi): void;
}

let _naurokTopic: string | null = null;
let _naurokSessionId: number | null = null;

export function extractTopicFromSessionPayload(payload: unknown, dom?: NaurokDomApi): void {
    try {
        const p = payload as any;
        if (!p || typeof p !== 'object') return;
        const name = (p.document && p.document.name) ||
            (p.settings && p.settings.name) ||
            (p.session && p.session.name);
        if (name && typeof name === 'string' && name.trim()) {
            _naurokTopic = name.trim();
            console.log('[xdAnswers/naurok] Topic extracted:', _naurokTopic);
        }
        const sid = p.session && p.session.id;
        if (typeof sid === 'number') {
            _naurokSessionId = sid;
            console.log('[xdAnswers/naurok] Session ID:', _naurokSessionId);
        }
    } catch (e) {
        console.warn('[xdAnswers/naurok] extractTopicFromSessionPayload error:', e);
    }
}

export function initMessageListener(dom: NaurokDomApi): void {
    window.addEventListener('message', function (event) {
        if (event.source !== window) return;
        const data = event.data as { source?: string; provider?: string; type?: string; payload?: unknown } | null;
        if (!data || data.source !== 'xd-disabler' || data.provider !== 'naurok') return;
        if (data.type === 'beta-session') {
            dom.setBetaSession(data.payload);
            extractTopicFromSessionPayload(data.payload, dom);
            return;
        }
        if (data.type !== 'session-payload') return;
        extractTopicFromSessionPayload(data.payload, dom);
    });
}

export async function fetchNaurokTopic(dom: NaurokDomApi): Promise<string | null> {
    if (_naurokTopic) {
        console.log('[xdAnswers/naurok] Topic already known:', _naurokTopic);
        return _naurokTopic;
    }
    if (dom.isBetaTest()) {
        const title = document.title.replace(/^(?:тест|результат)\s*:\s*/i, '').trim();
        if (title) {
            _naurokTopic = title;
            console.log('[xdAnswers/naurok] Topic from test-beta title:', _naurokTopic);
            return _naurokTopic;
        }
    }
    try {
        let sessionId = dom.parseSessionIdFromDOM();

        if (!sessionId) {
            const urlMatch = window.location.pathname.match(/\/test\/(?:testing|play)\/([a-f0-9-]+)/i);
            if (urlMatch) {
                const allNgInit = document.querySelectorAll('[ng-init]');
                for (const el of allNgInit) {
                    const val = el.getAttribute('ng-init') || '';
                    const m = val.match(/init\s*\([^)]*(\d{7,})[^)]*\)/);
                    if (m) {
                        sessionId = parseInt(m[1], 10);
                        break;
                    }
                }
            }
        }

        if (!sessionId) return _naurokTopic;
        _naurokSessionId = sessionId;

        if (window.xdAnswers && window.xdAnswers.makeRequest) {
            try {
                const res = await window.xdAnswers.makeRequest({
                    url: 'https://naurok.com.ua/api2/test/sessions/' + sessionId,
                    method: 'GET',
                    timeout: 10000
                });
                const rawData = (res as any)?.data || res;
                const json = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                extractTopicFromSessionPayload(json, dom);
            } catch (e) {
                console.warn('[xdAnswers/naurok] Session API fetch failed:', (e as any).message || e);
            }
        }
    } catch (e) {
        console.warn('[xdAnswers/naurok] fetchNaurokTopic error:', e);
    }
    return _naurokTopic;
}

export function getNaurokTopic(): string | null {
    return _naurokTopic;
}
