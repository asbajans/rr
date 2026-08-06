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
import { Customer } from './Customer.model.js';

@Table({
  tableName: 'customer_addresses',
  timestamps: true,
  indexes: [
    { fields: ['storeId'] },
    { fields: ['ownerTokenHash'] },
    { fields: ['userId'] },
    { fields: ['customerId'] },
  ],
})
export class CustomerAddress extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Store)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number;

  @AllowNull(true)
  @Column(DataType.BIGINT)
  declare userId: number | null;

  @ForeignKey(() => Customer)
  @AllowNull(true)
  @Index
  @Column(DataType.BIGINT)
  declare customerId: number | null;

  @AllowNull(true)
  @Index
  @Column(DataType.STRING(64))
  declare ownerTokenHash: string;

  @AllowNull(false)
  @Column(DataType.STRING(200))
  declare fullName: string;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare email: string;

  @AllowNull(true)
  @Column(DataType.STRING(50))
  declare phone: string;

  @AllowNull(false)
  @Default('TR')
  @Column(DataType.STRING(100))
  declare country: string;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  declare city: string;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare district: string;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare zip: string;

  @AllowNull(false)
  @Column(DataType.STRING(1000))
  declare addressLine: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isDefault: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store)
  declare store: Store;
}
