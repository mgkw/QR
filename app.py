#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
قارئ الباركود المتطور - تطبيق Python مع SQLite
QR Scanner Advanced - Python Application with SQLite
"""

from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect, url_for, flash
import sqlite3
import json
import requests
from datetime import datetime
import os
import threading
import time
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'qr-scanner-secret-key-2024'
app.config['UPLOAD_FOLDER'] = 'uploads'

# إنشاء مجلد الرفع
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# إعدادات قاعدة البيانات
DATABASE = 'qr_scanner.db'

# إعدادات التليجرام الثابتة
TELEGRAM_BOT_TOKEN = "7668051564:AAFdFqSd0CKrlSOyPKyFwf-xHi791lcsC_U"
TELEGRAM_CHAT_ID = "-1002439956600"

# إعدادات المدير الافتراضي
DEFAULT_OWNER = {
    'username': 'admin',
    'password': 'admin123',  # سيتم تشفيره
    'email': 'admin@qrscanner.com',
    'role': 'owner'
}

def init_database():
    """إنشاء قاعدة البيانات والجداول"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # جدول المستخدمين
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            is_active BOOLEAN DEFAULT 1,
            profile_picture TEXT
        )
    ''')
    
    # جدول النتائج (مع إضافة معرف المستخدم)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scan_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code_data TEXT NOT NULL,
            code_type TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_agent TEXT,
            ip_address TEXT,
            notes TEXT,
            telegram_sent BOOLEAN DEFAULT 0,
            image_path TEXT,
            user_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # جدول الإعدادات
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # جدول الإحصائيات
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS statistics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE DEFAULT CURRENT_DATE,
            total_scans INTEGER DEFAULT 0,
            successful_scans INTEGER DEFAULT 0,
            telegram_sent INTEGER DEFAULT 0,
            unique_codes INTEGER DEFAULT 0
        )
    ''')
    
    # جدول جلسات تسجيل الدخول
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # إدراج الإعدادات الافتراضية
    default_settings = [
        ('scanner_continuous', 'true'),
        ('scanner_sound', 'true'),
        ('scanner_duplicate_delay', '3000'),
        ('app_title', 'قارئ الباركود المتطور'),
        ('theme_color', '#4CAF50'),
        ('registration_enabled', 'true'),
        ('require_email_verification', 'false')
    ]
    
    for key, value in default_settings:
        cursor.execute('''
            INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
        ''', (key, value))
    
    # إنشاء حساب المدير الافتراضي
    admin_exists = cursor.execute('''
        SELECT COUNT(*) FROM users WHERE role = 'owner'
    ''').fetchone()[0]
    
    if admin_exists == 0:
        password_hash = generate_password_hash(DEFAULT_OWNER['password'])
        cursor.execute('''
            INSERT INTO users (username, email, password_hash, role, is_active)
            VALUES (?, ?, ?, ?, 1)
        ''', (DEFAULT_OWNER['username'], DEFAULT_OWNER['email'], password_hash, DEFAULT_OWNER['role']))
        
        print("🔐 تم إنشاء حساب المدير الافتراضي:")
        print(f"   👤 اسم المستخدم: {DEFAULT_OWNER['username']}")
        print(f"   🔑 كلمة المرور: {DEFAULT_OWNER['password']}")
        print(f"   📧 البريد: {DEFAULT_OWNER['email']}")
    
    conn.commit()
    conn.close()

