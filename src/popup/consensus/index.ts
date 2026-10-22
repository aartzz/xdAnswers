// src/popup/consensus/index.ts
// @ts-nocheck — popup UI module. Consensus runs UI and per-run model selectors.
import { autoSave } from '../core/settings';
import { escapeHTML } from '../core/utils';
import { fetchModelsForProvider, formatContextLength, formatModelName, getModelDevInfo, getModelFamilyIcon, getProviderIcon } from '../models';
import { modelsDevCache, providerModelsCache, settings, uiElements } from '../core/state';
import { t } from '../core/i18n';


export const consensusModelSaveTimers = {};

export function getConsensusProviderDevKey(providerType) {
    const provKeyLookup = {
        openai: 'openai', anthropic: 'anthropic', google: 'google',
        deepseek: 'deepseek', groq: 'groq', openrouter: 'openrouter',
        cerebras: 'cerebras', together: 'together-ai', fireworks: 'fireworks-ai', mistral: 'mistral',
        'opencode-zen': 'opencode', 'opencode-go': 'opencode-go', 'ollama-cloud': 'ollama-cloud', nvidia: 'nvidia'
    };
    return provKeyLookup[providerType] || providerType || '';
}

export function renderConsensusModelList(runIdx) {
    const container = uiElements.consensusRunsContainer;
    if (!container) return;

    const card = container.querySelector(`.consensus-run-card[data-run-index="${runIdx}"]`);
    if (!card) return;

    const run = settings.consensus?.runs?.[runIdx];
    if (!run) return;

    const list = card.querySelector('.consensus-run-model-list');
    const input = card.querySelector('.consensus-run-model-input');
    if (!list || !input) return;

    const currentValue = run.model || '';
    const query = input.value.toLowerCase().trim();

    const effectiveProviderId = run.providerId || settings.activeProviderId || '';
    const provider = (settings.providers || []).find(p => p.id === effectiveProviderId);
    const devProvId = getConsensusProviderDevKey(provider?.type || '');
    const hasRealKey = provider?.apiKey && provider.apiKey !== 'free';
    const isOpenCodeZenWithoutKey = provider?.type === 'opencode-zen' && !hasRealKey;

    // Use cached API models first, fallback to modelsDevCache
    const cachedModels = providerModelsCache[run.providerId];
    let providerModels = cachedModels ? [...cachedModels] : [];

    if (!providerModels.length && devProvId && modelsDevCache) {
        for (const [key, info] of Object.entries(modelsDevCache)) {
            if (key.includes('/')) continue;
            if (info.p === devProvId) {
                if (isOpenCodeZenWithoutKey) {
                    const idLower = key.toLowerCase();
                    if (!idLower.endsWith('-free') && idLower !== 'big-pickle') continue;
                }
                providerModels.push({
                    id: key,
                    ownedBy: info.p || 'other',
                    root: key,
                    contextLength: info.l?.c || null
                });
            }
        }
        if (isOpenCodeZenWithoutKey && !providerModels.some(m => m.id.toLowerCase() === 'big-pickle')) {
            providerModels.unshift({
                id: 'big-pickle',
                ownedBy: 'opencode',
                root: 'big-pickle',
                contextLength: 200000
            });
        }
    }

    const hasModels = providerModels.length > 0;
    let filtered = providerModels;
    if (query) {
        filtered = providerModels.filter(m =>
            m.id.toLowerCase().includes(query) ||
            formatModelName(m.id).toLowerCase().includes(query) ||
            (m.ownedBy || '').toLowerCase().includes(query)
        );
    }

    const groups = {};
    for (const m of filtered) {
        const providerKey = m.ownedBy || 'other';
        if (!groups[providerKey]) groups[providerKey] = [];
        groups[providerKey].push(m);
    }

    const sortedProviders = Object.keys(groups).sort();
    const MAX_VISIBLE = 60;
    let count = 0;
    let html = '';

    if (!provider || !hasModels) {
        html = '<div class="model-empty">No models available</div>';
        list.innerHTML = html;
        return;
    }

    const exactMatch = providerModels.some(m => m.id.toLowerCase() === input.value.trim().toLowerCase());
    if (input.value.trim() && !exactMatch) {
        html += `<div class="model-item custom" data-model-id="${escapeHTML(input.value.trim())}">
            <span class="model-item-main"><span class="provider-icon-fallback">✎</span><span class="model-item-subtext"><span class="model-item-name">${escapeHTML(input.value.trim())}</span><span class="model-item-provider">${t('customModel')}</span></span></span>
        </div>`;
        count++;
    }

    for (const providerKey of sortedProviders) {
        if (count >= MAX_VISIBLE) break;
        const icon = getProviderIcon(providerKey);
        const iconHtml = icon
            ? `<img class="provider-icon" src="https://models.dev/logos/${icon}.svg" alt="" loading="lazy">`
            : `<span class="provider-icon-fallback">${(providerKey[0] || '?').toUpperCase()}</span>`;
        html += `<div class="model-provider-group">
            <div class="model-provider-header">${iconHtml}<span>${providerKey}</span>
            <span class="model-provider-count">${groups[providerKey].length}</span></div>`;

        for (const m of groups[providerKey]) {
            if (count >= MAX_VISIBLE) break;
            const ctxHtml = m.contextLength ? `<span class="model-ctx">${formatContextLength(m.contextLength)}</span>` : '';
            const familyIcon = getModelFamilyIcon(m.id);
            const modelIcon = familyIcon
                ? `<img class="model-icon" src="https://models.dev/logos/${familyIcon}.svg" alt="" loading="lazy">`
                : `<span class="provider-icon-fallback">${(formatModelName(m.root || m.id)[0] || '?').toUpperCase()}</span>`;
            const providerLabel = escapeHTML(m.ownedBy || 'other');
            const isSelected = m.id === currentValue;

            const devInfo = getModelDevInfo(m.id);
            const badges = [];
            const hasVision = devInfo?.a || m.capabilities?.vision;
            const hasReasoning = devInfo?.r || m.capabilities?.reasoning;
            const hasToolCalling = m.capabilities?.tool_calling;
            if (hasVision) badges.push(`<span class="model-badge vision" title="${t('badgeVision')}">🖼️</span>`);
            if (hasReasoning) badges.push(`<span class="model-badge reasoning" title="${t('badgeReasoning')}">🧠</span>`);
            if (hasToolCalling) badges.push(`<span class="model-badge tool-calling" title="${t('badgeToolCalling')}">🔧</span>`);
            if (devInfo?.c) {
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
            const badgesHtml = badges.join('');
            const selectedClass = isSelected ? ' selected' : '';

            html += `<div class="model-item${selectedClass}" data-model-id="${m.id}">
                <span class="model-item-main">${modelIcon}<span class="model-item-subtext"><span class="model-item-name">${escapeHTML(formatModelName(m.root || m.id))}</span><span class="model-item-provider">${providerLabel}</span></span></span><span class="model-badges">${badgesHtml}${ctxHtml}</span>
            </div>`;
            count++;
        }
        html += '</div>';
    }

    if (filtered.length > MAX_VISIBLE) {
        html += `<div class="model-more">+${filtered.length - MAX_VISIBLE} more — type to filter</div>`;
    }
    if (count === 0 && !input.value.trim()) {
        html = '<div class="model-empty">No models available</div>';
    } else if (count === 0) {
        html = '<div class="model-empty">No models found</div>';
    }

    list.innerHTML = html;

    const selectedEl = list.querySelector('.model-item.selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });

    list.querySelectorAll('.model-item').forEach(el => {
        el.addEventListener('click', async () => {
            input.value = el.dataset.modelId;
            settings.consensus.runs[runIdx].model = el.dataset.modelId;
            await autoSave();
            renderConsensusModelList(runIdx);
        });
    });
}

export function renderConsensusRuns() {
    const container = uiElements.consensusRunsContainer;
    if (!container) return;

    const enabled = !!(settings.consensus && settings.consensus.enabled);
    container.style.display = enabled ? 'block' : 'none';
    if (uiElements.addConsensusRunBtn) {
        uiElements.addConsensusRunBtn.style.display = enabled ? 'inline-block' : 'none';
    }
    if (!enabled) {
        container.innerHTML = '';
        return;
    }

    const nonSearchProviders = (settings.providers || []).filter(p => p.kind !== 'search');
    const runs = (settings.consensus && settings.consensus.runs) || [];

    container.innerHTML = runs.map((run, idx) => {
        const effectiveProviderId = run.providerId || '';
        const selectedProvider = (settings.providers || []).find(p => p.id === effectiveProviderId);
        const providerOptions = nonSearchProviders.map(p => 
            '<option value="' + escapeHTML(p.id) + '" ' + (p.id === effectiveProviderId ? 'selected' : '') + '>' + escapeHTML(p.name) + '</option>'
        ).join('') || '<option value="">' + escapeHTML(t('consensusNoProviders')) + '</option>';

        return '<div class="consensus-run-card" data-run-index="' + idx + '">' +
            '<div class="consensus-run-model-panel">' +
                '<div class="consensus-run-provider-row">' +
                    '<select class="consensus-run-provider-select">' + providerOptions + '</select>' +
                '</div>' +
                '<div class="consensus-run-model-search">' +
                    '<input type="text" class="consensus-run-model-input" value="' + escapeHTML(run.model || '') + '" placeholder="' + escapeHTML(t('searchModel')) + '" autocomplete="off">' +
                '</div>' +
                '<div class="consensus-run-model-list"></div>' +
            '</div>' +
            '<div class="consensus-run-bottom">' +
                '<div class="consensus-run-info">' +
                    '<span class="consensus-run-icon">' + escapeHTML(selectedProvider ? selectedProvider.name.charAt(0).toUpperCase() : '🤖') + '</span>' +
                    '<div class="consensus-run-meta">' +
                        '<span class="consensus-run-model-name">' + escapeHTML(run.model || '') + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="consensus-run-actions">' +
                    '<div class="consensus-answeronly-wrap">' +
                        '<label class="consensus-answeronly-toggle"><input type="checkbox" class="consensus-run-answeronly"' + (run.showAnswerOnly ? ' checked' : '') + '><span class="toggle-slider"></span></label>' +
                        '<span class="consensus-answeronly-label">' + escapeHTML(t('consensusAnswerOnly')) + '</span>' +
                    '</div>' +
                    '<button type="button" class="consensus-run-remove" title="' + t('consensusRemoveRun') + '">✕</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');

    // Wire events for run cards
    container.querySelectorAll('.consensus-run-card').forEach((card, idx) => {
        const modelInput = card.querySelector('.consensus-run-model-input');
        const answerOnlyCheckbox = card.querySelector('.consensus-run-answeronly');
        const removeBtn = card.querySelector('.consensus-run-remove');
        const modelNameEl = card.querySelector('.consensus-run-model-name');

        const run = settings.consensus.runs[idx];

        // Pre-fetch models for this run's provider if needed
        const effectiveProviderId = run.providerId || '';
        const provider = (settings.providers || []).find(p => p.id === effectiveProviderId);
        if (provider && !providerModelsCache[provider.id]) {
            fetchModelsForProvider(provider).then(models => {
                providerModelsCache[provider.id] = models;
                renderConsensusModelList(idx);
            }).catch(() => {});
        }

        const providerSelect = card.querySelector('.consensus-run-provider-select');
        if (providerSelect) providerSelect.onchange = async () => {
            settings.consensus.runs[idx].providerId = providerSelect.value;
            const newProvider = (settings.providers || []).find(p => p.id === providerSelect.value);
            const iconSpan = card.querySelector('.consensus-run-icon');
            if (iconSpan) iconSpan.textContent = newProvider ? newProvider.name.charAt(0).toUpperCase() : '🤖';
            if (newProvider && !providerModelsCache[newProvider.id]) {
                try {
                    const models = await fetchModelsForProvider(newProvider);
                    providerModelsCache[newProvider.id] = models;
                } catch (e) {}
            }
            renderConsensusModelList(idx);
            autoSave();
        };

        if (modelInput) modelInput.oninput = () => {
            settings.consensus.runs[idx].model = modelInput.value.trim();
            if (modelNameEl) modelNameEl.textContent = modelInput.value.trim() || '';
            renderConsensusModelList(idx);
            clearTimeout(consensusModelSaveTimers[idx]);
            consensusModelSaveTimers[idx] = setTimeout(() => autoSave(), 300);
        };
        if (modelInput) modelInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                settings.consensus.runs[idx].model = modelInput.value.trim();
                if (modelNameEl) modelNameEl.textContent = modelInput.value.trim() || '';
                clearTimeout(consensusModelSaveTimers[idx]);
                autoSave();
                renderConsensusModelList(idx);
            }
        };
        if (answerOnlyCheckbox) answerOnlyCheckbox.onchange = () => {
            settings.consensus.runs[idx].showAnswerOnly = answerOnlyCheckbox.checked;
            autoSave();
        };
        if (removeBtn) removeBtn.onclick = () => {
            settings.consensus.runs.splice(idx, 1);
            renderConsensusRuns();
            autoSave();
        };

        renderConsensusModelList(idx);
    });
}
