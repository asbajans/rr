import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { Product } from '../../models/Product.model.js';
import { BlogPost, Page } from '../../models/ContentModels.js';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import {
  getIndexNowKey,
  isIndexNowEnabled,
  notifyIndexNow,
  platformOrigin,
  storefrontUrlsFor,
} from '../../services/indexnow.js';
import { logger } from '../../utils/logger.js';

export const seoRoutes: Router = Router();

/** GET /api/admin/seo/indexnow — IndexNow durum + kurulum bilgisi */
seoRoutes.get('/indexnow', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const key = getIndexNowKey();
    const origin = platformOrigin();
    const domain = (store as any).domain as string | null;
    res.json({
      enabled: isIndexNowEnabled(),
      keyConfigured: key.length >= 8,
      // Anahtar dosyasının sunulması gereken yerler (frontend [keytxt] route sunar)
      keyLocations: [
        `${origin}/${key ? `${key}.txt` : '<INDEXNOW_KEY>.txt'}`,
        ...(domain ? [`https://${domain}/${key ? `${key}.txt` : '<INDEXNOW_KEY>.txt'}`] : []),
      ],
      platformOrigin: origin,
      siteCode: store.siteCode,
      domain: domain ?? null,
      note: key
        ? 'INDEXNOW_KEY ayarlı. Yeni ürün/blog/sayfa kaydedilince otomatik bildirilir.'
        : 'INDEXNOW_KEY env değişkeni ayarlı değil — otomatik bildirim pasif. Anahtarı ayarlayıp frontend + core servisini yeniden başlatın.',
    });
  } catch (error) {
    logger.error({ err: error }, 'IndexNow status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/admin/seo/indexnow/submit { urls: string[] } — manuel URL bildirimi */
seoRoutes.post('/indexnow/submit', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const urls = Array.isArray(req.body?.urls) ? req.body.urls.filter((u: unknown) => typeof u === 'string') : [];
    if (!urls.length) return res.status(400).json({ error: 'urls (string[]) gerekli' });
    if (urls.length > 10000) return res.status(400).json({ error: 'En fazla 10000 URL' });
    if (!isIndexNowEnabled()) return res.status(422).json({ error: 'INDEXNOW_KEY ayarlı değil' });
    const result = await notifyIndexNow(urls.slice(0, 10000));
    res.json({ success: result.ok, ...result });
  } catch (error) {
    logger.error({ err: error }, 'IndexNow submit error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/seo/indexnow/submit-all — mağazanın TÜM indexlenebilir URL'lerini
 * (mağaza ana sayfa + blog index + ürünler + blog yazıları + sayfalar) IndexNow'a
 * toplu bildirir. Eski içeriklerin ilk indexlenmesi / backfill için kullanılır.
 */
seoRoutes.post('/indexnow/submit-all', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    if (!isIndexNowEnabled()) return res.status(422).json({ error: 'INDEXNOW_KEY ayarlı değil' });
    const siteCode = store.siteCode as string;
    const domain = (store as any).domain as string | null;

    const urls: string[] = [
      ...storefrontUrlsFor(siteCode, 'store', undefined, domain),
      ...storefrontUrlsFor(siteCode, 'blog-index', undefined, domain),
    ];

    const products = await Product.findAll({
      where: {
        storeId: store.id,
        isActive: true,
        [Op.or]: [
          { marketplaces: { [Op.contains]: ['Kendi Sitem'] } },
          { marketplaces: null as any },
          { marketplaces: [] as any },
        ],
      },
      attributes: ['id', 'slug'],
      order: [['updatedAt', 'DESC']],
      limit: 5000,
    });
    for (const p of products) {
      urls.push(...storefrontUrlsFor(siteCode, 'product', (p as any).slug || (p as any).id, domain));
    }

    const blogs = await BlogPost.findAll({
      where: { storeId: store.id, status: 'published' },
      attributes: ['slug'],
      order: [['publishedAt', 'DESC']],
      limit: 2000,
    });
    for (const b of blogs) {
      urls.push(...storefrontUrlsFor(siteCode, 'blog', (b as any).slug, domain));
    }

    const pages = await Page.findAll({
      where: { storeId: store.id, isActive: true },
      attributes: ['slug'],
      order: [['updatedAt', 'DESC']],
      limit: 1000,
    });
    for (const pg of pages) {
      urls.push(...storefrontUrlsFor(siteCode, 'page', (pg as any).slug, domain));
    }

    const unique = [...new Set(urls)];
    const result = await notifyIndexNow(unique);
    res.json({
      success: result.ok,
      submitted: result.submitted,
      counts: {
        products: products.length,
        blogs: blogs.length,
        pages: pages.length,
        totalUrls: unique.length,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'IndexNow submit-all error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
