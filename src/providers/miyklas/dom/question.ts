// src/providers/miyklas/dom/question.ts
// Miyklas question extraction: DND fields, options, MathJax hint and images.

export interface MiyklasOption {
    id: string;
    text: string;
}

export interface MiyklasQuestionState {
    text: string;
    fields: string[];
    options: MiyklasOption[];
    questionType: 'dragdrop' | 'choice' | 'text';
}

let lastFields: HTMLElement[] = [];

export function getLastFields(): HTMLElement[] {
    return lastFields;
}

export function readQuestion(): MiyklasQuestionState | null {
    const dndFields = document.querySelectorAll<HTMLElement>('[id^="DND_FIELD_"]');
    const optionEls = document.querySelectorAll<HTMLElement>('[id^="OPTION_"]');

    let questionText = '';
    let fields: HTMLElement[] = [];
    let options: MiyklasOption[] = [];

    if (dndFields.length > 0) {
        fields = Array.from(dndFields);
        fields.forEach(function(field, idx) {
            questionText += field.innerText.trim();
            if (idx < fields.length - 1) questionText += ' ___ ';
        });
    }

    if (optionEls.length > 0) {
        options = Array.from(optionEls).map(function(el): MiyklasOption | null {
            const m = el.id.match(/OPTION_(\d+)/);
            return m ? { id: m[1], text: el.innerText.trim() } : null;
        }).filter((o): o is MiyklasOption => !!o);
    }

    if (!questionText) {
        const genericQuestion = document.querySelector<HTMLElement>('.question-text, [data-testid="question"], .task');
        if (!genericQuestion) return null;
        questionText = genericQuestion.innerText.trim();
    }

    if (!questionText) return null;

    // Store for answer-time use
    lastFields = fields;

    // Detect MathML / MathJax
    const mathElements = document.querySelectorAll('math, .mathjax, [class*="math"], mjx-container');
    const hasMath = mathElements.length > 0;

    let fullText = questionText;
    if (options.length > 0) {
        fullText += '\n\nВаріанти відповідей:\n' + options.map(function(o) { return o.id + ': ' + o.text; }).join('\n');
    }

    if (hasMath) {
        fullText += '\n\n(Примітка: у питанні присутні математичні формули (MathJax). Відповідай, зберігаючи математичну нотацію.)';
    }

    return {
        text: fullText,
        fields: fields.map(function(f) { return f.id; }),
        options: options,
        questionType: fields.length > 0 ? 'dragdrop' : (options.length > 0 ? 'choice' : 'text')
    };
}

export function loadImages(): Promise<string[]> {
    const imgPromises: Array<Promise<string | null>> = [];
    document.querySelectorAll<HTMLImageElement>('img').forEach(function(img) {
        if (img.src) imgPromises.push(window.xdAnswers.imageToBase64(img.src));
    });
    return Promise.all(imgPromises).then(function(images) {
        return images.filter(function(img): img is string { return img !== null; });
    });
}
