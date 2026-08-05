import { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "paymentEventId" VARCHAR(200)`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TABLE dropshipping_orders DROP COLUMN IF EXISTS "paymentEventId"`
  );
}
