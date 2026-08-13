import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { ProviderConfig } from './llmProvider';

/**
 * External image generation backed by the configured LLM providers
 * (OpenAI-compatible `images/*` endpoints, Google Gemini `generateContent`
 * with image modality). Used as the primary path for image-edit /
 * image-generate when the resolved model is a dedicated image model;
 * ComfyUI remains the fallback for everything else.
 */

const TIMEOUT = 300_000;

const IMAGE_MODEL_SUBSTRINGS = [
  'gpt-image',
  'dall-e',
  'dalle',
  'flux',
  'stable-diffusion',
  'stable-image',
  'sdxl',
  'imagen',
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation',
  'nano-banana',
  'recraft',
  'ideogram',
  'playground-v',
  'imagegen',
  'image-generation',
  'image_generation',
];

export function isImageGenerationModel(model: string | undefined): boolean {
  if (!model) return false;
  const m = model.toLowerCase();
  return IMAGE_MODEL_SUBSTRINGS.some((s) => m.includes(s));
}

function isGemini(baseUrl: string): boolean {
  return baseUrl.toLowerCase().includes('generativelanguage');
}

function authHeaders(config: ProviderConfig): Record<string, string> {
  const h: Record<string, string> = {};
  if (config.apiKey) {
    if (config.authType === 'api-key') {
      h['X-API-Key'] = config.apiKey;
    } else {
      h['Authorization'] = `Bearer ${config.apiKey}`;
    }
  }
  return h;
}

function mimeOf(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return map[ext] || 'image/png';
}

function mimeExt(mimeType: string | undefined): string {
  const m = (mimeType || '').split('/')[1]?.toLowerCase();
  if (m === 'jpeg') return 'jpg';
  return m && /^[a-z0-9]{1,6}$/.test(m) ? m : 'png';
}

function resolveImagesEndpoint(baseUrl: string, action: 'generations' | 'edits'): string {
  let base = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  if (/\/images\/edits$/i.test(base)) {
    return action === 'edits' ? base : base.replace(/\/images\/edits$/i, '/images/generations');
  }
  if (/\/images\/generations$/i.test(base)) {
    return action === 'generations' ? base : base.replace(/\/images\/generations$/i, '/images/edits');
  }
  if (/\/v1\/?$/i.test(base)) return `${base.replace(/\/+$/, '')}/images/${action}`;
  return `${base}/v1/images/${action}`;
}

function saveBase64(data: string, outputDir: string, prefix: string, ext = 'png'): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${prefix}.${ext}`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

async function downloadUrl(url: string, outputDir: string, prefix: string): Promise<string> {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: TIMEOUT });
  const ext = path.extname(new URL(url).pathname) || '.png';
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${prefix}${ext}`);
  fs.writeFileSync(file, Buffer.from(res.data));
  return file;
}

async function collectImageData(payload: any, outputDir: string, prefix: string): Promise<string[]> {
  const items = payload?.data || [];
  const out: string[] = [];
  for (const item of items) {
    if (item.b64_json) out.push(saveBase64(item.b64_json, outputDir, prefix));
    else if (item.url) out.push(await downloadUrl(item.url, outputDir, prefix));
  }
  return out;
}

function partImage(part: any): { data?: string; mimeType?: string } | null {
  if (part?.inlineData?.data) return { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
  if (part?.fileData?.data) return { data: part.fileData.data, mimeType: part.fileData.mimeType };
  return null;
}

async function geminiGenerate(config: ProviderConfig, prompt: string, count: number, outputDir: string): Promise<string[]> {
  const base = config.baseUrl.trim().replace(/\/+$/, '');
  const key = config.apiKey ? `?key=${config.apiKey}` : '';
  const url = `${base}/v1beta/models/${config.model}:generateContent${key}`;
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['Text', 'IMAGE'],
        imageConfig: { aspectRatio: '1:1', imageSize: '1K' },
      },
    };
    const res = await axios.post(url, body, { headers: authHeaders(config), timeout: TIMEOUT });
    const parts = res.data?.candidates?.[0]?.content?.parts || [];
    const img = parts.map(partImage).find(Boolean);
    if (!img || !img.data) {
      throw new Error('Görsel sağlayıcısı görsel döndürmedi (Gemini yanıtında görsel yok).');
    }
    results.push(saveBase64(img.data, outputDir, `gemini-${i + 1}`, mimeExt(img.mimeType)));
  }
  return results;
}

