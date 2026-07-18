import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('plans', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    productLimit: { type: DataTypes.INTEGER, defaultValue: 100 },
    aiCredits: { type: DataTypes.INTEGER, defaultValue: 1000 },
    features: { type: DataTypes.JSONB, allowNull: true },
    stripePriceId: { type: DataTypes.STRING(100), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('plans');
}