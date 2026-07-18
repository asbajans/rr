import { config } from './config/env.js';

export const registerRoutes = (app: any): void => {
  import('./modules/auth/routes.js').then(({ authRoutes }) => app.use('/api/auth', authRoutes));
  import('./modules/store/routes.js').then(({ storeRoutes }) => app.use('/api/admin', storeRoutes));
  import('./modules/product/routes.js').then(({ productRoutes }) => app.use('/api/admin/products', productRoutes));
  import('./modules/product/variantRoutes.js').then(({ variantRoutes }) => app.use('/api/admin', variantRoutes));
  import('./modules/category/routes.js').then(({ categoryRoutes }) => app.use('/api/admin/categories', categoryRoutes));
  import('./modules/variation/routes.js').then(({ variationRoutes }) => app.use('/api/admin/variations', variationRoutes));
  import('./modules/b2b/routes.js').then(({ b2bRoutes }) => app.use('/api/admin/b2b', b2bRoutes));
  import('./modules/marketplace/routes.js').then(({ marketplaceRoutes }) => app.use('/api/admin/integrations', marketplaceRoutes));
  import('./modules/order/routes.js').then(({ orderRoutes }) => app.use('/api/admin/orders', orderRoutes));
  import('./modules/ai/routes.js').then(({ aiRoutes }) => app.use('/api/ai', aiRoutes));
  import('./modules/slave/routes.js').then(({ slaveRoutes }) => app.use('/api', slaveRoutes));
  import('./modules/integration/routes.js').then(({ integrationRoutes }) => app.use('/api/admin/integration', integrationRoutes));

  import('./modules/store/publicRoutes.js').then(({ publicStoreRoutes }) => app.use('/api/store', publicStoreRoutes));
  import('./modules/product/publicRoutes.js').then(({ publicProductRoutes }) => app.use('/api/store', publicProductRoutes));
  import('./modules/order/publicRoutes.js').then(({ publicOrderRoutes }) => app.use('/api/store', publicOrderRoutes));
};