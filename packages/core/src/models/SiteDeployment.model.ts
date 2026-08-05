import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';

/**
 * Publish/unpublish/rollback history for a store's hosted site.
 * Append-only: each publish, unpublish or rollback creates a row with a
 * snapshot of the published state (theme, siteCode, domain) so it can be
 * rolled back to an earlier version.
 */
@Table({
  tableName: 'site_deployments',
  timestamps: true,
  indexes: [{ fields: ['storeId', 'createdAt'] }],
})
export class SiteDeployment extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Store)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number;

  /** published | draft | reverted | failed */
  @AllowNull(false)
  @Default('published')
  @Column(DataType.STRING(20))
  declare status: string;

  /** Monotonic per-store version (increments on each publish) */
  @AllowNull(false)
  @Default(1)
  @Column(DataType.INTEGER)
  declare version: number;

  @AllowNull(true)
  @Column(DataType.STRING(50))
  declare siteCode: string;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare domain: string;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare siteUrl: string;

  /** Snapshot of store.theme at publish time (used for rollback) */
  @AllowNull(true)
  @Column(DataType.JSONB)
  declare themeSnapshot: object;

  @AllowNull(true)
  @Column(DataType.STRING(500))
  declare note: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare deployedAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare revertedAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store)
  declare store: Store;
}
