// Global Variables
let currentUser = null;
let isOwner = false;
let isScanning = false;
let stream = null;
let flashEnabled = false;
let lastScannedCode = null;
let lastScannedTime = 0;
let scannedResults = [];
let registeredUsers = [];
let recentScans = []; // For 20-second duplicate detection
let highlightOverlay = null; // For barcode highlighting
let isProcessingCode = false; // Prevent simultaneous code processing
let pauseTimeout = null; // For managing pause timeout

// Owner Settings
const OWNER_PASSWORD = "owner123";

// Default Telegram Settings (يمكن تخصيصها من خلال إعدادات المستخدم)
const DEFAULT_TELEGRAM_SETTINGS = {
    botToken: "7668051564:AAFdFqSd0CKrlSOyPKyFwf-xHi791lcsC_U",
    chatId: "-1002439956600",
    autoSend: true
}; // يمكن تغييرها لاحقاً

// DOM Elements
const loginSection = document.getElementById('loginSection');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const rememberMeCheckbox = document.getElementById('rememberMe');
const loginBtn = document.getElementById('loginBtn');
const ownerLoginBtn = document.getElementById('ownerLoginBtn');
const showOwnerLogin = document.getElementById('showOwnerLogin');
const logoutBtn = document.getElementById('logoutBtn');

const loginRequired = document.getElementById('loginRequired');
const scannerSection = document.getElementById('scannerSection');
const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const flashToggleBtn = document.getElementById('flashToggleBtn');
const settingsBtn = document.getElementById('settingsBtn');
const usersBtn = document.getElementById('usersBtn');

const cameraContainer = document.getElementById('cameraContainer');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const resultsList = document.getElementById('resultsList');

const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const botToken = document.getElementById('botToken');
const chatId = document.getElementById('chatId');
const autoSend = document.getElementById('autoSend');
const saveSettings = document.getElementById('saveSettings');
const testConnection = document.getElementById('testConnection');

const usersModal = document.getElementById('usersModal');
const closeUsers = document.getElementById('closeUsers');
const newUsername = document.getElementById('newUsername');
const addUser = document.getElementById('addUser');
const usersList = document.getElementById('usersList');
const exportUsers = document.getElementById('exportUsers');
const importUsers = document.getElementById('importUsers');
const importFile = document.getElementById('importFile');

const showStatsBtn = document.getElementById('showStatsBtn');
const showDuplicatesBtn = document.getElementById('showDuplicatesBtn');
const detailedStatsBtn = document.getElementById('detailedStatsBtn');

const statsModal = document.getElementById('statsModal');
const closeStats = document.getElementById('closeStats');
const duplicatesModal = document.getElementById('duplicatesModal');
const closeDuplicates = document.getElementById('closeDuplicates');
const exportDuplicates = document.getElementById('exportDuplicates');

const detailedStatsModal = document.getElementById('detailedStatsModal');
const closeDetailedStats = document.getElementById('closeDetailedStats');
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');
const userFilter = document.getElementById('userFilter');
const applyFilters = document.getElementById('applyFilters');
const resetFilters = document.getElementById('resetFilters');
const exportFilteredData = document.getElementById('exportFilteredData');
const exportFilteredReport = document.getElementById('exportFilteredReport');

const loadingOverlay = document.getElementById('loadingOverlay');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});
loginBtn.addEventListener('click', handleLogin);
ownerLoginBtn.addEventListener('click', handleOwnerLogin);
showOwnerLogin.addEventListener('click', toggleOwnerLogin);
logoutBtn.addEventListener('click', handleLogout);
startScanBtn.addEventListener('click', startScanning);
stopScanBtn.addEventListener('click', stopScanning);
flashToggleBtn.addEventListener('click', toggleFlash);
settingsBtn.addEventListener('click', openSettings);
usersBtn.addEventListener('click', openUsersModal);
closeSettings.addEventListener('click', closeSettingsModal);
closeUsers.addEventListener('click', closeUsersModal);
saveSettings.addEventListener('click', saveSettingsData);
testConnection.addEventListener('click', testTelegramConnection);
addUser.addEventListener('click', handleAddUser);
exportUsers.addEventListener('click', handleExportUsers);
importUsers.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', handleImportUsers);
showStatsBtn.addEventListener('click', openStatsModal);
showDuplicatesBtn.addEventListener('click', openDuplicatesModal);
detailedStatsBtn.addEventListener('click', openDetailedStatsModal);
closeStats.addEventListener('click', closeStatsModal);
closeDuplicates.addEventListener('click', closeDuplicatesModal);
closeDetailedStats.addEventListener('click', closeDetailedStatsModal);
exportDuplicates.addEventListener('click', handleExportDuplicates);
applyFilters.addEventListener('click', applyDateFilters);
resetFilters.addEventListener('click', resetDateFilters);
exportFilteredData.addEventListener('click', exportFilteredDataToJSON);
exportFilteredReport.addEventListener('click', exportDetailedReport);

// Enter key for login
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (passwordInput.style.display === 'none') {
            handleLogin();
        } else {
            passwordInput.focus();
        }
    }
});

passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleOwnerLogin();
    }
});

newUsername.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleAddUser();
    }
});

// Remember me checkbox change event
rememberMeCheckbox.addEventListener('change', function() {
    if (this.checked) {
        showAlert('سيتم حفظ تسجيل الدخول لمدة 30 يوماً', 'info');
    }
});

// Initialize App
async function initApp() {
    console.log('Initializing Barcode Scanner App...');
    
    // Check if all required libraries are loaded
    checkLibrariesStatus();
    
    await loadUserSession();
    await loadRegisteredUsers();
    loadSettings();
    updateUI();
    await loadResults();
    
    console.log('App initialization complete');
}

// Check libraries status
function checkLibrariesStatus() {
    const quaggaLoaded = typeof Quagga !== 'undefined';
    const jsQRLoaded = typeof jsQR !== 'undefined';
    
    console.log('=== Library Status Check ===');
    console.log('Quagga (Traditional Barcodes):', quaggaLoaded ? '✅ Loaded' : '❌ Not Loaded');
    console.log('jsQR (QR Codes):', jsQRLoaded ? '✅ Loaded' : '❌ Not Loaded');
    
    if (!quaggaLoaded && !jsQRLoaded) {
        console.error('❌ CRITICAL: No scanning libraries loaded!');
        showAlert('خطأ حرج: لم يتم تحميل مكتبات المسح. يرجى إعادة تحميل الصفحة.', 'error');
    } else if (!quaggaLoaded) {
        console.warn('⚠️ WARNING: Quagga not loaded - only QR codes will work');
    } else if (!jsQRLoaded) {
        console.warn('⚠️ WARNING: jsQR not loaded - only traditional barcodes will work');
    } else {
        console.log('✅ All libraries loaded successfully');
    }
    
    console.log('===============================');
}

// User Management
function handleLogin() {
    const username = usernameInput.value.trim();
    
    if (!username) {
        showAlert('يرجى إدخال اسم المستخدم', 'error');
        return;
    }
    
    // Check if user exists in registered users
    const userExists = registeredUsers.find(user => user.username === username);
    if (!userExists) {
        showAlert('المستخدم غير مسجل. يرجى التواصل مع الأونر لإنشاء حساب.', 'error');
        return;
    }
    
    currentUser = {
        username: username,
        loginTime: new Date().toISOString()
    };
    
    isOwner = false;
    const rememberUser = rememberMeCheckbox.checked;
    saveUserSession(rememberUser);
    updateUI();
    showAlert(`مرحباً ${username}!`, 'success');
}

function handleOwnerLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        showAlert('يرجى إدخال اسم المستخدم وكلمة المرور', 'error');
        return;
    }
    
    if (password !== OWNER_PASSWORD) {
        showAlert('كلمة مرور خاطئة', 'error');
        passwordInput.value = '';
        return;
    }
    
    currentUser = {
        username: username,
        loginTime: new Date().toISOString(),
        isOwner: true
    };
    
    isOwner = true;
    const rememberUser = rememberMeCheckbox.checked;
    saveUserSession(rememberUser);
    updateUI();
    showAlert(`مرحباً ${username} (الأونر)!`, 'success');
}

function toggleOwnerLogin() {
    const isOwnerMode = passwordInput.style.display !== 'none';
    
    if (isOwnerMode) {
        // Switch to regular login
        passwordInput.style.display = 'none';
        ownerLoginBtn.style.display = 'none';
        loginBtn.style.display = 'inline-flex';
        showOwnerLogin.innerHTML = '<i class="fas fa-user-cog"></i> أونر';
        usernameInput.placeholder = 'اسم المستخدم';
        passwordInput.value = '';
    } else {
        // Switch to owner login
        passwordInput.style.display = 'block';
        ownerLoginBtn.style.display = 'inline-flex';
        loginBtn.style.display = 'none';
        showOwnerLogin.innerHTML = '<i class="fas fa-user"></i> مستخدم';
        usernameInput.placeholder = 'اسم الأونر';
    }
}

function handleLogout() {
    stopScanning();
    currentUser = null;
    isOwner = false;
    clearUserSession();
    resetLoginForm();
    updateUI();
    showAlert('تم تسجيل الخروج بنجاح', 'info');
}

function resetLoginForm() {
    usernameInput.value = '';
    passwordInput.value = '';
    rememberMeCheckbox.checked = false;
    passwordInput.style.display = 'none';
    ownerLoginBtn.style.display = 'none';
    loginBtn.style.display = 'inline-flex';
    showOwnerLogin.innerHTML = '<i class="fas fa-user-cog"></i> أونر';
    usernameInput.placeholder = 'اسم المستخدم';
}

async function saveUserSession(rememberUser = false) {
    if (!currentUser) return;
    
    const expiresIn = rememberUser ? (30 * 24 * 60 * 60) : (24 * 60 * 60); // 30 days or 24 hours
    
    try {
        await createSession(currentUser, expiresIn);
        
        // Save user preferences
        await saveSetting('remember_me', rememberUser.toString(), 'boolean');
        await saveSetting('login_time', new Date().toISOString(), 'datetime');
        
        if (rememberUser) {
            await saveSetting('saved_username', currentUser.username, 'string');
            await saveSetting('user_type', currentUser.isOwner ? 'owner' : 'user', 'string');
        }
    } catch (error) {
        console.error('Error saving user session:', error);
    }
}

async function loadUserSession() {
    const sessionId = getCookie('session_id');
    if (!sessionId) return;
    
    try {
        const sessionData = await loadSession(sessionId);
        if (sessionData && sessionData.success) {
            currentUser = sessionData.session.user;
            isOwner = currentUser.isOwner || false;
            
            // Load user settings
            const settings = await loadAllSettings();
            
            // Pre-fill form based on saved settings
            const savedUsername = settings.saved_username;
            const userType = settings.user_type;
            const rememberMe = settings.remember_me === 'true';
            
            if (savedUsername) {
                usernameInput.value = savedUsername;
                
                // Show appropriate login form
                if (userType === 'owner') {
                    toggleOwnerLogin();
                }
                
                if (rememberMe) {
                    rememberMeCheckbox.checked = true;
                }
            }
        } else {
            // Session invalid or expired
            clearUserSession();
        }
    } catch (error) {
        console.error('Error loading user session:', error);
        clearUserSession();
    }
}

async function clearUserSession() {
    const sessionId = getCookie('session_id');
    if (sessionId) {
        await endSession(sessionId);
    }
    
    deleteCookie('session_id');
    currentUser = null;
    isOwner = false;
    
    // Clear login form
    usernameInput.value = '';
    passwordInput.value = '';
    rememberMeCheckbox.checked = false;
    resetLoginForm();
}

// Registered Users Management
async function loadRegisteredUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (data.success) {
            registeredUsers = data.users.map(user => ({
                username: user.username,
                createdAt: user.created_at,
                createdBy: user.created_by
            }));
        } else {
            registeredUsers = [];
        }
    } catch (error) {
        console.error('Error loading registered users:', error);
        registeredUsers = [];
    }
}

async function saveRegisteredUsers() {
    // This function is now handled by individual API calls
    // for adding/removing users, so it's kept for compatibility
}

function openUsersModal() {
    if (!isOwner) {
        showAlert('هذه الميزة متاحة للأونر فقط', 'error');
        return;
    }
    loadUsersToModal();
    usersModal.style.display = 'block';
}

function closeUsersModal() {
    usersModal.style.display = 'none';
    newUsername.value = '';
}

