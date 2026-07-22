import { Router, Request, Response } from 'express';
import { Product } from '../../models/Product.model.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { User } from '../../models/User.model.js';
import { authMiddleware, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import { Op } from 'sequelize';

export const dashboardRoutes: Router = Router();

dashboardRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const user = (req as any).user;

    const totalProducts = await Product.count({ where: { storeId: store.id } });

    const totalOrders = await DropshippingOrder.count({ where: { storeId: store.id } });

    const revenueResult = await DropshippingOrder.findAll({
      where: { storeId: store.id, status: 'completed' },
      attributes: ['totalAmount'],
    });
    const totalRevenue = revenueResult.reduce((sum, o) => sum + parseFloat(o.totalAmount as any), 0);

    const activeIntegrations = await MarketplaceIntegration.count({
      where: { storeId: store.id, isActive: true },
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

    res.json({
      totalProducts,
      totalOrders,
      totalRevenue,
      activeIntegrations,
      recentOrders,
      lowStockProducts,
      currentCredits: user.aiCredits,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Dashboard stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
