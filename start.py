#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script لتشغيل تطبيق قارئ الباركود محلياً
"""

import os
import sys
import subprocess
import platform

def check_requirements():
    """التحقق من متطلبات Python"""
    print("🔍 التحقق من متطلبات Python...")
    
    # التحقق من إصدار Python
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 8):
        print("❌ يتطلب Python 3.8 أو أحدث")
        return False
    
    print(f"✅ Python {python_version.major}.{python_version.minor}.{python_version.micro}")
    
    # التحقق من pip
    try:
        import pip
        print("✅ pip متوفر")
    except ImportError:
        print("❌ pip غير متوفر")
        return False
    
    return True

def install_requirements():
    """تثبيت المتطلبات"""
    print("📦 تثبيت المتطلبات...")
    
    if not os.path.exists('requirements.txt'):
        print("❌ ملف requirements.txt غير موجود")
        return False
    
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
        print("✅ تم تثبيت جميع المتطلبات")
        return True
    except subprocess.CalledProcessError:
        print("❌ فشل في تثبيت المتطلبات")
        return False

def create_database():
    """إنشاء قاعدة البيانات"""
    print("🗄️ إنشاء قاعدة البيانات...")
    
    try:
        from app import init_database
        init_database()
        print("✅ تم إنشاء قاعدة البيانات")
        return True
    except Exception as e:
        print(f"❌ خطأ في إنشاء قاعدة البيانات: {e}")
        return False

def start_server():
    """بدء الخادم"""
    print("🚀 بدء خادم Flask...")
    print("📡 الخادم متاح على: http://localhost:5000")
    print("📱 للوصول من الهاتف استخدم: http://[IP_ADDRESS]:5000")
    print("⏹️  للإيقاف اضغط Ctrl+C")
    print("-" * 50)
    
    try:
        from app import app
        app.run(host='0.0.0.0', port=5000, debug=True)
    except KeyboardInterrupt:
        print("\n✅ تم إيقاف الخادم")
    except Exception as e:
        print(f"❌ خطأ في تشغيل الخادم: {e}")

def main():
    """الدالة الرئيسية"""
    print("🐍 قارئ الباركود - Python Version")
    print("=" * 40)
    
    # التحقق من المتطلبات
    if not check_requirements():
        print("❌ فشل في التحقق من المتطلبات")
        sys.exit(1)
    
    # تثبيت المتطلبات
    if not install_requirements():
        print("❌ فشل في تثبيت المتطلبات")
        sys.exit(1)
    
    # إنشاء قاعدة البيانات
    if not create_database():
        print("❌ فشل في إنشاء قاعدة البيانات")
        sys.exit(1)
    
    # بدء الخادم
    start_server()

if __name__ == '__main__':
    main() 