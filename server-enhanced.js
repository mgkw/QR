const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد Middleware المحسن
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// تقديم الملفات الثابتة مع أولويات
app.use('/public', express.static('public'));
app.use(express.static('.', { 
    index: ['index.html']
}));

// إعداد قاعدة البيانات المحسن
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/tmp/database.db' 
    : path.join(__dirname, 'database.db');

let db;

// إنشاء اتصال قاعدة البيانات مع retry logic
function createDatabaseConnection() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
                reject(err);
            } else {
                console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
                resolve();
            }
        });
    });
}

// دالة مساعدة لتنفيذ الاستعلامات
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
}

// دالة مساعدة للحصول على بيانات
function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// دالة مساعدة للحصول على عدة صفوف
function getAllQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// تحديث الإحصائيات اليومية
async function updateDailyStats() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const stats = await getQuery(`
            SELECT 
                COUNT(*) as total_scans,
                COUNT(DISTINCT barcode) as unique_scans,
                SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END) as duplicate_scans,
                COUNT(DISTINCT user_id) as active_users,
                SUM(CASE WHEN code_type = 'QR Code' THEN 1 ELSE 0 END) as qr_scans,
                SUM(CASE WHEN code_type != 'QR Code' THEN 1 ELSE 0 END) as barcode_scans,
                SUM(CASE WHEN telegram_sent = 1 THEN 1 ELSE 0 END) as telegram_sent
            FROM scans 
            WHERE DATE(scan_time) = ?
        `, [today]);
        
        await runQuery(`
            INSERT OR REPLACE INTO system_stats 
            (date, total_scans, unique_scans, duplicate_scans, active_users, qr_scans, barcode_scans, telegram_sent, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            today,
            stats.total_scans || 0,
            stats.unique_scans || 0,
            stats.duplicate_scans || 0,
            stats.active_users || 0,
            stats.qr_scans || 0,
            stats.barcode_scans || 0,
            stats.telegram_sent || 0
        ]);
        
    } catch (error) {
        console.error('خطأ في تحديث الإحصائيات:', error);
    }
}

// تسجيل العمليات (audit logging)
async function logAction(action, tableName, recordId, userId, username, oldData = null, newData = null, req = null) {
    try {
        await runQuery(`
            INSERT INTO audit_log (action, table_name, record_id, user_id, username, old_data, new_data, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            action,
            tableName,
            recordId,
            userId,
            username,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            req ? (req.ip || req.connection.remoteAddress) : null,
            req ? req.get('User-Agent') : null
        ]);
    } catch (error) {
        console.error('خطأ في تسجيل العملية:', error);
    }
}

// تهيئة قاعدة البيانات المتقدمة
async function initDatabase() {
    console.log('🔧 تهيئة قاعدة البيانات المتقدمة...');
    
    try {
        // تفعيل Foreign Keys
        await runQuery('PRAGMA foreign_keys = ON');
        await runQuery('PRAGMA journal_mode = WAL');
        await runQuery('PRAGMA synchronous = NORMAL');
        
        // جدول المستخدمين المحسن
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
        
        // فهارس المستخدمين
        await runQuery('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
        await runQuery('CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)');
        
        // جدول المسحات المحسن
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
        
        // فهارس المسحات
        await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_barcode ON scans(barcode)');
        await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id)');
        await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_time ON scans(scan_time)');
        await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_duplicate ON scans(is_duplicate)');
        await runQuery('CREATE INDEX IF NOT EXISTS idx_scans_telegram ON scans(telegram_sent)');
        
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
        
        await runQuery('CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_date ON system_stats(date)');
        
        // جدول تسجيل العمليات (audit log)
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
        
        await runQuery('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)');
        await runQuery('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id)');
        
        // إضافة المستخدمين الافتراضيين المحسنين
        await runQuery(`
            INSERT OR IGNORE INTO users (username, password, full_name, is_admin, created_by) 
            VALUES ('admin', 'admin123', 'مدير النظام', 1, 'system')
        `);
        
        await runQuery(`
            INSERT OR IGNORE INTO users (username, full_name, is_admin, created_by) 
            VALUES ('guest', 'مستخدم ضيف', 0, 'system')
        `);
        
        // إضافة trigger لتحديث updated_at
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
        
        // تحديث إحصائيات اليوم
        await updateDailyStats();
        
        console.log('✅ تم تهيئة قاعدة البيانات المتقدمة بنجاح');
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة قاعدة البيانات:', error);
        throw error;
    }
}

