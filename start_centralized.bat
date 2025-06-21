@echo off
title قارئ الباركود - نظام قاعدة البيانات المركزية
color 0B

echo ========================================
echo  🗄️ قارئ الباركود - نظام مركزي
echo ========================================
echo.

echo 📋 اختر طريقة الإعداد:
echo.
echo 1. استخدام متغير البيئة DATABASE_URL موجود
echo 2. تعديل رابط قاعدة البيانات يدوياً
echo 3. اختبار الاتصال بقاعدة البيانات
echo 4. إعداد قاعدة بيانات جديدة
echo.
set /p choice="اختر رقم (1-4): "

if "%choice%"=="1" goto run_with_env
if "%choice%"=="2" goto manual_setup
if "%choice%"=="3" goto test_connection
if "%choice%"=="4" goto setup_new
goto invalid_choice

:run_with_env
echo.
echo 🚀 تشغيل التطبيق مع متغير البيئة الموجود...
python app.py
goto end

:manual_setup
echo.
echo 📝 أدخل رابط قاعدة البيانات من Supabase:
echo مثال: postgresql://postgres.xxxxx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
echo.
set /p db_url="رابط قاعدة البيانات: "

if "%db_url%"=="" (
    echo ❌ لم تدخل رابط قاعدة البيانات!
    goto end
)

echo.
echo 🔗 تعيين رابط قاعدة البيانات...
set DATABASE_URL=%db_url%

echo 📊 إعداد قاعدة البيانات...
python setup_database.py

echo.
echo 🚀 تشغيل التطبيق...
python app.py
goto end

:test_connection
echo.
echo 📝 أدخل رابط قاعدة البيانات للاختبار:
set /p test_url="رابط قاعدة البيانات: "

if "%test_url%"=="" (
    echo ❌ لم تدخل رابط قاعدة البيانات!
    goto end
)

echo.
echo 🔧 اختبار الاتصال...
python -c "
import psycopg2
try:
    conn = psycopg2.connect('%test_url%')
    print('✅ الاتصال نجح!')
    conn.close()
except Exception as e:
    print(f'❌ فشل الاتصال: {e}')
"
goto end

:setup_new
echo.
echo 🌐 لإعداد قاعدة بيانات جديدة:
echo.
echo 1. اذهب إلى: https://supabase.com
echo 2. أنشئ حساب جديد
echo 3. أنشئ مشروع جديد
echo 4. اذهب إلى Settings > Database
echo 5. انسخ Connection String
echo 6. شغّل هذا الملف مرة أخرى واختر الخيار 2
echo.
echo 📖 للمزيد من التفاصيل، راجع ملف: QUICK-DATABASE-SETUP.md
goto end

:invalid_choice
echo ❌ خيار غير صحيح!
goto end

:end
echo.
pause 