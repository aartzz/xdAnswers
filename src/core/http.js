(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    window.xdAnswers.makeRequest = function(options) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'fetch', payload: options }, (response) => {
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
        port.postMessage({ type: 'fetch_stream', payload: options });
        port.onMessage.addListener((msg) => {
            if (msg.type === 'chunk') onChunk(msg.data);
            else if (msg.type === 'done') { onDone(); port.disconnect(); }
            else if (msg.type === 'error') { onError(msg.error, msg.details); port.disconnect(); }
        });
        return () => { try { port.disconnect(); } catch(e) {} };
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
