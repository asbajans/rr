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
  HasMany,
  Index,
  Unique,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';
import { User } from './User.model.js';

export type SupportCategory = 'bug' | 'support' | 'feedback';
export type SupportStatus = 'open' | 'pending' | 'resolved' | 'closed';

@Table({
  tableName: 'support_tickets',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['code'] },
    { fields: ['storeId', 'status'] },
    { fields: ['storeId', 'category'] },
    { fields: ['status'] },
    { fields: ['createdAt'] },
  ],
})
export class SupportTicket extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(12))
  declare code: string;

  @ForeignKey(() => Store)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare userId: number;

  @AllowNull(false)
  @Column(DataType.STRING(20))
  declare category: SupportCategory;

  @AllowNull(false)
  @Column(DataType.STRING(200))
  declare subject: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare message: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare screenshots: string[] | null;

  @Default('open')
  @Column(DataType.STRING(20))
  declare status: SupportStatus;

  @Default('medium')
  @Column(DataType.STRING(20))
  declare priority: string;

  @AllowNull(true)
  @Column(DataType.BIGINT)
  declare assignedTo: number | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare closedAt: Date | null;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store)
  declare store: Store;

  @BelongsTo(() => User, 'userId')
  declare user: User;

  @HasMany(() => SupportTicketMessage, { foreignKey: 'ticketId', as: 'messages' })
  declare messages: SupportTicketMessage[];
}

@Table({
  tableName: 'support_ticket_messages',
  timestamps: true,
  indexes: [{ fields: ['ticketId'] }, { fields: ['createdAt'] }],
})
export class SupportTicketMessage extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => SupportTicket)
  @AllowNull(false)
  @Index
  @Column(DataType.BIGINT)
  declare ticketId: number;

  @AllowNull(false)
  @Column(DataType.STRING(20))
  declare senderType: 'seller' | 'superadmin';

  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare senderId: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare body: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare attachments: string[] | null;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => SupportTicket)
  declare ticket: SupportTicket;
}
