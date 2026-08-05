import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('ai_product_sessions', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    storeId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    userId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'uploaded' },
    sourceImageUrl: { type: DataTypes.TEXT, allowNull: false },
    processedImageUrl: { type: DataTypes.TEXT, allowNull: true },
    draftId: { type: DataTypes.BIGINT, allowNull: true },
    errorMessage: { type: DataTypes.TEXT, allowNull: true },
    creditsUsed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    idempotencyKey: { type: DataTypes.STRING(128), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('ai_product_sessions', { fields: ['storeId'] });
  await queryInterface.addIndex('ai_product_sessions', { fields: ['userId'] });
  await queryInterface.addIndex('ai_product_sessions', { fields: ['status'] });
  await queryInterface.addIndex('ai_product_sessions', { fields: ['idempotencyKey'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('ai_product_sessions');
}
