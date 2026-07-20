import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt,
  AllowNull, Default, ForeignKey, BelongsTo, Index, Unique,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';

@Table({ tableName: 'dropshipping_orders', timestamps: true, indexes: [{ fields: ['storeId', 'marketplace'] }, { fields: ['status'] }, { fields: ['marketplaceOrderId'] }] })
export class DropshippingOrder extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Unique @Column(DataType.STRING(50)) declare orderNumber: string;
  @AllowNull(false) @Column(DataType.STRING(50)) declare marketplace: string;
  @AllowNull(false) @Column(DataType.STRING(100)) declare marketplaceOrderId: string;
  @AllowNull(true) @Column(DataType.STRING(100)) declare marketplaceOrderNumber: string;
  @Default('pending') @Column(DataType.STRING(50)) declare status: string;
  @AllowNull(false) @Column(DataType.DECIMAL(15, 2)) declare totalAmount: number;
  @Default('TRY') @Column(DataType.STRING(3)) declare currency: string;
  @AllowNull(false) @Column(DataType.JSONB) declare shippingAddress: object;
  @AllowNull(false) @Column(DataType.JSONB) declare items: object;
  @AllowNull(true) @Column(DataType.STRING(100)) declare trackingNumber: string;
  @AllowNull(true) @Column(DataType.STRING(100)) declare carrier: string;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
}

@Table({ tableName: 'order_status_histories', timestamps: true, indexes: [{ fields: ['dropshippingOrderId'] }] })
export class OrderStatusHistory extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => DropshippingOrder) @AllowNull(false) @Index @Column(DataType.BIGINT) declare dropshippingOrderId: number;
  @AllowNull(true) @Column(DataType.STRING(50)) declare fromStatus: string;
  @AllowNull(false) @Column(DataType.STRING(50)) declare toStatus: string;
  @AllowNull(true) @Column(DataType.TEXT) declare note: string;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;

  @BelongsTo(() => DropshippingOrder) declare order: DropshippingOrder;
}

@Table({ tableName: 'credit_logs', timestamps: true, indexes: [{ fields: ['userId'] }, { fields: ['storeId'] }, { fields: ['createdAt'] }] })
export class CreditLog extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => User) @AllowNull(false) @Index @Column(DataType.BIGINT) declare userId: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(50)) declare action: string;
  @AllowNull(false) @Column(DataType.STRING(50)) declare module: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare amount: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare balanceBefore: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare balanceAfter: number;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;

  @BelongsTo(() => User) declare user: User;
  @BelongsTo(() => Store) declare store: Store;
}

import { User } from './User.model.js';