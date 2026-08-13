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

@Table({
  tableName: 'store_notifications',
  timestamps: true,
  indexes: [
    { fields: ['storeId', 'readAt'] },
    { fields: ['createdAt'] },
  ],
})
export class StoreNotification extends Model {
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
  declare userId: number;

  @AllowNull(false)
  @Default('general')
  @Column(DataType.STRING(50))
  declare type: string;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare title: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare body: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare data: object;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare readAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store)
  declare store: Store;
}
