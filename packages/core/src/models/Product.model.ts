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
  HasMany,
  ForeignKey,
  Unique,
  Index,
  HasOne,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { Category } from './Category.model.js';
import { ProductVariant } from './ProductVariant.model.js';
import { ProductMarketplaceListing } from './ProductMarketplaceListing.model.js';
import { ProductB2bSetting } from './ProductB2bSetting.model.js';
import { B2BRequest } from './B2BModels.js';

@Table({
  tableName: 'products',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['storeId', 'sku'] },
    { fields: ['storeId', 'isActive'] },
    { fields: ['storeId', 'categoryId'] },
    { fields: ['originalProductId', 'originalStoreId'] },
  ],
})
export class Product extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Store)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number;

  @AllowNull(false)
  @Column(DataType.STRING(500))
  declare title: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING(200))
  declare slug: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: string;

  @ForeignKey(() => Category)
  @AllowNull(true)
  @Column(DataType.BIGINT)
  declare categoryId: number;

  @AllowNull(false)
  @Index
  @Column(DataType.STRING(100))
  declare sku: string;

  @AllowNull(true)
  @Column(DataType.DECIMAL(10, 3))
  declare gramWeight: number;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare milyem: number;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare effectiveMilyem: number;

  @Default(0)
  @Column(DataType.DECIMAL(5, 2))
  declare profitMargin: number;

  @Default(1.0)
  @Column(DataType.DECIMAL(5, 2))
  declare priceMultiplier: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(15, 2))
  declare priceTRY: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(15, 2))
  declare priceUSD: number;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isB2BEnabled: boolean;

  @Default(0)
  @Column(DataType.DECIMAL(5, 2))
  declare b2bDiscount: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(15, 2))
  declare b2bPrice: number;

  @Default(0)
  @Column(DataType.DECIMAL(5, 2))
  declare discountRate: number;

  @AllowNull(true)
  @Column(DataType.DECIMAL(15, 2))
  declare discountedPrice: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare quantity: number;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare images: string[];

  @AllowNull(true)
  @Column(DataType.STRING(500))
  declare videoUrl: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare marketplaces: string[];

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare marketplaceConfig: object;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare hasVariants: boolean;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare variantAttributes: object;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare tags: string[];

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @AllowNull(true)
  @Column(DataType.BIGINT)
  declare originalProductId: number;

  @AllowNull(true)
  @Column(DataType.BIGINT)
  declare originalStoreId: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store)
  declare store: Store;

  @BelongsTo(() => Category)
  declare category: Category;

  @HasMany(() => ProductVariant)
  declare variants: ProductVariant[];

  @HasMany(() => ProductMarketplaceListing)
  declare marketplaceListings: ProductMarketplaceListing[];

  @HasOne(() => ProductB2bSetting)
  declare b2bSetting: ProductB2bSetting;

  @HasMany(() => B2BRequest)
  declare b2bRequests: B2BRequest[];
}