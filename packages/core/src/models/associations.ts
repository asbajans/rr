import { Store } from './Store.model.js';
import { User } from './User.model.js';
import { Plan } from './Plan.model.js';
import { Subscription } from './Subscription.model.js';
import { Category } from './Category.model.js';
import { MarketplaceCategoryMapping } from './Category.model.js';
import { Product } from './Product.model.js';
import { ProductVariant } from './ProductVariant.model.js';
import { ProductMarketplaceListing } from './ProductMarketplaceListing.model.js';
import { MarketplaceIntegration } from './MarketplaceIntegration.model.js';
import { ProductB2bSetting } from './ProductB2bSetting.model.js';
import { B2BRequest } from './B2BRequest.model.js';
import { B2BListedProduct } from './B2BListedProduct.model.js';
import { IntegrationLog } from './IntegrationLog.model.js';
import { DropshippingOrder } from './DropshippingOrder.model.js';
import { OrderStatusHistory } from './OrderStatusHistory.model.js';
import { ApiKey } from './ApiKey.model.js';
import { CreditLog } from './CreditLog.model.js';
import { Page } from './Page.model.js';
import { StoreLocation } from './StoreLocation.model.js';
import { StorePaymentMethod } from './StorePaymentMethod.model.js';
import { ExternalFeed } from './ExternalFeed.model.js';
import { FeedSyncLog } from './FeedSyncLog.model.js';
import { Variation } from './Variation.model.js';
import { VariationOption } from './VariationOption.model.js';

export function setupAssociations() {
  Store.hasMany(User, { foreignKey: 'storeId', as: 'users' });
  User.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Plan.hasMany(Store, { foreignKey: 'planId', as: 'stores' });
  Store.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });

  Store.hasOne(Subscription, { foreignKey: 'storeId', as: 'subscription' });
  Subscription.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Plan.hasMany(Subscription, { foreignKey: 'planId', as: 'subscriptions' });
  Subscription.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });

  Store.hasMany(Category, { foreignKey: 'storeId', as: 'categories' });
  Category.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Category.hasMany(Category, { foreignKey: 'parentId', as: 'children' });
  Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parent' });

  Category.hasMany(MarketplaceCategoryMapping, { foreignKey: 'categoryId', as: 'marketplaceMappings' });
  MarketplaceCategoryMapping.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

  Store.hasMany(Product, { foreignKey: 'storeId', as: 'products' });
  Product.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
  Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

  Product.hasMany(ProductVariant, { foreignKey: 'productId', as: 'variants' });
  ProductVariant.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

  Store.hasMany(ProductVariant, { foreignKey: 'storeId', as: 'productVariants' });
  ProductVariant.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Product.hasMany(ProductMarketplaceListing, { foreignKey: 'productId', as: 'marketplaceListings' });
  ProductMarketplaceListing.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

  Store.hasMany(ProductMarketplaceListing, { foreignKey: 'storeId', as: 'marketplaceListings' });
  ProductMarketplaceListing.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Store.hasMany(MarketplaceIntegration, { foreignKey: 'storeId', as: 'marketplaceIntegrations' });
  MarketplaceIntegration.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Product.hasOne(ProductB2bSetting, { foreignKey: 'productId', as: 'b2bSetting' });
  ProductB2bSetting.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

  Store.hasMany(ProductB2bSetting, { foreignKey: 'storeId', as: 'b2bSettings' });
  ProductB2bSetting.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Product.hasMany(B2BRequest, { foreignKey: 'productId', as: 'b2bRequests' });
  B2BRequest.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

  ProductVariant.hasMany(B2BRequest, { foreignKey: 'variantId', as: 'b2bRequests' });
  B2BRequest.belongsTo(ProductVariant, { foreignKey: 'variantId', as: 'variant' });

  Store.hasMany(B2BRequest, { foreignKey: 'requesterStoreId', as: 'outgoingB2BRequests' });
  B2BRequest.belongsTo(Store, { foreignKey: 'requesterStoreId', as: 'requesterStore' });

  Store.hasMany(B2BRequest, { foreignKey: 'ownerStoreId', as: 'incomingB2BRequests' });
  B2BRequest.belongsTo(Store, { foreignKey: 'ownerStoreId', as: 'ownerStore' });

  Store.hasMany(B2BListedProduct, { foreignKey: 'storeId', as: 'b2bListedProducts' });
  B2BListedProduct.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Store.hasMany(B2BListedProduct, { foreignKey: 'originalStoreId', as: 'originalB2BListedProducts' });
  B2BListedProduct.belongsTo(Store, { foreignKey: 'originalStoreId', as: 'originalStore' });

  Product.hasMany(B2BListedProduct, { foreignKey: 'productId', as: 'b2bListedProducts' });
  B2BListedProduct.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

  Product.hasMany(B2BListedProduct, { foreignKey: 'originalProductId', as: 'originalB2BListedProducts' });
  B2BListedProduct.belongsTo(Product, { foreignKey: 'originalProductId', as: 'originalProduct' });

  B2BRequest.hasMany(B2BListedProduct, { foreignKey: 'b2bRequestId', as: 'listedProducts' });
  B2BListedProduct.belongsTo(B2BRequest, { foreignKey: 'b2bRequestId', as: 'b2bRequest' });

  Store.hasMany(IntegrationLog, { foreignKey: 'storeId', as: 'integrationLogs' });
  IntegrationLog.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  User.hasMany(IntegrationLog, { foreignKey: 'userId', as: 'integrationLogs' });
  IntegrationLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Store.hasMany(DropshippingOrder, { foreignKey: 'storeId', as: 'dropshippingOrders' });
  DropshippingOrder.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  DropshippingOrder.hasMany(OrderStatusHistory, { foreignKey: 'dropshippingOrderId', as: 'statusHistory' });
  OrderStatusHistory.belongsTo(DropshippingOrder, { foreignKey: 'dropshippingOrderId', as: 'order' });

  Store.hasMany(ApiKey, { foreignKey: 'storeId', as: 'apiKeys' });
  ApiKey.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  User.hasMany(CreditLog, { foreignKey: 'userId', as: 'creditLogs' });
  CreditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Store.hasMany(CreditLog, { foreignKey: 'storeId', as: 'creditLogs' });
  CreditLog.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Store.hasMany(Page, { foreignKey: 'storeId', as: 'pages' });
  Page.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Store.hasMany(StoreLocation, { foreignKey: 'storeId', as: 'locations' });
  StoreLocation.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Store.hasMany(StorePaymentMethod, { foreignKey: 'storeId', as: 'paymentMethods' });
  StorePaymentMethod.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Store.hasMany(ExternalFeed, { foreignKey: 'storeId', as: 'externalFeeds' });
  ExternalFeed.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  ExternalFeed.hasMany(FeedSyncLog, { foreignKey: 'feedId', as: 'syncLogs' });
  FeedSyncLog.belongsTo(ExternalFeed, { foreignKey: 'feedId', as: 'feed' });

  Store.hasMany(Variation, { foreignKey: 'storeId', as: 'variations' });
  Variation.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

  Variation.hasMany(VariationOption, { foreignKey: 'variationId', as: 'options' });
  VariationOption.belongsTo(Variation, { foreignKey: 'variationId', as: 'variation' });
}