import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('b2b_requests', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    productId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
    variantId: { type: DataTypes.BIGINT, allowNull: true, references: { model: 'product_variants', key: 'id' }, onDelete: 'SET NULL' },
    requesterStoreId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    ownerStoreId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
    requestNote: { type: DataTypes.TEXT, allowNull: true },
    profitMargin: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    marketplaces: { type: DataTypes.JSONB, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('b2b_requests', { fields: ['requesterStoreId'] });
  await queryInterface.addIndex('b2b_requests', { fields: ['ownerStoreId'] });
  await queryInterface.addIndex('b2b_requests', { fields: ['status'] });
  await queryInterface.addIndex('b2b_requests', { fields: ['productId', 'requesterStoreId', 'ownerStoreId'], unique: true });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('b2b_requests');
}