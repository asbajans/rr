const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

function secret(name: string, fallback: string | undefined, unsafeFallback: string): string {
  const value = process.env[name] || fallback || '';
  const placeholder = !value || value === unsafeFallback || /change[-_]?me|your[-_].*change|dev[-_].*key|super[-_].*secret|minioadmin/i.test(value);
  if (isProduction && placeholder) {
    throw new Error(`${name} must be set to a strong production secret`);
  }
  return value || unsafeFallback;
}

const internalKey = secret('RAHAT_INTERNAL_KEY', undefined, 'internal-dev-key');
const slaveHmacSecret = secret('RAHAT_SLAVE_HMAC_SECRET', undefined, 'slave-hmac-dev-key');
if (isProduction && internalKey === slaveHmacSecret) {
  throw new Error('RAHAT_SLAVE_HMAC_SECRET must be different from RAHAT_INTERNAL_KEY in production');
}

export const config = {
  env: environment,
  port: parseInt(process.env.PORT || '3000', 10),
  version: process.env.npm_package_version || '2.0.0',
  apiUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN ? [...new Set([...process.env.CORS_ORIGIN.split(','), 'https://rahatio.com.tr', 'https://www.rahatio.com.tr'])] : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8081', 'https://rahatio.com.tr', 'https://www.rahatio.com.tr'],
  
  jwt: {
    secret: secret('JWT_SECRET', undefined, 'dev-secret-change-in-production'),
    refreshSecret: secret('JWT_REFRESH_SECRET', undefined, 'dev-refresh-secret-change-in-production'),
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },

  apiKey: {
    internalKey,
    slaveHmacSecret,
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
    apiKey: secret('CORE_API_KEY', undefined, 'core-dev-key'),
  },

  goldPrice: {
    apiUrl: process.env.GOLD_PRICE_API || 'https://api.gold-api.com/price/XAU',
    cacheTtl: 300,
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 600,
  },
};
