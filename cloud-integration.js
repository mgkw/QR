// ==================== نظام قاعدة البيانات الهجين ====================
// ملف التكامل مع قاعدة البيانات السحابية (Turso)

// متغيرات النظام الهجين
let useCloudDatabase = false;
let cloudDatabaseChecked = false;

// التحقق من قاعدة البيانات السحابية عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
  // انتظار تحميل api-client أولاً
  setTimeout(async () => {
    await checkCloudDatabase();
  }, 500);
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
          if (typeof updateUserInterface === 'function') {
            updateUserInterface(userData.username, userData.isOwner);
          }
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
  // إزالة المؤشر السابق إن وُجد
  const existingIndicator = document.getElementById('cloudModeIndicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }

  const indicator = document.createElement('div');
  indicator.id = 'cloudModeIndicator';
  indicator.innerHTML = '🌍 النظام السحابي نشط';
  indicator.style.cssText = `
    position: fixed; bottom: 20px; left: 20px; z-index: 1000;
    background: #4CAF50; color: white; padding: 8px 12px;
    border-radius: 20px; font-size: 12px; font-weight: bold;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    font-family: 'Segoe UI', Arial, sans-serif;
    cursor: pointer;
    transition: all 0.3s ease;
  `;
  
  // إضافة تأثير hover
  indicator.addEventListener('mouseenter', () => {
    indicator.style.background = '#45a049';
    indicator.style.transform = 'scale(1.05)';
  });
  
  indicator.addEventListener('mouseleave', () => {
    indicator.style.background = '#4CAF50';
    indicator.style.transform = 'scale(1)';
  });
  
  // عرض تفاصيل إضافية عند النقر
  indicator.addEventListener('click', () => {
    const user = window.apiClient.getCurrentUser();
    const message = user ? 
      `مرحباً ${user.username}!\nمتصل بقاعدة البيانات السحابية` : 
      'متصل بقاعدة البيانات السحابية\nلم يتم تسجيل الدخول بعد';
    alert(message);
  });
  
  document.body.appendChild(indicator);
}

