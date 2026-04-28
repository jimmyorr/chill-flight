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
        return ua.includes('tv') || ua.includes('googletv') || ua.includes('atv') || ua.includes('firetv');
    }

    if (isNative()) {
        console.log("Native platform detected. Applying overrides.");

        // Performance: Cap at 1.0 device pixel ratio (Wait for renderer)
        const applyRendererFix = () => {
            if (typeof renderer !== 'undefined') {
                renderer.setPixelRatio(1.0);
            } else {
                setTimeout(applyRendererFix, 100);
            }
        };
        applyRendererFix();

        // Hide Status Bar
        if (Capacitor.Plugins && Capacitor.Plugins.StatusBar) {
            Capacitor.Plugins.StatusBar.hide().catch(() => { });
        }

        if (isTV()) {
            console.log("TV platform detected. Hiding mobile controls.");
            // Force-hide mobile controls (Permanent override) for TV
            const hideControls = () => {
                const mobileControls = document.getElementById('mobile-controls');
                if (mobileControls) mobileControls.style.display = 'none';
            };
            hideControls();
            setInterval(hideControls, 1000); // Re-assert in case of DOM changes

            const sheet = document.createElement('style');
            sheet.innerHTML = "#mobile-controls { display: none !important; } *:focus { outline: none !important; }";
            document.head.appendChild(sheet);
        }

        // Handle Hardware Back Button
        document.addEventListener("deviceready", () => {
            if (Capacitor.Plugins.App) {
                Capacitor.Plugins.App.addListener('backButton', () => {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8 }));
                });
            }
        });
    }

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
})();
