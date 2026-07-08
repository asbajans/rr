import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { runPipeline } from '../services/pipeline';
import { sendUpdate } from '../services/websocket';
import { ProductCategory, SellerNotes } from '../types';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const router = Router();
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LLM_MODEL = process.env.OLLAMA_LLM_MODEL || 'llama3';

async function callOllama(prompt: string, system?: string): Promise<string> {
  const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: LLM_MODEL,
    prompt,
    system: system || 'Sen yardımcı bir AI asistanısın.',
    stream: false,
  });
  return res.data.response;
}

// Existing: process-image
router.post(
  '/process-image',
  upload.array('images', 10),
  async (req: Request, res: Response) => {
    const category = (req.body.category || 'diger').toLowerCase() as ProductCategory;
    const files = req.files as Express.Multer.File[];

    const notes: SellerNotes = {
      shortDescription: req.body.short_description,
      keywords: req.body.keywords,
      targetAudience: req.body.target_audience,
      notes: req.body.notes,
    };

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'En az bir görsel gerekli' });
      return;
    }

    const sessionId = uuid();

    sendUpdate(sessionId, 'queued', 'Sıraya alındı');

    res.status(202).json({
      sessionId,
      message: 'İşlem başlatıldı',
    });

    try {
      const filePaths = files.map((f) => f.path);

      await runPipeline(filePaths, category, notes, sessionId, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      sendUpdate(sessionId, 'failed', errorMsg);
    }
  }
);

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
    res.status(500).json({ error: err.message });
  }
});

export default router;
