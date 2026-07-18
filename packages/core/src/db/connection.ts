import { Sequelize } from 'sequelize-typescript';
import { config } from '../config';

export const sequelize = new Sequelize({
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  dialect: config.db.dialect,
  logging: config.db.logging,
  pool: config.db.pool,
  models: [__dirname + '/models/**/*.ts'],
  modelMatch: (filename) => filename.endsWith('.model.ts'),
});

export async function connectDB(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    if (config.env === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database synchronized');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

export async function closeDB(): Promise<void> {
  await sequelize.close();
}