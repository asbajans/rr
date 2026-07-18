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
import { Product } from './Product';
import { Store } from './Store';

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