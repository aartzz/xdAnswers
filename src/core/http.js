(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    window.xdAnswers.makeRequest = function(options) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const timeoutMs = options.timeout || 120000;
            const timeoutId = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('Request timeout: background script did not respond within ' + timeoutMs + 'ms'));
                }
            }, timeoutMs);

            chrome.runtime.sendMessage({ type: 'fetch', payload: options }, (response) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                if (chrome.runtime.lastError) {
                    const errMsg = chrome.runtime.lastError.message || '';
                    if (errMsg.includes('Receiving end does not exist') || errMsg.includes('Could not establish connection')) {
                        reject(new Error('Extension background reloaded or disconnected. Please refresh the page.'));
                    } else {
                        reject(new Error(errMsg));
                    }
                }
                else if (response && response.success) resolve(response);
                else {
                    const details = response && response.details ? '\n' + response.details : '';
                    reject(new Error(((response && response.error) || 'Unknown error') + details));
                }
            });
        });
    };

    window.xdAnswers.streamRequest = function(options, onChunk, onDone, onError) {
        let port;
        try {
            port = chrome.runtime.connect({ name: 'xdAnswers-stream' });
        } catch (e) {
            onError('Extension disconnected', 'Extension context invalidated. Please refresh the page.');
            return () => {};
        }
        let finished = false;

        port.onMessage.addListener((msg) => {
            if (finished) return;
            if (msg.type === 'chunk') onChunk(msg.data);
            else if (msg.type === 'done') {
                finished = true;
                onDone();
                try { port.disconnect(); } catch(e) {}
            }
            else if (msg.type === 'error') {
                finished = true;
                onError(msg.error, msg.details);
                try { port.disconnect(); } catch(e) {}
            }
        });

        port.onDisconnect.addListener(() => {
            if (!finished) {
                finished = true;
                const lastErr = chrome.runtime.lastError?.message || '';
                if (lastErr.includes('Receiving end does not exist') || lastErr.includes('Could not establish connection')) {
                    onError('Extension disconnected', 'Extension context was invalidated or reloaded. Please refresh the page.');
                } else {
                    onError('Connection lost', lastErr || 'Background stream disconnected unexpectedly');
                }
            }
        });

        port.postMessage({ type: 'fetch_stream', payload: options });
        return () => {
            if (!finished) {
                finished = true;
                try { port.disconnect(); } catch(e) {}
            }
        };
    };

    window.xdAnswers.addStyle = function(css) {
        let el = document.getElementById('xdAnswers-styles');
        if (!el) { el = document.createElement('style'); el.id = 'xdAnswers-styles'; document.head.appendChild(el); }
        if (el.textContent !== css) el.textContent = css;
    };

    window.xdAnswers.imageToBase64 = async function(url) {
        try {
            const response = await window.xdAnswers.makeRequest({ method: 'GET', url, responseType: 'blob' });
            if (response?.success && response.data && typeof response.data === 'string' && response.data.startsWith('data:')) {
                return response.data.split(',', 2)[1] || null;
            }
            return null;
        } catch { return null; }
    };
})();
