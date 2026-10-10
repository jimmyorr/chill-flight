// Game entry point for index.html. Modules imported here run before the
// classic <script defer> tags in index.html.
import './sentry.js';
// Bundled font: a render-blocking Google Fonts stylesheet kept the page from
// ever painting on networks that drop packets (black screen, issue #73).
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '../logger.js';
import '../network.js';
import '../chill-flight-logic.js';
import '../art-style.js';
import '../state.js';
import '../hooks.js';
import '../constants.js';
import '../noise.js';
import '../terrain-gen.js';
import '../terrain-worker-manager.js';
import '../scene.js';
import '../sky-uniforms.js';
import '../sky.js';
import '../outline-pass.js';
import '../biplane.js';
import '../glider.js';
import '../twin.js';
import '../airplane.js';
import '../terrain-geometry.js';
import '../game-performance.js';
import '../terrain-chunks.js';
import '../far-terrain.js';
import '../audio.js';
import '../native-adapter.js';
import '../achievements.js';
import '../input-manager.js';
import '../game-audio-integration.js';
import '../weather-manager.js';
import '../game-input-bindings.js';
import '../game-state.js';
import '../game-hud.js';
import '../debug-ui.js';
import '../game.js';
import '../flight-physics.js';
import '../flight-camera.js';
import '../traffic-logic.js';
import '../traffic.js';
import '../game-gyro.js';
import '../game-ui.js';
import '../zen.js';
import '../vr-manager.js';
import '../game-loop.js';
import '../map-loader.js';
import '../minimap.js';

// Startup banner
const appVersion = window.__APP_VERSION__ || '0.0.0';
const commitHash = window.__COMMIT_HASH__ || 'unknown';
const isDirty = window.__IS_DIRTY__ ? '*' : '';
console.log(`✈️ Chill Flight v${appVersion} (${commitHash}${isDirty})`);
