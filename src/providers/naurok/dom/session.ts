// src/providers/naurok/dom/session.ts
// Naurok scene state and numeric session ID detection.

// naurok scene==1 shows the question, scene==2 plays the "answer accepted"
// animation and scene==3 is the finished test.
export function getSceneBlocked(): boolean {
    const scene1 = document.querySelector('[ng-show="test.scene == 1"]');
    const scene2 = document.querySelector('[ng-show="test.scene == 2"]');
    const scene3 = document.querySelector('[ng-show="test.scene == 3"]');
    const isAnimationActive = scene2 && !scene2.classList.contains('ng-hide');
    const isTestEnded = scene3 && !scene3.classList.contains('ng-hide');
    if (isAnimationActive || isTestEnded) return true;
    if (scene1 && scene1.classList.contains('ng-hide')) return true;
    return false;
}

// Angular puts ng-init="init(settings_id, session_id, account_id)" on the root
// element; the second argument is the numeric session ID used by the API.
export function parseSessionIdFromDOM(): number | null {
    const el = document.querySelector('[ng-init*="init("]');
    if (!el) return null;
    const ngInit = el.getAttribute('ng-init') || '';
    const match = ngInit.match(/init\s*\(\s*\d+\s*,\s*(\d+)\s*,/);
    if (match) {
        const sid = parseInt(match[1], 10);
        console.log('[xdAnswers/naurok] Session ID from ng-init:', sid);
        return sid;
    }
    return null;
}
