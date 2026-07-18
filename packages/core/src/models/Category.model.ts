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
  BelongsTo,
  HasMany,
  ForeignKey,
  Index,
  Unique,
} from 'sequelize-typescript';
import { Store } from './Store';
import { Category } from './Category';

@Table({
  tableName: 'categories',
  timestamps: true,
  indexes: [
    { fields: ['storeId', 'parentId'] },
    { fields: ['storeId', 'slug'] },
    { fields: ['storeId', 'isActive'] },
  ],
})
export class Category extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Store)
  @AllowNull(true)
  @Index
  @Column(DataType.BIGINT)
  declare storeId: number;

  @ForeignKey(() => Category)
  @AllowNull(true)
  @Index
  @Column(DataType.BIGINT)
  declare parentId: number;

  @AllowNull(false)
  @Column(DataType.STRING(200))
  declare slug: string;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare name: object;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare translations: object;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare icon: string;

  @Default(0)
  @Column(DataType.INTEGER)
  declare sortOrder: number;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Store)
  declare store: Store;

  @BelongsTo(() => Category, 'parentId')
  declare parent: Category;

  @HasMany(() => Category, 'parentId')
  declare children: Category[];

  @HasMany(() => MarketplaceCategoryMapping)
  declare marketplaceMappings: MarketplaceCategoryMapping[];
}

@Table({
  tableName: 'marketplace_category_mappings',
  timestamps: true,
})
export class MarketplaceCategoryMapping extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Category)
  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare categoryId: number;

  @AllowNull(false)
  @Column(DataType.STRING(50))
  declare marketplace: string;

  @AllowNull(false)
  @Column(DataType.STRING(200))
  declare marketplaceCategoryId: string;

  @AllowNull(false)
  @Column(DataType.STRING(500))
  declare name: string;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare parentId: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Category)
  declare category: Category;
}