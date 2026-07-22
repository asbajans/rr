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

const router: Router = Router();

const FRIENDLY_ERROR = 'AI servisi şu an kullanılamıyor (Ollama bağlantısı yok). Lütfen daha sonra tekrar deneyin.';

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

// analyze-product: accepts multipart image OR JSON { imageUrl, category }
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
      const { analyzeProductImage } = await import('../services/visionAnalyzer.js');
      const { generateListings } = await import('../services/llmChain.js');

      const specs = await analyzeProductImage(filePath, (req.body.category || 'diger') as any);

      const result = await generateListings(specs, {
        shortDescription: req.body.short_description,
        keywords: req.body.keywords,
        notes: req.body.notes,
      }, [], () => {});

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
      });
    } catch (err: any) {
      if (err instanceof OllamaUnavailableError) {
        res.status(503).json({ error: FRIENDLY_ERROR });
        return;
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// Generate product description from title/category/attributes
router.post('/generate-description', async (req: Request, res: Response) => {
  const { title, category, attributes, keywords } = req.body;

  if (!title || !category) {
    res.status(400).json({ error: 'title and category required' });
    return;
  }

  try {
    const attrStr = attributes ? Object.entries(attributes).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
    const kwStr = keywords?.length ? `Anahtar kelimeler: ${keywords.join(', ')}` : '';

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

    const response = await callOllama(prompt, 'Sen bir e-ticaret ürün metni yazarısın. Verilen formatta çıktı üret.');
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
    if (err instanceof OllamaUnavailableError) {
      res.status(503).json({ error: FRIENDLY_ERROR });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/status/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const outputDir = path.resolve('output', sessionId);

  if (!fs.existsSync(outputDir)) {
    res.status(404).json({ error: 'Session bulunamadı' });
    return;
  }

  const files = fs.readdirSync(outputDir).filter((f) => f.endsWith('.png'));
  res.json({ sessionId, images: files.length, ready: files });
});

// AI Search: semantic product search
router.post('/search', async (req: Request, res: Response) => {
  const { query, products } = req.body;

  if (!query || !products || !Array.isArray(products)) {
    res.status(400).json({ error: 'query and products array required' });
    return;
  }

  try {
    const productList = products.map((p: any, i: number) =>
      `[${i}] ${p.label} - ${p.description || 'açıklama yok'} - ${p.price || 0} ${p.currency || 'TRY'}`
    ).join('\n');

    const prompt = `Kullanıcı şu aramayı yaptı: "${query}"

Aşağıdaki ürünler arasından en uygun olanların index numaralarını virgülle ayırarak döndür:

${productList}

Sadece en alakalı 5 ürünün index numaralarını virgülle ayırarak yaz, başka bir şey yazma.`;

    const response = await callOllama(prompt, 'Sen bir e-ticaret arama asistanısın. Sadece index numaraları döndür.');
    const indices = response.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n < products.length);

    const results = indices.map((i: number) => products[i]);
    res.json({ query, results, count: results.length });
  } catch (err: any) {
    if (err instanceof OllamaUnavailableError) {
      res.status(503).json({ error: FRIENDLY_ERROR });
      return;
    }
    res.status(500).json({ error: err.message });
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
    const currentProduct = product
      ? `${product.label} - ${product.description || ''} - ${product.price || 0} ${product.currency || 'TRY'}`
      : 'genel';

    const productList = allProducts.map((p: any, i: number) =>
      `[${i}] ${p.label} - ${p.description || ''} - ${p.price || 0} ${p.currency || 'TRY'}`
    ).join('\n');

    const prompt = type === 'trending'
      ? `En çok satan/trend ürünler hangileri? Aşağıdaki listeden en popüler olabilecek 5 ürünün index numaralarını döndür:\n\n${productList}`
      : `Mevcut ürün: ${currentProduct}\n\nAşağıdaki listeden buna en çok benzeyen/önerilebilecek 5 ürünün index numaralarını döndür:\n\n${productList}`;

    const response = await callOllama(prompt, 'Sen bir e-ticaret öneri asistanısın. Sadece index numaraları döndür.');
    const indices = response.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n < allProducts.length);

    const results = indices.map((i: number) => allProducts[i]);
    res.json({ type: type || 'similar', results, count: results.length });
  } catch (err: any) {
    if (err instanceof OllamaUnavailableError) {
      res.status(503).json({ error: FRIENDLY_ERROR });
      return;
    }
    res.status(500).json({ error: err.message });
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
    const storeContext = storeInfo
      ? `Mağaza: ${storeInfo.name}\nSite: ${storeInfo.site_code || ''}\n`
      : '';

    const conversation = (history || [])
      .map((h: any) => `${h.role}: ${h.content}`)
      .join('\n');

    const prompt = `${storeContext}Müşteri mesajı: ${message}

${conversation ? `Sohbet geçmişi:\n${conversation}` : ''}

Yardımcı ol:`;

    const response = await callOllama(prompt, `Sen ${storeInfo?.name || 'Rahatio'} mağazasının müşteri hizmetleri AI asistanısın.
Kibar, yardımsever ve kısa cevaplar ver. Türkçe yanıtla.
Sipariş durumu, kargo, iade, ürün bilgisi gibi konularda yardımcı ol.
Emin olmadığın konularda "Müşteri hizmetlerimize yönlendireceğim" de.`);

    res.json({ reply: response });
  } catch (err: any) {
    if (err instanceof OllamaUnavailableError) {
      res.status(503).json({ error: FRIENDLY_ERROR });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