// ==================== المسارات المحسنة ====================

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// صفحة بسيطة
app.get('/simple', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// تسجيل الدخول المحسن
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username) {
        return res.status(400).json({ 
            success: false, 
            message: 'اسم المستخدم مطلوب' 
        });
    }
    
    try {
        const user = await getQuery('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
        
        if (!user) {
            await logAction('LOGIN_FAILED', 'users', username, null, username, null, { reason: 'user_not_found' }, req);
            return res.status(404).json({ 
                success: false, 
                message: 'المستخدم غير موجود أو غير نشط' 
            });
        }
        
        // التحقق من كلمة المرور (إذا كانت موجودة)
        if (user.password && user.password !== password) {
            await logAction('LOGIN_FAILED', 'users', user.id, user.id, username, null, { reason: 'wrong_password' }, req);
            return res.status(401).json({ 
                success: false, 
                message: 'كلمة مرور خاطئة' 
            });
        }
        
        // تحديث معلومات تسجيل الدخول
        await runQuery(`
            UPDATE users 
            SET login_count = login_count + 1, last_login = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [user.id]);
        
        await logAction('LOGIN_SUCCESS', 'users', user.id, user.id, username, null, null, req);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                is_admin: Boolean(user.is_admin),
                login_count: user.login_count + 1
            }
        });
        
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في الخادم' 
        });
    }
});

// حفظ مسح جديد محسن
app.post('/api/scan', async (req, res) => {
    const { 
        barcode, 
        code_type, 
        raw_data,
        format,
        user_id, 
        username, 
        image_data, 
        scan_location,
        device_info,
        browser_info,
        notes 
    } = req.body;
    
    if (!barcode) {
        return res.status(400).json({ 
            success: false, 
            message: 'الباركود مطلوب' 
        });
    }
    
    try {
        const scanId = uuidv4();
        const scanTime = new Date().toISOString();
        
        // التحقق من التكرار
        const existingScan = await getQuery(`
            SELECT id, scan_time, username 
            FROM scans 
            WHERE barcode = ? 
            ORDER BY scan_time DESC 
            LIMIT 1
        `, [barcode]);
        
        let isDuplicate = false;
        let duplicateOf = null;
        
        if (existingScan) {
            const timeDiff = Date.now() - new Date(existingScan.scan_time).getTime();
            if (timeDiff < 20000) { // 20 seconds
                isDuplicate = true;
                duplicateOf = existingScan.id;
            }
        }
        
        // حساب حجم الصورة
        const imageSize = image_data ? Math.round(image_data.length * 0.75) : 0;
        
        const result = await runQuery(`
            INSERT INTO scans (
                id, barcode, code_type, raw_data, format, user_id, username, 
                image_data, image_size, scan_time, scan_location, device_info, 
                browser_info, notes, is_duplicate, duplicate_of
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            scanId, 
            barcode, 
            code_type || 'كود',
            raw_data,
            format,
            user_id, 
            username || 'guest', 
            image_data, 
            imageSize,
            scanTime,
            scan_location,
            device_info,
            browser_info,
            notes || '',
            isDuplicate ? 1 : 0,
            duplicateOf
        ]);
        
        await logAction('SCAN_CREATED', 'scans', scanId, user_id, username, null, {
            barcode,
            code_type,
            is_duplicate: isDuplicate
        }, req);
        
        // تحديث الإحصائيات
        await updateDailyStats();
        
        console.log(`✅ مسح جديد: ${barcode} بواسطة ${username} ${isDuplicate ? '(مكرر)' : ''}`);
        
        res.json({
            success: true,
            message: isDuplicate ? 'تم حفظ المسح المكرر' : 'تم حفظ المسح بنجاح',
            scan: {
                id: scanId,
                barcode,
                code_type: code_type || 'كود',
                username,
                scan_time: scanTime,
                is_duplicate: isDuplicate,
                duplicate_info: isDuplicate ? {
                    original_scan_time: existingScan.scan_time,
                    original_username: existingScan.username
                } : null
            }
        });
        
    } catch (error) {
        console.error('خطأ في حفظ المسح:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في حفظ المسح' 
        });
    }
});

