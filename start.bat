@echo off
echo.
echo ==================================
echo 🚀 قارئ الباركود - Node.js Edition
echo ==================================
echo.

:: فحص Node.js
echo 📋 فحص Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js غير مثبت
    echo.
    echo 📥 يرجى تحميل وتثبيت Node.js من:
    echo 🌐 https://nodejs.org
    echo.
    echo اختر النسخة LTS وأعد تشغيل الملف
    pause
    exit /b 1
)

:: عرض إصدار Node.js
echo ✅ Node.js مثبت
node --version

:: فحص npm
echo.
echo 📋 فحص npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm غير متاح
    echo يرجى إعادة تثبيت Node.js
    pause
    exit /b 1
)

echo ✅ npm متاح
npm --version

:: تثبيت المكتبات
echo.
echo 📦 تثبيت المكتبات المطلوبة...
npm install
if errorlevel 1 (
    echo ❌ فشل في تثبيت المكتبات
    pause
    exit /b 1
)

echo ✅ تم تثبيت جميع المكتبات

:: تشغيل الخادم
echo.
echo 🚀 بدء تشغيل الخادم...
echo.
echo 🌐 الخادم سيعمل على: http://localhost:3000
echo 👥 حسابات التجربة:
echo    📱 المدير: admin / admin123
echo    👤 ضيف: guest
echo ⏹️  اضغط Ctrl+C للإيقاف
echo.

:: تشغيل الخادم
start "QR Scanner Browser" http://localhost:3000
npm start 