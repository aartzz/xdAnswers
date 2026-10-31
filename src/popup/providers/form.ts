// @ts-nocheck — popup UI module. Provider configuration form and M3 palette.
import { autoSave } from '../core/settings';
import { escapeHTML, generateId } from '../core/utils';
import { settings, uiElements } from '../core/state';
import { t } from '../core/i18n';
import { API_PROVIDERS, MCP_PROVIDERS } from './data';
import { renderActiveProviderSelector, renderProvidersTab } from './render';


function normaliseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '').toLowerCase();
}

function providerOptionsFor(mode, protocol) {
    if (mode === 'llm') {
        return API_PROVIDERS.filter(p => p.kind !== 'search').map(p => ({
            value: p.id, name: p.name, hint: p.hint, logo: p.logo, url: ''
        }));
    }
    if (protocol === 'mcp') {
        return MCP_PROVIDERS.map(p => ({
            value: p.id, name: p.name, hint: p.hint, logo: p.logo, url: p.url
        }));
    }
    return API_PROVIDERS.filter(p => p.kind === 'search' && p.id !== 'mcp').map(p => ({
        value: p.id, name: p.name, hint: p.hint, logo: p.logo, url: ''
    }));
}

function customOption(mode, protocol) {
    if (mode === 'llm') {
        return { value: 'custom', name: t('providerCustomName'), hint: t('providerCustomHint'), logo: 'openai', url: '' };
    }
    return { value: 'custom', name: t('providerCustomMcpName'), hint: t('providerCustomMcpHint'), logo: 'mcp', url: '' };
}

function initialProviderValue(existing, mode, protocol, options) {
    if (!existing) return options[0]?.value || 'custom';
    if (mode === 'llm') {
        if (existing.type === 'other') return 'custom';
        return options.some(o => o.value === existing.type) ? existing.type : 'custom';
    }
    if (protocol === 'mcp') {
        const existingUrl = normaliseUrl(existing.baseUrl);
        const preset = options.find(o => o.url && normaliseUrl(o.url) === existingUrl);
        return preset ? preset.value : 'custom';
    }
    return options.some(o => o.value === existing.type) ? existing.type : (options[0]?.value || '');
}

