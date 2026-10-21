// src/providers/naurok/dom/beta/main.ts
// Naurok test-beta (React) extraction. Handles every question renderer the
// stage can show: quiz/multiquiz, short/numeric, fill, dropdown, order, match,
// categorize, true/false grid and the hangman/anagram word modes.
//
// The stage is React-controlled, so extraction refuses to run while the answer
// feedback, image zoom or fullscreen gate is on screen. That keeps the AI from
// reading a half-swapped question during the answer animation.
const BETA_OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface NaurokBetaQuestionState {
    questionText: string;
    optionsText: string;
    validImages: string[];
    isMultiQuiz: boolean;
    questionType: string;
    questionKey: string;
}

interface BetaSessionOption {
    value?: string;
    image?: string | null;
}

interface BetaSessionQuestion {
    id?: number;
    type?: string;
    content?: string;
    image?: string | null;
    mode?: { kind?: string } | null;
    options?: BetaSessionOption[];
    left?: BetaSessionOption[];
    right?: BetaSessionOption[];
    categories?: BetaSessionOption[];
    choices?: Record<string, BetaSessionOption[]>;
    blanks?: (number | string)[];
}

interface BetaSessionPayload {
    document?: { name?: string };
    session?: { name?: string };
    questions?: BetaSessionQuestion[];
}

let betaSession: BetaSessionPayload | null = null;

export function setBetaSession(payload: unknown): void {
    if (!payload || typeof payload !== 'object') return;
    const p = payload as BetaSessionPayload;
    if (Array.isArray(p.questions)) betaSession = p;
}

export function isBetaTest(): boolean {
    return !!document.querySelector('#tb-app[data-mode]') || /^\/test-beta\/(?:play|result)\//.test(location.pathname);
}

function normalize(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function readText(root: Element | null): string {
    if (!root) return '';
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode(' ')));
    clone.querySelectorAll('p, div, li, tr, h1, h2, h3, h4, h5, h6').forEach(node => node.append(' '));
    return normalize(clone.textContent || '');
}

function stripHtml(html: string | undefined): string {
    if (!html) return '';
    const holder = document.createElement('div');
    holder.innerHTML = html;
    return readText(holder);
}

function isVisible(el: Element | null): boolean {
    if (!el) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    const he = el as HTMLElement;
    return he.getClientRects().length > 0;
}

function questionStage(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.tb-stagebox') || document.querySelector<HTMLElement>('#tb-app');
}

function questionRoot(stage: HTMLElement): HTMLElement | null {
    return stage.querySelector<HTMLElement>('.tb-question');
}

