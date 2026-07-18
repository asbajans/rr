import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('product_b2b_settings', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    storeId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    productId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
    isB2BEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    b2bDiscount: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    b2bPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('product_b2b_settings', { fields: ['storeId', 'productId'], unique: true });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('product_b2b_settings');
}