// تعديل دالة تسجيل الدخول لتكون هجينة
function enhanceLoginFunction() {
  if (typeof window.login === 'function') {
    const originalLogin = window.login;
    
    window.login = async function() {
      const username = document.getElementById('username')?.value?.trim();
      const password = document.getElementById('password')?.value;
      const isOwnerMode = document.getElementById('loginForm')?.classList?.contains('owner-mode');
      const rememberMe = document.getElementById('rememberMe')?.checked || false;

      if (!username) {
        if (typeof showMessage === 'function') {
          showMessage('يرجى إدخال اسم المستخدم', 'error');
        }
        return;
      }

      try {
        // محاولة تسجيل الدخول في النظام السحابي أولاً
        if (useCloudDatabase && window.apiClient) {
          try {
            const response = await window.apiClient.login(username, password, isOwnerMode, rememberMe);
            
            if (response.success) {
              if (typeof updateUserInterface === 'function') {
                updateUserInterface(username, response.session.isOwner);
              }
              if (typeof showMessage === 'function') {
                showMessage(`🌍 ${response.message}`, 'success');
              }
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
        if (typeof showMessage === 'function') {
          showMessage('خطأ في تسجيل الدخول', 'error');
        }
      }
    };
  }
}

// تعديل دالة حفظ المسحات
function enhanceSaveScanFunction() {
  if (typeof window.saveScanResult === 'function') {
    const originalSaveScan = window.saveScanResult;
    
    window.saveScanResult = async function(barcode, codeType, imageDataUrl) {
      // محاولة الحفظ السحابي أولاً
      if (useCloudDatabase && window.apiClient && window.apiClient.isConnected()) {
        try {
          const response = await window.apiClient.saveScan(barcode, codeType, imageDataUrl);
          
          if (response.success) {
            console.log('✅ تم حفظ المسحة في قاعدة البيانات السحابية');
            
            // حفظ نسخة محلية أيضاً للعرض الفوري
            if (originalSaveScan) {
              await originalSaveScan(barcode, codeType, imageDataUrl);
            }
            
            if (typeof showMessage === 'function') {
              showMessage('✅ تم حفظ المسحة في قاعدة البيانات السحابية', 'success');
            }
            return;
          }
        } catch (cloudError) {
          console.log('فشل الحفظ السحابي، حفظ محلي...');
        }
      }

      // استخدام الطريقة الأصلية للحفظ المحلي
      if (originalSaveScan) {
        await originalSaveScan(barcode, codeType, imageDataUrl);
        if (typeof showMessage === 'function') {
          showMessage('💾 تم حفظ المسحة محلياً', 'success');
        }
      }
    };
  }
}

// تعديل دالة إضافة المستخدمين
function enhanceAddUserFunction() {
  if (typeof window.addUser === 'function') {
    const originalAddUser = window.addUser;
    
    window.addUser = async function() {
      const newUsername = document.getElementById('newUsername')?.value?.trim();
      
      if (!newUsername) {
        if (typeof showMessage === 'function') {
          showMessage('يرجى إدخال اسم المستخدم', 'error');
        }
        return;
      }

      try {
        // محاولة الإضافة في النظام السحابي أولاً
        if (useCloudDatabase && window.apiClient && window.apiClient.isConnected()) {
          try {
            const response = await window.apiClient.addUser(newUsername);
            
            if (response.success) {
              console.log('✅ تم إضافة المستخدم في قاعدة البيانات السحابية');
              
              // إضافة نسخة محلية أيضاً
              if (originalAddUser) {
                await originalAddUser();
              } else {
                // تنظيف الحقل
                document.getElementById('newUsername').value = '';
              }
              
              if (typeof showMessage === 'function') {
                showMessage(`✅ تم إضافة المستخدم "${newUsername}" للقاعدة السحابية`, 'success');
              }
              
              // تحديث قائمة المستخدمين
              await syncWithCloudDatabase();
              if (typeof loadUsers === 'function') {
                loadUsers();
              }
              return;
            }
          } catch (cloudError) {
            console.log('فشل الإضافة السحابية، إضافة محلية...');
          }
        }

        // استخدام الطريقة الأصلية للإضافة المحلية
        if (originalAddUser) {
          return originalAddUser();
        }
        
      } catch (error) {
        console.error('خطأ في إضافة المستخدم:', error);
        if (typeof showMessage === 'function') {
          showMessage('خطأ في إضافة المستخدم', 'error');
        }
      }
    };
  }
}

// مزامنة البيانات مع قاعدة البيانات السحابية
async function syncWithCloudDatabase() {
  if (!useCloudDatabase || !window.apiClient || !window.apiClient.isConnected()) {
    return;
  }

  try {
    console.log('🔄 بدء مزامنة البيانات...');
    
    // مزامنة المستخدمين
    try {
      const usersResponse = await window.apiClient.getUsers();
      if (usersResponse.success) {
        const cloudUsers = usersResponse.users.map(user => ({
          username: user.username,
          createdBy: user.created_by,
          createdAt: user.created_at
        }));
        localStorage.setItem('users', JSON.stringify(cloudUsers));
        console.log('✅ تم مزامنة المستخدمين');
      }
    } catch (error) {
      console.log('⚠️ تعذر مزامنة المستخدمين');
    }
    
    // مزامنة المسحات
    try {
      const scansResponse = await window.apiClient.getScans();
      if (scansResponse.success) {
        const cloudScans = scansResponse.scans.map(scan => ({
          id: scan.id,
          barcode: scan.barcode,
          codeType: scan.code_type,
          user: scan.username,
          timestamp: scan.scan_timestamp,
          imageDataUrl: scan.image_data_url,
          telegramStatus: scan.telegram_status || 'pending'
        }));
        localStorage.setItem('scans', JSON.stringify(cloudScans));
        
        // تحديث الإحصائيات والعرض
        if (typeof updateStatistics === 'function') {
          updateStatistics();
        }
        console.log('✅ تم مزامنة المسحات');
      }
    } catch (error) {
      console.log('⚠️ تعذر مزامنة المسحات');
    }
    
    // مزامنة الإعدادات (للأونر فقط)
    try {
      const currentUser = window.apiClient.getCurrentUser();
      if (currentUser && currentUser.isOwner) {
        const settingsResponse = await window.apiClient.getSettings();
        if (settingsResponse.success) {
          const settings = settingsResponse.settings;
          localStorage.setItem('botToken', settings.bot_token || '');
          localStorage.setItem('chatId', settings.chat_id || '');
          localStorage.setItem('autoSend', settings.auto_send === '1' ? 'true' : 'false');
          console.log('✅ تم مزامنة الإعدادات');
        }
      }
    } catch (error) {
      console.log('⚠️ تعذر مزامنة الإعدادات');
    }
    
    console.log('✅ انتهت مزامنة البيانات');
    
  } catch (error) {
    console.error('خطأ في مزامنة البيانات:', error);
  }
}

// إضافة زر مزامنة يدوية للأونر
function addSyncButton() {
  if (!useCloudDatabase) return;
  
  const currentUser = window.apiClient?.getCurrentUser();
  if (currentUser && currentUser.isOwner) {
    // البحث عن مكان مناسب لإضافة الزر
    const ownerSection = document.querySelector('.owner-section, .settings-section, .admin-panel');
    
    if (ownerSection && !document.getElementById('syncButton')) {
      const syncButton = document.createElement('button');
      syncButton.id = 'syncButton';
      syncButton.textContent = '🔄 مزامنة البيانات';
      syncButton.className = 'sync-button';
      syncButton.style.cssText = `
        background: #2196F3; color: white; border: none; padding: 8px 15px;
        border-radius: 5px; cursor: pointer; margin: 10px 5px;
        font-size: 14px; font-weight: bold;
      `;
      
      syncButton.onclick = async () => {
        syncButton.disabled = true;
        syncButton.textContent = '🔄 جاري المزامنة...';
        syncButton.style.background = '#ccc';
        
        await syncWithCloudDatabase();
        
        syncButton.disabled = false;
        syncButton.textContent = '🔄 مزامنة البيانات';
        syncButton.style.background = '#2196F3';
        
        if (typeof showMessage === 'function') {
          showMessage('✅ تمت المزامنة بنجاح', 'success');
        }
      };
      
      ownerSection.appendChild(syncButton);
    }
  }
}

// تطبيق جميع التحسينات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  // انتظار قليل للتأكد من تحميل جميع الدوال الأصلية
  setTimeout(() => {
    enhanceLoginFunction();
    enhanceSaveScanFunction();
    enhanceAddUserFunction();
    
    // إضافة زر المزامنة للأونر (بعد تسجيل الدخول)
    setTimeout(() => {
      addSyncButton();
    }, 2000);
  }, 1000);
});

// إضافة listener للتحقق من تسجيل دخول جديد
let lastUserCheck = null;
setInterval(() => {
  if (useCloudDatabase && window.apiClient) {
    const currentUser = window.apiClient.getCurrentUser();
    const currentUserStr = JSON.stringify(currentUser);
    
    if (currentUserStr !== lastUserCheck) {
      lastUserCheck = currentUserStr;
      if (currentUser) {
        // تم تسجيل دخول جديد أو تغيير المستخدم
        addSyncButton();
      }
    }
  }
}, 3000);

// إضافة دالة عامة للتحقق من حالة النظام
window.getCloudDatabaseStatus = function() {
  return {
    available: useCloudDatabase,
    connected: window.apiClient?.isConnected() || false,
    user: window.apiClient?.getCurrentUser() || null
  };
};

console.log('🌊 تم تحميل نظام التكامل السحابي'); 