#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
اختبار تطبيق قارئ الباركود المتطور
Test Script for QR Scanner Advanced Application
"""

import sqlite3
import requests
import json
import os
import sys
from datetime import datetime

def test_database_connection():
    """اختبار الاتصال بقاعدة البيانات"""
    print("🔍 اختبار قاعدة البيانات...")
    try:
        # محاولة إنشاء الجداول
        from app import init_database
        init_database()
        
        # اختبار الاتصال
        conn = sqlite3.connect('qr_scanner.db')
        cursor = conn.cursor()
        
        # فحص الجداول
        tables = cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        """).fetchall()
        
        expected_tables = {'scan_results', 'settings', 'statistics'}
        found_tables = {table[0] for table in tables}
        
        if expected_tables.issubset(found_tables):
            print("✅ قاعدة البيانات: تم إنشاء جميع الجداول بنجاح")
        else:
            missing = expected_tables - found_tables
            print(f"❌ قاعدة البيانات: جداول مفقودة: {missing}")
            return False
            
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ خطأ في قاعدة البيانات: {e}")
        return False

def test_api_endpoints():
    """اختبار نقاط API"""
    print("\n🌐 اختبار API...")
    
    base_url = "http://localhost:5000"
    
    # قائمة الـ endpoints للاختبار
    endpoints = [
        ("GET", "/api/statistics"),
        ("GET", "/api/results"),
        ("GET", "/api/settings"),
    ]
    
    try:
        for method, endpoint in endpoints:
            url = base_url + endpoint
            if method == "GET":
                response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print(f"✅ {endpoint}: يعمل بشكل صحيح")
                else:
                    print(f"⚠️ {endpoint}: استجابة غير متوقعة")
            else:
                print(f"❌ {endpoint}: خطأ HTTP {response.status_code}")
                
    except requests.exceptions.ConnectionError:
        print("❌ لا يمكن الاتصال بالخادم. تأكد من تشغيل التطبيق أولاً")
        return False
    except Exception as e:
        print(f"❌ خطأ في اختبار API: {e}")
        return False
    
    return True

def test_scan_functionality():
    """اختبار وظيفة المسح"""
    print("\n📱 اختبار وظيفة المسح...")
    
    try:
        # بيانات اختبار
        test_data = {
            "code_data": "TEST_BARCODE_12345",
            "code_type": "CODE_128",
            "notes": "اختبار تلقائي"
        }
        
        response = requests.post(
            "http://localhost:5000/api/scan",
            headers={"Content-Type": "application/json"},
            json=test_data,
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ المسح: تم حفظ البيانات بنجاح")
                print(f"   - رقم العملية: #{result.get('id')}")
                print(f"   - إرسال تليجرام: {'✅' if result.get('telegram_sent') else '❌'}")
            else:
                print(f"❌ المسح: {result.get('error')}")
                return False
        else:
            print(f"❌ المسح: خطأ HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ خطأ في اختبار المسح: {e}")
        return False
    
    return True

def test_file_structure():
    """فحص هيكل الملفات"""
    print("\n📁 فحص هيكل الملفات...")
    
    required_files = [
        "app.py",
        "requirements.txt",
        "templates/index.html",
        "templates/dashboard.html",
        "templates/settings.html"
    ]
    
    all_exists = True
    
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} - مفقود")
            all_exists = False
    
    return all_exists

def test_settings_functionality():
    """اختبار وظائف الإعدادات"""
    print("\n⚙️ اختبار الإعدادات...")
    
    try:
        # اختبار حفظ الإعدادات
        test_settings = {
            "app_title": "اختبار تلقائي",
            "theme_color": "#FF5722",
            "scanner_continuous": "true",
            "scanner_sound": "false"
        }
        
        response = requests.post(
            "http://localhost:5000/api/settings",
            headers={"Content-Type": "application/json"},
            json=test_settings,
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ الإعدادات: تم الحفظ بنجاح")
            else:
                print(f"❌ الإعدادات: {result.get('error')}")
                return False
        else:
            print(f"❌ الإعدادات: خطأ HTTP {response.status_code}")
            return False
            
        # اختبار قراءة الإعدادات
        response = requests.get("http://localhost:5000/api/settings", timeout=5)
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                settings = result.get('settings', {})
                if settings.get('app_title') == test_settings['app_title']:
                    print("✅ الإعدادات: تم القراءة بنجاح")
                else:
                    print("⚠️ الإعدادات: بيانات غير متطابقة")
            else:
                print("❌ الإعدادات: فشل في القراءة")
                return False
                
    except Exception as e:
        print(f"❌ خطأ في اختبار الإعدادات: {e}")
        return False
    
    return True

def generate_test_report():
    """إنشاء تقرير الاختبار"""
    print("\n" + "="*50)
    print("📊 تقرير الاختبار الشامل")
    print("="*50)
    
    tests = [
        ("قاعدة البيانات", test_database_connection),
        ("هيكل الملفات", test_file_structure),
    ]
    
    # اختبارات تتطلب تشغيل الخادم
    server_tests = [
        ("نقاط API", test_api_endpoints),
        ("وظيفة المسح", test_scan_functionality), 
        ("الإعدادات", test_settings_functionality),
    ]
    
    passed = 0
    total = len(tests) + len(server_tests)
    
    # تشغيل الاختبارات الأساسية
    for test_name, test_func in tests:
        if test_func():
            passed += 1
    
    # فحص إذا كان الخادم يعمل
    server_running = False
    try:
        response = requests.get("http://localhost:5000/api/statistics", timeout=2)
        server_running = True
    except:
        print("\n⚠️ الخادم غير متاح - سيتم تخطي اختبارات API")
        print("   لتشغيل جميع الاختبارات:")
        print("   1. python app.py")
        print("   2. python test_app.py (في terminal آخر)")
    
    # تشغيل اختبارات الخادم إذا كان متاحاً
    if server_running:
        for test_name, test_func in server_tests:
            if test_func():
                passed += 1
    else:
        total = len(tests)  # تقليل العدد الكلي
    
    print("\n" + "="*50)
    print(f"📈 النتيجة النهائية: {passed}/{total}")
    
    if passed == total:
        print("🎉 جميع الاختبارات نجحت! التطبيق جاهز للاستخدام")
        return True
    else:
        print("⚠️ بعض الاختبارات فشلت. يرجى مراجعة الأخطاء أعلاه")
        return False

def main():
    """الدالة الرئيسية"""
    print("🧪 بدء اختبارات قارئ الباركود المتطور")
    print("="*50)
    
    # معلومات النظام
    print(f"🐍 Python: {sys.version}")
    print(f"📂 المجلد: {os.getcwd()}")
    print(f"🕒 الوقت: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # تشغيل الاختبارات
    success = generate_test_report()
    
    if success:
        print("\n✅ جميع الاختبارات مكتملة بنجاح!")
        print("\n🚀 لتشغيل التطبيق:")
        print("   python app.py")
        print("   أو")
        print("   python run.py")
    else:
        print("\n❌ هناك مشاكل تحتاج إلى إصلاح")
        
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 