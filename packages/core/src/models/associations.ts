import { Store } from './Store.model.js';
import { Product } from './Product.model.js';
import { ProductVariant } from './ProductVariant.model.js';
import { B2BRequest, B2BListedProduct } from './B2BModels.js';
import { ExternalFeed, FeedSyncLog, Variation, VariationOption } from './ContentModels.js';

/**
 * Only associations NOT already defined by sequelize-typescript decorators.
 * All core model decorators (@HasMany/@BelongsTo/@HasOne in model files)
 * auto-create associations — do NOT duplicate them here.
 */
export function setupAssociations() {
  // B2BListedProduct: extra Store.hasMany for originalStoreId
  Store.hasMany(B2BListedProduct, { foreignKey: 'originalStoreId', as: 'originalB2BListedProducts' });

  // B2BListedProduct: extra Product.hasMany for productId and originalProductId
  Product.hasMany(B2BListedProduct, { foreignKey: 'productId', as: 'b2bListedProducts' });
  Product.hasMany(B2BListedProduct, { foreignKey: 'originalProductId', as: 'originalB2BListedProducts' });

  // B2BListedProduct: B2BRequest.hasMany
  B2BRequest.hasMany(B2BListedProduct, { foreignKey: 'b2bRequestId', as: 'listedProducts' });

  // B2BRequest <-> ProductVariant (no decorators exist for this pair)
  ProductVariant.hasMany(B2BRequest, { foreignKey: 'variantId', as: 'b2bRequests' });
  B2BRequest.belongsTo(ProductVariant, { foreignKey: 'variantId', as: 'variant' });

  // Content models: ExternalFeed.hasMany(FeedSyncLog), Variation.hasMany(VariationOption)
  ExternalFeed.hasMany(FeedSyncLog, { foreignKey: 'feedId', as: 'syncLogs' });
  Variation.hasMany(VariationOption, { foreignKey: 'variationId', as: 'options' });
}