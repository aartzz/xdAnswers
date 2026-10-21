// src/popup/providers.ts
// @ts-nocheck — popup UI module. AI/web-search provider catalog and provider tab rendering.
import { autoSave } from './settings';
import { escapeHTML, generateId } from './utils';
import { fetchModels, renderModelList } from './models';
import { setAllModels, settings, uiElements } from './state';
import { t } from './i18n';

export const API_PROVIDERS = [
    { id: 'openai', name: 'OpenAI', hint: 'OpenAI API', logo: 'openai' },
    { id: 'anthropic', name: 'Anthropic', hint: 'Claude Messages API', logo: 'anthropic' },
    { id: 'google', name: 'Google (Gemini)', hint: 'Generative Language API', logo: 'google' },
    { id: 'deepseek', name: 'DeepSeek', hint: 'DeepSeek API', logo: 'deepseek' },
    { id: 'groq', name: 'Groq', hint: 'Groq API (fast inference)', logo: 'groq' },
    { id: 'openrouter', name: 'OpenRouter', hint: 'OpenRouter API (multi-provider)', logo: 'openrouter' },
    { id: 'cerebras', name: 'Cerebras', hint: 'Cerebras API (fast inference)', logo: 'cerebras' },
    { id: 'together', name: 'Together AI', hint: 'Together API', logo: 'together-ai' },
    { id: 'fireworks', name: 'Fireworks AI', hint: 'Fireworks API', logo: 'fireworks-ai' },
    { id: 'mistral', name: 'Mistral', hint: 'Mistral API', logo: 'mistral' },
    { id: 'unturf-hermes', name: 'Unturf Hermes', hint: 'Free — Hermes 3 Llama 3.1 8B', logo: 'unturf' },
    { id: 'opencode-zen', name: 'OpenCode Zen', hint: 'OpenCode Zen — free models & big-pickle need no key', logo: 'opencode' },
    { id: 'opencode-go', name: 'OpenCode Go', hint: 'OpenCode Go — API key required', logo: 'opencode' },
    { id: 'ollama-cloud', name: 'Ollama Cloud', hint: 'Ollama Cloud — API key required', logo: 'ollama-cloud' },
    { id: 'nvidia', name: 'NVIDIA NIM', hint: 'NVIDIA NIM — API key required', logo: 'nvidia' },
    // Web Search providers (kind: 'search' — not LLM, used for tool-calling)
    { id: 'langsearch', name: 'LangSearch', hint: 'Web Search — Free API', logo: 'openai', kind: 'search' },
    { id: 'serper', name: 'Serper.dev', hint: 'Web Search — 2,500 free/month', logo: 'openai', kind: 'search' },
    { id: 'perplexity', name: 'Perplexity', hint: 'Web Search — pplx- API key', logo: 'openai', kind: 'search' },
    { id: 'exa', name: 'Exa', hint: 'Web Search — free neural search or API key', logo: 'openai', kind: 'search' },
    { id: 'tavily', name: 'Tavily', hint: 'Web Search — tvly- API key', logo: 'openai', kind: 'search' },
    { id: 'linkup', name: 'Linkup', hint: 'Web Search — fast/standard/deep', logo: 'openai', kind: 'search' },
    { id: 'searchapi', name: 'SearchAPI', hint: 'Web Search — Google/Bing/Yahoo', logo: 'openai', kind: 'search' },
    { id: 'searxng', name: 'SearXNG', hint: 'Web Search — Open-source, no API key', logo: 'openai', kind: 'search' }
];

