import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('b2b_listed_products', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    storeId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    originalStoreId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    productId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
    originalProductId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
    b2bRequestId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'b2b_requests', key: 'id' }, onDelete: 'CASCADE' },
    profitMargin: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('b2b_listed_products', { fields: ['storeId'] });
  await queryInterface.addIndex('b2b_listed_products', { fields: ['originalStoreId'] });
  await queryInterface.addIndex('b2b_listed_products', { fields: ['b2bRequestId'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('b2b_listed_products');
}