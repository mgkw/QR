@echo off
title قارئ الباركود - Python Version
color 0A

echo ================================
echo  🐍 قارئ الباركود - Python Version
echo ================================
echo.

echo 🔍 التحقق من Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python غير مثبت. يرجى تثبيت Python 3.8+ أولاً
    echo 📥 تحميل من: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo ✅ Python متوفر
echo.

echo 📦 تثبيت المتطلبات...
python -m pip install -r requirements.txt

echo.
echo 🚀 بدء التطبيق...
echo 📡 الخادم متاح على: http://localhost:5000
echo ⏹️  للإيقاف اضغط Ctrl+C
echo.

python start.py

pause 