def get_db_connection():
    """الحصول على اتصال قاعدة البيانات"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def get_setting(key, default=None):
    """الحصول على إعداد من قاعدة البيانات"""
    conn = get_db_connection()
    result = conn.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
    conn.close()
    return result['value'] if result else default

def set_setting(key, value):
    """حفظ إعداد في قاعدة البيانات"""
    conn = get_db_connection()
    conn.execute('''
        INSERT OR REPLACE INTO settings (key, value, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
    ''', (key, value))
    conn.commit()
    conn.close()

def send_telegram_message(message, image_path=None):
    """إرسال رسالة إلى تليجرام مع معالجة أخطاء محسنة"""
    try:
        # استخدام البيانات الثابتة
        bot_token = TELEGRAM_BOT_TOKEN
        chat_id = TELEGRAM_CHAT_ID
        
        if not bot_token or not chat_id:
            print("❌ خطأ: بيانات التليجرام غير مكتملة")
            return False
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        
        data = {
            'chat_id': chat_id,
            'text': message,
            'parse_mode': 'HTML'
        }
        
        response = requests.post(url, data=data, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                print(f"✅ تم إرسال رسالة التليجرام بنجاح (ID: {result['result']['message_id']})")
                
                # إرسال صورة إضافية إن وجدت
                if image_path and os.path.exists(image_path):
                    try:
                        photo_url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
                        with open(image_path, 'rb') as photo:
                            files = {'photo': photo}
                            photo_data = {'chat_id': chat_id, 'caption': 'صورة الباركود'}
                            requests.post(photo_url, data=photo_data, files=files, timeout=10)
                    except Exception as photo_error:
                        print(f"⚠️ فشل إرسال الصورة: {photo_error}")
                
                return True
            else:
                print(f"❌ خطأ من التليجرام: {result.get('description', 'غير محدد')}")
                return False
        else:
            print(f"❌ خطأ HTTP {response.status_code}: {response.text}")
            return False
        
    except requests.exceptions.Timeout:
        print("❌ انتهت مهلة الاتصال بالتليجرام - تحقق من الإنترنت")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ فشل الاتصال بالتليجرام - تحقق من الإنترنت أو استخدم VPN")
        return False
    except Exception as e:
        print(f"❌ خطأ غير متوقع في إرسال تليجرام: {type(e).__name__}: {e}")
        return False

# ===== دوال المصادقة والمستخدمين =====

def login_required(f):
    """ديكوريتر للتحقق من تسجيل الدخول"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json:
                return jsonify({'success': False, 'error': 'مطلوب تسجيل الدخول', 'redirect': '/login'})
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """ديكوريتر للتحقق من صلاحيات المدير"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        
        user = get_current_user()
        if not user or user['role'] not in ['owner', 'admin']:
            if request.is_json:
                return jsonify({'success': False, 'error': 'غير مصرح لك بالوصول'})
            return redirect(url_for('index'))
        
        return f(*args, **kwargs)
    return decorated_function

def get_current_user():
    """الحصول على المستخدم الحالي"""
    if 'user_id' not in session:
        return None
    
    conn = get_db_connection()
    user = conn.execute('''
        SELECT id, username, email, role, created_at, last_login, profile_picture 
        FROM users WHERE id = ? AND is_active = 1
    ''', (session['user_id'],)).fetchone()
    conn.close()
    
    return dict(user) if user else None

def create_user(username, email, password, role='user'):
    """إنشاء مستخدم جديد"""
    try:
        conn = get_db_connection()
        
        # التحقق من عدم وجود المستخدم
        existing = conn.execute('''
            SELECT id FROM users WHERE username = ? OR email = ?
        ''', (username, email)).fetchone()
        
        if existing:
            conn.close()
            return {'success': False, 'error': 'اسم المستخدم أو البريد موجود بالفعل'}
        
        # تشفير كلمة المرور
        password_hash = generate_password_hash(password)
        
        # إدراج المستخدم
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO users (username, email, password_hash, role, is_active)
            VALUES (?, ?, ?, ?, 1)
        ''', (username, email, password_hash, role))
        
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return {'success': True, 'user_id': user_id}
        
    except Exception as e:
        return {'success': False, 'error': f'خطأ في إنشاء المستخدم: {str(e)}'}

def authenticate_user(username, password):
    """التحقق من بيانات المستخدم"""
    try:
        conn = get_db_connection()
        user = conn.execute('''
            SELECT id, username, email, password_hash, role, is_active
            FROM users WHERE (username = ? OR email = ?) AND is_active = 1
        ''', (username, username)).fetchone()
        
        if user and check_password_hash(user['password_hash'], password):
            # تحديث وقت آخر تسجيل دخول
            conn.execute('''
                UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
            ''', (user['id'],))
            conn.commit()
            conn.close()
            
            return {'success': True, 'user': dict(user)}
        
        conn.close()
        return {'success': False, 'error': 'بيانات تسجيل الدخول غير صحيحة'}
        
    except Exception as e:
        return {'success': False, 'error': f'خطأ في التحقق: {str(e)}'}

def test_telegram_connection():
    """اختبار الاتصال بالتليجرام"""
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getMe"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            bot_info = response.json()
            if bot_info.get('ok'):
                return {
                    'success': True,
                    'bot_name': bot_info['result'].get('username', 'Unknown'),
                    'bot_id': bot_info['result'].get('id', 'Unknown')
                }
        
        return {'success': False, 'error': 'فشل في الاتصال بالبوت'}
        
    except Exception as e:
        return {'success': False, 'error': f'خطأ في الاتصال: {str(e)}'}

def update_statistics():
    """تحديث الإحصائيات اليومية"""
    conn = get_db_connection()
    today = datetime.now().date()
    
    # الحصول على إحصائيات اليوم
    stats = conn.execute('''
        SELECT COUNT(*) as total,
               SUM(CASE WHEN telegram_sent = 1 THEN 1 ELSE 0 END) as telegram_sent,
               COUNT(DISTINCT code_data) as unique_codes
        FROM scan_results 
        WHERE DATE(timestamp) = ?
    ''', (today,)).fetchone()
    
    # تحديث أو إدراج الإحصائيات
    conn.execute('''
        INSERT OR REPLACE INTO statistics (date, total_scans, successful_scans, telegram_sent, unique_codes)
        VALUES (?, ?, ?, ?, ?)
    ''', (today, stats['total'], stats['total'], stats['telegram_sent'], stats['unique_codes']))
    
    conn.commit()
    conn.close()

# ===== صفحات المصادقة =====

@app.route('/login', methods=['GET', 'POST'])
def login():
    """صفحة تسجيل الدخول"""
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            error = 'يرجى إدخال اسم المستخدم وكلمة المرور'
            if request.is_json:
                return jsonify({'success': False, 'error': error})
            flash(error, 'error')
            return render_template('login.html')
        
        auth_result = authenticate_user(username, password)
        
        if auth_result['success']:
            user = auth_result['user']
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']
            
            if request.is_json:
                return jsonify({
                    'success': True, 
                    'message': 'تم تسجيل الدخول بنجاح',
                    'redirect': url_for('index')
                })
            
            flash('تم تسجيل الدخول بنجاح', 'success')
            return redirect(url_for('index'))
        else:
            if request.is_json:
                return jsonify({'success': False, 'error': auth_result['error']})
            flash(auth_result['error'], 'error')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    """صفحة التسجيل الجديد"""
    # التحقق من السماح بالتسجيل
    registration_enabled = get_setting('registration_enabled', 'true') == 'true'
    if not registration_enabled:
        flash('التسجيل الجديد غير متاح حالياً', 'error')
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        confirm_password = data.get('confirm_password', '')
        
        # التحقق من البيانات
        if not all([username, email, password, confirm_password]):
            error = 'جميع الحقول مطلوبة'
            if request.is_json:
                return jsonify({'success': False, 'error': error})
            flash(error, 'error')
            return render_template('register.html')
        
        if password != confirm_password:
            error = 'كلمات المرور غير متطابقة'
            if request.is_json:
                return jsonify({'success': False, 'error': error})
            flash(error, 'error')
            return render_template('register.html')
        
        if len(password) < 6:
            error = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
            if request.is_json:
                return jsonify({'success': False, 'error': error})
            flash(error, 'error')
            return render_template('register.html')
        
        # إنشاء المستخدم
        create_result = create_user(username, email, password)
        
        if create_result['success']:
            if request.is_json:
                return jsonify({
                    'success': True, 
                    'message': 'تم إنشاء الحساب بنجاح، يمكنك تسجيل الدخول الآن',
                    'redirect': url_for('login')
                })
            flash('تم إنشاء الحساب بنجاح، يمكنك تسجيل الدخول الآن', 'success')
            return redirect(url_for('login'))
        else:
            if request.is_json:
                return jsonify({'success': False, 'error': create_result['error']})
            flash(create_result['error'], 'error')
    
    return render_template('register.html')

@app.route('/logout')
def logout():
    """تسجيل الخروج"""
    session.clear()
    flash('تم تسجيل الخروج بنجاح', 'info')
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    """الصفحة الرئيسية"""
    user = get_current_user()
    return render_template('index.html', user=user)

@app.route('/api/scan', methods=['POST'])
@login_required
def save_scan_result():
    """حفظ نتيجة المسح"""
    try:
        data = request.get_json()
        code_data = data.get('code_data', '')
        code_type = data.get('code_type', 'unknown')
        notes = data.get('notes', '')
        
        if not code_data:
            return jsonify({'success': False, 'error': 'لا توجد بيانات للحفظ'})
        
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'مطلوب تسجيل الدخول'})
        
        # حفظ في قاعدة البيانات
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO scan_results (code_data, code_type, user_agent, ip_address, notes, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (code_data, code_type, request.user_agent.string, request.remote_addr, notes, user['id']))
        
        result_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # إرسال إلى تليجرام
        telegram_message = f"""
