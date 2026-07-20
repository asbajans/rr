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
import { publicStoreRoutes } from './modules/store/publicRoutes.js';
import { publicProductRoutes } from './modules/product/publicRoutes.js';
import { publicOrderRoutes } from './modules/order/publicRoutes.js';

export const registerRoutes = (app: any): void => {
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', superAdminRoutes); // Super admin routes first (cross-store)
  app.use('/api/admin', storeRoutes); // Store-scoped routes
  app.use('/api/admin/products', productRoutes);
  app.use('/api/admin', variantRoutes);
  app.use('/api/admin/categories', categoryRoutes);
  app.use('/api/admin/variations', variationRoutes);
  app.use('/api/admin/b2b', b2bRoutes);
  app.use('/api/admin/integrations', marketplaceRoutes);
  app.use('/api/admin/orders', orderRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api', slaveRoutes);
  app.use('/api/admin/integration', integrationRoutes);
  app.use('/api/store', publicStoreRoutes);
  app.use('/api/store', publicProductRoutes);
  app.use('/api/store', publicOrderRoutes);
};