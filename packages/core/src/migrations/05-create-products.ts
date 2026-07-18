import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('products', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    storeId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    title: { type: DataTypes.STRING(500), allowNull: false },
    slug: { type: DataTypes.STRING(200), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    categoryId: { type: DataTypes.BIGINT, allowNull: true, references: { model: 'categories', key: 'id' }, onDelete: 'SET NULL' },
    sku: { type: DataTypes.STRING(100), allowNull: false },
    gramWeight: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
    milyem: { type: DataTypes.INTEGER, allowNull: true },
    effectiveMilyem: { type: DataTypes.INTEGER, allowNull: true },
    profitMargin: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    priceMultiplier: { type: DataTypes.DECIMAL(5, 2), defaultValue: 1.0 },
    priceTRY: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    priceUSD: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    isB2BEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    b2bDiscount: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    b2bPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    discountRate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    discountedPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
    images: { type: DataTypes.JSONB, allowNull: true },
    videoUrl: { type: DataTypes.STRING(500), allowNull: true },
    marketplaces: { type: DataTypes.JSONB, allowNull: true },
    marketplaceConfig: { type: DataTypes.JSONB, allowNull: true },
    hasVariants: { type: DataTypes.BOOLEAN, defaultValue: false },
    variantAttributes: { type: DataTypes.JSONB, allowNull: true },
    tags: { type: DataTypes.JSONB, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    originalProductId: { type: DataTypes.BIGINT, allowNull: true },
    originalStoreId: { type: DataTypes.BIGINT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('products', { fields: ['storeId', 'sku'], unique: true });
  await queryInterface.addIndex('products', { fields: ['storeId', 'isActive'] });
  await queryInterface.addIndex('products', { fields: ['storeId', 'categoryId'] });
  await queryInterface.addIndex('products', { fields: ['originalProductId', 'originalStoreId'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('products');
}