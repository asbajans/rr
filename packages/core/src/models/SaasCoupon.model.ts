import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, AllowNull, Default, Index, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Plan } from './Plan.model.js';

@Table({ tableName: 'saas_coupons', timestamps: true, indexes: [{ unique: true, fields: ['code'] }, { fields: ['isActive'] }, { fields: ['endsAt'] }] })
export class SaasCoupon extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @AllowNull(false) @Index @Column(DataType.STRING(80)) declare code: string; // UPPER
  @AllowNull(false) @Column(DataType.STRING(20)) declare discountType: 'percent' | 'fixed';
  @AllowNull(false) @Column(DataType.DECIMAL(15, 2)) declare discountValue: number;
  @Default(0) @Column(DataType.DECIMAL(15, 2)) declare minimumAmount: number;
  @AllowNull(true) @Column(DataType.DECIMAL(15, 2)) declare maxDiscount: number | null;
  @AllowNull(true) @Column(DataType.INTEGER) declare usageLimit: number | null; // total
  @Default(0) @Column(DataType.INTEGER) declare usedCount: number;
  @Default(1) @Column(DataType.INTEGER) declare perCustomerLimit: number; // per store
  @AllowNull(true) @Column(DataType.DATE) declare startsAt: Date | null;
  @AllowNull(true) @Column(DataType.DATE) declare endsAt: Date | null;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @AllowNull(true) @Column(DataType.JSONB) declare applicablePlanIds: number[] | null; // null = all
  @Default('first_cycle_only') @Column(DataType.STRING(30)) declare billingConstraint: string;
  @AllowNull(true) @Column(DataType.STRING(100)) declare stripeCouponId: string | null;
  @AllowNull(true) @Column(DataType.BIGINT) declare createdBy: number | null;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;
}

@Table({ tableName: 'saas_coupon_redemptions', timestamps: true, indexes: [{ fields: ['couponId'] }, { unique: true, fields: ['couponId', 'storeId'] }, { fields: ['storeId'] }] })
export class SaasCouponRedemption extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => SaasCoupon) @AllowNull(false) @Column(DataType.BIGINT) declare couponId: number;
  @AllowNull(false) @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(true) @Column(DataType.BIGINT) declare subscriptionId: number | null;
  @AllowNull(false) @Column(DataType.DECIMAL(15, 2)) declare discountApplied: number;
  @AllowNull(true) @Column(DataType.STRING(100)) declare stripeCouponId: string | null;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => SaasCoupon) declare coupon: SaasCoupon;
}
