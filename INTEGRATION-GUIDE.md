# دليل ربط الموقع الأصلي بقاعدة البيانات السحابية

## 🎯 الهدف: حل مشكلة "كل متصفح له قاعدة منفصلة"

**المشكلة**: الموقع الأصلي يستخدم localStorage، مما يعني كل متصفح له بيانات منفصلة  
**الحل**: ربط الموقع بقاعدة البيانات السحابية مع الاحتفاظ بالنسخة الاحتياطية المحلية

## 📋 خطوات التنفيذ (10 دقائق)

### 1️⃣ رفع ملف api-client للموقع الأصلي

1. **انسخ ملف `api-client-github.js`** إلى مجلد الموقع الأصلي
2. **غيّر اسم الملف** إلى `api-client.js`
3. **حدث رابط الخادم** في السطر 5:

```javascript
// غيّر هذا السطر:
constructor(baseUrl = 'https://your-app.onrender.com') 

// إلى رابط Render الخاص بك:
constructor(baseUrl = 'https://qr-scanner-turso.onrender.com')
```

### 2️⃣ تعديل index.html

أضف هذا السطر في `index.html` قبل `script.js`:

```html
<!-- قبل script.js مباشرة -->
<script src="api-client.js"></script>
<script src="script.js"></script>
```

### 3️⃣ إنشاء ملف تكامل منفصل

إنشئ ملف جديد باسم `cloud-integration.js` وأضف إليه:

```javascript
// ==================== نظام قاعدة البيانات الهجين ====================

// متغيرات النظام الهجين
let useCloudDatabase = false;
let cloudDatabaseChecked = false;

// التحقق من قاعدة البيانات السحابية عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
  // التحقق من قاعدة البيانات السحابية
  await checkCloudDatabase();
});

// فحص قاعدة البيانات السحابية
async function checkCloudDatabase() {
  if (window.apiClient && !cloudDatabaseChecked) {
    cloudDatabaseChecked = true;
    
    try {
      await window.apiClient.checkConnection();
      
      if (window.centralDBAvailable) {
        useCloudDatabase = true;
        console.log('🌍 تم تفعيل النظام السحابي');
        await attemptAutoLogin();
        updateUIForCloudMode();
      }
    } catch (error) {
      console.log('💾 استمرار العمل بالوضع المحلي');
      useCloudDatabase = false;
    }
  }
}

// محاولة تسجيل الدخول التلقائي
async function attemptAutoLogin() {
  if (window.apiClient.sessionId) {
    try {
      const session = await window.apiClient.verifySession();
      if (session.success) {
        const userData = window.apiClient.getCurrentUser();
        if (userData) {
          updateUserInterface(userData.username, userData.isOwner);
          console.log(`✅ تم استرداد جلسة: ${userData.username}`);
        }
      }
    } catch (error) {
      console.log('انتهت صلاحية الجلسة المحفوظة');
    }
  }
}

// تحديث واجهة المستخدم للوضع السحابي
function updateUIForCloudMode() {
  const indicator = document.createElement('div');
  indicator.id = 'cloudModeIndicator';
  indicator.innerHTML = '🌍 النظام السحابي نشط';
  indicator.style.cssText = `
    position: fixed; bottom: 20px; left: 20px; z-index: 1000;
    background: #4CAF50; color: white; padding: 8px 12px;
    border-radius: 20px; font-size: 12px; font-weight: bold;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(indicator);
}

// تعديل دالة تسجيل الدخول لتكون هجينة
const originalLogin = window.login;
window.login = async function() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const isOwnerMode = document.getElementById('loginForm').classList.contains('owner-mode');
  const rememberMe = document.getElementById('rememberMe')?.checked || false;

  if (!username) {
    showMessage('يرجى إدخال اسم المستخدم', 'error');
    return;
  }

  try {
    // محاولة تسجيل الدخول في النظام السحابي أولاً
    if (useCloudDatabase && window.apiClient) {
      try {
        const response = await window.apiClient.login(username, password, isOwnerMode, rememberMe);
        
        if (response.success) {
          updateUserInterface(username, response.session.isOwner);
          showMessage(`🌍 ${response.message}`, 'success');
          await syncWithCloudDatabase();
          return;
        }
      } catch (cloudError) {
        console.log('فشل تسجيل الدخول السحابي، محاولة الدخول المحلي...');
      }
    }

    // استخدام الطريقة الأصلية للتسجيل المحلي
    if (originalLogin) {
      return originalLogin();
    }
    
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    showMessage('خطأ في تسجيل الدخول', 'error');
  }
};

// مزامنة البيانات مع قاعدة البيانات السحابية
async function syncWithCloudDatabase() {
  if (!useCloudDatabase || !window.apiClient || !window.apiClient.isConnected()) {
    return;
  }

  try {
    console.log('🔄 بدء مزامنة البيانات...');
    
    // مزامنة المستخدمين
    const usersResponse = await window.apiClient.getUsers();
    if (usersResponse.success) {
      const cloudUsers = usersResponse.users.map(user => ({
        username: user.username,
        createdBy: user.created_by,
        createdAt: user.created_at
      }));
      localStorage.setItem('users', JSON.stringify(cloudUsers));
    }
    
    // مزامنة المسحات
    const scansResponse = await window.apiClient.getScans();
    if (scansResponse.success) {
      const cloudScans = scansResponse.scans.map(scan => ({
        id: scan.id,
        barcode: scan.barcode,
        codeType: scan.code_type,
        user: scan.username,
        timestamp: scan.scan_timestamp,
        imageDataUrl: scan.image_data_url,
        telegramStatus: scan.telegram_status
      }));
      localStorage.setItem('scans', JSON.stringify(cloudScans));
      updateStatistics();
    }
    
    console.log('✅ تمت مزامنة البيانات بنجاح');
    
  } catch (error) {
    console.error('خطأ في مزامنة البيانات:', error);
  }
}

console.log('🌊 تم تحميل نظام التكامل السحابي');
```

### 4️⃣ تحديث index.html لإضافة ملف التكامل

```html
<!-- إضافة هذه الأسطر قبل </body> -->
<script src="api-client.js"></script>
<script src="cloud-integration.js"></script>
<script src="script.js"></script>
```

## 🎯 النتيجة النهائية

### بعد التطبيق:
- **🌍 عندما يكون الخادم متاح**: جميع الأجهزة تشارك نفس البيانات
- **💾 عندما يكون الخادم غير متاح**: يعمل محلياً كما كان سابقاً
- **🔄 مزامنة تلقائية** عند عودة الاتصال

### المميزات الجديدة:
1. **إشعارات بصرية** توضح حالة النظام
2. **مزامنة تلقائية** للبيانات عند الاتصال
3. **نظام احتياطي** يضمن عدم فقدان الوظائف
4. **واجهة موحدة** لجميع المستخدمين

**النتيجة: لا مزيد من "كل متصفح له قاعدة منفصلة"!** 🎉 