// إعدادات الخادم
const config = {
  // إعدادات الخادم
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // إعدادات قاعدة البيانات
  database: {
    // Turso Database Configuration
    url: process.env.TURSO_DATABASE_URL || 'https://takyd-tlbat-mgkw.turso.io',
    authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJnaWQiOiIzNmU0NjAwNy02MmM5LTQzMDUtOGZhNC0xN2Q2NTkyZWY5MGQiLCJpYXQiOjE3NTA1MTkzNjUsInJpZCI6ImEzMTMwODFjLWU5ZjAtNDc5OS04Mjc4LTJmNWU3NWY2MWQ1ZiJ9.i_H3QdOZVmHESLgUVJDXiODeR2QJ4Vd6SyvUL_YidngnKIAMeWbLYw56O6OOXHK_YU4rPjoT1b5_bvs61CP9Cw',
    // Fallback to local SQLite if Turso is unavailable
    localPath: process.env.DB_PATH || './database/qr_scanner.db'
  },
  
  // إعدادات التليجرام الافتراضية
  telegram: {
    defaultBotToken: process.env.DEFAULT_BOT_TOKEN || '7668051564:AAFdFqSd0CKrlSOyPKyFwf-xHi791lcsC_U',
    defaultChatId: process.env.DEFAULT_CHAT_ID || -1002439956600
  },
  
  // إعدادات الأمان
  security: {
    sessionSecret: process.env.SESSION_SECRET || 'qr_scanner_secret_key_2024',
    defaultOwnerPassword: process.env.OWNER_PASSWORD || 'owner123',
    saltRounds: 12
  },
  
  // إعدادات CORS
  cors: {
    allowedOrigins: [
      'http://localhost:3000',
      'https://mgkw.github.io',
      'http://127.0.0.1:3000',
      'http://localhost:5500'
    ]
  },
  
  // إعدادات Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 100 // حد أقصى 100 طلب لكل IP
  }
};

module.exports = config; 