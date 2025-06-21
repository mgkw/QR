@echo off
title قارئ الباركود المتطور - QR Scanner Enhanced
color 0A
cls

echo.
echo ==========================================
echo 🌟 قارئ الباركود المتطور - QR Scanner
echo ==========================================
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

:: اختيار نوع الخادم
echo 🚀 اختر نوع الخادم:
echo   1. الخادم المحسن (Enhanced) - جميع الميزات المتقدمة
echo   2. الخادم العادي (Standard) - الإصدار الأساسي
echo   3. وضع التطوير (Development) - مع إعادة التشغيل التلقائية
echo.

set /p choice="اختر رقم (1-3): "

if "%choice%"=="1" (
    echo.
    echo 🌟 تشغيل الخادم المحسن...
    echo ================================
    echo 📱 الواجهة المتطورة: http://localhost:3000/
    echo 🔧 الواجهة البسيطة: http://localhost:3000/simple
    echo ⚕️ فحص الصحة: http://localhost:3000/api/health
    echo 👥 المدير: admin / admin123
    echo 👤 ضيف: guest
    echo ================================
    start "QR Scanner Browser" http://localhost:3000
    npm run start:enhanced
) else if "%choice%"=="2" (
    echo.
    echo 📋 تشغيل الخادم العادي...
    start "QR Scanner Browser" http://localhost:3000
    npm start
) else if "%choice%"=="3" (
    echo.
    echo 🔄 تشغيل وضع التطوير...
    start "QR Scanner Browser" http://localhost:3000
    npm run dev:enhanced
) else (
    echo ❌ اختيار غير صحيح! تشغيل الخادم العادي...
    start "QR Scanner Browser" http://localhost:3000
    npm start
) 