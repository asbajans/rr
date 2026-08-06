import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, AllowNull, ForeignKey, Index } from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { Customer } from './Customer.model.js';

@Table({ tableName: 'customer_notifications', timestamps: true, indexes: [{ fields: ['customerId', 'readAt'] }] })
export class CustomerNotification extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @Index @Column(DataType.BIGINT) declare storeId: number;
  @ForeignKey(() => Customer) @Index @Column(DataType.BIGINT) declare customerId: number;
  @AllowNull(false) @Column(DataType.STRING(40)) declare type: string;
  @AllowNull(false) @Column(DataType.STRING(200)) declare title: string;
  @AllowNull(false) @Column(DataType.TEXT) declare body: string;
  @AllowNull(true) @Column(DataType.JSONB) declare metadata: object | null;
  @AllowNull(true) @Index @Column(DataType.DATE) declare readAt: Date | null;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
}
