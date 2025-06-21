#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🌍 قارئ الباركود العالمي - أداة التشغيل السريع
أداة تشغيل محلية لاختبار النظام العالمي قبل النشر
"""

import os
import sys
import subprocess
import webbrowser
import time
import signal
import platform
from datetime import datetime

def print_banner():
    """طباعة عنوان جميل"""
    banner = """
╔══════════════════════════════════════════════════════════════╗
║                🌍 قارئ الباركود العالمي 🌍                 ║
║                     Global QR Scanner                       ║
║                                                              ║
║                 🚀 أداة التشغيل السريع 🚀                  ║
╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)

def check_python_version():
    """التحقق من إصدار Python"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ خطأ: يتطلب Python 3.8 أو أحدث")
        print(f"📦 الإصدار الحالي: {sys.version}")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
    return True

def check_dependencies():
    """التحقق من المكتبات المطلوبة"""
    print("\n🔍 التحقق من المكتبات المطلوبة...")
    
    required_packages = [
        'flask',
        'flask_cors', 
        'psycopg2',
        'requests',
        'pytz',
        'werkzeug'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} - غير مثبت")
            missing_packages.append(package)
    
    return missing_packages

def install_dependencies(missing_packages):
    """تثبيت المكتبات الناقصة"""
    if not missing_packages:
        return True
        
    print(f"\n📦 تثبيت {len(missing_packages)} مكتبة ناقصة...")
    
    try:
        subprocess.check_call([
            sys.executable, '-m', 'pip', 'install', 
            '-r', 'requirements.txt'
        ])
        print("✅ تم تثبيت جميع المكتبات بنجاح")
        return True
    except subprocess.CalledProcessError:
        print("❌ فشل في تثبيت المكتبات")
        print("💡 جرب: pip install -r requirements.txt")
        return False

def setup_environment():
    """إعداد متغيرات البيئة للاختبار المحلي"""
    print("\n⚙️ إعداد البيئة المحلية...")
    
    # متغيرات البيئة للاختبار المحلي
    env_vars = {
        'FLASK_ENV': 'development',
        'SECRET_KEY': 'local-development-secret-key-2025',
        'PORT': '5000',
        'PYTHONUNBUFFERED': '1'
    }
    
    for key, value in env_vars.items():
        if key not in os.environ:
            os.environ[key] = value
            print(f"✅ {key} = {value}")
    
    print("✅ البيئة جاهزة للتشغيل المحلي")

def check_database_setup():
    """التحقق من إعداد قاعدة البيانات"""
    print("\n🗄️ التحقق من قاعدة البيانات...")
    
    # التحقق من وجود متغيرات قاعدة البيانات السحابية
    cloud_dbs = [
        'SUPABASE_URL',
        'RAILWAY_DATABASE_URL', 
        'NEON_DATABASE_URL',
        'DATABASE_URL',
        'HEROKU_POSTGRESQL_URL'
    ]
    
    found_cloud_db = False
    for db_var in cloud_dbs:
        if os.environ.get(db_var):
            print(f"✅ قاعدة بيانات سحابية متصلة: {db_var}")
            found_cloud_db = True
            break
    
    if not found_cloud_db:
        print("⚠️  لا توجد قاعدة بيانات سحابية")
        print("📊 سيتم استخدام SQLite المحلي للاختبار")
        print("💡 للنظام العالمي الحقيقي، اتبع دليل النشر: DEPLOYMENT-GLOBAL.md")
    
    return True

def start_server():
    """بدء تشغيل الخادم"""
    print("\n🚀 بدء تشغيل الخادم...")
    print("⏳ جاري التحميل...")
    
    try:
        # تشغيل التطبيق
        from app import app
        port = int(os.environ.get('PORT', 5000))
        
        # فتح المتصفح تلقائياً بعد ثانيتين
        def open_browser():
            time.sleep(2)
            url = f'http://localhost:{port}'
            print(f"\n🌐 فتح المتصفح: {url}")
            webbrowser.open(url)
        
        import threading
        browser_thread = threading.Thread(target=open_browser)
        browser_thread.daemon = True
        browser_thread.start()
        
        print(f"✅ الخادم يعمل على: http://localhost:{port}")
        print("🔗 URL العام للنشر: https://your-app.onrender.com")
        print("\n📱 حسابات تجريبية:")
        print("   👑 المدير: admin / owner123")
        print("   👤 عادي: test / (فارغ)")
        print("\n⏹️  اضغط Ctrl+C للإيقاف")
        
        # تشغيل التطبيق
        app.run(
            host='0.0.0.0',
            port=port,
            debug=True,
            use_reloader=False  # منع restart مزدوج
        )
        
    except KeyboardInterrupt:
        print("\n\n⏹️  تم إيقاف الخادم")
        return True
    except Exception as e:
        print(f"\n❌ خطأ في تشغيل الخادم: {e}")
        return False

def show_deployment_info():
    """إظهار معلومات النشر"""
    print("\n" + "="*60)
    print("🌍 معلومات النشر العالمي")
    print("="*60)
    print("""
🎯 للنشر على الإنترنت (مجاني):

1️⃣ Render + Supabase (الأفضل):
   • إنشاء حساب في supabase.com
   • إنشاء مشروع جديد وانسخ Database URL
   • نشر على render.com مع ربط GitHub
   • إضافة متغير SUPABASE_URL

2️⃣ Railway (سهل):
   • نشر مباشر من GitHub على railway.app
   • إضافة PostgreSQL من dashboard
   • تلقائي 100%!

3️⃣ Heroku + Neon:
   • إنشاء قاعدة بيانات في neon.tech
   • نشر على heroku.com
   • إضافة متغير NEON_DATABASE_URL

📖 دليل تفصيلي: DEPLOYMENT-GLOBAL.md
🚀 النتيجة: وصول عالمي من أي مكان في العالم!
""")

def main():
    """الدالة الرئيسية"""
    print_banner()
    
    # التحقق من النظام
    if not check_python_version():
        return 1
    
    # التحقق من المكتبات
    missing = check_dependencies()
    if missing:
        if not install_dependencies(missing):
            return 1
    
    # إعداد البيئة
    setup_environment()
    
    # التحقق من قاعدة البيانات
    check_database_setup()
    
    # عرض معلومات النشر
    show_deployment_info()
    
    print("\n" + "="*60)
    print("🚀 بدء التشغيل")
    print("="*60)
    
    # بدء الخادم
    if start_server():
        print("\n✅ تم التشغيل بنجاح")
        return 0
    else:
        print("\n❌ فشل في التشغيل")
        return 1

if __name__ == '__main__':
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n👋 وداعاً!")
        sys.exit(0)
    except Exception as e:
        print(f"\n💥 خطأ غير متوقع: {e}")
        sys.exit(1) 