#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
قارئ الباركود المتطور - تطبيق Python مع SQLite
QR Scanner Advanced - Python Application with SQLite
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
import sqlite3
import json
import requests
from datetime import datetime
import os
import threading
import time
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = 'qr-scanner-secret-key-2024'
app.config['UPLOAD_FOLDER'] = 'uploads'

# إنشاء مجلد الرفع
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# إعدادات قاعدة البيانات
DATABASE = 'qr_scanner.db'

def init_database():
    """إنشاء قاعدة البيانات والجداول"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # جدول النتائج
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
            image_path TEXT
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
    
    # إدراج الإعدادات الافتراضية
    default_settings = [
        ('telegram_bot_token', ''),
        ('telegram_chat_id', ''),
        ('scanner_continuous', 'true'),
        ('scanner_sound', 'true'),
        ('scanner_duplicate_delay', '3000'),
        ('app_title', 'قارئ الباركود المتطور'),
        ('theme_color', '#4CAF50')
    ]
    
    for key, value in default_settings:
        cursor.execute('''
            INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
        ''', (key, value))
    
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
    """إرسال رسالة إلى تليجرام"""
    try:
        bot_token = get_setting('telegram_bot_token')
        chat_id = get_setting('telegram_chat_id')
        
        if not bot_token or not chat_id:
            return False
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        
        data = {
            'chat_id': chat_id,
            'text': message,
            'parse_mode': 'HTML'
        }
        
        response = requests.post(url, data=data, timeout=10)
        
        # إرسال صورة إضافية إن وجدت
        if image_path and os.path.exists(image_path):
            photo_url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
            with open(image_path, 'rb') as photo:
                files = {'photo': photo}
                photo_data = {'chat_id': chat_id, 'caption': 'صورة الباركود'}
                requests.post(photo_url, data=photo_data, files=files, timeout=10)
        
        return response.status_code == 200
        
    except Exception as e:
        print(f"خطأ في إرسال تليجرام: {e}")
        return False

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

@app.route('/')
def index():
    """الصفحة الرئيسية"""
    return render_template('index.html')

@app.route('/api/scan', methods=['POST'])
def save_scan_result():
    """حفظ نتيجة المسح"""
    try:
        data = request.get_json()
        code_data = data.get('code_data', '')
        code_type = data.get('code_type', 'unknown')
        notes = data.get('notes', '')
        
        if not code_data:
            return jsonify({'success': False, 'error': 'لا توجد بيانات للحفظ'})
        
        # حفظ في قاعدة البيانات
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO scan_results (code_data, code_type, user_agent, ip_address, notes)
            VALUES (?, ?, ?, ?, ?)
        ''', (code_data, code_type, request.user_agent.string, request.remote_addr, notes))
        
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
def dashboard():
    """لوحة التحكم"""
    return render_template('dashboard.html')

@app.route('/settings')
def settings_page():
    """صفحة الإعدادات"""
    return render_template('settings.html')

if __name__ == '__main__':
    # إنشاء قاعدة البيانات
    init_database()
    
    # تشغيل التطبيق
    print("🚀 تشغيل قارئ الباركود المتطور...")
    print("📱 الرابط: http://localhost:5000")
    print("📊 لوحة التحكم: http://localhost:5000/dashboard")
    print("⚙️ الإعدادات: http://localhost:5000/settings")
    
    app.run(debug=True, host='0.0.0.0', port=5000) 