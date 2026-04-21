// src/ui/draggable.js
// Draggable helper window module. Extracted from legacy utils.js (lines 1979-2054).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    window.xdAnswers.Draggable = (function() {
        let instance;
        function createDraggable(container, handle, onDragStartCallback) {
            let isDragging = false;
            let startX, startY, initialTop, initialLeft;

            const getCoords = (e) => {
                if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
                return { x: e.clientX, y: e.clientY };
            };

            const onDragStart = (e) => {
                if (e.target.tagName === 'BUTTON' || (e.target.parentElement && e.target.parentElement.tagName === 'BUTTON')) return;
                if (e.type === 'touchstart') e.preventDefault();
                isDragging = true;
                if (onDragStartCallback) onDragStartCallback();
                const coords = getCoords(e);
                const rect = container.getBoundingClientRect();
                initialTop = rect.top; initialLeft = rect.left;
                startX = coords.x; startY = coords.y;
                container.style.top = initialTop + 'px'; container.style.left = initialLeft + 'px';
                container.style.right = 'auto'; container.style.bottom = 'auto';
                // Clear any centering transform so the drag origin matches rect coords
                container.style.transform = '';
                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('touchmove', onDragMove, { passive: false });
                document.addEventListener('mouseup', onDragEnd, { once: true });
                document.addEventListener('touchend', onDragEnd, { once: true });
            };

            const onDragMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const coords = getCoords(e);
                container.style.transform = 'translate(' + (coords.x - startX) + 'px, ' + (coords.y - startY) + 'px)';
            };

            const onDragEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('touchmove', onDragMove);
                const t = new DOMMatrix(getComputedStyle(container).transform);
                container.style.transform = '';
                const finalTop = (initialTop + t.m42) + 'px';
                const finalLeft = (initialLeft + t.m41) + 'px';
                container.style.top = finalTop;
                container.style.left = finalLeft;
                // Persist coords when user opted in
                try {
                    const s = window.xdAnswers.settings;
                    if (s && s.rememberDragPosition) {
                        s.savedPosition = { top: finalTop, left: finalLeft };
                        chrome.storage.local.set({ xdAnswers_settings: JSON.stringify(s) });
                    }
                } catch (e) {}
            };

            const destroy = () => {
                handle.removeEventListener('mousedown', onDragStart);
                handle.removeEventListener('touchstart', onDragStart);
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('touchmove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd);
                document.removeEventListener('touchend', onDragEnd);
            };

            handle.addEventListener('mousedown', onDragStart);
            handle.addEventListener('touchstart', onDragStart, { passive: false });
            return { destroy };
        }
        return {
            init: function(c, h, cb) { if (instance) instance.destroy(); instance = createDraggable(c, h, cb); },
            destroy: function() { if (instance) { instance.destroy(); instance = null; } }
        };
    })();
})();
