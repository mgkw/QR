@echo off
chcp 65001 > nul 2>&1
title قارئ الباركود العالمي - Global QR Scanner

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                🌍 قارئ الباركود العالمي 🌍                 ║
echo ║                     Global QR Scanner                       ║
echo ║                                                              ║
echo ║                    🚀 تشغيل سريع 🚀                         ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo 🔍 التحقق من Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python غير مثبت
    echo 💡 يرجى تثبيت Python 3.8+ من: https://python.org
    pause
    exit /b 1
)

echo ✅ Python متوفر
echo.

echo 📦 تثبيت المكتبات المطلوبة...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ فشل في تثبيت المكتبات
    pause
    exit /b 1
)

echo ✅ المكتبات جاهزة
echo.

echo 🚀 بدء تشغيل النظام العالمي...
echo ⏳ جاري التحميل...
echo.
echo 📱 حسابات تجريبية:
echo    👑 المدير: admin / owner123
echo    👤 عادي: test / ^(فارغ^)
echo.
echo 🌍 للنشر العالمي، راجع: DEPLOYMENT-GLOBAL.md
echo ⏹️  اضغط Ctrl+C للإيقاف
echo.

python run_global.py

if errorlevel 1 (
    echo.
    echo ❌ خطأ في التشغيل
    pause
    exit /b 1
)

echo.
echo ✅ تم الإغلاق بنجاح
pause 