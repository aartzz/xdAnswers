// src/popup/core/ui.ts
// @ts-nocheck — popup UI module. Beer CSS select widgets and the main populateUI() pass.
import { applyLanguage } from './i18n';
import { applyThemeToPopup, populateThemesGrid } from '../themes';
import { renderActiveProviderSelector, renderProvidersTab } from '../providers';
import { renderConsensusRuns } from '../consensus';
import { renderModelList } from '../models';
import { settings, uiElements } from './state';


export function initM3Selects() {
    const isM3 = (settings.themeEngine || 'material3') !== 'legacy';

    // IDs of native selects to wrap
    const selectIds = ['language-select', 'silent-mode-select', 'theme-engine-select'];

    selectIds.forEach(id => {
        const native = document.getElementById(id);
        if (!native) return;

        // Remove existing wrapper if switching themes
        const existingWrap = native.closest('.m3-select-wrap');
        if (existingWrap && !isM3) {
            // Unwrap: move native back, remove wrapper, strip any leftover styles
            existingWrap.parentNode.insertBefore(native, existingWrap);
            existingWrap.remove();
            native.removeAttribute('style');
            return;
        }
        if (!isM3) return;
        // Already wrapped
        if (existingWrap) {
            syncM3SelectTrigger(existingWrap, native);
            return;
        }

        // Build wrapper
        const wrap = document.createElement('div');
        wrap.className = 'm3-select-wrap';
        native.parentNode.insertBefore(wrap, native);
        wrap.appendChild(native);

        // Trigger button
        const trigger = document.createElement('div');
        trigger.className = 'm3-select-trigger';
        trigger.setAttribute('tabindex', '0');
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        wrap.appendChild(trigger);

        // Arrow icon
        const arrow = document.createElement('span');
        arrow.className = 'm3-select-arrow';
        arrow.textContent = 'expand_more';
        trigger.appendChild(arrow);

        // Dropdown list
        const list = document.createElement('ul');
        list.className = 'm3-select-list';
        list.setAttribute('role', 'listbox');
        wrap.appendChild(list);

        buildM3SelectList(list, native);
        syncM3SelectTrigger(wrap, native);

        // Toggle open
        function openDropdown() {
            const isOpen = wrap.classList.contains('m3-open');
            // Close all others
            document.querySelectorAll('.m3-select-wrap.m3-open').forEach(w => {
                if (w !== wrap) {
                    w.classList.remove('m3-open', 'm3-open-up');
                    w.querySelector('.m3-select-trigger')?.setAttribute('aria-expanded', 'false');
                }
            });

            if (!isOpen) {
                // Check if dropdown would collide with bottom navbar
                const rect = trigger.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const opensUp = spaceBelow < 180;
                wrap.classList.toggle('m3-open-up', opensUp);
            } else {
                wrap.classList.remove('m3-open-up');
            }

            wrap.classList.toggle('m3-open', !isOpen);
            trigger.setAttribute('aria-expanded', String(!isOpen));
        }

        trigger.addEventListener('click', openDropdown);
        trigger.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDropdown(); }
            if (e.key === 'Escape') { wrap.classList.remove('m3-open'); trigger.setAttribute('aria-expanded', 'false'); }
        });

        // Option click
        list.addEventListener('click', e => {
            const item = e.target.closest('.m3-select-item');
            if (!item) return;
            const val = item.dataset.value;
            native.value = val;
            native.dispatchEvent(new Event('change', { bubbles: true }));
            syncM3SelectTrigger(wrap, native);
            wrap.classList.remove('m3-open');
            trigger.setAttribute('aria-expanded', 'false');
        });

        // Rebuild list when native options change (MutationObserver)
        const obs = new MutationObserver(() => {
            buildM3SelectList(list, native);
            syncM3SelectTrigger(wrap, native);
        });
        obs.observe(native, { childList: true, subtree: true, attributes: true });
    });

    // Close on outside click
    if (!window._m3SelectOutsideListener) {
        window._m3SelectOutsideListener = true;
        document.addEventListener('click', e => {
            if (!e.target.closest('.m3-select-wrap')) {
                document.querySelectorAll('.m3-select-wrap.m3-open').forEach(w => {
                    w.classList.remove('m3-open');
                    w.querySelector('.m3-select-trigger')?.setAttribute('aria-expanded', 'false');
                });
            }
        });
    }
}