// الحصول على قائمة المسحات المحسنة
app.get('/api/scans', async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const user_id = req.query.user_id;
    const start_date = req.query.start_date;
    const end_date = req.query.end_date;
    const include_duplicates = req.query.include_duplicates !== 'false';
    
    try {
        let whereClause = 'WHERE 1=1';
        let params = [];
        
        if (user_id) {
            whereClause += ' AND user_id = ?';
            params.push(user_id);
        }
        
        if (!include_duplicates) {
            whereClause += ' AND is_duplicate = 0';
        }
        
        if (start_date) {
            whereClause += ' AND DATE(scan_time) >= ?';
            params.push(start_date);
        }
        
        if (end_date) {
            whereClause += ' AND DATE(scan_time) <= ?';
            params.push(end_date);
        }
        
        params.push(limit, offset);
        
        const scans = await getAllQuery(`
            SELECT 
                id, barcode, code_type, username, scan_time, notes, 
                is_duplicate, telegram_sent, telegram_attempts,
                (SELECT COUNT(*) FROM scans s2 WHERE s2.barcode = scans.barcode) as duplicate_count
            FROM scans 
            ${whereClause}
            ORDER BY scan_time DESC 
            LIMIT ? OFFSET ?
        `, params);
        
        // حساب العدد الإجمالي
        const totalResult = await getQuery(`
            SELECT COUNT(*) as total FROM scans ${whereClause}
        `, params.slice(0, -2));
        
        res.json({
            success: true,
            scans: scans,
            pagination: {
                total: totalResult.total,
                limit: limit,
                offset: offset,
                has_more: (offset + limit) < totalResult.total
            }
        });
        
    } catch (error) {
        console.error('خطأ في جلب المسحات:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في جلب البيانات' 
        });
    }
});

// إحصائيات النظام المحسنة
app.get('/api/stats', async (req, res) => {
    try {
        const [userCount, scanStats, topUsers, topCodes, recentActivity] = await Promise.all([
            getQuery('SELECT COUNT(*) as count FROM users WHERE is_active = 1'),
            getQuery(`
                SELECT 
                    COUNT(*) as total_scans,
                    COUNT(DISTINCT barcode) as unique_codes,
                    SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END) as duplicate_scans,
                    SUM(CASE WHEN code_type = 'QR Code' THEN 1 ELSE 0 END) as qr_scans,
                    SUM(CASE WHEN code_type != 'QR Code' THEN 1 ELSE 0 END) as barcode_scans,
                    SUM(CASE WHEN telegram_sent = 1 THEN 1 ELSE 0 END) as telegram_sent,
                    COUNT(DISTINCT user_id) as active_users
                FROM scans
            `),
            getAllQuery(`
                SELECT username, COUNT(*) as scan_count 
                FROM scans 
                GROUP BY username 
                ORDER BY scan_count DESC 
                LIMIT 5
            `),
            getAllQuery(`
                SELECT barcode, COUNT(*) as scan_count, code_type
                FROM scans 
                GROUP BY barcode 
                HAVING scan_count > 1
                ORDER BY scan_count DESC 
                LIMIT 10
            `),
            getAllQuery(`
                SELECT DATE(scan_time) as date, COUNT(*) as count
                FROM scans 
                WHERE scan_time >= date('now', '-7 days')
                GROUP BY DATE(scan_time)
                ORDER BY date DESC
            `)
        ]);
        
        res.json({
            success: true,
            stats: {
                users: userCount.count,
                scans: scanStats.total_scans,
                unique_codes: scanStats.unique_codes,
                duplicate_scans: scanStats.duplicate_scans,
                qr_scans: scanStats.qr_scans,
                barcode_scans: scanStats.barcode_scans,
                telegram_sent: scanStats.telegram_sent,
                active_users: scanStats.active_users,
                database: 'SQLite Enhanced',
                version: '2.0'
            },
            top_users: topUsers,
            top_codes: topCodes,
            recent_activity: recentActivity
        });
        
    } catch (error) {
        console.error('خطأ في الإحصائيات:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في جلب الإحصائيات' 
        });
    }
});

