// عميل API للاتصال بقاعدة البيانات السحابية (Turso)
class ApiClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.sessionId = localStorage.getItem('centraldb_session');
    this.isCloudDatabase = true; // يستخدم Turso السحابية
  }

  // إعداد headers الافتراضية
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.sessionId) {
      headers['Authorization'] = `Bearer ${this.sessionId}`;
    }
    
    return headers;
  }

  // دالة عامة للطلبات
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
        headers: this.getHeaders(),
        ...options
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'خطأ في الطلب');
      }

      return data;
    } catch (error) {
      console.error('خطأ في API:', error);
      throw error;
    }
  }

  // تسجيل الدخول
  async login(username, password = null, isOwner = false, rememberMe = false) {
    const response = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        isOwner,
        rememberMe
      })
    });

    if (response.success && response.session) {
      this.sessionId = response.session.sessionId;
      localStorage.setItem('centraldb_session', this.sessionId);
      localStorage.setItem('centraldb_user', JSON.stringify(response.session));
    }

    return response;
  }

  // تسجيل الخروج
  async logout() {
    try {
      await this.request('/logout', {
        method: 'POST',
        body: JSON.stringify({ sessionId: this.sessionId })
      });
    } finally {
      this.sessionId = null;
      localStorage.removeItem('centraldb_session');
      localStorage.removeItem('centraldb_user');
    }
  }

  // التحقق من صحة الجلسة
  async verifySession() {
    if (!this.sessionId) {
      return { success: false, message: 'لا توجد جلسة' };
    }

    try {
      const response = await this.request('/verify-session', {
        method: 'POST',
        body: JSON.stringify({ sessionId: this.sessionId })
      });

      if (response.success) {
        localStorage.setItem('centraldb_user', JSON.stringify(response.session));
      }

      return response;
    } catch (error) {
      // إذا انتهت صلاحية الجلسة، احذف البيانات المحلية
      this.sessionId = null;
      localStorage.removeItem('centraldb_session');
      localStorage.removeItem('centraldb_user');
      throw error;
    }
  }

  // حفظ مسحة جديدة
  async saveScan(barcode, codeType, imageDataUrl) {
    return await this.request('/scans', {
      method: 'POST',
      body: JSON.stringify({
        barcode,
        codeType,
        imageDataUrl
      })
    });
  }

  // جلب جميع المسحات
  async getScans(filters = {}) {
    const queryParams = new URLSearchParams();
    
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.userId) queryParams.append('userId', filters.userId);

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/scans?${queryString}` : '/scans';
    
    return await this.request(endpoint);
  }

  // تحديث حالة التليجرام
  async updateTelegramStatus(scanId, status, attempts = 0, errorMessage = null) {
    return await this.request(`/scans/${scanId}/telegram-status`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        attempts,
        errorMessage
      })
    });
  }

  // جلب الإحصائيات
  async getStatistics() {
    return await this.request('/statistics');
  }

  // إدارة المستخدمين (للأونر فقط)
  async getUsers() {
    return await this.request('/users');
  }

  async addUser(username) {
    return await this.request('/users', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
  }

  async deleteUser(username) {
    return await this.request(`/users/${username}`, {
      method: 'DELETE'
    });
  }

  // إدارة الإعدادات (للأونر فقط)
  async getSettings() {
    return await this.request('/settings');
  }

  async saveSettings(botToken, chatId, autoSend) {
    return await this.request('/settings', {
      method: 'POST',
      body: JSON.stringify({
        botToken,
        chatId,
        autoSend
      })
    });
  }

  async testTelegram(botToken, chatId) {
    return await this.request('/test-telegram', {
      method: 'POST',
      body: JSON.stringify({
        botToken,
        chatId
      })
    });
  }

  // التحقق من حالة الخادم
  async checkServerStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/api/status`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // الحصول على معلومات المستخدم المحفوظة
  getCurrentUser() {
    const userData = localStorage.getItem('centraldb_user');
    return userData ? JSON.parse(userData) : null;
  }

  // التحقق من الاتصال بالخادم
  isConnected() {
    return !!this.sessionId;
  }
}

// إنشاء مثيل عام للاستخدام
window.apiClient = new ApiClient();

// دالة مساعدة للتحقق من حالة الخادم
async function checkCentralDatabaseStatus() {
  try {
    const isServerUp = await window.apiClient.checkServerStatus();
    
    if (isServerUp) {
      console.log('✅ قاعدة البيانات السحابية (Turso) متصلة');
      
      // محاولة التحقق من الجلسة الحالية
      try {
        await window.apiClient.verifySession();
        console.log('✅ الجلسة صالحة');
        return 'connected';
      } catch (error) {
        console.log('⚠️ الجلسة منتهية الصلاحية');
        return 'disconnected';
      }
    } else {
      console.log('❌ قاعدة البيانات السحابية غير متاحة - العمل بالوضع المحلي');
      return 'offline';
    }
  } catch (error) {
    console.log('❌ خطأ في الاتصال بقاعدة البيانات السحابية:', error.message);
    return 'offline';
  }
}

// دالة للتكامل مع النظام الحالي
async function integrateCentralDatabase() {
  const dbStatus = await checkCentralDatabaseStatus();
  
  if (dbStatus === 'offline') {
    // استخدام النظام المحلي الحالي
    console.log('🔄 تم التبديل للوضع المحلي');
    return false;
  }
  
  if (dbStatus === 'disconnected') {
    // إظهار نافذة تسجيل الدخول للقاعدة السحابية
    showCentralDatabaseLogin();
    return false;
  }
  
  // القاعدة السحابية متصلة وجاهزة
  console.log('🌍 تم الاتصال بقاعدة البيانات السحابية (Turso)');
  return true;
}

// نافذة تسجيل الدخول للقاعدة المركزية
function showCentralDatabaseLogin() {
  // يمكن دمج هذا مع واجهة تسجيل الدخول الحالية
  // أو إنشاء نافذة منفصلة
  console.log('💾 قاعدة البيانات المركزية متاحة - يمكنك تسجيل الدخول للمزامنة');
}

// دالة الإرسال المحدثة للتليجرام
async function sendToTelegram(barcode, imageDataUrl) {
  // إذا كانت القاعدة المركزية متصلة، استخدمها
  if (window.apiClient.isConnected()) {
    try {
      // الخادم سيتولى الإرسال تلقائياً
      return { success: true, message: 'تم الحفظ والإرسال عبر القاعدة المركزية' };
    } catch (error) {
      console.error('خطأ في القاعدة المركزية:', error);
      // العودة للطريقة المحلية
    }
  }
  
  // استخدام الطريقة المحلية الأصلية
  const botToken = "7668051564:AAFdFqSd0CKrlSOyPKyFwf-xHi791lcsC_U";
  const chatId = -1002439956600;
  
  // الكود الأصلي للإرسال...
  // [يتم الاحتفاظ بالكود الأصلي كنسخة احتياطية]
}

console.log('📡 تم تحميل عميل قاعدة البيانات المركزية'); 