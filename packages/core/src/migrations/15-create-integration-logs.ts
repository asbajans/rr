import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('integration_logs', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.BIGINT, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
    storeId: { type: DataTypes.BIGINT, allowNull: true, references: { model: 'stores', key: 'id' }, onDelete: 'SET NULL' },
    platform: { type: DataTypes.STRING(50), allowNull: false },
    endpoint: { type: DataTypes.STRING(500), allowNull: false },
    method: { type: DataTypes.STRING(10), allowNull: false },
    isSuccess: { type: DataTypes.BOOLEAN, allowNull: false },
    requestPayload: { type: DataTypes.JSONB, allowNull: true },
    responsePayload: { type: DataTypes.JSONB, allowNull: true },
    errorMessage: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('integration_logs', { fields: ['storeId', 'platform'] });
  await queryInterface.addIndex('integration_logs', { fields: ['createdAt'] });
  await queryInterface.addIndex('integration_logs', { fields: ['isSuccess'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('integration_logs');
}