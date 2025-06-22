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
    
    # جدول النتائج المحسن
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
            is_duplicate BOOLEAN DEFAULT 0,
            previous_time TEXT,
            current_time TEXT,
            has_images BOOLEAN DEFAULT 0,
            image_count INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # إضافة الأعمدة الجديدة للجداول الموجودة (إذا لم تكن موجودة)
    try:
        cursor.execute('ALTER TABLE scan_results ADD COLUMN user_id INTEGER')
    except sqlite3.OperationalError:
        pass  # العمود موجود بالفعل
    
    try:
        cursor.execute('ALTER TABLE scan_results ADD COLUMN is_duplicate BOOLEAN DEFAULT 0')
    except sqlite3.OperationalError:
        pass  # العمود موجود بالفعل
    
    try:
        cursor.execute('ALTER TABLE scan_results ADD COLUMN previous_time TEXT')
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute('ALTER TABLE scan_results ADD COLUMN current_time TEXT')
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute('ALTER TABLE scan_results ADD COLUMN has_images BOOLEAN DEFAULT 0')
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute('ALTER TABLE scan_results ADD COLUMN image_count INTEGER DEFAULT 0')
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute('ALTER TABLE scan_results ADD COLUMN telegram_attempts INTEGER DEFAULT 0')
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute('ALTER TABLE scan_results ADD COLUMN telegram_error TEXT')
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute('ALTER TABLE scan_results ADD COLUMN last_retry_attempt DATETIME')
    except sqlite3.OperationalError:
        pass
    
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
        ('registration_enabled', 'false'),
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
        print("   👑 النظام الجديد: المدير ينشئ حسابات بأسماء فقط!")
    
    conn.commit()
    conn.close()

def get_db_connection():
    """الحصول على اتصال قاعدة البيانات مع التأكد من وجود الجداول"""
    try:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        
        # التحقق من وجود جدول users - إذا لم يكن موجوداً، أنشئ قاعدة البيانات
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT COUNT(*) FROM users LIMIT 1")
        except sqlite3.OperationalError as e:
            if "no such table" in str(e).lower():
                print("🔧 جدول المستخدمين غير موجود - بدء إنشاء قاعدة البيانات...")
                conn.close()
                init_database()
                # إعادة الاتصال بعد إنشاء الجداول
                conn = sqlite3.connect(DATABASE)
                conn.row_factory = sqlite3.Row
        
        return conn
    except Exception as e:
        print(f"❌ خطأ في الاتصال بقاعدة البيانات: {e}")
        # محاولة إنشاء قاعدة البيانات في حالة الخطأ
        try:
            init_database()
            conn = sqlite3.connect(DATABASE)
            conn.row_factory = sqlite3.Row
            return conn
        except Exception as init_error:
            print(f"❌ فشل في إنشاء قاعدة البيانات: {init_error}")
            raise init_error

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

def create_user(username, email='', password='', role='user'):
    """إنشاء مستخدم جديد - بكلمة مرور اختيارية"""
    try:
        conn = get_db_connection()
        
        # التحقق من عدم وجود اسم المستخدم
        existing = conn.execute('''
            SELECT id FROM users WHERE username = ?
        ''', (username,)).fetchone()
        
        if existing:
            conn.close()
            return {'success': False, 'error': 'اسم المستخدم موجود بالفعل'}
        
        # إذا لم يتم توفير بريد، استخدم اسم المستخدم
        if not email:
            email = f"{username}@local.system"
        
        # تشفير كلمة المرور إذا تم توفيرها، أو استخدام hash فارغ
        if password:
            password_hash = generate_password_hash(password)
        else:
            password_hash = ''  # بدون كلمة مرور
        
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

