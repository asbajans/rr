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
  HasMany,
  Index,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';

@Table({
  tableName: 'dropshipping_orders',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['storeId', 'marketplaceOrderId'] },
    { fields: ['storeId'] },
    { fields: ['status'] },
    { fields: ['parentOrderId'] },
  ],
})
export class DropshippingOrder extends Model {
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
  @Column(DataType.STRING(100))
  declare orderNumber: string;

  @AllowNull(false)
  @Column(DataType.STRING(50))
  declare marketplace: string;

  @AllowNull(false)
  @Column(DataType.STRING(200))
  declare marketplaceOrderId: string;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare marketplaceOrderNumber: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(15, 2))
  declare totalAmount: number;

  @AllowNull(false)
  @Default('TRY')
  @Column(DataType.STRING(3))
  declare currency: string;

  @Default('pending')
  @Column(DataType.STRING(50))
  declare status: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare shippingAddress: object;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare items: object;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare note: string;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare trackingNumber: string;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare carrier: string;

  @AllowNull(true)
  @Index
  @Column(DataType.BIGINT)
  declare parentOrderId: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store)
  declare store: Store;

  @BelongsTo(() => DropshippingOrder, 'parentOrderId')
  declare parentOrder: DropshippingOrder;

  @HasMany(() => DropshippingOrder, 'parentOrderId')
  declare subOrders: DropshippingOrder[];
}