export function showProviderForm(existing) {
    const container = uiElements.providersContainer;
    if (!container) return;

    const isEdit = !!existing;
    const isSearch = existing?.kind === 'search';
    let mode = isSearch ? 'search' : 'llm';
    let protocol = isSearch && existing?.type === 'mcp' ? 'mcp' : 'api';
    let options = providerOptionsFor(mode, protocol);
    const withCustom = function(list) {
        return protocol === 'mcp' || mode === 'llm' ? list.concat([customOption(mode, protocol)]) : list;
    };
    let selected = initialProviderValue(existing, mode, protocol, withCustom(options));
    let customUrl = existing && (existing.type === 'other' || existing.type === 'searxng' || (protocol === 'mcp' && selected === 'custom')) ? (existing.baseUrl || '') : '';

    const formHtml = `<div class="provider-form">
        <div class="form-group">
            <label>${t('providerModeLabel')}</label>
            <div class="pf-segmented" id="pf-mode">
                <button type="button" class="pf-segment${mode === 'llm' ? ' active' : ''}" data-mode="llm">${t('providerModeLlm')}</button>
                <button type="button" class="pf-segment${mode === 'search' ? ' active' : ''}" data-mode="search">${t('providerModeSearch')}</button>
            </div>
        </div>
        <div class="form-group">
            <label>${t('providerProtocolLabel')}</label>
            <div class="pf-segmented" id="pf-protocol">
                <button type="button" class="pf-segment${protocol === 'api' ? ' active' : ''}" data-protocol="api">${t('providerProtocolApi')}</button>
                <button type="button" class="pf-segment${protocol === 'mcp' ? ' active' : ''}" data-protocol="mcp">${t('providerProtocolMcp')}</button>
            </div>
            <p class="field-hint" id="pf-protocol-hint"></p>
        </div>
        <div class="form-group">
            <label>${t('providerProviderLabel')}</label>
            <div class="pf-type-wrapper">
                <button type="button" class="pf-type-trigger" id="pf-type-trigger"></button>
                <div class="pf-type-dropdown hidden" id="pf-type-dropdown"></div>
            </div>
            <input type="hidden" id="pf-type" value="">
            <p class="field-hint" id="pf-provider-hint"></p>
        </div>
        <div class="form-group">
            <label>${t('providerNameLabel')}</label>
            <input type="text" id="pf-name" value="${escapeHTML(existing?.name || '')}" placeholder="">
        </div>
        <div class="form-group pf-url-group">
            <label>${t('providerBaseUrlLabel')}</label>
            <input type="text" id="pf-url" value="${escapeHTML(existing?.baseUrl || '')}" placeholder="https://api.example.com/v1">
        </div>
        <div class="form-group">
            <label>${t('providerApiKeyLabel')}</label>
            <input type="password" id="pf-key" value="${escapeHTML(existing?.apiKey || '')}" placeholder="${t('providerApiKeyPlaceholder')}">
            <p class="field-hint" id="pf-key-hint"></p>
        </div>
        <div class="provider-form-actions">
            <button type="button" id="pf-save" class="pf-btn pf-save-btn">${isEdit ? t('saveProvider') : t('addProviderType')}</button>
            <button type="button" id="pf-cancel" class="pf-btn pf-cancel-btn">${t('cancelBtn')}</button>
        </div>
    </div>`;

    const formWrapper = document.createElement('div');
    formWrapper.className = 'provider-form-overlay';
    formWrapper.innerHTML = formHtml;
    // Remove any existing overlay first
    document.querySelector('.provider-form-overlay')?.remove();
    document.body.appendChild(formWrapper);

    const pfType = formWrapper.querySelector('#pf-type');
    const pfUrl = formWrapper.querySelector('#pf-url');
    const pfUrlGroup = formWrapper.querySelector('.pf-url-group');
    const pfName = formWrapper.querySelector('#pf-name');
    const pfKeyHint = formWrapper.querySelector('#pf-key-hint');
    const pfProviderHint = formWrapper.querySelector('#pf-provider-hint');
    const pfProtocolHint = formWrapper.querySelector('#pf-protocol-hint');
    const pfTypeTrigger = formWrapper.querySelector('#pf-type-trigger');
    const pfTypeDropdown = formWrapper.querySelector('#pf-type-dropdown');

    function allOptions() {
        return withCustom(providerOptionsFor(mode, protocol));
    }

    function currentOption() {
        const list = allOptions();
        return list.find(o => o.value === selected) || list[0];
    }

    function renderTrigger() {
        const opt = currentOption();
        const logo = opt?.logo || 'openai';
        pfTypeTrigger.innerHTML = `<span class="provider-trigger-value">
            <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" loading="lazy">
            <span class="provider-option-text">
                <span class="provider-option-title">${escapeHTML(opt?.name || 'Provider')}</span>
                <span class="provider-option-hint">${escapeHTML(opt?.hint || '')}</span>
            </span>
        </span><span class="provider-caret">▾</span>`;
    }

    function renderDropdown() {
        const list = allOptions();
        pfTypeDropdown.innerHTML = list.map(opt => `<button type="button" class="pf-type-option${opt.value === selected ? ' active' : ''}" data-value="${escapeHTML(opt.value)}">
            <img class="provider-icon large" src="https://models.dev/logos/${opt.logo || 'openai'}.svg" alt="" loading="lazy">
            <span class="provider-option-text">
                <span class="provider-option-title">${escapeHTML(opt.name)}</span>
                <span class="provider-option-hint">${escapeHTML(opt.hint || '')}</span>
            </span>
        </button>`).join('');
        pfTypeDropdown.querySelectorAll('.pf-type-option').forEach(btn => {
            btn.addEventListener('click', () => {
                selected = btn.dataset.value;
                pfType.value = selected;
                pfTypeDropdown.classList.add('hidden');
                renderTrigger();
                renderDropdown();
                updateFields();
            });
        });
    }

    function updateFields() {
        const opt = currentOption();
        const isCustom = opt?.value === 'custom';
        const isMcp = mode === 'search' && protocol === 'mcp';
        const showUrl = isCustom || (mode === 'search' && protocol === 'api' && opt?.value === 'searxng');
        pfUrlGroup.style.display = showUrl ? '' : 'none';
        pfUrl.value = isCustom
            ? customUrl
            : (opt?.value === 'searxng' ? (customUrl || window.xdAnswers._internal.DEFAULT_BASE_URLS.searxng || '') : (opt?.url || (opt?.value ? (window.xdAnswers._internal.DEFAULT_BASE_URLS[opt.value] || '') : '')));
        pfUrl.placeholder = isMcp ? 'https://mcp.example.com/mcp' : 'https://api.example.com/v1';
        const urlLabel = formWrapper.querySelector('.pf-url-group label');
        if (urlLabel) urlLabel.textContent = isMcp ? t('providerMcpUrlLabel') : t('providerBaseUrlLabel');
        pfName.placeholder = opt?.name || t('providerNamePlaceholder');

        const mcpBtn = formWrapper.querySelector('.pf-segment[data-protocol="mcp"]');
        if (mcpBtn) {
            mcpBtn.disabled = mode === 'llm';
            mcpBtn.classList.toggle('disabled', mode === 'llm');
        }
        pfProtocolHint.textContent = mode === 'llm' ? t('providerProtocolLlmHint') : '';
        pfProviderHint.textContent = isMcp ? t('providerMcpHint') : '';
        pfKeyHint.textContent = isMcp ? t('providerMcpKeyHint') : '';
        const keyLabel = formWrapper.querySelector('#pf-key')?.closest('.form-group')?.querySelector('label');
        if (keyLabel) keyLabel.textContent = isMcp ? t('providerMcpKeyLabel') : t('providerApiKeyLabel');
    }

    function rebuildOptions(preferred) {
        options = providerOptionsFor(mode, protocol);
        const list = withCustom(options);
        if (preferred && list.some(o => o.value === preferred)) selected = preferred;
        else selected = list[0]?.value || 'custom';
        pfType.value = selected;
        renderTrigger();
        renderDropdown();
        updateFields();
    }

    function updateModeButtons() {
        formWrapper.querySelectorAll('#pf-mode .pf-segment').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        formWrapper.querySelectorAll('#pf-protocol .pf-segment').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.protocol === protocol);
        });
    }

    // Initial render
    pfType.value = selected;
    renderTrigger();
    renderDropdown();
    updateFields();
    updateModeButtons();

    formWrapper.querySelectorAll('#pf-mode .pf-segment').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextMode = btn.dataset.mode;
            if (nextMode === mode) return;
            mode = nextMode;
            protocol = mode === 'llm' ? 'api' : 'mcp';
            customUrl = '';
            updateModeButtons();
            rebuildOptions();
        });
    });

    formWrapper.querySelectorAll('#pf-protocol .pf-segment').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const nextProtocol = btn.dataset.protocol;
            if (nextProtocol === protocol) return;
            protocol = nextProtocol;
            customUrl = '';
            updateModeButtons();
            rebuildOptions();
        });
    });

    pfTypeTrigger.addEventListener('click', () => {
        pfTypeDropdown.classList.toggle('hidden');
    });

    pfUrl.addEventListener('input', () => {
        const opt = currentOption();
        if (opt?.value === 'custom' || opt?.value === 'searxng') customUrl = pfUrl.value;
    });

    document.addEventListener('click', function closeTypeDropdown(e) {
        if (!formWrapper.contains(e.target)) {
            pfTypeDropdown.classList.add('hidden');
        }
        if (!document.contains(formWrapper)) {
            document.removeEventListener('click', closeTypeDropdown);
        }
    });

    // Close on backdrop click (outside the form card)
    formWrapper.addEventListener('click', (e) => {
        if (e.target === formWrapper) formWrapper.remove();
    });

    formWrapper.querySelector('#pf-cancel').addEventListener('click', () => {
        formWrapper.remove();
    });

    formWrapper.querySelector('#pf-save').addEventListener('click', async () => {
        const selectedValue = pfType.value;
        const opt = allOptions().find(o => o.value === selectedValue) || currentOption();
        const name = pfName.value.trim();
        const key = formWrapper.querySelector('#pf-key').value.trim();

        let selectedType;
        let finalUrl;
        let isSearchSave = false;

        if (mode === 'llm') {
            selectedType = opt?.value === 'custom' ? 'other' : (opt?.value || 'openai');
            finalUrl = selectedType === 'other'
                ? (pfUrl.value.trim() || 'https://api.openai.com/v1')
                : (window.xdAnswers._internal.DEFAULT_BASE_URLS[selectedType] || '');
        } else {
            isSearchSave = true;
            if (protocol === 'mcp') {
                selectedType = 'mcp';
                finalUrl = opt?.value === 'custom' ? pfUrl.value.trim() : (opt?.url || '');
                if (!finalUrl) {
                    alert(t('providerUrlRequired'));
                    return;
                }
            } else {
                selectedType = opt?.value || 'langsearch';
                finalUrl = selectedType === 'searxng'
                    ? (pfUrl.value.trim() || window.xdAnswers._internal.DEFAULT_BASE_URLS.searxng || '')
                    : (window.xdAnswers._internal.DEFAULT_BASE_URLS[selectedType] || '');
            }
        }

        const finalName = name || (opt?.value === 'custom' ? (opt?.name || t('providerCustomName')) : (opt?.name || selectedType));

        if (isEdit) {
            existing.type = selectedType;
            existing.name = finalName;
            existing.baseUrl = finalUrl;
            existing.apiKey = key;
            if (isSearchSave) existing.kind = 'search';
            else delete existing.kind;
            if (isSearchSave && settings.activeProviderId === existing.id) {
                const next = settings.providers.find(p => p.id !== existing.id && p.kind !== 'search');
                settings.activeProviderId = next?.id || '';
            } else if (!isSearchSave && !settings.activeProviderId) {
                settings.activeProviderId = existing.id;
            }
        } else {
            const newProvider = {
                id: generateId(),
                type: selectedType,
                name: finalName,
                baseUrl: finalUrl,
                apiKey: key
            };
            if (isSearchSave) newProvider.kind = 'search';
            settings.providers.push(newProvider);
            if (!isSearchSave && !settings.activeProviderId) {
                settings.activeProviderId = newProvider.id;
            }
            if (isSearchSave && !settings.webSearchEnabled) {
                settings.webSearchEnabled = true;
                if (uiElements.webSearchToggle) uiElements.webSearchToggle.checked = true;
            }
        }

        formWrapper.remove();
        renderProvidersTab();
        renderActiveProviderSelector();
        await autoSave();
    });
}

export const M3_PALETTE_COLORS = [
    { id: 'blue', color: '#3b82f6', name: 'Blue' },
    { id: 'indigo', color: '#6366f1', name: 'Indigo' },
    { id: 'purple', color: '#8b5cf6', name: 'Purple' },
    { id: 'rose', color: '#f43f5e', name: 'Rose' },
    { id: 'amber', color: '#f59e0b', name: 'Amber' },
    { id: 'emerald', color: '#10b981', name: 'Emerald' },
    { id: 'cyan', color: '#06b6d4', name: 'Cyan' },
    { id: 'slate', color: '#64748b', name: 'Slate' }
];
