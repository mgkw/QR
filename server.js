const express = require('express');
const { createClient } = require('@libsql/client');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Static files
app.use(express.static('.'));

// Database setup - Turso Cloud Database
let db;

async function connectToDatabase() {
  try {
    // Create Turso client
    db = createClient({
      url: config.database.url,
      authToken: config.database.authToken,
    });

    // Test connection
    await db.execute('SELECT 1');
    
    console.log('✅ تم الاتصال بقاعدة Turso السحابية بنجاح');
    console.log(`🌍 قاعدة البيانات: ${config.database.url}`);
    
    // Initialize database tables
    await initializeDatabase();
    
  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة Turso:', error.message);
    console.log('🔄 محاولة استخدام SQLite المحلية كنسخة احتياطية...');
    
    // Fallback to local SQLite
    try {
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = config.database.localPath;
      
      // Ensure database directory exists
      if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
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

// Connect to database on startup
connectToDatabase();

// Helper functions for database operations
const isTurso = () => typeof db.execute === 'function';

async function executeQuery(sql, params = []) {
  if (isTurso()) {
    return await db.execute({ sql, args: params });
  } else {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve({ rows });
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

// Initialize database tables for Turso
async function initializeDatabase() {
  try {
    console.log('📊 إنشاء جداول قاعدة البيانات...');

    // جدول المستخدمين
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      is_owner BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      last_login DATETIME,
      is_active BOOLEAN DEFAULT 1
    )`);

    // جدول الطلبات/المسحات
    await db.execute(`CREATE TABLE IF NOT EXISTS scans (
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

    // جدول الإعدادات
    await db.execute(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )`);

    // جدول جلسات المستخدمين
    await db.execute(`CREATE TABLE IF NOT EXISTS user_sessions (
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

    console.log('✅ تم إنشاء جداول قاعدة البيانات بنجاح');

    // إنشاء المستخدم الأونر الافتراضي
    await createDefaultOwner();
    
  } catch (error) {
    console.error('❌ خطأ في إنشاء جداول قاعدة البيانات:', error);
    throw error;
  }
}

// إنشاء المستخدم الأونر الافتراضي
async function createDefaultOwner() {
  const defaultOwnerUsername = 'admin';
  const defaultOwnerPassword = 'owner123';
  
  try {
    // التحقق من وجود المستخدم
    const existingUser = await executeGet(
      "SELECT * FROM users WHERE username = ?",
      [defaultOwnerUsername]
    );
    
    if (!existingUser) {
      // تشفير كلمة المرور
      const hashedPassword = await bcrypt.hash(defaultOwnerPassword, 12);
      
      // إنشاء المستخدم الأونر
      await executeRun(
        `INSERT INTO users (username, password_hash, is_owner, created_by) 
         VALUES (?, ?, 1, 'system')`,
        [defaultOwnerUsername, hashedPassword]
      );
      
      console.log('✅ تم إنشاء المستخدم الأونر الافتراضي:', defaultOwnerUsername);
    } else {
      console.log('⚠️ المستخدم الأونر موجود بالفعل');
    }
  } catch (error) {
    console.error('❌ خطأ في إنشاء المستخدم الأونر:', error);
  }
}

// ==================== API Routes ====================

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, isOwner = false, rememberMe = false } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم مطلوب' });
    }

    // البحث عن المستخدم
    const user = await executeGet(
      "SELECT * FROM users WHERE username = ? AND is_active = 1",
      [username]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'المستخدم غير موجود أو غير مسجل' });
    }

    let actualIsOwner = isOwner;

    // التحقق من صلاحية الأونر
    if (isOwner) {
      if (!password) {
        return res.status(400).json({ success: false, message: 'كلمة المرور مطلوبة للأونر' });
      }

      if (!user.is_owner) {
        return res.status(401).json({ success: false, message: 'هذا المستخدم ليس أونر' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: 'كلمة مرور خاطئة' });
      }
    } else if (user.is_owner && password) {
      // إذا كان أونر ولكن يسجل دخول كمستخدم عادي مع كلمة مرور
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (isPasswordValid) {
        // تسجيل دخول كأونر تلقائياً
        actualIsOwner = true;
      }
    }

    // إنشاء جلسة جديدة
    const sessionId = uuidv4();
    const expiresAt = rememberMe ? 
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : // 30 يوم
      new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ساعة

    await executeRun(
      `INSERT INTO user_sessions (id, user_id, username, is_owner, expires_at, is_remember_me)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, user.id, user.username, actualIsOwner || user.is_owner, expiresAt.toISOString(), rememberMe]
    );

    // تحديث آخر تسجيل دخول
    await executeRun("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);

    res.json({
      success: true,
      message: `مرحباً ${username}${actualIsOwner || user.is_owner ? ' (الأونر)' : ''}!`,
      session: {
        sessionId,
        username: user.username,
        isOwner: actualIsOwner || user.is_owner,
        expiresAt: expiresAt.toISOString()
      }
    });

  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// تسجيل الخروج
app.post('/api/logout', (req, res) => {
  const { sessionId } = req.body;

  if (sessionId) {
    db.run("DELETE FROM user_sessions WHERE id = ?", [sessionId], (err) => {
      if (err) {
        console.error('خطأ في حذف الجلسة:', err);
      }
    });
  }

  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

// التحقق من صحة الجلسة
app.post('/api/verify-session', (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(401).json({ success: false, message: 'معرف الجلسة مطلوب' });
  }

  db.get(`SELECT * FROM user_sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP`, 
         [sessionId], (err, session) => {
    if (err) {
      console.error('خطأ في التحقق من الجلسة:', err);
      return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }

    if (!session) {
      return res.status(401).json({ success: false, message: 'الجلسة منتهية الصلاحية' });
    }

    // تحديث آخر نشاط
    db.run("UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?", [sessionId]);

    res.json({
      success: true,
      session: {
        sessionId: session.id,
        username: session.username,
        isOwner: session.is_owner
      }
    });
  });
});

// الحصول على جميع المستخدمين (للأونر فقط)
app.get('/api/users', authenticateOwner, (req, res) => {
  db.all("SELECT id, username, created_at, created_by, last_login, is_active FROM users WHERE is_owner = 0", 
         (err, users) => {
    if (err) {
      console.error('خطأ في جلب المستخدمين:', err);
      return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }

    res.json({ success: true, users });
  });
});

// إضافة مستخدم جديد (للأونر فقط)
app.post('/api/users', authenticateOwner, (req, res) => {
  const { username } = req.body;
  const createdBy = req.user.username;

  if (!username) {
    return res.status(400).json({ success: false, message: 'اسم المستخدم مطلوب' });
  }

  db.run("INSERT INTO users (username, created_by) VALUES (?, ?)", 
         [username, createdBy], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ success: false, message: 'اسم المستخدم موجود بالفعل' });
      }
      console.error('خطأ في إضافة المستخدم:', err);
      return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }

    res.json({ 
      success: true, 
      message: `تم إضافة المستخدم "${username}" بنجاح`,
      userId: this.lastID 
    });
  });
});

// حذف مستخدم (للأونر فقط)
app.delete('/api/users/:username', authenticateOwner, (req, res) => {
  const { username } = req.params;

  db.run("UPDATE users SET is_active = 0 WHERE username = ? AND is_owner = 0", 
         [username], function(err) {
    if (err) {
      console.error('خطأ في حذف المستخدم:', err);
      return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    res.json({ success: true, message: `تم حذف المستخدم "${username}" بنجاح` });
  });
});

// حفظ مسحة جديدة
app.post('/api/scans', authenticateUser, async (req, res) => {
  try {
    const { barcode, codeType, imageDataUrl } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    if (!barcode) {
      return res.status(400).json({ success: false, message: 'الباركود مطلوب' });
    }

    const scanId = uuidv4();
    const baghdadTime = new Date().toLocaleString('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // التحقق من التكرار خلال 20 ثانية
    const twentySecondsAgo = new Date(Date.now() - 20000).toISOString();
    
    db.get(`SELECT * FROM scans WHERE barcode = ? AND scan_timestamp > ?`, 
           [barcode, twentySecondsAgo], (err, recentScan) => {
      if (err) {
        console.error('خطأ في البحث عن التكرار:', err);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
      }

      const isDuplicate = !!recentScan;

      // حساب عدد التكرارات الإجمالي
      db.get(`SELECT COUNT(*) as count FROM scans WHERE barcode = ?`, [barcode], (err, countResult) => {
        if (err) {
          console.error('خطأ في حساب التكرارات:', err);
          return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
        }

        const duplicateCount = (countResult.count || 0) + 1;

        // حفظ المسحة
        db.run(`INSERT INTO scans (id, barcode, code_type, user_id, username, image_data_url, 
                                   is_duplicate, duplicate_count, baghdad_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [scanId, barcode, codeType || 'كود', userId, username, imageDataUrl, 
                 isDuplicate, duplicateCount, baghdadTime], (err) => {
          if (err) {
            console.error('خطأ في حفظ المسحة:', err);
            return res.status(500).json({ success: false, message: 'خطأ في حفظ المسحة' });
          }

          let response = {
            success: true,
            message: 'تم حفظ المسحة بنجاح',
            scan: {
              id: scanId,
              barcode,
              codeType: codeType || 'كود',
              username,
              isDuplicate,
              duplicateCount,
              baghdadTime
            }
          };

          // إذا كان مكرر، أرسل معلومات المسحة الأصلية
          if (isDuplicate && recentScan) {
            response.recentScan = {
              username: recentScan.username,
              scanTime: recentScan.scan_timestamp,
              imageDataUrl: recentScan.image_data_url,
              timeDiff: Math.floor((Date.now() - new Date(recentScan.scan_timestamp).getTime()) / 1000)
            };
          }

          res.json(response);

          // إرسال إلى التليجرام تلقائياً إذا تم تفعيله
          sendToTelegramAsync(scanId, barcode, imageDataUrl);
        });
      });
    });
  } catch (error) {
    console.error('خطأ في حفظ المسحة:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// الحصول على جميع المسحات
app.get('/api/scans', authenticateUser, (req, res) => {
  const { startDate, endDate, userId: filterUserId } = req.query;
  const isOwner = req.user.isOwner;
  
  let query = "SELECT * FROM scans";
  let params = [];
  let conditions = [];

  // إذا لم يكن أونر، يرى مسحاته فقط
  if (!isOwner) {
    conditions.push("user_id = ?");
    params.push(req.user.userId);
  }

  // فلتر المستخدم (للأونر فقط)
  if (isOwner && filterUserId) {
    conditions.push("user_id = ?");
    params.push(filterUserId);
  }

  // فلتر التاريخ
  if (startDate) {
    conditions.push("DATE(scan_timestamp) >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("DATE(scan_timestamp) <= ?");
    params.push(endDate);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY scan_timestamp DESC";

  db.all(query, params, (err, scans) => {
    if (err) {
      console.error('خطأ في جلب المسحات:', err);
      return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }

    res.json({ success: true, scans });
  });
});

// تحديث حالة التليجرام للمسحة
app.put('/api/scans/:scanId/telegram-status', authenticateUser, (req, res) => {
  const { scanId } = req.params;
  const { status, attempts, errorMessage } = req.body;

  db.run(`UPDATE scans SET telegram_status = ?, telegram_attempts = ?, 
          telegram_last_attempt = CURRENT_TIMESTAMP, telegram_error = ?
          WHERE id = ?`,
          [status, attempts || 0, errorMessage || null, scanId], function(err) {
    if (err) {
      console.error('خطأ في تحديث حالة التليجرام:', err);
      return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'المسحة غير موجودة' });
    }

    res.json({ success: true, message: 'تم تحديث حالة التليجرام' });
  });
});

// الحصول على الإحصائيات
app.get('/api/statistics', authenticateUser, (req, res) => {
  const isOwner = req.user.isOwner;
  const userId = req.user.userId;

  const statsQueries = [
    // إجمالي المسحات
    isOwner ? 
      "SELECT COUNT(*) as total FROM scans" :
      "SELECT COUNT(*) as total FROM scans WHERE user_id = ?",
    
    // الأكواد الفريدة
    isOwner ? 
      "SELECT COUNT(DISTINCT barcode) as unique_codes FROM scans" :
      "SELECT COUNT(DISTINCT barcode) as unique_codes FROM scans WHERE user_id = ?",
    
    // المكررات
    isOwner ?
      "SELECT COUNT(*) as duplicates FROM scans WHERE is_duplicate = 1" :
      "SELECT COUNT(*) as duplicates FROM scans WHERE is_duplicate = 1 AND user_id = ?",
    
    // المستخدمين النشطين (للأونر فقط)
    isOwner ? "SELECT COUNT(DISTINCT user_id) as active_users FROM scans" : null
  ].filter(Boolean);

  const params = isOwner ? [] : [userId, userId, userId];

  Promise.all(statsQueries.map((query, index) => {
    return new Promise((resolve, reject) => {
      const queryParams = isOwner ? [] : [params[index]];
      db.get(query, queryParams, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  })).then(results => {
    const stats = {
      totalScans: results[0]?.total || 0,
      uniqueCodes: results[1]?.unique_codes || 0,
      duplicates: results[2]?.duplicates || 0
    };

    if (isOwner && results[3]) {
      stats.activeUsers = results[3].active_users || 0;
    }

    res.json({ success: true, stats });
  }).catch(err => {
    console.error('خطأ في جلب الإحصائيات:', err);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  });
});

// حفظ/تحديث الإعدادات (للأونر فقط)
app.post('/api/settings', authenticateOwner, (req, res) => {
  const { botToken, chatId, autoSend } = req.body;
  const updatedBy = req.user.username;

  const settings = [
    { key: 'bot_token', value: botToken },
    { key: 'chat_id', value: chatId },
    { key: 'auto_send', value: autoSend ? '1' : '0' }
  ];

  const queries = settings.map(setting => {
    return new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO settings (key, value, updated_by) VALUES (?, ?, ?)`,
             [setting.key, setting.value, updatedBy], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  Promise.all(queries).then(() => {
    res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
  }).catch(err => {
    console.error('خطأ في حفظ الإعدادات:', err);
    res.status(500).json({ success: false, message: 'خطأ في حفظ الإعدادات' });
  });
});

// جلب الإعدادات (للأونر فقط)
app.get('/api/settings', authenticateOwner, (req, res) => {
  db.all("SELECT key, value FROM settings", (err, settings) => {
    if (err) {
      console.error('خطأ في جلب الإعدادات:', err);
      return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }

    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });

    res.json({ success: true, settings: settingsObj });
  });
});

// اختبار اتصال التليجرام
app.post('/api/test-telegram', authenticateOwner, async (req, res) => {
  try {
    const { botToken, chatId } = req.body;

    if (!botToken || !chatId) {
      return res.status(400).json({ success: false, message: 'توكن البوت وآيدي المجموعة مطلوبان' });
    }

    const axios = require('axios');
    const testUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const testMessage = {
      chat_id: chatId,
      text: `🧪 اختبار الاتصال من قارئ الباركود\n⏰ ${new Date().toLocaleString('ar-IQ', { timeZone: 'Asia/Baghdad' })}\n✅ تم الاتصال بنجاح!`
    };

    const response = await axios.post(testUrl, testMessage, { timeout: 10000 });

    if (response.data.ok) {
      res.json({ success: true, message: 'تم اختبار الاتصال بنجاح! ✅' });
    } else {
      res.status(400).json({ success: false, message: response.data.description || 'فشل في الاختبار' });
    }
  } catch (error) {
    console.error('خطأ في اختبار التليجرام:', error);
    res.status(500).json({ 
      success: false, 
      message: error.response?.data?.description || error.message || 'خطأ في اختبار الاتصال' 
    });
  }
});

// التحقق من حالة الخادم
app.get('/api/status', (req, res) => {
  res.json({ 
    success: true, 
    message: 'الخادم يعمل بشكل طبيعي',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ==================== Middleware ====================

// التحقق من صحة الجلسة (للمستخدمين العاديين)
function authenticateUser(req, res, next) {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionId) {
    return res.status(401).json({ success: false, message: 'مطلوب تسجيل الدخول' });
  }

  db.get(`SELECT s.*, u.id as userId FROM user_sessions s 
          JOIN users u ON s.user_id = u.id 
          WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = 1`, 
         [sessionId], (err, session) => {
    if (err) {
      console.error('خطأ في التحقق من الجلسة:', err);
      return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }

    if (!session) {
      return res.status(401).json({ success: false, message: 'الجلسة منتهية الصلاحية' });
    }

    // تحديث آخر نشاط
    db.run("UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?", [sessionId]);

    req.user = {
      userId: session.userId,
      username: session.username,
      isOwner: session.is_owner,
      sessionId: session.id
    };

    next();
  });
}

// التحقق من صلاحيات الأونر
function authenticateOwner(req, res, next) {
  authenticateUser(req, res, () => {
    if (!req.user.isOwner) {
      return res.status(403).json({ success: false, message: 'هذه الميزة متاحة للأونر فقط' });
    }
    next();
  });
}

// دالة الإرسال إلى التليجرام
async function sendToTelegramAsync(scanId, barcode, imageDataUrl) {
  try {
    // جلب الإعدادات
    db.all("SELECT key, value FROM settings", async (err, settings) => {
      if (err) {
        console.error('خطأ في جلب إعدادات التليجرام:', err);
        return;
      }

      const settingsObj = {};
      settings.forEach(setting => {
        settingsObj[setting.key] = setting.value;
      });

      const botToken = settingsObj.bot_token || "7668051564:AAFdFqSd0CKrlSOyPKyFwf-xHi791lcsC_U";
      const chatId = settingsObj.chat_id || -1002439956600;
      const autoSend = settingsObj.auto_send === '1';

      if (!autoSend) {
        return; // لا إرسال تلقائي
      }

      // تحديث حالة الإرسال
      db.run(`UPDATE scans SET telegram_status = 'sending', telegram_attempts = telegram_attempts + 1
              WHERE id = ?`, [scanId]);

      try {
        // إرسال إلى التليجرام
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
        
        // تحويل صورة base64 إلى blob
        const base64Data = imageDataUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        const FormData = require('form-data');
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('photo', buffer, { filename: `barcode_${scanId}.png` });
        form.append('caption', `📱 مسح الباركود\n🔢 ${barcode}\n⏰ ${new Date().toLocaleString('ar-IQ', { timeZone: 'Asia/Baghdad' })}`);

        const axios = require('axios');
        const response = await axios.post(telegramUrl, form, {
          headers: form.getHeaders(),
          timeout: 30000
        });

        if (response.data.ok) {
          // نجح الإرسال
          db.run(`UPDATE scans SET telegram_status = 'sent', telegram_last_attempt = CURRENT_TIMESTAMP
                  WHERE id = ?`, [scanId]);
          console.log(`✅ تم إرسال الباركود ${barcode} إلى التليجرام بنجاح`);
        } else {
          throw new Error(response.data.description || 'فشل الإرسال');
        }
      } catch (telegramError) {
        console.error('خطأ في إرسال التليجرام:', telegramError.message);
        
        // فشل الإرسال
        db.run(`UPDATE scans SET telegram_status = 'failed', telegram_error = ?, 
                telegram_last_attempt = CURRENT_TIMESTAMP WHERE id = ?`, 
                [telegramError.message, scanId]);
      }
    });
  } catch (error) {
    console.error('خطأ عام في إرسال التليجرام:', error);
  }
}

// ==================== Error Handling ====================

app.use((err, req, res, next) => {
  console.error('خطأ في الخادم:', err);
  res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم' });
});

// ==================== Server Startup ====================

app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  console.log(`🌐 الرابط: http://localhost:${PORT}`);
  console.log(`📊 قاعدة البيانات: ${dbPath}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  إيقاف الخادم...');
  db.close((err) => {
    if (err) {
      console.error('خطأ في إغلاق قاعدة البيانات:', err.message);
    } else {
      console.log('✅ تم إغلاق قاعدة البيانات');
    }
    process.exit(0);
  });
});

module.exports = app; 