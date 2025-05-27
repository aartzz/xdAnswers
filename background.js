// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'fetch') {
        const { url, method, headers, data, responseType, timeout } = request.payload;

        const controller = new AbortController();
        const signal = controller.signal;
        const timeoutId = setTimeout(() => {
            controller.abort("Timeout");
        }, timeout || 60000);

        fetch(url, { method, headers, body: data, signal })
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(JSON.stringify({ 
                            status: response.status, 
                            statusText: response.statusText, 
                            responseText: text 
                        }));
                    }).catch(err => { // Якщо .text() теж не вдалося
                         throw new Error(JSON.stringify({ 
                            status: response.status, 
                            statusText: response.statusText, 
                            responseText: "Could not read error response body" 
                        }));
                    });
                }
                if (responseType === 'blob') {
                    return response.blob();
                }
                return response.text();
            })
            .then(responseData => {
                if (responseData instanceof Blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        sendResponse({ success: true, data: reader.result });
                    };
                    reader.onerror = (error) => {
                        sendResponse({ success: false, error: 'FileReader error: ' + error.toString(), details: error.toString() });
                    };
                    reader.readAsDataURL(responseData);
                } else {
                    sendResponse({ success: true, data: responseData });
                }
            })
            .catch(error => {
                clearTimeout(timeoutId);
                let errorResponse;
                if (error.name === 'AbortError') {
                     errorResponse = { success: false, error: 'Fetch Timeout', details: `Request to ${url} timed out.` };
                } else {
                    try {
                        const errDetails = JSON.parse(error.message);
                        errorResponse = { success: false, error: `API Error: ${errDetails.status || error.name}`, details: errDetails.responseText || error.message };
                    } catch (e) {
                        errorResponse = { success: false, error: 'Fetch Error', details: error.message };
                    }
                }
                sendResponse(errorResponse);
            });
        
        return true; 
    }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.url && details.url.includes("docs.google.com/forms/d/e/")) {
        chrome.tabs.sendMessage(details.tabId, { type: "gform_url_changed" }, () => {
             if (chrome.runtime.lastError) { /* Ігноруємо */ }
        });
    }
});