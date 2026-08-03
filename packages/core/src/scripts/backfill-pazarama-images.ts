/**
 * Pazarama ürün görsellerini backfill eder.
 *
 * Pazarama'nın `/product/products` (list) endpoint'i onaylı ürünler için `images: null`
 * döndürür; görseller yalnızca per-ürün `POST /product/getProductDetail {Code}` ile gelir.
 * Bu script her ürün için tek tek detail isteği atar ve boş `images` alanını doldurur.
 *
 * Kullanım (container içinde):
 *   node packages/core/dist/scripts/backfill-pazarama-images.js [--store=<storeId>]
 *
 * Env: DATABASE_URL, PAZARAMA_CLIENT_ID/CLIENT_SECRET/API_KEY (veya DB integration config)
 */
import 'dotenv/config';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Product } from '../models/Product.model.js';
import { MarketplaceIntegration } from '../models/MarketplaceIntegration.model.js';
import { getMarketplaceConfig } from '../marketplace/clients/index.js';
import { PazaramaClient } from '../marketplace/clients/pazarama.js';

const storeFilterArg = process.argv.find((a) => a.startsWith('--store='));
const storeFilter = storeFilterArg ? storeFilterArg.split('=')[1] : undefined;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await sequelize.authenticate();
  console.log('DB connected');

  const integrations = await MarketplaceIntegration.findAll({ where: { marketplace: 'pazarama' } });
  const clientByStore = new Map<number, PazaramaClient>();
  for (const it of integrations) {
    const cfg = getMarketplaceConfig('pazarama', it);
    clientByStore.set(Number(it.storeId), new PazaramaClient(cfg));
  }

  const where: any = { marketplaces: { [Op.contains]: ['pazarama'] } };
  if (storeFilter && /^\d+$/.test(storeFilter)) {
    where.storeId = Number(storeFilter);
  }

  const products = await Product.findAll({ where, limit: 10000, order: [['id', 'ASC']] });
  console.log(`Pazarama ürünü bulundu: ${products.length}${storeFilter ? ` (store=${storeFilter})` : ''}`);

  let updated = 0;
  let already = 0;
  let noCode = 0;
  let noImg = 0;
  let failed = 0;

  const resultFile = '/tmp/bf-result.txt';
  const resultLines: string[] = [];

  for (const p of products) {
    const cfg: any = (p.marketplaceConfig as any)?.pazarama || {};
    const code: string = cfg.raw?.code || cfg.code || cfg.externalId || p.sku;
    if (!code) {
      noCode++;
      continue;
    }
    if (Array.isArray(p.images) && p.images.length > 0) {
      already++;
      continue;
    }

    let client = clientByStore.get(Number(p.storeId));
    if (!client) {
      client = new PazaramaClient(getMarketplaceConfig('pazarama', { config: {} }));
      clientByStore.set(Number(p.storeId), client);
    }

    try {
      const detail = await client.getProductDetail(code);
      const imgs: string[] = Array.isArray(detail?.images)
        ? detail.images.map((i: any) => i?.imageUrl).filter(Boolean)
        : [];
      if (imgs.length > 0) {
        await p.update({ images: imgs });
        updated++;
        resultLines.push(`+ [${p.id}] ${code} -> ${imgs.length} images`);
      } else {
        noImg++;
      }
    } catch (e: any) {
      failed++;
      resultLines.push(`x [${p.id}] ${code}: ${e?.response?.status || e?.status || e?.message}`);
    }

    await sleep(200);
  }

  const summary = `\nDONE total=${products.length} updated=${updated} already=${already} noCode=${noCode} noImg=${noImg} failed=${failed}`;
  console.log(summary);
  try {
    const fs = await import('fs');
    fs.writeFileSync(resultFile, [...resultLines, summary].join('\n'));
    console.log(`result file written: ${resultFile}`);
  } catch (e: any) {
    console.error('result file write failed', e?.message);
  }
  await sequelize.close();
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});