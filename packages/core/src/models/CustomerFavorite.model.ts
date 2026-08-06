import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, ForeignKey, Index } from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { Customer } from './Customer.model.js';
import { Product } from './Product.model.js';

@Table({ tableName: 'customer_favorites', timestamps: true, indexes: [{ unique: true, fields: ['storeId', 'customerId', 'productId'] }, { fields: ['customerId'] }] })
export class CustomerFavorite extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @Index @Column(DataType.BIGINT) declare storeId: number;
  @ForeignKey(() => Customer) @Index @Column(DataType.BIGINT) declare customerId: number;
  @ForeignKey(() => Product) @Column(DataType.BIGINT) declare productId: number;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
}
