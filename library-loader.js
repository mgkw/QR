// Library Loader with Fallback System
console.log('📚 Library Loader Starting...');

// Fallback URLs
const libraryFallbacks = {
    jsqr: [
        'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js',
        'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
    ],
    quagga: [
        'https://unpkg.com/quagga@0.12.1/dist/quagga.min.js',
        'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js'
    ]
};

let librariesLoaded = {
    jsqr: false,
    quagga: false
};

// Load library with fallback
function loadLibraryWithFallback(libName, urls, index = 0) {
    if (index >= urls.length) {
        console.error(`❌ Failed to load ${libName} from all sources`);
        return;
    }

    const script = document.createElement('script');
    script.src = urls[index];
    
    script.onload = function() {
        console.log(`✅ ${libName} loaded from: ${urls[index]}`);
        librariesLoaded[libName] = true;
        checkAllLibrariesLoaded();
    };
    
    script.onerror = function() {
        console.warn(`⚠️ Failed to load ${libName} from: ${urls[index]}`);
        if (index < urls.length - 1) {
            console.log(`🔄 Trying fallback for ${libName}...`);
            loadLibraryWithFallback(libName, urls, index + 1);
        } else {
            console.error(`❌ All fallbacks failed for ${libName}`);
            checkAllLibrariesLoaded();
        }
    };
    
    document.head.appendChild(script);
}

// Check if all libraries are loaded and initialize app
function checkAllLibrariesLoaded() {
    const jsQRLoaded = typeof jsQR !== 'undefined';
    const quaggaLoaded = typeof Quagga !== 'undefined';
    
    // Update status
    librariesLoaded.jsqr = jsQRLoaded;
    librariesLoaded.quagga = quaggaLoaded;
    
    console.log('📊 Library Status:');
    console.log('jsQR:', jsQRLoaded ? '✅' : '❌');
    console.log('Quagga:', quaggaLoaded ? '✅' : '❌');
    
    // Load main script if at least one library is loaded or timeout reached
    if (jsQRLoaded || quaggaLoaded || window.libraryLoadTimeout) {
        loadMainScript();
    }
}

// Load main script
function loadMainScript() {
    if (window.mainScriptLoaded) return;
    
    console.log('🚀 Loading main script...');
    window.mainScriptLoaded = true;
    
    const script = document.createElement('script');
    script.src = 'script.js';
    script.defer = true;
    document.head.appendChild(script);
}

// Initialize library loading
function initializeLibraryLoading() {
    console.log('🔄 Starting library loading...');
    
    // Set timeout for library loading
    setTimeout(() => {
        if (!window.mainScriptLoaded) {
            console.warn('⏰ Library loading timeout reached, proceeding anyway...');
            window.libraryLoadTimeout = true;
            checkAllLibrariesLoaded();
        }
    }, 5000);
    
    // Load libraries with fallbacks
    loadLibraryWithFallback('jsqr', libraryFallbacks.jsqr);
    loadLibraryWithFallback('quagga', libraryFallbacks.quagga);
}

// Start loading when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeLibraryLoading, 100);
    });
} else {
    setTimeout(initializeLibraryLoading, 100);
} 