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
    inputIds: string[];
    questionType: 'dragdrop' | 'choice' | 'text';
}

let lastFields: HTMLElement[] = [];
let lastInputs: HTMLInputElement[] = [];

export function getLastFields(): HTMLElement[] {
    return lastFields;
}

export function getLastInputs(): HTMLInputElement[] {
    return lastInputs;
}

export function readQuestion(): MiyklasQuestionState | null {
    const dndFields = document.querySelectorAll<HTMLElement>('[id^="DND_FIELD_"]');
    const optionEls = document.querySelectorAll<HTMLElement>('[id^="OPTION_"]');

    const taskRoot = document.querySelector<HTMLElement>('.task, [class*="task"], #task-view, .exercise-content, .b-body') || document.body;

    const inputEls = Array.from(
        taskRoot.querySelectorAll<HTMLInputElement>(
            'input[type="text"], input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])'
        )
    ).filter(inp => {
        if (!inp.offsetParent && inp.getClientRects().length === 0) return false;
        if (inp.id && inp.id.startsWith('DND_')) return false;
        return true;
    });

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
        const genericQuestion = document.querySelector<HTMLElement>('.question-text, [data-testid="question"], .task, .exercise-content');
        if (!genericQuestion) return null;
        questionText = genericQuestion.innerText.trim();
    }

    if (!questionText) return null;

    // Store for answer-time use
    lastFields = fields;
    lastInputs = inputEls;

    // Detect and transcribe MathML / MathJax formulas
    const mathElements = document.querySelectorAll('math, .mathjax, [class*="math"], mjx-container');
    const hasMath = mathElements.length > 0;

    let fullText = questionText;

    if (inputEls.length > 0) {
        fullText += '\n\nПОЛЯ ДЛЯ ВВОДУ (заповни по порядку): ' + inputEls.map((inp, i) => `INPUT_${i + 1}`).join(', ');
    }

    if (options.length > 0) {
        fullText += '\n\nВаріанти відповідей:\n' + options.map(function(o) { return o.id + ': ' + o.text; }).join('\n');
    }

    if (hasMath) {
        fullText += '\n\n(Примітка: у питанні присутні математичні формули (MathJax/MathML). Відповідай, зберігаючи математичну нотацію. Дроби <mfrac><mi>a</mi><mi>b</mi></mfrac> = a/b, корені <msqrt>x</msqrt> = sqrt(x).)';
    }

    let qType: MiyklasQuestionState['questionType'] = 'text';
    if (fields.length > 0) qType = 'dragdrop';
    else if (options.length > 0) qType = 'choice';

    return {
        text: fullText,
        fields: fields.map(function(f) { return f.id; }),
        options: options,
        inputIds: inputEls.map(i => i.id || i.name || ''),
        questionType: qType
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
