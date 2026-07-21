import { Router, Request, Response } from 'express';
import { verifyAccessToken } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const slaveRoutes: Router = Router();

const SLAVE_DIR = path.resolve(process.cwd(), 'slave');

// ── HMAC Auth for slave node requests ──
async function slaveAuth(req: Request, res: Response, next: Function) {
  try {
    const apiKeyHeader = req.headers['x-api-key'] as string;
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    const storeCode = req.headers['x-store-code'] as string;
    if (!apiKeyHeader || !signature || !timestamp || !storeCode) {
      res.status(401).json({ error: 'Missing authentication headers' });
      return;
    }

    const { Store } = await import('../../models/Store.model.js');
    const store = await Store.findOne({ where: { siteCode: storeCode } });
    if (!store) {
      res.status(401).json({ error: 'Invalid store code' });
      return;
    }

    const { ApiKey } = await import('../../models/ApiKey.model.js');
    const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');
    const apiKey = await ApiKey.findOne({ where: { storeId: store.id, keyHash } });
    if (!apiKey) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    const hmacSecret = process.env.RAHAT_INTERNAL_KEY || 'internal-dev-key';
    const method = req.method;
    const reqPath = req.path;
    const body = JSON.stringify(req.body || {});
    const payload = `${method}\n${reqPath.replace(/^\//, '')}\n${timestamp}\n${body}`;
    const expectedSig = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    (req as any).store = store;
    (req as any).apiKey = apiKey;
    next();
  } catch (error: any) {
    logger.error('Slave auth error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ── Helper: map Sequelize product → legacy Aimeos-compatible format ──
function mapSlaveProduct(p: any) {
  return {
    'product.id': p.id,
    'product.code': p.sku || '',
    'product.label': p.title || '',
    'product.status': p.isActive ? 1 : 0,
    id: p.id,
    code: p.sku || '',
    label: p.title || '',
    price: p.priceTRY ?? p.price ?? 0,
    stock: p.quantity ?? 0,
    image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : (p.image || null),
    status: p.isActive ? 1 : 0,
    images: p.images || [],
    slug: p.slug || '',
    description: p.description || '',
    category_id: p.categoryId || null,
    sku: p.sku || '',
    title: p.title || '',
    isActive: p.isActive ?? true,
    quantity: p.quantity ?? 0,
    priceTRY: p.priceTRY ?? p.price ?? 0,
  };
}

// ── Slave-facing API endpoints ──

// GET /api/slave/products — list products for the slave store
slaveRoutes.get('/products', slaveAuth, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { Product } = await import('../../models/Product.model.js');
    const products = await Product.findAll({
      where: { storeId: store.id },
      attributes: { exclude: ['marketplaceConfig', 'createdAt', 'updatedAt'] },
      raw: true,
    });
    const list = products.map(mapSlaveProduct);
    res.json({ data: list, total: list.length, synced_at: new Date().toISOString() });
  } catch (error: any) {
    logger.error('Slave products error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/slave/products/:id — single product
slaveRoutes.get('/products/:id', slaveAuth, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { Product } = await import('../../models/Product.model.js');
    const product = await Product.findOne({
      where: { id: req.params.id, storeId: store.id },
      raw: true,
    });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(mapSlaveProduct(product));
  } catch (error: any) {
    logger.error('Slave product detail error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/slave/sync — trigger product sync (returns all products)
slaveRoutes.post('/sync', slaveAuth, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { Product } = await import('../../models/Product.model.js');
    const products = await Product.findAll({
      where: { storeId: store.id },
      raw: true,
    });
    const list = products.map(mapSlaveProduct);
    res.json({ status: 'synced', count: list.length, time: new Date().toISOString(), data: list });
  } catch (error: any) {
    logger.error('Slave sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/slave/orders — receive order from slave
slaveRoutes.post('/orders', slaveAuth, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { DropshippingOrder } = await import('../../models/DropshippingOrder.model.js');
    const input = req.body;
    if (!input || !input.id) {
      res.status(400).json({ error: 'Invalid order data' });
      return;
    }
    const order = await DropshippingOrder.create({
      storeId: store.id,
      marketplaceOrderId: String(input.id),
      marketplace: input.marketplace || 'slave',
      customerName: input.customer_name || input.customerName || '',
      customerEmail: input.customer_email || input.customerEmail || '',
      shippingAddress: input.shipping_address || input.shippingAddress || {},
      items: input.items || [],
      totalAmount: input.grand_total ?? input.totalAmount ?? 0,
      currency: input.currency || 'TRY',
      status: input.status || 'pending',
      notes: input.notes || '',
    });
    res.status(201).json({ status: 'received', order_id: order.id });
  } catch (error: any) {
    logger.error('Slave receive order error:', error);
    res.status(500).json({ error: error.message });
  }
});

function getToken(req: Request): string | null {
  const token = (req.query.token as string) || req.headers.authorization?.replace('Bearer ', '') || null;
  return token;
}

async function generateSlaveApiKey(storeId: number) {
  const { ApiKey } = await import('../../models/ApiKey.model.js');
  const randomBytes = crypto.randomBytes(32);
  const key = `rah_${randomBytes.toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = `rah_${key.substring(4, 12)}`;
  await ApiKey.create({
    storeId,
    keyHash,
    keyPrefix,
    name: 'slave-auto',
    allowedIps: null,
    expiresAt: null,
  });
  return key;
}

slaveRoutes.get('/download-php', async (req: Request, res: Response) => {
  try {
    const token = getToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    let payload: any;
    try { payload = verifyAccessToken(token); } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const { User } = await import('../../models/User.model.js');
    const { Store } = await import('../../models/Store.model.js');
    const user = await User.findByPk(payload.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const store = await Store.findByPk((user as any).storeId);
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const apiKey = await generateSlaveApiKey(store.id);

    const templatePath = path.join(SLAVE_DIR, 'php', 'slave.php');
    if (!fs.existsSync(templatePath)) {
      res.status(500).json({ error: 'PHP slave template not found' });
      return;
    }

    const appUrl = process.env.APP_URL || 'https://api.rahatio.com.tr';
    const hmacSecret = process.env.RAHAT_INTERNAL_KEY || 'internal-dev-key';

    let content = fs.readFileSync(templatePath, 'utf-8');
    content = content.replace(
      /\/\/ #CONFIG_START[\s\S]*?\/\/ #CONFIG_END/,
      `// #CONFIG_START\n$_RAHATIO_CONFIG = [\n    'api_url'     => '${appUrl}',\n    'api_key'     => '${apiKey}',\n    'hmac_secret' => '${hmacSecret}',\n    'store_code'  => '${store.siteCode}',\n    'cache_dir'   => '__CACHE_DIR__',\n    'site_name'   => '${(store as any).name}',\n];\n// #CONFIG_END`
    );
    content = content.replace(/\/api\/(products|sync|orders)/g, '/api/slave/$1');

    res.setHeader('Content-Type', 'application/x-php');
    res.setHeader('Content-Disposition', `attachment; filename="slave-${store.siteCode}.php"`);
    res.send(content);
  } catch (error: any) {
    logger.error('Slave PHP download error:', error);
    res.status(500).json({ error: error.message });
  }
});

slaveRoutes.get('/download-vercel', async (req: Request, res: Response) => {
  try {
    const token = getToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    let payload: any;
    try { payload = verifyAccessToken(token); } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const { User } = await import('../../models/User.model.js');
    const { Store } = await import('../../models/Store.model.js');
    const user = await User.findByPk(payload.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const store = await Store.findByPk((user as any).storeId);
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const apiKey = await generateSlaveApiKey(store.id);

    const templatePath = path.join(SLAVE_DIR, 'vercel', 'api', 'index.js');
    if (!fs.existsSync(templatePath)) {
      res.status(500).json({ error: 'Vercel slave template not found' });
      return;
    }

    const appUrl = process.env.APP_URL || 'https://api.rahatio.com.tr';
    const hmacSecret = process.env.RAHAT_INTERNAL_KEY || 'internal-dev-key';

    let indexContent = fs.readFileSync(templatePath, 'utf-8');
    indexContent = indexContent.replace(
      /\/\/ #CONFIG_START[\s\S]*?\/\/ #CONFIG_END/,
      `// #CONFIG_START\nconst CONFIG = {\n  apiUrl: '${appUrl}',\n  apiKey: '${apiKey}',\n  hmacSecret: '${hmacSecret}',\n  storeCode: '${store.siteCode}',\n  siteName: '${(store as any).name}',\n}\n// #CONFIG_END`
    );
    indexContent = indexContent.replace(/\/api\/(products|sync|orders)/g, '/api/slave/$1');

    const vercelJsonPath = path.join(SLAVE_DIR, 'vercel', 'vercel.json');
    const vercelJson = fs.existsSync(vercelJsonPath) ? fs.readFileSync(vercelJsonPath, 'utf-8') : '{}';

    const packageJson = JSON.stringify({
      name: `rahatio-slave-${store.siteCode}`,
      version: '1.0.0',
      private: true,
      main: 'api/index.js',
    }, null, 2);

    const { default: archiver } = await import('archiver') as any;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="slave-${store.siteCode}-vercel.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.append(indexContent, { name: 'api/index.js' });
    archive.append(vercelJson, { name: 'vercel.json' });
    archive.append(packageJson, { name: 'package.json' });
    await archive.finalize();
  } catch (error: any) {
    logger.error('Slave Vercel download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});