// Page-world helper for naurok.ua/round/* — reorders ng-sortable answer lists
// through the Angular scope, since the content script cannot reach it directly.
(function () {
    'use strict';
    if (window.__xdNaurokRoundPage) return;
    window.__xdNaurokRoundPage = true;

    function norm(s) {
        return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
    }

    window.addEventListener('message', function (e) {
        const d = e.data;
        if (!d || d.source !== 'xd-naurok' || d.cmd !== 'reorder') return;

        let ok = false;
        let detail = '';
        try {
            const angular = window.angular;
            if (!angular) throw new Error('angular not found');

            const lists = Array.from(document.querySelectorAll('ul.sth-answer-control-order'));
            let list = lists.find(l => l.offsetParent !== null) || lists[0];
            if (!list) throw new Error('order list not found');

            let scope = null;
            for (let el = list; el; el = el.parentElement) {
                const s = angular.element(el).scope();
                if (s && s.tempAnswer && s.question && typeof s.question.setAnswer === 'function') {
                    scope = s;
                    break;
                }
            }
            if (!scope) throw new Error('angular scope not found');

            const current = scope.tempAnswer.data;
            if (!Array.isArray(current)) throw new Error('tempAnswer.data is not an array');

            const used = new Set();
            const out = [];
            for (const raw of (d.order || [])) {
                const want = norm(raw);
                if (!want) continue;
                let hit = current.find((a, i) => !used.has(i) && norm(a && a.value) === want);
                if (!hit) hit = current.find((a, i) => !used.has(i) && norm(a && a.value).includes(want));
                if (!hit) hit = current.find((a, i) => !used.has(i) && want.includes(norm(a && a.value)));
                if (hit) {
                    used.add(current.indexOf(hit));
                    out.push(hit);
                }
            }
            for (let i = 0; i < current.length; i++) {
                if (!used.has(i)) out.push(current[i]);
            }

            scope.$apply(function () {
                current.splice(0, current.length);
                for (const item of out) current.push(item);
                scope.question.setAnswer(current);
            });
            ok = true;
        } catch (err) {
            detail = String((err && err.message) || err);
        }

        window.postMessage({ source: 'xd-naurok-page', cmd: 'reorder-result', requestId: d.requestId, ok: ok, detail: detail }, '*');
    });
})();
