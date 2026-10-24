// @ts-nocheck — popup UI module. Provider configuration form and M3 palette.
import { autoSave } from '../core/settings';
import { escapeHTML, generateId } from '../core/utils';
import { settings, uiElements } from '../core/state';
import { t } from '../core/i18n';
import { API_PROVIDERS, getApiProviderMeta } from './data';
import { renderActiveProviderSelector, renderProvidersTab } from './render';


export function showProviderForm(existing, isOther, isSearch) {
    const container = uiElements.providersContainer;
    if (!container) return;

    const isEdit = !!existing;
    const initialType = existing?.type || (isSearch ? 'langsearch' : (isOther ? 'other' : 'openai'));
    const isOtherType = initialType === 'other';
    const defaultUrl = existing?.baseUrl || (isOtherType ? '' : (window.xdAnswers._internal.DEFAULT_BASE_URLS[initialType] || ''));
    const urlDisplay = (isOtherType || initialType === 'searxng') ? '' : ' style="display:none"';

    // For search providers, only show search-type providers in the dropdown
    const providerOptions = isSearch
        ? API_PROVIDERS.filter(p => p.kind === 'search')
        : (isOther
            ? []
            : API_PROVIDERS.filter(p => p.kind !== 'search'));

    const providerListHtml = isOther
        ? `<div class="pf-type-selected">
                <img class="provider-icon large" src="https://models.dev/logos/openai.svg" alt="" loading="lazy">
                <span class="provider-option-text"><span class="provider-option-title">Custom (OpenAI-compatible)</span></span>
            </div>`
        : (() => {
            const sel = API_PROVIDERS.find(p => p.id === initialType) || API_PROVIDERS[0];
            return `<button type="button" class="pf-type-trigger" id="pf-type-trigger">
                <span class="provider-trigger-value">
                    <img class="provider-icon large" src="https://models.dev/logos/${sel.logo}.svg" alt="" loading="lazy">
                    <span class="provider-option-text">
                        <span class="provider-option-title">${escapeHTML(sel.name)}</span>
                        <span class="provider-option-hint">${escapeHTML(sel.hint)}</span>
                    </span>
                </span><span class="provider-caret">▾</span>
            </button>
            <div class="pf-type-dropdown hidden" id="pf-type-dropdown">
                ${providerOptions.map(p => `<button type="button" class="pf-type-option${p.id === initialType ? ' active' : ''}" data-type="${p.id}">
                    <img class="provider-icon large" src="https://models.dev/logos/${p.logo}.svg" alt="" loading="lazy">
                    <span class="provider-option-text">
                        <span class="provider-option-title">${escapeHTML(p.name)}</span>
                        <span class="provider-option-hint">${escapeHTML(p.hint)}</span>
                    </span>
                </button>`).join('')}
            </div>`;
        })();

    const formHtml = `<div class="provider-form">
        <div class="form-group">
            <label>${t('providerTypeLabel')}</label>
            <div class="pf-type-wrapper">${providerListHtml}</div>
            <input type="hidden" id="pf-type" value="${initialType}">
        </div>
        <div class="form-group">
            <label>${t('providerNameLabel')}</label>
            <input type="text" id="pf-name" value="${escapeHTML(existing?.name || '')}" placeholder="${isOtherType ? t('providerNamePlaceholder') : getApiProviderMeta(initialType)?.name || 'Provider'}">
        </div>
        <div class="form-group pf-url-group"${urlDisplay}>
            <label>${t('providerBaseUrlLabel')}</label>
            <input type="text" id="pf-url" value="${escapeHTML(defaultUrl)}" placeholder="https://api.example.com/v1">
        </div>
        <div class="form-group">
            <label>${t('providerApiKeyLabel')}</label>
            <input type="password" id="pf-key" value="${escapeHTML(existing?.apiKey || '')}" placeholder="${t('providerApiKeyPlaceholder')}">
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

    // Close on backdrop click (outside the form card)
    formWrapper.addEventListener('click', (e) => {
        if (e.target === formWrapper) formWrapper.remove();
    });

    const pfType = formWrapper.querySelector('#pf-type');
    const pfUrl = formWrapper.querySelector('#pf-url');
    const pfTypeTrigger = formWrapper.querySelector('#pf-type-trigger');
    const pfTypeDropdown = formWrapper.querySelector('#pf-type-dropdown');

    if (pfTypeTrigger && pfTypeDropdown) {
        pfTypeTrigger.addEventListener('click', () => {
            pfTypeDropdown.classList.toggle('hidden');
        });

        pfTypeDropdown.querySelectorAll('.pf-type-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const newType = btn.dataset.type;
                const meta = getApiProviderMeta(newType);
                pfType.value = newType;
                const logo = meta?.logo || 'openai';
                pfTypeTrigger.innerHTML = `<span class="provider-trigger-value">
                    <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" loading="lazy">
                    <span class="provider-option-text">
                        <span class="provider-option-title">${escapeHTML(meta?.name || newType)}</span>
                        <span class="provider-option-hint">${escapeHTML(meta?.hint || '')}</span>
                    </span>
                </span><span class="provider-caret">▾</span>`;
                pfTypeDropdown.querySelectorAll('.pf-type-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                pfTypeDropdown.classList.add('hidden');
                pfUrl.value = window.xdAnswers._internal.DEFAULT_BASE_URLS[newType] || '';
                var urlGroup = formWrapper.querySelector('.pf-url-group');
                if (urlGroup) urlGroup.style.display = (newType === 'searxng' || newType === 'other') ? '' : 'none';
                var nameInput = formWrapper.querySelector('#pf-name');
                if (!nameInput.value.trim()) nameInput.placeholder = meta?.name || 'Provider';
            });
        });

        document.addEventListener('click', function closeTypeDropdown(e) {
            if (!formWrapper.contains(e.target)) {
                pfTypeDropdown.classList.add('hidden');
            }
            if (!document.contains(formWrapper)) {
                document.removeEventListener('click', closeTypeDropdown);
            }
        });
    }

    formWrapper.querySelector('#pf-cancel').addEventListener('click', () => {
        formWrapper.remove();
    });

    formWrapper.querySelector('#pf-save').addEventListener('click', async () => {
        const selectedType = isOther ? 'other' : pfType.value;
        const name = formWrapper.querySelector('#pf-name').value.trim();
        const key = formWrapper.querySelector('#pf-key').value.trim();

        const isOtherSave = selectedType === 'other';
        const meta = getApiProviderMeta(selectedType);
        const finalName = name || (isOtherSave ? t('providerCustomName') : (meta?.name || selectedType));
        const finalUrl = isOtherSave
            ? (pfUrl.value.trim() || 'https://api.openai.com/v1')
            : (window.xdAnswers._internal.DEFAULT_BASE_URLS[selectedType] || '');

        if (isEdit) {
            existing.type = selectedType;
            existing.name = finalName;
            existing.baseUrl = finalUrl;
            existing.apiKey = key;
            // Update kind based on new type
            const editMeta = getApiProviderMeta(selectedType);
            if (editMeta?.kind === 'search') existing.kind = 'search';
            else delete existing.kind;
        } else {
            const newProvider = {
                id: generateId(),
                type: selectedType,
                name: finalName,
                baseUrl: finalUrl,
                apiKey: key
            };
            // Tag search providers
            const meta = getApiProviderMeta(selectedType);
            if (meta?.kind === 'search') newProvider.kind = 'search';
            settings.providers.push(newProvider);
            if (!settings.activeProviderId) {
                settings.activeProviderId = newProvider.id;
            }
            // Auto-enable web search when first search provider is added with an API key
            if (meta?.kind === 'search' && key && !settings.webSearchEnabled) {
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