function questionNumber(stage: HTMLElement): number {
    const text = normalize(stage.querySelector('.tb-question-num')?.textContent || '');
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

function isAnswerAnimation(stage: HTMLElement): boolean {
    if (stage.querySelector('.tb-feedback, .tb-zoom')) return true;
    if (document.querySelector('.tb-loader-dots, .tb-plus')) return true;
    const gate = document.querySelector('.tb-focus');
    return !!gate && isVisible(gate);
}

function sessionQuestion(stage: HTMLElement): BetaSessionQuestion | null {
    const questions = betaSession && betaSession.questions;
    if (!questions || !questions.length) return null;
    const num = questionNumber(stage);
    if (num >= 1 && num <= questions.length) return questions[num - 1];
    return null;
}

function imageUrl(img: HTMLImageElement): string {
    return img.currentSrc || img.src || '';
}

function collectImages(root: Element | null): string[] {
    if (!root) return [];
    const urls: string[] = [];
    root.querySelectorAll<HTMLImageElement>('img').forEach(img => {
        const src = imageUrl(img);
        if (src && !src.startsWith('data:image/gif') && !src.startsWith('data:image/svg')) urls.push(src);
    });
    return urls;
}

function optionText(el: Element | null): string {
    if (!el) return '';
    const clone = (el.cloneNode(true) as HTMLElement);
    if (clone.classList.contains('tb-arcade-opt')) clone.querySelector('b')?.remove();
    clone.querySelectorAll(
        '.tb-answer-key, .tb-answer-tick, .tb-match-badge, .tb-order-num, ' +
        '.tb-order-tools, .tb-order-mark, .tb-tf-btns, .tb-fill-wrap'
    ).forEach(node => node.remove());
    const text = readText(clone);
    return text || (el.querySelector('img') ? '[зображення]' : '');
}
function optionImages(el: Element | null): string[] {
    return el ? collectImages(el) : [];
}

function uniqueImages(...groups: string[][]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    groups.forEach(group => group.forEach(src => {
        if (src && !seen.has(src)) {
            seen.add(src);
            out.push(src);
        }
    }));
    return out;
}

// Fill/dropdown renderers portal inputs into empty spans inside the question
// HTML. Rebuild the sentence with [A0]/[A0: choice] markers so the AI sees the
// blank positions instead of a sentence with holes in it.
function fillQuestionText(stage: HTMLElement, dropdown: boolean): string {
    const textEl = stage.querySelector('.tb-question-text');
    if (!textEl) return '';
    const clone = textEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.tb-fill-slot').forEach((slot, index) => {
        // data-blank is the original [[n]] order (1-based); the AI prompt and
        // the apply step use zero-based A0/A1 keys, so use the DOM order.
        const key = index;
        const select = slot.querySelector('select');
        if (dropdown && select) {
            const choices = Array.from(select.options)
                .filter(option => option.value !== '')
                .map(option => normalize(option.textContent))
                .filter(Boolean);
            slot.replaceWith(document.createTextNode(`[A${key}: ${choices.join(' | ')}]`));
        } else {
            slot.replaceWith(document.createTextNode(`[A${key}]`));
        }
    });
    return readText(clone);
}

function detectType(stage: HTMLElement, q: BetaSessionQuestion | null): string {
    // A plain quiz also carries mode.kind="quiz"; only let the session payload
    // override the DOM for the special renderers it alone identifies.
    if (q && q.mode && q.mode.kind && q.mode.kind !== 'quiz') return q.mode.kind;
    if (stage.querySelector('.tb-mode-hang')) return 'hangman';
    if (stage.querySelector('.tb-mode-anagram')) return 'anagram';
    if (stage.querySelector('.tb-order')) return 'order';
    if (stage.querySelector('.tb-match')) return 'match';
    if (stage.querySelector('.tb-cat-groups')) return 'categorize';
    if (stage.querySelector('.tb-tf-list')) return 'tfgrid';
    if (stage.querySelector('.tb-fill-select')) return 'dropdown';
    if (stage.querySelector('.tb-fill-input')) return 'fill';
    if (stage.querySelector('.tb-holes .tb-mole')) return 'whack';
    if (stage.querySelector('.tb-mode-show')) return 'show';
    if (stage.querySelector('.tb-sky')) return 'plane';
    if (stage.querySelector('.tb-maze')) return 'maze';
    if (stage.querySelector('.tb-answers .tb-answer')) {
        return stage.querySelector('.tb-answer-tick') ? 'multiquiz' : 'quiz';
    }
    if (stage.querySelector('input.tb-big-input')) return 'short';
    return q && q.type ? q.type : 'quiz';
}

function aiQuestionType(type: string): string {
    switch (type) {
        case 'multiquiz': return 'multiquiz';
        case 'quiz':
        case 'show':
        case 'whack': return 'quiz';
        case 'short':
        case 'numeric':
        case 'hangman':
        case 'anagram': return 'short_text';
        case 'fill': return 'fill_blank';
        case 'dropdown': return 'select_in_text';
        case 'order': return 'order_words';
        case 'match': return 'match_pairs';
        case 'categorize': return 'categorization';
        case 'tfgrid': return 'true_false_multi';
        default: return 'quiz';
    }
}

