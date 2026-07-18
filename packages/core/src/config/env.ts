export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  version: process.env.npm_package_version || '2.0.0',
  apiUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8081'],
  
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },

  apiKey: {
    internalKey: process.env.RAHAT_INTERNAL_KEY || 'internal-dev-key',
    hmacAlgorithm: 'sha256',
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rahatio',
    pool: { min: 2, max: 10 },
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'rahatio-media',
    region: 'us-east-1',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  aiService: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:3001',
  },

  integrationService: {
    url: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:3002',
    apiKey: process.env.CORE_API_KEY || 'core-dev-key',
  },

  goldPrice: {
    apiUrl: process.env.GOLD_PRICE_API || 'https://api.gold-api.com/price/XAU',
    cacheTtl: 300,
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
  },
};