// @ts-nocheck — popup UI module. Provider catalogue, icon map and active provider lookup.

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
    { id: 'mcp', name: 'MCP (remote)', hint: 'Web Search — remote MCP server (Streamable HTTP)', logo: 'mcp', kind: 'search' },
    { id: 'langsearch', name: 'LangSearch', hint: 'Search API — Free', logo: 'openai', kind: 'search' },
    { id: 'serper', name: 'Serper.dev', hint: 'Search API — 2,500 free/month', logo: 'openai', kind: 'search' },
    { id: 'perplexity', name: 'Perplexity', hint: 'Search API — pplx- API key', logo: 'openai', kind: 'search' },
    { id: 'exa', name: 'Exa', hint: 'Search API — free neural search or API key', logo: 'openai', kind: 'search' },
    { id: 'tavily', name: 'Tavily', hint: 'Search API — tvly- API key', logo: 'openai', kind: 'search' },
    { id: 'linkup', name: 'Linkup', hint: 'Search API — fast/standard/deep', logo: 'openai', kind: 'search' },
    { id: 'searchapi', name: 'SearchAPI', hint: 'Search API — Google/Bing/Yahoo', logo: 'openai', kind: 'search' },
    { id: 'searxng', name: 'SearXNG', hint: 'Search API — Open-source, no API key', logo: 'openai', kind: 'search' }
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

export const MCP_PROVIDERS = [
    { id: 'exa', name: 'Exa MCP', hint: 'Free keyless web search', logo: 'exa', url: 'https://mcp.exa.ai/mcp' },
    { id: 'tavily', name: 'Tavily MCP', hint: 'Keyless mode or API key', logo: 'tavily', url: 'https://mcp.tavily.com/mcp/' },
    { id: 'parallel', name: 'Parallel MCP', hint: 'Free keyless web search', logo: 'parallel', url: 'https://mcp.parallel.ai/mcp' },
    { id: 'tinyfish', name: 'TinyFish MCP', hint: 'Requires a token/API key', logo: 'tinyfish', url: 'https://agent.tinyfish.ai/mcp' }
];

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
