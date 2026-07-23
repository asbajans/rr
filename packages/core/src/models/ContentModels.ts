import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt,
  AllowNull, Default, ForeignKey, BelongsTo, Index,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';

@Table({ tableName: 'pages', timestamps: true, indexes: [{ fields: ['storeId'] }, { fields: ['slug'] }] })
export class Page extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(200)) declare slug: string;
  @AllowNull(false) @Column(DataType.JSONB) declare title: object;
  @AllowNull(true) @Column(DataType.JSONB) declare content: object;
  @AllowNull(true) @Column(DataType.JSONB) declare meta: object;
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
  @AllowNull(true) @Column(DataType.JSONB) declare coordinates: object;
  @AllowNull(true) @Column(DataType.STRING(50)) declare phone: string;
  @AllowNull(true) @Column(DataType.JSONB) declare hours: object;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
}

@Table({ tableName: 'store_payment_methods', timestamps: true, indexes: [{ fields: ['storeId'] }] })
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
  @AllowNull(false) @Column(DataType.STRING(10)) declare format: string;
  @AllowNull(true) @Column(DataType.JSONB) declare mapping: object;

  @Default('none') @Column(DataType.STRING(20)) declare authType: string;
  @AllowNull(true) @Column(DataType.JSONB) declare authCredentials: object;
  @Default('fixed') @Column(DataType.STRING(20)) declare pricingMode: string;
  @Default('TRY') @Column(DataType.STRING(10)) declare currency: string;
  @Default(1) @Column(DataType.DECIMAL(10, 2)) declare priceMultiplier: number;
  @AllowNull(true) @Column(DataType.DECIMAL(10, 2)) declare defaultGramWeight: number;
  @AllowNull(true) @Column(DataType.INTEGER) declare defaultMilyem: number;
  @AllowNull(true) @Column(DataType.DECIMAL(5, 2)) declare defaultProfitMargin: number;
  @AllowNull(true) @Column(DataType.STRING(200)) declare defaultCategory: string;
  @AllowNull(true) @Column(DataType.INTEGER) declare defaultCategoryId: number;
  @Default(false) @Column(DataType.BOOLEAN) declare defaultIsB2bEnabled: boolean;
  @Default(1) @Column(DataType.INTEGER) declare defaultQuantity: number;
  @AllowNull(true) @Column(DataType.JSONB) declare defaultMarketplaces: string[];
  @Default({}) @Column(DataType.JSONB) declare fieldMapping: object;
  @Default(false) @Column(DataType.BOOLEAN) declare autoSync: boolean;
  @Default('manual') @Column(DataType.STRING(20)) declare updateInterval: string;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @AllowNull(true) @Column(DataType.DATE) declare lastSyncAt: Date;
  @AllowNull(true) @Column(DataType.JSONB) declare lastSyncResult: object;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
}

@Table({ tableName: 'feed_sync_logs', timestamps: true, indexes: [{ fields: ['feedId'] }, { fields: ['createdAt'] }] })
export class FeedSyncLog extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => ExternalFeed) @AllowNull(false) @Index @Column(DataType.BIGINT) declare feedId: number;
  @Default('pending') @Column(DataType.STRING(20)) declare status: string;
  @AllowNull(true) @Column(DataType.DATE) declare startedAt: Date;
  @AllowNull(true) @Column(DataType.DATE) declare completedAt: Date;
  @Default(0) @Column(DataType.INTEGER) declare productsProcessed: number;
  @Default(0) @Column(DataType.INTEGER) declare productsCreated: number;
  @Default(0) @Column(DataType.INTEGER) declare productsUpdated: number;
  @Default(0) @Column(DataType.INTEGER) declare productsFailed: number;
  @AllowNull(true) @Column(DataType.JSONB) declare summary: object;
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