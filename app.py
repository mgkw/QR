#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🌍 QR Scanner - Global Web Application
نظام قارئ الباركود العالمي مع قاعدة بيانات مركزية
يمكن الوصول إليه من أي مكان في العالم
"""

from flask import Flask, request, jsonify, render_template_string, send_from_directory, redirect, url_for
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import sqlite3
import hashlib
import uuid
import json
import os
import base64
from datetime import datetime, timedelta
import pytz
import requests
import logging
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import threading
import time
from urllib.parse import urlparse

# ==================== إعداد Flask للنشر السحابي ====================

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'qr-scanner-global-secret-2025')
app.config['JSON_AS_ASCII'] = False

# إعداد CORS للوصول العالمي
CORS(app, resources={
    r"/*": {
        "origins": "*",  # السماح للجميع للوصول العالمي
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"]
    }
})

# ==================== إعدادات قاعدة البيانات السحابية ====================

# أولوية قواعد البيانات السحابية
DATABASE_PRIORITY = [
    {
        'name': 'Supabase PostgreSQL',
        'url': os.environ.get('SUPABASE_URL'),
        'type': 'postgresql'
    },
    {
        'name': 'Railway PostgreSQL', 
        'url': os.environ.get('RAILWAY_DATABASE_URL'),
        'type': 'postgresql'
    },
    {
        'name': 'Neon PostgreSQL',
        'url': os.environ.get('NEON_DATABASE_URL'), 
        'type': 'postgresql'
    },
    {
        'name': 'Render PostgreSQL',
        'url': os.environ.get('DATABASE_URL'),
        'type': 'postgresql'
    },
    {
        'name': 'Heroku PostgreSQL',
        'url': os.environ.get('HEROKU_POSTGRESQL_URL'),
        'type': 'postgresql'
    }
]

# النسخة الاحتياطية المحلية (للتطوير فقط)
FALLBACK_DATABASE = {
    'name': 'Local SQLite (Development Only)',
    'path': 'qr_scanner_backup.db',
    'type': 'sqlite'
}

# المتغيرات العامة
BAGHDAD_TZ = pytz.timezone('Asia/Baghdad')
current_db_config = None
db_connection_status = {
    'connected': False,
    'database_name': None,
    'database_type': None,
    'last_check': None
}

# إعداد التسجيل المُحسن
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log') if not os.environ.get('HEROKU') else logging.NullHandler()
    ]
)
logger = logging.getLogger(__name__)

# ==================== إدارة اتصال قاعدة البيانات الذكي ====================

def find_available_database():
    """البحث عن قاعدة بيانات متاحة من القائمة"""
    global current_db_config, db_connection_status
    
    logger.info("🔍 البحث عن قاعدة بيانات متاحة...")
    
    # جرب قواعد البيانات السحابية بالترتيب
    for db_config in DATABASE_PRIORITY:
        if db_config['url']:
            try:
                logger.info(f"⚡ اختبار {db_config['name']}...")
                
                conn = psycopg2.connect(
                    db_config['url'],
                    sslmode='require',
                    connect_timeout=10
                )
                cursor = conn.cursor()
                cursor.execute('SELECT 1')
                cursor.close()
                conn.close()
                
                current_db_config = db_config
                db_connection_status.update({
                    'connected': True,
                    'database_name': db_config['name'],
                    'database_type': 'postgresql',
                    'last_check': datetime.now()
                })
                
                logger.info(f"✅ نجح الاتصال بـ {db_config['name']}")
                return True
                
            except Exception as e:
                logger.warning(f"⚠️ فشل الاتصال بـ {db_config['name']}: {str(e)[:100]}")
                continue
    
    # إذا فشلت جميع قواعد البيانات السحابية، استخدم SQLite
    logger.warning("⚠️ لا يمكن الاتصال بأي قاعدة بيانات سحابية، استخدام SQLite المحلي")
    current_db_config = FALLBACK_DATABASE
    db_connection_status.update({
        'connected': True,
        'database_name': 'Local SQLite (No Internet Sync)',
        'database_type': 'sqlite',
        'last_check': datetime.now()
    })
    
    return True

def get_db_connection():
    """إنشاء اتصال بقاعدة البيانات"""
    global current_db_config
    
    if not current_db_config:
        find_available_database()
    
    try:
        if current_db_config['type'] == 'postgresql':
            conn = psycopg2.connect(
                current_db_config['url'],
                sslmode='require',
                connect_timeout=10
            )
            conn.cursor_factory = psycopg2.extras.RealDictCursor
            return conn
        else:  # SQLite
            conn = sqlite3.connect(current_db_config['path'])
            conn.row_factory = sqlite3.Row
            return conn
            
    except Exception as e:
        logger.error(f"❌ خطأ في الاتصال بقاعدة البيانات: {e}")
        # إعادة محاولة العثور على قاعدة بيانات أخرى
        find_available_database()
        raise

def execute_query(query, params=None, fetch='all'):
    """تنفيذ استعلام مع دعم PostgreSQL و SQLite"""
    params = params or []
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # تحويل استعلامات PostgreSQL لـ SQLite إذا لزم الأمر
                if current_db_config['type'] == 'sqlite' and '%s' in query:
                    query = query.replace('%s', '?')
                
                cursor.execute(query, params)
                
                if fetch == 'one':
                    result = cursor.fetchone()
                    return dict(result) if result else None
                elif fetch == 'all':
                    results = cursor.fetchall()
                    return [dict(row) for row in results]
                else:
                    conn.commit()
                    return cursor.rowcount
                    
        except Exception as e:
            logger.error(f"❌ خطأ في الاستعلام (محاولة {attempt + 1}): {e}")
            if attempt == max_retries - 1:
                # إعادة محاولة العثور على قاعدة بيانات أخرى
                find_available_database()
                raise
            time.sleep(1)  # انتظار ثانية واحدة قبل المحاولة التالية

# ==================== إنشاء قاعدة البيانات ====================

def get_create_table_sql():
    """الحصول على SQL إنشاء الجداول حسب نوع قاعدة البيانات"""
    if current_db_config['type'] == 'postgresql':
        return {
            'users': '''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password_hash TEXT,
                    is_owner BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by VARCHAR(255),
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_from_ip VARCHAR(45),
                    user_agent TEXT
                )
            ''',
            'scans': '''
                CREATE TABLE IF NOT EXISTS scans (
                    id VARCHAR(36) PRIMARY KEY,
                    barcode TEXT NOT NULL,
                    code_type VARCHAR(50) DEFAULT 'كود',
                    user_id INTEGER NOT NULL,
                    username VARCHAR(255) NOT NULL,
                    image_data_url TEXT,
                    scan_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    telegram_status VARCHAR(20) DEFAULT 'pending',
                    telegram_attempts INTEGER DEFAULT 0,
                    telegram_last_attempt TIMESTAMP,
                    telegram_error TEXT,
                    is_duplicate BOOLEAN DEFAULT FALSE,
                    duplicate_count INTEGER DEFAULT 1,
                    baghdad_time TEXT,
                    scan_location VARCHAR(255),
                    device_info TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''',
            'settings': '''
                CREATE TABLE IF NOT EXISTS settings (
                    id SERIAL PRIMARY KEY,
                    key VARCHAR(255) UNIQUE NOT NULL,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_by VARCHAR(255),
                    is_global BOOLEAN DEFAULT TRUE
                )
            ''',
            'user_sessions': '''
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    username VARCHAR(255) NOT NULL,
                    is_owner BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    is_remember_me BOOLEAN DEFAULT FALSE,
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''',
            'system_stats': '''
                CREATE TABLE IF NOT EXISTS system_stats (
                    id SERIAL PRIMARY KEY,
                    stat_date DATE DEFAULT CURRENT_DATE,
                    total_users INTEGER DEFAULT 0,
                    total_scans INTEGER DEFAULT 0,
                    active_sessions INTEGER DEFAULT 0,
                    database_type VARCHAR(50),
                    server_uptime_hours INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            '''
        }
    else:  # SQLite
        return {
            'users': '''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT,
                    is_owner BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by TEXT,
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1,
                    created_from_ip TEXT,
                    user_agent TEXT
                )
            ''',
            'scans': '''
                CREATE TABLE IF NOT EXISTS scans (
                    id TEXT PRIMARY KEY,
                    barcode TEXT NOT NULL,
                    code_type TEXT DEFAULT 'كود',
                    user_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    image_data_url TEXT,
                    scan_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    telegram_status TEXT DEFAULT 'pending',
                    telegram_attempts INTEGER DEFAULT 0,
                    telegram_last_attempt TIMESTAMP,
                    telegram_error TEXT,
                    is_duplicate BOOLEAN DEFAULT 0,
                    duplicate_count INTEGER DEFAULT 1,
                    baghdad_time TEXT,
                    scan_location TEXT,
                    device_info TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''',
            'settings': '''
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_by TEXT,
                    is_global BOOLEAN DEFAULT 1
                )
            ''',
            'user_sessions': '''
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    is_owner BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    is_remember_me BOOLEAN DEFAULT 0,
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ip_address TEXT,
                    user_agent TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''',
            'system_stats': '''
                CREATE TABLE IF NOT EXISTS system_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    stat_date DATE DEFAULT CURRENT_DATE,
                    total_users INTEGER DEFAULT 0,
                    total_scans INTEGER DEFAULT 0,
                    active_sessions INTEGER DEFAULT 0,
                    database_type TEXT,
                    server_uptime_hours INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            '''
        }

def init_database():
    """تهيئة قاعدة البيانات"""
    try:
        # التأكد من الاتصال
        if not current_db_config:
            find_available_database()
        
        logger.info(f"📊 إنشاء جداول قاعدة البيانات في {current_db_config['name']}...")
        
        # إنشاء الجداول
        tables_sql = get_create_table_sql()
        for table_name, sql in tables_sql.items():
            execute_query(sql, fetch='none')
            logger.info(f"✅ تم إنشاء جدول {table_name}")
        
        # إنشاء البيانات الافتراضية
        create_default_data()
        
        logger.info("✅ تم تهيئة قاعدة البيانات بنجاح")
        return True
        
    except Exception as e:
        logger.error(f"❌ خطأ في تهيئة قاعدة البيانات: {e}")
        return False

def create_default_data():
    """إنشاء البيانات الافتراضية"""
    try:
        # إنشاء المستخدم الأونر
        placeholder = '%s' if current_db_config['type'] == 'postgresql' else '?'
        
        existing_admin = execute_query(f'SELECT id FROM users WHERE username = {placeholder}', ['admin'], fetch='one')
        if not existing_admin:
            password_hash = generate_password_hash('owner123')
            bool_val = 'TRUE' if current_db_config['type'] == 'postgresql' else '1'
            
            execute_query(f'''
                INSERT INTO users (username, password_hash, is_owner, created_by, created_from_ip)
                VALUES ({placeholder}, {placeholder}, {bool_val}, 'system', 'localhost')
            ''', ['admin', password_hash], fetch='none')
            
            logger.info("✅ تم إنشاء المستخدم الأونر: admin")
        
        # إنشاء مستخدم تجريبي
        existing_test = execute_query(f'SELECT id FROM users WHERE username = {placeholder}', ['test'], fetch='one')
        if not existing_test:
            execute_query(f'''
                INSERT INTO users (username, created_by, created_from_ip)
                VALUES ({placeholder}, 'system', 'localhost')
            ''', ['test'], fetch='none')
            
            logger.info("✅ تم إنشاء المستخدم التجريبي: test")
        
        # إنشاء الإعدادات الافتراضية
        default_settings = [
            ('telegram_bot_token', ''),
            ('telegram_chat_id', ''),
            ('auto_send_telegram', 'false'),
            ('duplicate_detection_seconds', '20'),
            ('database_type', current_db_config['type']),
            ('app_version', '2.0-global'),
            ('max_users', '1000'),
            ('allow_registration', 'false')
        ]
        
        for key, value in default_settings:
            existing = execute_query(f'SELECT id FROM settings WHERE key = {placeholder}', [key], fetch='one')
            if not existing:
                execute_query(f'''
                    INSERT INTO settings (key, value, updated_by)
                    VALUES ({placeholder}, {placeholder}, 'system')
                ''', [key, value], fetch='none')
        
        logger.info("✅ تم إنشاء الإعدادات الافتراضية")
        
    except Exception as e:
        logger.error(f"❌ خطأ في إنشاء البيانات الافتراضية: {e}")

# ==================== مساعدات المصادقة ====================

def get_client_info(request):
    """الحصول على معلومات العميل"""
    return {
        'ip': request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', 'unknown')),
        'user_agent': request.environ.get('HTTP_USER_AGENT', 'unknown')[:500]
    }

def authenticate_user(f):
    """تحقق من مصادقة المستخدم"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            data = request.get_json() or {}
            session_id = data.get('sessionId') or request.headers.get('X-Session-ID') or request.args.get('sessionId')
            
            if not session_id:
                return jsonify({'success': False, 'message': 'معرف الجلسة مطلوب'}), 401
            
            placeholder = '%s' if current_db_config['type'] == 'postgresql' else '?'
            session = execute_query(f'''
                SELECT * FROM user_sessions 
                WHERE id = {placeholder} AND expires_at > CURRENT_TIMESTAMP AND is_active = {('TRUE' if current_db_config['type'] == 'postgresql' else '1')}
            ''', [session_id], fetch='one')
            
            if not session:
                return jsonify({'success': False, 'message': 'الجلسة منتهية الصلاحية'}), 401
            
            # تحديث آخر نشاط
            client_info = get_client_info(request)
            execute_query(f'''
                UPDATE user_sessions 
                SET last_activity = CURRENT_TIMESTAMP, ip_address = {placeholder}, user_agent = {placeholder}
                WHERE id = {placeholder}
            ''', [client_info['ip'], client_info['user_agent'], session_id], fetch='none')
            
            # إضافة معلومات المستخدم للطلب
            request.user = {
                'userId': session['user_id'],
                'username': session['username'],
                'isOwner': bool(session['is_owner']),
                'sessionId': session_id,
                'clientInfo': client_info
            }
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f'خطأ في مصادقة المستخدم: {e}')
            return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500
    
    return decorated_function

