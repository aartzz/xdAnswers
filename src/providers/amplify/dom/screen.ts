// src/providers/amplify/dom/screen.ts
// Locates the active Desmos screen inside the Amplify activity player.

export function currentScreen(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.dcg-student-screen.current-screen')
        || document.querySelector<HTMLElement>('.dcg-student-screen[aria-hidden="false"]')
        || document.querySelector<HTMLElement>('.dcg-student-screen:not([aria-hidden="true"])')
        || document.querySelector<HTMLElement>('.dcg-student-screen');
}

export function screenIdOf(screen: HTMLElement): string {
    const layout = screen.querySelector<HTMLElement>('.layout-top[data-screen-id]');
    return layout?.getAttribute('data-screen-id') || '';
}
