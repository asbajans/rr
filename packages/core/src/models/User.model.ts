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
  Unique,
  Default,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { CreditLog } from './CreditLog.model.js';
import { IntegrationLog } from './LogModels.js';

@Table({
  tableName: 'users',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['email'] },
    { fields: ['storeId'] },
    { fields: ['isActive'] },
  ],
})
export class User extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Store)
  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare storeId: number;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  declare name: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING(255))
  declare email: string;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare passwordHash: string;

  @Default('staff')
  @Column(DataType.ENUM('owner', 'admin', 'staff'))
  declare role: 'owner' | 'admin' | 'staff';

  @Default(0)
  @Column(DataType.INTEGER)
  declare aiCredits: number;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare fcmToken: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store)
  declare store: Store;

  @HasMany(() => CreditLog)
  declare creditLogs: CreditLog[];

  @HasMany(() => IntegrationLog)
  declare integrationLogs: IntegrationLog[];
}