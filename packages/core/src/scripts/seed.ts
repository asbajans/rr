import { Sequelize } from 'sequelize-typescript';
import { Plan } from '../models/Plan.model.js';
import { Store } from '../models/Store.model.js';
import { User } from '../models/User.model.js';
import { Subscription } from '../models/Subscription.model.js';
import { config } from '../config/env.js';
import bcrypt from 'bcryptjs';

async function seed() {
  const sequelize = new Sequelize(config.database.url, {
    dialect: 'postgres',
    logging: false,
    models: [Plan, Store, User, Subscription],
  });

  try {
    await sequelize.authenticate();
    console.log('Database connected');

    const freePlan = await Plan.findOne({ where: { name: 'Free' } });
    if (!freePlan) {
      const plan = await Plan.create({
        name: 'Free',
        price: 0,
        productLimit: 100,
        aiCredits: 1000,
        features: { marketplaceSync: true, b2bAccess: true, apiAccess: true },
      });
      console.log(`Plan created: ${plan.name} (${plan.id})`);
    } else {
      console.log(`Plan already exists: ${freePlan.name}`);
    }

    const existingAdmin = await User.findOne({ where: { email: 'admin@rahatio.com.tr' } });
    if (!existingAdmin) {
      const freePlanRecord = await Plan.findOne({ where: { name: 'Free' } });
      if (!freePlanRecord) throw new Error('Free plan not found');

      const store = await Store.create({
        name: 'Admin Store',
        siteCode: 'admin',
        email: 'admin@rahatio.com.tr',
        isActive: true,
        currency: 'TRY',
      });

      const passwordHash = await bcrypt.hash('admin123', 12);
      const user = await User.create({
        storeId: store.id,
        name: 'Admin',
        email: 'admin@rahatio.com.tr',
        passwordHash,
        role: 'owner',
        isActive: true,
        aiCredits: 1000,
      });

      await Subscription.create({
        storeId: store.id,
        planId: freePlanRecord.id,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      console.log(`Admin user created: ${user.email}`);
      console.log(`Store created: ${store.name} (${store.siteCode})`);
      console.log('Default login: admin@rahatio.com.tr / admin123');
    } else {
      console.log(`Admin user already exists: ${existingAdmin.email}`);
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
