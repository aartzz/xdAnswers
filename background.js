// background.js

// Прослуховувач для fetch-запитів від content script або popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'fetch') {
        // ... (Ваша існуюча логіка для fetch без змін) ...
        const { url, method, headers, data, responseType, timeout } = request.payload;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout || 60000);

        fetch(url, {
            method: method,
            headers: headers,
            body: data,
            signal: controller.signal
        })
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
                reader.onloadend = () => { sendResponse({ success: true, data: reader.result }); };
                reader.onerror = (error) => { sendResponse({ success: false, error: 'FileReader error: ' + error.message }); };
                reader.readAsDataURL(responseData);
                return true;
            } else {
                 sendResponse({ success: true, data: responseData });
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            try {
                 const errDetails = JSON.parse(error.message);
                 sendResponse({ success: false, error: `API Error: ${errDetails.status}`, details: errDetails.responseText });
            } catch (e) {
                 sendResponse({ success: false, error: error.message });
            }
        });
        return true;
    }
});

// !!! --- НОВА ЛОГІКА --- !!!
// Прослуховувач для відстеження динамічних змін URL на сторінці
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    // Перевіряємо, чи URL належить Google Forms
    if (details.url && details.url.includes("docs.google.com/forms/d/e/")) {
        // Надсилаємо повідомлення в контент-скрипт на цій вкладці,
        // щоб він знав, що потрібно перевірити сторінку знову.
        chrome.tabs.sendMessage(details.tabId, { type: "gform_url_changed" }, () => {
             if (chrome.runtime.lastError) {
                // Помилка може виникнути, якщо контент-скрипт ще не готовий. Це нормально.
                // console.log("Content script not ready yet.");
             }
        });
    }
});