function loadUsersToModal() {
    usersList.innerHTML = '';
    
    if (registeredUsers.length === 0) {
        usersList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">لا يوجد مستخدمين مسجلين</p>';
        return;
    }
    
    registeredUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <div class="user-info">
                <div class="user-name">${user.username}</div>
                <div class="user-date">تاريخ التسجيل: ${formatDateTime(user.createdAt)}</div>
            </div>
            <div class="user-actions">
                <button class="btn btn-danger" onclick="deleteUser('${user.username}')">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </div>
        `;
        usersList.appendChild(userItem);
    });
}

async function handleAddUser() {
    if (!isOwner) {
        showAlert('هذه الميزة متاحة للأونر فقط', 'error');
        return;
    }
    
    const username = newUsername.value.trim();
    
    if (!username) {
        showAlert('يرجى إدخال اسم المستخدم', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                full_name: username,
                created_by: currentUser.username
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadRegisteredUsers(); // Reload users list
            loadUsersToModal();
            newUsername.value = '';
            showAlert(`تم إضافة المستخدم "${username}" بنجاح`, 'success');
        } else {
            showAlert(data.message || 'خطأ في إضافة المستخدم', 'error');
        }
    } catch (error) {
        console.error('Error adding user:', error);
        showAlert('خطأ في الاتصال بالخادم', 'error');
    }
}

function deleteUser(username) {
    if (!isOwner) {
        showAlert('هذه الميزة متاحة للأونر فقط', 'error');
        return;
    }
    
    if (confirm(`هل أنت متأكد من حذف المستخدم "${username}"؟`)) {
        registeredUsers = registeredUsers.filter(user => user.username !== username);
        saveRegisteredUsers();
        loadUsersToModal();
        showAlert(`تم حذف المستخدم "${username}" بنجاح`, 'success');
    }
}

function handleExportUsers() {
    if (!isOwner) {
        showAlert('هذه الميزة متاحة للأونر فقط', 'error');
        return;
    }
    
    const dataStr = JSON.stringify(registeredUsers, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `users_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showAlert('تم تصدير المستخدمين بنجاح', 'success');
}

function handleImportUsers(event) {
    if (!isOwner) {
        showAlert('هذه الميزة متاحة للأونر فقط', 'error');
        return;
    }
    
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedUsers = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedUsers)) {
                throw new Error('Invalid format');
            }
            
            // Validate imported users
            const validUsers = importedUsers.filter(user => 
                user.username && 
                typeof user.username === 'string' && 
                user.username.trim().length > 0
            );
            
            if (validUsers.length === 0) {
                showAlert('لا يوجد مستخدمين صالحين في الملف', 'error');
                return;
            }
            
            // Merge with existing users (avoid duplicates)
            let addedCount = 0;
            validUsers.forEach(importedUser => {
                const exists = registeredUsers.find(user => user.username === importedUser.username);
                if (!exists) {
                    registeredUsers.push({
                        username: importedUser.username.trim(),
                        createdAt: importedUser.createdAt || new Date().toISOString(),
                        createdBy: importedUser.createdBy || currentUser.username
                    });
                    addedCount++;
                }
            });
            
            saveRegisteredUsers();
            loadUsersToModal();
            
            showAlert(`تم استيراد ${addedCount} مستخدم جديد`, 'success');
            
        } catch (error) {
            console.error('Import error:', error);
            showAlert('خطأ في تنسيق الملف', 'error');
        }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Clear file input
}

// Statistics and Analytics
function openStatsModal() {
    calculateStatistics();
    statsModal.style.display = 'block';
}

function closeStatsModal() {
    statsModal.style.display = 'none';
}

function calculateStatistics() {
    const totalScans = scannedResults.length;
    const uniqueCodes = [...new Set(scannedResults.map(r => r.code))].length;
    const duplicateCodes = totalScans - uniqueCodes;
    const activeUsers = [...new Set(scannedResults.map(r => r.user))].length;
    
    // Update stat cards
    document.getElementById('totalScans').textContent = totalScans;
    document.getElementById('uniqueCodes').textContent = uniqueCodes;
    document.getElementById('duplicateCodes').textContent = duplicateCodes;
    document.getElementById('activeUsers').textContent = activeUsers;
    
    // Calculate user statistics
    const userStats = {};
    scannedResults.forEach(result => {
        userStats[result.user] = (userStats[result.user] || 0) + 1;
    });
    
    const userStatsContainer = document.getElementById('userStats');
    userStatsContainer.innerHTML = '';
    
    if (Object.keys(userStats).length === 0) {
        userStatsContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">لا توجد إحصائيات متاحة</p>';
    } else {
        const sortedUsers = Object.entries(userStats).sort((a, b) => b[1] - a[1]);
        
        sortedUsers.forEach(([user, count]) => {
            const userStatItem = document.createElement('div');
            userStatItem.className = 'user-stat-item';
            userStatItem.innerHTML = `
                <div class="user-stat-name">${user}</div>
                <div class="user-stat-count">${count}</div>
            `;
            userStatsContainer.appendChild(userStatItem);
        });
    }
    
    // Calculate top codes
    const codeStats = {};
    scannedResults.forEach(result => {
        codeStats[result.code] = (codeStats[result.code] || 0) + 1;
    });
    
    const topCodesContainer = document.getElementById('topCodes');
    topCodesContainer.innerHTML = '';
    
    const sortedCodes = Object.entries(codeStats)
        .filter(([code, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sortedCodes.length === 0) {
        topCodesContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">لا توجد أكواد مكررة</p>';
    } else {
        sortedCodes.forEach(([code, count]) => {
            const topCodeItem = document.createElement('div');
            topCodeItem.className = 'top-code-item';
            topCodeItem.innerHTML = `
                <div class="top-code-text">${code}</div>
                <div class="top-code-count">${count}</div>
            `;
            topCodesContainer.appendChild(topCodeItem);
        });
    }
}

function openDuplicatesModal() {
    loadDuplicates();
    duplicatesModal.style.display = 'block';
}

function closeDuplicatesModal() {
    duplicatesModal.style.display = 'none';
}

function loadDuplicates() {
    const duplicatesContainer = document.getElementById('duplicatesList');
    duplicatesContainer.innerHTML = '';
    
    // Group results by code
    const codeGroups = {};
    scannedResults.forEach(result => {
        if (!codeGroups[result.code]) {
            codeGroups[result.code] = [];
        }
        codeGroups[result.code].push(result);
    });
    
    // Filter only duplicates (count > 1)
    const duplicateGroups = Object.entries(codeGroups)
        .filter(([code, instances]) => instances.length > 1)
        .sort((a, b) => b[1].length - a[1].length);
    
    if (duplicateGroups.length === 0) {
        duplicatesContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">لا توجد أكواد مكررة</p>';
        return;
    }
    
    duplicateGroups.forEach(([code, instances]) => {
        const duplicateGroup = document.createElement('div');
        duplicateGroup.className = 'duplicate-group';
        
        const sortedInstances = instances.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        duplicateGroup.innerHTML = `
            <div class="duplicate-header">
                <div class="duplicate-code">${code}</div>
                <div class="duplicate-count">×${instances.length}</div>
            </div>
            <div class="duplicate-instances">
                ${sortedInstances.map(instance => `
                    <div class="duplicate-instance">
                        <div class="instance-info">
                            <div class="instance-user">${instance.user}</div>
                            <div class="instance-time">${formatDateTime(instance.timestamp)}</div>
                        </div>
                        <div class="instance-actions">
                            <button class="btn btn-info" onclick="viewImage('${instance.id}')">
                                <i class="fas fa-eye"></i> عرض
                            </button>
                            <button class="btn btn-primary" onclick="sendSingleToTelegram('${instance.id}')">
                                <i class="fab fa-telegram"></i> إرسال
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        duplicatesContainer.appendChild(duplicateGroup);
    });
}

function showDuplicatesForCode(code) {
    showDuplicateImagesModal(code);
}

// New function to show duplicate images in a beautiful modal
function showDuplicateImagesModal(code) {
    const duplicates = scannedResults.filter(r => r.code === code);
    
    if (duplicates.length <= 1) {
        showAlert('هذا الكود غير مكرر', 'info');
        return;
    }
    
    // Sort duplicates by timestamp (newest first)
    duplicates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    let duplicatesHtml = `
        <div class="duplicate-images-header">
            <h4>${duplicates[0].codeType && duplicates[0].codeType.includes('QR') ? '📱' : '🔢'} صور المكررات للكود</h4>
            <div class="duplicate-code-display">${code}</div>
            <p class="duplicate-count">عدد المرات: <span class="count-badge">${duplicates.length}</span></p>
        </div>
        <div class="duplicates-images-grid">
    `;
    
    duplicates.forEach((result, index) => {
        const codeIcon = result.codeType && result.codeType.includes('QR') ? '📱' : '🔢';
        const statusClass = result.telegramStatus || 'pending';
        
        duplicatesHtml += `
            <div class="duplicate-image-item telegram-${statusClass}">
                <div class="duplicate-image-header">
                    <span class="duplicate-number">${codeIcon} #${index + 1}</span>
                    <span class="duplicate-type ${result.codeType && result.codeType.includes('QR') ? 'qr-badge' : 'barcode-badge'}">${result.codeType || 'كود'}</span>
                </div>
                <div class="duplicate-image-container" onclick="viewFullImageModal('${result.id}')">
                    <img src="${result.image}" alt="صورة الكود ${index + 1}" class="duplicate-thumbnail">
                    <div class="image-overlay">
                        <i class="fas fa-expand-alt"></i>
                        <span>عرض كامل</span>
                    </div>
                </div>
                <div class="duplicate-image-info">
                    <div class="duplicate-user">
                        <i class="fas fa-user"></i> ${result.user}
                    </div>
                    <div class="duplicate-time">
                        <i class="fas fa-clock"></i> ${formatDateTime(result.timestamp)}
                    </div>
                    <div class="duplicate-status">
                        ${getTelegramStatusIndicator(result.telegramStatus, result.telegramAttempts)}
                    </div>
                </div>
                <div class="duplicate-actions">
                    <button class="btn btn-primary btn-sm" onclick="viewFullImageModal('${result.id}')">
                        <i class="fas fa-expand"></i> عرض كامل
                    </button>
                    <button class="btn btn-success btn-sm" onclick="sendSingleToTelegram('${result.id}')">
                        <i class="fab fa-telegram"></i> إرسال
                    </button>
                    <button class="btn btn-info btn-sm" onclick="copyCode('${result.code}')">
                        <i class="fas fa-copy"></i> نسخ
                    </button>
                </div>
            </div>
        `;
    });
    
    duplicatesHtml += `
        </div>
        <div class="duplicate-images-footer">
            <button class="btn btn-warning" onclick="retryAllDuplicates('${code}')">
                <i class="fas fa-redo"></i> إعادة إرسال الكل
            </button>
            <button class="btn btn-info" onclick="exportDuplicateImages('${code}')">
                <i class="fas fa-download"></i> تصدير البيانات
            </button>
        </div>
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal duplicate-images-modal';
    modal.innerHTML = `
        <div class="modal-content modal-content-wide">
            <div class="modal-header">
                <h3><i class="fas fa-images"></i> معرض الصور المكررة</h3>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                ${duplicatesHtml}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    });
}

