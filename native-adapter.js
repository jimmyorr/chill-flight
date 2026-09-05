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

  // Export a graphics capability detector that gracefully handles Web and Capacitor
  window.detectGraphicsPreset = async function () {
    const cores = navigator.hardwareConcurrency || 4;
    // iOS Safari blocks deviceMemory (returns undefined). We shouldn't punish it by assuming 4GB.
    const memory = navigator.deviceMemory;
    const effectiveMemory = memory || 8; // If unknown, give it the benefit of the doubt

    const isMobileFormFactor =
      window.matchMedia('(any-pointer: coarse)').matches ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    if (isNative()) {
      try {
        if (Capacitor.Plugins && Capacitor.Plugins.Device) {
          const info = await Capacitor.Plugins.Device.getInfo();

          if (info.platform === 'ios') {
            const isOlderIos =
              info.model.startsWith('iPhone9') || // iPhone 7/8/X
              info.model.startsWith('iPhone10') || // iPhone 8/X
              info.model.startsWith('iPhone11') || // iPhone XS/XR
              info.model.startsWith('iPhone12') || // iPhone 11
              (info.model.startsWith('iPad') && !info.model.includes('Pro'));

            const preset = isOlderIos ? 'low' : 'mid';
            console.log(
              `[Graphics Auto-Detect] Native iOS via Capacitor. Model: ${info.model}. Assessed as ${isOlderIos ? 'Older Device' : 'Modern Device'}. Chose preset: ${preset}`
            );
            return preset;
          }

          if (info.platform === 'android') {
            let preset = 'mid';
            if (cores <= 4 || effectiveMemory <= 4) preset = 'low';
            else if (cores >= 8 && effectiveMemory >= 8) preset = 'high';
            console.log(
              `[Graphics Auto-Detect] Native Android via Capacitor. Cores: ${cores}, RAM: ~${effectiveMemory}GB. Chose preset: ${preset}`
            );
            return preset;
          }
        }
      } catch (e) {
        console.warn(
          '[Graphics Auto-Detect] Device plugin failed. Falling back to Web APIs.'
        );
      }
    }

    // Fallback: Web Browser
    let preset = 'mid';
    const isIOSWeb = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobileFormFactor) {
      if (isIOSWeb) {
        // Apple's WebKit heavily clamps cores and memory to prevent fingerprinting.
        // A 6-core A17 Pro might literally report 2 cores and undefined RAM.
        // Because almost all iPhones are extremely powerful, 'mid' is a safe baseline.
        preset = 'mid';
        console.log(
          `[Graphics Auto-Detect] iOS Web Browser (Clamped APIs). Assumed preset: ${preset}`
        );
      } else {
        if (cores <= 4 || effectiveMemory <= 4) preset = 'low';
        else if (cores >= 8 && effectiveMemory >= 8) preset = 'mid';
        else preset = 'mid';
        console.log(
          `[Graphics Auto-Detect] Mobile Web Browser. Cores: ${cores}, RAM: ${memory ? '~' + memory + 'GB' : 'Unknown'}. Chose preset: ${preset}`
        );
      }
    } else {
      if (cores <= 4) preset = 'low';
      else if (cores >= 8 && effectiveMemory >= 8) preset = 'high';
      else preset = 'mid';
      console.log(
        `[Graphics Auto-Detect] Desktop Web Browser. Cores: ${cores}, RAM: ${memory ? '~' + memory + 'GB' : 'Unknown'}. Chose preset: ${preset}`
      );
    }
    return preset;
  };

  // 2. WEB ANALYTICS
  // Dynamically inject Google Analytics ONLY for web environments
  // This restores tracking for web players without triggering App Store privacy issues.
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
