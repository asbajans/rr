import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt,
  AllowNull, Default, ForeignKey, BelongsTo, Index, Unique,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';

@Table({ tableName: 'api_keys', timestamps: true, indexes: [{ fields: ['storeId'] }, { fields: ['keyPrefix'] }] })
export class ApiKey extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;

  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Unique @Column(DataType.STRING(255)) declare keyHash: string;
  @AllowNull(false) @Column(DataType.STRING(20)) declare keyPrefix: string;
  @AllowNull(false) @Column(DataType.STRING(100)) declare name: string;
  @AllowNull(true) @Column(DataType.JSONB) declare allowedIps: string[];
  @AllowNull(true) @Column(DataType.DATE) declare expiresAt: Date;
  @AllowNull(true) @Column(DataType.DATE) declare lastUsedAt: Date;

  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
}