// Function to view full size image in modal
function viewFullImageModal(resultId) {
    const result = scannedResults.find(r => r.id === resultId);
    if (!result) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal image-viewer-modal';
    modal.style.zIndex = '10001'; // Higher than duplicate modal
    
    modal.innerHTML = `
        <div class="modal-content image-viewer-content">
            <div class="modal-header">
                <h3>${result.codeType && result.codeType.includes('QR') ? '📱' : '🔢'} ${result.code}</h3>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body image-viewer-body">
                <div class="full-image-container">
                    <img src="${result.image}" alt="صورة الكود" class="full-size-image">
                </div>
                <div class="image-details">
                    <div class="detail-row">
                        <label>الكود:</label>
                        <span class="code-value">${result.code}</span>
                        <button class="btn btn-sm btn-secondary" onclick="copyCode('${result.code}')">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <div class="detail-row">
                        <label>النوع:</label>
                        <span class="badge ${result.codeType && result.codeType.includes('QR') ? 'qr-badge' : 'barcode-badge'}">${result.codeType || 'غير محدد'}</span>
                    </div>
                    <div class="detail-row">
                        <label>المستخدم:</label>
                        <span><i class="fas fa-user"></i> ${result.user}</span>
                    </div>
                    <div class="detail-row">
                        <label>التاريخ:</label>
                        <span><i class="fas fa-calendar"></i> ${formatDateTime(result.timestamp)}</span>
                    </div>
                    <div class="detail-row">
                        <label>التليجرام:</label>
                        ${getTelegramStatusIndicator(result.telegramStatus, result.telegramAttempts)}
                    </div>
                </div>
                <div class="image-actions">
                    <button class="btn btn-primary" onclick="sendSingleToTelegram('${result.id}')">
                        <i class="fab fa-telegram"></i> إرسال للتليجرام
                    </button>
                    <button class="btn btn-info" onclick="downloadImage('${result.id}')">
                        <i class="fas fa-download"></i> تحميل الصورة
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Close handlers
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    });
}

// Helper functions for duplicate operations
function retryAllDuplicates(code) {
    const duplicates = scannedResults.filter(r => r.code === code && r.telegramStatus !== 'success');
    
    if (duplicates.length === 0) {
        showAlert('جميع نسخ هذا الكود تم إرسالها بنجاح', 'info');
        return;
    }
    
    showAlert(`جاري إعادة إرسال ${duplicates.length} صورة...`, 'info');
    
    duplicates.forEach((result, index) => {
        setTimeout(() => {
            result.telegramAttempts = 0; // Reset attempts
            sendToTelegram(result, true);
        }, index * 1000); // 1 second delay between each
    });
}

function exportDuplicateImages(code) {
    const duplicates = scannedResults.filter(r => r.code === code);
    
    const exportData = {
        code: code,
        codeType: duplicates[0]?.codeType || 'غير محدد',
        duplicateCount: duplicates.length,
        scans: duplicates.map((result, index) => ({
            scanNumber: index + 1,
            user: result.user,
            timestamp: result.timestamp,
            timestampBaghdad: formatDateTimeBaghdad(result.timestamp),
            telegramStatus: result.telegramStatus,
            telegramAttempts: result.telegramAttempts || 0,
            id: result.id
        }))
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `duplicate_${code}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showAlert('تم تصدير بيانات المكررات بنجاح', 'success');
}

function downloadImage(resultId) {
    const result = scannedResults.find(r => r.id === resultId);
    if (!result) return;
    
    // Convert base64 to blob and download
    const link = document.createElement('a');
    link.href = result.image;
    link.download = `barcode_${result.code}_${result.user}_${formatDateOnly(result.timestamp)}.jpg`;
    link.click();
    
    showAlert('تم تحميل الصورة', 'success');
}

