// Firebase Configuration - قاعدة البيانات المركزية
const firebaseConfig = {
    apiKey: "AIzaSyBh8fQ7pXN-qYzWjWgJVwGc8fNnYbX2y4w",
    authDomain: "qr-scanner-central.firebaseapp.com",
    databaseURL: "https://qr-scanner-central-default-rtdb.firebaseio.com",
    projectId: "qr-scanner-central",
    storageBucket: "qr-scanner-central.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abc123def456ghi789"
};

// تهيئة Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, push, set, get, query, orderByChild, limitToLast, onValue, off } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

// قاعدة البيانات المركزية الجديدة
class CentralDatabase {
    constructor() {
        this.database = database;
        this.storage = storage;
        this.isOnline = navigator.onLine;
        this.listeners = new Map();
        
        // مراقبة حالة الاتصال
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncOfflineData();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    // حفظ مسح جديد
    async saveScan(scanData) {
        try {
            const scanId = this.generateId();
            const timestamp = new Date().toISOString();
            
            const scan = {
                id: scanId,
                barcode: scanData.code,
                codeType: scanData.codeType,
                user: scanData.user,
                timestamp: timestamp,
                telegramStatus: 'pending',
                telegramAttempts: 0,
                isDuplicate: false,
                duplicateCount: 1,
                location: 'بغداد، العراق',
                deviceInfo: this.getDeviceInfo(),
                ...scanData
            };

            // رفع الصورة للتخزين السحابي
            if (scanData.image) {
                const imageUrl = await this.uploadImage(scanData.image, scanId);
                scan.imageUrl = imageUrl;
                scan.image = null; // حذف البيانات المحلية لتوفير المساحة
            }

            // حفظ في Firebase Realtime Database
            const scansRef = ref(this.database, `scans/${scanId}`);
            await set(scansRef, scan);

            // تحديث إحصائيات المستخدم
            await this.updateUserStats(scanData.user);

            // تحديث الإحصائيات العامة
            await this.updateGlobalStats();

            console.log('✅ تم حفظ المسح في قاعدة البيانات المركزية:', scanData.code);
            return { success: true, scan, id: scanId };

        } catch (error) {
            console.error('❌ خطأ في حفظ المسح:', error);
            
            // حفظ محلي في حالة فقدان الاتصال
            this.saveOffline(scanData);
            
            return { success: false, error: error.message };
        }
    }

    // تحميل المسحات
    async loadScans(limit = 100, userId = null) {
        try {
            let scansQuery;
            
            if (userId) {
                scansQuery = query(
                    ref(this.database, 'scans'),
                    orderByChild('user'),
                    limitToLast(limit)
                );
            } else {
                scansQuery = query(
                    ref(this.database, 'scans'),
                    orderByChild('timestamp'),
                    limitToLast(limit)
                );
            }

            const snapshot = await get(scansQuery);
            const scans = [];
            
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const scan = childSnapshot.val();
                    if (!userId || scan.user === userId) {
                        scans.unshift(scan); // أحدث المسحات أولاً
                    }
                });
            }

            // تحديث معلومات التكرار
            this.updateDuplicateInfo(scans);

