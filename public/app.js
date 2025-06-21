// متغيرات عامة
let currentUser = null;
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
    
    // فحص المستخدم المحفوظ
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateUI();
        } catch (e) {
            localStorage.removeItem('currentUser');
        }
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
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
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
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
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
        console.error('خطأ في تشغيل الكاميرا:', error);
        showAlert('خطأ في الوصول للكاميرا. تأكد من منح الإذن.', 'error');
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

// إعادة تحميل الإحصائيات كل 30 ثانية
setInterval(loadStats, 30000);

console.log('✅ تم تحميل النظام بنجاح - Node.js + Express + SQLite'); 