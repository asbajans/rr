import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('categories', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    storeId: { type: DataTypes.BIGINT, allowNull: true, references: { model: 'stores', key: 'id' }, onDelete: 'SET NULL' },
    parentId: { type: DataTypes.BIGINT, allowNull: true, references: { model: 'categories', key: 'id' }, onDelete: 'SET NULL' },
    slug: { type: DataTypes.STRING(200), allowNull: false },
    name: { type: DataTypes.JSONB, allowNull: false },
    translations: { type: DataTypes.JSONB, allowNull: true },
    icon: { type: DataTypes.STRING(100), allowNull: true },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('categories', { fields: ['storeId', 'parentId'] });
  await queryInterface.addIndex('categories', { fields: ['storeId', 'slug'] });
  await queryInterface.addIndex('categories', { fields: ['storeId', 'isActive'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('categories');
}