import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, AllowNull, ForeignKey, Index } from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { Customer } from './Customer.model.js';

@Table({ tableName: 'customer_consents', timestamps: false, indexes: [{ unique: true, fields: ['storeId', 'customerId', 'type', 'version'] }] })
export class CustomerConsent extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @Index @Column(DataType.BIGINT) declare storeId: number;
  @ForeignKey(() => Customer) @Index @Column(DataType.BIGINT) declare customerId: number;
  @AllowNull(false) @Column(DataType.STRING(30)) declare type: 'terms' | 'privacy' | 'marketing';
  @AllowNull(false) @Column(DataType.STRING(40)) declare version: string;
  @AllowNull(false) @Column(DataType.BOOLEAN) declare granted: boolean;
  @AllowNull(true) @Column(DataType.STRING(64)) declare ipAddress: string | null;
  @CreatedAt @Column(DataType.DATE) declare grantedAt: Date;
}
