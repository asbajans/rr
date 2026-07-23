import axios from 'axios';

export interface ProviderConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  authType?: 'bearer' | 'api-key' | 'none';
}

interface LlmOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

const DEFAULT_TIMEOUT = 15000;

function buildHeaders(config: ProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) {
    if (config.authType === 'api-key') {
      headers['X-API-Key'] = config.apiKey;
    } else {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
  }
  return headers;
}

function isOpenAiCompatible(baseUrl: string): boolean {
  const u = baseUrl.toLowerCase();
  return u.includes('openai') || u.includes('api.together') || u.includes('openrouter') ||
         u.includes('api.nvidia') || u.includes('api.deepseek') || u.includes('mistral') ||
         u.includes('anthropic') || u.includes('generativelanguage');
}

async function callOpenAiCompatible(
  config: ProviderConfig,
  messages: { role: string; content: string }[],
  options?: LlmOptions
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const endpoint = baseUrl.includes('generativelanguage')
    ? baseUrl
    : `${baseUrl}/v1/chat/completions`;

  const body: any = {
    model: config.model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };
  if (options?.topP !== undefined) body.top_p = options?.topP;

  const headers = buildHeaders(config);

  if (baseUrl.includes('generativelanguage')) {
    const key = config.apiKey ? `?key=${config.apiKey}` : '';
    const res = await axios.post(
      `${endpoint}/v1beta/models/${config.model}:generateContent${key}`,
      { contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : m.role, parts: [{ text: m.content }] })), generationConfig: { temperature: options?.temperature ?? 0.7, maxOutputTokens: options?.maxTokens ?? 2048 } },
      { timeout: DEFAULT_TIMEOUT }
    );
    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  const res = await axios.post(endpoint, body, { headers, timeout: DEFAULT_TIMEOUT });
  return res.data?.choices?.[0]?.message?.content || '';
}

async function callOllama(
  config: ProviderConfig,
  messages: { role: string; content: string }[]
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  const systemMsg = messages.find((m) => m.role === 'system');

  const res = await axios.post(`${baseUrl}/api/generate`, {
    model: config.model,
    prompt,
    system: systemMsg?.content || '',
    stream: false,
  }, { timeout: DEFAULT_TIMEOUT });

  return res.data?.response || '';
}

export async function callLlm(
  config: ProviderConfig,
  messages: { role: string; content: string }[],
  options?: LlmOptions
): Promise<string> {
  if (isOpenAiCompatible(config.baseUrl)) {
    return callOpenAiCompatible(config, messages, options);
  }
  return callOllama(config, messages);
}

export function buildDefaultConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    baseUrl: overrides?.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434',
    model: overrides?.model || process.env.OLLAMA_LLM_MODEL || 'llama3',
    apiKey: overrides?.apiKey,
    authType: overrides?.authType || 'none',
  };
}