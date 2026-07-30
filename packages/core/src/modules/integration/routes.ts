import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../../models/OrderStatusHistory.model.js';
import { Product } from '../../models/Product.model.js';
import { ProductMarketplaceListing } from '../../models/ProductMarketplaceListing.model.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { Store } from '../../models/Store.model.js';
import { IntegrationLog } from '../../models/LogModels.js';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { createSplitOrder } from '../order/orderSplit.js';
import { createMarketplaceClient, getMarketplaceConfig, MarketplaceType } from '../../marketplace/clients/index.js';
import { Op } from 'sequelize';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.js';

export const integrationRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

integrationRoutes.post('/webhook/order', [
  body('marketplace').isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
  body('payload').isObject(),
], validate, async (req: Request, res: Response) => {
  const internalKey = req.headers['x-internal-key'] as string;
  if (internalKey !== config.apiKey.internalKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { marketplace, payload, storeId: topLevelStoreId } = req.body;
    const storeId = payload?.storeId || topLevelStoreId;

    if (!storeId) {
      return res.status(400).json({ error: 'storeId is required' });
    }

    const store = await Store.findOne({
      where: { id: storeId },
    });

    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const marketplaceOrderId = payload.marketplaceOrderId || payload.id?.toString() || payload.orderId?.toString() || `${marketplace}_${Date.now()}`;
    const orderNumber = payload.orderNumber || payload.order_id || marketplaceOrderId || `ORD-${Date.now()}`;

    const items = payload.items || payload.products || [];
    const totalAmount = payload.totalAmount || items.reduce((sum: number, item: any) => sum + ((item.price || item.unitPrice || 0) * (item.quantity || 1)), 0);

    const shippingAddress = payload.shippingAddress || payload.shipping_address || payload.address || {};
    const payloadStatus = payload.status || 'pending';

    const existing = await DropshippingOrder.findOne({
      where: { marketplaceOrderId, marketplace },
    });

    if (existing) {
      if (existing.status !== payloadStatus) {
        const oldStatus = existing.status;
        await existing.update({ status: payloadStatus, items, shippingAddress, totalAmount });
        await OrderStatusHistory.create({
          dropshippingOrderId: existing.id,
          fromStatus: oldStatus,
          toStatus: payloadStatus,
          note: `Status synced from ${marketplace} webhook: ${oldStatus} -> ${payloadStatus}`,
        });
        logger.info(`Webhook order ${existing.id} status updated: ${oldStatus} -> ${payloadStatus}`);
      }
      return res.json({ order: existing, created: false });
    }

    const { mainOrder, subOrders } = await createSplitOrder(
      store.id, marketplace, marketplaceOrderId,
      items, totalAmount, orderNumber,
      payload.currency || 'TRY',
      shippingAddress,
      payload,
      payload.marketplaceOrderNumber || payload.order_number,
      payload.customerName || payload.customer_name,
      payload.customerEmail || payload.customer_email,
      payload.customerPhone || payload.customer_phone,
    );

    logger.info(`Webhook order created: ${mainOrder.id} from ${marketplace}${subOrders.length > 0 ? ` with ${subOrders.length} sub-order(s)` : ''}`);

    if (subOrders.length > 0) {
      const user = (req as any).user;
      await IntegrationLog.create({
        userId: user?.id || 0,
        storeId: store.id,
        platform: marketplace,
        endpoint: '/webhook/order',
        method: 'POST',
        isSuccess: true,
        requestPayload: { marketplace, itemCount: items.length },
        responsePayload: { mainOrderId: mainOrder.id, subOrderIds: subOrders.map(s => s.id) },
        errorMessage: null,
        createdAt: new Date(),
      });
    }

    return res.status(201).json({ order: mainOrder, subOrders, created: true });
  } catch (error) {
    logger.error({ err: error }, 'Webhook order error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

integrationRoutes.post('/webhook/stock', [
  body('marketplace').isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
  body('productId').isString(),
  body('quantity').isInt({ min: 0 }),
], validate, async (req: Request, res: Response) => {
  try {
    const { marketplace, productId, quantity } = req.body;

    const listing = await ProductMarketplaceListing.findOne({
      where: { platform: marketplace, externalCode: productId, status: 'active' },
      include: [{ model: Product, as: 'product' }],
    });

    if (!listing || !listing.product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await listing.product.update({ quantity });
    await listing.update({ lastSyncedAt: new Date() });

    logger.info(`Stock updated via webhook: ${productId} = ${quantity} on ${marketplace}`);
    res.json({ success: true, quantity });
  } catch (error) {
    logger.error({ err: error }, 'Webhook stock error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

integrationRoutes.post('/webhook/price', [
  body('marketplace').isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
  body('productId').isString(),
  body('price').isFloat({ min: 0 }),
], validate, async (req: Request, res: Response) => {
  try {
    const { marketplace, productId, price } = req.body;

    const listing = await ProductMarketplaceListing.findOne({
      where: { platform: marketplace, externalCode: productId, status: 'active' },
      include: [{ model: Product, as: 'product' }],
    });

    if (!listing || !listing.product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await listing.product.update({ priceTRY: price });
    await listing.update({ lastSyncedAt: new Date() });

    logger.info(`Price updated via webhook: ${productId} = ${price} on ${marketplace}`);
    res.json({ success: true, price });
  } catch (error) {
    logger.error({ err: error }, 'Webhook price error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

integrationRoutes.get('/logs', authMiddleware, requireStore, [
  query('marketplace').optional().isString(),
  query('isSuccess').optional().isBoolean(),
  query('endpoint').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('offset').optional().isInt({ min: 0 }),
], async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace, isSuccess, endpoint, limit = 50, offset = 0 } = req.query;
    const where: any = { storeId: store.id };
    if (marketplace) where.platform = marketplace;
    if (isSuccess !== undefined) where.isSuccess = isSuccess === 'true';
    if (endpoint) where.endpoint = { [Op.like]: `%${endpoint}%` };
    const { rows, count } = await IntegrationLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset),
    });
    res.json({ logs: rows, total: count });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Integration logs error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

integrationRoutes.post('/:marketplace/import-orders', authMiddleware, requireStore, [
  param('marketplace').isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
  body('startDate').optional().isString(),
  body('endDate').optional().isString(),
  body('status').optional().isString(),
  body('maxPages').optional().isInt({ min: 1, max: 20 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { marketplace } = req.params;
    const { startDate, endDate, status, maxPages: maxPagesBody } = req.body;
    const maxPages = maxPagesBody || 5;

    const integration = await MarketplaceIntegration.findOne({
      where: { storeId: store.id, marketplace, isActive: true },
    });
    if (!integration) {
      return res.status(400).json({ error: `${marketplace} entegrasyonu aktif değil` });
    }

    const mpConfig = getMarketplaceConfig(marketplace as MarketplaceType, integration);
    const client = createMarketplaceClient(marketplace as MarketplaceType, mpConfig);

    const imported: any[] = [];
    let hasMore = true;
    let page = 0;

    const params: any = { size: 100 };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (status) params.status = status;

    while (hasMore && page < maxPages) {
      params.page = page;
      const packages = await client.getOrders(params);
      if (!packages || packages.length === 0) break;

      for (let pkg of packages) {
        // Pazarama-specific normalization: map raw API fields to common format
        if (marketplace === 'pazarama') {
          const c = pkg.customer || {};
          const sa = pkg.shippingAddress || {};
          pkg = {
            ...pkg,
            id: pkg.id || pkg.orderId,
            lines: pkg.items || pkg.lines || pkg.orderItems || [],
            customerfullName: c.name || c.fullName || '',
            gsm: c.phone || c.gsm || '',
            customerEmail: c.email || '',
            address: sa.address || sa.line || pkg.address || '',
            city: sa.city || pkg.city || '',
            district: sa.district || pkg.district || '',
            neighborhood: sa.neighborhood || '',
            cargoTrackingNumber: pkg.cargoTrackingNumber || pkg.trackingNumber || pkg.cargoTrackingCode || '',
            cargoProviderName: pkg.cargoProviderName || pkg.carrier || pkg.cargoCompany || '',
            orderNumber: pkg.orderNumber || '',
          };
        }

        const marketplaceOrderId = String(pkg.id);
        const existing = await DropshippingOrder.findOne({
          where: { storeId: store.id, marketplaceOrderId, marketplace },
        });

        const lines = pkg.lines || pkg.items || [];
        const items = lines.map((l: any) => ({
          sku: l.barcode || l.sku || l.stockCode || l.productCode || '',
          name: l.productName || l.title || l.name || '',
          quantity: l.quantity || 1,
          price: parseFloat(l.salePrice || l.price || l.unitPrice || 0),
          image: l.imageUrl || '',
          variantAttributes: l.variantAttributes || [],
          orderLineId: l.orderLineId || l.id,
        }));

        const totalAmount = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

        const address = pkg.address || pkg.shippingAddress || {};
        const fullName = pkg.customerfullName || address.fullName || address.name || `${pkg.firstName || ''} ${pkg.lastName || ''}`.trim() || '';
        const phone = address.gsm || address.phone || address.phoneNumber || pkg.gsm || pkg.phone || '';
        const customerEmail = pkg.customerEmail || pkg.email || address.email || '';
        const shippingAddress = {
          fullName, phone,
          email: customerEmail,
          city: address.city || pkg.city || '',
          district: address.district || pkg.district || '',
          neighborhood: address.neighborhood || pkg.neighborhood || '',
          address: address.address || address.line || pkg.address || '',
          zipCode: address.zipCode || address.postalCode || '',
        };

        const orderNumber = pkg.orderNumber ? `PZ-${pkg.orderNumber}` : `ORD-${Date.now()}-${pkg.id}`;
        const statusMap: Record<string, string> = {
          Created: 'pending', Picking: 'processing', Invoiced: 'processing',
          Shipped: 'shipped', Delivered: 'delivered', Cancelled: 'cancelled',
          UnDelivered: 'cancelled', Returned: 'returned',
          UnPacked: 'processing', UnSupplied: 'cancelled',
          siparis_alindi: 'pending', hazirlaniyor: 'processing',
          kargoya_verildi: 'shipped', teslim_edildi: 'delivered',
          iptal_edildi: 'cancelled', iade_edildi: 'returned',
        };
        const newStatus = statusMap[pkg.status] || 'pending';

        if (existing) {
          if (existing.status !== newStatus) {
            const oldStatus = existing.status;
            await existing.update({ status: newStatus, items, shippingAddress, totalAmount, customerName: fullName, customerEmail, customerPhone: phone, trackingNumber: pkg.cargoTrackingNumber || pkg.trackingNumber || '', carrier: pkg.cargoProviderName || pkg.carrier || '' });
            await OrderStatusHistory.create({
              dropshippingOrderId: existing.id,
              fromStatus: oldStatus,
              toStatus: newStatus,
              note: `Status synced from ${marketplace}: ${oldStatus} -> ${newStatus}`,
            });
            imported.push({ id: existing.id, orderNumber: existing.orderNumber, status: newStatus, marketplaceOrderId, updated: true });
          }
          continue;
        }

        const order = await DropshippingOrder.create({
          storeId: store.id,
          orderNumber,
          marketplace,
          marketplaceOrderId,
          marketplaceOrderNumber: String(pkg.orderNumber || ''),
          totalAmount,
          currency: 'TRY',
          status: newStatus,
          shippingAddress,
          items,
          customerName: fullName,
          customerEmail,
          customerPhone: phone,
          trackingNumber: pkg.cargoTrackingNumber || pkg.trackingNumber || '',
          carrier: pkg.cargoProviderName || pkg.carrier || '',
          paymentMethod: 'marketplace',
          paymentStatus: newStatus === 'cancelled' ? 'failed' : 'paid',
        } as any);

        await OrderStatusHistory.create({
          dropshippingOrderId: order.id,
          fromStatus: 'none',
          toStatus: order.status,
          note: `Imported from ${marketplace}`,
        });

        imported.push({ id: order.id, orderNumber, status: order.status, marketplaceOrderId, updated: false });
      }

      page++;
      hasMore = packages.length >= 100;
    }

    logger.info({ marketplace, storeId: store.id, imported: imported.length }, 'Orders imported from marketplace');
    res.json({ imported: imported.length, orders: imported });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Import orders error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

integrationRoutes.post('/import-all', authMiddleware, requireStore, [
  body('maxPages').optional().isInt({ min: 1, max: 20 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const maxPages = req.body.maxPages || 3;

    const integrations = await MarketplaceIntegration.findAll({
      where: { storeId: store.id, isActive: true },
    });

    const results: { marketplace: string; imported: number }[] = [];

    for (const integration of integrations) {
      try {
        const mpConfig = getMarketplaceConfig(integration.marketplace as MarketplaceType, integration);
        const client = createMarketplaceClient(integration.marketplace as MarketplaceType, mpConfig);

        let imported = 0;
        let hasMore = true;
        let page = 0;

        while (hasMore && page < maxPages) {
          const packages = await client.getOrders({ page, size: 100 });
          if (!packages || packages.length === 0) break;

          for (const pkg of packages) {
            const marketplaceOrderId = String(pkg.id);
            const existing = await DropshippingOrder.findOne({
              where: { storeId: store.id, marketplaceOrderId, marketplace: integration.marketplace },
            });
            if (existing) continue;

            const lines = pkg.lines || pkg.items || [];
            const items = lines.map((l: any) => ({
              sku: l.barcode || l.sku || l.stockCode || '',
              name: l.productName || l.title || l.name || '',
              quantity: l.quantity || 1,
              price: parseFloat(l.salePrice || l.price || 0),
              image: l.imageUrl || '',
            }));

            const totalAmount = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
            const address = pkg.address || pkg.shippingAddress || {};
            const fullName = pkg.customerfullName || address.fullName || address.name || '';
            const phone = address.gsm || address.phone || address.phoneNumber || pkg.gsm || '';
            const customerEmail = pkg.customerEmail || pkg.email || address.email || '';

            const statusMap: Record<string, string> = {
              Created: 'pending', Picking: 'processing', Invoiced: 'processing',
              Shipped: 'shipped', Delivered: 'delivered', Cancelled: 'cancelled',
              UnDelivered: 'cancelled', Returned: 'returned',
              UnPacked: 'processing', UnSupplied: 'cancelled',
            };
            const newStatus = statusMap[pkg.shipmentPackageStatus || pkg.status] || 'pending';
            const orderNumber = pkg.orderNumber ? `${integration.marketplace.toUpperCase().slice(0, 2)}-${pkg.orderNumber}` : `ORD-${Date.now()}-${pkg.id}`;

            await DropshippingOrder.create({
              storeId: store.id,
              orderNumber,
              marketplace: integration.marketplace,
              marketplaceOrderId,
              marketplaceOrderNumber: String(pkg.orderNumber || ''),
              totalAmount,
              currency: 'TRY',
              status: newStatus,
              shippingAddress: {
                fullName, phone, email: customerEmail,
                city: address.city || pkg.city || '',
                district: address.district || pkg.district || '',
                address: address.address || address.line || pkg.address || '',
                zipCode: address.zipCode || address.postalCode || '',
              },
              items,
              customerName: fullName,
              customerEmail,
              customerPhone: phone,
              trackingNumber: pkg.cargoTrackingNumber || pkg.trackingNumber || '',
              carrier: pkg.cargoProviderName || pkg.carrier || '',
              paymentMethod: 'marketplace',
              paymentStatus: newStatus === 'cancelled' ? 'failed' : 'paid',
            } as any);

            imported++;
          }

          page++;
          hasMore = packages.length >= 100;
        }

        results.push({ marketplace: integration.marketplace, imported });
        logger.info({ marketplace: integration.marketplace, storeId: store.id, imported }, 'Import-all orders from marketplace');
      } catch (mpErr) {
        logger.warn({ marketplace: integration.marketplace, err: mpErr }, 'Import-all failed for marketplace');
        results.push({ marketplace: integration.marketplace, imported: 0 });
      }
    }

    const totalImported = results.reduce((s, r) => s + r.imported, 0);
    res.json({ imported: totalImported, results });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Import-all orders error');
    res.status(500).json({ error: 'Internal server error' });
  }
});