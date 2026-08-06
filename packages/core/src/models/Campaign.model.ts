import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, AllowNull, Default, ForeignKey, Index } from 'sequelize-typescript';
import { Store } from './Store.model.js';

@Table({ tableName: 'campaigns', timestamps: true, indexes: [{ fields: ['storeId'] }, { fields: ['startsAt', 'endsAt'] }] })
export class Campaign extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(160)) declare name: string;
  @AllowNull(true) @Column(DataType.TEXT) declare description: string | null;
  @AllowNull(false) @Column(DataType.STRING(20)) declare discountType: 'percent' | 'fixed';
  @AllowNull(false) @Column(DataType.DECIMAL(15, 2)) declare discountValue: number;
  @AllowNull(true) @Column(DataType.DATE) declare startsAt: Date | null;
  @AllowNull(true) @Column(DataType.DATE) declare endsAt: Date | null;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;
}
