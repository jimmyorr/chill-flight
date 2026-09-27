// Shared page bootstrap: Sentry and the globals classic scripts expect.
// Import this first so it runs before any other module.
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import * as Sentry from '@sentry/browser';
import {FirebaseAnalytics} from '@capacitor-firebase/analytics';

// Initialize Sentry before other modules load so their errors are reported
Sentry.init({
  dsn: 'https://7d9671463431e10775c66852b238ad8e@o4511337089400832.ingest.us.sentry.io/4511346247532544',
  tracesSampleRate: 0.1,
  maxBreadcrumbs: 30,
});

// Expose them globally so existing scripts can still find them
window.THREE = {OrbitControls};
for (const key in THREE) {
  Object.defineProperty(window.THREE, key, {
    get: () => THREE[key],
    enumerable: true,
  });
}
window.Sentry = Sentry;
window.FirebaseAnalytics = FirebaseAnalytics;
