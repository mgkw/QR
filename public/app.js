// متغيرات عامة
let currentUser = null;
let currentSession = null;
let isScanning = false;
let stream = null;
let scanInterval = null;

// عناصر DOM
const loginModal = document.getElementById('loginModal');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userDisplay = document.getElementById('userDisplay');
const usernameDisplay = document.getElementById('usernameDisplay');
const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const viewScansBtn = document.getElementById('viewScansBtn');
const videoContainer = document.getElementById('videoContainer');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const alertContainer = document.getElementById('alertContainer');
const resultsSection = document.getElementById('resultsSection');
const scansContainer = document.getElementById('scansContainer');

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    loadStats();
    loadScans();
    checkURLParams(); // فحص معاملات URL للدخول التلقائي
});

// تهيئة التطبيق
function initApp() {
    // ربط الأحداث
    loginBtn.addEventListener('click', showLoginModal);
    logoutBtn.addEventListener('click', logout);
    startScanBtn.addEventListener('click', startScanning);
    stopScanBtn.addEventListener('click', stopScanning);
    viewScansBtn.addEventListener('click', toggleScansView);
    
    // نافذة تسجيل الدخول
    document.getElementById('closeLogin').addEventListener('click', hideLoginModal);
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // إغلاق النافذة بالنقر خارجها
    loginModal.addEventListener('click', function(e) {
        if (e.target === loginModal) {
            hideLoginModal();
        }
    });
    
    // فحص الجلسة المحفوظة
    const sessionId = getCookie('session_id');
    if (sessionId) {
        loadSession(sessionId);
    }
    
    console.log('🚀 تم تشغيل التطبيق بنجاح');
}

// تسجيل الدخول
function showLoginModal() {
    loginModal.style.display = 'block';
    document.getElementById('username').focus();
}

function hideLoginModal() {
    loginModal.style.display = 'none';
    document.getElementById('loginForm').reset();
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username) {
        showAlert('يرجى إدخال اسم المستخدم', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            // إنشاء جلسة جديدة
            await createSession(data.user);
            hideLoginModal();
            updateUI();
            showAlert(`مرحباً ${username}!`, 'success');
            loadStats();
            loadScans();
        } else {
            showAlert(data.message || 'خطأ في تسجيل الدخول', 'error');
        }
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        showAlert('خطأ في الاتصال بالخادم', 'error');
    }
}

// تسجيل الخروج
async function logout() {
    if (currentSession) {
        await endSession(currentSession.id);
    }
    currentUser = null;
    currentSession = null;
    deleteCookie('session_id');
    updateUI();
    stopScanning();
    showAlert('تم تسجيل الخروج بنجاح', 'info');
}

// تحديث واجهة المستخدم
function updateUI() {
    if (currentUser) {
        // المستخدم مسجل الدخول
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        userDisplay.classList.remove('hidden');
        startScanBtn.classList.remove('hidden');
        usernameDisplay.textContent = currentUser.username;
    } else {
        // المستخدم غير مسجل الدخول
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        userDisplay.classList.add('hidden');
        startScanBtn.classList.add('hidden');
        stopScanBtn.classList.add('hidden');
        videoContainer.style.display = 'none';
    }
}

// بدء المسح
async function startScanning() {
    if (!currentUser) {
        showAlert('يرجى تسجيل الدخول أولاً', 'error');
        return;
    }
    
    try {
        // طلب إذن الكاميرا
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment', // الكاميرا الخلفية
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        
        video.srcObject = stream;
        videoContainer.style.display = 'block';
        isScanning = true;
        
        startScanBtn.classList.add('hidden');
        stopScanBtn.classList.remove('hidden');
        
        // بدء عملية المسح
        video.addEventListener('loadedmetadata', () => {
            startScanProcess();
        });
        
        showAlert('تم بدء المسح بنجاح', 'success');
        
    } catch (error) {
        handleCameraError(error);
    }
}

// إيقاف المسح
function stopScanning() {
    isScanning = false;
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
    
    video.srcObject = null;
    videoContainer.style.display = 'none';
    
    startScanBtn.classList.remove('hidden');
    stopScanBtn.classList.add('hidden');
    
    showAlert('تم إيقاف المسح', 'info');
}

