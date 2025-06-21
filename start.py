#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚀 ملف تشغيل بسيط لقارئ الباركود
"""

import os
import sys
import subprocess
import webbrowser
import time

def check_python():
    """فحص إصدار Python"""
    if sys.version_info < (3, 7):
        print("❌ يتطلب Python 3.7 أو أحدث")
        sys.exit(1)
    print(f"✅ Python {sys.version.split()[0]}")

def install_requirements():
    """تثبيت المتطلبات"""
    print("📦 تثبيت المكتبات المطلوبة...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ تم تثبيت جميع المكتبات")
    except subprocess.CalledProcessError:
        print("❌ فشل في تثبيت المكتبات")
        sys.exit(1)

def start_app():
    """تشغيل التطبيق"""
    print("🚀 بدء تشغيل النظام...")
    
    # تشغيل التطبيق في الخلفية
    env = os.environ.copy()
    env['FLASK_ENV'] = 'development'
    
    try:
        # بدء Flask
        process = subprocess.Popen([sys.executable, "app.py"], env=env)
        
        # انتظار قليل لبدء الخادم
        time.sleep(3)
        
        # فتح المتصفح
        print("🌐 فتح المتصفح...")
        webbrowser.open("http://localhost:5000")
        
        print("\n" + "="*50)
        print("✅ النظام يعمل الآن!")
        print("🌐 الرابط: http://localhost:5000")
        print("👥 حسابات التجربة:")
        print("   📱 المدير: admin / admin123")
        print("   👤 ضيف: guest")
        print("⏹️  اضغط Ctrl+C للإيقاف")
        print("="*50)
        
        # انتظار إيقاف المستخدم
        try:
            process.wait()
        except KeyboardInterrupt:
            print("\n🛑 إيقاف النظام...")
            process.terminate()
            
    except Exception as e:
        print(f"❌ خطأ في تشغيل النظام: {e}")
        sys.exit(1)

def main():
    """الدالة الرئيسية"""
    print("🌟 قارئ الباركود البسيط")
    print("=" * 30)
    
    # فحص Python
    check_python()
    
    # تثبيت المتطلبات
    install_requirements()
    
    # تشغيل التطبيق
    start_app()

if __name__ == "__main__":
    main() 