export function buildM3SelectList(list, native) {
    list.innerHTML = '';
    Array.from(native.options).forEach(opt => {
        const item = document.createElement('li');
        item.className = 'm3-select-item';
        item.dataset.value = opt.value;
        item.setAttribute('role', 'option');
        item.textContent = opt.textContent;
        if (opt.selected) item.classList.add('selected');
        list.appendChild(item);
    });
}

export function syncM3SelectTrigger(wrap, native) {
    const trigger = wrap.querySelector('.m3-select-trigger');
    const arrow = wrap.querySelector('.m3-select-arrow');
    if (!trigger) return;
    const selected = native.options[native.selectedIndex];
    // Clear text nodes, keep arrow
    Array.from(trigger.childNodes).forEach(n => {
        if (n !== arrow) n.remove();
    });
    const label = document.createTextNode(selected ? selected.textContent : '');
    trigger.insertBefore(label, arrow);
    // Update selected state in list
    wrap.querySelectorAll('.m3-select-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.value === native.value);
    });
}

export function populateUI() {
    const el = uiElements;
    renderActiveProviderSelector();
    el.modelName.value = settings.model;
    renderModelList();

    el.autoAnswerToggle.checked = settings.autoAnswer;
    el.autoAnswerCooldown.value = settings.autoAnswerCooldown;
    el.cooldownGroup.style.display = settings.autoAnswer ? 'block' : 'none';
    el.highlightCorrectToggle.checked = settings.highlightCorrect;
    el.showAnswerOnlyToggle.checked = !!settings.showAnswerOnly;
    const silentModeValue = settings.silentMode || '';
    el.silentModeToggle.checked = silentModeValue !== '';
    // Select always visible so user can pre-choose mode
    el.silentModeSelectGroup.style.display = 'block';
    el.silentModeSelect.value = silentModeValue || 'indicators';

    // Web search toggle
    if (el.webSearchToggle) el.webSearchToggle.checked = !!settings.webSearchEnabled;

    // Calculator toggle
    if (el.calculatorToggle) el.calculatorToggle.checked = settings.calculatorEnabled !== false;

    // Disabler toggle
    if (el.disablerToggle) el.disablerToggle.checked = !!settings.disablerEnabled;

    // Consensus toggle
    if (el.consensusToggle) el.consensusToggle.checked = !!(settings.consensus && settings.consensus.enabled);

    // Consensus mode run cards
    renderConsensusRuns();

    el.glowEffectToggle.checked = settings.customization.glowEffect;

    // Position grid: mark active cell, sync remember-drag toggle
    if (el.positionGrid) {
        const activePosition = settings.defaultPosition || 'bottom-right';
        el.positionGrid.querySelectorAll('.position-cell').forEach(cell => {
            const isActive = cell.dataset.position === activePosition;
            cell.classList.toggle('active', isActive);
            cell.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
    }
    if (el.rememberDragToggle) el.rememberDragToggle.checked = !!settings.rememberDragPosition;

    if (el.themeEngineSelect) el.themeEngineSelect.value = settings.themeEngine || 'material3';

    // Hotkey display
    if (el.hotkeyRecorderKbd) el.hotkeyRecorderKbd.textContent = settings.hotkey || 'Ctrl+Shift+X';

    applyLanguage();
    populateThemesGrid();
    renderProvidersTab();
    applyThemeToPopup();
    initM3Selects();
}
