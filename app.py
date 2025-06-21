#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QR Scanner Application - Python Flask Version
نظام قارئ الباركود مع قاعدة بيانات SQLite
"""

from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
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

# إعداد Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = 'qr-scanner-secret-key-2025'
app.config['JSON_AS_ASCII'] = False

# إعداد CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "https://mgkw.github.io", "*"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# إعداد قاعدة البيانات SQLite
DATABASE = 'qr_scanner.db'
BAGHDAD_TZ = pytz.timezone('Asia/Baghdad')

# إعداد التسجيل
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ==================== قاعدة البيانات ====================

def get_db_connection():
    """إنشاء اتصال بقاعدة البيانات"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    """تهيئة قاعدة البيانات وإنشاء الجداول"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # جدول المستخدمين
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT,
                    is_owner BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by TEXT,
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1
                )
            ''')
            
            # جدول المسحات
            cursor.execute('''
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
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
            
            # جدول الإعدادات
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_by TEXT
                )
            ''')
            
            # جدول جلسات المستخدمين
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    is_owner BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    is_remember_me BOOLEAN DEFAULT 0,
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
            
            conn.commit()
            logger.info('✅ تم إنشاء جداول قاعدة البيانات بنجاح')
            
            # إنشاء المستخدم الأونر الافتراضي
            create_default_owner()
            create_default_settings()
            
    except Exception as e:
        logger.error(f'❌ خطأ في تهيئة قاعدة البيانات: {e}')
        raise

def create_default_owner():
    """إنشاء المستخدم الأونر الافتراضي"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # التحقق من وجود المستخدم
            cursor.execute('SELECT id FROM users WHERE username = ?', ('admin',))
            if cursor.fetchone():
                logger.info('⚠️ المستخدم الأونر موجود بالفعل')
                return
            
            # إنشاء المستخدم الأونر
            password_hash = generate_password_hash('owner123')
            cursor.execute('''
                INSERT INTO users (username, password_hash, is_owner, created_by)
                VALUES (?, ?, 1, 'system')
            ''', ('admin', password_hash))
            
            # إضافة مستخدم تجريبي
            cursor.execute('''
                INSERT INTO users (username, created_by)
                VALUES (?, 'system')
            ''', ('test',))
            
            conn.commit()
            logger.info('✅ تم إنشاء المستخدمين الافتراضيين: admin (أونر) و test')
            
    except Exception as e:
        logger.error(f'❌ خطأ في إنشاء المستخدمين الافتراضيين: {e}')

def create_default_settings():
    """إنشاء الإعدادات الافتراضية"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            default_settings = [
                ('telegram_bot_token', ''),
                ('telegram_chat_id', ''),
                ('auto_send_telegram', 'false'),
                ('duplicate_detection_seconds', '20')
            ]
            
            for key, value in default_settings:
                cursor.execute('''
                    INSERT OR IGNORE INTO settings (key, value, updated_by)
                    VALUES (?, ?, 'system')
                ''', (key, value))
            
            conn.commit()
            logger.info('✅ تم إنشاء الإعدادات الافتراضية')
            
    except Exception as e:
        logger.error(f'❌ خطأ في إنشاء الإعدادات: {e}')

# ==================== مساعدات المصادقة ====================

def authenticate_user(f):
    """decorator للتحقق من مصادقة المستخدم"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            data = request.get_json() or {}
            session_id = data.get('sessionId') or request.headers.get('X-Session-ID')
            
            if not session_id:
                return jsonify({'success': False, 'message': 'معرف الجلسة مطلوب'}), 401
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM user_sessions 
                    WHERE id = ? AND expires_at > CURRENT_TIMESTAMP
                ''', (session_id,))
                session = cursor.fetchone()
                
                if not session:
                    return jsonify({'success': False, 'message': 'الجلسة منتهية الصلاحية'}), 401
                
                # تحديث آخر نشاط
                cursor.execute('''
                    UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP 
                    WHERE id = ?
                ''', (session_id,))
                conn.commit()
                
                # إضافة معلومات المستخدم للطلب
                request.user = {
                    'userId': session['user_id'],
                    'username': session['username'],
                    'isOwner': bool(session['is_owner']),
                    'sessionId': session_id
                }
                
                return f(*args, **kwargs)
                
        except Exception as e:
            logger.error(f'خطأ في مصادقة المستخدم: {e}')
            return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500
    
    return decorated_function

