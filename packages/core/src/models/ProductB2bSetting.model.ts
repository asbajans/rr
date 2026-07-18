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