// src/providers/kahoot/dom/images.ts
// Kahoot image loading: converts question image URLs to base64 data.
export async function loadImages(urls: string[]): Promise<string[]> {
    const images = await Promise.all(urls.map(url => window.xdAnswers.imageToBase64(url)));
    return images.filter((img): img is string => img !== null);
}
