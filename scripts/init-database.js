#!/usr/bin/env node

/**
 * script تهيئة قاعدة البيانات
 * يقوم بإنشاء الجداول والبيانات الأساسية
 */

const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const config = require('../config');

console.log('🚀 بدء تهيئة قاعدة البيانات...\n');

let db;

// الاتصال بقاعدة البيانات
async function connectToDatabase() {
  try {
    // محاولة الاتصال بـ Turso أولاً
    console.log('🌍 محاولة الاتصال بـ Turso...');
    
    db = createClient({
      url: config.database.url,
      authToken: config.database.authToken,
    });

    // اختبار الاتصال
    await db.execute('SELECT 1');
    
    console.log('✅ تم الاتصال بقاعدة Turso السحابية بنجاح');
    console.log(`🔗 قاعدة البيانات: ${config.database.url}`);
    
    await initializeDatabase();
    
  } catch (error) {
    console.error('❌ خطأ في الاتصال بـ Turso:', error.message);
    console.log('🔄 محاولة استخدام SQLite المحلية...');
    
    try {
      const sqlite3 = require('sqlite3').verbose();
      const dbDir = path.join(__dirname, '..', 'database');
      const dbPath = path.join(dbDir, 'qr_scanner.db');

      // إنشاء مجلد قاعدة البيانات إذا لم يكن موجوداً
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log('📁 تم إنشاء مجلد قاعدة البيانات');
      }

      db = new sqlite3.Database(dbPath);
      console.log('✅ تم الاتصال بقاعدة SQLite المحلية');
      
      await initializeDatabase();
      
    } catch (fallbackError) {
      console.error('❌ فشل في الاتصال بقاعدة البيانات المحلية:', fallbackError.message);
      process.exit(1);
    }
  }
}

// بدء عملية الاتصال
connectToDatabase();

// Helper functions for database operations
const isTurso = () => typeof db.execute === 'function';

async function executeRun(sql, params = []) {
  if (isTurso()) {
    return await db.execute({ sql, args: params });
  } else {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
}

async function executeGet(sql, params = []) {
  if (isTurso()) {
    const result = await db.execute({ sql, args: params });
    return result.rows[0] || null;
  } else {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }
}

async function initializeDatabase() {
  try {
    console.log('\n📊 إنشاء الجداول...');
    
    // إنشاء الجداول
    await createTables();
    
    console.log('\n👤 إنشاء المستخدم الأونر الافتراضي...');
    
    // إنشاء المستخدم الأونر الافتراضي
    await createDefaultOwner();
    
    console.log('\n⚙️ إعداد الإعدادات الافتراضية...');
    
    // إعداد الإعدادات الافتراضية
    await createDefaultSettings();
    
    console.log('\n✅ تم الانتهاء من تهيئة قاعدة البيانات بنجاح!');
    console.log('\n📋 معلومات المستخدم الأونر الافتراضي:');
    console.log('   اسم المستخدم: admin');
    console.log('   كلمة المرور: owner123');
    console.log('\n⚠️  تذكير: غيّر كلمة المرور الافتراضية بعد أول تسجيل دخول!');
    
    // إغلاق قاعدة البيانات
    db.close((err) => {
      if (err) {
        console.error('❌ خطأ في إغلاق قاعدة البيانات:', err.message);
      } else {
        console.log('\n🔒 تم إغلاق الاتصال بقاعدة البيانات');
      }
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ خطأ في تهيئة قاعدة البيانات:', error);
    process.exit(1);
  }
}

async function createTables() {
  try {
    // جدول المستخدمين
    await executeRun(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      is_owner BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      last_login DATETIME,
      is_active BOOLEAN DEFAULT 1
    )`);
    console.log('✅ تم إنشاء جدول المستخدمين');

    // جدول الطلبات/المسحات
    await executeRun(`CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      barcode TEXT NOT NULL,
      code_type TEXT DEFAULT 'كود',
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      image_data_url TEXT,
      scan_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      telegram_status TEXT DEFAULT 'pending',
      telegram_attempts INTEGER DEFAULT 0,
      telegram_last_attempt DATETIME,
      telegram_error TEXT,
      is_duplicate BOOLEAN DEFAULT 0,
      duplicate_count INTEGER DEFAULT 1,
      baghdad_time TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    console.log('✅ تم إنشاء جدول المسحات');

    // جدول الإعدادات
    await executeRun(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )`);
    console.log('✅ تم إنشاء جدول الإعدادات');

    // جدول جلسات المستخدمين
    await executeRun(`CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      is_owner BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      is_remember_me BOOLEAN DEFAULT 0,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    console.log('✅ تم إنشاء جدول الجلسات');

  } catch (error) {
    console.error('❌ خطأ في إنشاء الجداول:', error.message);
    throw error;
  }
}

async function createDefaultOwner() {
  const defaultOwnerUsername = 'admin';
  const defaultOwnerPassword = 'owner123';
  
  try {
    // التحقق من وجود المستخدم أولاً
    const existingUser = await executeGet(
      "SELECT * FROM users WHERE username = ?",
      [defaultOwnerUsername]
    );

    if (existingUser) {
      console.log('⚠️  المستخدم الأونر موجود بالفعل');
      return;
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(defaultOwnerPassword, 12);
    
    // إنشاء المستخدم الأونر
    await executeRun(
      `INSERT INTO users (username, password_hash, is_owner, created_by) 
       VALUES (?, ?, 1, 'system')`,
      [defaultOwnerUsername, hashedPassword]
    );

    console.log('✅ تم إنشاء المستخدم الأونر الافتراضي');

  } catch (error) {
    console.error('❌ خطأ في إنشاء المستخدم الأونر:', error.message);
    throw error;
  }
}

async function createDefaultSettings() {
  const defaultSettings = [
    { key: 'bot_token', value: '7668051564:AAFdFqSd0CKrlSOyPKyFwf-xHi791lcsC_U' },
    { key: 'chat_id', value: '-1002439956600' },
    { key: 'auto_send', value: '0' },
    { key: 'app_version', value: '1.0.0' },
    { key: 'last_backup', value: '' }
  ];

  try {
    for (const setting of defaultSettings) {
      // التحقق من وجود الإعداد أولاً
      const existingSetting = await executeGet(
        "SELECT * FROM settings WHERE key = ?",
        [setting.key]
      );

      if (!existingSetting) {
        await executeRun(
          `INSERT INTO settings (key, value, updated_by) VALUES (?, ?, 'system')`,
          [setting.key, setting.value]
        );
        console.log(`✅ تم إعداد ${setting.key}`);
      } else {
        console.log(`⚠️  الإعداد ${setting.key} موجود بالفعل`);
      }
    }
  } catch (error) {
    console.error('❌ خطأ في إعداد الإعدادات الافتراضية:', error.message);
    throw error;
  }
}

// معالجة إشارات النظام لإغلاق قاعدة البيانات بشكل صحيح
process.on('SIGINT', () => {
  console.log('\n⏹️  إيقاف script التهيئة...');
  db.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  إنهاء script التهيئة...');
  db.close(() => {
    process.exit(0);
  });
}); 