function handleExportDuplicates() {
    // Group results by code and filter duplicates
    const codeGroups = {};
    scannedResults.forEach(result => {
        if (!codeGroups[result.code]) {
            codeGroups[result.code] = [];
        }
        codeGroups[result.code].push(result);
    });
    
    const duplicates = {};
    Object.entries(codeGroups).forEach(([code, instances]) => {
        if (instances.length > 1) {
            duplicates[code] = instances.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
    });
    
    if (Object.keys(duplicates).length === 0) {
        showAlert('لا توجد أكواد مكررة للتصدير', 'info');
        return;
    }
    
    const dataStr = JSON.stringify(duplicates, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `duplicates_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showAlert('تم تصدير الأكواد المكررة بنجاح', 'success');
}

// Detailed Statistics Functions
function openDetailedStatsModal() {
    if (!isOwner) {
        showAlert('الإحصائيات الشاملة متاحة للأونر فقط', 'error');
        return;
    }
    
    initializeDetailedStats();
    detailedStatsModal.style.display = 'block';
}

function closeDetailedStatsModal() {
    detailedStatsModal.style.display = 'none';
}

function initializeDetailedStats() {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    startDate.value = formatDateOnly(thirtyDaysAgo.toISOString());
    endDate.value = formatDateOnly(today.toISOString());
    
    // Populate user filter
    populateUserFilter();
    
    // Apply initial filters
    applyDateFilters();
}

function populateUserFilter() {
    const users = [...new Set(scannedResults.map(r => r.user))].sort();
    
    userFilter.innerHTML = '<option value="">جميع المستخدمين</option>';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        userFilter.appendChild(option);
    });
}

function applyDateFilters() {
    const filteredData = getFilteredData();
    
    // Update summary cards
    updateSummaryCards(filteredData);
    
    // Update detailed table
    updateDetailedTable(filteredData);
    
    // Update charts
    updateUserActivityChart(filteredData);
    updateHourlyActivityChart(filteredData);
}

function getFilteredData() {
    let filtered = [...scannedResults];
    
    // Date filter
    if (startDate.value) {
        const startDateTime = new Date(startDate.value + 'T00:00:00');
        filtered = filtered.filter(item => {
            const itemDate = new Date(item.timestamp);
            return itemDate >= startDateTime;
        });
    }
    
    if (endDate.value) {
        const endDateTime = new Date(endDate.value + 'T23:59:59');
        filtered = filtered.filter(item => {
            const itemDate = new Date(item.timestamp);
            return itemDate <= endDateTime;
        });
    }
    
    // User filter
    if (userFilter.value) {
        filtered = filtered.filter(item => item.user === userFilter.value);
    }
    
    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function updateSummaryCards(data) {
    const totalScans = data.length;
    const uniqueCodes = [...new Set(data.map(r => r.code))].length;
    const duplicates = totalScans - uniqueCodes;
    const activeUsers = [...new Set(data.map(r => r.user))].length;
    
    document.getElementById('filteredTotalScans').textContent = totalScans;
    document.getElementById('filteredUniqueCodes').textContent = uniqueCodes;
    document.getElementById('filteredDuplicates').textContent = duplicates;
    document.getElementById('filteredActiveUsers').textContent = activeUsers;
}

function updateDetailedTable(data) {
    const tableBody = document.getElementById('detailedTableBody');
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #666;">لا توجد نتائج للفترة المحددة</td></tr>';
        return;
    }
    
    // Check for duplicates in filtered data
    const codeCounts = {};
    data.forEach(item => {
        codeCounts[item.code] = (codeCounts[item.code] || 0) + 1;
    });
    
    data.forEach((item, index) => {
        const row = document.createElement('tr');
        const isDuplicate = codeCounts[item.code] > 1;
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="barcode-cell">${item.code}</td>
            <td class="user-cell">${item.user}</td>
            <td class="datetime-cell">
                ${formatDateOnly(item.timestamp)}<br>
                ${formatTimeOnly(item.timestamp)}
            </td>
            <td class="status-cell ${isDuplicate ? 'status-duplicate' : 'status-unique'}">
                ${isDuplicate ? `مكرر (×${codeCounts[item.code]})` : 'فريد'}
            </td>
            <td class="actions-cell">
                <button class="btn btn-info" onclick="viewImage('${item.id}')">
                    <i class="fas fa-eye"></i> عرض
                </button>
                <button class="btn btn-primary" onclick="sendSingleToTelegram('${item.id}')">
                    <i class="fab fa-telegram"></i> إرسال
                </button>
                <button class="btn btn-secondary" onclick="copyCode('${item.code}')">
                    <i class="fas fa-copy"></i> نسخ
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function updateUserActivityChart(data) {
    const container = document.getElementById('userActivityChart');
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center;">لا توجد بيانات لعرضها</p>';
        return;
    }
    
    // Calculate user activity
    const userActivity = {};
    data.forEach(item => {
        userActivity[item.user] = (userActivity[item.user] || 0) + 1;
    });
    
    const sortedUsers = Object.entries(userActivity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10 users
    
    const chartPie = document.createElement('div');
    chartPie.className = 'chart-pie';
    
    const colors = [
        '#667eea', '#764ba2', '#28a745', '#ffc107', 
        '#dc3545', '#17a2b8', '#6f42c1', '#e83e8c',
        '#fd7e14', '#20c997'
    ];
    
    sortedUsers.forEach(([user, count], index) => {
        const percentage = ((count / data.length) * 100).toFixed(1);
        const pieItem = document.createElement('div');
        pieItem.className = 'chart-pie-item';
        
        pieItem.innerHTML = `
            <div class="chart-pie-circle" style="background: ${colors[index % colors.length]}">
                ${count}
            </div>
            <div class="chart-pie-label">${user}</div>
            <div class="chart-pie-value">${percentage}%</div>
        `;
        
        chartPie.appendChild(pieItem);
    });
    
    container.appendChild(chartPie);
}

function updateHourlyActivityChart(data) {
    const container = document.getElementById('hourlyActivityChart');
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center;">لا توجد بيانات لعرضها</p>';
        return;
    }
    
    // Calculate hourly activity
    const hourlyActivity = {};
    for (let i = 0; i < 24; i++) {
        hourlyActivity[i] = 0;
    }
    
    data.forEach(item => {
        const date = new Date(item.timestamp);
        const hour = date.toLocaleString('en-US', {
            hour12: false,
            hour: 'numeric',
            timeZone: 'Asia/Baghdad'
        });
        const hourNum = parseInt(hour);
        hourlyActivity[hourNum]++;
    });
    
    const chartBar = document.createElement('div');
    chartBar.className = 'chart-bar';
    
    const maxCount = Math.max(...Object.values(hourlyActivity));
    
    for (let hour = 0; hour < 24; hour++) {
        const count = hourlyActivity[hour];
        const heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
        
        const barItem = document.createElement('div');
        barItem.className = 'chart-bar-item';
        
        barItem.innerHTML = `
            <div class="chart-bar-column" style="height: ${heightPercent}%">
                ${count > 0 ? `<div class="chart-bar-value">${count}</div>` : ''}
            </div>
            <div class="chart-bar-label">${hour}:00</div>
        `;
        
        chartBar.appendChild(barItem);
    }
    
    container.appendChild(chartBar);
}

function resetDateFilters() {
    startDate.value = '';
    endDate.value = '';
    userFilter.value = '';
    applyDateFilters();
}

function exportFilteredDataToJSON() {
    const filteredData = getFilteredData();
    
    if (filteredData.length === 0) {
        showAlert('لا توجد بيانات للتصدير', 'info');
        return;
    }
    
    const exportData = filteredData.map(item => ({
        الباركود: item.code,
        المستخدم: item.user,
        'التاريخ والوقت (بغداد)': formatDateTimeBaghdad(item.timestamp),
        التاريخ: formatDateOnly(item.timestamp),
        الوقت: formatTimeOnly(item.timestamp)
    }));
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `barcode_data_${formatDateOnly(new Date().toISOString())}.json`;
    link.click();
    
    showAlert('تم تصدير البيانات بنجاح', 'success');
}

function exportDetailedReport() {
    const filteredData = getFilteredData();
    
    if (filteredData.length === 0) {
        showAlert('لا توجد بيانات للتقرير', 'info');
        return;
    }
    
    // Calculate statistics
    const totalScans = filteredData.length;
    const uniqueCodes = [...new Set(filteredData.map(r => r.code))].length;
    const duplicates = totalScans - uniqueCodes;
    const activeUsers = [...new Set(filteredData.map(r => r.user))].length;
    
    // User activity
    const userActivity = {};
    filteredData.forEach(item => {
        userActivity[item.user] = (userActivity[item.user] || 0) + 1;
    });
    
    // Code frequency
    const codeFrequency = {};
    filteredData.forEach(item => {
        codeFrequency[item.code] = (codeFrequency[item.code] || 0) + 1;
    });
    
    // Hourly activity
    const hourlyActivity = {};
    for (let i = 0; i < 24; i++) {
        hourlyActivity[i] = 0;
    }
    filteredData.forEach(item => {
        const date = new Date(item.timestamp);
        const hour = parseInt(date.toLocaleString('en-US', {
            hour12: false,
            hour: 'numeric',
            timeZone: 'Asia/Baghdad'
        }));
        hourlyActivity[hour]++;
    });
    
    const report = {
        معلومات_التقرير: {
            تاريخ_التقرير: formatDateTimeBaghdad(new Date().toISOString()),
            فترة_البحث: {
                من: startDate.value || 'غير محدد',
                إلى: endDate.value || 'غير محدد'
            },
            المستخدم_المحدد: userFilter.value || 'جميع المستخدمين'
        },
        الملخص_الإحصائي: {
            إجمالي_المسحات: totalScans,
            الأكواد_الفريدة: uniqueCodes,
            الأكواد_المكررة: duplicates,
            المستخدمين_النشطين: activeUsers
        },
        إحصائيات_المستخدمين: userActivity,
        تكرار_الأكواد: Object.entries(codeFrequency)
            .filter(([code, count]) => count > 1)
            .reduce((acc, [code, count]) => {
                acc[code] = count;
                return acc;
            }, {}),
        النشاط_بالساعة: hourlyActivity,
        البيانات_التفصيلية: filteredData.map(item => ({
            الباركود: item.code,
            المستخدم: item.user,
            'التاريخ والوقت (بغداد)': formatDateTimeBaghdad(item.timestamp),
            التاريخ: formatDateOnly(item.timestamp),
            الوقت: formatTimeOnly(item.timestamp),
            المعرف: item.id
        }))
    };
    
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `detailed_report_${formatDateOnly(new Date().toISOString())}.json`;
    link.click();
    
    showAlert('تم تصدير التقرير المفصل بنجاح', 'success');
}

// Cleanup and maintenance functions
function retryAllFailedSends() {
    const failedResults = scannedResults.filter(result => 
        result.telegramStatus === 'failed' && 
        (result.telegramAttempts || 0) < 5
    );
    
    if (failedResults.length === 0) {
        showAlert('لا توجد مسحات فاشلة لإعادة إرسالها', 'info');
        return;
    }
    
    showAlert(`جاري إعادة إرسال ${failedResults.length} مسحة فاشلة...`, 'info');
    
    failedResults.forEach((result, index) => {
        // Reset attempts for manual retry
        result.telegramAttempts = 0;
        
        setTimeout(() => {
            sendToTelegram(result, true).catch(error => {
                console.error('Manual retry failed:', error);
            });
        }, index * 1500); // 1.5 second delay between each
    });
}

function getUnsentResultsCount() {
    return scannedResults.filter(result => 
        result.telegramStatus !== 'success'
    ).length;
}

// Add retry all button (can be called from console or triggered manually)
window.retryAllFailedSends = retryAllFailedSends;

// UI Updates
function updateUI() {
    if (currentUser) {
        loginSection.style.display = 'none';
        userInfo.style.display = 'flex';
        
        // Display username with owner badge if applicable
        if (isOwner) {
            userName.innerHTML = `<span class="owner-badge"><i class="fas fa-crown"></i> أونر</span>${currentUser.username}`;
            usersBtn.style.display = 'inline-flex';
            settingsBtn.style.display = 'inline-flex';
            detailedStatsBtn.style.display = 'inline-flex';
        } else {
            userName.textContent = currentUser.username;
            usersBtn.style.display = 'none';
            settingsBtn.style.display = 'none';
            detailedStatsBtn.style.display = 'none';
        }
        
        loginRequired.style.display = 'none';
        scannerSection.style.display = 'block';
        
        // Update scan buttons and flash visibility
        updateScanButtons();
    } else {
        loginSection.style.display = 'flex';
        userInfo.style.display = 'none';
        loginRequired.style.display = 'block';
        scannerSection.style.display = 'none';
        usersBtn.style.display = 'none';
        settingsBtn.style.display = 'none';
        detailedStatsBtn.style.display = 'none';
        flashToggleBtn.style.display = 'none';
    }
}

// Camera and Scanning Functions
async function startScanning() {
    if (!currentUser) {
        showAlert('يرجى تسجيل الدخول أولاً', 'error');
        return;
    }

    try {
        showLoading(true);
        console.log('Starting camera...');
        
        // Enhanced camera constraints with fallback
        const constraints = {
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                frameRate: { ideal: 30, min: 15 }
            }
        };

        // Request camera permission with fallback
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (primaryError) {
            console.warn('Primary camera constraints failed, trying fallback:', primaryError);
            // Fallback to basic constraints
            stream = await navigator.mediaDevices.getUserMedia({
                video: true
            });
        }

        video.srcObject = stream;
        cameraContainer.style.display = 'block';
        
        console.log('Camera stream acquired, waiting for video to load...');
        
        // Wait for video to load with timeout
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Video load timeout'));
            }, 10000); // 10 second timeout
            
            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                console.log(`Video loaded: ${video.videoWidth}x${video.videoHeight}`);
                resolve();
            };
            
            video.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Video load error'));
            };
        });

        // Wait a bit more for video to fully initialize
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('Initializing dual scanning system...');
        // Initialize dual scanning system
        await initializeDualScanning();
        
        isScanning = true;
        
        // Add active scanning visual feedback
        if (cameraContainer) {
            cameraContainer.classList.add('scanning-active');
        }
        
        updateScanButtons();
        showLoading(false);
        showAlert('تم بدء المسح المتطور (QR + باركود) ✓', 'success');

    } catch (error) {
        console.error('Camera/scanning initialization error:', error);
        showAlert('خطأ في بدء المسح. تأكد من منح إذن الكاميرا وإعادة المحاولة.', 'error');
        showLoading(false);
        
        // Cleanup on error
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraContainer.style.display = 'none';
    }
}

// Initialize dual scanning system (jsQR + QuaggaJS)
async function initializeDualScanning() {
    return new Promise((resolve, reject) => {
        // Check if required libraries are loaded
        const quaggaLoaded = typeof Quagga !== 'undefined';
        const jsQRLoaded = typeof jsQR !== 'undefined';
        
        console.log('Library status:', { quaggaLoaded, jsQRLoaded });
        
        if (!quaggaLoaded && !jsQRLoaded) {
            console.error('Neither Quagga nor jsQR libraries are loaded');
            showAlert('خطأ: لم يتم تحميل مكتبات المسح بشكل صحيح', 'error');
            reject(new Error('Libraries not loaded'));
            return;
        }
        
        // Initialize Quagga for traditional barcodes if available
        if (quaggaLoaded) {
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: video,
                    constraints: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: "environment"
                    }
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                },
                numOfWorkers: 2,
                frequency: 10,
                decoder: {
                    readers: [
                        "code_128_reader",
                        "ean_reader",
                        "ean_8_reader", 
                        "code_39_reader",
                        "code_39_vin_reader",
                        "codabar_reader",
                        "upc_reader",
                        "upc_e_reader",
                        "i2of5_reader",
                        "2of5_reader",
                        "code_93_reader"
                    ]
                },
                locate: true
            }, (err) => {
                if (err) {
                    console.error('Quagga initialization error:', err);
                    showAlert('خطأ في تهيئة قارئ الباركود التقليدي', 'warning');
                    // Continue with QR only if available
                    if (jsQRLoaded) {
                        startQRScanning();
                    }
                    resolve();
                    return;
                }
                
                console.log('Quagga initialized successfully');
                
                // Start Quagga for traditional barcodes
                Quagga.start();
                
                // Handle traditional barcode detection
                Quagga.onDetected((result) => {
                    if (result && result.codeResult && result.codeResult.code) {
                        console.log('Barcode detected:', result.codeResult.code);
                        
                        // Extract location information from QuaggaJS result
                        let location = null;
                        if (result.line && result.line.length >= 2) {
                            const x1 = Math.min(result.line[0].x, result.line[1].x);
                            const y1 = Math.min(result.line[0].y, result.line[1].y);
                            const x2 = Math.max(result.line[0].x, result.line[1].x);
                            const y2 = Math.max(result.line[0].y, result.line[1].y);
                            
                            location = {
                                x: Math.max(0, x1 - 20),
                                y: Math.max(0, y1 - 20),
                                width: (x2 - x1) + 40,
                                height: (y2 - y1) + 40
                            };
                        }
                        
                        handleCodeDetection(result.codeResult.code, 'باركود', location);
                    }
                });
                
                // Start QR Code scanning loop after a short delay if jsQR is available
                setTimeout(() => {
                    if (jsQRLoaded) {
                        startQRScanning();
                    } else {
                        console.warn('jsQR not available, only traditional barcodes will be scanned');
                        showAlert('تحذير: فقط الباركود التقليدي متاح للمسح', 'warning');
                    }
                    resolve();
                }, 500);
            });
        } else {
            // If Quagga is not available, try QR only
            console.warn('Quagga not available, trying QR only');
            if (jsQRLoaded) {
                startQRScanning();
                showAlert('تحذير: فقط QR كود متاح للمسح', 'warning');
            } else {
                showAlert('خطأ: لا يمكن بدء المسح - لم يتم تحميل أي مكتبة', 'error');
                reject(new Error('No scanning libraries available'));
                return;
            }
            resolve();
        }
    });
}

// QR Code scanning using jsQR
function startQRScanning() {
    console.log('Starting QR Code scanning...');
    
    // Check if jsQR is loaded
    if (typeof jsQR === 'undefined') {
        console.error('jsQR library not loaded');
        showAlert('مكتبة jsQR غير محملة بشكل صحيح', 'error');
        return;
    }
    
    const qrScanInterval = setInterval(() => {
        if (!isScanning) {
            clearInterval(qrScanInterval);
            console.log('QR scanning stopped');
            return;
        }
        
        // More robust video ready check
        if (video.readyState === video.HAVE_ENOUGH_DATA && 
            video.videoWidth > 0 && 
            video.videoHeight > 0 &&
            !video.paused && 
            !video.ended) {
            scanForQRCode();
        }
    }, 250); // Slightly slower interval for better performance
}

function scanForQRCode() {
    try {
        // Check if jsQR is available
        if (typeof jsQR === 'undefined') {
            console.warn('jsQR not available');
            return;
        }
        
        // Prevent simultaneous code processing
        if (isProcessingCode) {
            return;
        }
        
        // Use the main canvas instead of creating a new one
        const context = canvas.getContext('2d');
        
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        if (canvas.width === 0 || canvas.height === 0) {
            return; // Skip if video not ready
        }
        
        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get image data for jsQR with better error handling
        let imageData;
        try {
            imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
            console.debug('Failed to get image data:', e);
            return;
        }
        
        // Validate image data
        if (!imageData || !imageData.data || imageData.data.length === 0) {
            console.debug('Invalid image data');
            return;
        }
        
        // Scan for QR code with enhanced settings
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
            locateRegion: true
        });
        
        if (qrCode && qrCode.data && qrCode.data.trim().length > 0) {
            console.log('QR Code detected:', qrCode.data);
            
            // Extract location information from jsQR result
            let location = null;
            if (qrCode.location && qrCode.location.topLeftCorner) {
                try {
                    const corners = qrCode.location;
                    const x = Math.min(corners.topLeftCorner.x, corners.topRightCorner.x, corners.bottomLeftCorner.x, corners.bottomRightCorner.x);
                    const y = Math.min(corners.topLeftCorner.y, corners.topRightCorner.y, corners.bottomLeftCorner.y, corners.bottomRightCorner.y);
                    const maxX = Math.max(corners.topLeftCorner.x, corners.topRightCorner.x, corners.bottomLeftCorner.x, corners.bottomRightCorner.x);
                    const maxY = Math.max(corners.topLeftCorner.y, corners.topRightCorner.y, corners.bottomLeftCorner.y, corners.bottomRightCorner.y);
                    
                    location = {
                        x: Math.max(0, x - 10),
                        y: Math.max(0, y - 10),
                        width: (maxX - x) + 20,
                        height: (maxY - y) + 20
                    };
                } catch (locationError) {
                    console.debug('Error extracting QR location:', locationError);
                }
            }
            
            handleCodeDetection(qrCode.data.trim(), 'QR كود', location);
        }
    } catch (error) {
        // Better error logging for debugging
        console.debug('QR scan error:', error.message || error);
        // Only show user error if it's a critical issue
        if (error.message && error.message.includes('jsQR')) {
            showAlert('خطأ في مكتبة QR: ' + error.message, 'error');
        }
    }
}

function stopScanning() {
    if (isScanning) {
        // Stop Quagga
        if (typeof Quagga !== 'undefined') {
            Quagga.stop();
        }
        isScanning = false;
        
        // QR scanning will automatically stop when isScanning becomes false
    }
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Remove any highlights and clear recent scans
    removeHighlight();
    recentScans = [];
    
    // Remove all visual feedback classes
    if (cameraContainer) {
        cameraContainer.classList.remove('scanning-active', 'scanning-paused');
    }
    
    // Remove pause indicator if any
    removeScanPauseIndicator();
    
    cameraContainer.style.display = 'none';
    flashEnabled = false;
    updateScanButtons();
    showAlert('تم إيقاف المسح المتطور', 'info');
}

function updateScanButtons() {
    if (isScanning) {
        startScanBtn.style.display = 'none';
        stopScanBtn.style.display = 'inline-flex';
        flashToggleBtn.style.display = 'inline-flex';
    } else {
        startScanBtn.style.display = 'inline-flex';
        stopScanBtn.style.display = 'none';
        // Keep flash button visible for all logged in users
        flashToggleBtn.style.display = currentUser ? 'inline-flex' : 'none';
        flashEnabled = false;
        updateFlashButton();
    }
}

// Flash Control Functions
async function toggleFlash() {
    if (!stream) {
        showAlert('يجب بدء المسح أولاً', 'error');
        return;
    }

    try {
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        
        if (!capabilities.torch) {
            showAlert('هذا الجهاز لا يدعم الفلاش', 'error');
            return;
        }
        
        flashEnabled = !flashEnabled;
        await track.applyConstraints({
            advanced: [{ torch: flashEnabled }]
        });
        
        updateFlashButton();
        showAlert(flashEnabled ? 'تم تشغيل الفلاش' : 'تم إطفاء الفلاش', 'success');
        
    } catch (error) {
        console.error('Flash toggle error:', error);
        showAlert('خطأ في تشغيل الفلاش', 'error');
    }
}

function updateFlashButton() {
    if (flashEnabled) {
        flashToggleBtn.innerHTML = '<i class="fas fa-lightbulb"></i> إطفاء الفلاش';
        flashToggleBtn.className = 'btn btn-warning';
    } else {
        flashToggleBtn.innerHTML = '<i class="fas fa-lightbulb"></i> فلاش';
        flashToggleBtn.className = 'btn btn-secondary';
    }
}

// Recent Scans Management (30-second duplicate detection)
function findRecentDuplicate(code) {
    const now = Date.now();
    // Clean old scans first (older than 30 seconds)
    recentScans = recentScans.filter(scan => now - scan.timestamp < 30000);
    
    // Find duplicate within last 30 seconds
    return recentScans.find(scan => scan.code === code);
}

function addToRecentScans(code) {
    const now = Date.now();
    // Clean old scans first
    recentScans = recentScans.filter(scan => now - scan.timestamp < 30000);
    
    // Add current scan
    recentScans.push({
        code: code,
        timestamp: now,
        user: currentUser.username
    });
}

// Visual Code Highlighting
function highlightDetectedCode(location, isDuplicate = false, code = '', duplicateInfo = null) {
    // Remove existing highlight
    removeHighlight();
    
    if (!location) return;
    
    // Create highlight overlay
    highlightOverlay = document.createElement('div');
    highlightOverlay.className = 'code-highlight';
    
    // Position and style the highlight
    const rect = {
        x: location.x || video.videoWidth * 0.1,
        y: location.y || video.videoHeight * 0.1,
        width: location.width || video.videoWidth * 0.8,
        height: location.height || video.videoHeight * 0.8
    };
    
    // Scale to video display size
    const videoRect = video.getBoundingClientRect();
    const scaleX = videoRect.width / video.videoWidth;
    const scaleY = videoRect.height / video.videoHeight;
    
    highlightOverlay.style.position = 'absolute';
    highlightOverlay.style.left = (rect.x * scaleX) + 'px';
    highlightOverlay.style.top = (rect.y * scaleY) + 'px';
    highlightOverlay.style.width = (rect.width * scaleX) + 'px';
    highlightOverlay.style.height = (rect.height * scaleY) + 'px';
    highlightOverlay.style.border = isDuplicate ? '4px solid #dc3545' : '3px solid #28a745';
    highlightOverlay.style.backgroundColor = isDuplicate ? 'rgba(220, 53, 69, 0.2)' : 'rgba(40, 167, 69, 0.2)';
    highlightOverlay.style.borderRadius = '8px';
    highlightOverlay.style.zIndex = '1000';
    highlightOverlay.style.pointerEvents = 'none';
    highlightOverlay.style.animation = isDuplicate ? 'highlightPulseRed 1s infinite' : 'highlightPulseGreen 0.5s ease-out';
    
    // Add code text
    const codeText = document.createElement('div');
    codeText.style.position = 'absolute';
    codeText.style.top = '-30px';
    codeText.style.left = '0';
    codeText.style.background = isDuplicate ? '#dc3545' : '#28a745';
    codeText.style.color = 'white';
    codeText.style.padding = '4px 8px';
    codeText.style.borderRadius = '4px';
    codeText.style.fontSize = '12px';
    codeText.style.fontWeight = 'bold';
    codeText.textContent = isDuplicate ? `DUPLICATE: ${code}` : code;
    
    highlightOverlay.appendChild(codeText);
    
    // Add to camera container
    cameraContainer.style.position = 'relative';
    cameraContainer.appendChild(highlightOverlay);
    
    // Auto remove after delay
    setTimeout(() => {
        if (!isDuplicate) {
            removeHighlight();
        }
    }, isDuplicate ? 10000 : 2000); // Keep duplicate highlight longer
}

function removeHighlight() {
    if (highlightOverlay && highlightOverlay.parentNode) {
        highlightOverlay.parentNode.removeChild(highlightOverlay);
        highlightOverlay = null;
    }
}

// Duplicate Alert System
function showDuplicateAlert(code, duplicateInfo) {
    // Pause scanning
    const wasScanning = isScanning;
    if (wasScanning) {
        // Temporarily pause without changing UI
        isScanning = false;
    }
    
    // Find the actual scan result for this code
    const originalScan = scannedResults.find(result => 
        result.code === code && 
        result.user === duplicateInfo.user
    );
    
    // Calculate time difference
    const timeDiff = Date.now() - duplicateInfo.timestamp;
    const secondsAgo = Math.floor(timeDiff / 1000);
    
    // Create duplicate alert modal
    const modal = document.createElement('div');
    modal.className = 'modal duplicate-alert-modal';
    modal.style.zIndex = '10002';
    
    modal.innerHTML = `
        <div class="modal-content duplicate-alert-content">
            <div class="modal-header duplicate-alert-header">
                <h3><i class="fas fa-exclamation-triangle"></i> تحذير: كود مكرر!</h3>
                <span class="close" onclick="this.closest('.modal').remove(); resumeScanningAfterDuplicate(${wasScanning})">&times;</span>
            </div>
            <div class="modal-body duplicate-alert-body">
                <div class="duplicate-alert-info">
                    <div class="duplicate-code-large">${code}</div>
                    <div class="duplicate-warning">
                        <i class="fas fa-clock"></i>
                        تم مسح هذا الكود قبل <strong>${secondsAgo} seconds</strong> بواسطة <strong>${duplicateInfo.user}</strong>
                    </div>
                </div>
                
                ${originalScan ? `
                <div class="duplicate-image-section">
                    <h4><i class="fas fa-image"></i> الصورة الأصلية:</h4>
                    <div class="duplicate-original-image">
                        <img src="${originalScan.image}" alt="الصورة الأصلية" onclick="viewFullImageModal('${originalScan.id}')">
                        <div class="duplicate-image-info">
                            <div><strong>المستخدم:</strong> ${originalScan.user}</div>
                            <div><strong>التاريخ:</strong> ${formatDateTimeEnglish(originalScan.timestamp)}</div>
                            <div><strong>النوع:</strong> ${originalScan.codeType || 'Code'}</div>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <div class="duplicate-actions-section">
                    <button class="btn btn-success" onclick="this.closest('.modal').remove(); resumeScanningAfterDuplicate(${wasScanning})">
                        <i class="fas fa-play"></i> Continue Scanning
                    </button>
                    <button class="btn btn-warning" onclick="this.closest('.modal').remove(); resumeScanningAfterDuplicate(false)">
                        <i class="fas fa-stop"></i> Stop Scanning
                    </button>
                    ${originalScan ? `
                    <button class="btn btn-info" onclick="viewFullImageModal('${originalScan.id}')">
                        <i class="fas fa-expand"></i> View Full Image
                    </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Play warning sound/vibration
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
    }
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            resumeScanningAfterDuplicate(wasScanning);
        }
    });
}