// عملية المسح الفعلية
function startScanProcess() {
    const context = canvas.getContext('2d');
    
    scanInterval = setInterval(() => {
        if (!isScanning || video.readyState !== video.HAVE_ENOUGH_DATA) {
            return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        if (canvas.width === 0 || canvas.height === 0) {
            return;
        }
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        try {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            
            // فحص QR Code باستخدام jsQR
            if (typeof jsQR !== 'undefined') {
                const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
                
                if (qrCode && qrCode.data) {
                    handleDetectedCode(qrCode.data, 'QR Code');
                    return;
                }
            }
            
            // يمكن إضافة فحص الباركود التقليدي هنا لاحقاً
            
        } catch (error) {
            console.debug('خطأ في معالجة الصورة:', error);
        }
    }, 100); // فحص كل 100ms
}

// معالجة الكود المكتشف
async function handleDetectedCode(code, codeType) {
    if (!code || !currentUser) return;
    
    // إيقاف المسح مؤقتاً لمنع المسح المتكرر
    isScanning = false;
    
    try {
        // التقاط صورة الكود
        const imageData = captureImage();
        
        // حفظ المسح
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                barcode: code,
                code_type: codeType,
                user_id: currentUser.id,
                username: currentUser.username,
                image_data: imageData,
                notes: ''
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`تم مسح ${codeType}: ${code}`, 'success');
            playSuccessSound();
            loadScans(); // إعادة تحميل قائمة المسحات
            loadStats(); // تحديث الإحصائيات
        } else {
            showAlert('خطأ في حفظ المسح', 'error');
        }
        
    } catch (error) {
        console.error('خطأ في معالجة الكود:', error);
        showAlert('خطأ في معالجة الكود', 'error');
    }
    
    // إعادة تشغيل المسح بعد ثانيتين
    setTimeout(() => {
        if (stream) {
            isScanning = true;
        }
    }, 2000);
}

// التقاط صورة من الفيديو
function captureImage() {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
}

// تحميل الإحصائيات
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('userCount').textContent = data.stats.users;
            document.getElementById('scanCount').textContent = data.stats.scans;
            document.getElementById('uniqueCount').textContent = data.stats.unique_codes;
        }
    } catch (error) {
        console.error('خطأ في تحميل الإحصائيات:', error);
        document.getElementById('userCount').textContent = '0';
        document.getElementById('scanCount').textContent = '0';
        document.getElementById('uniqueCount').textContent = '0';
    }
}

// تحميل قائمة المسحات
async function loadScans() {
    try {
        const response = await fetch('/api/scans?limit=20');
        const data = await response.json();
        
        if (data.success && data.scans) {
            displayScans(data.scans);
        }
    } catch (error) {
        console.error('خطأ في تحميل المسحات:', error);
    }
}

