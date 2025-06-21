# إعداد قاعدة البيانات السحابية مع Turso

## 🌍 لماذا Turso؟

**Turso** هي قاعدة بيانات SQLite سحابية متطورة توفر:

- ⚡ **أداء عالي**: سرعة SQLite مع قوة السحابة
- 🌐 **توزيع عالمي**: نسخ البيانات في عدة مناطق جغرافية
- 🔄 **مزامنة فورية**: تحديث البيانات في الوقت الفعلي
- 💰 **مجاني للبداية**: طبقة مجانية سخية
- 🔒 **أمان متقدم**: تشفير وحماية على أعلى مستوى

## 🚀 التهيئة السريعة

تم إعداد النظام للعمل مع Turso مع إعداداتك:

```javascript
// إعدادات Turso المُكونة مسبقاً
database: {
  url: 'https://takyd-tlbat-mgkw.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...',
  localPath: './database/qr_scanner.db' // نسخة احتياطية محلية
}
```

## 📋 التشغيل

### 1. تثبيت المتطلبات
```bash
# تثبيت المكتبات (تتضمن @libsql/client للـ Turso)
npm install
```

### 2. تهيئة قاعدة البيانات
```bash
# إنشاء الجداول والبيانات الأساسية في Turso
npm run init-db
```

### 3. تشغيل الخادم
```bash
# بدء الخادم مع Turso
npm start
```

سترى رسائل مثل:
```
🌍 محاولة الاتصال بـ Turso...
✅ تم الاتصال بقاعدة Turso السحابية بنجاح
🔗 قاعدة البيانات: https://takyd-tlbat-mgkw.turso.io
📊 إنشاء جداول قاعدة البيانات...
✅ تم إنشاء جدول المستخدمين
✅ تم إنشاء جدول المسحات
✅ تم إنشاء جدول الإعدادات
✅ تم إنشاء جدول الجلسات
👤 إنشاء المستخدم الأونر الافتراضي...
✅ تم إنشاء المستخدم الأونر الافتراضي: admin
🚀 الخادم يعمل على المنفذ 3000
```

## 💾 النسخة الاحتياطية التلقائية

النظام يعمل بذكاء:

1. **الأولوية لـ Turso**: يحاول الاتصال بـ Turso أولاً
2. **نسخة احتياطية محلية**: يتحول لـ SQLite المحلية إذا فشل Turso
3. **شفافية كاملة**: نفس الواجهة والوظائف في كلا الحالتين

## 🌟 المميزات الجديدة مع Turso

### 🔄 مزامنة فورية
- جميع المسحات تُحفظ فوراً في السحابة
- وصول فوري من أي مكان في العالم
- لا فقدان للبيانات

### ⚡ أداء محسن
- استعلامات أسرع مع التوزيع الجغرافي
- تحميل أقل على الخادم المحلي
- تجربة مستخدم أفضل

### 📈 قابلية التوسع
- دعم عدد غير محدود من المستخدمين
- نمو تلقائي مع الاستخدام
- لا قيود على حجم البيانات

## 🔧 الإعدادات المتقدمة

### تخصيص إعدادات Turso

يمكنك تعديل الإعدادات في `config.js`:

```javascript
database: {
  // رابط قاعدة البيانات
  url: process.env.TURSO_DATABASE_URL || 'https://your-db.turso.io',
  
  // توكن المصادقة  
  authToken: process.env.TURSO_AUTH_TOKEN || 'your-auth-token',
  
  // مسار النسخة الاحتياطية المحلية
  localPath: process.env.DB_PATH || './database/qr_scanner.db'
}
```

### استخدام متغيرات البيئة

إنشئ ملف `.env` (لا تدفعه للـ Git):

```env
# إعدادات Turso
TURSO_DATABASE_URL=https://your-database.turso.io
TURSO_AUTH_TOKEN=your-secret-token-here

# إعدادات أخرى
PORT=3000
NODE_ENV=production
```

## 🌐 النشر على السحابة

### النشر على Vercel

```bash
# تثبيت Vercel CLI
npm i -g vercel

# نشر المشروع
vercel

# إعداد متغيرات البيئة في Vercel
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
```

### النشر على Railway

```bash
# ربط المشروع
railway login
railway init

# إعداد متغيرات البيئة
railway variables set TURSO_DATABASE_URL=https://your-db.turso.io
railway variables set TURSO_AUTH_TOKEN=your-token

# نشر المشروع
railway up
```

### النشر على Heroku

```bash
# إنشاء تطبيق Heroku
heroku create your-app-name

# إعداد متغيرات البيئة
heroku config:set TURSO_DATABASE_URL=https://your-db.turso.io
heroku config:set TURSO_AUTH_TOKEN=your-token

# نشر المشروع
git push heroku main
```