// إحصائيات مفصلة للفترة
app.get('/api/stats/detailed', async (req, res) => {
    const { start_date, end_date, user_id } = req.query;
    
    try {
        let whereClause = 'WHERE 1=1';
        let params = [];
        
        if (start_date) {
            whereClause += ' AND DATE(scan_time) >= ?';
            params.push(start_date);
        }
        
        if (end_date) {
            whereClause += ' AND DATE(scan_time) <= ?';
            params.push(end_date);
        }
        
        if (user_id) {
            whereClause += ' AND user_id = ?';
            params.push(user_id);
        }
        
        const [stats, hourlyStats, userStats] = await Promise.all([
            getQuery(`
                SELECT 
                    COUNT(*) as total_scans,
                    COUNT(DISTINCT barcode) as unique_codes,
                    SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END) as duplicates,
                    COUNT(DISTINCT user_id) as active_users
                FROM scans ${whereClause}
            `, params),
            getAllQuery(`
                SELECT 
                    CAST(strftime('%H', scan_time) AS INTEGER) as hour,
                    COUNT(*) as count
                FROM scans ${whereClause}
                GROUP BY hour
                ORDER BY hour
            `, params),
            getAllQuery(`
                SELECT 
                    username,
                    COUNT(*) as scan_count,
                    COUNT(DISTINCT barcode) as unique_count
                FROM scans ${whereClause}
                GROUP BY username
                ORDER BY scan_count DESC
            `, params)
        ]);
        
        res.json({
            success: true,
            stats: stats,
            hourly_activity: hourlyStats,
            user_activity: userStats
        });
        
    } catch (error) {
        console.error('خطأ في الإحصائيات المفصلة:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في جلب الإحصائيات المفصلة' 
        });
    }
});

// المسحات المكررة
app.get('/api/duplicates', async (req, res) => {
    try {
        const duplicates = await getAllQuery(`
            SELECT 
                barcode,
                code_type,
                COUNT(*) as count,
                GROUP_CONCAT(username || ' (' || datetime(scan_time, '+3 hours') || ')') as scan_details,
                MIN(scan_time) as first_scan,
                MAX(scan_time) as last_scan
            FROM scans 
            GROUP BY barcode 
            HAVING count > 1
            ORDER BY count DESC, last_scan DESC
        `);
        
        res.json({
            success: true,
            duplicates: duplicates
        });
        
    } catch (error) {
        console.error('خطأ في جلب المكررات:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في جلب المكررات' 
        });
    }
});

// حذف مسح محسن
app.delete('/api/scan/:id', async (req, res) => {
    const scanId = req.params.id;
    
    try {
        // جلب بيانات المسح للتسجيل
        const scan = await getQuery('SELECT * FROM scans WHERE id = ?', [scanId]);
        
        if (!scan) {
            return res.status(404).json({ 
                success: false, 
                message: 'المسح غير موجود' 
            });
        }
        
        const result = await runQuery('DELETE FROM scans WHERE id = ?', [scanId]);
        
        if (result.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'المسح غير موجود' 
            });
        }
        
        await logAction('SCAN_DELETED', 'scans', scanId, null, 'admin', scan, null, req);
        await updateDailyStats();
        
        res.json({
            success: true,
            message: 'تم حذف المسح بنجاح'
        });
        
    } catch (error) {
        console.error('خطأ في حذف المسح:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في حذف المسح' 
        });
    }
});

