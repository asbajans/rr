import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt,
  AllowNull, Default, ForeignKey, BelongsTo, Index, Unique,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { Product } from './Product.model.js';
import { ProductVariant } from './ProductVariant.model.js';
import { User } from './User.model.js';

@Table({ tableName: 'pages', timestamps: true, indexes: [{ fields: ['storeId', 'slug'] }, { fields: ['storeId', 'isActive'] }] })
export class Page extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(200)) declare slug: string;
  @AllowNull(false) @Column(DataType.JSONB) declare title: object;
  @AllowNull(true) @Column(DataType.JSONB) declare content: object;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
}

@Table({ tableName: 'store_locations', timestamps: true, indexes: [{ fields: ['storeId'] }] })
export class StoreLocation extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(255)) declare name: string;
  @AllowNull(true) @Column(DataType.TEXT) declare address: string;
  @AllowNull(true) @Column(DataType.STRING(100)) declare city: string;
  @AllowNull(true) @Column(DataType.STRING(100)) declare country: string;
  @AllowNull(true) @Column(DataType.STRING(20)) declare phone: string;
  @AllowNull(true) @Column(DataType.JSONB) declare coordinates: object;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
}

@Table({ tableName: 'store_payment_methods', timestamps: true, indexes: [{ fields: ['storeId', 'isActive'] }] })
export class StorePaymentMethod extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(50)) declare type: string;
  @AllowNull(false) @Column(DataType.JSONB) declare config: object;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
}

@Table({ tableName: 'external_feeds', timestamps: true, indexes: [{ fields: ['storeId', 'isActive'] }] })
export class ExternalFeed extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(100)) declare name: string;
  @AllowNull(false) @Column(DataType.STRING(500)) declare url: string;
  @AllowNull(false) @Column(DataType.ENUM('xml', 'json', 'csv')) declare format: string;
  @AllowNull(true) @Column(DataType.JSONB) declare mapping: object;
  @AllowNull(true) @Column(DataType.STRING(100)) declare schedule: string;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @AllowNull(true) @Column(DataType.DATE) declare lastSyncAt: Date;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
}

@Table({ tableName: 'feed_sync_logs', timestamps: true, indexes: [{ fields: ['feedId'] }, { fields: ['createdAt'] }] })
export class FeedSyncLog extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => ExternalFeed) @AllowNull(false) @Index @Column(DataType.BIGINT) declare feedId: number;
  @Default('pending') @Column(DataType.ENUM('pending', 'running', 'completed', 'failed')) declare status: string;
  @Default(0) @Column(DataType.INTEGER) declare productsProcessed: number;
  @Default(0) @Column(DataType.INTEGER) declare productsCreated: number;
  @Default(0) @Column(DataType.INTEGER) declare productsUpdated: number;
  @Default(0) @Column(DataType.INTEGER) declare productsFailed: number;
  @AllowNull(true) @Column(DataType.TEXT) declare errorMessage: string;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;

  @BelongsTo(() => ExternalFeed) declare feed: ExternalFeed;
}

@Table({ tableName: 'variations', timestamps: true, indexes: [{ fields: ['storeId'] }] })
export class Variation extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(100)) declare name: string;
  @AllowNull(false) @Column(DataType.STRING(50)) declare type: string;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
}

@Table({ tableName: 'variation_options', timestamps: true, indexes: [{ fields: ['variationId'] }] })
export class VariationOption extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Variation) @AllowNull(false) @Index @Column(DataType.BIGINT) declare variationId: number;
  @AllowNull(false) @Column(DataType.STRING(200)) declare value: string;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Variation) declare variation: Variation;
}

@Table({ tableName: 'product_b2b_settings', timestamps: true, indexes: [{ unique: true, fields: ['storeId', 'productId'] }] })
export class ProductB2bSetting extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @ForeignKey(() => Product) @AllowNull(false) @Index @Column(DataType.BIGINT) declare productId: number;
  @Default(false) @Column(DataType.BOOLEAN) declare isB2BEnabled: boolean;
  @Default(0) @Column(DataType.DECIMAL(5, 2)) declare b2bDiscount: number;
  @AllowNull(true) @Column(DataType.DECIMAL(15, 2)) declare b2bPrice: number;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
  @BelongsTo(() => Product) declare product: Product;
}

@Table({ tableName: 'b2b_requests', timestamps: true, indexes: [{ fields: ['requesterStoreId'] }, { fields: ['ownerStoreId'] }, { fields: ['status'] }, { unique: true, fields: ['productId', 'requesterStoreId', 'ownerStoreId'] }] })
export class B2BRequest extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Product) @AllowNull(false) @Index @Column(DataType.BIGINT) declare productId: number;
  @ForeignKey(() => ProductVariant) @AllowNull(true) @Column(DataType.BIGINT) declare variantId: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare requesterStoreId: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare ownerStoreId: number;
  @Default('pending') @Column(DataType.ENUM('pending', 'approved', 'rejected')) declare status: string;
  @AllowNull(true) @Column(DataType.TEXT) declare requestNote: string;
  @Default(0) @Column(DataType.DECIMAL(5, 2)) declare profitMargin: number;
  @AllowNull(true) @Column(DataType.JSONB) declare marketplaces: string[];
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Product) declare product: Product;
  @BelongsTo(() => ProductVariant) declare variant: ProductVariant;
  @BelongsTo(() => Store, 'requesterStoreId') declare requesterStore: Store;
  @BelongsTo(() => Store, 'ownerStoreId') declare ownerStore: Store;
}

