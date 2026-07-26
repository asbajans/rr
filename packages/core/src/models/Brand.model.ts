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
  BelongsTo,
  ForeignKey,
  Index,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';

@Table({
  tableName: 'brands',
  timestamps: true,
  indexes: [
    { fields: ['storeId'] },
    { fields: ['storeId', 'name'] },
    { fields: ['storeId', 'marketplace'] },
  ],
})
export class Brand extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Store)
  @AllowNull(true)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number;

  @AllowNull(false)
  @Column(DataType.STRING(200))
  declare name: string;

  @AllowNull(true)
  @Column(DataType.STRING(50))
  declare marketplace: string;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare marketplaceBrandId: string;

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
}
