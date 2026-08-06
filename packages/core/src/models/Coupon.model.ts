import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, AllowNull, Default, ForeignKey, Index } from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { Campaign } from './Campaign.model.js';

@Table({ tableName: 'coupons', timestamps: true, indexes: [{ unique: true, fields: ['storeId', 'code'] }, { fields: ['storeId', 'isActive'] }] })
export class Coupon extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @ForeignKey(() => Campaign) @AllowNull(true) @Column(DataType.BIGINT) declare campaignId: number | null;
  @AllowNull(false) @Column(DataType.STRING(80)) declare code: string;
  @AllowNull(false) @Column(DataType.STRING(20)) declare discountType: 'percent' | 'fixed';
  @AllowNull(false) @Column(DataType.DECIMAL(15, 2)) declare discountValue: number;
  @Default(0) @Column(DataType.DECIMAL(15, 2)) declare minimumAmount: number;
  @AllowNull(true) @Column(DataType.DECIMAL(15, 2)) declare maxDiscount: number | null;
  @AllowNull(true) @Column(DataType.INTEGER) declare usageLimit: number | null;
  @Default(0) @Column(DataType.INTEGER) declare usedCount: number;
  @AllowNull(true) @Column(DataType.DATE) declare startsAt: Date | null;
  @AllowNull(true) @Column(DataType.DATE) declare endsAt: Date | null;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;
}