// إدارة المستخدمين المحسنة
app.get('/api/users', async (req, res) => {
    try {
        const users = await getAllQuery(`
            SELECT 
                id, username, full_name, email, phone, is_admin, is_active,
                login_count, last_login, created_at, created_by,
                (SELECT COUNT(*) FROM scans WHERE user_id = users.id) as scan_count
            FROM users 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            users: users
        });
        
    } catch (error) {
        console.error('خطأ في جلب المستخدمين:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في جلب المستخدمين' 
        });
    }
});

// إضافة مستخدم جديد
app.post('/api/users', async (req, res) => {
    const { username, password, full_name, email, phone, is_admin, created_by } = req.body;
    
    if (!username) {
        return res.status(400).json({ 
            success: false, 
            message: 'اسم المستخدم مطلوب' 
        });
    }
    
    try {
        const result = await runQuery(`
            INSERT INTO users (username, password, full_name, email, phone, is_admin, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [username, password, full_name, email, phone, is_admin ? 1 : 0, created_by || 'admin']);
        
        await logAction('USER_CREATED', 'users', result.id, null, created_by || 'admin', null, {
            username, full_name, is_admin
        }, req);
        
        res.json({
            success: true,
            message: 'تم إضافة المستخدم بنجاح',
            user_id: result.id
        });
        
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ 
                success: false, 
                message: 'اسم المستخدم موجود بالفعل' 
            });
        } else {
            console.error('خطأ في إضافة المستخدم:', error);
            res.status(500).json({ 
                success: false, 
                message: 'خطأ في إضافة المستخدم' 
            });
        }
    }
});

// تحديث حالة إرسال التليجرام
app.put('/api/scan/:id/telegram', async (req, res) => {
    const scanId = req.params.id;
    const { sent, attempts, last_attempt } = req.body;
    
    try {
        await runQuery(`
            UPDATE scans 
            SET telegram_sent = ?, telegram_attempts = ?, telegram_last_attempt = ?
            WHERE id = ?
        `, [sent ? 1 : 0, attempts || 0, last_attempt, scanId]);
        
        res.json({
            success: true,
            message: 'تم تحديث حالة التليجرام'
        });
        
    } catch (error) {
        console.error('خطأ في تحديث التليجرام:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في تحديث التليجرام' 
        });
    }
});

// ============ APIs للجلسات والإعدادات (بدلاً من localStorage) ============

