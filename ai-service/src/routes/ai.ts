import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { removeBackground } from '../services/backgroundRemover';
import { processWithComfyUI } from '../services/comfyui';
import { sendUpdate } from '../services/websocket';
import { ProductCategory } from '../types';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';

const router = Router();

router.post(
  '/process-image',
  upload.array('images', 10),
  async (req: Request, res: Response) => {
    const category = (req.body.category || 'diger').toLowerCase() as ProductCategory;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'En az bir görsel gerekli' });
      return;
    }

    const sessionId = uuid();
    const outputBase = path.resolve('output', sessionId);

    sendUpdate(sessionId, 'queued', 'Sıraya alındı');

    res.status(202).json({
      sessionId,
      message: 'İşlem başlatıldı',
    });

    try {
      const results: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        sendUpdate(sessionId, 'background_removal', `Görsel ${i + 1}/${files.length} arka planı siliniyor...`);

        const noBgPath = await removeBackground(file.path, sessionId, (msg) => {
          sendUpdate(sessionId, 'background_removal', msg);
        });

        sendUpdate(sessionId, 'background_complete', `Görsel ${i + 1} arka planı temizlendi`);

        sendUpdate(sessionId, 'comfyui_generating', `Görsel ${i + 1}/${files.length} işleniyor...`);

        const generated = await processWithComfyUI(noBgPath, category, (msg) => {
          sendUpdate(sessionId, 'comfyui_generating', msg);
        });

        results.push(...generated);
      }

      sendUpdate(sessionId, 'completed', 'Tüm görseller hazır', results);

      for (const file of files) {
        fs.unlink(file.path, () => {});
      }
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

export default router;