def authenticate_owner(f):
    """decorator للتحقق من مصادقة الأونر"""
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

# ==================== المسارات الثابتة ====================

@app.route('/')
def index():
    """الصفحة الرئيسية"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    """الملفات الثابتة"""
    return send_from_directory('.', filename)

# ==================== API المصادقة ====================

@app.route('/api/login', methods=['POST'])
def login():
    """تسجيل الدخول"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')
        is_owner = data.get('isOwner', False)
        remember_me = data.get('rememberMe', False)
        
        if not username:
            return jsonify({'success': False, 'message': 'اسم المستخدم مطلوب'}), 400
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM users WHERE username = ? AND is_active = 1
            ''', (username,))
            user = cursor.fetchone()
            
            if not user:
                return jsonify({'success': False, 'message': 'المستخدم غير موجود أو غير مسجل'}), 401
            
            actual_is_owner = is_owner
            
            # التحقق من صلاحية الأونر
            if is_owner:
                if not password:
                    return jsonify({'success': False, 'message': 'كلمة المرور مطلوبة للأونر'}), 400
                
                if not user['is_owner']:
                    return jsonify({'success': False, 'message': 'هذا المستخدم ليس أونر'}), 401
                
                if not check_password_hash(user['password_hash'], password):
                    return jsonify({'success': False, 'message': 'كلمة مرور خاطئة'}), 401
            
            elif user['is_owner'] and password:
                # إذا كان أونر ولكن يسجل دخول كمستخدم عادي مع كلمة مرور
                if check_password_hash(user['password_hash'], password):
                    actual_is_owner = True
            
            # إنشاء جلسة جديدة
            session_id = str(uuid.uuid4())
            expires_at = datetime.now() + (
                timedelta(days=30) if remember_me else timedelta(hours=24)
            )
            
            cursor.execute('''
                INSERT INTO user_sessions 
                (id, user_id, username, is_owner, expires_at, is_remember_me)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (session_id, user['id'], user['username'], 
                 actual_is_owner or user['is_owner'], expires_at, remember_me))
            
            # تحديث آخر تسجيل دخول
            cursor.execute('''
                UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
            ''', (user['id'],))
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'message': f'مرحباً {username}{"(الأونر)" if actual_is_owner or user["is_owner"] else ""}!',
                'session': {
                    'sessionId': session_id,
                    'username': user['username'],
                    'isOwner': actual_is_owner or user['is_owner'],
                    'expiresAt': expires_at.isoformat()
                }
            })
            
    except Exception as e:
        logger.error(f'خطأ في تسجيل الدخول: {e}')
        return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    """تسجيل الخروج"""
    try:
        data = request.get_json() or {}
        session_id = data.get('sessionId')
        
        if session_id:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM user_sessions WHERE id = ?', (session_id,))
                conn.commit()
        
        return jsonify({'success': True, 'message': 'تم تسجيل الخروج بنجاح'})
        
    except Exception as e:
        logger.error(f'خطأ في تسجيل الخروج: {e}')
        return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500