@Table({ tableName: 'b2b_listed_products', timestamps: true, indexes: [{ fields: ['storeId'] }, { fields: ['originalStoreId'] }, { fields: ['b2bRequestId'] }] })
export class B2BListedProduct extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare originalStoreId: number;
  @ForeignKey(() => Product) @AllowNull(false) @Index @Column(DataType.BIGINT) declare productId: number;
  @ForeignKey(() => Product) @AllowNull(false) @Index @Column(DataType.BIGINT) declare originalProductId: number;
  @ForeignKey(() => B2BRequest) @AllowNull(false) @Index @Column(DataType.BIGINT) declare b2bRequestId: number;
  @Default(0) @Column(DataType.DECIMAL(5, 2)) declare profitMargin: number;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store, 'storeId') declare store: Store;
  @BelongsTo(() => Store, 'originalStoreId') declare originalStore: Store;
  @BelongsTo(() => Product, 'productId') declare product: Product;
  @BelongsTo(() => Product, 'originalProductId') declare originalProduct: Product;
  @BelongsTo(() => B2BRequest) declare b2bRequest: B2BRequest;
}

@Table({ tableName: 'integration_logs', timestamps: false, indexes: [{ fields: ['storeId', 'platform'] }, { fields: ['createdAt'] }, { fields: ['isSuccess'] }] })
export class IntegrationLog extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => User) @AllowNull(true) @Column(DataType.BIGINT) declare userId: number;
  @ForeignKey(() => Store) @AllowNull(true) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(50)) declare platform: string;
  @AllowNull(false) @Column(DataType.STRING(500)) declare endpoint: string;
  @AllowNull(false) @Column(DataType.STRING(10)) declare method: string;
  @AllowNull(false) @Column(DataType.BOOLEAN) declare isSuccess: boolean;
  @AllowNull(true) @Column(DataType.JSONB) declare requestPayload: object;
  @AllowNull(true) @Column(DataType.JSONB) declare responsePayload: object;
  @AllowNull(true) @Column(DataType.TEXT) declare errorMessage: string;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;

  @BelongsTo(() => User) declare user: User;
  @BelongsTo(() => Store) declare store: Store;
}

@Table({ tableName: 'dropshipping_orders', timestamps: true, indexes: [{ fields: ['storeId', 'marketplace'] }, { fields: ['status'] }, { fields: ['marketplaceOrderId'] }] })
export class DropshippingOrder extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Unique @Column(DataType.STRING(50)) declare orderNumber: string;
  @AllowNull(false) @Column(DataType.STRING(50)) declare marketplace: string;
  @AllowNull(false) @Column(DataType.STRING(100)) declare marketplaceOrderId: string;
  @AllowNull(true) @Column(DataType.STRING(100)) declare marketplaceOrderNumber: string;
  @Default('pending') @Column(DataType.STRING(50)) declare status: string;
  @AllowNull(false) @Column(DataType.DECIMAL(15, 2)) declare totalAmount: number;
  @Default('TRY') @Column(DataType.STRING(3)) declare currency: string;
  @AllowNull(false) @Column(DataType.JSONB) declare shippingAddress: object;
  @AllowNull(false) @Column(DataType.JSONB) declare items: object;
  @AllowNull(true) @Column(DataType.STRING(100)) declare trackingNumber: string;
  @AllowNull(true) @Column(DataType.STRING(100)) declare carrier: string;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
}

@Table({ tableName: 'order_status_histories', timestamps: false, indexes: [{ fields: ['dropshippingOrderId'] }] })
export class OrderStatusHistory extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => DropshippingOrder) @AllowNull(false) @Index @Column(DataType.BIGINT) declare dropshippingOrderId: number;
  @AllowNull(true) @Column(DataType.STRING(50)) declare fromStatus: string;
  @AllowNull(false) @Column(DataType.STRING(50)) declare toStatus: string;
  @AllowNull(true) @Column(DataType.TEXT) declare note: string;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;

  @BelongsTo(() => DropshippingOrder) declare order: DropshippingOrder;
}

@Table({ tableName: 'credit_logs', timestamps: false, indexes: [{ fields: ['userId'] }, { fields: ['storeId'] }, { fields: ['createdAt'] }] })
export class CreditLog extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => User) @AllowNull(false) @Index @Column(DataType.BIGINT) declare userId: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(50)) declare action: string;
  @AllowNull(false) @Column(DataType.STRING(50)) declare module: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare amount: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare balanceBefore: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare balanceAfter: number;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;

  @BelongsTo(() => User) declare user: User;
  @BelongsTo(() => Store) declare store: Store;
}