// Resume scanning after duplicate alert
function resumeScanningAfterDuplicate(shouldResume) {
    removeHighlight();
    if (shouldResume) {
        isScanning = true;
    }
}

// Make function global for onclick
window.resumeScanningAfterDuplicate = resumeScanningAfterDuplicate;

// Universal Code Detection Handler (QR + Barcode)
async function handleCodeDetection(code, codeType = 'كود', location = null) {
    // Prevent simultaneous processing
    if (isProcessingCode) {
        console.debug('Code processing already in progress, ignoring:', code);
        return;
    }
    
    // Set processing flag
    isProcessingCode = true;
    
    try {
        // Check if this code was scanned before (ever)
        const existingScans = scannedResults.filter(result => result.code === code);
        const isFirstTime = existingScans.length === 0;
        
        // Check for recent duplicate (within 30 seconds) to prevent rapid rescanning
        const recentDuplicate = findRecentDuplicate(code);
        if (recentDuplicate && recentDuplicate.user === currentUser.username) {
            // Same user trying to scan the same code within 30 seconds - show alert only
            highlightDetectedCode(location, true, code, recentDuplicate);
            showDuplicateAlert(code, recentDuplicate);
            isProcessingCode = false; // Reset flag before return
            return;
        }
        
        // Determine if this is a duplicate (not first time)
        const isDuplicate = !isFirstTime;
        
        // Highlight based on whether it's duplicate or not
        if (location) {
            highlightDetectedCode(location, isDuplicate, code);
        }
        
        // Add to recent scans for duplicate detection (20-second protection)
        addToRecentScans(code);
        
        // Prevent rapid duplicate scans from same detection cycle
        if (lastScannedCode === code && Date.now() - lastScannedTime < 2000) {
            console.debug('Rapid duplicate scan prevented:', code);
            isProcessingCode = false; // Reset flag before return
            return;
        }
        
        lastScannedCode = code;
        lastScannedTime = Date.now();
        
        showLoading(true);
        
        // Capture image with code info
        const imageData = await captureImageWithCodeInfo(code, codeType);
        
        // Create result object
        const scanResult = {
            id: generateId(),
            code: code,
            codeType: codeType, // 'QR كود' or 'باركود'
            timestamp: new Date().toISOString(),
            user: currentUser.username,
            image: imageData,
            telegramStatus: 'pending', // pending, sending, success, failed
            telegramAttempts: 0,
            lastAttemptTime: null,
            isDuplicate: isDuplicate, // Mark if this is a duplicate scan
            duplicateCount: existingScans.length + 1 // Current total count for this code
        };
        
        // Add to results
        scannedResults.unshift(scanResult);
        saveResults();
        
        // Update UI
        displayResult(scanResult);
        
        // Auto-send to Telegram if enabled
        const settings = getSettings();
        if (settings.autoSend && settings.botToken && settings.chatId) {
            // Send to Telegram asynchronously (don't wait)
            sendToTelegram(scanResult).catch(error => {
                console.error('Auto-send to Telegram failed:', error);
            });
        }
        
        // Success feedback with appropriate message
        if (isDuplicate) {
            showAlert(`تم مسح كود مكرر: ${code} (المرة رقم ${scanResult.duplicateCount})`, 'warning');
        } else {
            showAlert(`تم مسح كود جديد: ${code}`, 'success');
        }
        
        // Show camera success indicator
        showCameraSuccessIndicator(isDuplicate);
        
        playSuccessSound(isDuplicate);
        
        // Pause scanning briefly to show indicators (increased duration)
        pauseScanningBriefly(isDuplicate ? 3000 : 2500);
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error processing code:', error);
        showAlert(`خطأ في معالجة ${codeType}`, 'error');
        showLoading(false);
    } finally {
        // Always reset the processing flag
        isProcessingCode = false;
    }
}

// Image Capture
async function captureImage() {
    return await captureImageWithCodeInfo(null, 'كود');
}

async function captureImageWithCodeInfo(codeValue, codeType = 'كود') {
    return new Promise((resolve) => {
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw current video frame to canvas
        context.drawImage(video, 0, 0);
        
        // Add watermark bar with code info
        addWatermarkToImage(context, canvas.width, canvas.height, codeValue, codeType);
        
        // Convert to base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        resolve(imageData);
    });
}