def authenticate_user(username, password=''):
    """التحقق من بيانات المستخدم - كلمة المرور اختيارية"""
    try:
        conn = get_db_connection()
        user = conn.execute('''
            SELECT id, username, email, password_hash, role, is_active
            FROM users WHERE username = ? AND is_active = 1
        ''', (username,)).fetchone()
        
        if user:
            # إذا كان للمستخدم كلمة مرور، تحقق منها
            if user['password_hash']:
                if password and check_password_hash(user['password_hash'], password):
                    auth_success = True
                else:
                    conn.close()
                    return {'success': False, 'error': 'كلمة المرور مطلوبة وغير صحيحة'}
            else:
                # إذا لم تكن هناك كلمة مرور، السماح بالدخول
                auth_success = True
            
            if auth_success:
                # تحديث وقت آخر تسجيل دخول
                conn.execute('''
                    UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
                ''', (user['id'],))
                conn.commit()
                conn.close()
                
                return {'success': True, 'user': dict(user)}
        
        conn.close()
        return {'success': False, 'error': 'اسم المستخدم غير موجود'}
        
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

def send_telegram_with_retry(code_data, code_type, notes, images, is_duplicate=False, max_retries=3, result_id=None):
    """إرسال متقدم للتليجرام مع إعادة المحاولة المحسنة"""
    last_error = ""
    
    for attempt in range(1, max_retries + 1):
        try:
            # إعدادات ثابتة
            bot_token = TELEGRAM_BOT_TOKEN
            chat_id = TELEGRAM_CHAT_ID
            
            if not bot_token or not chat_id:
                last_error = "إعدادات تليجرام غير مكتملة"
                print(f"محاولة {attempt}: {last_error}")
                if attempt < max_retries:
                    time.sleep(attempt * 2)
                    continue
                break
            
            # إنشاء الرسالة
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            if is_duplicate:
                message = f"""
⚠️ <b>باركود مكرر - إرسال مكرر</b>

📊 <b>البيانات:</b> <code>{code_data}</code>
🏷️ <b>النوع:</b> {code_type}
🔄 <b>حالة:</b> مكرر - تم الإرسال بواسطة المستخدم
🕒 <b>وقت الإرسال:</b> {current_time}
🔄 <b>المحاولة:</b> {attempt}/{max_retries}

{f"📝 <b>ملاحظات:</b> {notes}" if notes else ""}

🖼️ <b>الصور المرفقة:</b> {len(images)}
                """
            else:
                message = f"""
🔍 <b>مسح باركود جديد</b>

📊 <b>البيانات:</b> <code>{code_data}</code>
🏷️ <b>النوع:</b> {code_type}
🕒 <b>الوقت:</b> {current_time}
⚡ <b>المصدر:</b> ماسح متقدم
🔄 <b>المحاولة:</b> {attempt}/{max_retries}

{f"📝 <b>ملاحظات:</b> {notes}" if notes else ""}

🖼️ <b>الصور المرفقة:</b> {len(images)}
                """
            
            message = message.strip()
            
            # إرسال الرسالة النصية أولاً
            text_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            text_data = {
                'chat_id': chat_id,
                'text': message,
                'parse_mode': 'HTML'
            }
            
            text_response = requests.post(text_url, data=text_data, timeout=30)
            
            if text_response.status_code != 200:
                last_error = f"HTTP {text_response.status_code}: {text_response.text[:100]}"
                print(f"محاولة {attempt} فشلت في إرسال النص: {last_error}")
                
                if attempt < max_retries:
                    time.sleep(attempt * 2)  # انتظار متزايد
                    continue
                break
            
            # إرسال الصور
            photo_url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
            images_sent = 0
            
            for image_label, image_path in images:
                if os.path.exists(image_path):
                    try:
                        with open(image_path, 'rb') as photo:
                            files_data = {
                                'chat_id': chat_id,
                                'caption': f"📷 {image_label} (محاولة {attempt})",
                                'parse_mode': 'HTML'
                            }
                            files = {'photo': photo}
                            
                            photo_response = requests.post(photo_url, data=files_data, files=files, timeout=30)
                            
                            if photo_response.status_code == 200:
                                images_sent += 1
                                print(f"تم إرسال الصورة {image_label} بنجاح في المحاولة {attempt}")
                            else:
                                print(f"فشل في إرسال الصورة {image_label}: {photo_response.status_code}")
                                
                            # انتظار قصير بين الصور
                            time.sleep(0.5)
                            
                    except Exception as img_error:
                        print(f"خطأ في إرسال الصورة {image_label}: {img_error}")
                        continue
                else:
                    print(f"الصورة غير موجودة: {image_path}")
            
            # تحديث قاعدة البيانات بنجاح الإرسال
            if result_id:
                try:
                    conn = get_db_connection()
                    conn.execute('''
                        UPDATE scan_results 
                        SET telegram_sent = 1, telegram_attempts = ?, telegram_error = NULL, last_retry_attempt = CURRENT_TIMESTAMP
                        WHERE id = ?
                    ''', (attempt, result_id))
                    conn.commit()
                    conn.close()
                except Exception as db_error:
                    print(f"خطأ في تحديث قاعدة البيانات: {db_error}")
            
            print(f"✅ تم الإرسال بنجاح في المحاولة {attempt}")
            return True
            
        except requests.exceptions.Timeout:
            last_error = f"انتهت مهلة الاتصال (محاولة {attempt})"
            print(last_error)
        except requests.exceptions.ConnectionError:
            last_error = f"خطأ في الاتصال بالإنترنت (محاولة {attempt})"
            print(last_error)
        except Exception as e:
            last_error = f"خطأ غير متوقع: {str(e)} (محاولة {attempt})"
            print(last_error)
        
        # انتظار قبل المحاولة التالية
        if attempt < max_retries:
            wait_time = attempt * 2
            print(f"انتظار {wait_time} ثانية قبل المحاولة التالية...")
            time.sleep(wait_time)
    
    # حفظ الخطأ الأخير في قاعدة البيانات
    if result_id:
        try:
            conn = get_db_connection()
            conn.execute('''
                UPDATE scan_results 
                SET telegram_sent = 0, telegram_attempts = ?, telegram_error = ?, last_retry_attempt = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (max_retries, last_error, result_id))
            conn.commit()
            conn.close()
        except Exception as db_error:
            print(f"خطأ في حفظ خطأ التليجرام: {db_error}")
    
    print(f"❌ فشل في الإرسال بعد {max_retries} محاولات. آخر خطأ: {last_error}")
    return False

def send_advanced_telegram(code_data, code_type, notes, images, is_duplicate=False):
    """الدالة القديمة للتوافق مع الكود السابق"""
    return send_telegram_with_retry(code_data, code_type, notes, images, is_duplicate, 3, None)

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
        
        if not username:
            error = 'يرجى إدخال اسم المستخدم'
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

@app.route('/register')
def register():
    """صفحة التسجيل معطلة - المدير فقط ينشئ الحسابات"""
    flash('التسجيل الجديد متاح فقط للمدير. اطلب من المدير إنشاء حساب لك.', 'info')
    return redirect(url_for('login'))

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
    """حفظ نتيجة المسح المتقدم مع الصور ومعالجة التكرارات"""
    try:
        # التحقق من نوع البيانات
        if request.content_type and 'multipart/form-data' in request.content_type:
            # بيانات مع ملفات
            code_data = request.form.get('code_data', '').strip()
            code_type = request.form.get('code_type', 'unknown')
            notes = request.form.get('notes', '')
            is_duplicate = request.form.get('is_duplicate', 'false').lower() == 'true'
        else:
            # بيانات JSON عادية
            data = request.get_json()
            code_data = data.get('code_data', '')
            code_type = data.get('code_type', 'unknown')
            notes = data.get('notes', '')
            is_duplicate = data.get('is_duplicate', False)
        
        if not code_data:
            return jsonify({'success': False, 'error': 'لا توجد بيانات للحفظ'})
        
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'مطلوب تسجيل الدخول'})
        
        # معالجة الصور
        image_paths = []
        uploaded_images = []
        
        # صورة الباركود الحالية
        if 'image' in request.files:
            image = request.files['image']
            if image and image.filename:
                filename = secure_filename(f"barcode_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{image.filename}")
                image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                image.save(image_path)
                image_paths.append(image_path)
                uploaded_images.append(('صورة الباركود', image_path))
        
        # صور التكرار
        if is_duplicate:
            if 'previous_image' in request.files:
                prev_image = request.files['previous_image']
                if prev_image and prev_image.filename:
                    filename = secure_filename(f"previous_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{prev_image.filename}")
                    image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    prev_image.save(image_path)
                    image_paths.append(image_path)
                    uploaded_images.append(('المسح السابق', image_path))
            
            if 'current_image' in request.files:
                curr_image = request.files['current_image']
                if curr_image and curr_image.filename:
                    filename = secure_filename(f"current_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{curr_image.filename}")
                    image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    curr_image.save(image_path)
                    image_paths.append(image_path)
                    uploaded_images.append(('المسح الحالي', image_path))
        
        # حفظ في قاعدة البيانات
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # بيانات إضافية للتكرار
        previous_time = request.form.get('previous_time', '') if hasattr(request, 'form') else ''
        current_time = request.form.get('current_time', '') if hasattr(request, 'form') else ''
        
        cursor.execute('''
            INSERT INTO scan_results (
                code_data, code_type, user_agent, ip_address, notes, user_id,
                is_duplicate, previous_time, current_time, has_images, image_count
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            code_data, code_type, request.user_agent.string, request.remote_addr, notes, user['id'],
            is_duplicate, previous_time, current_time, len(image_paths) > 0, len(image_paths)
        ))
        
        result_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # إرسال إلى التليجرام مع نظام إعادة المحاولة المحسن
        if uploaded_images:
            # استخدام الدالة المتقدمة للصور مع إعادة المحاولة
            telegram_success = send_telegram_with_retry(code_data, code_type, notes, uploaded_images, is_duplicate, 3, result_id)
        else:
            # إرسال رسالة نصية بسيطة
            telegram_message = f"""
🔍 <b>نتيجة مسح جديدة</b>

📊 <b>البيانات:</b> <code>{code_data}</code>
🏷️ <b>النوع:</b> {code_type}
🕒 <b>الوقت:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
🔢 <b>رقم العملية:</b> #{result_id}
👤 <b>المستخدم:</b> {user['username']}

💻 <b>معلومات النظام:</b>
- IP: {request.remote_addr}
- المتصفح: {request.user_agent.browser}

{f"📝 <b>ملاحظات:</b> {notes}" if notes else ""}
            """
            # إعادة المحاولة للرسائل النصية
            telegram_success = False
            max_retries = 3
            last_error = ""
            
            for attempt in range(1, max_retries + 1):
                try:
                    if send_telegram_message(telegram_message.strip()):
                        telegram_success = True
                        # تحديث قاعدة البيانات بنجاح الإرسال
                        conn = get_db_connection()
                        conn.execute('''
                            UPDATE scan_results 
                            SET telegram_sent = 1, telegram_attempts = ?, telegram_error = NULL, last_retry_attempt = CURRENT_TIMESTAMP
                            WHERE id = ?
                        ''', (attempt, result_id))
                        conn.commit()
                        conn.close()
                        print(f"✅ تم إرسال الرسالة النصية بنجاح في المحاولة {attempt}")
                        break
                    else:
                        last_error = f"فشل إرسال الرسالة النصية في المحاولة {attempt}"
                        print(last_error)
                        
                except Exception as telegram_error:
                    last_error = f"خطأ في المحاولة {attempt}: {str(telegram_error)}"
                
                if attempt < max_retries:
                    time.sleep(attempt * 2)
            
            # حفظ الخطأ إذا فشلت جميع المحاولات
            if not telegram_success:
                conn = get_db_connection()
                conn.execute('''
                    UPDATE scan_results 
                    SET telegram_sent = 0, telegram_attempts = ?, telegram_error = ?, last_retry_attempt = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (max_retries, last_error, result_id))
                conn.commit()
                conn.close()
        
        # تحديث الإحصائيات
        update_statistics()
        
        return jsonify({
            'success': True,
            'id': result_id,
            'telegram_sent': telegram_success,
            'images_saved': len(image_paths),
            'is_duplicate': is_duplicate,
            'message': 'تم حفظ النتيجة بنجاح',
            'telegram_attempts': max_retries if not telegram_success else min(max_retries, attempt)
        })
        
    except Exception as e:
        print(f"خطأ في save_scan_result: {e}")
        return jsonify({'success': False, 'error': f'خطأ في معالجة الطلب: {str(e)}'})

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
        
        # الحصول على النتائج مع معلومات إعادة المحاولة
        query = f'''
            SELECT id, code_data, code_type, timestamp, notes, telegram_sent, ip_address,
                   telegram_attempts, telegram_error, last_retry_attempt, is_duplicate
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

@app.route('/api/telegram/retry/<int:result_id>', methods=['POST'])
@login_required
def retry_telegram_send(result_id):
    """إعادة محاولة إرسال رسالة فاشلة إلى التليجرام"""
    try:
        conn = get_db_connection()
        
        # الحصول على بيانات النتيجة
        result = conn.execute('''
            SELECT id, code_data, code_type, notes, telegram_sent, 
                   is_duplicate, previous_time, current_time, has_images, image_count
            FROM scan_results WHERE id = ?
        ''', (result_id,)).fetchone()
        
        if not result:
            conn.close()
            return jsonify({'success': False, 'error': 'النتيجة غير موجودة'})
        
        if result['telegram_sent']:
            conn.close()
            return jsonify({'success': False, 'error': 'تم إرسال هذه الرسالة بالفعل'})
        
        conn.close()
        
        # البحث عن الصور المرتبطة
        images = []
        if result['has_images'] and result['image_count'] > 0:
            # محاولة العثور على الصور في مجلد الرفع
            upload_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
            if os.path.exists(upload_folder):
                # البحث عن الصور بناءً على timestamp أو result_id
                for filename in os.listdir(upload_folder):
                    if f"_{result_id}_" in filename or str(result['code_data'])[:10] in filename:
                        image_path = os.path.join(upload_folder, filename)
                        if filename.startswith('barcode_'):
                            images.append(('صورة الباركود', image_path))
                        elif filename.startswith('previous_'):
                            images.append(('المسح السابق', image_path))
                        elif filename.startswith('current_'):
                            images.append(('المسح الحالي', image_path))
        
        # إعادة المحاولة
        if images:
            telegram_success = send_telegram_with_retry(
                result['code_data'], 
                result['code_type'], 
                result['notes'], 
                images, 
                result['is_duplicate'], 
                3, 
                result_id
            )
        else:
            # إرسال رسالة نصية
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            telegram_message = f"""
🔄 <b>إعادة إرسال - نتيجة مسح</b>

📊 <b>البيانات:</b> <code>{result['code_data']}</code>
🏷️ <b>النوع:</b> {result['code_type']}
🕒 <b>وقت الإعادة:</b> {current_time}
🔢 <b>رقم العملية:</b> #{result_id}
🔄 <b>حالة:</b> إعادة محاولة يدوية

{f"📝 <b>ملاحظات:</b> {result['notes']}" if result['notes'] else ""}
            """
            
            # محاولة إرسال الرسالة النصية مع إعادة المحاولة
            telegram_success = False
            max_retries = 3
            last_error = ""
            
            for attempt in range(1, max_retries + 1):
                try:
                    if send_telegram_message(telegram_message.strip()):
                        telegram_success = True
                        # تحديث قاعدة البيانات
                        conn = get_db_connection()
                        conn.execute('''
                            UPDATE scan_results 
                            SET telegram_sent = 1, telegram_attempts = ?, telegram_error = NULL, last_retry_attempt = CURRENT_TIMESTAMP
                            WHERE id = ?
                        ''', (attempt, result_id))
                        conn.commit()
                        conn.close()
                        break
                    else:
                        last_error = f"فشل في المحاولة {attempt}"
                        
                except Exception as e:
                    last_error = f"خطأ في المحاولة {attempt}: {str(e)}"
                
                if attempt < max_retries:
                    time.sleep(attempt * 2)
            
            # حفظ الخطأ إذا فشلت جميع المحاولات
            if not telegram_success:
                conn = get_db_connection()
                conn.execute('''
                    UPDATE scan_results 
                    SET telegram_sent = 0, telegram_attempts = ?, telegram_error = ?, last_retry_attempt = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (max_retries, last_error, result_id))
                conn.commit()
                conn.close()
        
        if telegram_success:
            return jsonify({
                'success': True, 
                'message': 'تم إعادة الإرسال بنجاح',
                'result_id': result_id
            })
        else:
            return jsonify({
                'success': False, 
                'error': 'فشل في إعادة الإرسال بعد عدة محاولات',
                'result_id': result_id
            })
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'خطأ في إعادة المحاولة: {str(e)}'})

@app.route('/api/telegram/failed')
@login_required
def get_failed_telegram_messages():
    """الحصول على الرسائل الفاشلة التي تحتاج إعادة محاولة"""
    try:
        conn = get_db_connection()
        
        failed_messages = conn.execute('''
            SELECT id, code_data, code_type, timestamp, notes, telegram_attempts, 
                   telegram_error, last_retry_attempt, is_duplicate
            FROM scan_results 
            WHERE telegram_sent = 0
            ORDER BY timestamp DESC 
            LIMIT 50
        ''').fetchall()
        
        conn.close()
        
        return jsonify({
            'success': True,
            'failed_messages': [dict(msg) for msg in failed_messages],
            'count': len(failed_messages)
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
        
        # الحصول على المستخدمين مع معالجة أفضل لعمود user_id
        query = f'''
            SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login, u.is_active,
                   COALESCE((SELECT COUNT(*) FROM scan_results sr WHERE sr.user_id = u.id), 0) as scan_count
            FROM users u
            {where_clause}
            ORDER BY u.created_at DESC 
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
    """إنشاء مستخدم جديد من المدير - كلمة المرور اختيارية"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        role = data.get('role', 'user')
        
        if not username:
            return jsonify({'success': False, 'error': 'اسم المستخدم مطلوب'})
        
        # كلمة المرور اختيارية - إذا تم توفيرها، تحقق من طولها
        if password and len(password) < 6:
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
                SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login, u.is_active,
                       COALESCE((SELECT COUNT(*) FROM scan_results sr WHERE sr.user_id = u.id), 0) as scan_count
                FROM users u WHERE u.id = ?
            ''', (user_id,)).fetchone()
            
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
            # حذف أو تعطيل المستخدم
            action = request.args.get('action', 'disable')  # disable أو delete
            current_user = get_current_user()
            
            if current_user['id'] == user_id:
                conn.close()
                return jsonify({'success': False, 'error': 'لا يمكن حذف أو تعطيل حسابك الخاص'})
            
            # التحقق من أن المستخدم ليس مالك النظام
            user_to_manage = conn.execute('SELECT role FROM users WHERE id = ?', (user_id,)).fetchone()
            if user_to_manage and user_to_manage['role'] == 'owner':
                conn.close()
                return jsonify({'success': False, 'error': 'لا يمكن حذف أو تعطيل مالك النظام'})
            
            if action == 'disable':
                # تعطيل المستخدم
                conn.execute('UPDATE users SET is_active = 0 WHERE id = ?', (user_id,))
                conn.commit()
                conn.close()
                return jsonify({'success': True, 'message': 'تم تعطيل المستخدم بنجاح'})
            
            elif action == 'delete':
                # حذف نهائي - حذف السجلات المرتبطة أولاً
                try:
                    # حذف جلسات المستخدم
                    conn.execute('DELETE FROM user_sessions WHERE user_id = ?', (user_id,))
                    
                    # تحديث scan_results لإزالة المرجع للمستخدم المحذوف
                    conn.execute('UPDATE scan_results SET user_id = NULL WHERE user_id = ?', (user_id,))
                    
                    # حذف المستخدم نهائياً
                    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
                    
                    conn.commit()
                    conn.close()
                    return jsonify({'success': True, 'message': 'تم حذف المستخدم نهائياً'})
                    
                except Exception as e:
                    conn.rollback()
                    conn.close()
                    return jsonify({'success': False, 'error': f'خطأ في الحذف: {str(e)}'})
            
            else:
                conn.close()
                return jsonify({'success': False, 'error': 'عملية غير صحيحة'})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/users/<int:user_id>/activate', methods=['POST'])
@admin_required
def activate_user(user_id):
    """إعادة تفعيل مستخدم معطل"""
    try:
        conn = get_db_connection()
        
        # التحقق من وجود المستخدم
        user = conn.execute('SELECT id, username, is_active FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            conn.close()
            return jsonify({'success': False, 'error': 'المستخدم غير موجود'})
        
        if user['is_active']:
            conn.close()
            return jsonify({'success': False, 'error': 'المستخدم نشط بالفعل'})
        
        # إعادة تفعيل المستخدم
        conn.execute('UPDATE users SET is_active = 1 WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': f'تم إعادة تفعيل المستخدم "{user["username"]}" بنجاح'})
        
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
                SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login,
                       COALESCE((SELECT COUNT(*) FROM scan_results sr WHERE sr.user_id = u.id), 0) as scan_count
                FROM users u WHERE u.id = ?
            ''', (user['id'],)).fetchone()
            
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

@app.route('/api/init-database', methods=['POST'])
def init_database_endpoint():
    """Endpoint لإنشاء قاعدة البيانات يدوياً - مفيد لخادم Render"""
    try:
        print("🔧 بدء إنشاء قاعدة البيانات من خلال API...")
        init_database()
        
        # التحقق من نجاح الإنشاء
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # فحص الجداول المنشأة
        tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
        table_names = [table[0] for table in tables]
        
        # فحص عدد المستخدمين
        user_count = 0
        if 'users' in table_names:
            user_count = cursor.execute("SELECT COUNT(*) as count FROM users").fetchone()[0]
        
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'تم إنشاء قاعدة البيانات بنجاح',
            'tables_created': table_names,
            'users_count': user_count,
            'database_path': DATABASE
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'فشل في إنشاء قاعدة البيانات: {str(e)}'
        })

@app.route('/api/force-init', methods=['GET'])
def force_init_database():
    """Force database initialization - يمكن استدعاؤه من المتصفح مباشرة"""
    try:
        print("🔧 إجبار إنشاء قاعدة البيانات...")
        
        # حذف قاعدة البيانات الموجودة وإعادة إنشائها
        if os.path.exists(DATABASE):
            print(f"🗑️ حذف قاعدة البيانات القديمة: {DATABASE}")
            os.remove(DATABASE)
        
        # إنشاء قاعدة البيانات من جديد
        init_database()
        
        # التحقق من النتائج
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
        table_names = [table[0] for table in tables]
        
        # إحصائيات
        stats = {}
        for table in table_names:
            try:
                count = cursor.execute(f"SELECT COUNT(*) as count FROM {table}").fetchone()[0]
                stats[table] = count
            except:
                stats[table] = 'خطأ في العد'
        
        conn.close()
        
        html_response = f"""
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تهيئة قاعدة البيانات</title>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; background: #f5f5f5; }}
                .container {{ background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                .success {{ color: #28a745; }}
                .info {{ background: #e9ecef; padding: 15px; border-radius: 5px; margin: 10px 0; }}
                .table-list {{ margin: 15px 0; }}
                .table-item {{ padding: 8px; background: #f8f9fa; margin: 5px 0; border-radius: 3px; }}
                .button {{ background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 5px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1 class="success">✅ تم إنشاء قاعدة البيانات بنجاح!</h1>
                
                <div class="info">
                    <h3>📊 الجداول المنشأة:</h3>
                    <div class="table-list">
                        {''.join([f'<div class="table-item">📋 {table}: {stats.get(table, 0)} سجل</div>' for table in table_names])}
                    </div>
                </div>
                
                <div class="info">
                    <h3>ℹ️ معلومات النظام:</h3>
                    <p><strong>مسار قاعدة البيانات:</strong> {DATABASE}</p>
                    <p><strong>عدد الجداول:</strong> {len(table_names)}</p>
                    <p><strong>حالة النظام:</strong> جاهز للاستخدام</p>
                </div>
                
                <div>
                    <a href="/login" class="button">🔐 تسجيل الدخول</a>
                    <a href="/" class="button">🏠 الصفحة الرئيسية</a>
                    <a href="/api/debug/info" class="button">🔍 معلومات النظام</a>
                </div>
                
                <div class="info">
                    <h4>🔑 بيانات المدير الافتراضي:</h4>
                    <p><strong>اسم المستخدم:</strong> admin</p>
                    <p><strong>كلمة المرور:</strong> admin123</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html_response
        
    except Exception as e:
        error_html = f"""
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>خطأ في التهيئة</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }}
                .container {{ background: white; padding: 30px; border-radius: 10px; }}
                .error {{ color: #dc3545; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1 class="error">❌ فشل في إنشاء قاعدة البيانات</h1>
                <p><strong>الخطأ:</strong> {str(e)}</p>
                <a href="/api/force-init">🔄 إعادة المحاولة</a>
            </div>
        </body>
        </html>
        """
        return error_html

if __name__ == '__main__':
    print("🐍 Starting Python Flask QR Scanner...")
    init_database()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 