// إنشاء جلسة جديدة
app.post('/api/session', async (req, res) => {
    const { user_id, username, session_data, expires_in = 86400 } = req.body; // 24 hours default
    
    try {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString();
        
        await runQuery(`
            INSERT INTO user_sessions (id, user_id, username, session_data, expires_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            sessionId,
            user_id,
            username,
            JSON.stringify(session_data || {}),
            expiresAt,
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        ]);
        
        res.json({
            success: true,
            session_id: sessionId,
            expires_at: expiresAt
        });
        
    } catch (error) {
        console.error('خطأ في إنشاء الجلسة:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في إنشاء الجلسة' 
        });
    }
});

// الحصول على بيانات الجلسة
app.get('/api/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const session = await getQuery(`
            SELECT * FROM user_sessions 
            WHERE id = ? AND expires_at > datetime('now') AND is_active = 1
        `, [sessionId]);
        
        if (!session) {
            return res.status(404).json({ 
                success: false, 
                message: 'الجلسة غير موجودة أو منتهية الصلاحية' 
            });
        }
        
        // تحديث وقت الوصول
        await runQuery(`
            UPDATE user_sessions 
            SET last_accessed = datetime('now') 
            WHERE id = ?
        `, [sessionId]);
        
        res.json({
            success: true,
            session: {
                id: session.id,
                user_id: session.user_id,
                username: session.username,
                session_data: JSON.parse(session.session_data || '{}'),
                expires_at: session.expires_at,
                last_accessed: session.last_accessed
            }
        });
        
    } catch (error) {
        console.error('خطأ في جلب الجلسة:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في جلب الجلسة' 
        });
    }
});

// تحديث بيانات الجلسة
app.put('/api/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { session_data } = req.body;
    
    try {
        const result = await runQuery(`
            UPDATE user_sessions 
            SET session_data = ?, last_accessed = datetime('now')
            WHERE id = ? AND expires_at > datetime('now') AND is_active = 1
        `, [JSON.stringify(session_data), sessionId]);
        
        if (result.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'الجلسة غير موجودة أو منتهية الصلاحية' 
            });
        }
        
        res.json({
            success: true,
            message: 'تم تحديث الجلسة بنجاح'
        });
        
    } catch (error) {
        console.error('خطأ في تحديث الجلسة:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في تحديث الجلسة' 
        });
    }
});

// إنهاء الجلسة (logout)
app.delete('/api/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        await runQuery(`
            UPDATE user_sessions 
            SET is_active = 0 
            WHERE id = ?
        `, [sessionId]);
        
        res.json({
            success: true,
            message: 'تم إنهاء الجلسة بنجاح'
        });
        
    } catch (error) {
        console.error('خطأ في إنهاء الجلسة:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في إنهاء الجلسة' 
        });
    }
});

// حفظ إعداد مستخدم
app.post('/api/settings', async (req, res) => {
    const { user_id, setting_key, setting_value, setting_type = 'string' } = req.body;
    
    if (!user_id || !setting_key) {
        return res.status(400).json({ 
            success: false, 
            message: 'user_id و setting_key مطلوبان' 
        });
    }
    
    try {
        await runQuery(`
            INSERT OR REPLACE INTO user_settings (user_id, setting_key, setting_value, setting_type, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `, [user_id, setting_key, setting_value, setting_type]);
        
        res.json({
            success: true,
            message: 'تم حفظ الإعداد بنجاح'
        });
        
    } catch (error) {
        console.error('خطأ في حفظ الإعداد:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في حفظ الإعداد' 
        });
    }
});

// الحصول على إعداد مستخدم
app.get('/api/settings/:userId/:settingKey', async (req, res) => {
    const { userId, settingKey } = req.params;
    
    try {
        const setting = await getQuery(`
            SELECT * FROM user_settings 
            WHERE user_id = ? AND setting_key = ?
        `, [userId, settingKey]);
        
        if (!setting) {
            return res.status(404).json({ 
                success: false, 
                message: 'الإعداد غير موجود' 
            });
        }
        
        res.json({
            success: true,
            setting: {
                key: setting.setting_key,
                value: setting.setting_value,
                type: setting.setting_type,
                updated_at: setting.updated_at
            }
        });
        
    } catch (error) {
        console.error('خطأ في جلب الإعداد:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في جلب الإعداد' 
        });
    }
});

// الحصول على جميع إعدادات المستخدم
app.get('/api/settings/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const settings = await getAllQuery(`
            SELECT setting_key, setting_value, setting_type, updated_at
            FROM user_settings 
            WHERE user_id = ?
            ORDER BY setting_key
        `, [userId]);
        
        const settingsObject = {};
        settings.forEach(setting => {
            settingsObject[setting.setting_key] = {
                value: setting.setting_value,
                type: setting.setting_type,
                updated_at: setting.updated_at
            };
        });
        
        res.json({
            success: true,
            settings: settingsObject
        });
        
    } catch (error) {
        console.error('خطأ في جلب الإعدادات:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في جلب الإعدادات' 
        });
    }
});

// حذف إعداد مستخدم
app.delete('/api/settings/:userId/:settingKey', async (req, res) => {
    const { userId, settingKey } = req.params;
    
    try {
        const result = await runQuery(`
            DELETE FROM user_settings 
            WHERE user_id = ? AND setting_key = ?
        `, [userId, settingKey]);
        
        if (result.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'الإعداد غير موجود' 
            });
        }
        
        res.json({
            success: true,
            message: 'تم حذف الإعداد بنجاح'
        });
        
    } catch (error) {
        console.error('خطأ في حذف الإعداد:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في حذف الإعداد' 
        });
    }
});

// تنظيف الجلسات منتهية الصلاحية
app.post('/api/cleanup-sessions', async (req, res) => {
    try {
        const result = await runQuery(`
            DELETE FROM user_sessions 
            WHERE expires_at < datetime('now') OR is_active = 0
        `);
        
        res.json({
            success: true,
            message: `تم حذف ${result.changes} جلسة منتهية الصلاحية`
        });
        
    } catch (error) {
        console.error('خطأ في تنظيف الجلسات:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في تنظيف الجلسات' 
        });
    }
});

// فحص صحة النظام المحسن
app.get('/api/health', async (req, res) => {
    try {
        // اختبار قاعدة البيانات
        const dbTest = await getQuery('SELECT COUNT(*) as count FROM users');
        const sessionCount = await getQuery('SELECT COUNT(*) as count FROM user_sessions WHERE is_active = 1');
        
        res.json({
            success: true,
            status: 'healthy',
            database: 'SQLite Enhanced with Sessions',
            server: 'Node.js + Express',
            users: dbTest.count,
            active_sessions: sessionCount.count,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// معالجة 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'المسار غير موجود',
        path: req.path
    });
});

// معالجة الأخطاء المحسنة
app.use((err, req, res, next) => {
    console.error('خطأ في الخادم:', err);
    
    // تسجيل الخطأ
    logAction('SERVER_ERROR', null, null, null, 'system', null, {
        error: err.message,
        stack: err.stack,
        path: req.path
    }, req).catch(console.error);
    
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
            ? 'خطأ داخلي في الخادم' 
            : err.message,
        timestamp: new Date().toISOString()
    });
});

// تشغيل الخادم
async function startServer() {
    try {
        await createDatabaseConnection();
        await initDatabase();
        
        const server = app.listen(PORT, () => {
            console.log('\n🌟 قارئ الباركود المتطور - Node.js + SQLite Enhanced');
            console.log('=' .repeat(60));
            console.log(`🌐 الخادم يعمل على: http://localhost:${PORT}`);
            console.log(`🗄️  قاعدة البيانات: ${dbPath}`);
            console.log('📊 قاعدة البيانات: SQLite Enhanced');
            console.log('⚡ المحرك: Node.js + Express');
            console.log('🔧 البيئة:', process.env.NODE_ENV || 'development');
            console.log('👥 حسابات التجربة:');
            console.log('   📱 المدير: admin / admin123');
            console.log('   👤 ضيف: guest');
            console.log('🔗 الصفحات:');
            console.log(`   📱 متطورة: http://localhost:${PORT}/`);
            console.log(`   🔧 بسيطة: http://localhost:${PORT}/simple`);
            console.log(`   ⚕️ الصحة: http://localhost:${PORT}/api/health`);
            console.log('⏹️  اضغط Ctrl+C للإيقاف\n');
        });
        
        // إغلاق نظيف
        process.on('SIGINT', () => {
            console.log('\n🛑 إيقاف الخادم...');
            server.close(() => {
                db.close((err) => {
                    if (err) {
                        console.error('خطأ في إغلاق قاعدة البيانات:', err);
                    } else {
                        console.log('✅ تم إغلاق قاعدة البيانات');
                    }
                    process.exit(0);
                });
            });
        });
        
        // تحديث الإحصائيات كل ساعة
        setInterval(updateDailyStats, 60 * 60 * 1000);
        
    } catch (error) {
        console.error('❌ فشل في تشغيل الخادم:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
