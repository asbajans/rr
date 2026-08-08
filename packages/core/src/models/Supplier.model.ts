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
  Unique,
  Index,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';

@Table({
  tableName: 'suppliers',
  timestamps: true,
  indexes: [{ unique: true, fields: ['storeId'] }],
})
export class Supplier extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Store)
  @AllowNull(false)
  @Index
  @Unique
  @Column(DataType.BIGINT)
  declare storeId: number;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare name: string;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare email: string;

  @AllowNull(true)
  @Column(DataType.STRING(50))
  declare phone: string;

  @AllowNull(true)
  @Column(DataType.STRING(50))
  declare taxId: string;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare bankName: string;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare iban: string;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare bankOwner: string;

  @Default('active')
  @Column(DataType.ENUM('invited', 'active', 'suspended'))
  declare contractStatus: string;

  @Default(0)
  @Column(DataType.DECIMAL(5, 2))
  declare commissionRate: number;

  @Default('bank')
  @Column(DataType.STRING(20))
  declare payoutMethod: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare applicationDocuments: {
    taxDocument?: string;
    signatureDocument?: string;
    tradeRegistryDocument?: string;
  };

  @Default('draft')
  @Column(DataType.STRING(20))
  declare applicationStatus: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare applicationSubmittedAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare applicationReviewedAt: Date;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare rejectionNote: string;

  @Default(3)
  @Column(DataType.INTEGER)
  declare maxShipmentDays: number;

  @Default(0)
  @Column(DataType.DECIMAL(3, 2))
  declare ratingAvg: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare ratingCount: number;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare ratingEnabled: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store)
  declare store: Store;
}
