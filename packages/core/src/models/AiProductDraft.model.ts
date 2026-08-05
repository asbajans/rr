import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, Default, AllowNull, CreatedAt, UpdatedAt, ForeignKey, Index, BelongsTo,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { AiProductSession } from './AiProductSession.model.js';
import { Product } from './Product.model.js';

/**
 * The user-editable product draft derived from an AI session
 * (AGENTOPEN.md §6 — AiProductDraft).
 */
@Table({
  tableName: 'ai_product_drafts',
  indexes: [
    { fields: ['storeId'] },
    { fields: ['sessionId'] },
    { fields: ['status'] },
  ],
})
export class AiProductDraft extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => AiProductSession)
  @AllowNull(false)
  @Index
  @Column(DataType.UUID)
  declare sessionId: string;

  @ForeignKey(() => Store)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number;

  @AllowNull(false)
  @Column(DataType.STRING(500))
  declare title: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare shortDescription: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare slug: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare sku: string | null;

  @AllowNull(true)
  @Column(DataType.BIGINT)
  declare categoryId: number | null;

  // The product created from this draft (set by the publish transaction).
  @ForeignKey(() => Product)
  @AllowNull(true)
  @Index
  @Column(DataType.BIGINT)
  declare productId: number | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare categoryPath: string[] | null;

  @AllowNull(false)
  @Default({})
  @Column(DataType.JSONB)
  declare attributes: Record<string, string>;

  @AllowNull(false)
  @Default([])
  @Column(DataType.JSONB)
  declare tags: string[];

  @AllowNull(false)
  @Default([])
  @Column(DataType.JSONB)
  declare keywords: string[];

  @AllowNull(true)
  @Column(DataType.DECIMAL(15, 2))
  declare suggestedPrice: number | null;

  @AllowNull(false)
  @Default('TRY')
  @Column(DataType.STRING(10))
  declare priceCurrency: string;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare quantity: number | null;

  @AllowNull(false)
  @Default([])
  @Column(DataType.JSONB)
  declare images: string[];

  @AllowNull(false)
  @Default({})
  @Column(DataType.JSONB)
  declare confidence: Record<string, number>;

  @AllowNull(false)
  @Default([])
  @Column(DataType.JSONB)
  declare userEditedFields: string[];

  @AllowNull(false)
  @Default({})
  @Column(DataType.JSONB)
  declare rawAiResponse: Record<string, unknown>;

  @AllowNull(false)
  @Default('review')
  @Column(DataType.STRING(20))
  declare status: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
  @BelongsTo(() => AiProductSession) declare session: AiProductSession;
  @BelongsTo(() => Product) declare product: Product;
}
