// src/popup/core/utils.ts
// @ts-nocheck — popup UI module. Small helpers shared by the popup modules.

export function escapeHTML(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function makeRequest(options) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'fetch', payload: options }, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (response?.success) resolve(response);
            else reject(new Error(response?.error || 'Fetch failed'));
        });
    });
}
