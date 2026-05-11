(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    window.xdAnswers.makeRequest = function(options) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const timeoutMs = options.timeout || 25000;
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
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else if (response && response.success) resolve(response);
                else {
                    const details = response.details ? '\n' + response.details : '';
                    reject(new Error((response.error || 'Unknown error') + details));
                }
            });
        });
    };

    window.xdAnswers.streamRequest = function(options, onChunk, onDone, onError) {
        const port = chrome.runtime.connect({ name: 'xdAnswers-stream' });
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
                onError('Connection lost', 'Background stream disconnected unexpectedly');
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
