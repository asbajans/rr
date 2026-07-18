import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiUrl: process.env.APP_URL || 'http://localhost:3000',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'rahatio',
    dialect: 'postgres' as const,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
    },
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'rahatio-jwt-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'rahatio-refresh-secret-change-in-production',
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },

  internal: {
    key: process.env.RAHAT_INTERNAL_KEY || 'internal-key-change-in-production',
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'rahatio-media',
    region: process.env.S3_REGION || 'us-east-1',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  marketplace: {
    trendyol: {
      apiKey: process.env.TRENDYOL_API_KEY || '',
      apiSecret: process.env.TRENDYOL_API_SECRET || '',
      supplierId: process.env.TRENDYOL_SUPPLIER_ID || '',
    },
    hepsiburada: {
      username: process.env.HEPSIBURADA_USERNAME || '',
      password: process.env.HEPSIBURADA_PASSWORD || '',
      merchantId: process.env.HEPSIBURADA_MERCHANT_ID || '',
    },
    pazarama: {
      clientId: process.env.PAZARAMA_CLIENT_ID || '',
      clientSecret: process.env.PAZARAMA_CLIENT_SECRET || '',
      apiKey: process.env.PAZARAMA_API_KEY || '',
    },
    n11: {
      appKey: process.env.N11_APPKEY || '',
      appSecret: process.env.N11_APPSECRET || '',
    },
    amazon: {
      refreshToken: process.env.AMAZON_REFRESH_TOKEN || '',
      lwaClientId: process.env.AMAZON_LWA_CLIENT_ID || '',
      lwaClientSecret: process.env.AMAZON_LWA_CLIENT_SECRET || '',
      awsAccessKey: process.env.AMAZON_AWS_ACCESS_KEY || '',
      awsSecretKey: process.env.AMAZON_AWS_SECRET_KEY || '',
      sellerId: process.env.AMAZON_SELLER_ID || '',
    },
    etsy: {
      clientId: process.env.ETSY_CLIENT_ID || '',
      clientSecret: process.env.ETSY_CLIENT_SECRET || '',
      redirectUri: process.env.ETSY_REDIRECT_URI || '',
    },
  },

  ai: {
    serviceUrl: process.env.AI_SERVICE_URL || 'http://localhost:3001',
  },

  integration: {
    serviceUrl: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:3002',
    apiKey: process.env.CORE_API_KEY || 'core-internal-key',
  },

  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8081'],
    credentials: true,
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
  },

  gold: {
    apiUrl: process.env.GOLD_API_URL || 'https://api.altin.in/api/v1/gold.json',
    fallbackPrice: 2300,
  },
};