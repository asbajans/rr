import { QueryInterface, DataTypes } from 'sequelize';

/**
 * AI Product Studio publish support (AGENTOPEN Faz 5):
 * links an approved draft to the product created by the publish transaction
 * so re-publish is idempotent (no duplicate products).
 */
export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('ai_product_drafts', 'productId', {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: { model: 'products', key: 'id' },
    onDelete: 'SET NULL',
  });
  await queryInterface.addIndex('ai_product_drafts', { fields: ['productId'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('ai_product_drafts', 'productId');
}
