import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, AllowNull, Default, Index, Unique,
} from 'sequelize-typescript';

@Table({
  tableName: 'marketplace_global_categories',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['marketplace', 'marketplaceCategoryId'] },
    { fields: ['marketplace', 'parentId'] },
    { fields: ['marketplace', 'level'] },
  ],
})
export class MarketplaceGlobalCategory extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @AllowNull(false) @Index @Column(DataType.STRING(50)) declare marketplace: string;
  @AllowNull(false) @Unique @Column(DataType.STRING(200)) declare marketplaceCategoryId: string;
  @AllowNull(false) @Column(DataType.STRING(500)) declare name: string;
  @AllowNull(true) @Column(DataType.STRING(200)) declare parentId: string | null;
  @Default(0) @Column(DataType.INTEGER) declare level: number;
  @AllowNull(true) @Column(DataType.STRING(1000)) declare path: string | null;
  @AllowNull(true) @Column(DataType.JSONB) declare raw: object | null;
  @AllowNull(true) @Column(DataType.BIGINT) declare sourceStoreId: number | null;
  @Default(1) @Column(DataType.INTEGER) declare version: number;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;
}

@Table({
  tableName: 'marketplace_global_brands',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['marketplace', 'marketplaceBrandId'] },
    { fields: ['marketplace', 'name'] },
  ],
})
export class MarketplaceGlobalBrand extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @AllowNull(false) @Index @Column(DataType.STRING(50)) declare marketplace: string;
  @AllowNull(false) @Column(DataType.STRING(200)) declare marketplaceBrandId: string;
  @AllowNull(false) @Column(DataType.STRING(300)) declare name: string;
  @AllowNull(true) @Column(DataType.BIGINT) declare sourceStoreId: number | null;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;
}

@Table({
  tableName: 'marketplace_global_category_attributes',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['marketplace', 'marketplaceCategoryId'] },
    { fields: ['marketplace'] },
  ],
})
export class MarketplaceGlobalCategoryAttribute extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @AllowNull(false) @Index @Column(DataType.STRING(50)) declare marketplace: string;
  @AllowNull(false) @Column(DataType.STRING(200)) declare marketplaceCategoryId: string;
  @AllowNull(false) @Column(DataType.JSONB) declare attributes: object;
  @AllowNull(true) @Column(DataType.BIGINT) declare sourceStoreId: number | null;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;
}
