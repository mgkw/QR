// Global Variables
let currentUser = null;
let isOwner = false;
let isScanning = false;
let stream = null;
let lastScannedCode = null;
let lastScannedTime = 0;
let scannedResults = [];
let registeredUsers = [];

// Owner Settings
const OWNER_PASSWORD = "owner123"; // يمكن تغييرها لاحقاً

// DOM Elements
const loginSection = document.getElementById('loginSection');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const ownerLoginBtn = document.getElementById('ownerLoginBtn');
const showOwnerLogin = document.getElementById('showOwnerLogin');
const logoutBtn = document.getElementById('logoutBtn');

const loginRequired = document.getElementById('loginRequired');
const scannerSection = document.getElementById('scannerSection');
const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
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
const clearResultsBtn = document.getElementById('clearResultsBtn');
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
document.addEventListener('DOMContentLoaded', initApp);
loginBtn.addEventListener('click', handleLogin);
ownerLoginBtn.addEventListener('click', handleOwnerLogin);
showOwnerLogin.addEventListener('click', toggleOwnerLogin);
logoutBtn.addEventListener('click', handleLogout);
startScanBtn.addEventListener('click', startScanning);
stopScanBtn.addEventListener('click', stopScanning);
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
clearResultsBtn.addEventListener('click', clearAllResults);
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

// Initialize App
function initApp() {
    loadUserSession();
    loadRegisteredUsers();
    loadSettings();
    updateUI();
    loadResults();
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
    saveUserSession();
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
    saveUserSession();
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
    passwordInput.style.display = 'none';
    ownerLoginBtn.style.display = 'none';
    loginBtn.style.display = 'inline-flex';
    showOwnerLogin.innerHTML = '<i class="fas fa-user-cog"></i> أونر';
    usernameInput.placeholder = 'اسم المستخدم';
}

function saveUserSession() {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
}

function loadUserSession() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        isOwner = currentUser.isOwner || false;
    }
}

function clearUserSession() {
    localStorage.removeItem('currentUser');
}

// Registered Users Management
function loadRegisteredUsers() {
    const saved = localStorage.getItem('registeredUsers');
    if (saved) {
        registeredUsers = JSON.parse(saved);
    } else {
        // Initialize with empty array
        registeredUsers = [];
        saveRegisteredUsers();
    }
}

function saveRegisteredUsers() {
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
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

function handleAddUser() {
    if (!isOwner) {
        showAlert('هذه الميزة متاحة للأونر فقط', 'error');
        return;
    }
    
    const username = newUsername.value.trim();
    
    if (!username) {
        showAlert('يرجى إدخال اسم المستخدم', 'error');
        return;
    }
    
    // Check if user already exists
    const userExists = registeredUsers.find(user => user.username === username);
    if (userExists) {
        showAlert('المستخدم موجود بالفعل', 'error');
        return;
    }
    
    // Add new user
    const newUser = {
        username: username,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.username
    };
    
    registeredUsers.push(newUser);
    saveRegisteredUsers();
    loadUsersToModal();
    newUsername.value = '';
    
    showAlert(`تم إضافة المستخدم "${username}" بنجاح`, 'success');
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
    openDuplicatesModal();
    
    // Scroll to the specific code group after modal opens
    setTimeout(() => {
        const duplicateGroups = document.querySelectorAll('.duplicate-group');
        duplicateGroups.forEach(group => {
            const codeElement = group.querySelector('.duplicate-code');
            if (codeElement && codeElement.textContent === code) {
                group.scrollIntoView({ behavior: 'smooth', block: 'start' });
                group.style.border = '2px solid #ffc107';
                setTimeout(() => {
                    group.style.border = '1px solid #e1e8ed';
                }, 2000);
            }
        });
    }, 100);
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
    } else {
        loginSection.style.display = 'flex';
        userInfo.style.display = 'none';
        loginRequired.style.display = 'block';
        scannerSection.style.display = 'none';
        usersBtn.style.display = 'none';
        settingsBtn.style.display = 'none';
        detailedStatsBtn.style.display = 'none';
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
        
        // Request camera permission
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        video.srcObject = stream;
        cameraContainer.style.display = 'block';
        
        // Wait for video to load
        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
        });

        // Initialize dual scanning system
        await initializeDualScanning();
        
        isScanning = true;
        updateScanButtons();
        showLoading(false);
        showAlert('تم بدء المسح المتطور (QR + باركود)', 'success');

    } catch (error) {
        console.error('Camera access error:', error);
        showAlert('خطأ في الوصول للكاميرا. تأكد من منح الإذن.', 'error');
        showLoading(false);
    }
}

// Initialize dual scanning system (jsQR + QuaggaJS)
async function initializeDualScanning() {
    return new Promise((resolve, reject) => {
        // Initialize Quagga for traditional barcodes
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: video,
                constraints: {
                    width: 1280,
                    height: 720,
                    facingMode: "environment"
                }
            },
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "code_39_reader",
                    "codabar_reader",
                    "upc_reader",
                    "upc_e_reader"
                ]
            }
        }, (err) => {
            if (err) {
                console.error('Quagga initialization error:', err);
                reject(err);
                return;
            }
            
            // Start Quagga for traditional barcodes
            Quagga.start();
            
            // Handle traditional barcode detection
            Quagga.onDetected((result) => {
                handleCodeDetection(result.codeResult.code, 'باركود');
            });
            
            // Start QR Code scanning loop
            startQRScanning();
            
            resolve();
        });
    });
}

