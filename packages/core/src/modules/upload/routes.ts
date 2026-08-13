import { Router, Request, Response } from 'express';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import path from 'path';
import fs from 'fs';
import { uploadToS3 } from '../../utils/s3Storage.js';

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

    const ALLOWED_MIME = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'application/pdf',
    ]);

    const upload = multer({
      storage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          return cb(new Error(`Unsupported file type: ${file.mimetype}`));
        }
        cb(null, true);
      },
    });

    upload.single('file')(req, res, async (err: any) => {
      if (err) {
        logger.error({ err }, 'Upload error');
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const filename = req.file.filename;
      const key = `uploads/${filename}`;

      // Store in MinIO/S3 when configured; fall back to local disk.
      if (!process.env.DISABLE_S3_UPLOAD) {
        const buffer = fs.readFileSync(req.file.path);
        const result = await uploadToS3(buffer, key, req.file.mimetype || 'application/octet-stream');
        if (result.ok && result.url) {
          logger.info(`File uploaded to S3: ${key} by store ${(req as any).store?.id}`);
          return res.json({ path: key, url: result.url });
        }
        if (result.error && result.error !== 'S3 not configured') {
          logger.warn({ key, error: result.error }, 'S3 upload failed; falling back to local disk');
        }
      }

      logger.info(`File uploaded: ${filename} by store ${(req as any).store?.id}`);
      res.json({ path: key, url: `/uploads/${filename}` });
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Upload route error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