async function geminiEdit(config: ProviderConfig, imagePath: string, prompt: string, outputDir: string): Promise<string[]> {
  const base = config.baseUrl.trim().replace(/\/+$/, '');
  const key = config.apiKey ? `?key=${config.apiKey}` : '';
  const url = `${base}/v1beta/models/${config.model}:generateContent${key}`;
  const imageB64 = fs.readFileSync(imagePath).toString('base64');
  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: mimeOf(imagePath), data: imageB64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { responseModalities: ['Text', 'IMAGE'] },
  };
  const res = await axios.post(url, body, { headers: authHeaders(config), timeout: TIMEOUT });
  const parts = res.data?.candidates?.[0]?.content?.parts || [];
  const img = parts.map(partImage).find(Boolean);
  if (!img || !img.data) {
    throw new Error('Görsel düzenlenemedi (Gemini görsel döndürmedi).');
  }
  return [saveBase64(img.data, outputDir, 'gemini-edit', mimeExt(img.mimeType))];
}

async function openAiGenerations(config: ProviderConfig, prompt: string, count: number, outputDir: string): Promise<string[]> {
  const url = resolveImagesEndpoint(config.baseUrl, 'generations');
  const headers = { 'Content-Type': 'application/json', ...authHeaders(config) };
  const baseBody: any = { model: config.model, prompt };

  const call = async (body: any) => {
    const res = await axios.post(url, body, { headers, timeout: TIMEOUT });
    return res.data;
  };

  let payload: any;
  try {
    payload = await call({ ...baseBody, n: count, size: '1024x1024', response_format: 'b64_json' });
  } catch (err: any) {
    const status = err?.response?.status;
    if (status && status >= 400 && status < 500) {
      // Some providers/models reject optional params (size / response_format).
      try {
        payload = await call({ ...baseBody, n: count });
      } catch (err2: any) {
        if (err2?.response?.status === 400 && count > 1) {
          const results: string[] = [];
          for (let i = 0; i < count; i++) {
            const single = await call({ ...baseBody, n: 1 });
            results.push(...(await collectImageData(single, outputDir, `img-${i + 1}`)));
          }
          return results;
        }
        throw err2;
      }
    } else {
      throw err;
    }
  }

  const images = await collectImageData(payload, outputDir, 'img');
  if (images.length === 0) {
    throw new Error('Görsel sağlayıcısı görsel döndürmedi.');
  }
  return images;
}

async function openAiEdit(config: ProviderConfig, imagePath: string, prompt: string, outputDir: string): Promise<string[]> {
  const url = resolveImagesEndpoint(config.baseUrl, 'edits');
  const form = new FormData();
  form.append('model', config.model);
  form.append('prompt', prompt);
  form.append('image', fs.createReadStream(imagePath));
  form.append('n', '1');
  const headers = { ...form.getHeaders(), ...authHeaders(config) };
  const res = await axios.post(url, form, {
    headers,
    timeout: TIMEOUT,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  const images = await collectImageData(res.data, outputDir, 'edit');
  if (images.length === 0) {
    throw new Error('Görsel düzenlenemedi (sağlayıcı görsel döndürmedi).');
  }
  return images;
}

function imageProviderError(baseUrl: string, err: any): Error {
  const code = err?.code || err?.cause?.code;
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
    return new Error(
      `Görsel sağlayıcısına ulaşılamadı (${baseUrl}). Lütfen AI Ayarları sayfasından sağlayıcı/base URL değerini kontrol edin (${code}).`
    );
  }
  const status = err?.response?.status;
  const data = err?.response?.data;
  const msg =
    (data && (data.error?.message || data.error?.code || data.message || (typeof data === 'string' ? data : JSON.stringify(data)))) ||
    err?.message ||
    'Bilinmeyen hata';
  return new Error(`Görsel üretilemedi (${status ? `[${status}] ` : ''}${msg})`);
}

/**
 * Text-to-image via the configured external provider. Gemini uses the native
 * generateContent image modality; everything else uses the OpenAI-compatible
 * images/generations endpoint.
 */
export async function generateImagesExternal(
  config: ProviderConfig,
  prompt: string,
  count: number,
  outputDir: string
): Promise<string[]> {
  try {
    if (isGemini(config.baseUrl)) {
      return await geminiGenerate(config, prompt, count, outputDir);
    }
    return await openAiGenerations(config, prompt, count, outputDir);
  } catch (err: any) {
    throw imageProviderError(config.baseUrl, err);
  }
}

/**
 * Image edit via the configured external provider. Gemini passes the reference
 * image inline; OpenAI-compatible providers use images/edits. Providers that do
 * not expose an edits endpoint fall back to regeneration from the instruction.
 */
export async function editImageExternal(
  config: ProviderConfig,
  imagePath: string,
  prompt: string,
  outputDir: string
): Promise<string[]> {
  try {
    if (isGemini(config.baseUrl)) {
      return await geminiEdit(config, imagePath, prompt, outputDir);
    }
    try {
      return await openAiEdit(config, imagePath, prompt, outputDir);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || status === 405 || status === 400 || status === 501) {
        return await openAiGenerations(config, prompt, 1, outputDir);
      }
      throw err;
    }
  } catch (err: any) {
    throw imageProviderError(config.baseUrl, err);
  }
}
