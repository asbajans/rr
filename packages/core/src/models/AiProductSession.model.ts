import {
  Table, Column, Model, DataType, PrimaryKey, Default, AllowNull, CreatedAt, UpdatedAt, ForeignKey, Index, BelongsTo,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { User } from './User.model.js';

/**
 * Tracks the lifecycle of an AI product processing request
 * (AGENTOPEN.md §6 — AiProductSession).
 */
@Table({
  tableName: 'ai_product_sessions',
  indexes: [
    { fields: ['storeId'] },
    { fields: ['userId'] },
    { fields: ['status'] },
    // The partial unique index is created by the boot migration below.
    // Keep the model index portable; Sequelize cannot serialize Mongo-style
    // `$ne` operators in a Postgres index definition.
    { fields: ['storeId', 'idempotencyKey'] },
  ],
})
export class AiProductSession extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Store)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare userId: number;

  @Default('uploaded')
  @AllowNull(false)
  @Index
  @Column(DataType.STRING(30))
  declare status: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare sourceImageUrl: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare additionalImageUrls: string[] | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare processedImageUrl: string | null;

  @AllowNull(true)
  @Column(DataType.BIGINT)
  declare draftId: number | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare errorMessage: string | null;

  @Default(0)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare creditsUsed: number;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  declare idempotencyKey: string | null;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
  @BelongsTo(() => User) declare user: User;
}