// عرض المسحات
function displayScans(scans) {
    if (!scans || scans.length === 0) {
        scansContainer.innerHTML = '<p style="text-align: center; opacity: 0.7;">لا توجد مسحات حتى الآن</p>';
        return;
    }
    
    let html = '<table class="scans-table">';
    html += '<thead><tr><th>الوقت</th><th>المستخدم</th><th>الكود</th><th>النوع</th><th>العمليات</th></tr></thead><tbody>';
    
    scans.forEach(scan => {
        const time = new Date(scan.scan_time).toLocaleString('ar-EG');
        html += `
            <tr>
                <td>${time}</td>
                <td>${scan.username}</td>
                <td><span class="barcode-text">${scan.barcode}</span></td>
                <td>${scan.code_type}</td>
                <td>
                    <button class="btn btn-secondary" onclick="copyCode('${scan.barcode}')">
                        <i class="fas fa-copy"></i>
                    </button>
                    ${currentUser && currentUser.is_admin ? 
                        `<button class="btn btn-secondary" onclick="deleteScan('${scan.id}')">
                            <i class="fas fa-trash"></i>
                        </button>` : ''
                    }
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    scansContainer.innerHTML = html;
}

// تبديل عرض المسحات
function toggleScansView() {
    if (resultsSection.classList.contains('hidden')) {
        resultsSection.classList.remove('hidden');
        loadScans();
    } else {
        resultsSection.classList.add('hidden');
    }
}

// نسخ الكود
function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showAlert('تم نسخ الكود', 'success');
    }).catch(() => {
        showAlert('خطأ في نسخ الكود', 'error');
    });
}

// حذف مسح (للمدير فقط)
async function deleteScan(scanId) {
    if (!currentUser || !currentUser.is_admin) {
        showAlert('هذه العملية متاحة للمدير فقط', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/scan/${scanId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('تم حذف المسح بنجاح', 'success');
            loadScans();
            loadStats();
        } else {
            showAlert('خطأ في حذف المسح', 'error');
        }
    } catch (error) {
        console.error('خطأ في حذف المسح:', error);
        showAlert('خطأ في الاتصال بالخادم', 'error');
    }
}

// عرض التنبيهات
function showAlert(message, type = 'info') {
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type}`;
    alertElement.innerHTML = `
        <i class="fas fa-${getAlertIcon(type)}"></i>
        ${message}
    `;
    
    alertContainer.appendChild(alertElement);
    
    // إزالة التنبيه بعد 5 ثوانِ
    setTimeout(() => {
        if (alertElement.parentNode) {
            alertElement.parentNode.removeChild(alertElement);
        }
    }, 5000);
}

// أيقونات التنبيهات
function getAlertIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-triangle';
        case 'info': return 'info-circle';
        default: return 'info-circle';
    }
}

// تشغيل صوت النجاح
function playSuccessSound() {
    try {
        // صوت بسيط باستخدام Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        console.debug('خطأ في تشغيل الصوت:', error);
    }
}

// فحص معاملات URL للدخول التلقائي
function checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    const password = urlParams.get('password');
    
    if (username && !currentUser) {
        // ملء نموذج تسجيل الدخول تلقائياً
        document.getElementById('username').value = username;
        if (password) {
            document.getElementById('password').value = password;
        }
        
        // محاولة تسجيل الدخول التلقائي
        setTimeout(() => {
            if (!currentUser) {
                document.getElementById('loginForm').dispatchEvent(new Event('submit'));
            }
        }, 500);
        
        // إزالة المعاملات من URL
        const cleanURL = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanURL);
    }
}

// إضافة مستمع للضغط على Escape لإغلاق النوافذ
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        hideLoginModal();
        // إغلاق أي نوافذ منبثقة أخرى
        closeAnyOpenModals();
    }
});

// إغلاق جميع النوافذ المنبثقة
function closeAnyOpenModals() {
    // إغلاق نافذة تسجيل الدخول
    hideLoginModal();
    
    // إزالة أي تنبيهات
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    });
}

// تحسين معالجة أخطاء الكاميرا
function handleCameraError(error) {
    console.error('خطأ في الكاميرا:', error);
    
    let errorMessage = 'خطأ في الوصول للكاميرا.';
    
    if (error.name === 'NotAllowedError') {
        errorMessage = 'تم رفض إذن الكاميرا. يرجى السماح للموقع باستخدام الكاميرا.';
    } else if (error.name === 'NotFoundError') {
        errorMessage = 'لم يتم العثور على كاميرا. تأكد من توصيل كاميرا.';
    } else if (error.name === 'NotSupportedError') {
        errorMessage = 'الكاميرا غير مدعومة في هذا المتصفح.';
    }
    
    showAlert(errorMessage, 'error');
    
    // إعادة تعيين الأزرار
    startScanBtn.classList.remove('hidden');
    stopScanBtn.classList.add('hidden');
}

// ========== دوال إدارة الجلسات والإعدادات (بدلاً من localStorage) ==========

