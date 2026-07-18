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
  HasMany,
} from 'sequelize-typescript';
import { Store } from './Store';
import { Subscription } from './Subscription';

@Table({
  tableName: 'plans',
  timestamps: true,
})
export class Plan extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING(100))
  declare name: string;

  @Default(0)
  @Column(DataType.DECIMAL(10, 2))
  declare price: number;

  @Default(100)
  @Column(DataType.INTEGER)
  declare productLimit: number;

  @Default(1000)
  @Column(DataType.INTEGER)
  declare aiCredits: number;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare features: object;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare stripePriceId: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @HasMany(() => Store)
  declare stores: Store[];

  @HasMany(() => Subscription)
  declare subscriptions: Subscription[];
}