import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt,
  AllowNull, ForeignKey, BelongsTo, Index,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { User } from './User.model.js';

@Table({ tableName: 'integration_logs', timestamps: true, indexes: [{ fields: ['storeId', 'platform'] }, { fields: ['createdAt'] }, { fields: ['isSuccess'] }] })
export class IntegrationLog extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => User) @AllowNull(true) @Column(DataType.BIGINT) declare userId: number;
  @ForeignKey(() => Store) @AllowNull(true) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(50)) declare platform: string;
  @AllowNull(false) @Column(DataType.STRING(500)) declare endpoint: string;
  @AllowNull(false) @Column(DataType.STRING(10)) declare method: string;
  @AllowNull(false) @Column(DataType.BOOLEAN) declare isSuccess: boolean;
  @AllowNull(true) @Column(DataType.JSONB) declare requestPayload: object;
  @AllowNull(true) @Column(DataType.JSONB) declare responsePayload: object;
  @AllowNull(true) @Column(DataType.TEXT) declare errorMessage: string;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;

  @BelongsTo(() => Store) declare store: Store;
  @BelongsTo(() => User) declare user: User;
}