import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import * as Sentry from '@sentry/browser';

// Import shaders as raw strings via Vite
import skyVert from './shaders/sky.vert?raw';
import skyFrag from './shaders/sky.frag?raw';
import sunMoonVert from './shaders/sunMoon.vert?raw';
import sunFrag from './shaders/sun.frag?raw';
import moonFrag from './shaders/moon.frag?raw';
import sunGlowVert from './shaders/sunGlow.vert?raw';
import sunGlowFrag from './shaders/sunGlow.frag?raw';
import rainbowVert from './shaders/rainbow.vert?raw';
import rainbowFrag from './shaders/rainbow.frag?raw';

// Expose them globally so existing scripts can still find them
// We create a new object for THREE because ES module imports are immutable
window.THREE = {...THREE, OrbitControls};
window.Sentry = Sentry;
window.SKY_SHADERS = {
  skyVert,
  skyFrag,
  sunMoonVert,
  sunFrag,
  moonFrag,
  sunGlowVert,
  sunGlowFrag,
  rainbowVert,
  rainbowFrag,
};

// Initialize Sentry exactly as it was done in index.html
Sentry.init({
  dsn: 'https://7d9671463431e10775c66852b238ad8e@o4511337089400832.ingest.us.sentry.io/4511346247532544',
  tracesSampleRate: 1.0,
});
