// native-adapter.js
// "The Sidecar Rule": Enhances the core game for Native without touching core files.
(function () {
  console.log('Native Adapter initialized');

  // 1. NATIVE PLATFORM ONLY
  function isNative() {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  }

  if (isNative()) {
    // Hide Status Bar
    if (Capacitor.Plugins && Capacitor.Plugins.StatusBar) {
      Capacitor.Plugins.StatusBar.hide().catch(() => {});
    }
    // Handle Hardware Back Button and App State
    document.addEventListener('deviceready', () => {
      if (Capacitor.Plugins.App) {
        Capacitor.Plugins.App.addListener('backButton', () => {
          document.dispatchEvent(
            new KeyboardEvent('keydown', {key: 'Backspace', keyCode: 8})
          );
        });
        Capacitor.Plugins.App.addListener('appStateChange', (state) => {
          if (!state.isActive) {
            if (
              typeof isPaused !== 'undefined' &&
              !isPaused &&
              typeof togglePause === 'function'
            ) {
              togglePause();
            }
          }
        });
      }
    });
  }

  // Export a safe external link handler for Capacitor Apps
  window.openExternalLink = async function (url) {
    if (isNative() && Capacitor.Plugins.Browser) {
      await Capacitor.Plugins.Browser.open({url: url});
    } else {
      window.open(url, '_blank');
    }
  };

  // Graphics auto-detection: defaults to 'low' or 'mid', allowing the user
  // to manually raise to 'high' or 'ultra' in settings if desired.
  window.detectGraphicsPreset = async function () {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory;
    const isIOSWeb =
      !isNative() && /iPhone|iPad|iPod/i.test(navigator.userAgent);

    let isLow = false;
    let context = isNative() ? 'Native' : 'Web';

    if (isNative()) {
      try {
        if (Capacitor.Plugins && Capacitor.Plugins.Device) {
          const info = await Capacitor.Plugins.Device.getInfo();
          context = `Native ${info.platform || 'Device'}`;
          if (info.platform === 'ios' && info.model) {
            context += ` (${info.model})`;
            isLow =
              info.model.startsWith('iPhone9') || // iPhone 7/8/X
              info.model.startsWith('iPhone10') || // iPhone 8/X
              info.model.startsWith('iPhone11') || // iPhone XS/XR
              info.model.startsWith('iPhone12') || // iPhone 11
              (info.model.startsWith('iPad') && !info.model.includes('Pro'));
          } else {
            isLow = cores <= 4 || (memory && memory <= 4);
          }
        }
      } catch (e) {
        console.warn(
          '[Graphics Auto-Detect] Device plugin failed; falling back to hardware heuristics.'
        );
        isLow = cores <= 4 || (memory && memory <= 4);
      }
    } else if (isIOSWeb) {
      // iOS Safari clamps hardwareConcurrency to 2 for privacy; default modern iOS web to mid
      isLow = false;
      context = 'iOS Web';
    } else {
      isLow = cores <= 4 || (memory && memory <= 4);
      context =
        window.matchMedia('(any-pointer: coarse)').matches ||
        /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        )
          ? 'Mobile Web'
          : 'Desktop Web';
    }

    const preset = isLow ? 'low' : 'mid';
    console.log(
      `[Graphics Auto-Detect] ${context}. Cores: ${cores}, RAM: ${memory ? `~${memory}GB` : 'Unknown'}. Chose preset: ${preset}`
    );
    return preset;
  };

  // 2. WEB ANALYTICS
  // Dynamically inject Google Analytics for web environments.
  // Native builds use the native Firebase Analytics bridge instead.
  if (!isNative()) {
    console.log('Web environment detected. Initializing Google Analytics...');
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-N6RGBLQCZ8';
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', 'G-N6RGBLQCZ8');
  } else {
    console.log(
      'Native environment detected. Initializing Firebase Analytics...'
    );
    // Expose a compatible window.gtag wrapper that forwards calls to native FirebaseAnalytics
    window.gtag = function (command, eventName, params) {
      if (command === 'event') {
        if (window.FirebaseAnalytics) {
          window.FirebaseAnalytics.logEvent({
            name: eventName,
            params: params || {},
          }).catch((err) => {
            console.warn('⚠️ Native Analytics error logging event:', err);
          });
        }
      }
    };

    // Log app launch/init event
    setTimeout(() => {
      if (window.FirebaseAnalytics) {
        window.FirebaseAnalytics.logEvent({
          name: 'app_launch',
          params: {platform: Capacitor.getPlatform()},
        }).catch((err) => {
          console.warn('⚠️ Native Analytics error logging app launch:', err);
        });
      }
    }, 1000);
  }
})();