// دوال إدارة الـ Cookies
function setCookie(name, value, days = 30) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// إنشاء جلسة جديدة
async function createSession(user) {
    try {
        const response = await fetch('/api/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: user.id,
                username: user.username,
                session_data: {
                    login_time: new Date().toISOString(),
                    user_agent: navigator.userAgent
                },
                expires_in: 86400 // 24 ساعة
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentSession = {
                id: data.session_id,
                expires_at: data.expires_at
            };
            setCookie('session_id', data.session_id, 1); // حفظ في cookie لمدة يوم واحد
            console.log('✅ تم إنشاء الجلسة بنجاح');
        } else {
            console.error('❌ فشل في إنشاء الجلسة');
        }
    } catch (error) {
        console.error('خطأ في إنشاء الجلسة:', error);
    }
}

// تحميل الجلسة الموجودة
async function loadSession(sessionId) {
    try {
        const response = await fetch(`/api/session/${sessionId}`);
        const data = await response.json();
        
        if (data.success) {
            currentSession = data.session;
            // إعادة تعيين بيانات المستخدم من الجلسة
            const userResponse = await fetch(`/api/users`);
            const userData = await userResponse.json();
            
            if (userData.success) {
                const user = userData.users.find(u => u.id === currentSession.user_id);
                if (user) {
                    currentUser = {
                        id: user.id,
                        username: user.username,
                        full_name: user.full_name,
                        is_admin: Boolean(user.is_admin)
                    };
                    updateUI();
                    console.log('✅ تم تحميل الجلسة بنجاح');
                }
            }
        } else {
            // الجلسة منتهية الصلاحية أو غير صالحة
            deleteCookie('session_id');
            console.log('⚠️ الجلسة منتهية الصلاحية');
        }
    } catch (error) {
        console.error('خطأ في تحميل الجلسة:', error);
        deleteCookie('session_id');
    }
}

// إنهاء الجلسة
async function endSession(sessionId) {
    try {
        await fetch(`/api/session/${sessionId}`, {
            method: 'DELETE'
        });
        console.log('✅ تم إنهاء الجلسة بنجاح');
    } catch (error) {
        console.error('خطأ في إنهاء الجلسة:', error);
    }
}

// حفظ إعداد مستخدم
async function saveSetting(key, value, type = 'string') {
    if (!currentUser) return;
    
    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                setting_key: key,
                setting_value: value,
                setting_type: type
            })
        });
    } catch (error) {
        console.error('خطأ في حفظ الإعداد:', error);
    }
}

// تحميل إعداد مستخدم
async function loadSetting(key, defaultValue = null) {
    if (!currentUser) return defaultValue;
    
    try {
        const response = await fetch(`/api/settings/${currentUser.id}/${key}`);
        const data = await response.json();
        
        if (data.success) {
            return data.setting.value;
        }
    } catch (error) {
        console.error('خطأ في تحميل الإعداد:', error);
    }
    
    return defaultValue;
}

// تحميل جميع إعدادات المستخدم
async function loadAllSettings() {
    if (!currentUser) return {};
    
    try {
        const response = await fetch(`/api/settings/${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            const settings = {};
            Object.keys(data.settings).forEach(key => {
                settings[key] = data.settings[key].value;
            });
            return settings;
        }
    } catch (error) {
        console.error('خطأ في تحميل الإعدادات:', error);
    }
    
    return {};
}

// تنظيف الجلسات منتهية الصلاحية (للمدير)
async function cleanupSessions() {
    if (!currentUser || !currentUser.is_admin) return;
    
    try {
        const response = await fetch('/api/cleanup-sessions', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ تم تنظيف الجلسات:', data.message);
        }
    } catch (error) {
        console.error('خطأ في تنظيف الجلسات:', error);
    }
}

// تحديث الجلسة بشكل دوري
setInterval(async () => {
    if (currentSession && currentUser) {
        try {
            await fetch(`/api/session/${currentSession.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_data: {
                        last_activity: new Date().toISOString(),
                        page: window.location.pathname
                    }
                })
            });
        } catch (error) {
            console.debug('خطأ في تحديث الجلسة:', error);
        }
    }
}, 300000); // كل 5 دقائق

// إعادة تحميل الإحصائيات كل 30 ثانية
setInterval(loadStats, 30000);

console.log('✅ تم تحميل النظام بنجاح - Node.js + Express + SQLite with Sessions'); 