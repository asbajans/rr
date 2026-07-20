import { Sequelize } from 'sequelize';
import bcrypt from 'bcryptjs';

async function seed() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rahatio';
  const sequelize = new Sequelize(dbUrl, { dialect: 'postgres', logging: false });

  try {
    await sequelize.authenticate();
    console.log('Database connected');

    await sequelize.query(`CREATE TABLE IF NOT EXISTS plans (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      price DECIMAL(10,2) DEFAULT 0,
      "productLimit" INTEGER DEFAULT 100,
      "aiCredits" INTEGER DEFAULT 1000,
      features JSONB,
      "stripePriceId" VARCHAR(100),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`);

    await sequelize.query(`CREATE TABLE IF NOT EXISTS stores (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      "siteCode" VARCHAR(50) NOT NULL UNIQUE,
      domain VARCHAR(255) UNIQUE,
      email VARCHAR(255) NOT NULL,
      "isActive" BOOLEAN DEFAULT true,
      "planId" BIGINT REFERENCES plans(id),
      "stripeAccountId" VARCHAR(100),
      theme JSONB,
      currency VARCHAR(3) DEFAULT 'TRY',
      "taxSettings" JSONB,
      "shippingSettings" JSONB,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`);

    await sequelize.query(`CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      "storeId" BIGINT NOT NULL REFERENCES stores(id),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      "passwordHash" VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'staff',
      "aiCredits" INTEGER DEFAULT 0,
      "fcmToken" VARCHAR(255),
      "isActive" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`);

    await sequelize.query(`CREATE TABLE IF NOT EXISTS subscriptions (
      id BIGSERIAL PRIMARY KEY,
      "storeId" BIGINT NOT NULL REFERENCES stores(id),
      "planId" BIGINT NOT NULL REFERENCES plans(id),
      "stripeSubscriptionId" VARCHAR(100),
      status VARCHAR(20) DEFAULT 'active',
      "trialEndsAt" TIMESTAMP WITH TIME ZONE,
      "currentPeriodEnd" TIMESTAMP WITH TIME ZONE NOT NULL,
      "canceledAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`);

    console.log('Tables ensured');

    const [plans] = await sequelize.query(`SELECT id FROM plans WHERE name = 'Free' LIMIT 1`);
    if (!plans.length) {
      await sequelize.query(`INSERT INTO plans (name, price, "productLimit", "aiCredits", features)
        VALUES ('Free', 0, 100, 1000, '{"marketplaceSync":true,"b2bAccess":true,"apiAccess":true}')`);
      console.log('Plan created: Free');
    } else {
      console.log('Plan already exists: Free');
    }

    const [users] = await sequelize.query(`SELECT id FROM users WHERE email = 'admin@rahatio.com.tr' LIMIT 1`);
    if (!users.length) {
      const [plans] = await sequelize.query(`SELECT id FROM plans WHERE name = 'Free' LIMIT 1`);
      const plan = plans[0] as any;
      if (!plan) throw new Error('Free plan not found');

      const passwordHash = await bcrypt.hash('admin123', 12);

      await sequelize.query(`INSERT INTO stores (name, "siteCode", email)
        VALUES ('Admin Store', 'admin', 'admin@rahatio.com.tr')`);

      const [stores] = await sequelize.query(`SELECT id FROM stores WHERE "siteCode" = 'admin' LIMIT 1`);
      const store = stores[0] as any;

      await sequelize.query(
        `INSERT INTO users ("storeId", name, email, "passwordHash", role, "aiCredits")
         VALUES ($1, 'Admin', 'admin@rahatio.com.tr', $2, 'owner', 1000)`,
        { bind: [store.id, passwordHash] }
      );

      await sequelize.query(
        `INSERT INTO subscriptions ("storeId", "planId", status, "currentPeriodEnd")
         VALUES ($1, $2, 'active', NOW() + INTERVAL '1 year')`,
        { bind: [store.id, plan.id] }
      );

      console.log('Admin user created: admin@rahatio.com.tr / admin123');
    } else {
      console.log('Admin user already exists');
    }

    console.log('Seed completed successfully');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seed();
