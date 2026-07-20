import axios from 'axios';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LLM_MODEL = process.env.OLLAMA_LLM_MODEL || 'llama3';

export function getOllamaConfig() {
  return { url: OLLAMA_URL, model: LLM_MODEL };
}

export class OllamaUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('AI servisi şu an kullanılamıyor (Ollama bağlantısı yok). Lütfen daha sonra tekrar deneyin.');
    this.name = 'OllamaUnavailableError';
    this.cause = cause as Error;
  }
}

export async function callOllama(prompt: string, system?: string, options?: Record<string, any>): Promise<string> {
  try {
    const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: LLM_MODEL,
      prompt,
      system: system || 'Sen yardımcı bir AI asistanısın.',
      stream: false,
      ...(options ? { options } : {}),
    }, { timeout: 120000 });
    return res.data.response as string;
  } catch (err: any) {
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT' || err?.response === undefined) {
      throw new OllamaUnavailableError(err);
    }
    throw err;
  }
}
