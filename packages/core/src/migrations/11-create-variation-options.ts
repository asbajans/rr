import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('variation_options', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    variationId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'variations', key: 'id' }, onDelete: 'CASCADE' },
    value: { type: DataTypes.STRING(200), allowNull: false },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('variation_options', { fields: ['variationId'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('variation_options');
}