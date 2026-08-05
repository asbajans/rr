import { QueryInterface } from 'sequelize';

/** AI Product Studio publish state used while a channel job is queued/running. */
export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TYPE enum_product_marketplace_listings_status ADD VALUE IF NOT EXISTS 'publishing'`
  );
}

export async function down() {
  // PostgreSQL does not support removing an enum value safely in-place.
}
