// src/providers/szkolawchmurze/dom/images.ts
// Szkola w Chmurze image loading: converts question image URLs to base64 data.
export function loadImages(urls: string[]): Promise<string[]> {
    return Promise.all(urls.map(url => window.xdAnswers.imageToBase64(url)))
        .then(images => images.filter((img): img is string => img !== null));
}
