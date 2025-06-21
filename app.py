#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🌟 قارئ الباركود المبسط - SQLite فقط
نسخة مبسطة وسهلة الاستخدام
"""

import os
import sqlite3
import json
import uuid
from datetime import datetime, timedelta
from flask import Flask, render_template_string, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import logging

# ==================== إعداد التطبيق ====================

app = Flask(__name__)
app.secret_key = 'qr-scanner-simple-app-2025'
CORS(app)

# إعداد السجلات
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# مسار قاعدة البيانات
DATABASE_PATH = 'scanner.db'

# ==================== قاعدة البيانات ====================

def init_database():
    """تهيئة قاعدة بيانات SQLite"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # جدول المستخدمين
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            is_admin BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # جدول المسحات
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY,
            barcode TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT DEFAULT '',
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # إنشاء المستخدم الافتراضي
    admin_hash = generate_password_hash('admin123')
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, password_hash, is_admin) 
        VALUES ('admin', ?, 1)
    ''', (admin_hash,))
    
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, is_admin) 
        VALUES ('guest', 0)
    ''')
    
    conn.commit()
    conn.close()
    logger.info("✅ تم تهيئة قاعدة البيانات بنجاح")

def get_db_connection():
    """إنشاء اتصال بقاعدة البيانات"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ==================== API Endpoints ====================

@app.route('/')
def index():
    """الصفحة الرئيسية"""
    return render_template_string("""
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📱 قارئ الباركود البسيط</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; color: white; text-align: center;
            display: flex; align-items: center; justify-content: center;
        }
        .container { 
            max-width: 600px; padding: 40px; 
            background: rgba(255,255,255,0.1); 
            backdrop-filter: blur(10px);
            border-radius: 20px; border: 1px solid rgba(255,255,255,0.2);
        }
        h1 { font-size: 2.5rem; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        p { font-size: 1.1rem; margin-bottom: 30px; opacity: 0.9; }
        .btn { 
            display: inline-block; padding: 15px 30px; margin: 10px;
            background: rgba(255,255,255,0.2); color: white; text-decoration: none;
            border-radius: 50px; backdrop-filter: blur(10px);
            border: 2px solid rgba(255,255,255,0.3);
            transition: all 0.3s ease; font-weight: bold;
        }
        .btn:hover { 
            background: rgba(255,255,255,0.3); 
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .btn-primary { background: linear-gradient(45deg, #ff6b6b, #ff8e8e); }
        .btn-success { background: linear-gradient(45deg, #51cf66, #69f576); }
        .stats { 
            display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;
        }
        .stat { 
            padding: 20px; background: rgba(255,255,255,0.1); 
            border-radius: 15px; backdrop-filter: blur(10px);
        }
        .stat-number { font-size: 2rem; font-weight: bold; margin-bottom: 5px; }
        .footer { margin-top: 30px; opacity: 0.8; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1><i class="fas fa-qrcode"></i> قارئ الباركود البسيط</h1>
        <p>نظام سهل وسريع لقراءة وحفظ أكواد الباركود 📊</p>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number" id="userCount">-</div>
                <div>👥 المستخدمين</div>
            </div>
            <div class="stat">
                <div class="stat-number" id="scanCount">-</div>
                <div>📱 المسحات</div>
            </div>
        </div>
        
        <a href="/scanner" class="btn btn-primary">
            <i class="fas fa-camera"></i> بدء المسح
        </a>
        <a href="/dashboard" class="btn btn-success">
            <i class="fas fa-chart-bar"></i> لوحة البيانات
        </a>
        
        <div class="footer">
            <p>نظام بسيط مع SQLite | Version 3.0</p>
            <p>تسجيل الدخول: admin / admin123 أو guest</p>
        </div>
    </div>
    
    <script>
        // تحديث الإحصائيات
        fetch('/api/stats')
            .then(r => r.json())
            .then(data => {
                document.getElementById('userCount').textContent = data.users || 0;
                document.getElementById('scanCount').textContent = data.scans || 0;
            })
            .catch(() => {
                document.getElementById('userCount').textContent = '0';
                document.getElementById('scanCount').textContent = '0';
            });
    </script>
</body>
</html>
    """)

@app.route('/scanner')
def scanner():
    """صفحة قارئ الباركود"""
    return send_from_directory('.', 'index.html')

@app.route('/dashboard')
def dashboard():
    """لوحة البيانات"""
    conn = get_db_connection()
    scans = conn.execute('''
        SELECT * FROM scans 
        ORDER BY scan_time DESC 
        LIMIT 50
    ''').fetchall()
    conn.close()
    
    return render_template_string("""
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📊 لوحة البيانات</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; color: white; padding: 20px;
        }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .btn { 
            display: inline-block; padding: 10px 20px; margin: 5px;
            background: rgba(255,255,255,0.2); color: white; text-decoration: none;
            border-radius: 25px; transition: all 0.3s ease;
        }
        .btn:hover { background: rgba(255,255,255,0.3); }
        .table-container { 
            background: rgba(255,255,255,0.1); backdrop-filter: blur(10px);
            border-radius: 15px; padding: 20px; margin: 20px auto;
            max-width: 1200px; overflow-x: auto;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.2); }
        th { background: rgba(255,255,255,0.1); font-weight: bold; }
        tr:hover { background: rgba(255,255,255,0.1); }
        .barcode { font-family: monospace; background: rgba(255,255,255,0.2); padding: 5px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1><i class="fas fa-chart-bar"></i> لوحة البيانات</h1>
        <a href="/" class="btn"><i class="fas fa-home"></i> الرئيسية</a>
        <a href="/scanner" class="btn"><i class="fas fa-camera"></i> مسح جديد</a>
    </div>
    
    <div class="table-container">
        <h3><i class="fas fa-list"></i> آخر المسحات ({{ scans|length }})</h3>
        <table>
            <thead>
                <tr>
                    <th>الوقت</th>
                    <th>المستخدم</th>
                    <th>الباركود</th>
                    <th>ملاحظات</th>
                </tr>
            </thead>
            <tbody>
                {% for scan in scans %}
                <tr>
                    <td>{{ scan.scan_time }}</td>
                    <td>{{ scan.username }}</td>
                    <td><span class="barcode">{{ scan.barcode }}</span></td>
                    <td>{{ scan.notes or '-' }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
</body>
</html>
    """, scans=scans)

@app.route('/api/stats')
def api_stats():
    """إحصائيات النظام"""
    conn = get_db_connection()
    
    user_count = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    scan_count = conn.execute('SELECT COUNT(*) FROM scans').fetchone()[0]
    
    conn.close()
    
    return jsonify({
        'users': user_count,
        'scans': scan_count,
        'database': 'SQLite',
        'version': '3.0'
    })

@app.route('/api/login', methods=['POST'])
def api_login():
    """تسجيل الدخول"""
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username:
        return jsonify({'success': False, 'message': 'اسم المستخدم مطلوب'})
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({'success': False, 'message': 'المستخدم غير موجود'})
    
    # التحقق من كلمة المرور (إذا كانت موجودة)
    if user['password_hash'] and not check_password_hash(user['password_hash'], password):
        return jsonify({'success': False, 'message': 'كلمة مرور خاطئة'})
    
    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'is_admin': bool(user['is_admin'])
        }
    })

@app.route('/api/scan', methods=['POST'])
def api_scan():
    """حفظ مسح جديد"""
    data = request.json
    barcode = data.get('barcode', '').strip()
    user_id = data.get('user_id')
    username = data.get('username', 'guest')
    notes = data.get('notes', '').strip()
    
    if not barcode:
        return jsonify({'success': False, 'message': 'الباركود مطلوب'})
    
    scan_id = str(uuid.uuid4())
    
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO scans (id, barcode, user_id, username, notes)
        VALUES (?, ?, ?, ?, ?)
    ''', (scan_id, barcode, user_id, username, notes))
    conn.commit()
    conn.close()
    
    logger.info(f"✅ مسح جديد: {barcode} بواسطة {username}")
    
    return jsonify({
        'success': True,
        'message': 'تم حفظ المسح بنجاح',
        'scan_id': scan_id
    })

@app.route('/api/scans')
def api_scans():
    """قائمة المسحات"""
    limit = request.args.get('limit', 20, type=int)
    
    conn = get_db_connection()
    scans = conn.execute('''
        SELECT * FROM scans 
        ORDER BY scan_time DESC 
        LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    
    return jsonify([dict(scan) for scan in scans])

@app.route('/api/delete_scan/<scan_id>', methods=['DELETE'])
def api_delete_scan(scan_id):
    """حذف مسح"""
    conn = get_db_connection()
    conn.execute('DELETE FROM scans WHERE id = ?', (scan_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'تم حذف المسح'})

# ==================== ملفات ثابتة ====================

@app.route('/styles.css')
def styles():
    return send_from_directory('.', 'styles.css')

@app.route('/script.js')
def script():
    return send_from_directory('.', 'script.js')

# ==================== بدء التطبيق ====================

if __name__ == '__main__':
    # تهيئة قاعدة البيانات
    init_database()
    
    # بدء الخادم
    port = int(os.environ.get('PORT', 5000))
    
    logger.info("🚀 بدء تشغيل قارئ الباركود البسيط...")
    logger.info(f"📊 قاعدة البيانات: {DATABASE_PATH}")
    logger.info(f"🌐 الخادم: http://localhost:{port}")
    
    app.run(host='0.0.0.0', port=port, debug=True) 