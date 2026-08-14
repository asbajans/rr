import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, AllowNull, Default, ForeignKey, Index } from 'sequelize-typescript';
import { Store } from './Store.model.js';

export type TemplateType = 'order_created' | 'status_change' | 'shipping_update' | 'custom';
export type TemplateChannel = 'email' | 'sms';

const DEFAULT_EMAIL_TEMPLATES: Record<TemplateType, { subject: string; body: string }> = {
  order_created: {
    subject: 'Siparişiniz Alındı — {{orderNumber}}',
    body: `Merhaba {{customerName}},\n\nSiparişiniz başarıyla alındı.\n\nSipariş No: {{orderNumber}}\nToplam: {{totalAmount}} TL\n\nSiparişiniziniz durumunu takip edebilirsiniz.\n\n{{storeName}}`,
  },
  status_change: {
    subject: 'Sipariş Durumu Güncellendi — {{orderNumber}}',
    body: `Merhaba {{customerName}},\n\nSiparişinizin durumu güncellendi.\n\nSipariş No: {{orderNumber}}\nYeni Durum: {{status}}\n\n{{storeName}}`,
  },
  shipping_update: {
    subject: 'Kargo Takip Bilgisi — {{orderNumber}}',
    body: `Merhaba {{customerName}},\n\nSiparişiniz kargoya verildi.\n\nSipariş No: {{orderNumber}}\nKargo Firması: {{carrier}}\nTakip No: {{trackingNumber}}\n\n{{storeName}}`,
  },
  custom: { subject: '', body: '' },
};

const DEFAULT_SMS_TEMPLATES: Record<TemplateType, { body: string }> = {
  order_created: { body: '{{storeName}} siparişiniz alındı. No: {{orderNumber}} Toplam: {{totalAmount}} TL' },
  status_change: { body: '{{storeName}} siparişinizin durumu değişti: {{status}}. No: {{orderNumber}}' },
  shipping_update: { body: '{{storeName}} kargolandı. No: {{orderNumber}} {{carrier}} {{trackingNumber}}' },
  custom: { body: '' },
};

@Table({ tableName: 'notification_templates', timestamps: true, indexes: [{ unique: true, fields: ['storeId', 'channel', 'type'] }, { fields: ['storeId'] }] })
export class NotificationTemplate extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(20)) declare channel: TemplateChannel;
  @AllowNull(false) @Column(DataType.STRING(30)) declare type: TemplateType;
  @AllowNull(false) @Column(DataType.STRING(500)) declare subject: string;
  @AllowNull(false) @Column(DataType.TEXT) declare body: string;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;
}

export { DEFAULT_EMAIL_TEMPLATES, DEFAULT_SMS_TEMPLATES };
