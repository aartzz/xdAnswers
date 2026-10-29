// @ts-nocheck — popup UI module. Model list rendering.
import { getActiveProvider } from '../providers';
import { allModels, modelsDevCache, settings } from '../core/state';
import { autoSave } from '../core/settings';
import { escapeHTML } from '../core/utils';
import { t } from '../core/i18n';
import { formatContextLength, formatModelName, getModelDevInfo, getModelFamilyIcon, getProviderIcon } from './meta';


export function renderModelList() {
    const list = document.getElementById('model-list');
    const input = document.getElementById('model-name');
    if (!list || !input) return;

    const currentValue = settings.model || '';
    const query = input.value.toLowerCase().trim();

    // Merge API models + models.dev cache models
    let mergedModels = [...allModels];

    // If allModels is empty, build list from models.dev cache for current provider
    if (!mergedModels.length && modelsDevCache) {
        const active = getActiveProvider(settings);
        const provId = active?.type || '';
        const hasRealKey = active?.apiKey && active.apiKey !== 'free';
        const isOpenCodeZenWithoutKey = provId === 'opencode-zen' && !hasRealKey;
        const provKeyLookup = {
            openai: 'openai', anthropic: 'anthropic', google: 'google',
            deepseek: 'deepseek', groq: 'groq', openrouter: 'openrouter',
            cerebras: 'cerebras', together: 'together-ai', fireworks: 'fireworks-ai', mistral: 'mistral',
            'opencode-zen': 'opencode', 'opencode-go': 'opencode-go', 'ollama-cloud': 'ollama-cloud', nvidia: 'nvidia'
        };
        const devProvId = provKeyLookup[provId] || provId;
        for (const [key, info] of Object.entries(modelsDevCache)) {
            // Only take entries where p matches the provider, and key doesn't contain '/'
            if (key.includes('/')) continue; // skip composite keys
            if (info.p === devProvId || !devProvId) {
                if (isOpenCodeZenWithoutKey) {
                    const idLower = key.toLowerCase();
                    if (!idLower.endsWith('-free') && idLower !== 'big-pickle') continue;
                }
                mergedModels.push({
                    id: key,
                    ownedBy: info.p || 'other',
                    root: key,
                    contextLength: info.l?.c || null
                });
            }
        }
        if (isOpenCodeZenWithoutKey && !mergedModels.some(m => m.id.toLowerCase() === 'big-pickle')) {
            mergedModels.unshift({
                id: 'big-pickle',
                ownedBy: 'opencode',
                root: 'big-pickle',
                contextLength: 200000
            });
        }
    }

    // Filter by query
    let filtered = mergedModels;
    if (query) {
        filtered = mergedModels.filter(m =>
            m.id.toLowerCase().includes(query) ||
            formatModelName(m.id).toLowerCase().includes(query) ||
            (m.ownedBy || '').toLowerCase().includes(query)
        );
    }

    const groups = {};
    for (const m of filtered) {
        const provider = m.ownedBy || 'other';
        if (!groups[provider]) groups[provider] = [];
        groups[provider].push(m);
    }

    const sortedProviders = Object.keys(groups).sort();
    const MAX_VISIBLE = 30;
    let count = 0;
    let html = '';

    // Add custom model entry if input doesn't match any model exactly
    const exactMatch = mergedModels.some(m => m.id.toLowerCase() === input.value.trim().toLowerCase());
    if (input.value.trim() && !exactMatch) {
        html += `<div class="model-item custom" data-model-id="${escapeHTML(input.value.trim())}">
            <span class="model-item-main"><span class="provider-icon-fallback">✎</span><span class="model-item-subtext"><span class="model-item-name">${escapeHTML(input.value.trim())}</span><span class="model-item-provider">${t('customModel')}</span></span></span>
        </div>`;
        count++;
    }

    for (const provider of sortedProviders) {
        if (count >= MAX_VISIBLE) break;
        const icon = getProviderIcon(provider);
        const iconHtml = icon
            ? `<img class="provider-icon" src="https://models.dev/logos/${icon}.svg" alt="" width="16" height="16" loading="lazy" decoding="async">`
            : `<span class="provider-icon-fallback">${(provider[0] || '?').toUpperCase()}</span>`;
        html += `<div class="model-provider-group">
            <div class="model-provider-header">${iconHtml}<span>${provider}</span>
            <span class="model-provider-count">${groups[provider].length}</span></div>`;

        for (const m of groups[provider]) {
            if (count >= MAX_VISIBLE) break;
            const ctxHtml = m.contextLength ? `<span class="model-ctx">${formatContextLength(m.contextLength)}</span>` : '';
            const familyIcon = getModelFamilyIcon(m.id);
            const modelIcon = familyIcon
                ? `<img class="model-icon" src="https://models.dev/logos/${familyIcon}.svg" alt="" width="18" height="18" loading="lazy" decoding="async">`
                : `<span class="provider-icon-fallback">${(formatModelName(m.root || m.id)[0] || '?').toUpperCase()}</span>`;
            const providerLabel = escapeHTML(m.ownedBy || 'other');
            const isSelected = m.id === currentValue;

            // Enrich with models.dev data
            const devInfo = getModelDevInfo(m.id);
            const badges = [];
            const hasVision = devInfo?.a || m.capabilities?.vision || m.features?.includes('vision') || m.tags?.includes('native-multimodal');
            const hasReasoning = devInfo?.r || m.capabilities?.reasoning || m.tags?.includes('reasoning') || m.features?.includes('reasoning');
            const hasToolCalling = m.capabilities?.tool_calling || m.features?.includes('function-calling') || m.features?.includes('tools');
            if (hasVision) badges.push(`<span class="model-badge vision" title="${t('badgeVision')}">🖼️</span>`);
            if (hasReasoning) badges.push(`<span class="model-badge reasoning" title="${t('badgeReasoning')}">🧠</span>`);
            if (hasToolCalling) badges.push(`<span class="model-badge tool-calling" title="${t('badgeToolCalling')}">🔧</span>`);
            // Tags from API (skip if already covered above)
            if (m.tags?.includes('native-multimodal') && !hasVision) badges.push(`<span class="model-badge tag-multimodal" title="${t('badgeMultimodal')}">🎨</span>`);
            if (m.tags?.includes('ultra-long-context')) badges.push(`<span class="model-badge tag-longctx" title="${t('badgeLongContext')}">📏</span>`);
            if ((m.tags?.includes('coding') || m.tags?.includes('agentic')) && !hasReasoning) badges.push(`<span class="model-badge tag-agentic" title="${t('badgeAgentic')}">🤖</span>`);
            // Features from API (skip if already covered above)
            if (m.features?.includes('audio-input')) badges.push(`<span class="model-badge tag-audio" title="${t('badgeAudio')}">🎤</span>`);
            if (m.features?.includes('structured-outputs')) badges.push(`<span class="model-badge tag-structured" title="${t('badgeStructured')}">📋</span>`);
            if (m.features?.includes('web-search')) badges.push(`<span class="model-badge tag-websearch" title="${t('badgeWebSearch')}">🔍</span>`);
            // Pricing: prefer API data, fallback to models.dev
            if (m.pricing) {
                const inp = m.pricing.input, out = m.pricing.output;
                if (inp !== undefined && out !== undefined) {
                    const fmtCost = v => v === 0 ? '$0' : (v < 0.01 ? `$${v.toFixed(3)}` : `$${v}`);
                    const costStr = fmtCost(inp);
                    badges.push(`<span class="model-badge cost" title="${t('badgeCostInput')}: ${fmtCost(inp)}/M  ${t('badgeCostOutput')}: ${fmtCost(out)}/M">${costStr}/M</span>`);
                }
            } else if (devInfo?.c) {
                const inp = devInfo.c.i, out = devInfo.c.o;
                if (inp !== undefined && out !== undefined) {
                    const fmtCost = v => v === 0 ? '$0' : (v < 0.01 ? `$${v.toFixed(3)}` : `$${v}`);
                    const costStr = fmtCost(inp);
                    badges.push(`<span class="model-badge cost" title="${t('badgeCostInput')}: ${fmtCost(inp)}/M  ${t('badgeCostOutput')}: ${fmtCost(out)}/M">${costStr}/M</span>`);
                }
            }
            if (devInfo?.l?.c && !m.contextLength) {
                badges.push(`<span class="model-ctx">${formatContextLength(devInfo.l.c)}</span>`);
            }
            // Max output tokens from API (only if different from context length)
            if (m.maxOutputTokens && m.maxOutputTokens !== m.contextLength) {
                badges.push(`<span class="model-badge tag-maxtokens" title="${t('badgeMaxTokens')}">${formatContextLength(m.maxOutputTokens)} out</span>`);
            }
            const badgesHtml = badges.join('');
            const selectedClass = isSelected ? ' selected' : '';
            // Use title/display_name from API if available, fallback to formatted id
            const displayName = m.title || formatModelName(m.root || m.id);
            // Show description from API instead of ownedBy, fallback to ownedBy
            const subLabel = escapeHTML(m.description || m.ownedBy || 'other');
            // Truncate description to ~50 chars for the sub-label
            const truncatedSubLabel = subLabel.length > 55 ? subLabel.slice(0, 52) + '...' : subLabel;

            html += `<div class="model-item${selectedClass}" data-model-id="${m.id}">
                <span class="model-item-main">${modelIcon}<span class="model-item-subtext"><span class="model-item-name">${escapeHTML(displayName)}</span><span class="model-item-provider">${truncatedSubLabel}</span></span></span><span class="model-badges">${badgesHtml}${ctxHtml}</span>
            </div>`;
            count++;
        }
        html += '</div>';
    }

    if (filtered.length > MAX_VISIBLE) {
        html += `<div class="model-more">+${filtered.length - MAX_VISIBLE} more — type to filter</div>`;
    }
    if (count === 0 && !input.value.trim()) {
        html = '<div class="model-empty">No models loaded — click ↻ to fetch from API</div>';
    } else if (count === 0) {
        html = '<div class="model-empty">No models found</div>';
    }

    list.innerHTML = html;

    // Scroll selected into view only on initial render
    const selectedEl = list.querySelector('.model-item.selected');
    if (selectedEl && !query) selectedEl.scrollIntoView({ block: 'nearest' });

    if (!list._delegatedClick) {
        list._delegatedClick = true;
        list.addEventListener('click', async (e) => {
            const el = e.target.closest('.model-item');
            if (!el || !el.dataset.modelId) return;
            input.value = el.dataset.modelId;
            await autoSave({ model: el.dataset.modelId });
            renderModelList();
        });
    }
}
