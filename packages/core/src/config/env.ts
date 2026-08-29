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
  frontendUrl: process.env.APP_FRONTEND_URL || process.env.FRONTEND_URL || 'https://rahatio.com.tr',
  corsOrigin: process.env.CORS_ORIGIN ? [...new Set([...process.env.CORS_ORIGIN.split(','), 'https://rahatio.com.tr', 'https://www.rahatio.com.tr'])] : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8081', 'https://rahatio.com.tr', 'https://www.rahatio.com.tr'],
  
  jwt: {
    secret: secret('JWT_SECRET', undefined, 'dev-secret-change-in-production'),
    refreshSecret: secret('JWT_REFRESH_SECRET', undefined, 'dev-refresh-secret-change-in-production'),
    accessExpiry: '30d',
    refreshExpiry: '90d',
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

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    clientIds: (() => {
      const parts: string[] = [];
      const push = (v?: string) => {
        if (!v) return;
        v.split(',').forEach((s) => {
          const t = s.trim();
          if (t) parts.push(t);
        });
      };
      push(process.env.GOOGLE_CLIENT_IDS);
      push(process.env.GOOGLE_CLIENT_ID);
      push(process.env.GOOGLE_WEB_CLIENT_ID);
      push(process.env.GOOGLE_ANDROID_CLIENT_ID);
      push(process.env.GOOGLE_IOS_CLIENT_ID);
      push(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
      // dedupe, keep order
      return [...new Set(parts)];
    })(),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  fcm: {
    serverKey: process.env.FCM_SERVER_KEY || '',
  },

  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    graphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
    oauthScopes: process.env.META_OAUTH_SCOPES || 'pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata,instagram_basic,instagram_content_publish,catalog_management,business_management',
    systemUserToken: process.env.META_SYSTEM_USER_TOKEN || '',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@rahatio.com.tr',
  },

  sms: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
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
