import { authRoutes } from './modules/auth/routes.js';
import { storeRoutes } from './modules/store/routes.js';
import { productRoutes } from './modules/product/routes.js';
import { variantRoutes } from './modules/product/variantRoutes.js';
import { categoryRoutes } from './modules/category/routes.js';
import { variationRoutes } from './modules/variation/routes.js';
import { b2bRoutes } from './modules/b2b/routes.js';
import { marketplaceRoutes } from './modules/marketplace/routes.js';
import { orderRoutes } from './modules/order/routes.js';
import { aiRoutes } from './modules/ai/routes.js';
import { slaveRoutes } from './modules/slave/routes.js';
import { integrationRoutes } from './modules/integration/routes.js';
import { superAdminRoutes } from './modules/superAdmin/routes.js';
import { publicPlanRoutes } from './modules/plan/publicRoutes.js';
import { publicStoreRoutes } from './modules/store/publicRoutes.js';
import { publicProductRoutes } from './modules/product/publicRoutes.js';
import { publicOrderRoutes } from './modules/order/publicRoutes.js';
import { pageRoutes } from './modules/page/routes.js';
import { locationRoutes } from './modules/location/routes.js';
import { paymentMethodRoutes } from './modules/paymentMethod/routes.js';
import { feedRoutes } from './modules/feed/routes.js';
import { creditsRoutes } from './modules/ai/creditsRoutes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { uploadRoutes } from './modules/upload/routes.js';
import { menuRoutes } from './modules/menu/routes.js';
import { pixelRoutes } from './modules/pixels/routes.js';

export const registerRoutes = (app: any): void => {
  app.use('/api/auth', authRoutes);
  app.use('/api/plans', publicPlanRoutes); // Public plans (unauthenticated)
  app.use('/api/admin', superAdminRoutes); // Super admin routes first (cross-store)
  app.use('/api/admin', storeRoutes); // Store-scoped routes
  app.use('/api/admin/products', productRoutes);
  app.use('/api/admin/variants', variantRoutes);
  app.use('/api/admin/categories', categoryRoutes);
  app.use('/api/admin/variations', variationRoutes);
  app.use('/api/admin/b2b', b2bRoutes);
  app.use('/api/admin/integrations', marketplaceRoutes);
  app.use('/api/admin/orders', orderRoutes);
  app.use('/api/admin/pages', pageRoutes);
  app.use('/api/admin/locations', locationRoutes);
  app.use('/api/admin/payment-methods', paymentMethodRoutes);
  app.use('/api/admin/feeds', feedRoutes);
  app.use('/api/admin/ai/credits', creditsRoutes);
  app.use('/api/admin/dashboard', dashboardRoutes);
  app.use('/api/admin/upload', uploadRoutes);
  app.use('/api/admin/menus', menuRoutes);
  app.use('/api/admin/pixels', pixelRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/slave', slaveRoutes);
  app.use('/api/admin/slave', slaveRoutes);
  app.use('/api/admin/integration', integrationRoutes);
  app.use('/api/store', publicStoreRoutes);
  app.use('/api/store', publicProductRoutes);
  app.use('/api/store', publicOrderRoutes);
};