@app.route('/api/verify-session', methods=['POST'])
def verify_session():
    """التحقق من صحة الجلسة"""
    try:
        data = request.get_json()
        session_id = data.get('sessionId')
        
        if not session_id:
            return jsonify({'success': False, 'message': 'معرف الجلسة مطلوب'}), 401
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM user_sessions 
                WHERE id = ? AND expires_at > CURRENT_TIMESTAMP
            ''', (session_id,))
            session = cursor.fetchone()
            
            if not session:
                return jsonify({'success': False, 'message': 'الجلسة منتهية الصلاحية'}), 401
            
            # تحديث آخر نشاط
            cursor.execute('''
                UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP 
                WHERE id = ?
            ''', (session_id,))
            conn.commit()
            
            return jsonify({
                'success': True,
                'session': {
                    'sessionId': session['id'],
                    'username': session['username'],
                    'isOwner': bool(session['is_owner'])
                }
            })
            
    except Exception as e:
        logger.error(f'خطأ في التحقق من الجلسة: {e}')
        return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500

# ==================== API إدارة المستخدمين ====================

@app.route('/api/users', methods=['GET'])
@authenticate_owner
def get_users():
    """الحصول على جميع المستخدمين (للأونر فقط)"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, username, created_at, created_by, last_login, is_active 
                FROM users WHERE is_owner = 0
            ''')
            users = [dict(row) for row in cursor.fetchall()]
            
            return jsonify({'success': True, 'users': users})
            
    except Exception as e:
        logger.error(f'خطأ في جلب المستخدمين: {e}')
        return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500

@app.route('/api/users', methods=['POST'])
@authenticate_owner
def add_user():
    """إضافة مستخدم جديد (للأونر فقط)"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        created_by = request.user['username']
        
        if not username:
            return jsonify({'success': False, 'message': 'اسم المستخدم مطلوب'}), 400
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # التحقق من وجود المستخدم
            cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
            if cursor.fetchone():
                return jsonify({'success': False, 'message': 'اسم المستخدم موجود بالفعل'}), 400
            
            cursor.execute('''
                INSERT INTO users (username, created_by) VALUES (?, ?)
            ''', (username, created_by))
            conn.commit()
            
            return jsonify({
                'success': True,
                'message': f'تم إضافة المستخدم "{username}" بنجاح'
            })
            
    except Exception as e:
        logger.error(f'خطأ في إضافة المستخدم: {e}')
        return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500

@app.route('/api/users/<username>', methods=['DELETE'])
@authenticate_owner
def delete_user(username):
    """حذف مستخدم (للأونر فقط)"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # التحقق من وجود المستخدم
            cursor.execute('''
                SELECT id FROM users WHERE username = ? AND is_owner = 0
            ''', (username,))
            if not cursor.fetchone():
                return jsonify({'success': False, 'message': 'المستخدم غير موجود'}), 404
            
            cursor.execute('''
                UPDATE users SET is_active = 0 WHERE username = ? AND is_owner = 0
            ''', (username,))
            conn.commit()
            
            return jsonify({
                'success': True,
                'message': f'تم حذف المستخدم "{username}" بنجاح'
            })
            
    except Exception as e:
        logger.error(f'خطأ في حذف المستخدم: {e}')
        return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500

# ==================== API المسحات ====================

