// background.js

// Non-streaming fetch proxy
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