function addWatermarkToImage(context, width, height, codeValue = null, codeType = 'كود') {
    // Calculate bar height (10% of image height, minimum 80px, maximum 150px)
    const barHeight = Math.max(80, Math.min(150, height * 0.1));
    const barY = height - barHeight;
    
    // Determine colors and icons based on code type
    const isQR = codeType.includes('QR');
    const borderColor = isQR ? 'rgba(255, 165, 0, 0.6)' : 'rgba(0, 150, 255, 0.6)'; // Orange for QR, Blue for Barcode
    const codeColor = isQR ? '#ff9500' : '#00ff88'; // Orange for QR, Green for Barcode
    const codeIcon = isQR ? '📱' : '🔢';
    const titleIcon = isQR ? '📱' : '📊';
    
    // Draw black semi-transparent bar
    context.fillStyle = 'rgba(0, 0, 0, 0.9)';
    context.fillRect(0, barY, width, barHeight);
    
    // Add subtle border at top (color based on code type)
    context.fillStyle = borderColor;
    context.fillRect(0, barY, width, 3);
    
    // Calculate font sizes based on bar height
    const titleFontSize = Math.max(18, barHeight * 0.22);
    const infoFontSize = Math.max(14, barHeight * 0.16);
    const codeFontSize = Math.max(16, barHeight * 0.18);
    const padding = Math.max(10, barHeight * 0.12);
    
    // Set text properties
    context.fillStyle = '#ffffff';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    
    // Draw main title with appropriate icon
    context.font = `bold ${titleFontSize}px Arial, sans-serif`;
    const titleText = `${titleIcon} مسح الأكواد المتطور`;
    context.fillText(titleText, padding, barY + padding);
    
    // Draw current time (Baghdad timezone)
    const currentTime = new Date().toLocaleString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Baghdad'
    });
    
    context.font = `${infoFontSize}px Arial, sans-serif`;
    context.fillStyle = '#cccccc';
    context.textAlign = 'right';
    context.fillText(`🕐 ${currentTime}`, width - padding, barY + padding);
    
    // Draw code value if provided (highlighted with appropriate color)
    if (codeValue) {
        context.textAlign = 'left';
        context.font = `bold ${codeFontSize}px monospace`;
        context.fillStyle = codeColor;
        const codeText = `${codeIcon} ${codeValue} [${codeType}]`;
        context.fillText(codeText, padding, barY + padding + titleFontSize + 8);
        
        // Add background highlight for code
        const codeMetrics = context.measureText(codeText);
        const highlightColor = isQR ? 'rgba(255, 149, 0, 0.2)' : 'rgba(0, 255, 136, 0.2)';
        context.fillStyle = highlightColor;
        context.fillRect(padding - 5, barY + padding + titleFontSize + 5, codeMetrics.width + 10, codeFontSize + 6);
        
        // Redraw the text over the highlight
        context.fillStyle = codeColor;
        context.fillText(codeText, padding, barY + padding + titleFontSize + 8);
    }
    
    // Draw user info
    context.textAlign = 'left';
    context.font = `${infoFontSize}px Arial, sans-serif`;
    context.fillStyle = '#ffffff';
    const userText = `👤 ${currentUser.username}`;
    const userY = codeValue ? barY + padding + titleFontSize + codeFontSize + 16 : barY + padding + titleFontSize + 8;
    context.fillText(userText, padding, userY);
    
    // Draw location/system info
    const systemText = '🌍 نظام قارئ الأكواد المتطور - بغداد، العراق';
    context.font = `${Math.max(12, infoFontSize * 0.9)}px Arial, sans-serif`;
    context.fillStyle = '#aaaaaa';
    context.fillText(systemText, padding, barY + barHeight - infoFontSize - padding);
    
    // Add security/authenticity indicator
    context.fillStyle = '#4CAF50';
    context.font = `bold ${Math.max(10, infoFontSize * 0.8)}px Arial, sans-serif`;
    context.textAlign = 'right';
    context.fillText('✓ معتمد', width - padding, barY + barHeight - infoFontSize - padding);
    
    // Add decorative elements with code type indicator
    drawDecorationElements(context, width, barY, barHeight, padding, isQR);
}

function drawDecorationElements(context, width, barY, barHeight, padding, isQR = false) {
    // Draw small decorative line with appropriate color
    const lineY = barY + barHeight * 0.6;
    const lineWidth = 40;
    
    context.strokeStyle = isQR ? 'rgba(255, 165, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(padding, lineY);
    context.lineTo(padding + lineWidth, lineY);
    context.stroke();
    
    // Draw pattern based on code type
    if (isQR) {
        // Draw QR-style pattern for QR codes
        drawQRPattern(context, width, barY, barHeight, padding);
    } else {
        // Draw barcode-style pattern for traditional barcodes
        drawBarcodePattern(context, width, barY, barHeight, padding);
    }
}

function drawQRPattern(context, width, barY, barHeight, padding) {
    // QR-like pattern (more complex for QR codes)
    context.fillStyle = 'rgba(255, 165, 0, 0.2)';
    const patternSize = barHeight * 0.2;
    const patternX = width - padding - patternSize - 40;
    const patternY = barY + padding;
    
    // Draw QR corner squares
    const cornerSize = patternSize / 3;
    
    // Top-left corner
    context.fillRect(patternX, patternY, cornerSize, cornerSize);
    context.fillRect(patternX + cornerSize/3, patternY + cornerSize/3, cornerSize/3, cornerSize/3);
    
    // Top-right corner  
    context.fillRect(patternX + 2*cornerSize, patternY, cornerSize, cornerSize);
    context.fillRect(patternX + 2*cornerSize + cornerSize/3, patternY + cornerSize/3, cornerSize/3, cornerSize/3);
    
    // Bottom-left corner
    context.fillRect(patternX, patternY + 2*cornerSize, cornerSize, cornerSize);
    context.fillRect(patternX + cornerSize/3, patternY + 2*cornerSize + cornerSize/3, cornerSize/3, cornerSize/3);
    
    // Add some random QR-like dots
    context.fillStyle = 'rgba(255, 165, 0, 0.3)';
    for (let i = 0; i < 8; i++) {
        const x = patternX + Math.random() * patternSize;
        const y = patternY + Math.random() * patternSize;
        context.fillRect(x, y, 2, 2);
    }
}

function drawBarcodePattern(context, width, barY, barHeight, padding) {
    // Traditional barcode-style vertical lines
    context.fillStyle = 'rgba(255, 255, 255, 0.2)';
    const lineHeight = barHeight * 0.3;
    const startX = width - padding - 60;
    const startY = barY + barHeight * 0.2;
    
    // Draw vertical barcode-like lines
    const lineWidths = [2, 1, 3, 2, 1, 4, 1, 2, 3, 1]; // Simulated barcode pattern
    let currentX = startX;
    
    for (let i = 0; i < lineWidths.length; i++) {
        if (i % 2 === 0) { // Draw bars
            context.fillRect(currentX, startY, lineWidths[i], lineHeight);
        }
        currentX += lineWidths[i] + 1; // Add spacing
    }
    
    // Add small squares pattern
    context.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const squareSize = 3;
    const spacing = 6;
    const squareStartX = width - padding - 30;
    
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 2; j++) {
            const x = squareStartX + (i * spacing);
            const y = barY + barHeight * 0.3 + (j * spacing);
            context.fillRect(x, y, squareSize, squareSize);
        }
    }
}

// Results Management
function displayResult(result) {
    const resultItem = document.createElement('div');
    resultItem.className = `result-item ${result.isDuplicate ? 'duplicate' : ''} telegram-${result.telegramStatus || 'pending'}`;
    resultItem.setAttribute('data-result-id', result.id);
    
    const telegramStatusIndicator = getTelegramStatusIndicator(result.telegramStatus || 'pending', result.telegramAttempts || 0);
    const duplicateIndicator = result.isDuplicate ? `<span class="duplicate-indicator">مكرر ×${result.duplicateCount}</span>` : '';
    const statusBadge = result.isDuplicate ? '<span class="status-badge duplicate-status">مكرر</span>' : '<span class="status-badge new-status">جديد</span>';
    
    resultItem.innerHTML = `
        <div class="result-content">
            <div class="result-code">
                ${duplicateIndicator}
                <span class="code-type-badge ${result.codeType && result.codeType.includes('QR') ? 'qr-badge' : 'barcode-badge'}">${result.codeType || 'كود'}</span>
                <span class="code-text">${result.code}</span>
                ${statusBadge}
                ${telegramStatusIndicator}
            </div>
            <div class="result-time">${formatDateTime(result.timestamp)} - ${result.user}</div>
        </div>
        <div class="result-actions">
            <button class="btn btn-info" onclick="viewImage('${result.id}')">
                <i class="fas fa-eye"></i> عرض
            </button>
            <button class="btn btn-primary telegram-send-btn" onclick="sendSingleToTelegram('${result.id}')" ${result.telegramStatus === 'sending' ? 'disabled' : ''}>
                <i class="fab fa-telegram"></i> ${getTelegramButtonText(result.telegramStatus || 'pending')}
            </button>
            <button class="btn btn-secondary" onclick="copyCode('${result.code}')">
                <i class="fas fa-copy"></i> نسخ
            </button>
            ${result.isDuplicate ? `<button class="btn btn-warning" onclick="showDuplicatesForCode('${result.code}')">
                <i class="fas fa-search"></i> المكررات
            </button>` : ''}
        </div>
    `;
    
    resultsList.insertBefore(resultItem, resultsList.firstChild);
    
    // Update duplicate indicators for all instances of this code if duplicate
    if (result.isDuplicate) {
        updateDuplicateIndicators(result.code);
    }
}

function getTelegramStatusIndicator(status, attempts) {
    switch (status) {
        case 'pending':
            return '<span class="telegram-status pending"><i class="fas fa-clock"></i> في الانتظار</span>';
        case 'sending':
            return '<span class="telegram-status sending"><i class="fas fa-spinner fa-spin"></i> جاري الإرسال...</span>';
        case 'success':
            return '<span class="telegram-status success"><i class="fas fa-check-circle"></i> تم الإرسال</span>';
        case 'failed':
            return `<span class="telegram-status failed"><i class="fas fa-exclamation-triangle"></i> فشل (${attempts} محاولات)</span>`;
        default:
            return '<span class="telegram-status pending"><i class="fas fa-clock"></i> في الانتظار</span>';
    }
}

function getTelegramButtonText(status) {
    switch (status) {
        case 'pending':
            return 'إرسال';
        case 'sending':
            return 'جاري الإرسال...';
        case 'success':
            return 'تم الإرسال ✓';
        case 'failed':
            return 'إعادة المحاولة';
        default:
            return 'إرسال';
    }
}

async function saveResults() {
    // Results are now automatically saved via API when created
    // This function is kept for compatibility
}

async function loadResults() {
    try {
        const response = await fetch('/api/scans?limit=100');
        const data = await response.json();
        
        if (data.success && data.scans) {
            scannedResults = data.scans.map(scan => ({
                id: scan.id,
                code: scan.barcode,
                codeType: scan.code_type,
                user: scan.username,
                timestamp: scan.scan_time,
                image: scan.image_data || '',
                telegramStatus: scan.telegram_sent === 1 ? 'success' : 'pending',
                telegramAttempts: scan.telegram_attempts || 0
            }));
            
            // Clear the results list first
            resultsList.innerHTML = '';
            
            // Display results in reverse order (newest first)
            scannedResults.slice().reverse().forEach(result => {
                displayResultFromLoad(result);
            });
            
            // Update all duplicate indicators after loading
            updateAllDuplicateIndicators();
            
            // Resume failed auto-sends if auto-send is enabled
            resumeFailedSends();
        }
    } catch (error) {
        console.error('Error loading results:', error);
        scannedResults = [];
    }
}

function resumeFailedSends() {
    const settings = getSettings();
    if (!settings.autoSend || !settings.botToken || !settings.chatId) {
        return;
    }
    
    // Find results that need to be sent
    const pendingResults = scannedResults.filter(result => 
        (result.telegramStatus === 'pending' || result.telegramStatus === 'failed') && 
        (result.telegramAttempts || 0) < 5
    );
    
    if (pendingResults.length > 0) {
        console.log(`Resuming ${pendingResults.length} failed/pending Telegram sends`);
        
        // Send them with some delay to avoid overwhelming the API
        pendingResults.forEach((result, index) => {
            setTimeout(() => {
                sendToTelegram(result, true).catch(error => {
                    console.error('Resume send failed:', error);
                });
            }, index * 2000); // 2 second delay between each
        });
    }
}

function displayResultFromLoad(result) {
    const resultItem = document.createElement('div');
    resultItem.className = `result-item telegram-${result.telegramStatus || 'pending'}`;
    resultItem.setAttribute('data-result-id', result.id);
    
    const telegramStatusIndicator = getTelegramStatusIndicator(result.telegramStatus || 'pending', result.telegramAttempts || 0);
    
    resultItem.innerHTML = `
        <div class="result-content">
            <div class="result-code">
                <span class="code-type-badge ${result.codeType && result.codeType.includes('QR') ? 'qr-badge' : 'barcode-badge'}">${result.codeType || 'كود'}</span>
                <span class="code-text">${result.code}</span>
                ${telegramStatusIndicator}
            </div>
            <div class="result-time">${formatDateTime(result.timestamp)} - ${result.user}</div>
        </div>
        <div class="result-actions">
            <button class="btn btn-info" onclick="viewImage('${result.id}')">
                <i class="fas fa-eye"></i> عرض
            </button>
            <button class="btn btn-primary telegram-send-btn" onclick="sendSingleToTelegram('${result.id}')" ${result.telegramStatus === 'sending' ? 'disabled' : ''}>
                <i class="fab fa-telegram"></i> ${getTelegramButtonText(result.telegramStatus || 'pending')}
            </button>
            <button class="btn btn-secondary" onclick="copyCode('${result.code}')">
                <i class="fas fa-copy"></i> نسخ
            </button>
        </div>
    `;
    
    resultsList.appendChild(resultItem);
}

