import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt,
  AllowNull, Default, ForeignKey, BelongsTo, Index, Unique,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { Product } from './Product.model.js';

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

@Table({ tableName: 'b2b_requests', timestamps: true, indexes: [
  { fields: ['requesterStoreId'] },
  { fields: ['ownerStoreId'] },
  { fields: ['status'] },
  { unique: true, fields: ['productId', 'requesterStoreId', 'ownerStoreId'] }
] })
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
  @BelongsTo(() => Store, 'requesterStoreId') declare requesterStore: Store;
  @BelongsTo(() => Store, 'ownerStoreId') declare ownerStore: Store;
}

@Table({ tableName: 'b2b_listed_products', timestamps: true, indexes: [
  { fields: ['storeId'] },
  { fields: ['originalStoreId'] },
  { fields: ['b2bRequestId'] }
] })
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