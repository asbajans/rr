import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('product_marketplace_listings', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    productId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
    storeId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    platform: { type: DataTypes.STRING(50), allowNull: false },
    externalId: { type: DataTypes.STRING(200), allowNull: true },
    externalCode: { type: DataTypes.STRING(200), allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'active', 'inactive', 'failed', 'deleted'), defaultValue: 'pending' },
    batchRequestId: { type: DataTypes.STRING(100), allowNull: true },
    lastError: { type: DataTypes.TEXT, allowNull: true },
    lastSyncedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('product_marketplace_listings', { fields: ['productId', 'platform'], unique: true });
  await queryInterface.addIndex('product_marketplace_listings', { fields: ['storeId', 'platform'] });
  await queryInterface.addIndex('product_marketplace_listings', { fields: ['storeId', 'status'] });
  await queryInterface.addIndex('product_marketplace_listings', { fields: ['externalId'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('product_marketplace_listings');
}