def authenticate_owner(f):
    """تحقق من مصادقة الأونر"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # استخدام authenticate_user أولاً
        auth_result = authenticate_user(lambda: None)()
        if auth_result:  # إذا فشلت المصادقة
            return auth_result
        
        # التحقق من صلاحية الأونر
        if not request.user.get('isOwner'):
            return jsonify({'success': False, 'message': 'هذه الميزة متاحة للأونر فقط'}), 403
        
        return f(*args, **kwargs)
    
    return decorated_function

# ==================== واجهة الويب الجديدة ====================

@app.route('/')
def index():
    """الصفحة الرئيسية مع معلومات النظام"""
    # الحصول على إحصائيات سريعة
    try:
        placeholder = '%s' if current_db_config['type'] == 'postgresql' else '?'
        total_users = execute_query('SELECT COUNT(*) as count FROM users', fetch='one')['count']
        total_scans = execute_query('SELECT COUNT(*) as count FROM scans', fetch='one')['count']
        active_sessions = execute_query(f'''
            SELECT COUNT(*) as count FROM user_sessions 
            WHERE expires_at > CURRENT_TIMESTAMP AND is_active = {('TRUE' if current_db_config['type'] == 'postgresql' else '1')}
        ''', fetch='one')['count']
    except:
        total_users = total_scans = active_sessions = 0
    
    # الحصول على نوع قاعدة البيانات بشكل آمن
    database_type = db_connection_status.get('database_type')
    if database_type is None or database_type == '':
        database_type = 'SQLITE'  # القيمة الافتراضية
    else:
        database_type = str(database_type).upper()
    
    return render_template_string("""
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌍 قارئ الباركود العالمي</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; color: white; text-align: center;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .hero { padding: 60px 0; }
        .hero h1 { font-size: 3rem; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .hero p { font-size: 1.2rem; margin-bottom: 40px; opacity: 0.9; }
        .stats { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; margin: 40px 0;
        }
        .stat-card { 
            background: rgba(255,255,255,0.1); backdrop-filter: blur(10px);
            padding: 30px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.2);
        }
        .stat-number { font-size: 2.5rem; font-weight: bold; margin-bottom: 10px; }
        .stat-label { font-size: 1rem; opacity: 0.8; }
        .btn-group { margin: 40px 0; }
        .btn { 
            display: inline-block; padding: 15px 30px; margin: 10px;
            background: rgba(255,255,255,0.2); color: white; text-decoration: none;
            border-radius: 50px; backdrop-filter: blur(10px);
            border: 2px solid rgba(255,255,255,0.3);
            transition: all 0.3s ease;
        }
        .btn:hover { 
            background: rgba(255,255,255,0.3); 
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .btn-primary { background: linear-gradient(45deg, #ff6b6b, #ff8e8e); }
        .btn-success { background: linear-gradient(45deg, #51cf66, #69f576); }
        .status { margin: 40px 0; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 10px; }
        .db-status { 
            display: inline-block; padding: 10px 20px; margin: 10px;
            border-radius: 20px; font-weight: bold;
        }
        .db-connected { background: linear-gradient(45deg, #51cf66, #40c057); }
        .db-local { background: linear-gradient(45deg, #ffd43b, #fab005); color: #333; }
        .features { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 30px; margin: 60px 0;
        }
        .feature { 
            background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px;
            backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2);
        }
        .feature i { font-size: 3rem; margin-bottom: 20px; color: #ffd43b; }
        .footer { margin-top: 60px; padding: 30px 0; opacity: 0.8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <h1><i class="fas fa-qrcode"></i> قارئ الباركود العالمي</h1>
            <p>نظام مركزي للوصول من أي مكان في العالم 🌍</p>
            
            <div class="status">
                <h3>🔗 حالة النظام</h3>
                <div class="db-status {{ 'db-connected' if db_connected else 'db-local' }}">
                    {{ database_name }}
                </div>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">{{ total_users }}</div>
                    <div class="stat-label">👥 المستخدمين</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{{ total_scans }}</div>
                    <div class="stat-label">📱 المسحات</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{{ active_sessions }}</div>
                    <div class="stat-label">🟢 الجلسات النشطة</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">🌍</div>
                    <div class="stat-label">وصول عالمي</div>
                </div>
            </div>
            
            <div class="btn-group">
                <a href="/scanner" class="btn btn-primary">
                    <i class="fas fa-camera"></i> بدء المسح
                </a>
                <a href="/admin" class="btn btn-success">
                    <i class="fas fa-cog"></i> لوحة الإدارة
                </a>
            </div>
        </div>
        
        <div class="features">
            <div class="feature">
                <i class="fas fa-globe"></i>
                <h3>وصول عالمي</h3>
                <p>يمكن الوصول من أي مكان في العالم عبر الإنترنت</p>
            </div>
            <div class="feature">
                <i class="fas fa-sync"></i>
                <h3>مزامنة فورية</h3>
                <p>البيانات متزامنة لحظياً بين جميع الأجهزة</p>
            </div>
            <div class="feature">
                <i class="fas fa-shield-alt"></i>
                <h3>آمان متقدم</h3>
                <p>نظام مصادقة قوي وحماية البيانات</p>
            </div>
            <div class="feature">
                <i class="fas fa-chart-line"></i>
                <h3>إحصائيات شاملة</h3>
                <p>تقارير مفصلة ورسوم بيانية تفاعلية</p>
            </div>
            <div class="feature">
                <i class="fas fa-mobile-alt"></i>
                <h3>متوافق مع الجوال</h3>
                <p>يعمل بسلاسة على جميع الأجهزة والشاشات</p>
            </div>
            <div class="feature">
                <i class="fas fa-bolt"></i>
                <h3>أداء فائق</h3>
                <p>سرعة عالية ومعالجة فورية للباركود</p>
            </div>
        </div>
        
        <div class="footer">
            <p>&copy; 2025 قارئ الباركود العالمي - نظام مركزي متطور</p>
            <p>{{ database_type }} Database • Version 2.0</p>
        </div>
    </div>
</body>
</html>
    """, 
    total_users=total_users,
    total_scans=total_scans, 
    active_sessions=active_sessions,
    db_connected=db_connection_status.get('connected', False) and current_db_config and current_db_config.get('type') == 'postgresql',
    database_name=db_connection_status.get('database_name', 'غير متصل'),
    database_type=database_type
    )

@app.route('/scanner')
def scanner():
    """صفحة قارئ الباركود"""
    return send_from_directory('.', 'index.html')

@app.route('/admin')
def admin():
    """لوحة الإدارة"""
    return redirect('/scanner')

@app.route('/status')
def status():
    """حالة النظام والاتصال"""
    return jsonify({
        'success': True,
        'database': db_connection_status,
        'current_config': {
            'name': current_db_config['name'] if current_db_config else 'Not Connected',
            'type': current_db_config['type'] if current_db_config else 'unknown'
        },
        'server_time': datetime.now().isoformat(),
        'baghdad_time': datetime.now(BAGHDAD_TZ).strftime('%Y-%m-%d %H:%M:%S')
    })

# ==================== API المُحسن ====================

@app.route('/api/health')
def health_check():
    """فحص صحة النظام"""
    try:
        # اختبار قاعدة البيانات
        execute_query('SELECT 1', fetch='one')
        
        return jsonify({
            'status': 'healthy',
            'database': db_connection_status,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

# ==================== بدء التطبيق ====================

def startup_tasks():
    """مهام بدء التشغيل"""
    logger.info("🚀 بدء تشغيل قارئ الباركود العالمي...")
    
    # العثور على قاعدة بيانات متاحة
    find_available_database()
    
    # تهيئة قاعدة البيانات
    init_database()
    
    logger.info(f"✅ النظام جاهز! قاعدة البيانات: {db_connection_status.get('database_name', 'غير محدد')}")

# تشغيل مهام البدء عند استيراد التطبيق
startup_tasks()

if __name__ == '__main__':
    # بدء الخادم
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"🌍 تشغيل الخادم على المنفذ {port}")
    app.run(host='0.0.0.0', port=port, debug=debug) 