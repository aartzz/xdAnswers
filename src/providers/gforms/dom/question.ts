// src/providers/gforms/dom/question.ts
// Google Forms question payload: title text, grid or option data, images.
import { collectGrid } from './grid';

export function buildQuestionData(container: Element): Promise<XdQuestionData> {
    const titleEl = container.querySelector('.M7eMe, .GEHe6, [role="heading"]');
    const questionText = ((titleEl ? (titleEl as HTMLElement).innerText : (container as HTMLElement).innerText) || '').trim();
    const grid = collectGrid(container);
    const imgPromises: Array<Promise<string | null>> = [];
    container.querySelectorAll('img').forEach(img => {
        const src = img.src || img.getAttribute('data-src');
        if (src && !src.startsWith('data:image/gif')) {
            const absoluteSrc = new URL(src, window.location.href).href;
            imgPromises.push(window.xdAnswers.imageToBase64(absoluteSrc));
        }
    });
    return Promise.all(imgPromises).then(images => {
        if (grid) {
            return {
                text: questionText,
                optionsText: grid.optionsText,
                base64Images: images.filter((i): i is string => i !== null),
                questionType: 'grid',
                isMulti: grid.isMulti
            };
        }
        const optionEls = container.querySelectorAll('[data-xd-option="true"]');
        const options = Array.from(optionEls).map(el => ((el as HTMLElement).innerText || '').trim()).filter(Boolean);
        const hasCheckboxes = container.querySelectorAll('[role="checkbox"]').length > 0;
        return {
            text: questionText,
            optionsText: options.join('\n') || undefined,
            base64Images: images.filter((i): i is string => i !== null),
            questionType: options.length > 0 ? 'quiz' : 'general',
            isMulti: hasCheckboxes
        };
    });
}
