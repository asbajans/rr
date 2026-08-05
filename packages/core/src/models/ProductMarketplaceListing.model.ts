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
  Default,
  BelongsTo,
  ForeignKey,
  Index,
  Unique,
} from 'sequelize-typescript';
import { Product } from './Product.model.js';
import { Store } from './Store.model.js';

@Table({
  tableName: 'product_marketplace_listings',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['productId', 'platform'] },
    { fields: ['storeId', 'platform'] },
    { fields: ['storeId', 'status'] },
    { fields: ['externalId'] },
  ],
})
export class ProductMarketplaceListing extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Product)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare productId: number;

  @ForeignKey(() => Store)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number;

  @AllowNull(false)
  @Column(DataType.STRING(50))
  declare platform: string;

  // AI Product Studio channel this listing was published from
  // (storefront | trendyol | hepsiburada | pazarama | n11 | amazon | etsy)
  @AllowNull(true)
  @Index
  @Column(DataType.STRING(50))
  declare channel: string;

  // Serialized payload that was sent to the channel (audit + retry)
  @AllowNull(true)
  @Column(DataType.JSONB)
  declare payloadSnapshot: Record<string, any>;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare retryCount: number;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare lastAttemptAt: Date;

  @AllowNull(true)
  @Index
  @Column(DataType.STRING(200))
  declare externalId: string;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare externalCode: string;

  @Default('pending')
  @Column(DataType.ENUM('pending', 'active', 'inactive', 'failed', 'deleted'))
  declare status: 'pending' | 'active' | 'inactive' | 'failed' | 'deleted';

  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare batchRequestId: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare lastError: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare lastSyncedAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Product)
  declare product: Product;

  @BelongsTo(() => Store)
  declare store: Store;
}