function updateAllDuplicateIndicators() {
    // Get all unique codes and their counts
    const codeCounts = {};
    scannedResults.forEach(result => {
        codeCounts[result.code] = (codeCounts[result.code] || 0) + 1;
    });
    
    // Update indicators for all codes
    Object.keys(codeCounts).forEach(code => {
        if (codeCounts[code] > 1) {
            updateDuplicateIndicators(code);
        }
    });
}

function updateDuplicateIndicators(code) {
    const duplicateCount = scannedResults.filter(r => r.code === code).length;
    
    // Update all result items with this code
    const allResults = document.querySelectorAll('.result-item');
    allResults.forEach(item => {
        const codeElement = item.querySelector('.code-text');
        if (codeElement && codeElement.textContent === code) {
            const resultCodeDiv = item.querySelector('.result-code');
            const existingIndicator = resultCodeDiv.querySelector('.duplicate-indicator');
            
            if (duplicateCount > 1) {
                // Add duplicate class
                item.classList.add('duplicate');
                
                // Update or add duplicate indicator
                if (existingIndicator) {
                    existingIndicator.textContent = `مكرر ×${duplicateCount}`;
                } else {
                    const indicator = document.createElement('span');
                    indicator.className = 'duplicate-indicator';
                    indicator.textContent = `مكرر ×${duplicateCount}`;
                    resultCodeDiv.insertBefore(indicator, codeElement);
                }
                
                // Add duplicates button if not exists
                const actionsDiv = item.querySelector('.result-actions');
                const existingDuplicatesBtn = actionsDiv.querySelector('.btn-warning');
                if (!existingDuplicatesBtn) {
                    const duplicatesBtn = document.createElement('button');
                    duplicatesBtn.className = 'btn btn-warning';
                    duplicatesBtn.onclick = () => showDuplicatesForCode(code);
                    duplicatesBtn.innerHTML = '<i class="fas fa-search"></i> المكررات';
                    actionsDiv.appendChild(duplicatesBtn);
                }
            } else {
                // Remove duplicate class and indicator
                item.classList.remove('duplicate');
                if (existingIndicator) {
                    existingIndicator.remove();
                }
                
                // Remove duplicates button
                const duplicatesBtn = item.querySelector('.btn-warning');
                if (duplicatesBtn) {
                    duplicatesBtn.remove();
                }
            }
        }
    });
}

// Function clearAllResults removed as per user request

// Settings Management
function openSettings() {
    if (!isOwner) {
        showAlert('الإعدادات متاحة للأونر فقط', 'error');
        return;
    }
    loadSettingsToModal();
    settingsModal.style.display = 'block';
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

async function loadSettingsToModal() {
    if (!currentUser) return;
    
    try {
        const settings = await getSettings(); // استخدام getSettings التي تدمج مع الافتراضية
        botToken.value = settings.botToken || '';
        chatId.value = settings.chatId || '';
        autoSend.checked = settings.autoSend === true;
        
        // إظهار رسالة إذا كانت الإعدادات افتراضية
        if (!await loadAllSettings().then(s => s.botToken)) {
            showAlert('تم تحميل الإعدادات الافتراضية للتليجرام', 'info');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        // في حالة الخطأ، استخدم الإعدادات الافتراضية
        botToken.value = DEFAULT_TELEGRAM_SETTINGS.botToken;
        chatId.value = DEFAULT_TELEGRAM_SETTINGS.chatId;
        autoSend.checked = DEFAULT_TELEGRAM_SETTINGS.autoSend;
    }
}

async function saveSettingsData() {
    if (!isOwner || !currentUser) {
        showAlert('حفظ الإعدادات متاح للأونر فقط', 'error');
        return;
    }
    
    try {
        await saveSetting('botToken', botToken.value.trim(), 'string');
        await saveSetting('chatId', chatId.value.trim(), 'string');
        await saveSetting('autoSend', autoSend.checked.toString(), 'boolean');
        
        closeSettingsModal();
        showAlert('تم حفظ الإعدادات بنجاح', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showAlert('خطأ في حفظ الإعدادات', 'error');
    }
}

async function getSettings() {
    if (!currentUser) return DEFAULT_TELEGRAM_SETTINGS;
    
    try {
        const settings = await loadAllSettings();
        
        // Merge with defaults if settings are empty or missing
        return {
            botToken: settings.botToken || DEFAULT_TELEGRAM_SETTINGS.botToken,
            chatId: settings.chatId || DEFAULT_TELEGRAM_SETTINGS.chatId,
            autoSend: settings.autoSend === 'true' || (settings.autoSend === undefined && DEFAULT_TELEGRAM_SETTINGS.autoSend)
        };
    } catch (error) {
        console.error('Error getting settings:', error);
        return DEFAULT_TELEGRAM_SETTINGS;
    }
}

function loadSettings() {
    // Settings loaded when modal opens
}

// Telegram Integration
async function testTelegramConnection() {
    if (!isOwner) {
        showAlert('اختبار الاتصال متاح للأونر فقط', 'error');
        return;
    }
    
    const token = botToken.value.trim();
    const chat = chatId.value.trim();
    
    if (!token || !chat) {
        showAlert('يرجى إدخال توكن البوت وآيدي المجموعة', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chat,
                text: '🔧 اختبار الاتصال - قارئ الباركود\\nالبوت يعمل بشكل صحيح!'
            })
        });
        
        if (response.ok) {
            showAlert('تم اختبار الاتصال بنجاح!', 'success');
        } else {
            const error = await response.json();
            showAlert(`خطأ في الاتصال: ${error.description}`, 'error');
        }
        
    } catch (error) {
        console.error('Telegram test error:', error);
        showAlert('خطأ في الاتصال بالتليجرام', 'error');
    } finally {
        showLoading(false);
    }
}

async function sendToTelegram(result, isRetry = false) {
    const settings = await getSettings();
    
    if (!settings.botToken || !settings.chatId) {
        updateTelegramStatus(result.id, 'failed', 'إعدادات التليجرام غير مكتملة');
        if (!isRetry) {
            showAlert('يرجى تكوين إعدادات التليجرام أولاً', 'error');
        }
        return false;
    }
    
    // Update status to sending
    updateTelegramStatus(result.id, 'sending');
    
    // Increment attempts
    result.telegramAttempts = (result.telegramAttempts || 0) + 1;
    result.lastAttemptTime = new Date().toISOString();
    
    try {
        // Convert base64 to blob
        const imageBlob = dataURLtoBlob(result.image);
        
        // Create form data
        const formData = new FormData();
        formData.append('chat_id', settings.chatId);
        formData.append('photo', imageBlob, 'barcode.jpg');
        const codeIcon = result.codeType && result.codeType.includes('QR') ? '📱' : '🔢';
        const systemName = result.codeType && result.codeType.includes('QR') ? 'قارئ الأكواد الذكي' : 'قارئ الباركود المتطور';
        
        // Build duplicate information
        let duplicateInfo = '';
        if (result.isDuplicate) {
            const allScansOfThisCode = scannedResults.filter(r => r.code === result.code);
            const previousScans = allScansOfThisCode.filter(r => r.timestamp < result.timestamp);
            
            duplicateInfo = `
🔄 **تحذير: كود مكرر!**
📈 **رقم المسحة:** ${result.duplicateCount} من إجمالي ${allScansOfThisCode.length}
📝 **المسحات السابقة:**`;
            
            previousScans.slice(-3).forEach((scan, index) => {
                duplicateInfo += `
   ${index + 1}. ${scan.user} - ${formatDateTimeBaghdad(scan.timestamp)}`;
            });
            
            if (previousScans.length > 3) {
                duplicateInfo += `
   ... و ${previousScans.length - 3} مسحات أخرى`;
            }
            
            duplicateInfo += '\n';
        }
        
        // Clean the code: remove leading zeros and keep only numbers
        const cleanCode = result.code.replace(/^0+/, '') || '0';
        
        formData.append('caption', cleanCode);
        
        const response = await fetch(`https://api.telegram.org/bot${settings.botToken}/sendPhoto`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            updateTelegramStatus(result.id, 'success');
            if (!isRetry) {
                showAlert('تم إرسال الصورة للتليجرام بنجاح ✓', 'success');
            }
            return true;
        } else {
            const error = await response.json();
            console.error('Telegram send error:', error);
            
            // Schedule retry if not too many attempts
            if (result.telegramAttempts < 5) {
                updateTelegramStatus(result.id, 'failed', `خطأ: ${error.description || 'Unknown error'}`);
                scheduleRetry(result);
                if (!isRetry) {
                    showAlert(`فشل الإرسال، سيتم إعادة المحاولة (${result.telegramAttempts}/5)`, 'warning');
                }
            } else {
                updateTelegramStatus(result.id, 'failed', 'تم تجاوز الحد الأقصى للمحاولات');
                if (!isRetry) {
                    showAlert('فشل الإرسال نهائياً بعد 5 محاولات', 'error');
                }
            }
            return false;
        }
        
    } catch (error) {
        console.error('Send to Telegram error:', error);
        
        // Schedule retry if not too many attempts
        if (result.telegramAttempts < 5) {
            updateTelegramStatus(result.id, 'failed', `خطأ شبكة: ${error.message}`);
            scheduleRetry(result);
            if (!isRetry) {
                showAlert(`خطأ في الاتصال، سيتم إعادة المحاولة (${result.telegramAttempts}/5)`, 'warning');
            }
        } else {
            updateTelegramStatus(result.id, 'failed', 'تم تجاوز الحد الأقصى للمحاولات');
            if (!isRetry) {
                showAlert('فشل الإرسال نهائياً بعد 5 محاولات', 'error');
            }
        }
        return false;
    }
}

function updateTelegramStatus(resultId, status, errorMessage = null) {
    // Update in memory
    const result = scannedResults.find(r => r.id === resultId);
    if (result) {
        result.telegramStatus = status;
        if (errorMessage) {
            result.telegramError = errorMessage;
        }
        if (status === 'success') {
            result.telegramSentAt = new Date().toISOString();
        }
        
        // Save to storage
        saveResults();
        
        // Update UI
        updateResultItemUI(resultId, result);
    }
}

function updateResultItemUI(resultId, result) {
    const resultElement = document.querySelector(`[data-result-id="${resultId}"]`);
    if (resultElement) {
        // Update status indicator
        const statusElement = resultElement.querySelector('.telegram-status');
        if (statusElement) {
            statusElement.outerHTML = getTelegramStatusIndicator(result.telegramStatus, result.telegramAttempts);
        }
        
        // Update button
        const sendButton = resultElement.querySelector('.telegram-send-btn');
        if (sendButton) {
            sendButton.innerHTML = `<i class="fab fa-telegram"></i> ${getTelegramButtonText(result.telegramStatus)}`;
            sendButton.disabled = result.telegramStatus === 'sending';
        }
        
        // Update result item class
        resultElement.className = resultElement.className.replace(/telegram-\w+/, `telegram-${result.telegramStatus}`);
    }
}

function scheduleRetry(result) {
    // Calculate delay based on attempt number (exponential backoff)
    const delays = [3000, 5000, 10000, 30000, 60000]; // 3s, 5s, 10s, 30s, 1m
    const delay = delays[Math.min(result.telegramAttempts - 1, delays.length - 1)];
    
    setTimeout(async () => {
        // Check if result still exists and hasn't been sent successfully
        const currentResult = scannedResults.find(r => r.id === result.id);
        if (currentResult && currentResult.telegramStatus === 'failed' && currentResult.telegramAttempts < 5) {
            console.log(`Retrying Telegram send for result ${result.id}, attempt ${currentResult.telegramAttempts + 1}`);
            await sendToTelegram(currentResult, true);
        }
    }, delay);
}

