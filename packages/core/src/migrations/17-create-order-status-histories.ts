import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('order_status_histories', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    dropshippingOrderId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'dropshipping_orders', key: 'id' }, onDelete: 'CASCADE' },
    fromStatus: { type: DataTypes.STRING(50), allowNull: true },
    toStatus: { type: DataTypes.STRING(50), allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('order_status_histories', { fields: ['dropshippingOrderId'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('order_status_histories');
}