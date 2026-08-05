import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('ai_product_drafts', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    sessionId: { type: DataTypes.UUID, allowNull: false, references: { model: 'ai_product_sessions', key: 'id' }, onDelete: 'CASCADE' },
    storeId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    title: { type: DataTypes.STRING(500), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    shortDescription: { type: DataTypes.TEXT, allowNull: true },
    slug: { type: DataTypes.STRING(200), allowNull: true },
    sku: { type: DataTypes.STRING(100), allowNull: true },
    categoryId: { type: DataTypes.BIGINT, allowNull: true, references: { model: 'categories', key: 'id' }, onDelete: 'SET NULL' },
    categoryPath: { type: DataTypes.JSONB, allowNull: true },
    attributes: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    tags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    keywords: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    suggestedPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    priceCurrency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'TRY' },
    quantity: { type: DataTypes.INTEGER, allowNull: true },
    images: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    confidence: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    userEditedFields: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    rawAiResponse: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'review' },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('ai_product_drafts', { fields: ['storeId'] });
  await queryInterface.addIndex('ai_product_drafts', { fields: ['sessionId'] });
  await queryInterface.addIndex('ai_product_drafts', { fields: ['status'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('ai_product_drafts');
}
