import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt,
  AllowNull, Default, ForeignKey, BelongsTo, Index, Unique,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';

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