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
        attributes: ['id', 'name', 'price', 'productLimit', 'aiCredits', 'features'],
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
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      totalRevenue,
      activeIntegrations,
      lowStockCount,
      recentOrders,
      lowStockProducts,
      currentCredits: user.aiCredits,
      plan: plan ? {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        productLimit: plan.productLimit,
        aiCredits: plan.aiCredits,
        features: plan.features,
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
