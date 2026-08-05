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
 * Period-based payout record for a supplier. One row per supplier per month,
 * derived from fulfilled sub-orders (supplierEarnings). Suppliers request a
 * payout; the platform operator marks it paid.
 */
@Table({
  tableName: 'supplier_settlements',
  timestamps: true,
  indexes: [{ unique: true, fields: ['storeId', 'period'] }],
})
export class SupplierSettlement extends Model {
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
  @Column(DataType.STRING(7))
  declare period: string;

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  declare totalAmount: number;

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  declare commissionAmount: number;

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  declare netAmount: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare orderCount: number;

  @Default('open')
  @Column(DataType.STRING(20))
  declare status: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare requestedAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare paidAt: Date;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare payoutMethod: string;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare payoutRef: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare notes: string;

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
