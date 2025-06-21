const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// إعداد قاعدة البيانات
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// تهيئة قاعدة البيانات
function initDatabase() {
    console.log('🔧 تهيئة قاعدة البيانات...');
    
    // جدول المستخدمين
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT,
            is_admin BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // جدول المسحات
    db.run(`
        CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY,
            barcode TEXT NOT NULL,
            code_type TEXT DEFAULT 'كود',
            user_id INTEGER,
            username TEXT NOT NULL,
            image_data TEXT,
            scan_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);
    
    // إضافة المستخدمين الافتراضيين
    db.run(`
        INSERT OR IGNORE INTO users (username, password, is_admin) 
        VALUES ('admin', 'admin123', 1)
    `);
    
    db.run(`
        INSERT OR IGNORE INTO users (username, is_admin) 
        VALUES ('guest', 0)
    `, (err) => {
        if (err) {
            console.error('❌ خطأ في إنشاء المستخدمين:', err);
        } else {
            console.log('✅ تم تهيئة قاعدة البيانات بنجاح');
        }
    });
}

// ==================== المسارات (Routes) ====================

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username) {
        return res.status(400).json({ 
            success: false, 
            message: 'اسم المستخدم مطلوب' 
        });
    }
    
    db.get(
        'SELECT * FROM users WHERE username = ?', 
        [username], 
        (err, user) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'خطأ في الخادم' 
                });
            }
            
            if (!user) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'المستخدم غير موجود' 
                });
            }
            
            // التحقق من كلمة المرور (إذا كانت موجودة)
            if (user.password && user.password !== password) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'كلمة مرور خاطئة' 
                });
            }
            
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    is_admin: Boolean(user.is_admin)
                }
            });
        }
    );
});

// حفظ مسح جديد
app.post('/api/scan', (req, res) => {
    const { barcode, code_type, user_id, username, image_data, notes } = req.body;
    
    if (!barcode) {
        return res.status(400).json({ 
            success: false, 
            message: 'الباركود مطلوب' 
        });
    }
    
    const scanId = uuidv4();
    
    db.run(
        `INSERT INTO scans (id, barcode, code_type, user_id, username, image_data, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [scanId, barcode, code_type || 'كود', user_id, username || 'guest', image_data, notes || ''],
        function(err) {
            if (err) {
                console.error('خطأ في حفظ المسح:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: 'خطأ في حفظ المسح' 
                });
            }
            
            console.log(`✅ مسح جديد: ${barcode} بواسطة ${username}`);
            
            res.json({
                success: true,
                message: 'تم حفظ المسح بنجاح',
                scan: {
                    id: scanId,
                    barcode,
                    code_type,
                    username,
                    scan_time: new Date().toISOString()
                }
            });
        }
    );
});

// الحصول على قائمة المسحات
app.get('/api/scans', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    db.all(
        `SELECT * FROM scans 
         ORDER BY scan_time DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, scans) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'خطأ في جلب البيانات' 
                });
            }
            
            res.json({
                success: true,
                scans: scans
            });
        }
    );
});

// إحصائيات النظام
app.get('/api/stats', (req, res) => {
    const queries = [
        'SELECT COUNT(*) as count FROM users',
        'SELECT COUNT(*) as count FROM scans',
        'SELECT COUNT(DISTINCT barcode) as count FROM scans'
    ];
    
    Promise.all(queries.map(query => 
        new Promise((resolve, reject) => {
            db.get(query, (err, result) => {
                if (err) reject(err);
                else resolve(result.count);
            });
        })
    )).then(([userCount, scanCount, uniqueCodes]) => {
        res.json({
            success: true,
            stats: {
                users: userCount,
                scans: scanCount,
                unique_codes: uniqueCodes,
                database: 'SQLite',
                version: '1.0'
            }
        });
    }).catch(err => {
        console.error('خطأ في الإحصائيات:', err);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في جلب الإحصائيات' 
        });
    });
});

// حذف مسح
app.delete('/api/scan/:id', (req, res) => {
    const scanId = req.params.id;
    
    db.run(
        'DELETE FROM scans WHERE id = ?',
        [scanId],
        function(err) {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'خطأ في حذف المسح' 
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'المسح غير موجود' 
                });
            }
            
            res.json({
                success: true,
                message: 'تم حذف المسح بنجاح'
            });
        }
    );
});

// فحص صحة النظام
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        database: 'SQLite',
        server: 'Node.js + Express',
        timestamp: new Date().toISOString()
    });
});

// معالجة 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'المسار غير موجود'
    });
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
    console.error('خطأ في الخادم:', err);
    res.status(500).json({
        success: false,
        message: 'خطأ داخلي في الخادم'
    });
});

// تشغيل الخادم
const server = app.listen(PORT, () => {
    console.log('\n🌟 قارئ الباركود - Node.js');
    console.log('=' * 30);
    console.log(`🌐 الخادم يعمل على: http://localhost:${PORT}`);
    console.log('📊 قاعدة البيانات: SQLite');
    console.log('⚡ المحرك: Node.js + Express');
    console.log('👥 حسابات التجربة:');
    console.log('   📱 المدير: admin / admin123');
    console.log('   👤 ضيف: guest');
    console.log('⏹️  اضغط Ctrl+C للإيقاف\n');
    
    // تهيئة قاعدة البيانات
    initDatabase();
});

// إغلاق قاعدة البيانات عند إغلاق التطبيق
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

module.exports = app; 