export const PROVIDER_ICON_MAP = {
    'openai': 'openai', 'anthropic': 'anthropic', 'google': 'google',
    'nvidia': 'nvidia', 'ollama-cloud': 'ollama-cloud', 'ollamacloud': 'ollama-cloud',
    'opencode-zen': 'opencode', 'opencode-go': 'opencode', 'opencode': 'opencode', 'venice': 'venice', 'pollinations': 'pollinations',
    'publicai': 'openai', 'unturf': 'unturf', 'unturf-hermes': 'unturf',
    'g4f': 'openai',
    'deepseek-ai': 'deepseek', 'deepseek': 'deepseek',
    'meta': 'meta', 'moonshotai': 'moonshot', 'z-ai': 'zhipu',
    'mistralai': 'mistral', 'mistral': 'mistral',
    'aisingapore': 'ai-singapore', 'allenai': 'allennlp',
    'swiss-ai': 'swissai',
    'groq': 'groq', 'openrouter': 'openrouter',
    'cerebras': 'cerebras', 'together': 'together-ai',
    'fireworks': 'fireworks-ai'
};

export function getApiProviderMeta(id) {
    return API_PROVIDERS.find(p => p.id === id) || API_PROVIDERS[0];
}

// Load models.dev cache from storage

export function getActiveProvider(s) {
    if (!s.providers || !s.providers.length) return null;
    const active = s.providers.find(p => p.id === s.activeProviderId);
    if (active && active.kind !== 'search') return active;
    return s.providers.find(p => p.kind !== 'search') || null;
}

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
            <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" loading="lazy">
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
                <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" loading="lazy">
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

    const standard = settings.providers.filter(p => p.type !== 'other' && p.kind !== 'search');
    const search = settings.providers.filter(p => p.kind === 'search');
    const custom = settings.providers.filter(p => p.type === 'other' && p.kind !== 'search');

    let html = '<div class="providers-section">';
    html += `<div class="providers-section-header">${t('providersHeader')}</div>`;
    if (standard.length) {
        html += standard.map(p => renderProviderCard(p)).join('');
    } else {
        html += `<div class="provider-empty-hint">${t('noProviders')}</div>`;
    }
    html += `<button type="button" class="add-provider-btn" data-section="standard">${t('addProvider')}</button>`;
    html += '</div>';

    // Web Search providers section (always show with add button)
    html += '<div class="providers-section">';
    html += `<div class="providers-section-header">🔍 ${t('webSearchLabel')}</div>`;
    if (search.length) {
        html += search.map(p => renderProviderCard(p)).join('');
    }
    html += `<button type="button" class="add-provider-btn" data-section="search">${t('addProvider')}</button>`;
    html += '</div>';

    html += '<div class="providers-section">';
    html += `<div class="providers-section-header">${t('otherHeader')} <span class="providers-section-hint">${t('otherHint')}</span></div>`;
    if (custom.length) {
        html += custom.map(p => renderProviderCard(p)).join('');
    }
    html += `<button type="button" class="add-provider-btn" data-section="other">${t('addCustomProvider')}</button>`;
    html += '</div>';

    container.innerHTML = html;
    attachProviderCardListeners(container);
}

export function getProviderLogo(p) {
    if (p.type === 'other') return 'openai';
    const meta = getApiProviderMeta(p.type);
    return meta ? meta.logo : 'openai';
}

export function renderProviderCard(p) {
    const logo = getProviderLogo(p);
    const isActive = p.id === settings.activeProviderId;
    const activeBadge = isActive ? '<span class="provider-active-badge">active</span>' : '';
    const searchBadge = p.kind === 'search' ? '<span class="provider-search-badge">🔍 SEARCH</span>' : '';
    const keyPreview = p.apiKey ? '••••' + p.apiKey.slice(-4) : '—';
    const isOther = p.type === 'other';
    const urlLine = isOther ? `<span class="provider-card-url">${escapeHTML(p.baseUrl)}</span>` : '';

    const isSearch = p.kind === 'search';
    const activateBtn = isSearch ? '' : '<button type="button" class="provider-card-btn provider-activate-btn" data-id="' + p.id + '" title="Set active">✓</button>';

    return `<div class="provider-card${isActive && !isSearch ? ' active' : ''}" data-id="${p.id}">
        <div class="provider-card-header">
            <img class="provider-icon large" src="https://models.dev/logos/${logo}.svg" alt="" loading="lazy">
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
            const isOther = btn.dataset.section === 'other';
            const isSearch = btn.dataset.section === 'search';
            showProviderForm(null, isOther, isSearch);
        });
    });
}

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
