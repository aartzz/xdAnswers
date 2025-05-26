// background.js

// Прослуховувач для повідомлень від content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'fetch') {
        const { url, method, headers, data, responseType, timeout } = request.payload;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout || 60000); // 60 секунд за замовчуванням

        fetch(url, {
            method: method,
            headers: headers,
            body: data,
            signal: controller.signal
        })
        .then(response => {
            clearTimeout(timeoutId);
            if (!response.ok) {
                 // Спробуємо прочитати тіло помилки, щоб надати більше деталей
                return response.text().then(text => {
                    throw new Error(JSON.stringify({
                        status: response.status,
                        statusText: response.statusText,
                        responseText: text
                    }));
                });
            }
            // Обробка різних типів відповідей
            if (responseType === 'blob') {
                return response.blob();
            }
            return response.text();
        })
        .then(responseData => {
            // Якщо потрібен blob, конвертуємо його в Data URL
            if (responseData instanceof Blob) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    sendResponse({ success: true, data: reader.result });
                };
                reader.onerror = (error) => {
                    sendResponse({ success: false, error: 'FileReader error: ' + error.message });
                };
                reader.readAsDataURL(responseData);
                return true; // Вказує на асинхронну відповідь
            } else {
                 sendResponse({ success: true, data: responseData });
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            // Розпаковуємо помилку, якщо вона була створена нами
            try {
                 const errDetails = JSON.parse(error.message);
                 sendResponse({ success: false, error: `API Error: ${errDetails.status}`, details: errDetails.responseText });
            } catch (e) {
                 sendResponse({ success: false, error: error.message });
            }
        });

        return true; // Вказує, що відповідь буде надіслана асинхронно
    }
});