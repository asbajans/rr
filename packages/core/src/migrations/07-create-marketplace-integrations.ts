import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('marketplace_integrations', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    storeId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    marketplace: { type: DataTypes.STRING(50), allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    config: { type: DataTypes.JSONB, allowNull: true },
    lastSyncAt: { type: DataTypes.DATE, allowNull: true },
    etsyCategoryId: { type: DataTypes.STRING(200), allowNull: true },
    etsyShippingProfileId: { type: DataTypes.STRING(200), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('marketplace_integrations', { fields: ['storeId', 'marketplace'], unique: true });
  await queryInterface.addIndex('marketplace_integrations', { fields: ['storeId', 'isActive'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('marketplace_integrations');
}