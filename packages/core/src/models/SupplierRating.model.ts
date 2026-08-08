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
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { Supplier } from './Supplier.model.js';

/**
 * Rating given by a buyer store (storeId) to a supplier store (via the
 * supplier's profile) for a completed B2B order. One rating per supplier per
 * order. The supplier's aggregate (ratingAvg / ratingCount) is kept in sync on
 * the Supplier row and exposed on B2B product listings.
 */
@Table({
  tableName: 'supplier_ratings',
  timestamps: true,
  indexes: [{ unique: true, fields: ['supplierId', 'orderId'] }],
})
export class SupplierRating extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Supplier)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare supplierId: number;

  @ForeignKey(() => Store)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number;

  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare orderId: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare rating: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare comment: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Supplier)
  declare supplier: Supplier;

  @BelongsTo(() => Store)
  declare store: Store;
}
