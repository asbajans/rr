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
import { Variation } from './Variation.model.js';

@Table({
  tableName: 'variation_options',
  timestamps: true,
  indexes: [
    { fields: ['variationId'] },
    { unique: true, fields: ['variationId', 'value'] },
  ],
})
export class VariationOption extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Variation)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare variationId: number;

  @AllowNull(false)
  @Column(DataType.STRING(200))
  declare value: string;

  @Default(0)
  @Column(DataType.INTEGER)
  declare sortOrder: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Variation)
  declare variation: Variation;
}