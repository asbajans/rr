import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { runPipeline } from '../services/pipeline';
import { sendUpdate } from '../services/websocket';
import { ProductCategory, SellerNotes } from '../types';
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

      await runPipeline(
        filePaths,
        category,
        notes,
        sessionId,
        true
      );
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
