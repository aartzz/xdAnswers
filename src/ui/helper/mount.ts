// src/ui/helper/mount.ts
// Helper window DOM creation, parent attachment and default or saved positioning.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    window.xdAnswers.createUI = function(): void {
        if (window.xdAnswers.helperContainer) return;
        if (I.ensureMaterialSymbolsFont) I.ensureMaterialSymbolsFont();

        // Host element in light DOM: randomized class, no id, empty light children.
        // Page scripts running querySelector or innerText cannot detect or inspect it.
        const T = I.uiTokens || {
            panel: 'app-panel', bar: 'app-bar', dragBar: 'drag-bar', title: 'app-title',
            version: 'app-version', actions: 'app-actions', btnSilent: 'btn-silent', selSilent: 'sel-silent',
            btnRefresh: 'btn-refresh', view: 'app-view', answerView: 'answer-view', footer: 'app-footer',
            time: 'lbl-elapsed', model: 'lbl-model', copy: 'app-copy', btnCopy: 'btn-copy',
            icon: 'app-icon', spinner: 'app-spinner', zIndex: 999999
        };

        const host = document.createElement('div');
        const randId = '_' + Math.random().toString(36).slice(2, 9);
        host.className = randId;
        host.style.setProperty('position', 'fixed', 'important');
        host.style.setProperty('z-index', String(T.zIndex), 'important');
        host.style.setProperty('margin', '0', 'important');
        host.style.setProperty('padding', '0', 'important');
        host.style.setProperty('border', 'none', 'important');
        host.style.setProperty('box-sizing', 'border-box', 'important');
        host.style.setProperty('display', 'flex', 'important');

        // Closed Shadow Root: completely impenetrable by page-world scripts
        const shadow = host.attachShadow({ mode: 'closed' });
        window.xdAnswers.shadowRoot = shadow;

        const innerCard = document.createElement('div');
        innerCard.className = T.panel;
        innerCard.innerHTML =
            `<div class="${T.bar}" id="${T.dragBar}">` +
            `<span class="${T.title}">xdAnswers <small class="${T.version} xd-version"></small></span>` +
            `<div class="${T.actions}">` +
            `<button id="${T.btnSilent}" title="Silent mode: Off"><span class="${T.icon}">close</span></button>` +
            `<select id="${T.selSilent}" title="Silent mode">` +
            '<option value="">Off</option>' +
            '<option value="indicators">Indicators</option>' +
            '<option value="ghost">Page title</option>' +
            '<option value="stealth">Stealth</option>' +
            '<option value="oneclick">One-click</option>' +
            '</select>' +
            `<button id="${T.btnRefresh}" title="Refresh"><span class="${T.icon}">refresh</span></button>` +
            '</div></div>' +
            `<div class="${T.view}" id="${T.answerView}">Waiting for question...</div>` +
            `<div class="${T.footer}">` +
            `<span class="${T.time}" id="${T.time}"></span>` +
            `<span class="${T.model}" id="${T.model}"></span>` +
            `<button class="${T.copy}" id="${T.btnCopy}" title="Copy answer"><span class="${T.icon}">content_copy</span></button>` +
            '</div>';

        shadow.appendChild(innerCard);
        window.xdAnswers.innerCard = innerCard;

        // Prevent text selection / manual copy inside helper window (copy allowed via copy button only)
        innerCard.addEventListener('selectstart', (e) => e.preventDefault());
        innerCard.addEventListener('copy', (e) => e.preventDefault());

        // Delegate querySelector calls on the host wrapper to the shadow root so internal modules work seamlessly
        host.querySelector = function<E extends Element = Element>(selectors: string): E | null {
            return shadow.querySelector<E>(selectors);
        };
        host.querySelectorAll = function<E extends Element = Element>(selectors: string): NodeListOf<E> {
            return shadow.querySelectorAll<E>(selectors);
        };

        I.ui = {
            btnSilent: shadow.querySelector('#' + T.btnSilent),
            selSilent: shadow.querySelector('#' + T.selSilent),
            btnRefresh: shadow.querySelector('#' + T.btnRefresh),
            btnCopy: shadow.querySelector('#' + T.btnCopy),
            lblElapsed: shadow.querySelector('#' + T.time),
            lblModel: shadow.querySelector('#' + T.model),
            version: shadow.querySelector('.' + T.version)
        };

        window.xdAnswers.helperContainer = host;
        window.xdAnswers.answerContentDiv = shadow.querySelector<HTMLElement>('#' + T.answerView);
        window.xdAnswers.dragHeader = shadow.querySelector<HTMLElement>('#' + T.dragBar);

        window.xdAnswers.attachHelperEventListeners();
        window.xdAnswers.updateHelperBaseStyles();

        // Set current model name in footer
        const footerModelEl = I.ui.lblModel;
        if (footerModelEl) footerModelEl.innerHTML = (window.xdAnswers.settings.model || 'select model') + ` <span class="${T.icon}" style="font-size:12px !important;vertical-align:baseline;">north_east</span>`;
        // Set version string in header
        const versionEl = I.ui.version;
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
