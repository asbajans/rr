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
  HasMany,
  Index,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { VariationOption } from './VariationOption.model.js';

@Table({
  tableName: 'variations',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['storeId', 'name'] },
    { fields: ['storeId'] },
  ],
})
export class Variation extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Store)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  declare name: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: string;

  @Default('select')
  @Column(DataType.ENUM('select', 'radio', 'checkbox', 'color'))
  declare type: 'select' | 'radio' | 'checkbox' | 'color';

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @Default(0)
  @Column(DataType.INTEGER)
  declare sortOrder: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store)
  declare store: Store;

  @HasMany(() => VariationOption, 'variationId')
  declare options: VariationOption[];
}