## 📊 مراقبة قاعدة البيانات

### لوحة تحكم Turso

اذهب إلى [https://app.turso.tech/mgkw/databases/takyd-tlbat](https://app.turso.tech/mgkw/databases/takyd-tlbat) لمراقبة:

- عدد الاتصالات النشطة
- حجم قاعدة البيانات
- الاستعلامات والأداء
- إحصائيات الاستخدام

### مراقبة الخادم

```bash
# مراقبة اللوغات
tail -f server.log

# التحقق من حالة قاعدة البيانات
curl http://localhost:3000/api/status
```

## 🛠️ استكشاف الأخطاء

### مشاكل الاتصال بـ Turso

#### "خطأ في الاتصال بـ Turso"

```bash
# تحقق من التوكن والرابط
echo $TURSO_DATABASE_URL
echo $TURSO_AUTH_TOKEN

# اختبار الاتصال يدوياً
curl -H "Authorization: Bearer YOUR_TOKEN" "https://your-db.turso.io"
```

#### "انتهت صلاحية التوكن"

1. اذهب إلى [لوحة تحكم Turso](https://app.turso.tech/)
2. أنشئ توكن جديد
3. حدث الإعدادات في `config.js` أو `.env`

#### "قاعدة البيانات غير متاحة"

النظام سيتحول تلقائياً للـ SQLite المحلية:

```
❌ خطأ في الاتصال بـ Turso: Database not found
🔄 محاولة استخدام SQLite المحلية...
✅ تم الاتصال بقاعدة SQLite المحلية
```

### أخطاء أخرى

#### "Module @libsql/client not found"

```bash
# تثبيت المكتبة
npm install @libsql/client
```

#### "Cannot read properties of undefined"

```bash
# إعادة تهيئة قاعدة البيانات
npm run init-db
```

## 🔄 الترحيل من SQLite إلى Turso

### نسخ البيانات الموجودة

```bash
# تصدير البيانات من SQLite
sqlite3 database/qr_scanner.db .dump > backup.sql

# استيراد البيانات إلى Turso (يحتاج أدوات Turso CLI)
turso db shell your-database < backup.sql
```

### مزامنة البيانات

```javascript
// في المستقبل: أداة مزامنة تلقائية
// نسخ البيانات من المحلية إلى Turso
await syncLocalToTurso();
```

## 📈 الأداء والتحسين

### نصائح لأفضل أداء

1. **استخدم الفهارس**:
```sql
CREATE INDEX idx_scans_barcode ON scans(barcode);
CREATE INDEX idx_scans_timestamp ON scans(scan_timestamp);
```

2. **تجميع الاستعلامات**:
```javascript
// بدلاً من استعلامات متعددة
await db.batch([
  { sql: 'INSERT INTO scans ...', args: [...] },
  { sql: 'UPDATE users ...', args: [...] }
]);
```

3. **تنظيف البيانات القديمة**:
```sql
-- حذف الجلسات المنتهية أسبوعياً
DELETE FROM user_sessions WHERE expires_at < datetime('now', '-7 days');
```

### مراقبة الأداء

```javascript
// قياس وقت الاستعلامات
console.time('turso-query');
const result = await db.execute('SELECT * FROM scans LIMIT 100');
console.timeEnd('turso-query');
```

## 🔒 الأمان

### حماية التوكن

⚠️ **مهم جداً**:
- لا تضع التوكن في الكود مباشرة
- استخدم متغيرات البيئة دائماً
- لا تدفع ملف `.env` للـ Git

### تدوير التوكن

```bash
# إنشاء توكن جديد شهرياً
turso auth token create --expiration 30d

# تحديث الإعدادات
export TURSO_AUTH_TOKEN=new-token-here
```

## 📞 الدعم

### مصادر المساعدة

- **وثائق Turso**: [docs.turso.tech](https://docs.turso.tech/)
- **مجتمع Discord**: [discord.gg/turso](https://discord.gg/turso)
- **GitHub Issues**: [github.com/libsql/libsql](https://github.com/libsql/libsql)

### أسئلة شائعة

**س: هل Turso مجاني؟**
ج: نعم، طبقة مجانية سخية تكفي معظم المشاريع

**س: ماذا لو انقطع الإنترنت؟**
ج: النظام يتحول تلقائياً للـ SQLite المحلية

**س: هل يمكن استخدام قاعدة بيانات أخرى؟**
ج: نعم، يمكن تعديل الكود لدعم PostgreSQL أو MySQL

---

🌟 **مبروك!** أصبح لديك نظام قاعدة بيانات سحابية متطور مع Turso! 