function choicesText(stage: HTMLElement): { text: string; images: string[]; multi: boolean } {
    const answers = Array.from(stage.querySelectorAll<HTMLElement>('.tb-answers .tb-answer, .tb-holes .tb-mole'))
        .filter(isVisible);
    if (!answers.length) {
        const arcade = Array.from(stage.querySelectorAll<HTMLElement>('.tb-arcade-legend .tb-arcade-opt'))
            .filter(isVisible);
        if (!arcade.length) return { text: '', images: [], multi: false };
        const text = arcade.map((option, index) => {
            const label = option.querySelector('b')?.textContent?.trim() || BETA_OPTION_LABELS[index] || String(index + 1);
            return `${label}: ${optionText(option) || '[зображення]'}`;
        }).join('\n');
        const images = arcade.flatMap(option => optionImages(option));
        return { text, images, multi: false };
    }
    const text = answers.map((answer, index) => {
        const label = answer.querySelector('.tb-answer-key')?.textContent?.trim() || BETA_OPTION_LABELS[index] || String(index + 1);
        return `${label}: ${optionText(answer) || '[зображення]'}`;
    }).join('\n');
    const images = answers.flatMap(answer => optionImages(answer));
    const multi = !!stage.querySelector('.tb-answer-tick') ||
        (!!stage.querySelector('.tb-mode-whack') && !!stage.querySelector('.tb-submit-row'));
    return { text, images, multi };
}

function orderText(stage: HTMLElement): string {
    const items = Array.from(stage.querySelectorAll('.tb-order .tb-order-item'));
    return items.map((item, index) => {
        const body = item.querySelector('.tb-order-body') || item;
        const text = optionText(body);
        return `${index + 1}. ${text === '[зображення]' ? `[зображення ${index + 1}]` : text}`;
    }).join('\n');
}

function matchText(stage: HTMLElement): { text: string; images: string[] } {
    const cols = stage.querySelectorAll('.tb-match .tb-match-col');
    const left = Array.from(cols[0]?.querySelectorAll('.tb-match-card') || []);
    const right = Array.from(cols[1]?.querySelectorAll('.tb-match-card') || []);
    const rows = left.map((card, index) => {
        const text = optionText(card);
        return `${index + 1}. ${text === '[зображення]' ? `[зображення ${index + 1}]` : text}`;
    });
    const variants = right.map((card, index) => {
        const label = BETA_OPTION_LABELS[index] || String(index + 1);
        const text = optionText(card);
        return `${label}: ${text === '[зображення]' ? `[зображення ${index + 1}]` : text}`;
    });
    const images = [...left, ...right].flatMap(card => optionImages(card));
    return {
        text: 'Рядки:\n' + rows.join('\n') + '\n\nВаріанти:\n' + variants.join('\n'),
        images
    };
}

function categorizeText(stage: HTMLElement): { text: string; images: string[] } {
    const chips = Array.from(stage.querySelectorAll('.tb-cat-pool .tb-cat-chip'))
        .filter(isVisible);
    const groups = Array.from(stage.querySelectorAll('.tb-cat-group'));
    const items = chips.map(chip => optionText(chip)).filter(Boolean);
    const categories = groups.map(group => normalize(group.querySelector('.tb-cat-title')?.textContent || '')).filter(Boolean);
    const images = chips.flatMap(chip => optionImages(chip));
    return {
        text: 'Елементи:\n' + items.join('\n') + '\n\nКатегорії:\n' + categories.join('\n'),
        images
    };
}

function trueFalseText(stage: HTMLElement): string {
    const rows = Array.from(stage.querySelectorAll('.tb-tf-row'));
    return rows.map((row, index) => {
        const text = optionText(row.querySelector('.tb-tf-text') || row);
        return `${index + 1}. ${text}`;
    }).join('\n');
}

