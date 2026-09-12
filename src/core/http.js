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

            try {
                chrome.runtime.sendMessage({ type: 'fetch', payload: options }, (response) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    if (chrome.runtime.lastError) {
                        const errMsg = chrome.runtime.lastError.message || '';
                        if (errMsg.includes('Receiving end does not exist') || errMsg.includes('Could not establish connection')) {
                            // Retry once after 500ms in case background service worker was sleeping/waking up
                            if (!options._retried) {
                                setTimeout(() => {
                                    window.xdAnswers.makeRequest(Object.assign({}, options, { _retried: true }))
                                        .then(resolve)
                                        .catch(reject);
                                }, 500);
                                return;
                            }
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
            } catch (err) {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeoutId);
                    reject(new Error('Extension background reloaded or disconnected. Please refresh the page.'));
                }
            }
        });
    };

    window.xdAnswers.streamRequest = function(options, onChunk, onDone, onError) {
        let port;
        let finished = false;

        function connect() {
            try {
                port = chrome.runtime.connect({ name: 'xdAnswers-stream' });
            } catch (e) {
                if (!options._retried) {
                    setTimeout(() => {
                        window.xdAnswers.streamRequest(Object.assign({}, options, { _retried: true }), onChunk, onDone, onError);
                    }, 500);
                    return null;
                }
                onError('Extension disconnected', 'Extension context invalidated. Please refresh the page.');
                return null;
            }

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
                        if (!options._retried) {
                            window.xdAnswers.streamRequest(Object.assign({}, options, { _retried: true }), onChunk, onDone, onError);
                            return;
                        }
                        onError('Extension disconnected', 'Extension context was invalidated or reloaded. Please refresh the page.');
                    } else {
                        onError('Connection lost', lastErr || 'Background stream disconnected unexpectedly');
                    }
                }
            });

            port.postMessage({ type: 'fetch_stream', payload: options });
            return port;
        }

        connect();

        return () => {
            if (!finished) {
                finished = true;
                try { if (port) port.disconnect(); } catch(e) {}
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
