// src/ui/draggable.js
// Draggable helper window module. Extracted from legacy utils.js (lines 1979-2054).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    interface DraggableInstance { destroy: () => void; }
    interface DragCoords { x: number; y: number; }

    window.xdAnswers.Draggable = (function() {
        let instance: DraggableInstance | null;
        function createDraggable(container: HTMLElement, handle: HTMLElement, onDragStartCallback?: () => void): DraggableInstance {
            let isDragging = false;
            let startX = 0, startY = 0, initialTop = 0, initialLeft = 0;

            const getCoords = (e: MouseEvent | TouchEvent): DragCoords => {
                if ('touches' in e && e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
                return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
            };

            function isInteractiveTarget(e: MouseEvent | TouchEvent): boolean {
                const path = e.composedPath ? e.composedPath() : [];
                const target = ((path.length > 0 ? path[0] : e.target) as HTMLElement) || null;
                if (!target || typeof target.closest !== 'function') return false;

                // 1. Buttons, dropdowns, inputs, links
                if (target.closest('button, select, option, a, input, textarea')) return true;

                // 2. Interactive tabs, collapsible headers, toggles
                if (target.closest('.xd-consensus-tabs, .xd-consensus-tab, .xd-thinking-header, .xd-search-header, .xd-calc-header, .xd-search-toggle, .xd-calc-toggle, .xd-thinking-toggle')) return true;

                // 3. Pointer cursor elements
                try {
                    const computed = window.getComputedStyle(target);
                    if (computed && computed.cursor === 'pointer') return true;
                } catch (err) {}

                // 4. Scrollbar interaction on scrollable content view
                if ('clientX' in e) {
                    const scrollable = target.closest<HTMLElement>('.app-view, .ollama-helper-content') || (target.scrollHeight > target.clientHeight ? target : null);
                    if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
                        const rect = scrollable.getBoundingClientRect();
                        if (e.clientX >= rect.left + scrollable.clientWidth) return true;
                    }
                }

                return false;
            }

            const onDragStart = (e: MouseEvent | TouchEvent) => {
                if (isInteractiveTarget(e)) return;
                e.preventDefault();
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

            const onDragMove = (e: MouseEvent | TouchEvent) => {
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

            const destroy = (): void => {
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
            init: function(c: HTMLElement, h: HTMLElement, cb?: () => void): void { if (instance) instance.destroy(); instance = createDraggable(c, h, cb); },
            destroy: function(): void { if (instance) { instance.destroy(); instance = null; } }
        };
    })();
})();
