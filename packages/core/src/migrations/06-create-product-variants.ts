import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('product_variants', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    productId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
    storeId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    sku: { type: DataTypes.STRING(100), allowNull: false },
    attributes: { type: DataTypes.JSONB, allowNull: true },
    gramWeight: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
    quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
    priceTRY: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    priceUSD: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    b2bPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('product_variants', { fields: ['productId', 'sku'], unique: true });
  await queryInterface.addIndex('product_variants', { fields: ['storeId'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('product_variants');
}