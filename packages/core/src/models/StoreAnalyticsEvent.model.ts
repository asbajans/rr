import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  AllowNull,
  Index,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';

export type AnalyticsEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_started'
  | 'purchase'
  | 'search'
  | 'platform_view'
  | 'whatsapp_click'
  | 'signup'
  | 'lead'
  | 'cta_click'
  | 'blog_view';

@Table({
  tableName: 'store_analytics_events',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['storeId', 'eventType', 'createdAt'] },
    { fields: ['storeId', 'createdAt'] },
    { fields: ['eventType'] },
    { fields: ['createdAt'] },
    { fields: ['sessionId'] },
    { fields: ['productId'] },
  ],
})
export class StoreAnalyticsEvent extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Store)
  @AllowNull(true)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  declare sessionId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  declare visitorId: string | null;

  @AllowNull(false)
  @Column(DataType.STRING(30))
  declare eventType: AnalyticsEventType;

  @AllowNull(true)
  @Column(DataType.STRING(500))
  declare path: string | null;

  @AllowNull(true)
  @Column(DataType.BIGINT)
  declare productId: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(500))
  declare referrer: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare utmSource: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare utmMedium: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare utmCampaign: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare device: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  declare ipHash: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(500))
  declare userAgent: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare metadata: Record<string, any> | null;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @BelongsTo(() => Store)
  declare store: Store;
}
