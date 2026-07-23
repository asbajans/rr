import { Sequelize } from 'sequelize-typescript';
import { config } from './env.js';
import { Store } from '../models/Store.model.js';
import { User } from '../models/User.model.js';
import { Plan } from '../models/Plan.model.js';
import { Subscription } from '../models/Subscription.model.js';
import { Category, MarketplaceCategoryMapping } from '../models/Category.model.js';
import { Product } from '../models/Product.model.js';
import { ProductVariant } from '../models/ProductVariant.model.js';
import { ProductMarketplaceListing } from '../models/ProductMarketplaceListing.model.js';
import { MarketplaceIntegration } from '../models/MarketplaceIntegration.model.js';
import { ProductB2bSetting } from '../models/ProductB2bSetting.model.js';
import { B2BRequest, B2BListedProduct } from '../models/B2BModels.js';
import { IntegrationLog } from '../models/LogModels.js';
import { DropshippingOrder } from '../models/DropshippingOrder.model.js';
import { OrderStatusHistory } from '../models/OrderStatusHistory.model.js';
import { ApiKey } from '../models/ApiKey.model.js';
import { CreditLog } from '../models/CreditLog.model.js';
import { Setting } from '../models/Setting.model.js';
import { AiProvider, AiModel, AiScenario, AiProviderRateLimit, AiUsageLog } from '../models/AiModels.js';
import { Page, StoreLocation, StorePaymentMethod, ExternalFeed, FeedSyncLog, Variation, VariationOption } from '../models/ContentModels.js';
import { StoreMenu } from '../models/Menu.model.js';

export const sequelize = new Sequelize(config.database.url, {
  dialect: 'postgres',
  logging: config.env === 'development' ? (msg) => console.log(msg) : false,
  pool: config.database.pool,
  models: [Store, User, Plan, Subscription, Category, MarketplaceCategoryMapping, Product, ProductVariant, ProductMarketplaceListing, MarketplaceIntegration, ProductB2bSetting, B2BRequest, B2BListedProduct, IntegrationLog, DropshippingOrder, OrderStatusHistory, ApiKey, CreditLog, Setting, AiProvider, AiModel, AiScenario, AiProviderRateLimit, AiUsageLog, Page, StoreLocation, StorePaymentMethod, ExternalFeed, FeedSyncLog, Variation, VariationOption, StoreMenu],
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true,
  },
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};