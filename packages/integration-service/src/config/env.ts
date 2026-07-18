export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3002', 10),
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  
  coreApiUrl: process.env.CORE_API_URL || 'http://localhost:3000',
  coreApiKey: process.env.CORE_API_KEY || 'core-internal-key',
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
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
};