import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('dropshipping_orders', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    storeId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    orderNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    marketplace: { type: DataTypes.STRING(50), allowNull: false },
    marketplaceOrderId: { type: DataTypes.STRING(100), allowNull: false },
    marketplaceOrderNumber: { type: DataTypes.STRING(100), allowNull: true },
    status: { type: DataTypes.STRING(50), defaultValue: 'pending' },
    totalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    currency: { type: DataTypes.STRING(3), defaultValue: 'TRY' },
    shippingAddress: { type: DataTypes.JSONB, allowNull: false },
    items: { type: DataTypes.JSONB, allowNull: false },
    trackingNumber: { type: DataTypes.STRING(100), allowNull: true },
    carrier: { type: DataTypes.STRING(100), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('dropshipping_orders', { fields: ['storeId', 'marketplace'] });
  await queryInterface.addIndex('dropshipping_orders', { fields: ['status'] });
  await queryInterface.addIndex('dropshipping_orders', { fields: ['marketplaceOrderId'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('dropshipping_orders');
}