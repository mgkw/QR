/**
 * ماسح الباركود المتقدم - دقة عالية وسرعة فائقة
 * Advanced QR Scanner - High accuracy and ultra-fast
 */

class AdvancedQRScanner {
    constructor() {
        this.isScanning = false;
        this.scanInterval = null;
        this.lastScannedCode = null;
        this.lastScanTime = 0;
        this.duplicateDelay = 800; // تقليل وقت التكرار لسرعة أكبر
        this.scanResults = new Map();
        this.retryAttempts = 3;
        this.scanCount = 0;
        this.successCount = 0;
        
        // نظام طوابير المعالجة المتوازية
        this.processingQueue = [];
        this.sendingQueue = [];
        this.isProcessing = false;
        this.isSending = false;
        this.maxConcurrentProcessing = 3;
        this.processingWorkers = 0;
        
        // تحسينات السرعة
        this.fastProcessing = true;
        this.backgroundProcessing = true;
        this.instantSend = true;
        
        this.cameraSettings = {
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: "environment",
                frameRate: { ideal: 30 }
            }
        };
        
        this.quaggaConfig = {
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: null, // سيتم تحديده لاحقاً بعد إنشاء DOM
                constraints: this.cameraSettings.video,
                area: {
                    top: "15%",
                    right: "10%", 
                    left: "10%",
                    bottom: "15%"
                }
            },
            locator: {
                patchSize: "large", // تحسين الكشف
                halfSample: false,
                showCanvas: true,
                showPatches: true,
                showFoundPatches: true,
                showSkeleton: true,
                showLabels: true,
                showPatchLabels: true,
                showBoundingBox: true
            },
            numOfWorkers: Math.min(navigator.hardwareConcurrency || 4, 6),
            frequency: 20, // زيادة تردد المسح للسرعة القصوى
            decoder: {
                readers: [
                    'code_128_reader',
                    'ean_reader', 
                    'ean_8_reader',
                    'ean_13_reader',
                    'code_39_reader',
                    'code_39_vin_reader',
                    'codabar_reader',
                    'upc_reader',
                    'upc_e_reader',
                    'i2of5_reader',
                    '2of5_reader',
                    'code_93_reader'
                ],
                multiple: false,
                debug: false
            },
            locate: true,
            debug: false
        };
        
        // إضافة دعم الباركود المربع (QR)
        this.qrConfig = {
            inversionAttempts: "dontInvert",
            canOverwriteExisting: false
        };

        this.init();
    }

    init() {
        this.createScannerUI();
        this.bindEvents();
        this.validateScannerElements();
    }

    validateScannerElements() {
        // التحقق من العناصر المطلوبة
        const requiredElements = [
            'scanner-container',
            'start-scan',
            'stop-scan',
            'scanner-status',
            'scan-count',
            'success-count',
            'accuracy'
        ];

        const missingElements = [];
        requiredElements.forEach(elementId => {
            if (!document.getElementById(elementId)) {
                missingElements.push(elementId);
            }
        });

        if (missingElements.length > 0) {
            console.error('❌ عناصر الماسح المفقودة:', missingElements);
            throw new Error(`عناصر مفقودة من واجهة الماسح: ${missingElements.join(', ')}`);
        }

        console.log('✅ جميع عناصر الماسح المتقدم موجودة');
    }

    createScannerUI() {
        const scannerHTML = `
            <div class="advanced-scanner-container">
                <div class="scanner-header">
                    <div class="scanner-status">
                        <div class="status-indicator" id="scanner-status">
                            <i class="fas fa-qrcode"></i>
                            <span>جاهز للمسح</span>
                        </div>
                        <div class="scan-stats">
                            <span class="stat-item">
                                <i class="fas fa-eye"></i>
                                <span id="scan-count">0</span>
                            </span>
                            <span class="stat-item success">
                                <i class="fas fa-check"></i>
                                <span id="success-count">0</span>
                            </span>
                            <span class="stat-item accuracy">
                                <i class="fas fa-bullseye"></i>
                                <span id="accuracy">100%</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div class="scanner-viewport">
                    <div id="scanner-container" class="scanner-camera"></div>
                    
                    <div class="focus-frame" id="focus-frame">
                        <div class="frame-corners">
                            <div class="corner top-left"></div>
                            <div class="corner top-right"></div>
                            <div class="corner bottom-left"></div>
                            <div class="corner bottom-right"></div>
                        </div>
                        <div class="scan-line"></div>
                    </div>

                    <div class="detected-code" id="detected-code">
                        <div class="code-frame" id="code-frame">
                            <div class="code-text" id="code-text"></div>
                            <div class="code-type" id="code-type"></div>
                        </div>
                    </div>

                    <div class="scanner-guidance" id="scanner-guidance">
                        <div class="guidance-text">
                            <i class="fas fa-mobile-alt"></i>
                            <span>وجه الكاميرا نحو الباركود</span>
                        </div>
                    </div>
                </div>

                <div class="scanner-controls">
                    <button class="btn-control btn-start" id="start-scan">
                        <i class="fas fa-play"></i>
                        <span>بدء المسح</span>
                    </button>
                    <button class="btn-control btn-stop" id="stop-scan" style="display:none;">
                        <i class="fas fa-stop"></i>
                        <span>إيقاف المسح</span>
                    </button>
                    <button class="btn-control btn-torch" id="toggle-torch">
                        <i class="fas fa-flashlight"></i>
                        <span>الفلاش</span>
                    </button>
                </div>

                <div class="recent-scans" id="recent-scans">
                    <h6><i class="fas fa-history"></i> آخر النتائج</h6>
                    <div class="scans-list" id="scans-list"></div>
                </div>
            </div>

            <div class="modal fade" id="duplicateModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle text-warning"></i>
                                باركود مكرر
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="duplicate-content"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إغلاق</button>
                            <button type="button" class="btn btn-primary" id="force-send">إرسال مرة أخرى</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const targetContainer = document.getElementById('scanner-area') || document.body;
        targetContainer.innerHTML = scannerHTML;
    }

    bindEvents() {
        // ربط الأحداث مع التحقق من وجود العناصر
        const startBtn = document.getElementById('start-scan');
        const stopBtn = document.getElementById('stop-scan');
        const torchBtn = document.getElementById('toggle-torch');
        const forceSendBtn = document.getElementById('force-send');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startScanning());
        } else {
            console.error('زر بدء المسح غير موجود');
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopScanning());
        } else {
            console.error('زر إيقاف المسح غير موجود');
        }

        if (torchBtn) {
            torchBtn.addEventListener('click', () => this.toggleTorch());
        } else {
            console.error('زر الفلاش غير موجود');
        }

        if (forceSendBtn) {
            forceSendBtn.addEventListener('click', () => this.forceSendDuplicate());
        } else {
            console.error('زر الإرسال القسري غير موجود');
        }

        // ربط اختصار لوحة المفاتيح
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.isScanning ? this.stopScanning() : this.startScanning();
            }
        });
    }

    async startScanning() {
        try {
            this.updateScannerStatus('طلب أذونات الكاميرا...', 'loading');
            
            // التحقق من دعم المتصفح للوسائط
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('المتصفح لا يدعم الوصول للكاميرا');
            }
            
            document.getElementById('start-scan').style.display = 'none';
            document.getElementById('stop-scan').style.display = 'flex';
            document.getElementById('scanner-guidance').style.display = 'flex';

            // طلب أذونات الكاميرا أولاً مع timeout
            const permissionTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('انتهت مهلة طلب أذونات الكاميرا')), 10000)
            );
            
            await Promise.race([
                this.requestCameraPermission(),
                permissionTimeout
            ]);
            
            this.updateScannerStatus('تهيئة الماسح...', 'loading');

            // انتظار قصير للتأكد من تحميل DOM
            await this.delay(300);

            // التحقق من وجود عنصر الماسح قبل بدء Quagga
            const scannerContainer = document.querySelector('#scanner-container');
            if (!scannerContainer) {
                console.error('عنصر scanner-container غير موجود');
                throw new Error('عنصر scanner-container غير موجود - تأكد من تحميل واجهة الماسح');
            }

            // إعدادات مبسطة للبداية السريعة
            const simpleConfig = {
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: scannerContainer,
                    constraints: {
                        width: 640,
                        height: 480,
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
                        'code_128_reader',
                        'ean_reader', 
                        'ean_8_reader',
                        'code_39_reader'
                    ]
                },
                locate: true
            };

            // تهيئة Quagga مع timeout
            const initTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('انتهت مهلة تهيئة الماسح')), 15000)
            );

            await Promise.race([
                new Promise((resolve, reject) => {
                    Quagga.init(simpleConfig, (err) => {
                        if (err) {
                            console.error('خطأ في تشغيل الماسح:', err);
                            reject(err);
                            return;
                        }
                        console.log('✅ تم تهيئة الماسح بنجاح');
                        resolve();
                    });
                }),
                initTimeout
            ]);

            this.updateScannerStatus('بدء تشغيل الكاميرا...', 'loading');

            // بدء Quagga
            Quagga.start();
            this.isScanning = true;
            
            // انتظار قصير للتأكد من بدء التشغيل
            await this.delay(500);
            
            this.updateScannerStatus('جاري المسح...', 'scanning');

            // ربط الأحداث
            Quagga.onDetected(this.onDetected.bind(this));
            Quagga.onProcessed(this.onProcessed.bind(this));
            
            // بدء مسح QR بالتوازي بعد التأكد من عمل الماسح الرئيسي
            setTimeout(() => {
                this.startQRScanning();
            }, 1000);

            console.log('🎯 الماسح يعمل بنجاح!');

        } catch (error) {
            console.error('فشل في بدء المسح:', error);
            this.handleCameraError(error);
        }
    }

    async requestCameraPermission() {
        try {
            // محاولة الحصول على إذن الكاميرا
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment"
                }
            });
            
            // إيقاف stream فوراً حيث أن Quagga ستتولى الأمر
            stream.getTracks().forEach(track => track.stop());
            
            return true;
        } catch (error) {
            throw this.handlePermissionError(error);
        }
    }

    handlePermissionError(error) {
        let userMessage = '';
        let detailedError = '';

        switch (error.name) {
            case 'NotAllowedError':
                userMessage = 'تم رفض الوصول للكاميرا. يرجى السماح باستخدام الكاميرا وإعادة المحاولة.';
                detailedError = 'المستخدم رفض أذونات الكاميرا';
                break;
            case 'NotFoundError':
                userMessage = 'لم يتم العثور على كاميرا. تأكد من وجود كاميرا متصلة بالجهاز.';
                detailedError = 'لا توجد كاميرا متاحة';
                break;
            case 'NotReadableError':
                userMessage = 'الكاميرا قيد الاستخدام من تطبيق آخر. أغلق التطبيقات الأخرى وحاول مرة أخرى.';
                detailedError = 'الكاميرا مستخدمة من تطبيق آخر';
                break;
            case 'OverconstrainedError':
                userMessage = 'إعدادات الكاميرا غير متوافقة. سنحاول استخدام إعدادات افتراضية.';
                detailedError = 'قيود الكاميرا غير متوافقة';
                break;
            case 'SecurityError':
                userMessage = 'خطأ أمني. تأكد من استخدام HTTPS أو localhost.';
                detailedError = 'خطأ أمني في الوصول للكاميرا';
                break;
            default:
                userMessage = 'خطأ غير متوقع في الوصول للكاميرا. تحقق من إعدادات المتصفح.';
                detailedError = error.message || 'خطأ غير محدد';
        }

        return new Error(`${userMessage}\n\nتفاصيل تقنية: ${detailedError}`);
    }

    handleCameraError(error) {
        this.updateScannerStatus('خطأ في الكاميرا', 'error');
        
        // إعادة إعدادات الأزرار
        document.getElementById('start-scan').style.display = 'flex';
        document.getElementById('stop-scan').style.display = 'none';
        document.getElementById('scanner-guidance').style.display = 'none';
        
        // عرض رسالة خطأ مفصلة مع حلول
        this.showCameraErrorModal(error);
    }

    showCameraErrorModal(error) {
        const errorModal = `
            <div class="modal fade" id="cameraErrorModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle"></i>
                                مشكلة في الوصول للكاميرا
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-danger">
                                <h6><i class="fas fa-camera"></i> الخطأ:</h6>
                                <p>${error.message}</p>
                            </div>
                            
                            <div class="solutions">
                                <h6><i class="fas fa-tools"></i> الحلول المقترحة:</h6>
                                
                                <div class="solution-steps">
                                    <div class="step">
                                        <h6><i class="fas fa-1"></i> تحقق من أذونات الكاميرا</h6>
                                        <ul>
                                            <li>اضغط على أيقونة القفل/الكاميرا في شريط العنوان</li>
                                            <li>اختر "السماح" أو "Allow" للكاميرا</li>
                                            <li>أعد تحميل الصفحة</li>
                                        </ul>
                                    </div>
                                    
                                    <div class="step">
                                        <h6><i class="fas fa-2"></i> تحقق من الكاميرا</h6>
                                        <ul>
                                            <li>تأكد من أن الكاميرا متصلة وتعمل</li>
                                            <li>أغلق التطبيقات الأخرى التي قد تستخدم الكاميرا</li>
                                            <li>جرب كاميرا أخرى إن وجدت</li>
                                        </ul>
                                    </div>
                                    
                                    <div class="step">
                                        <h6><i class="fas fa-3"></i> جرب متصفح آخر</h6>
                                        <ul>
                                            <li>Google Chrome (الأفضل)</li>
                                            <li>Mozilla Firefox</li>
                                            <li>Microsoft Edge</li>
                                        </ul>
                                    </div>
                                    
                                    <div class="step">
                                        <h6><i class="fas fa-4"></i> بدائل المسح</h6>
                                        <ul>
                                            <li>استخدم ماسح باركود خارجي</li>
                                            <li>اكتب الكود يدوياً</li>
                                            <li>استخدم تطبيق هاتف محمول</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إغلاق</button>
                            <button type="button" class="btn btn-primary" onclick="location.reload()">
                                <i class="fas fa-redo"></i> إعادة تحميل الصفحة
                            </button>
                            <button type="button" class="btn btn-success" onclick="advancedScanner.tryFallbackCamera()">
                                <i class="fas fa-camera"></i> جرب إعدادات أساسية
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // إضافة النافذة إذا لم تكن موجودة
        if (!document.getElementById('cameraErrorModal')) {
            document.body.insertAdjacentHTML('beforeend', errorModal);
        }
        
        const modal = new bootstrap.Modal(document.getElementById('cameraErrorModal'));
        modal.show();
    }

    async tryFallbackCamera() {
        try {
            this.updateScannerStatus('جرب إعدادات أساسية...', 'loading');
            
            // التحقق من وجود عنصر الماسح
            const scannerContainer = document.querySelector('#scanner-container');
            if (!scannerContainer) {
                console.error('عنصر scanner-container غير موجود');
                throw new Error('واجهة الماسح غير متوفرة');
            }
            
            // إعدادات كاميرا أساسية
            this.quaggaConfig.inputStream.constraints = {
                width: { min: 640 },
                height: { min: 480 },
                facingMode: "environment"
            };
            
            // إزالة بعض القيود
            delete this.quaggaConfig.inputStream.constraints.frameRate;
            
            // تحديث target
            this.quaggaConfig.inputStream.target = scannerContainer;
            
            // إخفاء نافذة الخطأ
            const errorModal = bootstrap.Modal.getInstance(document.getElementById('cameraErrorModal'));
            if (errorModal) errorModal.hide();
            
            // محاولة جديدة مع Quagga مباشرة
            await new Promise((resolve, reject) => {
                Quagga.init(this.quaggaConfig, (err) => {
                    if (err) {
                        console.error('خطأ في الإعدادات الأساسية:', err);
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });

            Quagga.start();
            this.isScanning = true;
            this.updateScannerStatus('جاري المسح...', 'scanning');

            Quagga.onDetected(this.onDetected.bind(this));
            Quagga.onProcessed(this.onProcessed.bind(this));
            
        } catch (error) {
            console.error('فشل في الإعدادات الأساسية:', error);
            this.showManualEntryOption();
        }
    }

    showManualEntryOption() {
        const manualEntryHTML = `
            <div class="manual-entry-container">
                <div class="alert alert-info">
                    <h6><i class="fas fa-keyboard"></i> إدخال يدوي</h6>
                    <p>إذا لم تتمكن من استخدام الكاميرا، يمكنك إدخال الباركود يدوياً:</p>
                </div>
                
                <div class="manual-form">
                    <div class="mb-3">
                        <label for="manual-code" class="form-label">رقم الباركود:</label>
                        <input type="text" class="form-control" id="manual-code" placeholder="أدخل رقم الباركود هنا">
                    </div>
                    <div class="mb-3">
                        <label for="manual-type" class="form-label">نوع الباركود:</label>
                        <select class="form-select" id="manual-type">
                            <option value="manual">إدخال يدوي</option>
                            <option value="CODE_128">Code 128</option>
                            <option value="EAN_13">EAN-13</option>
                            <option value="UPC_A">UPC-A</option>
                            <option value="CODE_39">Code 39</option>
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="advancedScanner.submitManualCode()">
                        <i class="fas fa-paper-plane"></i>
                        إرسال الكود
                    </button>
                </div>
            </div>
        `;
        
        const guidanceElement = document.getElementById('scanner-guidance');
        guidanceElement.innerHTML = manualEntryHTML;
        guidanceElement.style.display = 'block';
    }

    async submitManualCode() {
        const code = document.getElementById('manual-code').value.trim();
        const type = document.getElementById('manual-type').value;
        
        if (!code) {
            this.showErrorAlert('يرجى إدخال رقم الباركود');
            return;
        }
        
        try {
            this.updateScannerStatus('جاري الإرسال...', 'processing');
            
            const success = await this.sendToServerWithRetry(code, type, null);
            
            if (success) {
                this.successCount++;
                this.showSuccessAlert('تم إرسال الكود بنجاح');
                this.addToRecentScans(code, type, 'success');
                this.updateScannerStatus('تم بنجاح', 'success');
                
                // مسح النموذج
                document.getElementById('manual-code').value = '';
            } else {
                this.showErrorAlert('فشل في إرسال الكود');
                this.updateScannerStatus('فشل الإرسال', 'error');
            }
            
            this.updateStats();
            
        } catch (error) {
            console.error('خطأ في إرسال الكود اليدوي:', error);
            this.showErrorAlert('خطأ في إرسال الكود');
            this.updateScannerStatus('خطأ في الإرسال', 'error');
        }
    }

    stopScanning() {
        if (this.isScanning) {
            Quagga.stop();
            this.isScanning = false;
            
            document.getElementById('start-scan').style.display = 'flex';
            document.getElementById('stop-scan').style.display = 'none';
            document.getElementById('scanner-guidance').style.display = 'none';
            document.getElementById('detected-code').style.display = 'none';
            
            this.updateScannerStatus('متوقف', 'stopped');
        }
    }

    onDetected(result) {
        const code = result.codeResult.code;
        const format = result.codeResult.format;
        const currentTime = Date.now();

        this.scanCount++;
        this.updateStats();

        if (this.isDuplicate(code, currentTime)) {
            this.handleDuplicate(code, format, result);
            return;
        }

        // عرض فوري للكود المكتشف
        this.displayDetectedCode(code, format, result);
        
        // إضافة للطابور للمعالجة المتوازية
        if (this.backgroundProcessing) {
            this.addToProcessingQueue({
                code,
                format,
                result,
                timestamp: currentTime,
                priority: this.getCodePriority(format)
            });
        } else {
            // معالجة تقليدية
            this.processNewCode(code, format, result);
        }
    }

    getCodePriority(format) {
        // إعطاء أولوية أعلى للباركود المربع والأنواع الحديثة
        const priorities = {
            'qr_code': 1,     // أولوية عالية للQR
            'data_matrix': 1, // أولوية عالية للData Matrix
            'aztec': 1,       // أولوية عالية للAztec
            'pdf417': 2,      // أولوية متوسطة-عالية
            'code_128': 2,    // أولوية متوسطة-عالية
            'ean_13': 3,      // أولوية متوسطة
            'ean_8': 3,       // أولوية متوسطة
            'upc_a': 3,       // أولوية متوسطة
            'upc_e': 3,       // أولوية متوسطة
            'code_39': 4,     // أولوية منخفضة-متوسطة
            'code_93': 4,     // أولوية منخفضة-متوسطة
            'codabar': 5,     // أولوية منخفضة
            'i2of5': 5,       // أولوية منخفضة
            '2of5': 5,        // أولوية منخفضة
            'default': 6      // أولوية افتراضية
        };
        
        return priorities[format.toLowerCase()] || priorities['default'];
    }

    addToProcessingQueue(scanData) {
        // إضافة للطابور مع ترتيب الأولوية
        this.processingQueue.push(scanData);
        this.processingQueue.sort((a, b) => a.priority - b.priority);
        
        // بدء المعالجة إذا لم تكن بدأت
        if (!this.isProcessing && this.processingWorkers < this.maxConcurrentProcessing) {
            this.startQueueProcessor();
        }
        
        // تحديث مؤشر الطابور
        this.updateQueueStatus();
    }

    async startQueueProcessor() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.processingWorkers++;
        
        while (this.processingQueue.length > 0) {
            const scanData = this.processingQueue.shift();
            
            try {
                await this.processQueueItem(scanData);
            } catch (error) {
                console.error('خطأ في معالجة عنصر الطابور:', error);
            }
            
            // تحديث حالة الطابور
            this.updateQueueStatus();
            
            // انتظار قصير لتجنب استنزاف الموارد
            await this.delay(25); // انتظار أقل للسرعة
        }
        
        this.isProcessing = false;
        this.processingWorkers--;
    }

    async processQueueItem(scanData) {
        const { code, format, result, timestamp } = scanData;
        
        // التقاط الصورة بسرعة
        const imageData = this.captureCodeImage(result);
        
        // معالجة فورية ومتوازية
        if (this.instantSend) {
            // إضافة للطابور للإرسال الفوري
            this.addToSendingQueue({
                code,
                format,
                imageData,
                timestamp,
                notes: `مسح فوري - ${new Date().toLocaleTimeString('ar-SA')}`
            });
        }
        
        // تحديث النتائج المحلية
        this.scanResults.set(code, {
            format,
            timestamp,
            image: imageData
        });
        
        this.lastScannedCode = code;
        this.lastScanTime = timestamp;
        
        // تحديث الإحصائيات والعرض
        this.addToRecentScans(code, format, 'processing');
        this.showSuccessFeedback();
    }

    addToSendingQueue(sendData) {
        this.sendingQueue.push(sendData);
        
        // بدء الإرسال الفوري
        if (!this.isSending) {
            this.startSendingProcessor();
        }
    }

    async startSendingProcessor() {
        if (this.isSending) return;
        
        this.isSending = true;
        
        while (this.sendingQueue.length > 0) {
            const sendData = this.sendingQueue.shift();
            
            try {
                this.updateScannerStatus(`إرسال ${sendData.code}...`, 'processing');
                
                const success = await this.sendToServerInstant(sendData);
                
                if (success) {
                    this.successCount++;
                    this.addToRecentScans(sendData.code, sendData.format, 'success');
                } else {
                    this.addToRecentScans(sendData.code, sendData.format, 'failed');
                }
                
                this.updateStats();
                
            } catch (error) {
                console.error('خطأ في إرسال فوري:', error);
                this.addToRecentScans(sendData.code, sendData.format, 'error');
            }
            
            // انتظار قصير بين الإرسالات
            await this.delay(50); // انتظار أقل للإرسال السريع
        }
        
        this.isSending = false;
        this.updateScannerStatus('جاري المسح...', 'scanning');
    }

    async sendToServerInstant(sendData) {
        const { code, format, imageData, notes } = sendData;
        
        try {
            const formData = new FormData();
            formData.append('code_data', code);
            formData.append('code_type', format);
            formData.append('notes', notes);
            formData.append('instant_send', 'true');
            
            if (imageData) {
                const blob = this.dataURLtoBlob(imageData);
                formData.append('image', blob, `instant_${Date.now()}.png`);
            }

            const response = await fetch('/api/scan', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            return result.success;
            
        } catch (error) {
            console.error('خطأ في الإرسال الفوري:', error);
            return false;
        }
    }

    updateQueueStatus() {
        const queueSize = this.processingQueue.length + this.sendingQueue.length;
        
        if (queueSize > 0) {
            this.updateScannerStatus(`معالجة ${queueSize} عنصر...`, 'processing');
        }
    }

    onProcessed(result) {
        const drawingCtx = Quagga.canvas.ctx.overlay;
        const drawingCanvas = Quagga.canvas.dom.overlay;

        if (result && result.codeResult && result.codeResult.code) {
            this.drawBoundingBox(result, drawingCtx, drawingCanvas);
        }
    }

    drawBoundingBox(result, ctx, canvas) {
        if (result.box) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, ctx, {
                color: '#00ff00',
                lineWidth: 4
            });

            const code = result.codeResult.code;
            const box = result.codeResult.start;
            
            if (box) {
                ctx.font = "bold 16px Arial";
                ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
                ctx.fillRect(box.x - 5, box.y - 30, ctx.measureText(code).width + 10, 25);
                ctx.fillStyle = "#000";
                ctx.fillText(code, box.x, box.y - 10);
            }
        }
    }

    displayDetectedCode(code, format, result) {
        const detectedDiv = document.getElementById('detected-code');
        const codeText = document.getElementById('code-text');
        const codeType = document.getElementById('code-type');
        
        codeText.textContent = code;
        codeType.textContent = format.toUpperCase();
        
        detectedDiv.style.display = 'block';
        detectedDiv.classList.add('detected');
        
        setTimeout(() => {
            detectedDiv.classList.remove('detected');
        }, 3000);
    }

    async processNewCode(code, format, result) {
        this.updateScannerStatus('جاري المعالجة...', 'processing');
        
        try {
            const imageData = this.captureCodeImage(result);
            const success = await this.sendToServerWithRetry(code, format, imageData);
            
            if (success) {
                this.successCount++;
                this.addToRecentScans(code, format, 'success');
                this.showSuccessFeedback();
                this.updateScannerStatus('تم بنجاح', 'success');
            } else {
                this.addToRecentScans(code, format, 'failed');
                this.showErrorFeedback();
                this.updateScannerStatus('فشل الإرسال', 'error');
            }
        } catch (error) {
            console.error('خطأ في معالجة الكود:', error);
            this.addToRecentScans(code, format, 'error');
            this.updateScannerStatus('خطأ في المعالجة', 'error');
        }
        
        this.updateStats();
        
        this.scanResults.set(code, {
            format,
            timestamp: Date.now(),
            image: imageData
        });
        
        this.lastScannedCode = code;
        this.lastScanTime = Date.now();
        
        setTimeout(() => {
            this.updateScannerStatus('جاري المسح...', 'scanning');
        }, 2000);
    }

    async sendToServerWithRetry(code, format, imageData) {
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const formData = new FormData();
                formData.append('code_data', code);
                formData.append('code_type', format);
                formData.append('notes', `مسح متقدم - محاولة ${attempt}`);
                
                if (imageData) {
                    const blob = this.dataURLtoBlob(imageData);
                    formData.append('image', blob, `barcode_${Date.now()}.png`);
                }

                const response = await fetch('/api/scan', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                
                if (result.success) {
                    return true;
                }
                
                if (attempt < this.retryAttempts) {
                    await this.delay(1000 * attempt);
                }
                
            } catch (error) {
                console.error(`فشل في المحاولة ${attempt}:`, error);
                
                if (attempt < this.retryAttempts) {
                    await this.delay(1000 * attempt);
                }
            }
        }
        
        return false;
    }

    isDuplicate(code, currentTime) {
        return this.lastScannedCode === code && 
               (currentTime - this.lastScanTime) < this.duplicateDelay;
    }

    handleDuplicate(code, format, result) {
        const previousScan = this.scanResults.get(code);
        const currentImage = this.captureCodeImage(result);
        
        this.showDuplicateModal(code, format, {
            previous: previousScan,
            current: {
                format,
                timestamp: Date.now(),
                image: currentImage
            }
        });
    }

    showDuplicateModal(code, format, scanData) {
        const modal = new bootstrap.Modal(document.getElementById('duplicateModal'));
        const content = document.getElementById('duplicate-content');
        
        const previousTime = new Date(scanData.previous.timestamp).toLocaleString('ar-SA');
        const currentTime = new Date(scanData.current.timestamp).toLocaleString('ar-SA');
        
        content.innerHTML = `
            <div class="duplicate-info">
                <div class="alert alert-warning">
                    <h6><i class="fas fa-exclamation-triangle"></i> تم مسح هذا الباركود مسبقاً</h6>
                    <p><strong>الكود:</strong> ${code}</p>
                    <p><strong>النوع:</strong> ${format}</p>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="scan-comparison">
                            <h6><i class="fas fa-history"></i> المسح السابق</h6>
                            <p class="text-muted">${previousTime}</p>
                            ${scanData.previous.image ? 
                                `<img src="${scanData.previous.image}" class="img-fluid scan-image" alt="المسح السابق">` :
                                '<div class="no-image">لا توجد صورة</div>'
                            }
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="scan-comparison">
                            <h6><i class="fas fa-camera"></i> المسح الحالي</h6>
                            <p class="text-muted">${currentTime}</p>
                            ${scanData.current.image ? 
                                `<img src="${scanData.current.image}" class="img-fluid scan-image" alt="المسح الحالي">` :
                                '<div class="no-image">لا توجد صورة</div>'
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.duplicateData = { code, format, scanData };
        modal.show();
    }

    async forceSendDuplicate() {
        if (this.duplicateData) {
            const { code, format, scanData } = this.duplicateData;
            
            const success = await this.sendDuplicateToServer(code, format, scanData);
            
            if (success) {
                this.showSuccessAlert('تم إرسال الباركود المكرر بنجاح');
                bootstrap.Modal.getInstance(document.getElementById('duplicateModal')).hide();
            } else {
                this.showErrorAlert('فشل في إرسال الباركود المكرر');
            }
        }
    }

    async sendDuplicateToServer(code, format, scanData) {
        try {
            const formData = new FormData();
            formData.append('code_data', code);
            formData.append('code_type', format);
            formData.append('notes', 'إرسال مكرر بواسطة المستخدم');
            formData.append('is_duplicate', 'true');
            formData.append('previous_time', scanData.previous.timestamp.toString());
            formData.append('current_time', scanData.current.timestamp.toString());
            
            if (scanData.previous.image) {
                const prevBlob = this.dataURLtoBlob(scanData.previous.image);
                formData.append('previous_image', prevBlob, `previous_${Date.now()}.png`);
            }
            
            if (scanData.current.image) {
                const currBlob = this.dataURLtoBlob(scanData.current.image);
                formData.append('current_image', currBlob, `current_${Date.now()}.png`);
            }

            const response = await fetch('/api/scan', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            return result.success;
            
        } catch (error) {
            console.error('خطأ في إرسال الباركود المكرر:', error);
            return false;
        }
    }

    captureCodeImage(result) {
        try {
            // للباركود العادي من Quagga
            const quaggaCanvas = Quagga.canvas?.dom?.image;
            if (quaggaCanvas) {
                return quaggaCanvas.toDataURL('image/png');
            }
            
            // للQR codes من النظام المخصص
            if (result && result.canvas) {
                return result.canvas.toDataURL('image/png');
            }
            
            // محاولة أخيرة من video QR
            const qrVideo = document.getElementById('qr-video');
            if (qrVideo && qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = qrVideo.videoWidth;
                canvas.height = qrVideo.videoHeight;
                ctx.drawImage(qrVideo, 0, 0);
                return canvas.toDataURL('image/png');
            }
            
        } catch (error) {
            console.error('خطأ في التقاط الصورة:', error);
        }
        return null;
    }

    dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type: mime});
    }

    updateScannerStatus(message, type) {
        const statusEl = document.getElementById('scanner-status');
        if (!statusEl) {
            console.warn('عنصر حالة الماسح غير موجود:', message);
            return;
        }
        
        try {
            const iconMap = {
                'loading': 'fa-spinner fa-spin',
                'scanning': 'fa-eye',
                'processing': 'fa-cog fa-spin',
                'success': 'fa-check',
                'error': 'fa-exclamation-triangle',
                'stopped': 'fa-stop'
            };
            
            statusEl.innerHTML = `
                <i class="fas ${iconMap[type] || 'fa-qrcode'}"></i>
                <span>${message}</span>
            `;
            
            statusEl.className = `status-indicator ${type}`;
        } catch (error) {
            console.error('خطأ في تحديث حالة الماسح:', error);
        }
    }

    updateStats() {
        try {
            const scanCountEl = document.getElementById('scan-count');
            const successCountEl = document.getElementById('success-count');
            const accuracyEl = document.getElementById('accuracy');
            
            if (scanCountEl) {
                scanCountEl.textContent = this.scanCount;
            } else {
                console.warn('عنصر عداد المسح غير موجود');
            }
            
            if (successCountEl) {
                successCountEl.textContent = this.successCount;
            } else {
                console.warn('عنصر عداد النجاح غير موجود');
            }
            
            if (accuracyEl) {
                const accuracy = this.scanCount > 0 ? 
                    Math.round((this.successCount / this.scanCount) * 100) : 100;
                accuracyEl.textContent = accuracy + '%';
            } else {
                console.warn('عنصر دقة المسح غير موجود');
            }
        } catch (error) {
            console.error('خطأ في تحديث الإحصائيات:', error);
        }
    }

    addToRecentScans(code, format, status) {
        const scansList = document.getElementById('scans-list');
        const time = new Date().toLocaleTimeString('ar-SA');
        
        const scanItem = document.createElement('div');
        scanItem.className = `scan-item ${status}`;
        scanItem.innerHTML = `
            <div class="scan-info">
                <div class="scan-code">${code}</div>
                <div class="scan-meta">
                    <span class="scan-format">${format}</span>
                    <span class="scan-time">${time}</span>
                </div>
            </div>
            <div class="scan-status">
                <i class="fas fa-${status === 'success' ? 'check' : status === 'failed' ? 'times' : 'exclamation'}"></i>
            </div>
        `;
        
        scansList.insertBefore(scanItem, scansList.firstChild);
        
        while (scansList.children.length > 5) {
            scansList.removeChild(scansList.lastChild);
        }
    }

    showSuccessFeedback() {
        if ('vibrate' in navigator) {
            navigator.vibrate(200);
        }
        this.playSound('success');
    }

    showErrorFeedback() {
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
        }
        this.playSound('error');
    }

    playSound(type) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            if (type === 'success') {
                oscillator.frequency.value = 800;
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            } else {
                oscillator.frequency.value = 300;
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            }
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.error('خطأ في تشغيل الصوت:', error);
        }
    }

    async toggleTorch() {
        try {
            const track = Quagga.CameraAccess.getActiveTrack();
            if (track && 'torch' in track.getCapabilities()) {
                const constraints = { torch: !track.getSettings().torch };
                await track.applyConstraints({ advanced: [constraints] });
                
                const torchBtn = document.getElementById('toggle-torch');
                torchBtn.classList.toggle('active');
            }
        } catch (error) {
            console.error('خطأ في تشغيل الفلاش:', error);
        }
    }

    showSuccessAlert(message) {
        this.showAlert(message, 'success');
    }

    showErrorAlert(message) {
        this.showAlert(message, 'error');
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 1060; max-width: 400px;';
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    showError(message) {
        this.showAlert(message, 'error');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // دعم مسح QR codes المربعة بالتوازي
    async startQRScanning() {
        try {
            console.log('🟡 بدء تشغيل مسح QR...');
            
            // التحقق من توفر jsQR
            if (typeof jsQR === 'undefined') {
                console.log('⚠️ مكتبة jsQR غير متوفرة');
                return;
            }
            
            // انتظار للتأكد من استقرار الماسح الرئيسي
            await this.delay(2000);
            
            // إنشاء عنصر فيديو مخفي لمسح QR
            this.createQRVideoElement();
            
            // بدء تشغيل الكاميرا للمسح المربع
            await this.initQRCamera();
            
            // بدء مسح QR متكرر
            this.startQRScanLoop();
            
            console.log('✅ مسح QR يعمل بنجاح');
            
        } catch (error) {
            console.log('⚠️ QR scanning غير متاح:', error);
        }
    }

    createQRVideoElement() {
        if (document.getElementById('qr-video')) return;
        
        const qrVideo = document.createElement('video');
        qrVideo.id = 'qr-video';
        qrVideo.style.position = 'absolute';
        qrVideo.style.top = '-9999px';
        qrVideo.style.left = '-9999px';
        qrVideo.style.width = '320px';
        qrVideo.style.height = '240px';
        qrVideo.autoplay = true;
        qrVideo.playsInline = true;
        qrVideo.muted = true;
        
        document.body.appendChild(qrVideo);
    }

    async initQRCamera() {
        try {
            this.qrVideoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
            
            const qrVideo = document.getElementById('qr-video');
            if (qrVideo) {
                qrVideo.srcObject = this.qrVideoStream;
                await qrVideo.play();
            }
            
        } catch (error) {
            console.log('فشل في تشغيل كاميرا QR:', error);
        }
    }

    startQRScanLoop() {
        this.qrScanInterval = setInterval(() => {
            this.scanForQR();
        }, 150); // مسح QR كل 150ms لسرعة أكبر
    }

    scanForQR() {
        const qrVideo = document.getElementById('qr-video');
        if (!qrVideo || qrVideo.readyState !== qrVideo.HAVE_ENOUGH_DATA) {
            return;
        }

        try {
            // إنشاء canvas لمعالجة الصورة
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = qrVideo.videoWidth;
            canvas.height = qrVideo.videoHeight;
            
            // رسم الفيديو على canvas
            ctx.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);
            
            // محاولة قراءة QR من الصورة
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // استخدام jsQR إذا كان متاح
            if (typeof jsQR !== 'undefined') {
                const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert"
                });
                
                if (qrCode && qrCode.data) {
                    this.handleQRDetection(qrCode, canvas);
                }
            } else {
                // محاولة التحليل اليدوي البسيط للباترن المربع
                this.detectQRPattern(imageData, canvas);
            }
            
        } catch (error) {
            // تجاهل الأخطاء البسيطة في مسح QR
        }
    }

    handleQRDetection(qrCode, canvas) {
        const code = qrCode.data;
        const format = 'QR_CODE';
        const currentTime = Date.now();

        // فحص التكرار
        if (this.isDuplicate(code, currentTime)) {
            return;
        }

        // إنشاء كائج نتيجة مؤقت للتوافق مع النظام
        const mockResult = {
            codeResult: {
                code: code,
                format: format
            },
            line: qrCode.location,
            canvas: canvas
        };

        // عد المسح
        this.scanCount++;
        this.updateStats();

        // عرض فوري للكود المكتشف
        this.displayDetectedCode(code, format, mockResult);
        
        // معالجة متوازية مع أولوية عالية للQR
        if (this.backgroundProcessing) {
            this.addToProcessingQueue({
                code,
                format,
                result: mockResult,
                timestamp: currentTime,
                priority: 1 // أولوية عالية للQR
            });
        } else {
            this.processNewCode(code, format, mockResult);
        }
    }

    detectQRPattern(imageData, canvas) {
        // بحث بسيط عن نمط QR (مربعات في الزوايا)
        const { width, height, data } = imageData;
        
        // البحث عن أنماط مربعة في الزوايا
        const corners = [
            { x: Math.floor(width * 0.15), y: Math.floor(height * 0.15) },
            { x: Math.floor(width * 0.85), y: Math.floor(height * 0.15) },
            { x: Math.floor(width * 0.15), y: Math.floor(height * 0.85) }
        ];

        let qrLikePattern = 0;
        
        corners.forEach(corner => {
            const brightness = this.getPixelBrightness(data, corner.x, corner.y, width);
            if (brightness < 100) { // نقطة مظلمة محتملة
                qrLikePattern++;
            }
        });

        // إذا وجدنا 2 أو أكثر من الزوايا المظلمة، قد يكون QR
        if (qrLikePattern >= 2) {
            console.log('QR pattern detected but jsQR library needed for decoding');
        }
    }

    getPixelBrightness(data, x, y, width) {
        const index = (y * width + x) * 4;
        const r = data[index] || 0;
        const g = data[index + 1] || 0;
        const b = data[index + 2] || 0;
        
        return (r + g + b) / 3;
    }

    stopScanning() {
        if (this.isScanning) {
            Quagga.stop();
            this.isScanning = false;
            
            // إيقاف مسح QR
            if (this.qrScanInterval) {
                clearInterval(this.qrScanInterval);
                this.qrScanInterval = null;
            }
            
            if (this.qrVideoStream) {
                this.qrVideoStream.getTracks().forEach(track => track.stop());
                this.qrVideoStream = null;
            }
            
            // إزالة عنصر QR video
            const qrVideo = document.getElementById('qr-video');
            if (qrVideo) {
                qrVideo.remove();
            }
            
            document.getElementById('start-scan').style.display = 'flex';
            document.getElementById('stop-scan').style.display = 'none';
            document.getElementById('scanner-guidance').style.display = 'none';
            document.getElementById('detected-code').style.display = 'none';
            
            this.updateScannerStatus('متوقف', 'stopped');
        }
    }

    destroy() {
        if (this.isScanning) {
            this.stopScanning();
        }
        
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        
        // إيقاف مسح QR
        if (this.qrScanInterval) {
            clearInterval(this.qrScanInterval);
        }
        
        if (this.qrVideoStream) {
            this.qrVideoStream.getTracks().forEach(track => track.stop());
        }
        
        Quagga.offDetected();
        Quagga.offProcessed();
    }
}

// تشغيل الماسح عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    window.advancedScanner = new AdvancedQRScanner();
});

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', function() {
    if (window.advancedScanner) {
        window.advancedScanner.destroy();
    }
}); 
