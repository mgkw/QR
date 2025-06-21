#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔄 بدء ترقية قاعدة البيانات...');

const dbPath = path.join(__dirname, '..', 'database.db');

if (!fs.existsSync(dbPath)) {
    console.error('❌ قاعدة البيانات غير موجودة. يرجى تشغيل: npm run init-db');
    process.exit(1);
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
        name: 'إضافة حقول المستخدم المتقدمة',
        run: async () => {
            // التحقق من وجود الحقول الجديدة
            const tableInfo = await getAllQuery("PRAGMA table_info(users)");
            const existingColumns = tableInfo.map(col => col.name);
            
            if (!existingColumns.includes('full_name')) {
                await runQuery('ALTER TABLE users ADD COLUMN full_name TEXT');
                console.log('   ✅ تم إضافة حقل full_name');
            }
            
            if (!existingColumns.includes('email')) {
                await runQuery('ALTER TABLE users ADD COLUMN email TEXT');
                console.log('   ✅ تم إضافة حقل email');
            }
            
            if (!existingColumns.includes('phone')) {
                await runQuery('ALTER TABLE users ADD COLUMN phone TEXT');
                console.log('   ✅ تم إضافة حقل phone');
            }
            
            if (!existingColumns.includes('is_active')) {
                await runQuery('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1');
                console.log('   ✅ تم إضافة حقل is_active');
            }
            
            if (!existingColumns.includes('login_count')) {
                await runQuery('ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0');
                console.log('   ✅ تم إضافة حقل login_count');
            }
            
            if (!existingColumns.includes('last_login')) {
                await runQuery('ALTER TABLE users ADD COLUMN last_login DATETIME');
                console.log('   ✅ تم إضافة حقل last_login');
            }
            
            if (!existingColumns.includes('created_by')) {
                await runQuery('ALTER TABLE users ADD COLUMN created_by TEXT');
                console.log('   ✅ تم إضافة حقل created_by');
            }
            
            if (!existingColumns.includes('updated_at')) {
                await runQuery('ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
                console.log('   ✅ تم إضافة حقل updated_at');
            }
        }
    },
    {
        version: 2,
        name: 'إضافة حقول المسحات المتقدمة',
        run: async () => {
            const tableInfo = await getAllQuery("PRAGMA table_info(scans)");
            const existingColumns = tableInfo.map(col => col.name);
            
            if (!existingColumns.includes('raw_data')) {
                await runQuery('ALTER TABLE scans ADD COLUMN raw_data TEXT');
                console.log('   ✅ تم إضافة حقل raw_data');
            }
            
            if (!existingColumns.includes('format')) {
                await runQuery('ALTER TABLE scans ADD COLUMN format TEXT');
                console.log('   ✅ تم إضافة حقل format');
            }
            
            if (!existingColumns.includes('image_size')) {
                await runQuery('ALTER TABLE scans ADD COLUMN image_size INTEGER');
                console.log('   ✅ تم إضافة حقل image_size');
            }
            
            if (!existingColumns.includes('scan_location')) {
                await runQuery('ALTER TABLE scans ADD COLUMN scan_location TEXT');
                console.log('   ✅ تم إضافة حقل scan_location');
            }
            
            if (!existingColumns.includes('device_info')) {
                await runQuery('ALTER TABLE scans ADD COLUMN device_info TEXT');
                console.log('   ✅ تم إضافة حقل device_info');
            }
            
            if (!existingColumns.includes('browser_info')) {
                await runQuery('ALTER TABLE scans ADD COLUMN browser_info TEXT');
                console.log('   ✅ تم إضافة حقل browser_info');
            }
            
            if (!existingColumns.includes('is_duplicate')) {
                await runQuery('ALTER TABLE scans ADD COLUMN is_duplicate BOOLEAN DEFAULT 0');
                console.log('   ✅ تم إضافة حقل is_duplicate');
            }
            
            if (!existingColumns.includes('duplicate_of')) {
                await runQuery('ALTER TABLE scans ADD COLUMN duplicate_of TEXT');
                console.log('   ✅ تم إضافة حقل duplicate_of');
            }
            
            if (!existingColumns.includes('telegram_sent')) {
                await runQuery('ALTER TABLE scans ADD COLUMN telegram_sent BOOLEAN DEFAULT 0');
                console.log('   ✅ تم إضافة حقل telegram_sent');
            }
            
            if (!existingColumns.includes('telegram_attempts')) {
                await runQuery('ALTER TABLE scans ADD COLUMN telegram_attempts INTEGER DEFAULT 0');
                console.log('   ✅ تم إضافة حقل telegram_attempts');
            }
            
            if (!existingColumns.includes('telegram_last_attempt')) {
                await runQuery('ALTER TABLE scans ADD COLUMN telegram_last_attempt DATETIME');
                console.log('   ✅ تم إضافة حقل telegram_last_attempt');
            }
            
            if (!existingColumns.includes('created_at')) {
                await runQuery('ALTER TABLE scans ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
                console.log('   ✅ تم إضافة حقل created_at');
            }
            
            if (!existingColumns.includes('updated_at')) {
                await runQuery('ALTER TABLE scans ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
                console.log('   ✅ تم إضافة حقل updated_at');
            }
        }
    },
    {
        version: 3,
        name: 'إنشاء جدول إحصائيات النظام',
        run: async () => {
            // التحقق من وجود الجدول
            const tableExists = await getQuery(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='system_stats'
            `);
            
            if (!tableExists) {
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
                console.log('   ✅ تم إنشاء جدول system_stats');
            }
        }
    },
    {
        version: 4,
        name: 'إنشاء جدول تسجيل العمليات',
        run: async () => {
            // التحقق من وجود الجدول
            const tableExists = await getQuery(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='audit_log'
            `);
            
            if (!tableExists) {
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
                console.log('   ✅ تم إنشاء جدول audit_log');
            }
        }
    },
    {
        version: 5,
        name: 'إضافة فهارس متقدمة',
        run: async () => {
            // إضافة فهارس إضافية للأداء
            try {
                await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_barcode ON scans(barcode)');
                await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id)');
                await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_time ON scans(scan_time)');
                await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_duplicate ON scans(is_duplicate)');
                await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_telegram ON scans(telegram_sent)');
                await runQuery('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
                await runQuery('CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)');
                console.log('   ✅ تم إضافة الفهارس المتقدمة');
            } catch (err) {
                console.log('   ⚠️ بعض الفهارس موجودة بالفعل');
            }
        }
    },
    {
        version: 6,
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
                
                console.log('   ✅ تم إضافة triggers التحديث التلقائي');
            } catch (err) {
                console.log('   ⚠️ Triggers موجودة بالفعل');
            }
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
        const executedMigrations = await getAllQuery('SELECT version FROM migrations');
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
        
        // تحديث البيانات الموجودة
        console.log('🔄 تحديث البيانات الموجودة...');
        
        // تحديث أسماء المستخدمين الافتراضيين
        const adminUser = await getQuery('SELECT * FROM users WHERE username = ?', ['admin']);
        if (adminUser && !adminUser.full_name) {
            await runQuery('UPDATE users SET full_name = ?, created_by = ? WHERE username = ?', 
                ['مدير النظام', 'system', 'admin']);
            console.log('   ✅ تم تحديث بيانات المدير');
        }
        
        const guestUser = await getQuery('SELECT * FROM users WHERE username = ?', ['guest']);
        if (guestUser && !guestUser.full_name) {
            await runQuery('UPDATE users SET full_name = ?, created_by = ? WHERE username = ?', 
                ['مستخدم ضيف', 'system', 'guest']);
            console.log('   ✅ تم تحديث بيانات الضيف');
        }
        
        // إحصائيات نهائية
        console.log('\n📊 إحصائيات قاعدة البيانات بعد الترقية:');
        
        const userCount = await getQuery('SELECT COUNT(*) as count FROM users');
        const scanCount = await getQuery('SELECT COUNT(*) as count FROM scans');
        const tableCount = await getQuery(`
            SELECT COUNT(*) as count 
            FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `);
        
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