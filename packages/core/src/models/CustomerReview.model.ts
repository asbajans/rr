import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, AllowNull, Default, ForeignKey, Index } from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { Customer } from './Customer.model.js';
import { Product } from './Product.model.js';
import { DropshippingOrder } from './DropshippingOrder.model.js';

@Table({ tableName: 'customer_reviews', timestamps: true, indexes: [{ fields: ['storeId', 'productId'] }, { fields: ['customerId'] }] })
export class CustomerReview extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @Index @Column(DataType.BIGINT) declare storeId: number;
  @ForeignKey(() => Customer) @Index @Column(DataType.BIGINT) declare customerId: number;
  @ForeignKey(() => Product) @Index @Column(DataType.BIGINT) declare productId: number;
  @ForeignKey(() => DropshippingOrder) @AllowNull(true) @Column(DataType.BIGINT) declare orderId: number | null;
  @AllowNull(false) @Column(DataType.INTEGER) declare rating: number;
  @AllowNull(true) @Column(DataType.STRING(160)) declare title: string | null;
  @AllowNull(true) @Column(DataType.TEXT) declare body: string | null;
  @Default('pending') @Column(DataType.STRING(20)) declare status: 'pending' | 'approved' | 'rejected';
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;
}
