#!/bin/bash

echo "🚀 قارئ الباركود - Node.js Edition"
echo "===================================="
echo

# فحص Node.js
echo "📋 فحص Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js غير مثبت"
    echo
    echo "📥 يرجى تحميل وتثبيت Node.js من:"
    echo "🌐 https://nodejs.org"
    echo
    echo "أو استخدم package manager:"
    echo "Ubuntu/Debian: sudo apt install nodejs npm"
    echo "CentOS/RHEL: sudo yum install nodejs npm"
    echo "macOS: brew install node"
    echo
    exit 1
fi

echo "✅ Node.js مثبت"
node --version

# فحص npm
echo
echo "📋 فحص npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm غير متاح"
    echo "يرجى إعادة تثبيت Node.js"
    exit 1
fi

echo "✅ npm متاح"
npm --version

# تثبيت المكتبات
echo
echo "📦 تثبيت المكتبات المطلوبة..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ فشل في تثبيت المكتبات"
    exit 1
fi

echo "✅ تم تثبيت جميع المكتبات"

# تشغيل الخادم
echo
echo "🚀 بدء تشغيل الخادم..."
echo
echo "🌐 الخادم سيعمل على: http://localhost:3000"
echo "👥 حسابات التجربة:"
echo "   📱 المدير: admin / admin123"
echo "   👤 ضيف: guest"
echo "⏹️  اضغط Ctrl+C للإيقاف"
echo

# فتح المتصفح (إذا كان متاحاً)
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000 &
elif command -v open &> /dev/null; then
    open http://localhost:3000 &
fi

# تشغيل الخادم
npm start 