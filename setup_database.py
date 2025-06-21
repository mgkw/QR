#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
إعداد قاعدة البيانات المركزية - PostgreSQL
"""

import os
import sys
import psycopg2
from psycopg2 import sql
import subprocess

def check_psycopg2():
    """التحقق من تثبيت psycopg2"""
    try:
        import psycopg2
        print("✅ psycopg2 متوفر")
        return True
    except ImportError:
        print("❌ psycopg2 غير مثبت")
        print("🔧 جارِ التثبيت...")
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'psycopg2-binary'])
            print("✅ تم تثبيت psycopg2 بنجاح")
            return True
        except subprocess.CalledProcessError:
            print("❌ فشل في تثبيت psycopg2")
            return False

def test_database_connection(database_url):
    """اختبار الاتصال بقاعدة البيانات"""
    try:
        print(f"🔗 اختبار الاتصال بـ: {database_url[:50]}...")
        conn = psycopg2.connect(database_url, sslmode='require')
        cursor = conn.cursor()
        cursor.execute('SELECT version()')
        version = cursor.fetchone()
        print(f"✅ نجح الاتصال! PostgreSQL {version[0][:20]}...")
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ فشل الاتصال: {e}")
        return False

def create_tables(database_url):
    """إنشاء الجداول في قاعدة البيانات"""
    try:
        conn = psycopg2.connect(database_url, sslmode='require')
        cursor = conn.cursor()
        
        print("📊 إنشاء جداول قاعدة البيانات...")
        
        # جدول المستخدمين
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT,
                is_owner BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(255),
                last_login TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            )
        ''')
        print("✅ تم إنشاء جدول users")
        
        # جدول المسحات
        cursor.execute('''
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
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        print("✅ تم إنشاء جدول scans")
        
        # جدول الإعدادات
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                key VARCHAR(255) UNIQUE NOT NULL,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_by VARCHAR(255)
            )
        ''')
        print("✅ تم إنشاء جدول settings")
        
        # جدول جلسات المستخدمين
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_sessions (
                id VARCHAR(36) PRIMARY KEY,
                user_id INTEGER NOT NULL,
                username VARCHAR(255) NOT NULL,
                is_owner BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                is_remember_me BOOLEAN DEFAULT FALSE,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        print("✅ تم إنشاء جدول user_sessions")
        
        conn.commit()
        cursor.close()
        conn.close()
        print("🎉 تم إنشاء جميع الجداول بنجاح!")
        return True
        
    except Exception as e:
        print(f"❌ خطأ في إنشاء الجداول: {e}")
        return False

def create_default_data(database_url):
    """إنشاء البيانات الافتراضية"""
    try:
        from werkzeug.security import generate_password_hash
        
        conn = psycopg2.connect(database_url, sslmode='require')
        cursor = conn.cursor()
        
        print("👤 إنشاء المستخدمين الافتراضيين...")
        
        # التحقق من وجود المستخدم admin
        cursor.execute('SELECT id FROM users WHERE username = %s', ['admin'])
        if not cursor.fetchone():
            # إنشاء المستخدم الأونر
            password_hash = generate_password_hash('owner123')
            cursor.execute('''
                INSERT INTO users (username, password_hash, is_owner, created_by)
                VALUES (%s, %s, TRUE, 'system')
            ''', ['admin', password_hash])
            print("✅ تم إنشاء المستخدم الأونر: admin")
        
        # التحقق من وجود المستخدم test
        cursor.execute('SELECT id FROM users WHERE username = %s', ['test'])
        if not cursor.fetchone():
            # إنشاء مستخدم تجريبي
            cursor.execute('''
                INSERT INTO users (username, created_by)
                VALUES (%s, 'system')
            ''', ['test'])
            print("✅ تم إنشاء المستخدم التجريبي: test")
        
        # إنشاء الإعدادات الافتراضية
        print("⚙️ إنشاء الإعدادات الافتراضية...")
        default_settings = [
            ('telegram_bot_token', ''),
            ('telegram_chat_id', ''),
            ('auto_send_telegram', 'false'),
            ('duplicate_detection_seconds', '20'),
            ('database_type', 'postgresql')
        ]
        
        for key, value in default_settings:
            cursor.execute('SELECT id FROM settings WHERE key = %s', [key])
            if not cursor.fetchone():
                cursor.execute('''
                    INSERT INTO settings (key, value, updated_by)
                    VALUES (%s, %s, 'system')
                ''', [key, value])
        
        print("✅ تم إنشاء الإعدادات الافتراضية")
        
        conn.commit()
        cursor.close()
        conn.close()
        print("🎉 تم إنشاء جميع البيانات الافتراضية!")
        return True
        
    except Exception as e:
        print(f"❌ خطأ في إنشاء البيانات الافتراضية: {e}")
        return False

def main():
    print("🗄️ إعداد قاعدة البيانات المركزية")
    print("=" * 40)
    
    # التحقق من psycopg2
    if not check_psycopg2():
        print("❌ لا يمكن متابعة الإعداد بدون psycopg2")
        sys.exit(1)
    
    # الحصول على رابط قاعدة البيانات
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        print("❌ متغير DATABASE_URL غير موجود")
        print("\n🔧 لإعداد قاعدة البيانات:")
        print("1. أنشئ حساب في https://supabase.com")
        print("2. أنشئ مشروع جديد")
        print("3. اذهب إلى Settings > Database")
        print("4. انسخ Connection String")
        print("5. قم بتشغيل:")
        print("   export DATABASE_URL='your_connection_string_here'")
        print("   python setup_database.py")
        return
    
    # اختبار الاتصال
    if not test_database_connection(database_url):
        print("❌ لا يمكن الاتصال بقاعدة البيانات")
        print("🔧 تأكد من صحة رابط قاعدة البيانات")
        return
    
    # إنشاء الجداول
    if not create_tables(database_url):
        print("❌ فشل في إنشاء الجداول")
        return
    
    # إنشاء البيانات الافتراضية
    if not create_default_data(database_url):
        print("❌ فشل في إنشاء البيانات الافتراضية")
        return
    
    print("\n🎉 تم إعداد قاعدة البيانات بنجاح!")
    print("🚀 يمكنك الآن تشغيل التطبيق:")
    print("   python app.py")
    print("\n👥 المستخدمون الافتراضيون:")
    print("   الأونر: admin / owner123")
    print("   تجريبي: test (بدون كلمة مرور)")

if __name__ == '__main__':
    main() 