// QR Code scanning using jsQR
function startQRScanning() {
    const qrScanInterval = setInterval(() => {
        if (!isScanning) {
            clearInterval(qrScanInterval);
            return;
        }
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            scanForQRCode();
        }
    }, 250); // Scan every 250ms for QR codes
}

function scanForQRCode() {
    // Create a temporary canvas for QR scanning
    const qrCanvas = document.createElement('canvas');
    const qrContext = qrCanvas.getContext('2d');
    
    qrCanvas.width = video.videoWidth;
    qrCanvas.height = video.videoHeight;
    
    qrContext.drawImage(video, 0, 0, qrCanvas.width, qrCanvas.height);
    
    // Get image data for jsQR
    const imageData = qrContext.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
    
    try {
        // Scan for QR code
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
        });
        
        if (qrCode) {
            handleCodeDetection(qrCode.data, 'QR كود');
        }
    } catch (error) {
        // Silent fail for QR scanning errors
        console.debug('QR scan error (normal):', error);
    }
}

function stopScanning() {
    if (isScanning) {
        // Stop Quagga
        Quagga.stop();
        isScanning = false;
        
        // QR scanning will automatically stop when isScanning becomes false
    }
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    cameraContainer.style.display = 'none';
    updateScanButtons();
    showAlert('تم إيقاف المسح المتطور', 'info');
}

function updateScanButtons() {
    if (isScanning) {
        startScanBtn.style.display = 'none';
        stopScanBtn.style.display = 'inline-flex';
    } else {
        startScanBtn.style.display = 'inline-flex';
        stopScanBtn.style.display = 'none';
    }
}

// Universal Code Detection Handler (QR + Barcode)
async function handleCodeDetection(code, codeType = 'كود') {
    // Prevent duplicate scans within 2 seconds
    if (lastScannedCode === code && Date.now() - lastScannedTime < 2000) {
        return;
    }
    
    lastScannedCode = code;
    lastScannedTime = Date.now();
    
    try {
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
            lastAttemptTime: null
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
        
        // Success feedback
        playSuccessSound();
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error processing code:', error);
        showAlert(`خطأ في معالجة ${codeType}`, 'error');
        showLoading(false);
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
    // Check if this code is a duplicate
    const duplicateCount = scannedResults.filter(r => r.code === result.code).length;
    const isDuplicate = duplicateCount > 1;
    
    const resultItem = document.createElement('div');
    resultItem.className = `result-item ${isDuplicate ? 'duplicate' : ''} telegram-${result.telegramStatus || 'pending'}`;
    resultItem.setAttribute('data-result-id', result.id);
    
    const telegramStatusIndicator = getTelegramStatusIndicator(result.telegramStatus || 'pending', result.telegramAttempts || 0);
    
    resultItem.innerHTML = `
        <div class="result-content">
            <div class="result-code">
                ${isDuplicate ? `<span class="duplicate-indicator">مكرر ×${duplicateCount}</span>` : ''}
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
            ${isDuplicate ? `<button class="btn btn-warning" onclick="showDuplicatesForCode('${result.code}')">
                <i class="fas fa-search"></i> المكررات
            </button>` : ''}
        </div>
    `;
    
    resultsList.insertBefore(resultItem, resultsList.firstChild);
    
    // Update duplicate indicators for all instances of this code
    if (isDuplicate) {
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

function saveResults() {
    localStorage.setItem('scannedResults', JSON.stringify(scannedResults));
}

function loadResults() {
    const saved = localStorage.getItem('scannedResults');
    if (saved) {
        scannedResults = JSON.parse(saved);
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

function clearAllResults() {
    if (confirm('هل أنت متأكد من حذف جميع النتائج؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        scannedResults = [];
        saveResults();
        resultsList.innerHTML = '';
        showAlert('تم حذف جميع النتائج', 'success');
    }
}

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

function loadSettingsToModal() {
    const settings = getSettings();
    botToken.value = settings.botToken || '';
    chatId.value = settings.chatId || '';
    autoSend.checked = settings.autoSend || false;
}

function saveSettingsData() {
    if (!isOwner) {
        showAlert('حفظ الإعدادات متاح للأونر فقط', 'error');
        return;
    }
    
    const settings = {
        botToken: botToken.value.trim(),
        chatId: chatId.value.trim(),
        autoSend: autoSend.checked
    };
    
    localStorage.setItem('telegramSettings', JSON.stringify(settings));
    closeSettingsModal();
    showAlert('تم حفظ الإعدادات بنجاح', 'success');
}

function getSettings() {
    const saved = localStorage.getItem('telegramSettings');
    return saved ? JSON.parse(saved) : {};
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
    const settings = getSettings();
    
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
        
        formData.append('caption', `${codeIcon} **مسح ${result.codeType || 'الكود'}**

${codeIcon} **الكود المسوح:** \`${result.code}\`
🏷️ **نوع الكود:** ${result.codeType || 'غير محدد'}
👤 **المستخدم:** ${result.user}
🕐 **التاريخ والوقت:** ${formatDateTimeBaghdad(result.timestamp)}
🌍 **الموقع:** بغداد، العراق
📊 **رقم المحاولة:** ${result.telegramAttempts}

✅ تم التقاط هذه الصورة تلقائياً بواسطة نظام ${systemName}`);
        
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

function playSuccessSound() {
    // Vibration feedback if available
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
    
    // Visual feedback
    document.body.style.backgroundColor = '#28a745';
    setTimeout(() => {
        document.body.style.backgroundColor = '';
    }, 200);
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