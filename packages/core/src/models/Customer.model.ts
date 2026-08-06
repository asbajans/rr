import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, AllowNull, Default, ForeignKey, BelongsTo, Index } from 'sequelize-typescript';
import { Store } from './Store.model.js';

@Table({ tableName: 'customers', timestamps: true, indexes: [{ unique: true, fields: ['storeId', 'email'] }, { fields: ['storeId'] }] })
export class Customer extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(255)) declare email: string;
  @AllowNull(false) @Column(DataType.STRING(255)) declare passwordHash: string;
  @AllowNull(false) @Column(DataType.STRING(160)) declare name: string;
  @AllowNull(true) @Column(DataType.STRING(50)) declare phone: string | null;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @AllowNull(true) @Column(DataType.DATE) declare emailVerifiedAt: Date | null;
  @AllowNull(true) @Column(DataType.STRING(128)) declare resetTokenHash: string | null;
  @AllowNull(true) @Column(DataType.DATE) declare resetTokenExpiresAt: Date | null;
  @AllowNull(true) @Column(DataType.DATE) declare lastLoginAt: Date | null;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;
  @BelongsTo(() => Store) declare store: Store;
}
