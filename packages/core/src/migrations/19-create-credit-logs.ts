import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('credit_logs', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    storeId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    action: { type: DataTypes.STRING(50), allowNull: false },
    module: { type: DataTypes.STRING(50), allowNull: false },
    amount: { type: DataTypes.INTEGER, allowNull: false },
    balanceBefore: { type: DataTypes.INTEGER, allowNull: false },
    balanceAfter: { type: DataTypes.INTEGER, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('credit_logs', { fields: ['userId'] });
  await queryInterface.addIndex('credit_logs', { fields: ['storeId'] });
  await queryInterface.addIndex('credit_logs', { fields: ['createdAt'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('credit_logs');
}