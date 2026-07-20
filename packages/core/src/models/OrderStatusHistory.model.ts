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
import { DropshippingOrder } from './DropshippingOrder.model.js';

@Table({
  tableName: 'order_status_history',
  timestamps: true,
  indexes: [
    { fields: ['dropshippingOrderId'] },
    { fields: ['createdAt'] },
  ],
})
export class OrderStatusHistory extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => DropshippingOrder)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare dropshippingOrderId: number;

  @AllowNull(true)
  @Column(DataType.STRING(50))
  declare fromStatus: string;

  @AllowNull(false)
  @Column(DataType.STRING(50))
  declare toStatus: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare note: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => DropshippingOrder)
  declare order: DropshippingOrder;
}