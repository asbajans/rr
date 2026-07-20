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
import { Store } from './Store.model.js';
import { Subscription } from './Subscription.model.js';

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
  @Unique
  @Column(DataType.STRING(50))
  declare slug: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: string;

  @AllowNull(true)
  @Default('TRY')
  @Column(DataType.STRING(3))
  declare currency: string;

  @AllowNull(true)
  @Default(1)
  @Column(DataType.INTEGER)
  declare storeLimit: number;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare modules: Record<string, { enabled: boolean; credit_cost?: number; limit?: number }> | null;

  @AllowNull(true)
  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

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