// native-adapter.js
// "The Sidecar Rule": Enhances the core game for TV/Native without touching core files.
(function () {
    console.log("TV Adapter initialized");

    // 1. GLOBAL OVERRIDES (Applies everywhere as defaults, but game.js can override)
    window.STEER_HOLD_THRESHOLD = 80; // Snappy for remotes
    window.STUTTER_BUFFER_MS = 20;     // Filter remote bounce

    // 2. NATIVE PLATFORM ONLY
    function isNative() {
        return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    }

    function isTV() {
        const ua = navigator.userAgent.toLowerCase();
        // A Native TV app client is a Capacitor app that either:
        // 1. Explicitly identifies as TV/GoogleTV/FireTV
        // 2. Or is a native app that lacks touch support and does not have "mobile" in its UA
        const isNative = typeof Capacitor !== 'undefined';
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isMobileUA = ua.includes('mobile') || ua.includes('iphone') || ua.includes('ipad');
        const hasTVKeyword = ua.includes('tv') || ua.includes('googletv') || ua.includes('firetv') || ua.includes('bravia');

        const isTVClient = isNative && (hasTVKeyword || (!hasTouch && !isMobileUA));
        
        console.log(`isTV check: Native=${isNative}, Touch=${hasTouch}, MobileUA=${isMobileUA}, TVKey=${hasTVKeyword} => Result=${isTVClient}`);
        return isTVClient;
    }

    if (isTV()) {
        console.log("TV Client 0.8.1 detected. Applying hider.");
        const style = document.createElement('style');
        style.id = 'tv-button-hider';
        style.innerHTML = `
            #mobile-controls, 
            #mobile-spd-up, 
            #mobile-spd-down, 
            #mobile-menu-trigger, 
            .mobile-btn { 
                display: none !important; 
                visibility: hidden !important; 
                pointer-events: none !important; 
                opacity: 0 !important;
            }
        `;
        document.head.appendChild(style);

        // Immediate and persistent JS enforcement
        const forceHide = () => {
            const el = document.getElementById('mobile-controls');
            if (el) el.style.setProperty('display', 'none', 'important');
        };
        forceHide();
        setInterval(forceHide, 500);
    }

    if (isNative()) {
        // Hide Status Bar
        if (Capacitor.Plugins && Capacitor.Plugins.StatusBar) {
            Capacitor.Plugins.StatusBar.hide().catch(() => { });
        }
        // Handle Hardware Back Button and App State
        document.addEventListener("deviceready", () => {
            if (Capacitor.Plugins.App) {
                Capacitor.Plugins.App.addListener('backButton', () => {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8 }));
                });
                Capacitor.Plugins.App.addListener('appStateChange', (state) => {
                    if (!state.isActive) {
                        if (typeof isPaused !== 'undefined' && !isPaused && typeof togglePause === 'function') {
                            togglePause();
                        }
                    }
                });
            }
        });
    }

    // Export a safe external link handler for Capacitor Apps
    window.openExternalLink = async function(url) {
        if (isNative() && Capacitor.Plugins.Browser) {
            await Capacitor.Plugins.Browser.open({ url: url });
        } else {
            window.open(url, '_blank');
        }
    };

    // 3. KEY MAPPING (Applies everywhere, helpful for keyboard/remote)
    window.addEventListener('keydown', (e) => {
        // D-pad center (23) or Enter Key (13/66) or 'Select'
        if (e.keyCode === 23 || e.keyCode === 66 || e.key === 'Select') {
            // Mapping these to 'Enter' for the core game logic
            if (e.key !== 'Enter') {
                e.preventDefault();
                window.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
                }));
            }
        }

        // Back button mapping
        if (e.keyCode === 4 || e.key === 'GoBack') {
            e.preventDefault();
            window.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Backspace', code: 'Backspace', keyCode: 8, bubbles: true
            }));
        }
    }, true);

    // 4. WEB ANALYTICS
    // Dynamically inject Google Analytics ONLY for web environments
    // This restores tracking for web players without triggering App Store privacy issues.
    if (!isNative()) {
        console.log("Web environment detected. Initializing Google Analytics...");
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-6RNVL7JZVJ';
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', 'G-6RNVL7JZVJ');
    }
})();
