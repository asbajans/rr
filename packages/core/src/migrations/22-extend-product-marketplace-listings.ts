import { QueryInterface, DataTypes } from 'sequelize';

/**
 * AI Product Studio publish support (AGENTOPEN Faz 5):
 * extends product_marketplace_listings with channel-scoped publish tracking.
 */
export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('product_marketplace_listings', 'channel', {
    type: DataTypes.STRING(50),
    allowNull: true,
  });
  await queryInterface.addColumn('product_marketplace_listings', 'payloadSnapshot', {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  await queryInterface.addColumn('product_marketplace_listings', 'retryCount', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });
  await queryInterface.addColumn('product_marketplace_listings', 'lastAttemptAt', {
    type: DataTypes.DATE,
    allowNull: true,
  });
  await queryInterface.addIndex('product_marketplace_listings', { fields: ['channel'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('product_marketplace_listings', 'lastAttemptAt');
  await queryInterface.removeColumn('product_marketplace_listings', 'retryCount');
  await queryInterface.removeColumn('product_marketplace_listings', 'payloadSnapshot');
  await queryInterface.removeColumn('product_marketplace_listings', 'channel');
}
