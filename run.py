#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ملف التشغيل السريع لقارئ الباركود المتطور
Quick Start Script for QR Scanner Advanced
"""

import os
import sys
import subprocess

def check_python_version():
    """التحقق من إصدار Python"""
    if sys.version_info < (3, 8):
        print("❌ خطأ: يتطلب Python 3.8 أو أحدث")
        print(f"الإصدار الحالي: {sys.version}")
        return False
    return True

def install_requirements():
    """تثبيت التبعيات المطلوبة"""
    print("📦 جاري تثبيت التبعيات...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ تم تثبيت جميع التبعيات بنجاح!")
        return True
    except subprocess.CalledProcessError:
        print("❌ خطأ في تثبيت التبعيات")
        return False

def main():
    """الدالة الرئيسية"""
    print("🚀 قارئ الباركود المتطور - نسخة Python")
    print("=" * 50)
    
    # التحقق من إصدار Python
    if not check_python_version():
        return
    
    # تثبيت التبعيات إذا لم تكن موجودة
    if not os.path.exists("qr_scanner.db"):
        print("🔧 الإعداد الأولي...")
        if not install_requirements():
            return
    
    # تشغيل التطبيق
    print("🏃 تشغيل التطبيق...")
    print("📱 الرابط: http://localhost:5000")
    print("📊 لوحة التحكم: http://localhost:5000/dashboard")
    print("⚙️ الإعدادات: http://localhost:5000/settings")
    print("\n🔹 اضغط Ctrl+C لإيقاف التطبيق")
    print("=" * 50)
    
    try:
        from app import app
        app.run(debug=True, host='0.0.0.0', port=5000)
    except ImportError:
        print("❌ خطأ: لم يتم العثور على ملف app.py")
    except KeyboardInterrupt:
        print("\n👋 تم إغلاق التطبيق بأمان")
    except Exception as e:
        print(f"❌ خطأ غير متوقع: {e}")

if __name__ == "__main__":
    main() 