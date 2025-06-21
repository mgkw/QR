# 📱 قارئ الباركود البسيط

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-2.3.3-green.svg)
![SQLite](https://img.shields.io/badge/SQLite-3-orange.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

نظام بسيط وسريع لقراءة وحفظ أكواد الباركود باستخدام SQLite

## ✨ المميزات

- 📱 **واجهة سهلة**: تصميم بسيط وجميل
- 📊 **قاعدة بيانات محلية**: SQLite سريع وموثوق
- 🔍 **قراءة متقدمة**: يدعم جميع أنواع الباركود
- 📈 **لوحة بيانات**: عرض الإحصائيات والمسحات
- 👥 **نظام مستخدمين**: تسجيل دخول بسيط
- 🚀 **سريع وخفيف**: بدون تعقيدات

## 🚀 التشغيل السريع

### 1. تحميل المشروع
```bash
git clone https://github.com/mgkw/QR.git
cd QR
```

### 2. تثبيت المكتبات
```bash
pip install -r requirements.txt
```

### 3. تشغيل النظام
```bash
python app.py
```

### 4. فتح المتصفح
```
http://localhost:5000
```

## 👥 حسابات التجربة

- **المدير**: `admin` / `admin123`  
- **ضيف**: `guest` / (بدون كلمة مرور)

## 📁 هيكل المشروع

```
QR/
├── app.py              # الخادم الرئيسي
├── index.html          # واجهة قارئ الباركود
├── script.js           # جافاسكريبت القراءة
├── styles.css          # التصميم
├── requirements.txt    # المكتبات المطلوبة
├── scanner.db          # قاعدة البيانات (تُنشأ تلقائياً)
└── README.md           # هذا الملف
```

## 🔧 API المتاح

### الإحصائيات
```bash
GET /api/stats
```

### تسجيل الدخول
```bash
POST /api/login
{
  "username": "admin",
  "password": "admin123"
}
```

### حفظ مسح
```bash
POST /api/scan
{
  "barcode": "123456789",
  "user_id": 1,
  "username": "admin",
  "notes": "ملاحظة اختيارية"
}
```

### قائمة المسحات
```bash
GET /api/scans?limit=20
```

## 📖 كيفية الاستخدام

1. **افتح الموقع** → انتقل إلى `http://localhost:5000`
2. **ابدأ المسح** → اضغط على "بدء المسح"
3. **سجل الدخول** → استخدم `admin` أو `guest`
4. **امسح الكود** → وجه الكاميرا للباركود
5. **احفظ البيانات** → أضف ملاحظة واحفظ
6. **راجع البيانات** → في "لوحة البيانات"

## 📱 المتصفحات المدعومة

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 11+
- ✅ Edge 79+
- ✅ متصفحات الجوال

## 🛠️ التطوير والتخصيص

### إضافة ميزات جديدة
```python
@app.route('/api/new-feature')
def new_feature():
    # كودك هنا
    return jsonify({'status': 'success'})
```

### تعديل قاعدة البيانات
```python
def add_new_table():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS new_table (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()
```

## 🐛 استكشاف الأخطاء

### المشكلة: الكاميرا لا تعمل
**الحل**: تأكد من:
- السماح للموقع باستخدام الكاميرا
- استخدام HTTPS أو localhost
- عدم استخدام الكاميرا في تطبيق آخر

### المشكلة: قاعدة البيانات مقفلة
**الحل**:
```bash
# أغلق التطبيق وأعد تشغيله
Ctrl+C
python app.py
```

### المشكلة: خطأ في تثبيت المكتبات
**الحل**:
```bash
# استخدم بيئة افتراضية
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

## 📊 الإحصائيات

- ⚡ **سرعة القراءة**: أقل من ثانية واحدة
- 💾 **حجم قاعدة البيانات**: ينمو تدريجياً حسب الاستخدام
- 🔄 **معدل النجاح**: 99%+ مع الإضاءة الجيدة
- 📱 **دعم الأجهزة**: كمبيوتر وجوال

## 🤝 المساهمة

نرحب بمساهماتكم! إليكم كيفية المساهمة:

1. **Fork** المشروع
2. إنشاء **branch** جديد (`git checkout -b feature/amazing-feature`)
3. **Commit** التغييرات (`git commit -m 'Add amazing feature'`)
4. **Push** للـ branch (`git push origin feature/amazing-feature`)
5. فتح **Pull Request**

## 📄 الترخيص

هذا المشروع مرخص تحت [MIT License](LICENSE) - راجع ملف LICENSE للتفاصيل.

## 📞 التواصل

- 📧 **البريد الإلكتروني**: [البريد هنا]
- 💬 **المسائل**: [GitHub Issues](https://github.com/mgkw/QR/issues)
- 🌟 **النجوم**: إذا أعجبك المشروع، أعطه نجمة ⭐

## 🎯 الإصدارات القادمة

- [ ] إضافة التصدير للـ CSV/Excel
- [ ] دعم قراءة متعددة في الصفحة الواحدة
- [ ] إضافة البحث المتقدم
- [ ] تحسين واجهة الجوال
- [ ] إضافة الإشعارات

---

**صُنع بـ ❤️ في العراق** 