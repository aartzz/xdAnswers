// src/providers/naurok/dom/beta-arcade.ts
// Best-effort drivers for the two timed test-beta arcade renderers. Both games
// submit automatically when the plane reaches a cloud or the runner reaches a
// lettered zone, so the answer is applied by steering instead of clicking a
// normal option button.

const I = (() => {
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);
    return window.xdAnswers._internal;
})();
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function normalize(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function findArcadeIndex(answerText: string, options: HTMLElement[]): number {
    if (!options.length) return -1;
    const matched = I.matchAnswerToOptions(answerText, options);
    if (matched.length) {
        const index = options.indexOf(matched[0] as HTMLElement);
        if (index >= 0) return index;
    }
    const wanted = normalize(answerText);
    const index = options.findIndex(option => {
        const text = normalize(option.textContent);
        return text === wanted || text.includes(wanted) || wanted.includes(text);
    });
    return index;
}

async function applyPlane(answerText: string, stage: HTMLElement): Promise<void> {
    const options = Array.from(stage.querySelectorAll<HTMLElement>('.tb-arcade-legend .tb-arcade-opt'));
    const chosen = findArcadeIndex(answerText, options);
    if (chosen < 0) return;

    const gate = stage.querySelector<HTMLButtonElement>('.tb-arcade-gate button');
    if (gate) gate.click();
    for (let attempt = 0; attempt < 15 && stage.querySelector('.tb-arcade-gate'); attempt++) {
        await wait(60);
    }

    let lane = -1;
    for (let attempt = 0; attempt < 20 && lane < 0; attempt++) {
        const clouds = Array.from(stage.querySelectorAll<HTMLElement>('.tb-cloud'));
        lane = clouds.findIndex(cloud => {
            const text = normalize(cloud.textContent);
            const wanted = normalize(options[chosen].textContent);
            return text === wanted || text.includes(wanted) || wanted.includes(text);
        });
        if (lane < 0) await wait(50);
    }
    if (lane < 0) lane = chosen;

    const lanes = stage.querySelectorAll<HTMLButtonElement>('.tb-lane');
    if (lanes[lane]) lanes[lane].click();

    // The cloud takes about 6.5s to reach the plane. Wait for the auto-submit
    // feedback so the next question is not read while the game is still live.
    for (let attempt = 0; attempt < 100; attempt++) {
        if (stage.querySelector('.tb-feedback')) return;
        await wait(100);
    }
}

function mazePath(cells: HTMLElement[], start: number, target: number): string[] {
    const size = Math.sqrt(cells.length);
    if (!Number.isInteger(size) || start < 0 || target < 0) return [];
    const prev = new Int32Array(cells.length).fill(-1);
    prev[start] = start;
    const queue = [start];
    const moves: Array<[number, number, string]> = [
        [-1, 0, 'ArrowUp'],
        [1, 0, 'ArrowDown'],
        [0, -1, 'ArrowLeft'],
        [0, 1, 'ArrowRight']
    ];
    while (queue.length) {
        const current = queue.shift()!;
        if (current === target) break;
        const row = Math.floor(current / size);
        const col = current % size;
        for (const [dr, dc, key] of moves) {
            const nextRow = row + dr;
            const nextCol = col + dc;
            if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue;
            const next = nextRow * size + nextCol;
            if (prev[next] !== -1 || cells[next].classList.contains('is-wall')) continue;
            prev[next] = current;
            queue.push(next);
        }
    }
    if (prev[target] === -1) return [];
    const keys: string[] = [];
    let node = target;
    while (node !== start) {
        const parent = prev[node];
        const dr = Math.floor(node / size) - Math.floor(parent / size);
        const dc = (node % size) - (parent % size);
        keys.push(dr === -1 ? 'ArrowUp' : dr === 1 ? 'ArrowDown' : dc === -1 ? 'ArrowLeft' : 'ArrowRight');
        node = parent;
    }
    return keys.reverse();
}

function pressKey(key: string): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

async function applyMaze(answerText: string, stage: HTMLElement): Promise<void> {
    const options = Array.from(stage.querySelectorAll<HTMLElement>('.tb-arcade-legend .tb-arcade-opt'));
    const chosen = findArcadeIndex(answerText, options);
    if (chosen < 0) return;
    const letter = (options[chosen].querySelector('b')?.textContent || LABELS[chosen] || '').trim().toUpperCase();
    if (!letter) return;

    const gate = stage.querySelector<HTMLButtonElement>('.tb-arcade-gate button');
    if (gate) gate.click();
    for (let attempt = 0; attempt < 15 && stage.querySelector('.tb-arcade-gate'); attempt++) {
        await wait(60);
    }

    for (let attempt = 0; attempt < 2; attempt++) {
        const cells = Array.from(stage.querySelectorAll<HTMLElement>('.tb-maze-cell'));
        if (!cells.length) return;
        const start = cells.findIndex(cell => cell.querySelector('.tb-maze-me'));
        const target = cells.findIndex(cell =>
            cell.classList.contains('is-zone') && normalize(cell.textContent).toUpperCase().startsWith(letter)
        );
        const keys = mazePath(cells, start, target);
        if (!keys.length) return;
        for (const key of keys) {
            pressKey(key);
            await wait(70);
        }
        for (let check = 0; check < 25; check++) {
            if (stage.querySelector('.tb-feedback')) return;
            if (stage.querySelector('.tb-maze.is-caught')) break;
            await wait(80);
        }
        // A ghost caught the runner; the player is back at the start, so try
        // one more path after the catch animation resets.
        await wait(250);
    }
}

export function applyArcadeAnswer(answerText: string, stage: HTMLElement): void {
    if (stage.querySelector('.tb-sky')) {
        void applyPlane(answerText, stage);
    } else if (stage.querySelector('.tb-maze')) {
        void applyMaze(answerText, stage);
    }
}
