// @ts-nocheck — popup UI module. Model list normalization and provider model fetching.
import { getActiveProvider } from '../providers';
import { allModels, providerModelsCache, setAllModels, settings, uiElements } from '../core/state';
import { makeRequest } from '../core/utils';
import { NON_CHAT_TYPES } from './meta';
import { renderModelList } from './list';


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
