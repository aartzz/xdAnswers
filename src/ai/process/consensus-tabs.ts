// src/ai/process/consensus-tabs.ts
// Builds the consensus tab strip and tab contents (scroll, drag, click) inside the answer panel.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    I.buildConsensusTabs = function(answerContentDiv: HTMLElement, runs: XdConsensusRun[], setActiveTab: (tabIndex: number, shouldUpdateFooter: boolean) => void): void {
        const tabsHtml = '<div class="xd-consensus-tabs">' + runs.map((run, index) => {
            const modelName = run.model || window.xdAnswers.settings.model || 'model';
            return '<div class="xd-consensus-tab' + (index === 0 ? ' active' : '') + '" data-tab="' + index + '" data-model-name="' + I.escapeHTML(modelName) + '"><span class="xd-tab-spinner"></span> ' + I.escapeHTML(modelName) + '</div>';
        }).join('') + '</div>';

        const contentHtml = runs.map((run, index) => {
            return '<div class="xd-tab-content' + (index === 0 ? ' active-tab' : '') + '" data-tab="' + index + '"><div class="xd-loader"></div></div>';
        }).join('');

        answerContentDiv.innerHTML = tabsHtml + contentHtml;

        const tabButtons = Array.from(answerContentDiv.querySelectorAll('.xd-consensus-tab'));
        // Drag-to-scroll state shared with click handler
        let _tabDragMoved = false;
        tabButtons.forEach((tabButton, index) => {
            tabButton.addEventListener('click', function() {
                if (_tabDragMoved) { _tabDragMoved = false; return; } // was a drag, not a click
                setActiveTab(index, true);
            });
        });

        // Horizontal scroll: mouse wheel + drag-to-scroll
        const tabsContainer = answerContentDiv.querySelector<HTMLElement>('.xd-consensus-tabs');
        if (tabsContainer) {
            // Wheel → horizontal scroll
            tabsContainer.addEventListener('wheel', function(this: HTMLElement, e: WheelEvent) {
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // already horizontal
                const hasScroll = this.scrollWidth > this.clientWidth;
                if (!hasScroll) return;
                e.preventDefault();
                this.scrollLeft += e.deltaY;
            }, { passive: false });

            // Drag-to-scroll (works on tabs too — distinguishes drag vs click by distance)
            let dragState: { startX: number; scrollLeft: number; moved: boolean } | null = null;
            tabsContainer.addEventListener('mousedown', function(this: HTMLElement, e: MouseEvent) {
                dragState = { startX: e.pageX, scrollLeft: this.scrollLeft, moved: false };
                this.style.cursor = 'grabbing';
            });
            document.addEventListener('mousemove', function(e: MouseEvent) {
                if (!dragState) return;
                const dx = e.pageX - dragState.startX;
                if (Math.abs(dx) > 5) dragState.moved = true;
                if (dragState.moved) {
                    tabsContainer.scrollLeft = dragState.scrollLeft - dx;
                }
            });
            document.addEventListener('mouseup', function() {
                if (!dragState) return;
                _tabDragMoved = dragState.moved;
                dragState = null;
                tabsContainer.style.cursor = '';
            });
        }
    };
})();
