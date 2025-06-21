#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔄 بدء ترقية قاعدة البيانات...');

const dbPath = process.env.NODE_ENV === 'production' 
    ? '/tmp/database.db' 
    : path.join(__dirname, '..', 'database.db');

// إنشاء قاعدة البيانات إذا لم تكن موجودة
if (!fs.existsSync(dbPath)) {
    console.log('⚠️ قاعدة البيانات غير موجودة، جاري الإنشاء...');
    // سنقوم بإنشاء قاعدة بيانات جديدة
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
        process.exit(1);
    } else {
        console.log('✅ تم الاتصال بقاعدة البيانات');
    }
});

// دوال مساعدة
const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
};

const getQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

const getAllQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// ترقيات قاعدة البيانات
const migrations = [
    {
        version: 1,
        name: 'إنشاء الجداول الأساسية',
        run: async () => {
            // جدول المستخدمين
            await runQuery(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT,
                    full_name TEXT,
                    email TEXT,
                    phone TEXT,
                    is_admin BOOLEAN DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    login_count INTEGER DEFAULT 0,
                    last_login DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_by TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // جدول المسحات
            await runQuery(`
                CREATE TABLE IF NOT EXISTS scans (
                    id TEXT PRIMARY KEY,
                    barcode TEXT NOT NULL,
                    code_type TEXT DEFAULT 'كود',
                    raw_data TEXT,
                    format TEXT,
                    user_id INTEGER,
                    username TEXT NOT NULL,
                    image_data TEXT,
                    image_size INTEGER,
                    scan_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    scan_location TEXT,
                    device_info TEXT,
                    browser_info TEXT,
                    notes TEXT,
                    is_duplicate BOOLEAN DEFAULT 0,
                    duplicate_of TEXT,
                    telegram_sent BOOLEAN DEFAULT 0,
                    telegram_attempts INTEGER DEFAULT 0,
                    telegram_last_attempt DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    FOREIGN KEY (duplicate_of) REFERENCES scans (id)
                )
            `);
            
            // جدول إحصائيات النظام
            await runQuery(`
                CREATE TABLE IF NOT EXISTS system_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date DATE NOT NULL,
                    total_scans INTEGER DEFAULT 0,
                    unique_scans INTEGER DEFAULT 0,
                    duplicate_scans INTEGER DEFAULT 0,
                    active_users INTEGER DEFAULT 0,
                    qr_scans INTEGER DEFAULT 0,
                    barcode_scans INTEGER DEFAULT 0,
                    telegram_sent INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // جدول تسجيل العمليات
            await runQuery(`
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action TEXT NOT NULL,
                    table_name TEXT,
                    record_id TEXT,
                    user_id INTEGER,
                    username TEXT,
                    old_data TEXT,
                    new_data TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            `);
            
            // جدول الجلسات (بدلاً من localStorage)
            await runQuery(`
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    session_data TEXT,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ip_address TEXT,
                    user_agent TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            `);
            
            // جدول الإعدادات (بدلاً من localStorage)
            await runQuery(`
                CREATE TABLE IF NOT EXISTS user_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    setting_key TEXT NOT NULL,
                    setting_value TEXT,
                    setting_type TEXT DEFAULT 'string',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(user_id, setting_key)
                )
            `);
            
            console.log('   ✅ تم إنشاء الجداول الأساسية');
        }
    },
    {
        version: 2,
        name: 'إضافة الفهارس المحسنة',
        run: async () => {
            // فهارس المستخدمين
            await runQuery('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
            await runQuery('CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)');
            
            // فهارس المسحات
            await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_barcode ON scans(barcode)');
            await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id)');
            await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_time ON scans(scan_time)');
            await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_duplicate ON scans(is_duplicate)');
            await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_telegram ON scans(telegram_sent)');
            
            // فهارس الإحصائيات
            await runQuery('CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_date ON system_stats(date)');
            
            // فهارس العمليات
            await runQuery('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)');
            await runQuery('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id)');
            
            // فهارس الجلسات
            await runQuery('CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id)');
            await runQuery('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at)');
            await runQuery('CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active)');
            
            // فهارس الإعدادات
            await runQuery('CREATE INDEX IF NOT EXISTS idx_settings_user ON user_settings(user_id)');
            await runQuery('CREATE INDEX IF NOT EXISTS idx_settings_key ON user_settings(setting_key)');
            
            console.log('   ✅ تم إضافة الفهارس المحسنة');
        }
    },
    {
        version: 3,
        name: 'إضافة المستخدمين الافتراضيين',
        run: async () => {
            // إضافة المستخدمين الافتراضيين
            await runQuery(`
                INSERT OR IGNORE INTO users (username, password, full_name, is_admin, created_by) 
                VALUES ('admin', 'admin123', 'مدير النظام', 1, 'system')
            `);
            
            await runQuery(`
                INSERT OR IGNORE INTO users (username, full_name, is_admin, created_by) 
                VALUES ('guest', 'مستخدم ضيف', 0, 'system')
            `);
            
            console.log('   ✅ تم إضافة المستخدمين الافتراضيين');
        }
    },
    {
        version: 4,
        name: 'إضافة Triggers للتحديث التلقائي',
        run: async () => {
            try {
                await runQuery(`
                    CREATE TRIGGER IF NOT EXISTS users_updated_at 
                    AFTER UPDATE ON users 
                    BEGIN 
                        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END
                `);
                
                await runQuery(`
                    CREATE TRIGGER IF NOT EXISTS scans_updated_at 
                    AFTER UPDATE ON scans 
                    BEGIN 
                        UPDATE scans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END
                `);
                
                // Trigger لتحديث الإحصائيات
                await runQuery(`
                    CREATE TRIGGER IF NOT EXISTS update_stats_after_scan
                    AFTER INSERT ON scans
                    BEGIN
                        INSERT OR REPLACE INTO system_stats (id, date, total_scans, unique_scans, duplicate_scans)
                        VALUES (
                            1,
                            date('now'),
                            (SELECT COUNT(*) FROM scans),
                            (SELECT COUNT(*) FROM scans WHERE is_duplicate = 0),
                            (SELECT COUNT(*) FROM scans WHERE is_duplicate = 1)
                        );
                    END
                `);
                
                // Trigger لتنظيف الجلسات منتهية الصلاحية
                await runQuery(`
                    CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions
                    BEFORE INSERT ON user_sessions
                    BEGIN
                        DELETE FROM user_sessions 
                        WHERE expires_at < datetime('now') 
                        OR is_active = 0;
                    END
                `);
                
                // Trigger لتحديث وقت الوصول للجلسة
                await runQuery(`
                    CREATE TRIGGER IF NOT EXISTS update_session_access
                    AFTER UPDATE ON user_settings
                    BEGIN
                        UPDATE user_settings SET
                            updated_at = datetime('now')
                        WHERE id = NEW.id;
                    END
                `);
                
                console.log('   ✅ تم إضافة triggers التحديث التلقائي');
            } catch (err) {
                console.log('   ⚠️ Triggers موجودة بالفعل');
            }
        }
    },
    {
        version: 5,
        name: 'تفعيل إعدادات قاعدة البيانات المتقدمة',
        run: async () => {
            // تفعيل Foreign Keys
            await runQuery('PRAGMA foreign_keys = ON');
            await runQuery('PRAGMA journal_mode = WAL');
            await runQuery('PRAGMA synchronous = NORMAL');
            
            console.log('   ✅ تم تفعيل إعدادات قاعدة البيانات المتقدمة');
        }
    }
];

// تشغيل الترقيات
async function runMigrations() {
    try {
        // إنشاء جدول الترقيات إذا لم يكن موجوداً
        await runQuery(`
            CREATE TABLE IF NOT EXISTS migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // الحصول على الترقيات المنجزة
        const executedMigrations = await getAllQuery('SELECT version FROM migrations').catch(() => []);
        const executedVersions = executedMigrations.map(m => m.version);
        
        console.log(`📊 الترقيات المنجزة: ${executedVersions.length}`);
        
        // تشغيل الترقيات الجديدة
        for (const migration of migrations) {
            if (!executedVersions.includes(migration.version)) {
                console.log(`🔄 تشغيل الترقية ${migration.version}: ${migration.name}`);
                
                try {
                    await migration.run();
                    
                    // تسجيل الترقية كمنجزة
                    await runQuery(
                        'INSERT INTO migrations (version, name) VALUES (?, ?)',
                        [migration.version, migration.name]
                    );
                    
                    console.log(`   ✅ تمت الترقية ${migration.version} بنجاح`);
                } catch (err) {
                    console.error(`   ❌ فشلت الترقية ${migration.version}:`, err.message);
                    throw err;
                }
            } else {
                console.log(`   ⏭️ الترقية ${migration.version} منجزة مسبقاً`);
            }
        }
        
        // إحصائيات نهائية
        console.log('\n📊 إحصائيات قاعدة البيانات بعد الترقية:');
        
        const userCount = await getQuery('SELECT COUNT(*) as count FROM users').catch(() => ({ count: 0 }));
        const scanCount = await getQuery('SELECT COUNT(*) as count FROM scans').catch(() => ({ count: 0 }));
        const tableCount = await getQuery(`
            SELECT COUNT(*) as count 
            FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `).catch(() => ({ count: 0 }));
        
        console.log(`   👥 المستخدمين: ${userCount.count}`);
        console.log(`   📱 المسحات: ${scanCount.count}`);
        console.log(`   📊 الجداول: ${tableCount.count}`);
        
        console.log('\n🌟 تم إنجاز جميع الترقيات بنجاح!');
        
    } catch (error) {
        console.error('❌ خطأ في ترقية قاعدة البيانات:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

runMigrations(); 