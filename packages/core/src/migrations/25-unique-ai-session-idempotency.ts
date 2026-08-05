import { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS ai_product_sessions_store_idempotency_unique
     ON ai_product_sessions ("storeId", "idempotencyKey")
     WHERE "idempotencyKey" IS NOT NULL`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `DROP INDEX IF EXISTS ai_product_sessions_store_idempotency_unique`
  );
}
