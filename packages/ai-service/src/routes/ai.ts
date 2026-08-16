import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { runPipeline } from '../services/pipeline';
import { sendUpdate } from '../services/websocket';
import { ProductCategory, SellerNotes } from '../types';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { callOllama, OllamaUnavailableError } from '../services/ollama.js';
import { callLlm, buildDefaultConfig, ProviderConfig } from '../services/llmProvider.js';

const router: Router = Router();

const FRIENDLY_ERROR = 'AI sağlayıcısına ulaşılamadı (bağlantı hatası). Lütfen sağlayıcı/base URL ayarlarını kontrol edin veya daha sonra tekrar deneyin.';

function handleLlmError(res: Response, err: any) {
  if (err instanceof OllamaUnavailableError || isUnavailableError(err)) {
    return res.status(503).json({ error: FRIENDLY_ERROR });
  }
  const status = err?.status || err?.response?.status;
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return res.status(status === 429 ? 429 : 503).json({
      error: 'AI sağlayıcısı şu an yoğun (istek kuyruğu dolu). Lütfen birkaç saniye sonra tekrar deneyin.',
    });
  }
  return res.status(500).json({ error: err.message });
}

// DNS / connection failures (e.g. "getaddrinfo ENOTFOUND host.docker.internal",
// ECONNREFUSED) mean the configured provider endpoint is unreachable — surface a
// friendly message instead of a raw 500.
function isUnavailableError(err: any): boolean {
  const code = err?.code || err?.cause?.code;
  return code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT';
}

function extractProviderConfig(body: any): ProviderConfig {
  if (body.provider) {
    const maxTokens = Number(body.maxTokens || body.provider.maxTokens) || undefined;
    const params = body.parameters || {};
    return {
      baseUrl: body.provider.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434',
      model: body.model || body.provider.model || process.env.OLLAMA_LLM_MODEL || 'llama3',
      apiKey: body.provider.apiKey,
      authType: body.provider.authType || 'bearer',
      maxTokens,
      reasoningEffort: params.reasoning_effort || undefined,
    };
  }
  return buildDefaultConfig();
}

