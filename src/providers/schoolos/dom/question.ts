// src/providers/schoolos/dom/question.ts
// SchoolOS INTEGRITY exam page: question, options, images and multi-choice flag.
// SchoolOS hides zero-width characters between glyphs to break TTS/LLM readers,
// so every extracted string is cleaned before it reaches the AI payload.

export interface SchoolosQuestionState {
    text: string;
    options: string[];
    imageUrls: string[];
    isMultiple: boolean;
    questionType: 'choice';
    container: HTMLElement | null;
}

const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF\u2060]/g;

export function cleanText(value: string | null | undefined): string {
    return String(value || '')
        .replace(ZERO_WIDTH, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function absoluteUrl(src: string): string {
    try {
        return new URL(src, location.href).href;
    } catch (e) {
        return src;
    }
}

export function readQuestion(): SchoolosQuestionState | null {
    const card = document.querySelector<HTMLElement>('.q-card');
    const questionEl = card?.querySelector<HTMLElement>('.q-text')
        || document.querySelector<HTMLElement>('.q-text');
    if (!questionEl) return null;

    const text = cleanText(questionEl.innerText || questionEl.textContent);
    if (!text) return null;

    const optionEls = Array.from((card || document).querySelectorAll<HTMLElement>('.opt'));
    const options: string[] = [];
    const optionImageUrls: string[] = [];

    optionEls.forEach(opt => {
        const textEl = opt.querySelector<HTMLElement>('.opt-txt');
        const optionText = cleanText(textEl?.innerText || textEl?.textContent || opt.innerText);
        const img = opt.querySelector<HTMLImageElement>('.opt-img');
        if (img?.src && !img.src.startsWith('data:')) {
            optionImageUrls.push(absoluteUrl(img.src));
        }
        options.push(optionText || (img ? '[зображення]' : ''));
    });

    const questionImage = card?.querySelector<HTMLImageElement>('.q-img');
    const imageUrls: string[] = [];
    if (questionImage?.src && !questionImage.src.startsWith('data:')) {
        imageUrls.push(absoluteUrl(questionImage.src));
    }
    imageUrls.push(...optionImageUrls);

    // .opt-cb exists only on multi-choice questions; #confirmBtn confirms the set.
    const isMultiple = !!card?.querySelector('.opt-cb') || !!card?.querySelector('#confirmBtn');

    return {
        text,
        options,
        imageUrls,
        isMultiple,
        questionType: 'choice',
        container: card || questionEl.parentElement
    };
}

export async function loadImages(urls: string[]): Promise<string[]> {
    const images = await Promise.all(urls.map(url => window.xdAnswers.imageToBase64(url)));
    return images.filter((img): img is string => img !== null);
}
