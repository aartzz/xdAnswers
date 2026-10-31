// @ts-nocheck — popup UI module. Provider selector, providers tab and provider cards.
import { autoSave } from '../core/settings';
import { escapeHTML } from '../core/utils';
import { fetchModels, renderModelList } from '../models';
import { setAllModels, settings, uiElements } from '../core/state';
import { t } from '../core/i18n';
import { getActiveProvider, getApiProviderMeta, MCP_PROVIDERS } from './data';
import { showProviderForm } from './form';


export function renderActiveProviderSelector() {
    const trigger = uiElements.activeProviderTrigger;
    const dropdown = uiElements.activeProviderDropdown;
    if (!trigger || !dropdown) return;

    const active = getActiveProvider(settings);
    if (active) {
        const logo = getProviderLogo(active);
        const isOther = active.type === 'other';
        const hintLine = isOther ? escapeHTML(active.baseUrl) : (getApiProviderMeta(active.type)?.hint || '');
        trigger.innerHTML = `<span class="provider-trigger-value">
            <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" width="24" height="24" loading="lazy" decoding="async">
            <span class="provider-option-text">
                <span class="provider-option-title">${escapeHTML(active.name)}</span>
                <span class="provider-option-hint">${hintLine}</span>
            </span>
        </span><span class="provider-caret">▾</span>`;
    } else {
        trigger.innerHTML = `<span class="provider-trigger-value">
            <span class="provider-option-text">
                <span class="provider-option-title">—</span>
                <span class="provider-option-hint">—</span>
            </span>
        </span><span class="provider-caret">▾</span>`;
    }

    dropdown.innerHTML = settings.providers.filter(p => p.kind !== 'search').map(p => {
        const isActive = p.id === settings.activeProviderId ? ' active' : '';
        const logo = getProviderLogo(p);
        const isOther = p.type === 'other';
        const hint = isOther ? escapeHTML(p.baseUrl) : (getApiProviderMeta(p.type)?.hint || '');
        return `<button type="button" class="provider-option${isActive}" data-provider-id="${p.id}">
            <span class="provider-option-main">
                <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" width="24" height="24" loading="lazy" decoding="async">
                <span class="provider-option-text">
                    <span class="provider-option-title">${escapeHTML(p.name)}</span>
                    <span class="provider-option-hint">${hint}</span>
                </span>
            </span>
        </button>`;
    }).join('');

    if (!settings.providers.length) {
        dropdown.innerHTML = '<div class="provider-empty">No providers configured</div>';
    }

    dropdown.querySelectorAll('.provider-option').forEach(button => {
        button.addEventListener('click', async () => {
            settings.activeProviderId = button.dataset.providerId;
            renderActiveProviderSelector();
            dropdown.classList.add('hidden');
            setAllModels([]);
            await autoSave({ activeProviderId: settings.activeProviderId });
            fetchModels().then(() => renderModelList());
        });
    });
}

export function renderProvidersTab() {
    const container = uiElements.providersContainer;
    if (!container) return;

    const providers = settings.providers || [];

    let html = '<div class="providers-section">';
    html += `<div class="providers-section-header">${t('providersHeader')}</div>`;
    if (providers.length) {
        html += providers.map(p => renderProviderCard(p)).join('');
    } else {
        html += `<div class="provider-empty-hint">${t('noProviders')}</div>`;
    }
    html += `<button type="button" class="add-provider-btn" data-section="provider">${t('addProvider')}</button>`;
    html += '</div>';

    container.innerHTML = html;
    attachProviderCardListeners(container);
}

export function getProviderLogo(p) {
    if (p.type === 'other') return 'openai';
    if (p.type === 'mcp') {
        const url = String(p.baseUrl || '').replace(/\/+$/, '').toLowerCase();
        const preset = MCP_PROVIDERS.find(m => m.url.replace(/\/+$/, '').toLowerCase() === url);
        return preset ? preset.logo : 'mcp';
    }
    const meta = getApiProviderMeta(p.type);
    return meta ? meta.logo : 'openai';
}

export function renderProviderCard(p) {
    const logo = getProviderLogo(p);
    const isActive = p.id === settings.activeProviderId;
    const isSearch = p.kind === 'search';
    const activeBadge = isActive && !isSearch ? '<span class="provider-active-badge">active</span>' : '';
    const searchBadge = isSearch ? '<span class="provider-search-badge">🔍 ' + (p.type === 'mcp' ? 'MCP' : 'SEARCH') + '</span>' : '';
    const keyPreview = p.apiKey ? '••••' + p.apiKey.slice(-4) : '—';
    const isOther = p.type === 'other';
    const urlLine = (isOther || p.type === 'mcp') ? `<span class="provider-card-url">${escapeHTML(p.baseUrl || '')}</span>` : '';

    const activateBtn = isSearch ? '' : '<button type="button" class="provider-card-btn provider-activate-btn" data-id="' + p.id + '" title="Set active">✓</button>';

    return `<div class="provider-card${isActive && !isSearch ? ' active' : ''}" data-id="${p.id}">
        <div class="provider-card-header">
            <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" width="24" height="24" loading="lazy" decoding="async">
            <div class="provider-card-info">
                <span class="provider-card-name">${escapeHTML(p.name)}${activeBadge}${searchBadge}</span>
                ${urlLine}
                <span class="provider-card-key">${keyPreview}</span>
            </div>
            <div class="provider-card-actions">
                ${activateBtn}
                <button type="button" class="provider-card-btn provider-edit-btn" data-id="${p.id}" title="Edit">✎</button>
                <button type="button" class="provider-card-btn provider-delete-btn" data-id="${p.id}" title="Delete">✕</button>
            </div>
        </div>
    </div>`;
}

export function attachProviderCardListeners(container) {
    container.querySelectorAll('.provider-activate-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            settings.activeProviderId = btn.dataset.id;
            setAllModels([]);
            renderProvidersTab();
            renderActiveProviderSelector();
            await autoSave({ activeProviderId: settings.activeProviderId });
            fetchModels().then(() => renderModelList());
        });
    });

    container.querySelectorAll('.provider-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const provider = settings.providers.find(p => p.id === btn.dataset.id);
            if (provider) showProviderForm(provider);
        });
    });

    container.querySelectorAll('.provider-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            settings.providers = settings.providers.filter(p => p.id !== btn.dataset.id);
            if (settings.activeProviderId === btn.dataset.id) {
                const nonSearch = settings.providers.filter(p => p.kind !== 'search');
                settings.activeProviderId = nonSearch[0]?.id || settings.providers[0]?.id || '';
            }
            renderProvidersTab();
            renderActiveProviderSelector();
            await autoSave();
        });
    });

    container.querySelectorAll('.add-provider-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showProviderForm(null);
        });
    });
}
