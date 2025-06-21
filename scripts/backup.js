#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('💾 بدء إنشاء نسخة احتياطية...');

const dbPath = path.join(__dirname, '..', 'database.db');
const backupDir = path.join(__dirname, '..', 'backups');

// إنشاء مجلد النسخ الاحتياطية
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log('📁 تم إنشاء مجلد النسخ الاحتياطية');
}

if (!fs.existsSync(dbPath)) {
    console.error('❌ قاعدة البيانات غير موجودة');
    process.exit(1);
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
        process.exit(1);
    } else {
        console.log('✅ تم الاتصال بقاعدة البيانات للقراءة');
    }
});

// دوال مساعدة
const getAllQuery = (sql) => {
    return new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

const getQuery = (sql) => {
    return new Promise((resolve, reject) => {
        db.get(sql, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

async function createBackup() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `database-backup-${timestamp}.json`);
        
        console.log('📊 جمع البيانات...');
        
        // جمع جميع البيانات
        const [users, scans, systemStats, auditLog] = await Promise.all([
            getAllQuery('SELECT * FROM users ORDER BY id'),
            getAllQuery('SELECT * FROM scans ORDER BY scan_time DESC'),
            getAllQuery('SELECT * FROM system_stats ORDER BY date DESC').catch(() => []),
            getAllQuery('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 1000').catch(() => [])
        ]);
        
        // إحصائيات
        const stats = await getQuery(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM scans) as total_scans,
                (SELECT COUNT(DISTINCT barcode) FROM scans) as unique_codes,
                (SELECT COUNT(*) FROM scans WHERE is_duplicate = 1) as duplicate_scans
        `);
        
        // إنشاء النسخة الاحتياطية
        const backup = {
            metadata: {
                backup_date: new Date().toISOString(),
                database_version: '2.0',
                total_users: stats.total_users,
                total_scans: stats.total_scans,
                unique_codes: stats.unique_codes,
                duplicate_scans: stats.duplicate_scans
            },
            data: {
                users: users.map(user => ({
                    ...user,
                    // إزالة كلمات المرور من النسخة الاحتياطية للأمان
                    password: user.password ? '[HIDDEN]' : null
                })),
                scans: scans.map(scan => ({
                    ...scan,
                    // ضغط بيانات الصور في النسخة الاحتياطية
                    image_data: scan.image_data ? '[IMAGE_DATA_COMPRESSED]' : null
                })),
                system_stats: systemStats,
                audit_log: auditLog
            },
            schema: {
                users_columns: await getAllQuery("PRAGMA table_info(users)"),
                scans_columns: await getAllQuery("PRAGMA table_info(scans)"),
                system_stats_columns: await getAllQuery("PRAGMA table_info(system_stats)").catch(() => []),
                audit_log_columns: await getAllQuery("PRAGMA table_info(audit_log)").catch(() => [])
            }
        };
        
        // حفظ النسخة الاحتياطية
        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
        
        console.log('✅ تم إنشاء النسخة الاحتياطية بنجاح');
        console.log(`📁 المسار: ${backupFile}`);
        console.log(`📊 حجم الملف: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB`);
        
        // إنشاء نسخة احتياطية كاملة مع الصور (اختيارية)
        if (process.argv.includes('--full')) {
            console.log('💾 إنشاء نسخة احتياطية كاملة مع الصور...');
            
            const fullBackupFile = path.join(backupDir, `database-full-backup-${timestamp}.json`);
            const fullBackup = {
                ...backup,
                data: {
                    ...backup.data,
                    scans: scans // مع بيانات الصور الكاملة
                }
            };
            
            fs.writeFileSync(fullBackupFile, JSON.stringify(fullBackup, null, 2), 'utf8');
            console.log(`📁 النسخة الكاملة: ${fullBackupFile}`);
            console.log(`📊 حجم النسخة الكاملة: ${(fs.statSync(fullBackupFile).size / 1024 / 1024).toFixed(2)} MB`);
        }
        
        // نسخ ملف قاعدة البيانات نفسه
        const dbBackupFile = path.join(backupDir, `database-${timestamp}.db`);
        fs.copyFileSync(dbPath, dbBackupFile);
        console.log(`💾 تم نسخ ملف قاعدة البيانات: ${dbBackupFile}`);
        
        // تنظيف النسخ القديمة (الاحتفاظ بآخر 10 نسخ)
        console.log('🧹 تنظيف النسخ القديمة...');
        
        const backupFiles = fs.readdirSync(backupDir)
            .filter(file => file.startsWith('database-backup-') && file.endsWith('.json'))
            .map(file => ({
                name: file,
                path: path.join(backupDir, file),
                mtime: fs.statSync(path.join(backupDir, file)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);
        
        // حذف النسخ الزائدة
        if (backupFiles.length > 10) {
            const filesToDelete = backupFiles.slice(10);
            filesToDelete.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`🗑️ تم حذف النسخة القديمة: ${file.name}`);
            });
        }
        
        console.log('\n🌟 تم إنجاز النسخ الاحتياطي بنجاح!');
        console.log(`📊 إحصائيات النسخة الاحتياطية:`);
        console.log(`   👥 المستخدمين: ${stats.total_users}`);
        console.log(`   📱 المسحات: ${stats.total_scans}`);
        console.log(`   🎯 الأكواد الفريدة: ${stats.unique_codes}`);
        console.log(`   🔄 المكررات: ${stats.duplicate_scans}`);
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء النسخة الاحتياطية:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

createBackup(); 