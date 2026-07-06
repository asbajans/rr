import path from 'path';
import fs from 'fs';
import { removeBackground } from './backgroundRemover';
import { processWithComfyUI } from './comfyui';
import { analyzeProductImage } from './visionAnalyzer';
import { generateListings } from './llmChain';
import { sendUpdate } from './websocket';
import { ProductCategory, SellerNotes, FinalProductResult } from '../types';

export async function runPipeline(
  filePaths: string[],
  category: ProductCategory,
  notes: SellerNotes,
  sessionId: string,
  deleteOriginals: boolean
): Promise<FinalProductResult> {
  const outputDir = path.resolve('output', sessionId);
  fs.mkdirSync(outputDir, { recursive: true });

  const allGeneratedImages: string[] = [];

  sendUpdate(sessionId, 'background_removal', 'Görseller işleniyor...');

  for (let i = 0; i < filePaths.length; i++) {
    const file = filePaths[i];

    const noBgPath = await removeBackground(file, sessionId, (msg) => {
      sendUpdate(sessionId, 'background_removal', msg);
    });

    sendUpdate(sessionId, 'background_complete', `Görsel ${i + 1} arka planı temizlendi`);

    sendUpdate(sessionId, 'comfyui_generating', `Görsel ${i + 1}/${filePaths.length} işleniyor...`);

    const generated = await processWithComfyUI(noBgPath, category, (msg) => {
      sendUpdate(sessionId, 'comfyui_generating', msg);
    });

    allGeneratedImages.push(...generated);
  }

  sendUpdate(sessionId, 'comfyui_complete', 'Tüm görseller hazır');

  sendUpdate(sessionId, 'vision_analyzing', 'Ürün analiz ediliyor...');

  const bestImage = allGeneratedImages[0] || filePaths[0];
  const specs = await analyzeProductImage(bestImage, category);

  sendUpdate(sessionId, 'vision_complete', 'Ürün özellikleri çıkarıldı');

  sendUpdate(sessionId, 'llm_generating', 'Satış metinleri oluşturuluyor...');

  const listings = await generateListings(specs, notes, allGeneratedImages, (msg) => {
    sendUpdate(sessionId, 'llm_generating', msg);
  });

  sendUpdate(sessionId, 'llm_complete', 'Metinler hazır');

  const result: FinalProductResult = {
    sessionId,
    category,
    images: {
      original: filePaths[0],
      backgroundRemoved: path.join(outputDir, 'no-bg.png'),
      generated: allGeneratedImages,
    },
    specs,
    seo: listings.seo,
    trendyol: listings.trendyol,
    amazon: listings.amazon,
  };

  sendUpdate(sessionId, 'completed', 'Tüm işlemler tamamlandı', result.images.generated, result);

  if (deleteOriginals) {
    for (const f of filePaths) {
      fs.unlink(f, () => {});
    }
  }

  return result;
}