@app.route('/api/scans', methods=['POST'])
@authenticate_user
def save_scan():
    """حفظ مسحة جديدة"""
    try:
        data = request.get_json()
        barcode = data.get('barcode', '').strip()
        code_type = data.get('codeType', 'كود')
        image_data_url = data.get('imageDataUrl', '')
        
        user_id = request.user['userId']
        username = request.user['username']
        
        if not barcode:
            return jsonify({'success': False, 'message': 'الباركود مطلوب'}), 400
        
        scan_id = str(uuid.uuid4())
        baghdad_time = datetime.now(BAGHDAD_TZ).strftime('%Y-%m-%d %H:%M:%S')
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # التحقق من التكرار خلال 20 ثانية
            twenty_seconds_ago = datetime.now() - timedelta(seconds=20)
            cursor.execute('''
                SELECT * FROM scans 
                WHERE barcode = ? AND scan_timestamp > ?
            ''', (barcode, twenty_seconds_ago))
            recent_scan = cursor.fetchone()
            
            is_duplicate = recent_scan is not None
            
            # حساب عدد التكرارات الإجمالي
            cursor.execute('SELECT COUNT(*) as count FROM scans WHERE barcode = ?', (barcode,))
            count_result = cursor.fetchone()
            duplicate_count = (count_result['count'] if count_result else 0) + 1
            
            # حفظ المسحة
            cursor.execute('''
                INSERT INTO scans 
                (id, barcode, code_type, user_id, username, image_data_url, 
                 is_duplicate, duplicate_count, baghdad_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (scan_id, barcode, code_type, user_id, username, image_data_url,
                 is_duplicate, duplicate_count, baghdad_time))
            
            conn.commit()
            
            response = {
                'success': True,
                'message': 'تم حفظ المسحة بنجاح',
                'scan': {
                    'id': scan_id,
                    'barcode': barcode,
                    'codeType': code_type,
                    'username': username,
                    'isDuplicate': is_duplicate,
                    'duplicateCount': duplicate_count,
                    'baghdadTime': baghdad_time
                }
            }
            
            # إذا كان مكرر، أرسل معلومات المسحة الأصلية
            if is_duplicate and recent_scan:
                time_diff = (datetime.now() - datetime.fromisoformat(recent_scan['scan_timestamp'].replace('Z', '+00:00'))).total_seconds()
                response['recentScan'] = {
                    'username': recent_scan['username'],
                    'scanTime': recent_scan['scan_timestamp'],
                    'imageDataUrl': recent_scan['image_data_url'],
                    'timeDiff': int(time_diff)
                }
            
            return jsonify(response)
            
    except Exception as e:
        logger.error(f'خطأ في حفظ المسحة: {e}')
        return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500

@app.route('/api/scans', methods=['GET'])
@authenticate_user
def get_scans():
    """الحصول على جميع المسحات"""
    try:
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')
        filter_user_id = request.args.get('userId')
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            query = 'SELECT * FROM scans WHERE 1=1'
            params = []
            
            if start_date:
                query += ' AND scan_timestamp >= ?'
                params.append(start_date)
            
            if end_date:
                query += ' AND scan_timestamp <= ?'
                params.append(end_date)
            
            if filter_user_id:
                query += ' AND user_id = ?'
                params.append(filter_user_id)
            
            query += ' ORDER BY scan_timestamp DESC'
            
            cursor.execute(query, params)
            scans = [dict(row) for row in cursor.fetchall()]
            
            return jsonify({'success': True, 'scans': scans})
            
    except Exception as e:
        logger.error(f'خطأ في جلب المسحات: {e}')
        return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500

@app.route('/api/settings', methods=['GET'])
@authenticate_owner
def get_settings():
    """الحصول على الإعدادات (للأونر فقط)"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT key, value FROM settings')
            settings_rows = cursor.fetchall()
            
            settings = {row['key']: row['value'] for row in settings_rows}
            
            return jsonify({'success': True, 'settings': settings})
            
    except Exception as e:
        logger.error(f'خطأ في جلب الإعدادات: {e}')
        return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500

@app.route('/api/settings', methods=['POST'])
@authenticate_owner
def save_settings():
    """حفظ الإعدادات (للأونر فقط)"""
    try:
        data = request.get_json()
        updated_by = request.user['username']
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            for key, value in data.items():
                cursor.execute('''
                    INSERT OR REPLACE INTO settings (key, value, updated_by, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ''', (key, value, updated_by))
            
            conn.commit()
            
            return jsonify({'success': True, 'message': 'تم حفظ الإعدادات بنجاح'})
            
    except Exception as e:
        logger.error(f'خطأ في حفظ الإعدادات: {e}')
        return jsonify({'success': False, 'message': 'خطأ في الخادم'}), 500

# ==================== بدء التطبيق ====================

if __name__ == '__main__':
    # تهيئة قاعدة البيانات
    init_database()
    
    # بدء الخادم
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True) 