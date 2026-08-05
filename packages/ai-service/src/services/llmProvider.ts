import axios from 'axios';

export interface ProviderConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  authType?: 'bearer' | 'api-key' | 'none';
}

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage = {
  role: string;
  content: string | ChatContentPart[];
};

interface LlmOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

const DEFAULT_TIMEOUT = 180000;
const MAX_RETRIES = 3;

function isRetryableStatus(status: number | undefined): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function postWithRetry(url: string, body: any, headers: Record<string, string>): Promise<any> {
  let lastErr: any = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await axios.post(url, body, { headers, timeout: DEFAULT_TIMEOUT });
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (attempt < MAX_RETRIES && isRetryableStatus(status)) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function providerError(err: any): Error {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const msg = (data && (data.error?.message || data.error?.code || data.message)) || err?.message || 'LLM provider error';
  const e = new Error(status ? `[${status}] ${msg}` : msg);
  (e as any).status = status;
  return e;
}

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

/**
 * Resolve the chat-completions endpoint from a provider base URL.
 * Handles the common convention where the stored baseUrl may or may not
 * include the trailing `/v1` (e.g. "https://api.openai.com/v1" vs
 * "https://api.openai.com") and may already contain the full
 * `/v1/chat/completions` path.
 */
function resolveChatEndpoint(baseUrl: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  if (/\/v1\/chat\/completions$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function textFromContent(content: string | ChatContentPart[]): string {
  if (typeof content === 'string') return content;
  return content.filter((p) => p.type === 'text').map((p) => (p as any).text).join('\n');
}

function splitDataUri(uri: string): { mime: string; data: string } | null {
  const match = uri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], data: match[2] };
}

async function callOpenAiCompatible(
  config: ProviderConfig,
  messages: ChatMessage[],
  options?: LlmOptions
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const endpoint = baseUrl.includes('generativelanguage')
    ? baseUrl
    : resolveChatEndpoint(baseUrl);

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
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: typeof m.content === 'string'
        ? [{ text: m.content }]
        : m.content.map((p) => {
            if (p.type === 'text') return { text: p.text };
            const decoded = splitDataUri(p.image_url.url);
            if (decoded) {
              return { inline_data: { mime_type: decoded.mime, data: decoded.data } };
            }
            return { text: '' };
          }),
    }));
    const res = await postWithRetry(
      `${endpoint}/v1beta/models/${config.model}:generateContent${key}`,
      { contents, generationConfig: { temperature: options?.temperature ?? 0.7, maxOutputTokens: options?.maxTokens ?? 2048 } },
      headers
    );
    return (res.data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('') || '';
  }

  const res = await postWithRetry(endpoint, body, headers);
  return res.data?.choices?.[0]?.message?.content || '';
}

async function callOllama(
  config: ProviderConfig,
  messages: ChatMessage[]
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const systemMsg = messages.find((m) => m.role === 'system');
  const prompt = messages.map((m) => textFromContent(m.content)).filter(Boolean).join('\n');

  const images: string[] = [];
  for (const m of messages) {
    if (typeof m.content === 'string') continue;
    for (const p of m.content) {
      if (p.type === 'image_url') {
        const decoded = splitDataUri(p.image_url.url);
        if (decoded) images.push(decoded.data);
      }
    }
  }

  const body: any = {
    model: config.model,
    prompt,
    system: systemMsg ? textFromContent(systemMsg.content) : '',
    stream: false,
  };
  if (images.length) body.images = images;

  const res = await axios.post(`${baseUrl}/api/generate`, body, { timeout: DEFAULT_TIMEOUT });
  return res.data?.response || '';
}

export async function callLlm(
  config: ProviderConfig,
  messages: ChatMessage[],
  options?: LlmOptions
): Promise<string> {
  try {
    if (isOpenAiCompatible(config.baseUrl)) {
      return await callOpenAiCompatible(config, messages, options);
    }
    return await callOllama(config, messages);
  } catch (err: any) {
    throw providerError(err);
  }
}

export function buildDefaultConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    baseUrl: overrides?.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434',
    model: overrides?.model || process.env.OLLAMA_LLM_MODEL || 'llama3',
    apiKey: overrides?.apiKey,
    authType: overrides?.authType || 'none',
  };
}
