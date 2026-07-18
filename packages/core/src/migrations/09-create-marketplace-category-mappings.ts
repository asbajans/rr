import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('marketplace_category_mappings', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    categoryId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'categories', key: 'id' }, onDelete: 'CASCADE' },
    marketplace: { type: DataTypes.STRING(50), allowNull: false },
    marketplaceCategoryId: { type: DataTypes.STRING(200), allowNull: false },
    name: { type: DataTypes.STRING(500), allowNull: false },
    parentId: { type: DataTypes.STRING(200), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('marketplace_category_mappings');
}