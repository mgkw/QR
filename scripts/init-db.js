#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔧 بدء تهيئة قاعدة البيانات...');

// إنشاء مجلد scripts إذا لم يكن موجوداً
const scriptsDir = path.dirname(__filename);
if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
}

const dbPath = path.join(__dirname, '..', 'database.db');

// حذف قاعدة البيانات القديمة إذا كانت موجودة
if (fs.existsSync(dbPath)) {
    console.log('🗑️ حذف قاعدة البيانات القديمة...');
    fs.unlinkSync(dbPath);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ خطأ في إنشاء قاعدة البيانات:', err.message);
        process.exit(1);
    } else {
        console.log('✅ تم إنشاء قاعدة البيانات الجديدة');
    }
});

// تهيئة قاعدة البيانات
async function initializeDatabase() {
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

    try {
        // تفعيل Foreign Keys
        await runQuery('PRAGMA foreign_keys = ON');
        await runQuery('PRAGMA journal_mode = WAL');
        await runQuery('PRAGMA synchronous = NORMAL');
        
        console.log('📊 إنشاء الجداول...');
        
        // جدول المستخدمين
        await runQuery(`
            CREATE TABLE users (
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
        
        // فهارس المستخدمين
        await runQuery('CREATE INDEX idx_users_username ON users(username)');
        await runQuery('CREATE INDEX idx_users_active ON users(is_active)');
        
        // جدول المسحات
        await runQuery(`
            CREATE TABLE scans (
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
        
        // فهارس المسحات
        await runQuery('CREATE INDEX idx_scans_barcode ON scans(barcode)');
        await runQuery('CREATE INDEX idx_scans_user ON scans(user_id)');
        await runQuery('CREATE INDEX idx_scans_time ON scans(scan_time)');
        await runQuery('CREATE INDEX idx_scans_duplicate ON scans(is_duplicate)');
        await runQuery('CREATE INDEX idx_scans_telegram ON scans(telegram_sent)');
        
        // جدول إحصائيات النظام
        await runQuery(`
            CREATE TABLE system_stats (
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
        
        await runQuery('CREATE UNIQUE INDEX idx_stats_date ON system_stats(date)');
        
        // جدول تسجيل العمليات
        await runQuery(`
            CREATE TABLE audit_log (
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
        
        await runQuery('CREATE INDEX idx_audit_timestamp ON audit_log(timestamp)');
        await runQuery('CREATE INDEX idx_audit_user ON audit_log(user_id)');
        
        console.log('👥 إضافة المستخدمين الافتراضيين...');
        
        // إضافة المستخدمين الافتراضيين
        await runQuery(`
            INSERT INTO users (username, password, full_name, is_admin, created_by) 
            VALUES ('admin', 'admin123', 'مدير النظام', 1, 'system')
        `);
        
        await runQuery(`
            INSERT INTO users (username, full_name, is_admin, created_by) 
            VALUES ('guest', 'مستخدم ضيف', 0, 'system')
        `);
        
        // إضافة triggers
        await runQuery(`
            CREATE TRIGGER users_updated_at 
            AFTER UPDATE ON users 
            BEGIN 
                UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `);
        
        await runQuery(`
            CREATE TRIGGER scans_updated_at 
            AFTER UPDATE ON scans 
            BEGIN 
                UPDATE scans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `);
        
        console.log('✅ تم إنشاء جميع الجداول والفهارس بنجاح');
        console.log('📊 إحصائيات قاعدة البيانات:');
        
        // عرض إحصائيات
        const getQuery = (sql) => {
            return new Promise((resolve, reject) => {
                db.get(sql, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        };
        
        const userCount = await getQuery('SELECT COUNT(*) as count FROM users');
        console.log(`   👥 المستخدمين: ${userCount.count}`);
        
        const tableCount = await getQuery(`
            SELECT COUNT(*) as count 
            FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `);
        console.log(`   📊 الجداول: ${tableCount.count}`);
        
        const indexCount = await getQuery(`
            SELECT COUNT(*) as count 
            FROM sqlite_master 
            WHERE type='index' AND name NOT LIKE 'sqlite_%'
        `);
        console.log(`   🔍 الفهارس: ${indexCount.count}`);
        
        console.log('\n🌟 تم تهيئة قاعدة البيانات بنجاح!');
        console.log('🔗 يمكنك الآن تشغيل الخادم بـ: npm start');
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة قاعدة البيانات:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

initializeDatabase();
