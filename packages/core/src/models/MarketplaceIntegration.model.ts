import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt,
  AllowNull, Default, ForeignKey, BelongsTo, Index, Unique,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';

@Table({ tableName: 'marketplace_integrations', timestamps: true, indexes: [{ unique: true, fields: ['storeId', 'marketplace'] }, { fields: ['storeId', 'isActive'] }] })
export class MarketplaceIntegration extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(50)) declare marketplace: string;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @AllowNull(true) @Column(DataType.JSONB) declare config: object;
  @AllowNull(true) @Column(DataType.DATE) declare lastSyncAt: Date;
  @AllowNull(true) @Column(DataType.STRING(200)) declare etsyCategoryId: string;
  @AllowNull(true) @Column(DataType.STRING(200)) declare etsyShippingProfileId: string;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;
  @BelongsTo(() => Store) declare store: Store;
}