async function downloadImage(url: string, destDir: string): Promise<string> {
  const ext = path.extname(new URL(url).pathname) || '.png';
  const filename = `${uuid()}${ext}`;
  const dest = path.join(destDir, filename);
  await fs.promises.mkdir(destDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

function resolveFiles(req: Request, uploadsDir: string): Promise<string[]> {
  const files = req.files as Express.Multer.File[];
  if (files && files.length > 0) {
    return Promise.resolve(files.map((f) => f.path));
  }
  const imageUrl = req.body.imageUrl;
  if (imageUrl) {
    return downloadImage(imageUrl, uploadsDir).then((p) => [p]);
  }
  return Promise.reject(new Error('En az bir görsel gerekli'));
}

function resolveSingleFile(req: Request, uploadsDir: string): Promise<string> {
  const file = req.file;
  if (file) {
    return Promise.resolve(file.path);
  }
  const imageUrl = req.body.imageUrl;
  if (imageUrl) {
    return downloadImage(imageUrl, uploadsDir);
  }
  return Promise.reject(new Error('Görsel gerekli'));
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v === 'string' && v.trim() && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Resolves up to `max` product photos for the agentic-listing pipeline.
 * Accepts: multipart files (images[]), JSON `imageUrl`, or JSON `image_urls` array.
 */
async function resolveMultiFiles(req: Request, uploadsDir: string, max = 2): Promise<string[]> {
  const files = req.files as Express.Multer.File[];
  let paths: string[] = [];
  if (files && files.length > 0) {
    paths = files.map((f) => f.path);
  } else {
    const urls = uniqueStrings([...(req.body.imageUrl ? [req.body.imageUrl] : []), ...(Array.isArray(req.body.image_urls) ? req.body.image_urls : [])]);
    paths = await Promise.all(urls.map((url) => downloadImage(url, uploadsDir)));
  }
  if (paths.length === 0) throw new Error('En az bir görsel gerekli');
  return paths.slice(0, max);
}

// process-image: accepts multipart images[] OR JSON { imageUrl, category }
router.post(
  '/process-image',
  upload.array('images', 10),
  async (req: Request, res: Response) => {
    const category = (req.body.category || 'diger').toLowerCase() as ProductCategory;
    const notes: SellerNotes = {
      shortDescription: req.body.short_description,
      keywords: req.body.keywords,
      targetAudience: req.body.target_audience,
      notes: req.body.notes,
    };

    let filePaths: string[];
    try {
      filePaths = await resolveFiles(req, path.resolve('uploads'));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
      return;
    }

    const sessionId = uuid();

    sendUpdate(sessionId, 'queued', 'Sıraya alındı');

    res.status(202).json({
      sessionId,
      message: 'İşlem başlatıldı',
    });

    try {
      await runPipeline(filePaths, category, notes, sessionId, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      sendUpdate(sessionId, 'failed', errorMsg);
    }
  }
);

function writeSessionError(sessionId: string, message: string): void {
  const outputDir = path.resolve('output', sessionId);
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'error.txt'), message.length > 2000 ? message.slice(0, 2000) : message, 'utf-8');
  } catch { /* best-effort */ }
}

// image-edit: AI with an instruction on an existing image (ComfyUI edit workflow).
// Async: returns 202 { sessionId }, output is polled via /ai/status/:id then served
// by /ai/output/:id/:file. Credits are billed by the core API on 202.
router.post(
  '/image-edit',
  upload.single('image'),
  async (req: Request, res: Response) => {
    const prompt = String(req.body.prompt || '').trim();
    if (!prompt) {
      res.status(400).json({ error: 'prompt zorunludur' });
      return;
    }

    let filePath: string;
    try {
      filePath = await resolveSingleFile(req, path.resolve('uploads'));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
      return;
    }

    const sessionId = uuid();
    sendUpdate(sessionId, 'queued', 'Görsel düzenleme sıraya alındı');
    res.status(202).json({ sessionId, message: 'Görsel düzenleme başlatıldı' });

    try {
      const { runImageEdit } = await import('../services/imageStudio.js');
      const providerConfig = extractProviderConfig(req.body);
      await runImageEdit({ imagePath: filePath, prompt, category: req.body.category, sessionId, provider: providerConfig });
      fs.unlink(filePath, () => {});
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      sendUpdate(sessionId, 'failed', errorMsg);
      writeSessionError(sessionId, errorMsg);
      fs.unlink(filePath, () => {});
    }
  }
);

// image-generate: brand-new product images from a prompt (ComfyUI text-to-image).
// count ∈ {1..4}; the core API bills count × per-image credit on the 202.
router.post(
  '/image-generate',
  async (req: Request, res: Response) => {
    const prompt = String(req.body.prompt || '').trim();
    const count = Math.max(1, Math.min(4, Math.floor(Number(req.body.count) || 1)));
    if (!prompt) {
      res.status(400).json({ error: 'prompt zorunludur' });
      return;
    }

    const sessionId = uuid();
    sendUpdate(sessionId, 'queued', `Görsel üretimi sıraya alındı (${count})`);
    res.status(202).json({ sessionId, message: 'Görsel üretimi başlatıldı' });

    try {
      const { runImageGenerate } = await import('../services/imageStudio.js');
      const providerConfig = extractProviderConfig(req.body);

      // Existing product image used as a reference for generation (image-to-image)
      // when provided: download it to the session output dir and pass it along.
      let referenceImagePath: string | undefined;
      const referenceUrl = req.body.imageUrl || req.body.referenceImageUrl;
      if (referenceUrl) {
        try {
          referenceImagePath = await downloadImage(referenceUrl, path.resolve('output', sessionId));
        } catch (e: any) {
          const errMsg = e instanceof Error ? e.message : 'Referans görsel indirilemedi.';
          sendUpdate(sessionId, 'failed', errMsg);
          writeSessionError(sessionId, errMsg);
          return;
        }
      }

      await runImageGenerate({ prompt, category: req.body.category, count, sessionId, provider: providerConfig, referenceImagePath });
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      sendUpdate(sessionId, 'failed', errorMsg);
      writeSessionError(sessionId, errorMsg);
    }
  }
);

// analyze-product: accepts multipart image OR JSON { imageUrl, category, provider?, model? }
router.post(
  '/analyze-product',
  upload.single('image'),
  async (req: Request, res: Response) => {
    let filePath: string;
    try {
      filePath = await resolveSingleFile(req, path.resolve('uploads'));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
      return;
    }

    try {
      const providerConfig = extractProviderConfig(req.body);
      const { analyzeProductImage } = await import('../services/visionAnalyzer.js');
      const { generateListings } = await import('../services/llmChain.js');

      const specs = await analyzeProductImage(filePath, (req.body.category || 'diger') as any, providerConfig);

      const result = await generateListings(specs, {
        shortDescription: req.body.short_description,
        keywords: req.body.keywords,
        notes: req.body.notes,
      }, [], () => {}, providerConfig);

      const attributes: Record<string, string> = {};
      for (const key of ['material', 'color', 'type', 'style', 'pattern', 'brand'] as const) {
        if (specs[key]) attributes[key] = specs[key];
      }

      const warnings: string[] = [];
      if (!specs.brand) warnings.push('Marka fotoğraftan tanımlanamadı, boş bırakıldı.');
      if (!specs.dimensions) warnings.push('Boyut/ölçü bilgisi fotoğraftan belirlenemedi.');

      res.json({
        specs: {
          material: specs.material,
          color: specs.color,
          type: specs.type,
          style: specs.style,
          category: specs.category,
        },
        title: result.trendyol.title,
        description: result.seo.longDescription,
        short_description: result.trendyol.description,
        meta_title: result.seo.metaTitle,
        meta_description: result.seo.metaDescription,
        keywords: result.seo.keywords,
        slug: result.seo.slug,
        category: specs.category,
        attributes,
        category_candidates: [{ name: specs.category || 'diger', confidence: 0.5 }],
        warnings,
        confidence: { title: 0.5, category: 0.5, description: 0.5 },
      });
    } catch (err: any) {
      if (err instanceof OllamaUnavailableError || isUnavailableError(err)) {
        res.status(503).json({ error: FRIENDLY_ERROR });
        return;
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// Agentic listing: image(s) → vision specs → full publish-ready draft (title/desc/attrs/price)
router.post(
  '/agentic-listing',
  upload.array('images', 2),
  async (req: Request, res: Response) => {
    let filePaths: string[];
    try {
      filePaths = await resolveMultiFiles(req, path.resolve('uploads'), 2);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
      return;
    }

    try {
      const providerConfig = extractProviderConfig(req.body);
      const { generateAgenticListing } = await import('../services/agenticListing.js');

      const result = await generateAgenticListing(
        filePaths,
        {
          category: (req.body.category || 'diger') as any,
          categoryAttributes: req.body.category_attributes,
          condition: req.body.condition,
          shortDescription: req.body.short_description,
          keywords: req.body.keywords,
          notes: req.body.notes,
          suggestPrice: req.body.suggest_price !== false,
          targetMarketplaces: req.body.target_marketplaces,
        },
        providerConfig
      );

      res.json(result);
    } catch (err: any) {
      if (err instanceof OllamaUnavailableError || isUnavailableError(err)) {
        res.status(503).json({ error: FRIENDLY_ERROR });
        return;
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// Generate a category's attribute schema (used to direct vision + listing prompts)
router.post('/generate-category-attributes', async (req: Request, res: Response) => {
  const { name, keywords, notes } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  try {
    const providerConfig = extractProviderConfig(req.body);
    const { generateCategoryAttributes } = await import('../services/categoryAttributes.js');
    const result = await generateCategoryAttributes({ name, keywords, notes }, providerConfig);
    res.json(result);
  } catch (err: any) {
    handleLlmError(res, err);
  }
});

// Blog post generation: topic OR product info → SEO-friendly HTML article
router.post('/blog', async (req: Request, res: Response) => {
  const { topic, product, imageUrl, notes, keywords } = req.body;

  if (!topic && !product) {
    res.status(400).json({ error: 'topic or product object required' });
    return;
  }

  try {
    const providerConfig = extractProviderConfig(req.body);
    const { generateBlogPost } = await import('../services/blogWriter.js');

    const result = await generateBlogPost(
      { topic, product, imageUrl, notes, keywords },
      providerConfig
    );

    res.json(result);
  } catch (err: any) {
    handleLlmError(res, err);
  }
});

// Generate product description from title/category/attributes
router.post('/generate-description', async (req: Request, res: Response) => {
  const { title, category, attributes, keywords } = req.body;

  if (!title || !category) {
    res.status(400).json({ error: 'title and category required' });
    return;
  }

  try {
    const providerConfig = extractProviderConfig(req.body);
    const attrStr = attributes ? Object.entries(attributes).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
    const kwStr = keywords?.length ? `Anahtar kelimeler: ${keywords.join(', ')}` : '';

    const system = 'Sen bir e-ticaret ürün metni yazarısın. Verilen formatta çıktı üret.';
    const prompt = `Ürün adı: ${title}
Kategori: ${category}
${attrStr ? `Özellikler: ${attrStr}` : ''}
${kwStr}

Yukarıdaki ürün bilgilerine göre aşağıdaki çıktıları oluştur:

1. Meta başlık (SEO için, max 60 karakter)
2. Kısa açıklama (max 160 karakter, meta description olarak kullanılacak)
3. Uzun açıklama (3-5 cümle, HTML etiketsiz, düz metin)
4. URL dostu slug (sadece küçük harf, tire ile ayrılmış)
5. Önerilen anahtar kelimeler (virgülle ayrılmış, 5-10 adet)

Çıktıyı şu formatta ver:
META_TITLE: ...
META_DESCRIPTION: ...
DESCRIPTION: ...
SLUG: ...
KEYWORDS: ...`;

    const response = await callLlm(providerConfig, [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ], { temperature: 0.7 });

    const lines = response.split('\n').map((l: string) => l.trim()).filter(Boolean);

    const extract = (prefix: string): string => {
      const line = lines.find((l: string) => l.startsWith(prefix));
      return line ? line.substring(prefix.length).trim() : '';
    };

    const generatedDescription = extract('DESCRIPTION:');
    const metaTitle = extract('META_TITLE:') || title.substring(0, 60);
    const metaDescription = extract('META_DESCRIPTION:');
    const slug = extract('SLUG:');
    const kwLine = extract('KEYWORDS:');
    const parsedKeywords = kwLine ? kwLine.split(',').map((k: string) => k.trim()).filter(Boolean) : (keywords || []);

    res.json({
      description: generatedDescription,
      title: metaTitle,
      keywords: parsedKeywords,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      short_description: metaDescription || generatedDescription.substring(0, 160),
    });
  } catch (err: any) {
    return handleLlmError(res, err);
  }
});

router.get('/status/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const outputDir = path.resolve('output', sessionId);

  if (!fs.existsSync(outputDir)) {
    res.status(404).json({ error: 'Session bulunamadı' });
    return;
  }

  const files = fs.readdirSync(outputDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const errorFile = path.join(outputDir, 'error.txt');
  const error = fs.existsSync(errorFile) ? fs.readFileSync(errorFile, 'utf-8') : undefined;

  res.json({ sessionId, images: files.length, ready: files, error });
});

// Serve generated/edited images for a session. The core API streams this through
// GET /api/ai/output/:id/:file.
router.get('/output/:sessionId/:file', (req: Request, res: Response) => {
  const { sessionId, file } = req.params;
  const safeFile = path.basename(file);
  const filePath = path.resolve('output', sessionId, safeFile);
  if (!filePath.startsWith(path.resolve('output'))) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Session bulunamadı' });
    return;
  }
  res.sendFile(filePath);
});

// AI Search: semantic product search
router.post('/search', async (req: Request, res: Response) => {
  const { query, products } = req.body;

  if (!query || !products || !Array.isArray(products)) {
    res.status(400).json({ error: 'query and products array required' });
    return;
  }

  try {
    const providerConfig = extractProviderConfig(req.body);
    const productList = products.map((p: any, i: number) =>
      `[${i}] ${p.label} - ${p.description || 'açıklama yok'} - ${p.price || 0} ${p.currency || 'TRY'}`
    ).join('\n');

    const system = 'Sen bir e-ticaret arama asistanısın. Sadece index numaraları döndür.';
    const userPrompt = `Kullanıcı şu aramayı yaptı: "${query}"

Aşağıdaki ürünler arasından en uygun olanların index numaralarını virgülle ayırarak döndür:

${productList}

Sadece en alakalı 5 ürünün index numaralarını virgülle ayırarak yaz, başka bir şey yazma.`;

    const response = await callLlm(providerConfig, [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.3 });

    const indices = response.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n < products.length);

    const results = indices.map((i: number) => products[i]);
    res.json({ query, results, count: results.length });
  } catch (err: any) {
    return handleLlmError(res, err);
  }
});

// AI Recommendations
router.post('/recommend', async (req: Request, res: Response) => {
  const { product, allProducts, type } = req.body;

  if (!allProducts || !Array.isArray(allProducts)) {
    res.status(400).json({ error: 'allProducts array required' });
    return;
  }

  try {
    const providerConfig = extractProviderConfig(req.body);
    const currentProduct = product
      ? `${product.label} - ${product.description || ''} - ${product.price || 0} ${product.currency || 'TRY'}`
      : 'genel';

    const productList = allProducts.map((p: any, i: number) =>
      `[${i}] ${p.label} - ${p.description || ''} - ${p.price || 0} ${p.currency || 'TRY'}`
    ).join('\n');

    const system = 'Sen bir e-ticaret öneri asistanısın. Sadece index numaraları döndür.';
    const userPrompt = type === 'trending'
      ? `En çok satan/trend ürünler hangileri? Aşağıdaki listeden en popüler olabilecek 5 ürünün index numaralarını döndür:\n\n${productList}`
      : `Mevcut ürün: ${currentProduct}\n\nAşağıdaki listeden buna en çok benzeyen/önerilebilecek 5 ürünün index numaralarını döndür:\n\n${productList}`;

    const response = await callLlm(providerConfig, [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.3 });

    const indices = response.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n < allProducts.length);

    const results = indices.map((i: number) => allProducts[i]);
    res.json({ type: type || 'similar', results, count: results.length });
  } catch (err: any) {
    return handleLlmError(res, err);
  }
});

// AI Chat: customer support assistant
router.post('/chat', async (req: Request, res: Response) => {
  const { message, history, storeInfo } = req.body;

  if (!message) {
    res.status(400).json({ error: 'message required' });
    return;
  }

  try {
    const providerConfig = extractProviderConfig(req.body);
    const storeContext = storeInfo
      ? `Mağaza: ${storeInfo.name}\nSite: ${storeInfo.site_code || ''}\n`
      : '';

    const conversation = (history || [])
      .map((h: any) => `${h.role}: ${h.content}`)
      .join('\n');

    const system = `Sen ${storeInfo?.name || 'Rahatio'} mağazasının müşteri hizmetleri AI asistanısın.
Kibar, yardımsever ve kısa cevaplar ver. Türkçe yanıtla.
Sipariş durumu, kargo, iade, ürün bilgisi gibi konularda yardımcı ol.
Emin olmadığın konularda "Müşteri hizmetlerimize yönlendireceğim" de.`;
    const userPrompt = `${storeContext}Müşteri mesajı: ${message}

${conversation ? `Sohbet geçmişi:\n${conversation}` : ''}

Yardımcı ol:`;

    const reply = await callLlm(providerConfig, [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.7 });

    res.json({ reply });
  } catch (err: any) {
    return handleLlmError(res, err);
  }
});

export default router;