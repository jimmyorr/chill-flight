// Game entry point for index.html. Modules imported here run before the
// classic <script defer> tags in index.html.
import './globals.js';
import '../logger.js';
import '../chill-flight-logic.js';
import '../state.js';
import '../constants.js';
import '../noise.js';
import '../terrain-worker-manager.js';
import '../scene.js';
import '../sky.js';
import '../biplane.js';
import '../glider.js';
import '../twin.js';
import '../airplane.js';
import '../terrain-geometry.js';
import '../terrain-chunks.js';
import '../audio.js';
import '../native-adapter.js';
import '../achievements.js';
import '../input-manager.js';
import '../game-audio-integration.js';
import '../weather-manager.js';

// Startup banner
const appVersion = window.__APP_VERSION__ || '0.0.0';
const commitHash = window.__COMMIT_HASH__ || 'unknown';
const isDirty = window.__IS_DIRTY__ ? '*' : '';
console.log(`✈️ Chill Flight v${appVersion} (${commitHash}${isDirty})`);
