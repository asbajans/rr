import axios from 'axios';
import net from 'net';
import { URL } from 'url';

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

function canReachOllama(): Promise<boolean> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(OLLAMA_URL);
    } catch {
      resolve(false);
      return;
    }
    const host = url.hostname;
    const port = parseInt(url.port || '11434', 10);
    const socket = new net.Socket();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* noop */ }
      resolve(ok);
    };
    const guard = setTimeout(() => done(false), 3000);
    socket.once('connect', () => { clearTimeout(guard); done(true); });
    socket.once('error', () => { clearTimeout(guard); done(false); });
    try {
      socket.connect(port, host);
    } catch {
      clearTimeout(guard);
      done(false);
    }
  });
}

export async function callOllama(prompt: string, system?: string, options?: Record<string, any>): Promise<string> {
  const reachable = await canReachOllama();
  if (!reachable) {
    throw new OllamaUnavailableError('ollama unreachable');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: LLM_MODEL,
      prompt,
      system: system || 'Sen yardımcı bir AI asistanısın.',
      stream: false,
      ...(options ? { options } : {}),
    }, { timeout: 15000, signal: controller.signal });
    return res.data.response as string;
  } catch (err: any) {
    if (
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'ENOTFOUND' ||
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'ECONNABORTED' ||
      err?.name === 'AbortError' ||
      err?.response === undefined
    ) {
      throw new OllamaUnavailableError(err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
