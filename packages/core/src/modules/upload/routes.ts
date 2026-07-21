import { Router, Request, Response } from 'express';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import path from 'path';
import fs from 'fs';

export const uploadRoutes: Router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

uploadRoutes.post('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const multer = (await import('multer')).default;

    const storage = multer.diskStorage({
      destination: (_req: any, _file: any, cb: any) => {
        cb(null, UPLOAD_DIR);
      },
      filename: (_req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now().toString(36) + '-' + Math.round(Math.random() * 1E9).toString(36);
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
      },
    });

    const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

    upload.single('file')(req, res, async (err: any) => {
      if (err) {
        logger.error({ err }, 'Upload error');
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const filename = req.file.filename;
      const url = `/uploads/${filename}`;

      logger.info(`File uploaded: ${filename} by store ${(req as any).store?.id}`);
      res.json({ path: filename, url });
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Upload route error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
