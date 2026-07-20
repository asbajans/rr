import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
  AllowNull,
  Unique,
  Default,
  BelongsTo,
  HasMany,
  ForeignKey,
} from 'sequelize-typescript';
import { Plan } from './Plan.model.js';
import { User } from './User.model.js';
import { Subscription } from './Subscription.model.js';
import { Product } from './Product.model.js';
import { Category } from './Category.model.js';
import { MarketplaceIntegration } from './MarketplaceIntegration.model.js';
import { ApiKey } from './ApiKey.model.js';
import { ProductB2bSetting as B2BSetting } from './ProductB2bSetting.model.js';
import { B2BRequest } from './B2BModels.js';
import { B2BListedProduct } from './B2BModels.js';
import { DropshippingOrder } from './DropshippingOrder.model.js';
import { Page } from './ContentModels.js';
import { StoreLocation } from './ContentModels.js';
import { StorePaymentMethod } from './ContentModels.js';
import { ExternalFeed } from './ContentModels.js';
import { CreditLog } from './CreditLog.model.js';
import { IntegrationLog } from './LogModels.js';

@Table({
  tableName: 'stores',
  timestamps: true,
})
export class Store extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare name: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING(50))
  declare siteCode: string;

  @AllowNull(true)
  @Unique
  @Column(DataType.STRING(255))
  declare domain: string;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare email: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @ForeignKey(() => Plan)
  @AllowNull(true)
  @Column(DataType.BIGINT)
  declare planId: number;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare stripeAccountId: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare theme: object;

  @Default('TRY')
  @Column(DataType.STRING(3))
  declare currency: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare taxSettings: object;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare shippingSettings: object;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Plan)
  declare plan: Plan;

  @HasMany(() => User)
  declare users: User[];

  @HasMany(() => Subscription)
  declare subscriptions: Subscription[];

  @HasMany(() => Product)
  declare products: Product[];

  @HasMany(() => Category)
  declare categories: Category[];

  @HasMany(() => MarketplaceIntegration)
  declare marketplaceIntegrations: MarketplaceIntegration[];

  @HasMany(() => ApiKey)
  declare apiKeys: ApiKey[];

  @HasMany(() => B2BSetting)
  declare b2bSettings: B2BSetting[];

  @HasMany(() => B2BRequest, 'ownerStoreId')
  declare incomingB2BRequests: B2BRequest[];

  @HasMany(() => B2BRequest, 'requesterStoreId')
  declare outgoingB2BRequests: B2BRequest[];

  @HasMany(() => B2BListedProduct)
  declare b2bListedProducts: B2BListedProduct[];

  @HasMany(() => DropshippingOrder)
  declare dropshippingOrders: DropshippingOrder[];

  @HasMany(() => Page)
  declare pages: Page[];

  @HasMany(() => StoreLocation)
  declare locations: StoreLocation[];

  @HasMany(() => StorePaymentMethod)
  declare paymentMethods: StorePaymentMethod[];

  @HasMany(() => ExternalFeed)
  declare externalFeeds: ExternalFeed[];

  @HasMany(() => CreditLog)
  declare creditLogs: CreditLog[];

  @HasMany(() => IntegrationLog)
  declare integrationLogs: IntegrationLog[];
}