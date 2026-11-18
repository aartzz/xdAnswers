// src/providers/smileandtask/dom/storage.ts
// Reads the normalized task cached by S&T School in sessionStorage ("jt_test")
// and extracts test metadata (topic, description, id).

import type { StoredImage, StoredTask } from './types';
import { absoluteUrl, cleanText } from './util';

export function resolveStoredImage(img?: StoredImage | null): string | null {
    const url = img?.url?.trim() || '';
    if (!url || url.startsWith('data:')) return null;
    return absoluteUrl(url);
}

export function readStoredTask(): StoredTask | null {
    try {
        const raw = sessionStorage.getItem('jt_test');
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredTask;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        return null;
    }
}

let knownTopic = '';

export function rememberTopic(): void {
    const heading = document.querySelector<HTMLElement>('h1.text-2xl.font-bold');
    if (heading) {
        const title = cleanText(heading.textContent);
        if (title) {
            const subjectText = cleanText(heading.nextElementSibling?.textContent);
            const subject = /предмету\s+(.+)$/i.exec(subjectText)?.[1]?.trim();
            knownTopic = subject ? `${title} (${subject})` : title;
            return;
        }
    }
    if (knownTopic) return;
    const task = readStoredTask();
    const title = cleanText(task?.title);
    if (!title) return;
    const subject = cleanText(task?.subject);
    knownTopic = subject ? `${title} (${subject})` : title;
}

export function currentTopic(): string | undefined {
    rememberTopic();
    return knownTopic || undefined;
}

export function currentTopicDescription(): string | undefined {
    const desc = cleanText(readStoredTask()?.description);
    return desc || undefined;
}

export function currentTestId(): string | undefined {
    const taskId = cleanText(readStoredTask()?.id);
    if (taskId) return taskId;
    try {
        const code = sessionStorage.getItem('jt_currentCode') || '';
        if (code.trim()) return code.trim();
    } catch (e) { /* ignore */ }
    return undefined;
}
