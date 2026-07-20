import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,   CreatedAt, AllowNull, Default, ForeignKey, BelongsTo, Index,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { User } from './User.model.js';

@Table({ tableName: 'credit_logs', timestamps: false, indexes: [{ fields: ['userId'] }, { fields: ['storeId'] }, { fields: ['createdAt'] }] })
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