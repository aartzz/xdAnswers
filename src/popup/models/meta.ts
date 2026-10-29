// @ts-nocheck — popup UI module. Models.dev metadata, model name formatting and icons.
import { PROVIDER_ICON_MAP } from '../providers';
import { modelsDevCache, setModelsDevCache } from '../core/state';
import { t } from '../core/i18n';


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

const modelNameCache = new Map();

export function formatModelName(id) {
    if (!id) return '';
    if (modelNameCache.has(id)) return modelNameCache.get(id);
    // Strip provider prefix ("google/...", "openai/...").
    let name = id.replace(/^[^/]+\//, '');
    // Normalise common separators to spaces, but keep dots (decimals) intact.
    name = name.replace(/[_:]+/g, ' ').replace(/-+/g, ' ').replace(/\s+/g, ' ').trim();
    // Title-case each whitespace-separated token, with a few tweaks:
    const formatted = name.split(' ').map((token) => {
        if (!token) return token;
        const lower = token.toLowerCase();
        if (MODEL_NAME_ACRONYMS.has(lower)) return lower.toUpperCase();
        if (/^\d+(\.\d+)*$/.test(token)) return token;           // 3.1, 2024, 05
        // Capitalise leading alphabetic run, preserve the rest.
        return token.replace(/^([a-z]+)/i, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
    }).join(' ');
    modelNameCache.set(id, formatted);
    return formatted;
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