            return { success: true, scans };

        } catch (error) {
            console.error('❌ خطأ في تحميل المسحات:', error);
            
            // تحميل البيانات المحلية في حالة فقدان الاتصال
            return this.loadOfflineScans();
        }
    }

    // مراقبة المسحات الجديدة في الوقت الفعلي
    watchScans(callback, userId = null) {
        const scansRef = ref(this.database, 'scans');
        const listener = onValue(scansRef, (snapshot) => {
            const scans = [];
            
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const scan = childSnapshot.val();
                    if (!userId || scan.user === userId) {
                        scans.unshift(scan);
                    }
                });
            }

            this.updateDuplicateInfo(scans);
            callback(scans);
        });

        // حفظ المستمع للإلغاء لاحقاً
        const listenerId = this.generateId();
        this.listeners.set(listenerId, { ref: scansRef, listener });
        
        return listenerId;
    }

    // إيقاف مراقبة المسحات
    unwatchScans(listenerId) {
        const listenerData = this.listeners.get(listenerId);
        if (listenerData) {
            off(listenerData.ref, 'value', listenerData.listener);
            this.listeners.delete(listenerId);
        }
    }

    // رفع الصورة للتخزين السحابي
    async uploadImage(imageDataUrl, scanId) {
        try {
            // تحويل base64 إلى blob
            const response = await fetch(imageDataUrl);
            const blob = await response.blob();
            
            // رفع للتخزين السحابي
            const imageRef = storageRef(this.storage, `scan-images/${scanId}.jpg`);
            const snapshot = await uploadBytes(imageRef, blob);
            
            // الحصول على رابط التحميل
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            return downloadURL;
            
        } catch (error) {
            console.error('خطأ في رفع الصورة:', error);
            return null;
        }
    }

    // تحديث إحصائيات المستخدم
    async updateUserStats(username) {
        try {
            const userStatsRef = ref(this.database, `userStats/${username}`);
            const snapshot = await get(userStatsRef);
            
            let stats = {
                totalScans: 0,
                uniqueScans: 0,
                duplicateScans: 0,
                lastScanTime: new Date().toISOString(),
                joinDate: new Date().toISOString()
            };

            if (snapshot.exists()) {
                stats = { ...stats, ...snapshot.val() };
            }

            stats.totalScans += 1;
            stats.lastScanTime = new Date().toISOString();

            await set(userStatsRef, stats);

        } catch (error) {
            console.error('خطأ في تحديث إحصائيات المستخدم:', error);
        }
    }

    // تحديث الإحصائيات العامة
    async updateGlobalStats() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const globalStatsRef = ref(this.database, `globalStats/${today}`);
            const snapshot = await get(globalStatsRef);
            
            let stats = {
                totalScans: 0,
                uniqueUsers: new Set(),
                qrScans: 0,
                barcodeScans: 0,
                date: today
            };

            if (snapshot.exists()) {
                const existingStats = snapshot.val();
                stats = {
                    ...stats,
                    totalScans: existingStats.totalScans || 0,
                    uniqueUsers: new Set(existingStats.uniqueUsers || []),
                    qrScans: existingStats.qrScans || 0,
                    barcodeScans: existingStats.barcodeScans || 0
                };
            }

            stats.totalScans += 1;
            
            // تحويل Set إلى array للحفظ
            const statsToSave = {
                ...stats,
                uniqueUsers: Array.from(stats.uniqueUsers)
            };

            await set(globalStatsRef, statsToSave);

        } catch (error) {
            console.error('خطأ في تحديث الإحصائيات العامة:', error);
        }
    }

    // حفظ محلي في حالة فقدان الاتصال
    saveOffline(scanData) {
        try {
            let offlineScans = JSON.parse(localStorage.getItem('offline_scans') || '[]');
            offlineScans.push({
                ...scanData,
                id: this.generateId(),
                timestamp: new Date().toISOString(),
                isOffline: true
            });
            localStorage.setItem('offline_scans', JSON.stringify(offlineScans));
            
            console.log('💾 تم حفظ المسح محلياً - سيتم المزامنة عند عودة الاتصال');
        } catch (error) {
            console.error('خطأ في الحفظ المحلي:', error);
        }
    }

    // مزامنة البيانات المحلية عند عودة الاتصال
    async syncOfflineData() {
        try {
            const offlineScans = JSON.parse(localStorage.getItem('offline_scans') || '[]');
            
            if (offlineScans.length > 0) {
                console.log(`🔄 مزامنة ${offlineScans.length} مسح محلي...`);
                
                for (const scan of offlineScans) {
                    delete scan.isOffline;
                    await this.saveScan(scan);
                }
                
                localStorage.removeItem('offline_scans');
                console.log('✅ تمت المزامنة بنجاح');
            }
        } catch (error) {
            console.error('خطأ في المزامنة:', error);
        }
    }

    // تحميل البيانات المحلية
    loadOfflineScans() {
        try {
            const offlineScans = JSON.parse(localStorage.getItem('offline_scans') || '[]');
            return { success: true, scans: offlineScans, isOffline: true };
        } catch (error) {
            return { success: false, scans: [], error: error.message };
        }
    }

    // تحديث معلومات التكرار
    updateDuplicateInfo(scans) {
        const codeCounts = {};
        
        scans.forEach(scan => {
            codeCounts[scan.barcode] = (codeCounts[scan.barcode] || 0) + 1;
        });

        scans.forEach(scan => {
            const count = codeCounts[scan.barcode];
            scan.isDuplicate = count > 1;
            scan.duplicateCount = count;
        });
    }

    // الحصول على إحصائيات شاملة
    async getStatistics() {
        try {
            // إحصائيات المستخدمين
            const userStatsSnapshot = await get(ref(this.database, 'userStats'));
            const userStats = userStatsSnapshot.exists() ? userStatsSnapshot.val() : {};

            // إحصائيات عامة
            const globalStatsSnapshot = await get(ref(this.database, 'globalStats'));
            const globalStats = globalStatsSnapshot.exists() ? globalStatsSnapshot.val() : {};

            // إحصائيات المسحات
            const scansSnapshot = await get(ref(this.database, 'scans'));
            let totalScans = 0;
            let uniqueCodes = new Set();
            let duplicateCount = 0;

            if (scansSnapshot.exists()) {
                scansSnapshot.forEach(childSnapshot => {
                    const scan = childSnapshot.val();
                    totalScans++;
                    
                    if (uniqueCodes.has(scan.barcode)) {
                        duplicateCount++;
                    } else {
                        uniqueCodes.add(scan.barcode);
                    }
                });
            }

            return {
                success: true,
                stats: {
                    totalScans,
                    uniqueCodes: uniqueCodes.size,
                    duplicateScans: duplicateCount,
                    activeUsers: Object.keys(userStats).length,
                    userStats,
                    globalStats
                }
            };

        } catch (error) {
            console.error('خطأ في جلب الإحصائيات:', error);
            return { success: false, error: error.message };
        }
    }

    // معلومات الجهاز
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenSize: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: new Date().toISOString()
        };
    }

    // توليد معرف فريد
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // حالة الاتصال
    isConnected() {
        return this.isOnline;
    }

    // تنظيف الموارد
    cleanup() {
        this.listeners.forEach((listenerData, listenerId) => {
            this.unwatchScans(listenerId);
        });
        this.listeners.clear();
    }
}

// إنشاء مثيل واحد من قاعدة البيانات المركزية
window.centralDB = new CentralDatabase();

// تصدير للاستخدام في ملفات أخرى
export default window.centralDB; 