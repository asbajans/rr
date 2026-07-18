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
  tableName: 'product_variants',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['productId', 'sku'] },
    { fields: ['storeId'] },
  ],
})
export class ProductVariant extends Model {
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
  @Index
  @Column(DataType.STRING(100))
  declare sku: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare attributes: object;

  @AllowNull(true)
  @Column(DataType.DECIMAL(10, 3))
  declare gramWeight: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare quantity: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(15, 2))
  declare priceTRY: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(15, 2))
  declare priceUSD: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(15, 2))
  declare b2bPrice: number;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

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