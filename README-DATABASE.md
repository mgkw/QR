# قاعدة البيانات المركزية لقارئ الباركود

هذا الدليل يشرح كيفية إعداد واستخدام قاعدة البيانات المركزية للمستخدمين والطلبات في موقع قارئ الباركود.

## 🎯 المميزات الجديدة

### 🏢 قاعدة بيانات مركزية
- **تخزين مشترك**: جميع المسحات والمستخدمين في قاعدة بيانات واحدة
- **مزامنة فورية**: المسحات تُحفظ مباشرة في الخادم المركزي
- **إدارة متقدمة**: نظام أونر موحد لجميع المستخدمين
- **أمان محسن**: جلسات آمنة مع انتهاء صلاحية

### 📊 إحصائيات شاملة
- **إحصائيات موحدة**: جميع البيانات من جميع المستخدمين
- **تقارير متقدمة**: فلترة حسب المستخدم والتاريخ
- **تحليلات شاملة**: رؤية كاملة لجميع النشاطات

### 🔗 تكامل مع التليجرام
- **إرسال مركزي**: إعدادات التليجرام مُدارة مركزياً
- **إرسال تلقائي**: الخادم يتولى الإرسال في الخلفية
- **موثوقية عالية**: نظام إعادة المحاولة المتقدم

## 🚀 إعداد الخادم

### 1. تثبيت المتطلبات

```bash
# تثبيت Node.js (إذا لم يكن مثبتاً)
# تحميل من: https://nodejs.org/

# تثبيت المكتبات
npm install
```

### 2. بدء الخادم

```bash
# بدء الخادم
npm start

# أو للتطوير مع إعادة التشغيل التلقائي
npm run dev

# تهيئة قاعدة البيانات (المرة الأولى فقط)
npm run init-db
```

### 3. التحقق من التشغيل

افتح المتصفح على: `http://localhost:3000`

يجب أن ترى:
```
🚀 الخادم يعمل على المنفذ 3000
🌐 الرابط: http://localhost:3000
📊 قاعدة البيانات: ./database/qr_scanner.db
✅ تم إنشاء جداول قاعدة البيانات بنجاح
✅ تم إنشاء المستخدم الأونر الافتراضي: admin
```

## 👤 إعداد المستخدمين

### المستخدم الأونر الافتراضي
- **اسم المستخدم**: `admin`
- **كلمة المرور**: `owner123`

### إضافة مستخدمين جدد
1. سجل دخول كأونر باستخدام الحساب الافتراضي
2. اذهب إلى "إدارة المستخدمين"
3. أضف المستخدمين الجدد
4. المستخدمون يمكنهم تسجيل الدخول بدون كلمة مرور

## 🔧 ربط الموقع الحالي

### الطريقة الأولى: إضافة ملف API Client

1. أضف الملف `api-client.js` إلى مجلد الموقع
2. أضف هذا السطر في `index.html` قبل `script.js`:

```html
<script src="api-client.js"></script>
```

3. الموقع سيتحقق تلقائياً من وجود الخادم المركزي

### الطريقة الثانية: تعديل script.js مباشرة

أضف هذا الكود في بداية ملف `script.js`:

```javascript
// التحقق من قاعدة البيانات المركزية
let centralDB = {
  enabled: false,
  baseUrl: 'http://localhost:3000',
  sessionId: localStorage.getItem('centraldb_session')
};

// محاولة الاتصال بقاعدة البيانات المركزية
async function checkCentralDatabase() {
  try {
    const response = await fetch(`${centralDB.baseUrl}/api/status`);
    if (response.ok) {
      centralDB.enabled = true;
      console.log('✅ قاعدة البيانات المركزية متصلة');
      return true;
    }
  } catch (error) {
    console.log('🔄 العمل بالوضع المحلي');
  }
  return false;
}

// استدعاء التحقق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
  await checkCentralDatabase();
  // باقي الكود الأصلي...
});
```

## 🌐 النشر

### النشر المحلي على الشبكة

```bash
# تشغيل الخادم على جميع الواجهات
PORT=3000 npm start
```

ثم يمكن الوصول من أي جهاز في الشبكة المحلية:
`http://[IP-ADDRESS]:3000`

### النشر على السحابة

#### Heroku
```bash
# إنشاء تطبيق Heroku
heroku create qr-scanner-db

# رفع الكود
git add .
git commit -m "إضافة قاعدة البيانات المركزية"
git push heroku main
```

#### Railway
```bash
# ربط مع Railway
railway login
railway init
railway up
```

#### DigitalOcean/VPS
```bash
# رفع الملفات وتشغيل الخادم
npm install --production
PORT=80 npm start
```

### إعداد HTTPS (للإنتاج)

استخدم Let's Encrypt أو CloudFlare لتأمين الاتصال:

```bash
# مثال مع nginx
sudo apt install nginx certbot
sudo certbot --nginx -d yourdomain.com
```