🔍 <b>نتيجة مسح جديدة</b>

📊 <b>البيانات:</b> <code>{code_data}</code>
🏷️ <b>النوع:</b> {code_type}
🕒 <b>الوقت:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
🔢 <b>رقم العملية:</b> #{result_id}

💻 <b>معلومات النظام:</b>
- IP: {request.remote_addr}
- المتصفح: {request.user_agent.browser}

{f"📝 <b>ملاحظات:</b> {notes}" if notes else ""}
        """
        
        telegram_sent = send_telegram_message(telegram_message.strip())
        
        # تحديث حالة الإرسال
        if telegram_sent:
            conn = get_db_connection()
            conn.execute('UPDATE scan_results SET telegram_sent = 1 WHERE id = ?', (result_id,))
            conn.commit()
            conn.close()
        
        # تحديث الإحصائيات
        update_statistics()
        
        return jsonify({
            'success': True,
            'id': result_id,
            'telegram_sent': telegram_sent,
            'message': 'تم حفظ النتيجة بنجاح'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/results')
@login_required
def get_results():
    """الحصول على النتائج"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        search = request.args.get('search', '')
        
        offset = (page - 1) * limit
        
        conn = get_db_connection()
        
        # استعلام البحث
        where_clause = ""
        params = []
        
        if search:
            where_clause = "WHERE code_data LIKE ? OR notes LIKE ?"
            params = [f'%{search}%', f'%{search}%']
        
        # الحصول على النتائج
        query = f'''
            SELECT id, code_data, code_type, timestamp, notes, telegram_sent, ip_address
            FROM scan_results 
            {where_clause}
            ORDER BY timestamp DESC 
            LIMIT ? OFFSET ?
        '''
        
        results = conn.execute(query, params + [limit, offset]).fetchall()
        
        # عدد النتائج الكلي
        count_query = f'SELECT COUNT(*) as total FROM scan_results {where_clause}'
        total = conn.execute(count_query, params).fetchone()['total']
        
        conn.close()
        
        return jsonify({
            'success': True,
            'results': [dict(row) for row in results],
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/statistics')
def get_statistics():
    """الحصول على الإحصائيات"""
    try:
        conn = get_db_connection()
        
        # إحصائيات عامة
        general = conn.execute('''
            SELECT 
                COUNT(*) as total_scans,
                COUNT(DISTINCT code_data) as unique_codes,
                SUM(CASE WHEN telegram_sent = 1 THEN 1 ELSE 0 END) as telegram_sent,
                COUNT(DISTINCT DATE(timestamp)) as active_days
            FROM scan_results
        ''').fetchone()
        
        # إحصائيات اليوم
        today = conn.execute('''
            SELECT COUNT(*) as today_scans
            FROM scan_results 
            WHERE DATE(timestamp) = DATE('now')
        ''').fetchone()
        
        # آخر 7 أيام
        weekly = conn.execute('''
            SELECT DATE(timestamp) as date, COUNT(*) as count
            FROM scan_results 
            WHERE timestamp >= datetime('now', '-7 days')
            GROUP BY DATE(timestamp)
            ORDER BY date DESC
        ''').fetchall()
        
        # أكثر الأكواد مسحاً
        top_codes = conn.execute('''
            SELECT code_data, COUNT(*) as count
            FROM scan_results 
            GROUP BY code_data
            ORDER BY count DESC
            LIMIT 10
        ''').fetchall()
        
        conn.close()
        
        return jsonify({
            'success': True,
            'general': dict(general),
            'today': dict(today),
            'weekly': [dict(row) for row in weekly],
            'top_codes': [dict(row) for row in top_codes]
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    """إدارة الإعدادات"""
    if request.method == 'GET':
        try:
            conn = get_db_connection()
            settings = conn.execute('SELECT key, value FROM settings').fetchall()
            conn.close()
            
            settings_dict = {row['key']: row['value'] for row in settings}
            return jsonify({'success': True, 'settings': settings_dict})
            
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            
            for key, value in data.items():
                set_setting(key, value)
            
            return jsonify({'success': True, 'message': 'تم حفظ الإعدادات بنجاح'})
            
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})

@app.route('/api/export')
def export_data():
    """تصدير البيانات"""
    try:
        format_type = request.args.get('format', 'json')
        
        conn = get_db_connection()
        results = conn.execute('''
            SELECT code_data, code_type, timestamp, notes, telegram_sent
            FROM scan_results 
            ORDER BY timestamp DESC
        ''').fetchall()
        conn.close()
        
        data = [dict(row) for row in results]
        
        if format_type == 'json':
            response = app.response_class(
                response=json.dumps(data, ensure_ascii=False, indent=2),
                status=200,
                mimetype='application/json',
                headers={'Content-Disposition': 'attachment; filename=qr_data.json'}
            )
            return response
        
        elif format_type == 'csv':
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=['code_data', 'code_type', 'timestamp', 'notes', 'telegram_sent'])
            writer.writeheader()
            writer.writerows(data)
            
            response = app.response_class(
                response=output.getvalue(),
                status=200,
                mimetype='text/csv',
                headers={'Content-Disposition': 'attachment; filename=qr_data.csv'}
            )
            return response
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/dashboard')
@login_required
def dashboard():
    """لوحة التحكم"""
    user = get_current_user()
    return render_template('dashboard.html', user=user)

@app.route('/settings')
@login_required
def settings_page():
    """صفحة الإعدادات"""
    user = get_current_user()
    return render_template('settings.html', user=user)

# ===== صفحات إدارة المستخدمين =====

@app.route('/admin')
@admin_required
def admin_panel():
    """لوحة تحكم المدير"""
    user = get_current_user()
    return render_template('admin.html', user=user)

@app.route('/admin/users')
@admin_required
def admin_users():
    """إدارة المستخدمين"""
    user = get_current_user()
    return render_template('admin_users.html', user=user)

@app.route('/profile')
@login_required
def profile():
    """صفحة الملف الشخصي"""
    user = get_current_user()
    return render_template('profile.html', user=user)

# ===== API إدارة المستخدمين =====

@app.route('/api/users', methods=['GET'])
@admin_required
def get_users():
    """الحصول على قائمة المستخدمين"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        search = request.args.get('search', '')
        
        offset = (page - 1) * limit
        
        conn = get_db_connection()
        
        # استعلام البحث
        where_clause = ""
        params = []
        
        if search:
            where_clause = "WHERE username LIKE ? OR email LIKE ?"
            params = [f'%{search}%', f'%{search}%']
        
        # الحصول على المستخدمين
        query = f'''
            SELECT id, username, email, role, created_at, last_login, is_active,
                   (SELECT COUNT(*) FROM scan_results WHERE user_id = users.id) as scan_count
            FROM users 
            {where_clause}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        '''
        
        users = conn.execute(query, params + [limit, offset]).fetchall()
        
        # عدد المستخدمين الكلي
        count_query = f'SELECT COUNT(*) as total FROM users {where_clause}'
        total = conn.execute(count_query, params).fetchone()['total']
        
        conn.close()
        
        return jsonify({
            'success': True,
            'users': [dict(row) for row in users],
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/users/create', methods=['POST'])
@admin_required
def create_user_api():
    """إنشاء مستخدم جديد من المدير"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        role = data.get('role', 'user')
        
        if not all([username, email, password]):
            return jsonify({'success': False, 'error': 'جميع الحقول مطلوبة'})
        
        if len(password) < 6:
            return jsonify({'success': False, 'error': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'})
        
        result = create_user(username, email, password, role)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/current-user')
@login_required
def get_current_user_api():
    """الحصول على بيانات المستخدم الحالي"""
    user = get_current_user()
    if user:
        return jsonify({'success': True, 'user': user})
    return jsonify({'success': False, 'error': 'غير مسجل دخول'})

@app.route('/api/users/<int:user_id>', methods=['GET', 'PUT', 'DELETE'])
@admin_required
def manage_user(user_id):
    """إدارة مستخدم محدد"""
    try:
        conn = get_db_connection()
        
        if request.method == 'GET':
            # الحصول على تفاصيل المستخدم
            user = conn.execute('''
                SELECT id, username, email, role, created_at, last_login, is_active,
                       (SELECT COUNT(*) FROM scan_results WHERE user_id = ?) as scan_count
                FROM users WHERE id = ?
            ''', (user_id, user_id)).fetchone()
            
            if not user:
                conn.close()
                return jsonify({'success': False, 'error': 'المستخدم غير موجود'})
            
            conn.close()
            return jsonify({'success': True, 'user': dict(user)})
        
        elif request.method == 'PUT':
            # تحديث المستخدم
            data = request.get_json()
            username = data.get('username', '').strip()
            email = data.get('email', '').strip()
            role = data.get('role', 'user')
            is_active = data.get('is_active', True)
            
            if not username or not email:
                conn.close()
                return jsonify({'success': False, 'error': 'اسم المستخدم والبريد مطلوبان'})
            
            # التحقق من عدم تضارب الأسماء
            existing = conn.execute('''
                SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?
            ''', (username, email, user_id)).fetchone()
            
            if existing:
                conn.close()
                return jsonify({'success': False, 'error': 'اسم المستخدم أو البريد موجود بالفعل'})
            
            # تحديث المستخدم
            conn.execute('''
                UPDATE users SET username = ?, email = ?, role = ?, is_active = ?
                WHERE id = ?
            ''', (username, email, role, is_active, user_id))
            
            conn.commit()
            conn.close()
            
            return jsonify({'success': True, 'message': 'تم تحديث المستخدم بنجاح'})
        
        elif request.method == 'DELETE':
            # حذف المستخدم (تعطيل بدلاً من الحذف الفعلي)
            current_user = get_current_user()
            if current_user['id'] == user_id:
                conn.close()
                return jsonify({'success': False, 'error': 'لا يمكن حذف حسابك الخاص'})
            
            conn.execute('UPDATE users SET is_active = 0 WHERE id = ?', (user_id,))
            conn.commit()
            conn.close()
            
            return jsonify({'success': True, 'message': 'تم تعطيل المستخدم بنجاح'})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/profile', methods=['GET', 'PUT'])
@login_required
def manage_profile():
    """إدارة الملف الشخصي"""
    try:
        user = get_current_user()
        conn = get_db_connection()
        
        if request.method == 'GET':
            # الحصول على تفاصيل الملف الشخصي
            profile = conn.execute('''
                SELECT id, username, email, role, created_at, last_login,
                       (SELECT COUNT(*) FROM scan_results WHERE user_id = ?) as scan_count
                FROM users WHERE id = ?
            ''', (user['id'], user['id'])).fetchone()
            
            conn.close()
            return jsonify({'success': True, 'profile': dict(profile)})
        
        elif request.method == 'PUT':
            # تحديث الملف الشخصي
            data = request.get_json()
            username = data.get('username', '').strip()
            email = data.get('email', '').strip()
            current_password = data.get('current_password', '')
            new_password = data.get('new_password', '')
            
            if not username or not email:
                conn.close()
                return jsonify({'success': False, 'error': 'اسم المستخدم والبريد مطلوبان'})
            
            # التحقق من عدم تضارب الأسماء
            existing = conn.execute('''
                SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?
            ''', (username, email, user['id'])).fetchone()
            
            if existing:
                conn.close()
                return jsonify({'success': False, 'error': 'اسم المستخدم أو البريد موجود بالفعل'})
            
            # إذا كان يريد تغيير كلمة المرور
            if new_password:
                if not current_password:
                    conn.close()
                    return jsonify({'success': False, 'error': 'كلمة المرور الحالية مطلوبة'})
                
                # التحقق من كلمة المرور الحالية
                current_user_data = conn.execute('''
                    SELECT password_hash FROM users WHERE id = ?
                ''', (user['id'],)).fetchone()
                
                if not check_password_hash(current_user_data['password_hash'], current_password):
                    conn.close()
                    return jsonify({'success': False, 'error': 'كلمة المرور الحالية غير صحيحة'})
                
                if len(new_password) < 6:
                    conn.close()
                    return jsonify({'success': False, 'error': 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'})
                
                # تحديث مع كلمة المرور الجديدة
                new_password_hash = generate_password_hash(new_password)
                conn.execute('''
                    UPDATE users SET username = ?, email = ?, password_hash = ?
                    WHERE id = ?
                ''', (username, email, new_password_hash, user['id']))
            else:
                # تحديث بدون كلمة المرور
                conn.execute('''
                    UPDATE users SET username = ?, email = ?
                    WHERE id = ?
                ''', (username, email, user['id']))
            
            conn.commit()
            conn.close()
            
            # تحديث session
            session['username'] = username
            
            return jsonify({'success': True, 'message': 'تم تحديث الملف الشخصي بنجاح'})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/telegram/test')
def test_telegram():
    """اختبار الاتصال بالتليجرام"""
    result = test_telegram_connection()
    return jsonify(result)

@app.route('/api/telegram/info')
def telegram_info():
    """معلومات إعدادات التليجرام"""
    return jsonify({
        'success': True,
        'chat_id': TELEGRAM_CHAT_ID,
        'bot_token_preview': TELEGRAM_BOT_TOKEN[:10] + "..." + TELEGRAM_BOT_TOKEN[-10:],
        'status': 'ثابت - مُعد مسبقاً',
        'test_available': True
    })

@app.route('/diagnostics')
@login_required
def diagnostics():
    """صفحة تشخيص النظام"""
    user = get_current_user()
    return render_template('diagnostics.html', user=user)

@app.route('/api/diagnostics/telegram', methods=['POST'])
@login_required
def diagnostics_telegram():
    """تشخيص مفصل للتليجرام"""
    try:
        # اختبار البوت
        bot_test = test_telegram_connection()
        
        # اختبار إرسال رسالة
        test_message = f"🔧 اختبار تشخيص النظام - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            data = {
                'chat_id': TELEGRAM_CHAT_ID,
                'text': test_message,
                'parse_mode': 'HTML'
            }
            
            response = requests.post(url, data=data, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('ok'):
                    return jsonify({
                        'success': True,
                        'message': 'تم إرسال رسالة الاختبار بنجاح',
                        'bot_info': bot_test,
                        'send_result': result['result'],
                        'response_time': response.elapsed.total_seconds()
                    })
                else:
                    return jsonify({
                        'success': False,
                        'error': f"خطأ من التليجرام: {result.get('description', 'غير محدد')}",
                        'error_code': result.get('error_code')
                    })
            else:
                return jsonify({
                    'success': False,
                    'error': f"خطأ HTTP: {response.status_code}",
                    'details': response.text
                })
                
        except requests.exceptions.Timeout:
            return jsonify({
                'success': False,
                'error': 'انتهت مهلة الاتصال - تحقق من الإنترنت'
            })
        except requests.exceptions.ConnectionError:
            return jsonify({
                'success': False,
                'error': 'فشل الاتصال - تحقق من الإنترنت أو VPN'
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'خطأ غير متوقع: {str(e)}'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'خطأ في التشخيص: {str(e)}'
        })

@app.route('/api/diagnostics/system')
@login_required
def diagnostics_system():
    """تشخيص النظام"""
    try:
        import psutil
        import platform
        
        # معلومات النظام
        system_info = {
            'platform': platform.system(),
            'platform_release': platform.release(),
            'platform_version': platform.version(),
            'architecture': platform.machine(),
            'processor': platform.processor(),
            'python_version': platform.python_version(),
            'hostname': platform.node()
        }
        
        # معلومات الذاكرة
        memory = psutil.virtual_memory()
        memory_info = {
            'total': round(memory.total / (1024**3), 2),
            'available': round(memory.available / (1024**3), 2),
            'percent': memory.percent,
            'used': round(memory.used / (1024**3), 2)
        }
        
        # معلومات القرص
        disk = psutil.disk_usage('.')
        disk_info = {
            'total': round(disk.total / (1024**3), 2),
            'used': round(disk.used / (1024**3), 2),
            'free': round(disk.free / (1024**3), 2),
            'percent': round((disk.used / disk.total) * 100, 2)
        }
        
        # معلومات المعالج
        cpu_info = {
            'percent': psutil.cpu_percent(interval=1),
            'count': psutil.cpu_count(),
            'freq': psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None
        }
        
        return jsonify({
            'success': True,
            'system': system_info,
            'memory': memory_info,
            'disk': disk_info,
            'cpu': cpu_info
        })
        
    except ImportError:
        # إذا لم يكن psutil متوفر
        import sys
        return jsonify({
            'success': True,
            'system': {
                'platform': sys.platform,
                'python_version': sys.version,
                'executable': sys.executable
            },
            'note': 'معلومات محدودة - يُنصح بتثبيت psutil للحصول على معلومات مفصلة'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'خطأ في جمع معلومات النظام: {str(e)}'
        })

@app.route('/api/debug/info')
def debug_info():
    """Debug endpoint to check Python environment"""
    import sys
    return jsonify({
        'python_version': sys.version,
        'platform': sys.platform,
        'executable': sys.executable,
        'path': sys.path[:3],
        'status': 'Python Flask App Running Successfully! 🐍✅'
    })

if __name__ == '__main__':
    print("🐍 Starting Python Flask QR Scanner...")
    init_database()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 