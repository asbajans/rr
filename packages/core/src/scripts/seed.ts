import { Sequelize } from 'sequelize';
import bcrypt from 'bcryptjs';

async function seed() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rahatio';
  const sequelize = new Sequelize(dbUrl, { dialect: 'postgres', logging: false });

  try {
    await sequelize.authenticate();
    console.log('Database connected');

    const [[freePlan]] = await sequelize.query(`SELECT id FROM plans WHERE name = 'Free' LIMIT 1`);
    if (!freePlan) {
      await sequelize.query(`INSERT INTO plans (name, price, "productLimit", "aiCredits", features, "createdAt", "updatedAt")
        VALUES ('Free', 0, 100, 1000, '{"marketplaceSync":true,"b2bAccess":true,"apiAccess":true}', NOW(), NOW())`);
      console.log('Plan created: Free');
    } else {
      console.log('Plan already exists: Free');
    }

    const [[existingAdmin]] = await sequelize.query(`SELECT id FROM users WHERE email = 'admin@rahatio.com.tr' LIMIT 1`);
    if (!existingAdmin) {
      const [[plan]] = await sequelize.query(`SELECT id FROM plans WHERE name = 'Free' LIMIT 1`);
      if (!plan) throw new Error('Free plan not found');

      const passwordHash = await bcrypt.hash('admin123', 12);

      await sequelize.query(`INSERT INTO stores (name, "siteCode", email, "isActive", currency, "createdAt", "updatedAt")
        VALUES ('Admin Store', 'admin', 'admin@rahatio.com.tr', true, 'TRY', NOW(), NOW())`);

      const [[store]] = await sequelize.query(`SELECT id FROM stores WHERE "siteCode" = 'admin' LIMIT 1`);

      await sequelize.query(`INSERT INTO users ("storeId", name, email, "passwordHash", role, "isActive", "aiCredits", "createdAt", "updatedAt")
        VALUES ($1, 'Admin', 'admin@rahatio.com.tr', $2, 'owner', true, 1000, NOW(), NOW())`,
        { bind: [(store as any).id, passwordHash] });

      await sequelize.query(`INSERT INTO subscriptions ("storeId", "planId", status, "currentPeriodEnd", "createdAt", "updatedAt")
        VALUES ($1, $2, 'active', NOW() + INTERVAL '1 year', NOW(), NOW())`,
        { bind: [(store as any).id, (plan as any).id] });

      console.log('Admin user created: admin@rahatio.com.tr / admin123');
    } else {
      console.log('Admin user already exists');
    }

    console.log('Seed completed');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seed();
