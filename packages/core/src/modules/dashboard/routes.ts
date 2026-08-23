import { Router, Request, Response } from 'express';
import { Product } from '../../models/Product.model.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { User } from '../../models/User.model.js';
import { Store } from '../../models/Store.model.js';
import { Plan } from '../../models/Plan.model.js';
import { Subscription } from '../../models/Subscription.model.js';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import { sequelize } from '../../config/database.js';
import { Op } from 'sequelize';

export const dashboardRoutes: Router = Router();

dashboardRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const user = (req as any).user;

    const totalProducts = await Product.count({ where: { storeId: store.id } });
    const activeProducts = await Product.count({ where: { storeId: store.id, isActive: true } });

    const totalOrders = await DropshippingOrder.count({ where: { storeId: store.id } });
    const pendingOrders = await DropshippingOrder.count({ where: { storeId: store.id, status: 'pending' } });

    // Per-status breakdown — use individual counts (more reliable than GROUP BY across dialects)
    const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
    const orderStatusCounts: Record<string, number> = {};
    for (const s of statuses) {
      orderStatusCounts[s] = await DropshippingOrder.count({ where: { storeId: store.id, status: s } });
    }
    // Also include any unexpected status values that may exist (e.g. legacy 'confirmed' vs 'completed')
    try {
      const rows: any[] = await DropshippingOrder.findAll({
        where: { storeId: store.id },
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
        group: ['status'],
        raw: true,
      } as any);
      for (const r of rows) {
        const k = String((r as any).status || '');
        if (k && !(k in orderStatusCounts)) orderStatusCounts[k] = Number((r as any).count) || 0;
      }
    } catch { /* fallback counts already set */ }

    const revenueResult = await DropshippingOrder.findAll({
      where: { storeId: store.id, status: 'completed' },
      attributes: ['totalAmount'],
    });
    const totalRevenue = revenueResult.reduce((sum, o) => sum + parseFloat(o.totalAmount as any), 0);

    const activeIntegrations = await MarketplaceIntegration.count({
      where: { storeId: store.id, isActive: true },
    });

    const lowStockCount = await Product.count({
      where: { storeId: store.id, quantity: { [Op.lte]: 5 } },
    });

    const recentOrders = await DropshippingOrder.findAll({
      where: { storeId: store.id },
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    const lowStockProducts = await Product.findAll({
      where: { storeId: store.id, quantity: { [Op.lte]: 5 } },
      limit: 10,
      order: [['quantity', 'ASC']],
    });

    let plan = null;
    let subscription = null;

    try {
      plan = await Plan.findByPk(store.planId, {
        attributes: ['id', 'name', 'slug', 'price', 'productLimit', 'aiCredits', 'storeLimit', 'features', 'modules'],
      });

      subscription = await Subscription.findOne({
        where: { storeId: store.id, status: { [Op.ne]: 'canceled' } },
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'status', 'trialEndsAt', 'currentPeriodEnd', 'canceledAt', 'createdAt'],
      });
    } catch (e) {
      // Plan/subscription tables may not exist yet
    }

    res.json({
      store: {
        id: store.id,
        name: store.name,
        siteCode: store.siteCode,
        domain: store.domain,
        email: store.email,
      },
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      orderStatusCounts,
      totalRevenue,
      activeIntegrations,
      lowStockCount,
      recentOrders,
      lowStockProducts,
      currentCredits: user.aiCredits,
      plan: plan ? {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        price: plan.price,
        productLimit: plan.productLimit,
        aiCredits: plan.aiCredits,
        storeLimit: plan.storeLimit,
        features: plan.features,
        modules: plan.modules,
      } : null,
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        canceledAt: subscription.canceledAt,
      } : null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Dashboard stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
