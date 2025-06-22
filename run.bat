@echo off
chcp 65001 >nul
echo.
echo 🚀 قارئ الباركود المتطور - نسخة Python
echo =====================================================
echo.

REM التحقق من وجود Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ خطأ: Python غير مثبت على النظام
    echo يرجى تحميل Python من: https://python.org
    pause
    exit /b 1
)

REM تثبيت التبعيات إذا لم تكن موجودة
if not exist "qr_scanner.db" (
    echo 🔧 الإعداد الأولي...
    echo 📦 جاري تثبيت التبعيات...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo ❌ خطأ في تثبيت التبعيات
        pause
        exit /b 1
    )
    echo ✅ تم تثبيت جميع التبعيات بنجاح!
)

echo.
echo 🏃 تشغيل التطبيق...
echo.
echo 📱 الرابط: http://localhost:5000
echo 📊 لوحة التحكم: http://localhost:5000/dashboard
echo ⚙️ الإعدادات: http://localhost:5000/settings
echo.
echo 🔹 اضغط Ctrl+C لإيقاف التطبيق
echo =====================================================
echo.

REM تشغيل التطبيق
python app.py

echo.
echo 👋 تم إغلاق التطبيق
pause 