async function sendSingleToTelegram(resultId) {
    const result = scannedResults.find(r => r.id === resultId);
    if (result) {
        // Reset attempt count if manually triggered
        if (result.telegramStatus === 'failed') {
            result.telegramAttempts = 0;
        }
        
        showLoading(true);
        const success = await sendToTelegram(result);
        showLoading(false);
        
        return success;
    }
    return false;
}

// Utility Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Baghdad'
    });
}

function formatDateTimeBaghdad(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Baghdad',
        timeZoneName: 'short'
    });
}

function formatDateOnly(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Baghdad'
    });
}

function formatTimeOnly(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Baghdad'
    });
}

function formatDateTimeEnglish(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Baghdad',
        hour12: false
    });
}

function dataURLtoBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

function showAlert(message, type = 'info') {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    // Insert at top of main content
    const mainContent = document.querySelector('.main-content .container');
    mainContent.insertBefore(alert, mainContent.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// Camera Success Indicator
function showCameraSuccessIndicator(isDuplicate = false) {
    // Remove any existing indicator
    const existingIndicator = document.querySelector('.camera-success-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // Create success indicator overlay
    const indicator = document.createElement('div');
    indicator.className = 'camera-success-indicator';
    
    // Different styles for new vs duplicate
    const iconClass = isDuplicate ? 'fas fa-exclamation-triangle' : 'fas fa-check-circle';
    const iconColor = isDuplicate ? '#ffc107' : '#28a745';
    const message = isDuplicate ? 'مكرر!' : 'تم المسح!';
    const bgColor = isDuplicate ? 'rgba(255, 193, 7, 0.9)' : 'rgba(40, 167, 69, 0.9)';
    
    indicator.innerHTML = `
        <div class="success-content">
            <i class="${iconClass}" style="color: ${iconColor};"></i>
            <span class="success-message">${message}</span>
        </div>
    `;
    
    // Style the indicator
    indicator.style.position = 'absolute';
    indicator.style.top = '0';
    indicator.style.left = '0';
    indicator.style.right = '0';
    indicator.style.bottom = '0';
    indicator.style.background = bgColor;
    indicator.style.display = 'flex';
    indicator.style.alignItems = 'center';
    indicator.style.justifyContent = 'center';
    indicator.style.zIndex = '1001';
    indicator.style.borderRadius = '15px';
    indicator.style.animation = isDuplicate ? 'cameraWarningFlash 1.5s ease-out' : 'cameraSuccessFlash 1s ease-out';
    
    // Add to camera container
    if (cameraContainer && cameraContainer.style.display !== 'none') {
        cameraContainer.appendChild(indicator);
        
        // Remove after animation
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.remove();
            }
        }, isDuplicate ? 1500 : 1000);
    }
    
    // Add camera frame flash effect
    showCameraFrameFlash(isDuplicate);
    
    // Add center ripple effect
    showCameraCenterRipple(isDuplicate);
}

function showCameraFrameFlash(isDuplicate = false) {
    // Flash the camera frame
    const frameColor = isDuplicate ? '#ffc107' : '#28a745';
    const originalBorder = cameraContainer.style.border;
    
    // Flash effect
    cameraContainer.style.border = `4px solid ${frameColor}`;
    cameraContainer.style.boxShadow = `0 0 20px ${frameColor}`;
    cameraContainer.style.transition = 'all 0.1s ease';
    
    setTimeout(() => {
        cameraContainer.style.border = originalBorder;
        cameraContainer.style.boxShadow = '';
        cameraContainer.style.transition = '';
    }, isDuplicate ? 800 : 500);
}

function showCameraCenterRipple(isDuplicate = false) {
    // Remove any existing ripple
    const existingRipple = document.querySelector('.camera-center-ripple');
    if (existingRipple) {
        existingRipple.remove();
    }
    
    // Create ripple element
    const ripple = document.createElement('div');
    ripple.className = 'camera-center-ripple';
    
    const rippleColor = isDuplicate ? 'rgba(255, 193, 7, 0.6)' : 'rgba(40, 167, 69, 0.6)';
    const animationName = isDuplicate ? 'centerRippleWarning' : 'centerRippleSuccess';
    
    // Style the ripple
    ripple.style.position = 'absolute';
    ripple.style.top = '50%';
    ripple.style.left = '50%';
    ripple.style.width = '20px';
    ripple.style.height = '20px';
    ripple.style.background = rippleColor;
    ripple.style.borderRadius = '50%';
    ripple.style.transform = 'translate(-50%, -50%)';
    ripple.style.zIndex = '1000';
    ripple.style.pointerEvents = 'none';
    ripple.style.animation = `${animationName} 0.8s ease-out`;
    
    // Add to camera container
    if (cameraContainer && cameraContainer.style.display !== 'none') {
        cameraContainer.appendChild(ripple);
        
        // Remove after animation
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.remove();
            }
        }, 800);
    }
}

function pauseScanningBriefly(duration = 2500) {
    const originalIsScanning = isScanning;
    
    if (originalIsScanning) {
        // Temporarily pause scanning
        isScanning = false;
        
        // Add visual feedback to camera container
        if (cameraContainer) {
            cameraContainer.classList.remove('scanning-active');
            cameraContainer.classList.add('scanning-paused');
        }
        
        // Show pause indicator to user
        showScanPauseIndicator(duration);
        
        // Resume after duration
        pauseTimeout = setTimeout(() => {
            if (originalIsScanning) {
                isScanning = true;
                removeScanPauseIndicator();
                
                // Restore active scanning visual feedback
                if (cameraContainer) {
                    cameraContainer.classList.remove('scanning-paused');
                    cameraContainer.classList.add('scanning-active');
                }
            }
            pauseTimeout = null;
        }, duration);
    }
}

// Skip pause function
function skipPause() {
    if (pauseTimeout) {
        clearTimeout(pauseTimeout);
        pauseTimeout = null;
        
        isScanning = true;
        removeScanPauseIndicator();
        
        // Restore active scanning visual feedback
        if (cameraContainer) {
            cameraContainer.classList.remove('scanning-paused');
            cameraContainer.classList.add('scanning-active');
        }
        
        showAlert('تم تخطي التوقف المؤقت', 'info');
    }
}

// Show visual indicator that scanning is paused
function showScanPauseIndicator(duration) {
    // Remove existing indicator if any
    removeScanPauseIndicator();
    
    const indicator = document.createElement('div');
    indicator.className = 'scan-pause-indicator';
    indicator.innerHTML = `
        <div class="pause-content">
            <i class="fas fa-pause-circle"></i>
            <span class="pause-message">توقف مؤقت...</span>
            <button class="skip-pause-btn" onclick="skipPause()">
                <i class="fas fa-forward"></i> تخطي
            </button>
            <div class="pause-timer">
                <div class="pause-progress"></div>
            </div>
        </div>
    `;
    
    // Style the indicator
    indicator.style.position = 'absolute';
    indicator.style.top = '10px';
    indicator.style.left = '50%';
    indicator.style.transform = 'translateX(-50%)';
    indicator.style.background = 'rgba(0, 0, 0, 0.8)';
    indicator.style.color = 'white';
    indicator.style.padding = '10px 20px';
    indicator.style.borderRadius = '25px';
    indicator.style.zIndex = '1002';
    indicator.style.fontSize = '14px';
    indicator.style.textAlign = 'center';
    indicator.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    indicator.style.animation = 'fadeInDown 0.3s ease-out';
    
    // Style the progress bar
    const progressBar = indicator.querySelector('.pause-progress');
    progressBar.style.width = '100px';
    progressBar.style.height = '3px';
    progressBar.style.background = 'rgba(255,255,255,0.3)';
    progressBar.style.borderRadius = '2px';
    progressBar.style.margin = '8px auto 0';
    progressBar.style.overflow = 'hidden';
    progressBar.style.position = 'relative';
    
    // Add progress animation
    progressBar.innerHTML = '<div class="progress-fill"></div>';
    const progressFill = progressBar.querySelector('.progress-fill');
    progressFill.style.width = '100%';
    progressFill.style.height = '100%';
    progressFill.style.background = '#4CAF50';
    progressFill.style.borderRadius = '2px';
    progressFill.style.animation = `progressCountdown ${duration}ms linear`;
    
    // Add to camera container
    if (cameraContainer && cameraContainer.style.display !== 'none') {
        cameraContainer.appendChild(indicator);
    }
}

function removeScanPauseIndicator() {
    const existingIndicator = document.querySelector('.scan-pause-indicator');
    if (existingIndicator) {
        existingIndicator.style.animation = 'fadeOutUp 0.3s ease-out';
        setTimeout(() => {
            if (existingIndicator.parentNode) {
                existingIndicator.remove();
            }
        }, 300);
    }
}

function playSuccessSound(isDuplicate = false) {
    // Different vibration patterns for new vs duplicate
    if (navigator.vibrate) {
        if (isDuplicate) {
            // Double short vibration for duplicates
            navigator.vibrate([100, 50, 100]);
        } else {
            // Single longer vibration for new codes
            navigator.vibrate(300);
        }
    }
    
    // Different visual feedback colors
    const bgColor = isDuplicate ? '#ffc107' : '#28a745';
    document.body.style.backgroundColor = bgColor;
    document.body.style.transition = 'background-color 0.1s ease';
    
    setTimeout(() => {
        document.body.style.backgroundColor = '';
        document.body.style.transition = '';
    }, isDuplicate ? 300 : 200);
    
    // Add body flash effect
    document.body.style.boxShadow = `inset 0 0 50px ${bgColor}`;
    setTimeout(() => {
        document.body.style.boxShadow = '';
    }, 100);
}

function viewImage(resultId) {
    const result = scannedResults.find(r => r.id === resultId);
    if (result) {
        // Create image viewer modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 90%; max-height: 90%;">
                <div class="modal-header">
                    <h3>صورة الباركود: ${result.code}</h3>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <img src="${result.image}" style="max-width: 100%; max-height: 70vh; border-radius: 10px;">
                    <p style="margin-top: 15px; color: #666;">
                        التقطت في: ${formatDateTime(result.timestamp)}<br>
                        بواسطة: ${result.user}
                    </p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}

function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showAlert('تم نسخ الكود', 'success');
    }).catch(() => {
        showAlert('خطأ في نسخ الكود', 'error');
    });
}

// Close modals on background click
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        closeSettingsModal();
    }
    if (e.target === usersModal) {
        closeUsersModal();
    }
    if (e.target === statsModal) {
        closeStatsModal();
    }
    if (e.target === duplicatesModal) {
        closeDuplicatesModal();
    }
    if (e.target === detailedStatsModal) {
        closeDetailedStatsModal();
    }
});

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
async function createSession(user, expiresIn = 86400) {
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
                    user_agent: navigator.userAgent,
                    is_owner: user.isOwner || false
                },
                expires_in: expiresIn
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            setCookie('session_id', data.session_id, expiresIn / 86400); // Convert to days
            console.log('✅ تم إنشاء الجلسة بنجاح');
            return data.session_id;
        } else {
            console.error('❌ فشل في إنشاء الجلسة');
            return null;
        }
    } catch (error) {
        console.error('خطأ في إنشاء الجلسة:', error);
        return null;
    }
}

// تحميل الجلسة الموجودة
async function loadSession(sessionId) {
    try {
        const response = await fetch(`/api/session/${sessionId}`);
        const data = await response.json();
        
        if (data.success) {
            // Extract user info from session data
            const sessionData = data.session.session_data ? JSON.parse(data.session.session_data) : {};
            const user = {
                id: data.session.user_id,
                username: data.session.username,
                isOwner: sessionData.is_owner || false
            };
            
            console.log('✅ تم تحميل الجلسة بنجاح');
            return { success: true, session: { ...data.session, user } };
        } else {
            // الجلسة منتهية الصلاحية أو غير صالحة
            deleteCookie('session_id');
            console.log('⚠️ الجلسة منتهية الصلاحية');
            return { success: false };
        }
    } catch (error) {
        console.error('خطأ في تحميل الجلسة:', error);
        deleteCookie('session_id');
        return { success: false };
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

// تحديث الجلسة بشكل دوري
setInterval(async () => {
    const sessionId = getCookie('session_id');
    if (sessionId && currentUser) {
        try {
            await fetch(`/api/session/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_data: {
                        last_activity: new Date().toISOString(),
                        page: window.location.pathname,
                        is_owner: isOwner
                    }
                })
            });
        } catch (error) {
            console.debug('خطأ في تحديث الجلسة:', error);
        }
    }
}, 300000); // كل 5 دقائق

// Clean up when page is about to unload
window.addEventListener('beforeunload', () => {
    removeHighlight();
    recentScans = [];
}); 