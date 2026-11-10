(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    type RequestOptions = XdMakeRequestOptions & { _retryCount?: number };
    type StreamOptions = XdStreamRequestOptions & { _retryCount?: number };

    window.xdAnswers.makeRequest = function(options: RequestOptions): Promise<XdTransportResult> {
        return new Promise((resolve, reject) => {
            let settled = false;
            const timeoutMs = options.timeout || 120000;
            const timeoutId = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('Request timeout: background script did not respond within ' + timeoutMs + 'ms'));
                }
            }, timeoutMs);

            const retryCount = options._retryCount || 0;
            const maxRetries = 3;

            try {
                chrome.runtime.sendMessage({ type: 'fetch', payload: options }, (response) => {
                    if (settled) return;
                    clearTimeout(timeoutId);
                    if (chrome.runtime.lastError) {
                        const errMsg = chrome.runtime.lastError.message || '';
                        if (errMsg.includes('Receiving end does not exist') || errMsg.includes('Could not establish connection')) {
                            if (retryCount < maxRetries) {
                                setTimeout(() => {
                                    window.xdAnswers.makeRequest(Object.assign({}, options, { _retryCount: retryCount + 1 }))
                                        .then(resolve)
                                        .catch(reject);
                                }, 300 * (retryCount + 1));
                                return;
                            }
                            settled = true;
                            reject(new Error('Extension background reloaded or disconnected. Please refresh the page.'));
                        } else {
                            settled = true;
                            reject(new Error(errMsg));
                        }
                    }
                    else if (response && response.success) {
                        settled = true;
                        resolve(response);
                    }
                    else {
                        settled = true;
                        const details = response && response.details ? '\n' + response.details : '';
                        reject(new Error(((response && response.error) || 'Unknown error') + details));
                    }
                });
            } catch (err) {
                if (!settled) {
                    if (retryCount < maxRetries) {
                        setTimeout(() => {
                            window.xdAnswers.makeRequest(Object.assign({}, options, { _retryCount: retryCount + 1 }))
                                .then(resolve)
                                .catch(reject);
                        }, 300 * (retryCount + 1));
                        return;
                    }
                    settled = true;
                    clearTimeout(timeoutId);
                    reject(new Error('Extension background reloaded or disconnected. Please refresh the page.'));
                }
            }
        });
    };

    window.xdAnswers.streamRequest = function(
        options: StreamOptions,
        onChunk: (chunk: unknown) => void,
        onDone: (result?: unknown) => void,
        onError: (error: unknown, details?: unknown) => void
    ): () => void {
        const idleTimeoutMs = Number(options.timeout) > 0 ? Number(options.timeout) : 45000;
        const maxRetries = 1;
        let finished = false;
        let receivedChunk = false;
        let retryCount = 0;
        let closeActive: (() => void) | null = null;
        let idleTimer: ReturnType<typeof setTimeout> | null = null;
        let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

        function clearTimers(): void {
            if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
            if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
            if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        }

        function closePort(): void {
            const close = closeActive;
            closeActive = null;
            if (close) close();
        }

        function transient(error: unknown, details?: unknown): boolean {
            const text = (String(error || '') + ' ' + String(details || '')).trim().toLowerCase();
            if (!text) return true;
            if (/api error:/.test(text)) {
                return /api error:\s*(?:408|429|500|502|503|504)/.test(text);
            }
            if (/cancelled|canceled/.test(text)) return false;
            return /timeout|timed out|connection lost|disconnected|network|fetch error|stalled|receiving end|background stream/.test(text);
        }

        function fail(error: unknown, details?: unknown): void {
            if (finished) return;
            finished = true;
            clearTimers();
            closePort();
            onError(error, details);
        }

        function complete(): void {
            if (finished) return;
            finished = true;
            clearTimers();
            closePort();
            onDone();
        }

        function retry(error: unknown, details?: unknown): void {
            if (finished) return;
            if (receivedChunk || retryCount >= maxRetries || !transient(error, details)) {
                fail(error, details);
                return;
            }
            retryCount++;
            clearTimers();
            closePort();
            retryTimer = setTimeout(() => {
                retryTimer = null;
                connect();
            }, 400 * retryCount);
        }

        function armIdle(): void {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                idleTimer = null;
                if (finished) return;
                retry('Timeout', 'No stream data for ' + idleTimeoutMs + 'ms');
            }, idleTimeoutMs);
        }

        function connect(): void {
            if (finished) return;
            let port: chrome.runtime.Port;
            try {
                port = chrome.runtime.connect({ name: 'xdAnswers-stream' });
            } catch {
                retry('Extension disconnected', 'Extension context invalidated. Please refresh the page.');
                return;
            }

            let closed = false;
            closeActive = () => {
                if (closed) return;
                closed = true;
                try { port.disconnect(); } catch { /* already disconnected */ }
            };

            port.onMessage.addListener((msg) => {
                if (finished || closed) return;
                if (msg.type === 'chunk') {
                    receivedChunk = true;
                    armIdle();
                    onChunk(msg.data);
                } else if (msg.type === 'done') {
                    complete();
                } else if (msg.type === 'error') {
                    retry(msg.error, msg.details);
                }
            });

            port.onDisconnect.addListener(() => {
                if (finished || closed) return;
                closed = true;
                const lastErr = chrome.runtime.lastError?.message || '';
                retry('Connection lost', lastErr || 'Background stream disconnected unexpectedly');
            });

            // Long model pauses can outlive the extension background worker's
            // idle timer. A port message every 20s keeps the worker alive.
            keepAliveTimer = setInterval(() => {
                if (finished || closed) return;
                try { port.postMessage({ type: 'ping' }); } catch { /* disconnected */ }
            }, 20000);
            armIdle();

            try {
                port.postMessage({ type: 'fetch_stream', payload: options });
            } catch {
                retry('Connection lost', 'Could not send the stream request');
            }
        }

        connect();

        return (abort?: boolean) => {
            if (finished) return;
            if (abort) {
                const err = new Error('Request cancelled');
                err.name = 'AbortError';
                fail(err);
            } else {
                finished = true;
                clearTimers();
                closePort();
            }
        };
    };

    window.xdAnswers.addStyle = function(css: string): void {
        let el = document.querySelector<HTMLStyleElement>('style[data-app-style]');
        if (!el) {
            el = document.createElement('style');
            el.setAttribute('data-app-style', 'true');
            (document.head || document.documentElement).appendChild(el);
        }
        if (el.textContent !== css) el.textContent = css;
    };

    window.xdAnswers.imageToBase64 = async function(url: string): Promise<string | null> {
        try {
            // If image is already known to be broken in the DOM, don't waste time fetching it
            const img = document.querySelector<HTMLImageElement>(`img[src="${url}"]`);
            if (img && (img.closest('.is-error, .tb-img-error') || (img.complete && img.naturalWidth === 0))) {
                return null;
            }

            const response = await window.xdAnswers.makeRequest({ method: 'GET', url, responseType: 'blob', timeout: 2000 });
            if (response?.success && response.data && typeof response.data === 'string' && response.data.startsWith('data:')) {
                return response.data.split(',', 2)[1] || null;
            }
            return null;
        } catch { return null; }
    };
})();
