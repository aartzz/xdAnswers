// src/ui/helper/mount.ts
// Helper window DOM creation, parent attachment and default or saved positioning.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    window.xdAnswers.createUI = function(): void {
        if (window.xdAnswers.helperContainer) return;

        // Host element in light DOM: randomized class, no id, empty light children.
        // Page scripts running querySelector or innerText cannot detect or inspect it.
        const host = document.createElement('div');
        const randId = '_' + Math.random().toString(36).slice(2, 9);
        host.className = randId;
        host.style.setProperty('position', 'fixed', 'important');
        host.style.setProperty('z-index', '2147483647', 'important');
        host.style.setProperty('margin', '0', 'important');
        host.style.setProperty('padding', '0', 'important');
        host.style.setProperty('border', 'none', 'important');
        host.style.setProperty('box-sizing', 'border-box', 'important');
        host.style.setProperty('display', 'flex', 'important');

        // Closed Shadow Root: completely impenetrable by page-world scripts
        const shadow = host.attachShadow({ mode: 'closed' });
        window.xdAnswers.shadowRoot = shadow;

        const innerCard = document.createElement('div');
        innerCard.className = 'ollama-helper-container';
        innerCard.innerHTML =
            '<div class="ollama-helper-header" id="ollama-helper-drag-header">' +
            '<span class="ollama-header-title">Assistant <small class="xd-version"></small></span>' +
            '<div class="ollama-header-buttons">' +
            '<button id="silent-mode-btn" title="Silent mode: Off"><span class="xd-icon">close</span></button>' +
            '<select id="silent-mode-inline-select" title="Silent mode">' +
            '<option value="">Off</option>' +
            '<option value="indicators">Indicators</option>' +
            '<option value="ghost">Page title</option>' +
            '<option value="stealth">Stealth</option>' +
            '<option value="oneclick">One-click</option>' +
            '</select>' +
            '<button id="refresh-answer-btn" title="Refresh"><span class="xd-icon">refresh</span></button>' +
            '</div></div>' +
            '<div class="ollama-helper-content" id="ollama-answer-content">Waiting for question...</div>' +
            '<div class="ollama-helper-footer" id="ollama-helper-footer">' +
            '<span class="xd-footer-elapsed" id="xd-footer-elapsed"></span>' +
            '<span class="xd-footer-model" id="xd-footer-model"></span>' +
            '<button class="xd-footer-copy" id="copy-answer-btn" title="Copy answer"><span class="xd-icon">content_copy</span></button>' +
            '</div>';

        shadow.appendChild(innerCard);

        // Delegate querySelector calls on the host wrapper to the shadow root so internal modules work seamlessly
        host.querySelector = function<E extends Element = Element>(selectors: string): E | null {
            return shadow.querySelector<E>(selectors);
        };
        host.querySelectorAll = function<E extends Element = Element>(selectors: string): NodeListOf<E> {
            return shadow.querySelectorAll<E>(selectors);
        };

        window.xdAnswers.helperContainer = host;
        window.xdAnswers.answerContentDiv = shadow.querySelector<HTMLElement>('#ollama-answer-content');
        window.xdAnswers.dragHeader = shadow.querySelector<HTMLElement>('#ollama-helper-drag-header');

        window.xdAnswers.attachHelperEventListeners();
        window.xdAnswers.updateHelperBaseStyles();

        // Set current model name in footer
        const footerModelEl = shadow.querySelector('#xd-footer-model');
        if (footerModelEl) footerModelEl.innerHTML = (window.xdAnswers.settings.model || 'select model') + ' <span class="xd-icon" style="font-size:12px !important;vertical-align:baseline;">north_east</span>';
        // Set version string in header
        const versionEl = shadow.querySelector('.xd-version');
        if (versionEl) versionEl.textContent = I.getVersionString();
    };

    window.xdAnswers.attachAndPositionHelper = function(targetContainerOverride?: HTMLElement): void {
        if (window.xdAnswers.isExtensionModifyingDOM) return;
        window.xdAnswers.isExtensionModifyingDOM = true;

        window.xdAnswers.createUI();
        const container = window.xdAnswers.helperContainer!;

        if (window.xdAnswers.settings.silentMode && window.xdAnswers.settings.silentMode !== '') {
            container.style.setProperty('display', 'none', 'important');
            I.addSilentExitButton();
            window.xdAnswers.isExtensionModifyingDOM = false;
            return;
        }
        container.style.setProperty('display', 'flex', 'important');

        let targetParent: HTMLElement = targetContainerOverride || document.body;

        if (!targetContainerOverride && location.hostname.includes('vseosvita.ua') &&
            (location.pathname.includes('/test/go-olp') || location.pathname.startsWith('/test/start/'))) {
            targetParent = document.body;
        }

        // When an element is in fullscreen mode, append helper to it
        // so it renders on top of the fullscreen layer instead of behind it
        if (!targetContainerOverride && document.fullscreenElement) {
            targetParent = document.fullscreenElement as HTMLElement;
        }

        if (!container.parentNode || container.parentNode !== targetParent) {
            if (container.parentNode) container.parentNode.removeChild(container);
            targetParent.appendChild(container);
            window.xdAnswers.isManuallyPositioned = false;
        }
        window.xdAnswers.currentHelperParentNode = targetParent;
        window.xdAnswers.updateHelperBaseStyles();

        if (!window.xdAnswers.isManuallyPositioned) {
            const isMax = window.xdAnswers.isHelperWindowMaximized;
            if (isMax) {
                Object.assign(container.style, { top: I.maximizedHelperState.top, left: I.maximizedHelperState.left, bottom: 'auto', right: 'auto', transform: '' });
            } else {
                const s = window.xdAnswers.settings || ({} as XdSettings);
                // Prefer saved drag coords only when user enabled remember-drag
                if (s.rememberDragPosition && s.savedPosition && typeof s.savedPosition.top === 'string' && typeof s.savedPosition.left === 'string') {
                    Object.assign(container.style, { top: s.savedPosition.top, left: s.savedPosition.left, bottom: 'auto', right: 'auto', transform: '' });
                } else {
                    const pos = I.resolvePositionPreset(s.defaultPosition || 'bottom-right');
                    const tx = pos.translate === 'x' ? 'translateX(-50%)' :
                               pos.translate === 'y' ? 'translateY(-50%)' :
                               pos.translate === 'xy' ? 'translate(-50%, -50%)' : '';
                    Object.assign(container.style, {
                        top: pos.top || 'auto',
                        left: pos.left || 'auto',
                        right: pos.right || 'auto',
                        bottom: pos.bottom || 'auto',
                        transform: tx
                    });
                }
            }
        }

        window.xdAnswers.isExtensionModifyingDOM = false;
    };
})();