function wordModeText(stage: HTMLElement, hangman: boolean): string {
    const word = normalize(stage.querySelector('.tb-word')?.textContent || '');
    const parts: string[] = [];
    if (hangman) {
        const lives = stage.querySelectorAll('.tb-life:not(.is-lost)').length;
        parts.push(`Слово: ${word || '—'}`);
        if (lives) parts.push(`Залишилось спроб: ${lives}`);
    } else {
        const tiles = Array.from(stage.querySelectorAll('.tb-tiles .tb-tile'))
            .map(tile => normalize(tile.textContent))
            .filter(Boolean);
        if (tiles.length) parts.push(`Літери: ${tiles.join(' ')}`);
        parts.push(`Слово: ${word || '—'}`);
    }
    return parts.join('\n');
}

function questionText(stage: HTMLElement, type: string, q: BetaSessionQuestion | null): string {
    if (type === 'fill' || type === 'dropdown') {
        const text = fillQuestionText(stage, type === 'dropdown');
        if (text) return text;
    }
    const textEl = stage.querySelector('.tb-question-text');
    const text = readText(textEl);
    if (text) return text;
    return stripHtml(q?.content);
}

function questionImages(stage: HTMLElement, q: BetaSessionQuestion | null): string[] {
    const root = questionRoot(stage);
    const textEls = Array.from(stage.querySelectorAll('.tb-question-text'));
    const dom = [
        ...collectImages(root),
        ...textEls.flatMap(el => collectImages(el))
    ];
    const session: string[] = [];
    if (q && q.image) session.push(q.image);
    (q && q.options || []).forEach(option => { if (option.image) session.push(option.image); });
    (q && q.left || []).forEach(option => { if (option.image) session.push(option.image); });
    (q && q.right || []).forEach(option => { if (option.image) session.push(option.image); });
    return uniqueImages(dom, session);
}

export function getBetaQuestionState(): NaurokBetaQuestionState | null {
    if (!isBetaTest()) return null;
    const stage = questionStage();
    if (!stage || !questionRoot(stage)) return null;
    if (isAnswerAnimation(stage)) return null;

    const q = sessionQuestion(stage);
    const type = detectType(stage, q);
    const text = questionText(stage, type, q);
    const choices = choicesText(stage);

    let optionsText = choices.text;
    let optionImages = choices.images;
    let isMultiQuiz = choices.multi;
    let images = questionImages(stage, q);

    if (type === 'fill') {
        const inputs = stage.querySelectorAll('.tb-fill-input');
        if (inputs.length) optionsText = 'Пропуски: ' + Array.from(inputs).map((_, index) => `A${index}`).join(', ');
    } else if (type === 'dropdown') {
        const selects = stage.querySelectorAll('.tb-fill-select');
        if (selects.length) optionsText = 'Пропуски: ' + Array.from(selects).map((_, index) => `A${index}`).join(', ');
    } else if (type === 'order') {
        optionsText = orderText(stage);
    } else if (type === 'match') {
        const match = matchText(stage);
        optionsText = match.text;
        optionImages = match.images;
    } else if (type === 'categorize') {
        const categorize = categorizeText(stage);
        optionsText = categorize.text;
        optionImages = categorize.images;
    } else if (type === 'tfgrid') {
        optionsText = trueFalseText(stage);
    } else if (type === 'hangman' || type === 'anagram') {
        optionsText = wordModeText(stage, type === 'hangman');
    } else if (type === 'short' || type === 'numeric') {
        const input = stage.querySelector<HTMLInputElement>('input.tb-big-input');
        optionsText = input && input.placeholder ? `Поле відповіді (${input.placeholder})` : 'Поле відповіді';
    }

    images = uniqueImages(images, optionImages);
    if (!text && !optionsText && !images.length) return null;

    const num = questionNumber(stage);
    // DOM-derived key: stable before/after the session payload arrives, so a
    // late payload cannot make the provider reprocess the same question.
    const key = `n${num}|${normalize(text).slice(0, 80)}|${type}`;

    return {
        questionText: text || (images.length ? '[запитання-зображення]' : ''),
        optionsText,
        validImages: images,
        isMultiQuiz,
        questionType: aiQuestionType(type),
        questionKey: key
    };
}

export function betaQuestionContainer(): HTMLElement | null {
    return questionStage();
}
