// src/popup/models.ts
// @ts-nocheck — popup UI module. Models.dev metadata, provider model fetching and model list UI.
import { PROVIDER_ICON_MAP, getActiveProvider } from './providers';
import { allModels, modelsDevCache, providerModelsCache, setAllModels, setModelsDevCache, settings, uiElements } from './state';
import { autoSave } from './settings';
import { escapeHTML, makeRequest } from './utils';
import { t } from './i18n';

export const NON_CHAT_TYPES = new Set(['embedding', 'rerank', 'audio', 'image', 'video', 'tts', 'stt', 'speech']);

export async function loadModelsDevCache() {
    try {
        const data = await chrome.storage.local.get('xdAnswers_modelsDev');
        if (data.xdAnswers_modelsDev) {
            setModelsDevCache(JSON.parse(data.xdAnswers_modelsDev));
        }
    } catch {}
}

export function getModelDevInfo(modelId) {
    if (!modelsDevCache || !modelId) return null;
    return modelsDevCache[modelId] ||
           modelsDevCache[modelId.replace(/^[^/]+\//, '')] ||
           null;
}

export const MODEL_NAME_ACRONYMS = new Set([
    'gpt', 'glm', 'qwq', 'gpu', 'api', 'llm', 'llms', 'ai', 'xai',
    'mai', 'rlhf', 'moe', 'vlm', 'hd', 'sdk', 'gguf', 'fp8', 'fp16',
    'int4', 'int8', 'ocr', 'tts', 'stt', 'oss', 'mlx', 'awq',
    'gptq', 'bnb', 'cpu', 'tpu', 'npu', 'mtp'
]);

export function formatModelName(id) {
    if (!id) return '';
    // Strip provider prefix ("google/...", "openai/...").
    let name = id.replace(/^[^/]+\//, '');
    // Normalise common separators to spaces, but keep dots (decimals) intact.
    name = name.replace(/[_:]+/g, ' ').replace(/-+/g, ' ').replace(/\s+/g, ' ').trim();
    // Title-case each whitespace-separated token, with a few tweaks:
    //  - Preserve pure-numeric tokens (including decimals like "3.1").
    //  - Uppercase well-known acronyms (gpt → GPT).
    //  - Keep letter+digits tokens like "k2.5" / "4o" readable: capitalise
    //    the leading letter(s), keep the rest as-is.
    return name.split(' ').map((token) => {
        if (!token) return token;
        const lower = token.toLowerCase();
        if (MODEL_NAME_ACRONYMS.has(lower)) return lower.toUpperCase();
        if (/^\d+(\.\d+)*$/.test(token)) return token;           // 3.1, 2024, 05
        // Capitalise leading alphabetic run, preserve the rest.
        return token.replace(/^([a-z]+)/i, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
    }).join(' ');
}

export function getProviderIcon(ownedBy) {
    const key = (ownedBy || '').toLowerCase();
    for (const [pattern, icon] of Object.entries(PROVIDER_ICON_MAP)) {
        if (key === pattern || key.startsWith(pattern)) return icon;
    }
    return null;
}

export function getModelFamilyIcon(modelId) {
    const id = (modelId || '').toLowerCase();
    const root = id.split('/').pop() || id;
    const families = [
        ['gpt', 'openai'], ['o1', 'openai'], ['o3', 'openai'], ['o4', 'openai'],
        ['claude', 'anthropic'], ['gemini', 'google'], ['gemma', 'google'],
        ['deepseek', 'deepseek'], ['llama', 'meta'], ['qwen', 'qwen'],
        ['mistral', 'mistral'], ['mixtral', 'mistral'], ['ministral', 'mistral'],
        ['kimi', 'moonshot'], ['moonshot', 'moonshot'], ['grok', 'xai'],
        ['command', 'cohere'], ['cohere', 'cohere'], ['minimax', 'minimax'],
        ['phi', 'microsoft'], ['nemo', 'nvidia']
    ];
    for (const [needle, icon] of families) {
        if (root.includes(needle)) return icon;
    }
    return getProviderIcon(id.split('/')[0]) || null;
}

export function formatContextLength(ctx) {
    if (!ctx) return '';
    if (ctx >= 1000000) return (ctx / 1000000).toFixed(1).replace(/\.0$/, '') + t('ctxMillion');
    if (ctx >= 1000) return (ctx / 1000).toFixed(0) + t('ctxThousand');
    return String(ctx);
}

export function processModels(rawModels, format) {
    let models;
    if (format === 'google') {
        models = (rawModels.models || []).map(m => ({
            id: m.name?.replace('models/', '') || m.name,
            ownedBy: 'google',
            contextLength: m.inputTokenLimit || null,
            type: null
        }));
    } else {
        const rawList = Array.isArray(rawModels.data) ? rawModels.data : (Array.isArray(rawModels) ? rawModels : []);
        models = rawList.map(m => {
            if (typeof m === 'string') {
                return {
                    id: m,
                    title: m,
                    ownedBy: 'local',
                    root: m,
                    type: null
                };
            }
            return {
                id: m.id || m.name,
                title: m.title || m.display_name || m.name || null,
                description: m.description || null,
                ownedBy: m.owned_by || m.ownedBy || '',
                root: m.root || m.id || m.name,
                parent: m.parent || null,
                contextLength: m.context_length || m.context_size || null,
                maxOutputTokens: m.max_output_tokens || null,
                capabilities: m.capabilities || null,
                tags: Array.isArray(m.tags) ? m.tags : [],
                features: Array.isArray(m.features) ? m.features : [],
                pricing: (m.input_token_price_per_m !== undefined && m.output_token_price_per_m !== undefined) ? {
                    input: m.input_token_price_per_m / 100,
                    output: m.output_token_price_per_m / 100
                } : null,
                status: m.status,
                type: m.type || m.model_type || null
            };
        });
    }

    // Filter out non-chat types (embedding, image, audio, rerank, etc.)
    models = models.filter(m => {
        if (!m.id) return false;
        if (m.type && NON_CHAT_TYPES.has(m.type)) return false;
        if (m.type === 'embedding' || m.type === 'rerank') return false;
        return true;
    });

    // Deduplicate by root — keep the primary model (parent === null),
    // drop aliases (parent !== null) that point to the same root.
    const byRoot = new Map(); // root → primary model entry
    const byId = new Map();   // id (lowercase) → model entry (fallback dedup)
    for (const m of models) {
        const root = m.root || m.id;
        const idKey = m.id.toLowerCase();
        // Exact ID dedup (case-insensitive)
        if (byId.has(idKey)) continue;
        byId.set(idKey, m);

        if (!byRoot.has(root)) {
            byRoot.set(root, m);
        } else {
            const existing = byRoot.get(root);
            // Prefer the model WITHOUT a parent (primary) over one with a parent (alias)
            if (existing.parent && !m.parent) {
                byRoot.set(root, m);
            }
            // If both or neither have parent, keep the first one (shorter prefix = cleaner)
        }
    }

    // Collect deduplicated results: unique by root, plus any leftover unique-by-id entries
    const seenRoots = new Set();
    const result = [];
    for (const m of byId.values()) {
        const root = m.root || m.id;
        if (!seenRoots.has(root)) {
            seenRoots.add(root);
            result.push(byRoot.get(root) || m);
        }
    }

    return result;
}

export async function fetchModelsForProvider(provider) {
    const format = window.xdAnswers._internal.API_FORMAT_MAP[provider.type] || (provider.type === 'other' ? 'openai' : provider.type);
    const base = provider.baseUrl.replace(/\/+$/, '');
    const key = provider.apiKey;
    const hasRealKey = key && key !== 'free';
    let url, headers = {};

    // Skip auth headers for /models on custom providers — Authorization/x-api-key
    // triggers CORS preflight which Firefox enforces even with host_permissions.
    // Known providers (OpenAI, Anthropic, etc.) handle CORS properly.
    const KNOWN_MODEL_PROVIDERS = new Set([
        'openai', 'anthropic', 'google', 'deepseek', 'groq', 'openrouter',
        'cerebras', 'together', 'fireworks', 'mistral',
        'opencode-zen', 'opencode-go', 'ollama-cloud', 'other'
    ]);

    // Check if host is local or custom
    const isLocalOrOther = provider.type === 'other' || base.includes('localhost') || base.includes('127.0.0.1') || base.includes('0.0.0.0') || base.includes('::1');

    if (format === 'openai') {
        url = `${base}/models`;
        if (hasRealKey && (KNOWN_MODEL_PROVIDERS.has(provider.type) || isLocalOrOther)) {
            headers['Authorization'] = `Bearer ${key}`;
        }
    } else if (format === 'anthropic') {
        url = `${base}/models`;
        if (hasRealKey && (KNOWN_MODEL_PROVIDERS.has(provider.type) || isLocalOrOther)) {
            headers['x-api-key'] = key;
            headers['anthropic-version'] = '2023-06-01';
        }
    } else if (format === 'google') {
        url = `${base}/models${hasRealKey ? '?key=' + key : ''}`;
    } else {
        return [];
    }

    const response = await makeRequest({ url, method: 'GET', headers });
    let parsed;
    try {
        parsed = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } catch (err) {
        console.error('Failed to parse models response JSON:', err, response.data);
        return [];
    }

    // Support responses formatted as raw array [ { id: ... } ] or OpenAI standard { data: [ ... ] } or Ollama { models: [ ... ] }
    if (Array.isArray(parsed)) {
        parsed = { data: parsed };
    } else if (parsed && Array.isArray(parsed.models) && format !== 'google') {
        parsed = { data: parsed.models };
    }

    let models = processModels(parsed, format);

    const isOpenCodeZenWithoutKey = provider.type === 'opencode-zen' && !hasRealKey;
    if (isOpenCodeZenWithoutKey) {
        models = models.filter(m => {
            const id = m.id.toLowerCase();
            return id.endsWith('-free') || id === 'big-pickle' || id.endsWith('/big-pickle');
        });
        // Ensure big-pickle is in list even if API /models does not return it yet
        if (!models.some(m => m.id.toLowerCase() === 'big-pickle')) {
            models.unshift({
                id: 'big-pickle',
                ownedBy: 'opencode',
                root: 'big-pickle',
                contextLength: 200000
            });
        }
    }

    return models;
}

export async function fetchModels() {
    const btn = uiElements.fetchModelsBtn;
    if (!btn) return;
    btn.classList.add('spinning');
    try {
        const active = getActiveProvider(settings);
        if (!active) { btn.classList.remove('spinning'); return; }
        setAllModels(await fetchModelsForProvider(active));
        providerModelsCache[active.id] = allModels;
        renderModelList();
        if (!allModels || allModels.length === 0) {
            console.warn('fetchModels: returned 0 models for', active.baseUrl);
        }
    } catch (e) {
        console.error('Failed to fetch models:', e);
    } finally {
        btn.classList.remove('spinning');
    }
}

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
    const MAX_VISIBLE = 60;
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
            ? `<img class="provider-icon" src="https://models.dev/logos/${icon}.svg" alt="" loading="lazy">`
            : `<span class="provider-icon-fallback">${(provider[0] || '?').toUpperCase()}</span>`;
        html += `<div class="model-provider-group">
            <div class="model-provider-header">${iconHtml}<span>${provider}</span>
            <span class="model-provider-count">${groups[provider].length}</span></div>`;

        for (const m of groups[provider]) {
            if (count >= MAX_VISIBLE) break;
            const ctxHtml = m.contextLength ? `<span class="model-ctx">${formatContextLength(m.contextLength)}</span>` : '';
            const familyIcon = getModelFamilyIcon(m.id);
            const modelIcon = familyIcon
                ? `<img class="model-icon" src="https://models.dev/logos/${familyIcon}.svg" alt="" loading="lazy">`
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

    // Scroll selected into view
    const selectedEl = list.querySelector('.model-item.selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });

    list.querySelectorAll('.model-item').forEach(el => {
        el.addEventListener('click', async () => {
            input.value = el.dataset.modelId;
            await autoSave({ model: el.dataset.modelId });
            renderModelList();
        });
    });
}
