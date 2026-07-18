import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt,
  AllowNull, Default, ForeignKey, BelongsTo, Index, Unique, HasMany,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { Plan } from './Plan.model.js';

@Table({ tableName: 'subscriptions', timestamps: true, indexes: [{ fields: ['storeId'] }, { fields: ['status'] }] })
export class Subscription extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;

  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @ForeignKey(() => Plan) @AllowNull(false) @Column(DataType.BIGINT) declare planId: number;

  @AllowNull(true) @Column(DataType.STRING(100)) declare stripeSubscriptionId: string;
  @Default('active') @Column(DataType.ENUM('trialing', 'active', 'past_due', 'canceled', 'unpaid')) declare status: string;
  @AllowNull(true) @Column(DataType.DATE) declare trialEndsAt: Date;
  @AllowNull(false) @Column(DataType.DATE) declare currentPeriodEnd: Date;
  @AllowNull(true) @Column(DataType.DATE) declare canceledAt: Date;

  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
  @BelongsTo(() => Plan) declare plan: Plan;
}