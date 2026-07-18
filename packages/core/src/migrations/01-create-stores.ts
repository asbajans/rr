import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('stores', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    siteCode: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    domain: { type: DataTypes.STRING(255), allowNull: true, unique: true },
    email: { type: DataTypes.STRING(255), allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    planId: { type: DataTypes.BIGINT, allowNull: true, references: { model: 'plans', key: 'id' } },
    stripeAccountId: { type: DataTypes.STRING(255), allowNull: true },
    theme: { type: DataTypes.JSONB, allowNull: true },
    currency: { type: DataTypes.STRING(3), defaultValue: 'TRY' },
    taxSettings: { type: DataTypes.JSONB, allowNull: true },
    shippingSettings: { type: DataTypes.JSONB, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex('stores', { fields: ['siteCode'], unique: true });
  await queryInterface.addIndex('stores', { fields: ['isActive'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('stores');
}