import path from 'path';
import fs from 'fs';
import { productCategories, ProductCategory } from '../types';
import { processWithComfyUI, generateTextToImage } from './comfyui';
import { sendUpdate } from './websocket';

function normalizeCategory(category: string | undefined): ProductCategory {
  const c = (category || 'diger').toLowerCase();
  return (productCategories.includes(c as ProductCategory) ? c : 'diger') as ProductCategory;
}

function sessionOutputDir(sessionId: string): string {
  const dir = path.resolve('output', sessionId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Prompt-driven image edit of a single uploaded/existing image. The ComfyUI
 * product-studio workflow is reused with the seller's instruction injected as
 * the positive prompt (see comfyui.loadWorkflow). Output lands in the session
 * directory so GET /ai/status/:id and /ai/output/:id/:file can serve it.
 */
export async function runImageEdit(opts: {
  imagePath: string;
  prompt: string;
  category?: string;
  sessionId: string;
}): Promise<void> {
  const category = normalizeCategory(opts.category);
  const outputDir = sessionOutputDir(opts.sessionId);

  sendUpdate(opts.sessionId, 'editing', 'Görsel AI ile düzenleniyor...');

  const generated = await processWithComfyUI(
    opts.imagePath,
    category,
    (msg) => sendUpdate(opts.sessionId, 'editing', msg),
    { prompt: opts.prompt, outputDir }
  );

  if (generated.length === 0) {
    throw new Error('Görsel düzenleme sonucu üretilemedi (ComfyUI çıktı döndürmedi).');
  }

  sendUpdate(opts.sessionId, 'completed', 'Görsel düzenlendi', generated);
}

/**
 * Brand-new product images from a text prompt using the programmatic
 * text-to-image workflow. `count` images in {1..4}, each billed separately by
 * the core API.
 */
export async function runImageGenerate(opts: {
  prompt: string;
  category?: string;
  count: number;
  sessionId: string;
}): Promise<void> {
  const category = normalizeCategory(opts.category);
  const outputDir = sessionOutputDir(opts.sessionId);

  sendUpdate(opts.sessionId, 'generating', `Yeni görsel(ler) üretiliyor (${opts.count})...`);

  const generated = await generateTextToImage(opts.prompt, category, opts.count, outputDir, (msg) =>
    sendUpdate(opts.sessionId, 'generating', msg)
  );

  if (generated.length === 0) {
    throw new Error('Görsel üretilemedi (ComfyUI çıktı döndürmedi).');
  }

  sendUpdate(opts.sessionId, 'completed', 'Görseller hazır', generated);
}