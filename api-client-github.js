// عميل API للاتصال بقاعدة البيانات السحابية (Turso)
// نسخة محسنة للموقع الأصلي على GitHub Pages

class ApiClient {
  constructor(baseUrl = 'https://qr-xo9q.onrender.com/') { // 🔥 غيّر هذا لرابط Render الخاص بك
    this.baseUrl = baseUrl;
    this.sessionId = localStorage.getItem('centraldb_session');
    this.isCloudDatabase = true;
    
    // تحقق تلقائي من الاتصال عند الإنشاء
    this.checkConnection();
  }

  // التحقق التلقائي من الاتصال
  async checkConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/api/status`, { 
        method: 'GET',
        timeout: 5000 
      });
      
      if (response.ok) {
        window.centralDBAvailable = true;
        console.log('🌍 قاعدة البيانات السحابية متاحة');
        this.showConnectionStatus('🌍 متصل بقاعدة البيانات السحابية', 'success');
      } else {
        throw new Error('خادم غير متاح');
      }
    } catch (error) {
      window.centralDBAvailable = false;
      console.log('💾 العمل بالوضع المحلي');
      this.showConnectionStatus('💾 العمل بالوضع المحلي', 'info');
    }
  }

  // عرض حالة الاتصال للمستخدم
  showConnectionStatus(message, type) {
    // إنشاء إشعار بصري
    const notification = document.createElement('div');
    notification.className = `connection-status ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10000;
      padding: 10px 15px; border-radius: 8px; color: white; font-weight: bold;
      background: ${type === 'success' ? '#4CAF50' : '#2196F3'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease-out;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 14px; max-width: 300px;
    `;
    
    // إضافة animation CSS
    if (!document.querySelector('#connectionStatusCSS')) {
      const style = document.createElement('style');
      style.id = 'connectionStatusCSS';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // إزالة الإشعار بعد 4 ثواني
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 4000);
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

  // دالة عامة للطلبات مع fallback للوضع المحلي
  async request(endpoint, options = {}) {
    // إذا لم تكن قاعدة البيانات السحابية متاحة، لا تحاول الطلب
    if (!window.centralDBAvailable) {
      throw new Error('قاعدة البيانات السحابية غير متاحة');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
        headers: this.getHeaders(),
        timeout: 10000,
        ...options
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'خطأ في الطلب');
      }

      return data;
    } catch (error) {
      console.error('خطأ في API:', error);
      
      // إذا كان خطأ شبكة، اعتبر الخادم غير متاح
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        window.centralDBAvailable = false;
        this.showConnectionStatus('❌ انقطع الاتصال - العمل محلياً', 'warning');
      }
      
      throw error;
    }
  }

  // تسجيل الدخول
  async login(username, password = null, isOwner = false, rememberMe = false) {
    try {
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
        
        this.showConnectionStatus('✅ تم تسجيل الدخول بقاعدة البيانات السحابية', 'success');
      }

      return response;
    } catch (error) {
      // fallback للطريقة المحلية
      console.log('تسجيل الدخول محلياً...');
      throw error;
    }
  }

  // حفظ مسحة جديدة
  async saveScan(barcode, codeType, imageDataUrl, username) {
    try {
      const response = await this.request('/scans', {
        method: 'POST',
        body: JSON.stringify({
          barcode,
          codeType,
          imageDataUrl
        })
      });
      
      if (response.success) {
        this.showConnectionStatus('✅ تم حفظ المسحة في قاعدة البيانات السحابية', 'success');
      }
      
      return response;
    } catch (error) {
      console.log('حفظ محلي للمسحة...');
      throw error;
    }
  }

  // جلب البيانات من قاعدة البيانات السحابية
  async getScans(filters = {}) {
    return await this.request('/scans');
  }

  async getUsers() {
    return await this.request('/users');
  }

  async addUser(username) {
    const response = await this.request('/users', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
    
    if (response.success) {
      this.showConnectionStatus(`✅ تم إضافة المستخدم "${username}" للقاعدة السحابية`, 'success');
    }
    
    return response;
  }

  async deleteUser(username) {
    const response = await this.request(`/users/${username}`, {
      method: 'DELETE'
    });
    
    if (response.success) {
      this.showConnectionStatus(`✅ تم حذف المستخدم "${username}" من القاعدة السحابية`, 'success');
    }
    
    return response;
  }

  // الإعدادات
  async getSettings() {
    return await this.request('/settings');
  }

  async saveSettings(botToken, chatId, autoSend) {
    const response = await this.request('/settings', {
      method: 'POST',
      body: JSON.stringify({
        botToken,
        chatId,
        autoSend
      })
    });
    
    if (response.success) {
      this.showConnectionStatus('✅ تم حفظ الإعدادات في القاعدة السحابية', 'success');
    }
    
    return response;
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

  // الحصول على معلومات المستخدم المحفوظة
  getCurrentUser() {
    const userData = localStorage.getItem('centraldb_user');
    return userData ? JSON.parse(userData) : null;
  }

  // التحقق من الاتصال
  isConnected() {
    return window.centralDBAvailable && !!this.sessionId;
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
      this.showConnectionStatus('✅ تم تسجيل الخروج من القاعدة السحابية', 'info');
    }
  }
}

// إنشاء مثيل عام
window.apiClient = new ApiClient();

// متغير عام لحالة الاتصال
window.centralDBAvailable = false;

// دالة مساعدة للتحقق مع النظام الحالي
window.checkCentralDatabaseConnection = async function() {
  if (window.apiClient) {
    await window.apiClient.checkConnection();
    return window.centralDBAvailable;
  }
  return false;
};

console.log('📡 تم تحميل عميل قاعدة البيانات السحابية (GitHub Pages)'); 