## 🔌 API Endpoints

### المصادقة
- `POST /api/login` - تسجيل الدخول
- `POST /api/logout` - تسجيل الخروج
- `POST /api/verify-session` - التحقق من الجلسة

### المستخدمين (للأونر فقط)
- `GET /api/users` - جلب جميع المستخدمين
- `POST /api/users` - إضافة مستخدم جديد
- `DELETE /api/users/:username` - حذف مستخدم

### المسحات
- `POST /api/scans` - حفظ مسحة جديدة
- `GET /api/scans` - جلب المسحات (مع فلاتر)
- `PUT /api/scans/:id/telegram-status` - تحديث حالة التليجرام

### الإحصائيات
- `GET /api/statistics` - جلب الإحصائيات

### الإعدادات (للأونر فقط)
- `GET /api/settings` - جلب الإعدادات
- `POST /api/settings` - حفظ الإعدادات
- `POST /api/test-telegram` - اختبار التليجرام

## 🛠️ استكشاف الأخطاء

### مشاكل الاتصال

#### "خطأ في الاتصال بقاعدة البيانات"
```bash
# تحقق من وجود مجلد database
mkdir -p database

# تحقق من صلاحيات الكتابة
chmod 755 database
```

#### "EADDRINUSE: المنفذ قيد الاستخدام"
```bash
# إيجاد العملية التي تستخدم المنفذ
netstat -tulpn | grep :3000

# قتل العملية
kill -9 [PID]

# أو استخدام منفذ مختلف
PORT=3001 npm start
```

### مشاكل المصادقة

#### "الجلسة منتهية الصلاحية"
- امسح بيانات المتصفح: `localStorage.clear()`
- سجل دخول جديد

#### "المستخدم غير موجود"
- تأكد من إضافة المستخدم عبر الأونر
- تحقق من جدول `users` في قاعدة البيانات

### مشاكل التليجرام

#### "فشل في إرسال التليجرام"
- تحقق من صحة التوكن والـ Chat ID
- تأكد من إضافة البوت للمجموعة
- تحقق من اتصال الإنترنت

## 📈 المراقبة والصيانة

### مراقبة الخادم
```bash
# مراقبة اللوغات
tail -f server.log

# مراقبة استخدام الذاكرة
htop

# حجم قاعدة البيانات
ls -lh database/qr_scanner.db
```

### النسخ الاحتياطي
```bash
# نسخ احتياطي من قاعدة البيانات
cp database/qr_scanner.db backup/qr_scanner_$(date +%Y%m%d).db

# استعادة من النسخة الاحتياطية
cp backup/qr_scanner_20241201.db database/qr_scanner.db
```

### تنظيف البيانات القديمة
```sql
-- حذف الجلسات المنتهية الصلاحية
DELETE FROM user_sessions WHERE expires_at < datetime('now');

-- حذف المسحات الأقدم من 6 أشهر
DELETE FROM scans WHERE scan_timestamp < datetime('now', '-6 months');
```

## 🔒 الأمان

### توصيات الأمان
1. **غيّر كلمة مرور الأونر الافتراضية**
2. **استخدم HTTPS في الإنتاج**
3. **فعّل Firewall على الخادم**
4. **اعمل نسخ احتياطية دورية**
5. **راقب اللوغات للنشاط المشبوه**

### إعدادات متقدمة
```javascript
// في config.js
const config = {
  security: {
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 ساعة
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 دقيقة
    requireHTTPS: process.env.NODE_ENV === 'production'
  }
};
```

## 📞 الدعم

إذا واجهت أي مشاكل:

1. **تحقق من اللوغات**: `console.log` في المتصفح و `server.log`
2. **تأكد من إعدادات الشبكة**: Firewall و CORS
3. **راجع قاعدة البيانات**: تحقق من وجود الجداول والبيانات
4. **اختبر الـ API**: استخدم Postman أو curl للاختبار

### مثال على اختبار API
```bash
# اختبار حالة الخادم
curl http://localhost:3000/api/status

# اختبار تسجيل الدخول
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"owner123","isOwner":true}'
```

## 🔄 التحديثات المستقبلية

### المخططة قريباً
- [ ] دعم قواعد بيانات متعددة (PostgreSQL, MySQL)
- [ ] واجهة إدارة ويب منفصلة
- [ ] تصدير البيانات لـ Excel/CSV
- [ ] إشعارات Push للهواتف
- [ ] تشفير البيانات الحساسة

### المطلوب من المطورين
- إضافة معالجة أخطاء أكثر تفصيلاً
- تحسين أداء الاستعلامات
- إضافة المزيد من الاختبارات
- توثيق أفضل للـ API

---

🎉 **مبروك!** أصبح لديك الآن نظام قاعدة بيانات مركزية متطور لموقع قارئ الباركود. 