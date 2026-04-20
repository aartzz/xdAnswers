// background.js

// ── models.dev sync ──

const MODELS_DEV_API = 'https://models.dev/api.json';
const MODELS_CACHE_KEY = 'xdAnswers_modelsDev';
const MODELS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

async function syncModelsDev() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('Timeout'), 30000);
        const response = await fetch(MODELS_DEV_API, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) return;
        const data = await response.json();

        // Extract slim model index: { modelKey: { name, family, attachment, reasoning, cost, limit, modalities, provider } }
        // modelKey = "providerId/modelId" for cross-provider lookup
        const index = {};
        for (const [provId, prov] of Object.entries(data)) {
            if (!prov.models) continue;
            for (const [modelId, m] of Object.entries(prov.models)) {
                // Skip non-chat models
                const outMods = m.modalities?.output || [];
                if (outMods.includes('image') || outMods.includes('audio') || outMods.includes('video')) continue;

                const key = modelId.includes('/') ? modelId : provId + '/' + modelId;
                index[key] = {
                    n: m.name || modelId,             // name
                    f: m.family || null,              // family
                    a: !!m.attachment,                // attachment (vision)
                    r: !!m.reasoning,                 // reasoning (thinking)
                    c: m.cost ? { i: m.cost.input, o: m.cost.output } : null, // cost
                    l: m.limit ? { c: m.limit.context, o: m.limit.output } : null, // limits
                    m: m.modalities || null,          // modalities
                    p: provId                          // provider
                };
                // Also index by model id alone (for lookup from API model lists)
                if (!index[modelId]) {
                    index[modelId] = index[key];
                }
            }
        }

        await chrome.storage.local.set({
            [MODELS_CACHE_KEY]: JSON.stringify(index),
            [MODELS_CACHE_KEY + '_ts']: Date.now()
        });
        console.log('xdAnswers: models.dev synced, ' + Object.keys(index).length + ' entries');
    } catch (e) {
        console.warn('xdAnswers: models.dev sync failed:', e.message);
    }
}

// Initial sync on install
chrome.runtime.onInstalled.addListener(() => {
    syncModelsDev();
    chrome.alarms.create('modelsDevSync', { periodInMinutes: 24 * 60 }); // daily
});

// Periodic sync
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'modelsDevSync') syncModelsDev();
});

// Handle model info requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getModelInfo') {
        chrome.storage.local.get([MODELS_CACHE_KEY, MODELS_CACHE_KEY + '_ts'], (data) => {
            if (!data[MODELS_CACHE_KEY]) { sendResponse({ found: false }); return; }
            try {
                const index = JSON.parse(data[MODELS_CACHE_KEY]);
                const modelId = request.modelId;
                const info = index[modelId] || index['openai/' + modelId] || null;
                sendResponse({ found: !!info, info });
            } catch { sendResponse({ found: false }); }
        });
        return true;
    }
    if (request.type === 'forceModelSync') {
        syncModelsDev().then(() => sendResponse({ done: true }));
        return true;
    }
});

// ── Existing fetch proxy ──
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'fetch') {
        const { url, method, headers, data, responseType, timeout } = request.payload;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('Timeout'), timeout || 60000);

        fetch(url, { method, headers, body: data, signal: controller.signal })
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(JSON.stringify({ status: response.status, statusText: response.statusText, responseText: text }));
                    });
                }
                if (responseType === 'blob') return response.blob();
                return response.text();
            })
            .then(responseData => {
                if (responseData instanceof Blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => sendResponse({ success: true, data: reader.result });
                    reader.onerror = (e) => sendResponse({ success: false, error: 'FileReader error', details: e.toString() });
                    reader.readAsDataURL(responseData);
                } else {
                    sendResponse({ success: true, data: responseData });
                }
            })
            .catch(error => {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    sendResponse({ success: false, error: 'Timeout', details: `Request to ${url} timed out.` });
                } else {
                    try {
                        const d = JSON.parse(error.message);
                        sendResponse({ success: false, error: `API Error: ${d.status}`, details: d.responseText || error.message });
                    } catch (e) {
                        sendResponse({ success: false, error: 'Fetch Error', details: error.message });
                    }
                }
            });
        return true;
    }
});

// Streaming fetch via persistent port
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'xdAnswers-stream') return;

    let controller = null;

    port.onDisconnect.addListener(() => {
        if (controller) controller.abort();
    });

    port.onMessage.addListener(async (msg) => {
        if (msg.type !== 'fetch_stream') return;
        const { url, method, headers, data } = msg.payload;

        controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('Timeout'), 120000);

        try {
            const response = await fetch(url, { method, headers, body: data, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const text = await response.text();
                try { port.postMessage({ type: 'error', error: `API Error: ${response.status}`, details: text }); } catch (e) {}
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                try {
                    port.postMessage({ type: 'chunk', data: decoder.decode(value, { stream: true }) });
                } catch (e) {
                    break;
                }
            }
            try { port.postMessage({ type: 'done' }); } catch (e) {}
        } catch (error) {
            clearTimeout(timeoutId);
            try {
                port.postMessage({ type: 'error', error: error.name === 'AbortError' ? 'Timeout' : error.message });
            } catch (e) {}
        }
    });
});

// Google Forms URL change listener
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.url && details.url.includes('docs.google.com/forms/d/e/')) {
        chrome.tabs.sendMessage(details.tabId, { type: 'gform_url_changed' }, () => {
            if (chrome.runtime.lastError) {}
        });
    }
});

// Microsoft Forms URL change listener
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.url && details.url.includes('forms.office.com/')) {
        chrome.tabs.sendMessage(details.tabId, { type: 'msform_url_changed' }, () => {
            if (chrome.runtime.lastError) {}
        });
    }
});

// ── Global hotkey dispatcher ──
// Fires when user presses Ctrl+Shift+X (or remapped shortcut in chrome://extensions/shortcuts).
// Forwards the command to the active tab so the content script can trigger the answer flow
// (bypassing the click in oneclick silent mode).
if (chrome.commands && chrome.commands.onCommand) {
    chrome.commands.onCommand.addListener((command) => {
        if (command !== 'xd-trigger-answer') return;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab || !tab.id) return;
            chrome.tabs.sendMessage(tab.id, { type: 'xd_hotkey', command }, () => {
                if (chrome.runtime.lastError) {
                    // Tab isn't running our content script; ignore silently.
                }
            });
        });
    });
}
