import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as Sentry from '@sentry/browser';

// Expose them globally so existing scripts can still find them
// We create a new object for THREE because ES module imports are immutable
window.THREE = { ...THREE, OrbitControls };
window.Sentry = Sentry;

// Initialize Sentry exactly as it was done in index.html
Sentry.init({
    dsn: "https://7d9671463431e10775c66852b238ad8e@o4511337089400832.ingest.us.sentry.io/4511346247532544",
    tracesSampleRate: 1.0,
});
