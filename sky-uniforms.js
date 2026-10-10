// The sky shader's uniforms and cloud noise texture, in their own module so
// terrain-geometry.js (clouds reflected in the water) and the model debug
// page can share them without loading sky.js, which creates the game's
// renderer and canvas.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {moonlightUniforms} from './constants.js';

// --- NOISE TEXTURE GENERATOR ---
// Seeded from the world seed, so a URL (seed, cloudTime, ...) gives the same
// clouds on every load.
const _noiseSize = 256;
const _noiseData = new Uint8Array(_noiseSize * _noiseSize);
const _noiseRng = ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED);
for (let i = 0; i < _noiseData.length; i++) {
  _noiseData[i] = Math.floor(_noiseRng() * 256);
}
export const skyNoiseTexture = new THREE.DataTexture(
  _noiseData,
  _noiseSize,
  _noiseSize,
  THREE.RedFormat
);
skyNoiseTexture.wrapS = THREE.RepeatWrapping;
skyNoiseTexture.wrapT = THREE.RepeatWrapping;
skyNoiseTexture.minFilter = THREE.LinearFilter;
skyNoiseTexture.magFilter = THREE.LinearFilter;
skyNoiseTexture.needsUpdate = true;

// Initial object creation with dummy values; updateSkyPalette will populate them
export const skyUniforms = {
  topColor: {value: new THREE.Color()},
  bottomColor: {value: new THREE.Color()},
  sunDirection: {value: new THREE.Vector3(0, 1, 0)},
  offset: {value: 33},
  exponent: {value: 0.6},
  glowPower: {value: 2.0}, // Higher = more concentrated sunset
  mieFactor: {value: 0.9}, // Higher = more aggressive muting away from sun
  uTime: {value: 0.0},
  uCloudDensity: {value: 0.5},
  uCloudHeight: {
    value: ChillFlightLogic.START_CLOUD_HEIGHT
      ? ChillFlightLogic.START_CLOUD_HEIGHT
      : 3000.0,
  },
  uShowClouds: {value: true},
  // Cloud types: x puffy cumulus, y cirrus streaks, z mackerel sky. Set each
  // frame from the day's cloud mood (updateCloudMood in game-loop.js).
  uCloudTypes: {value: new THREE.Vector3(1, 0.35, 0.6)},
  uCloudCover: {value: 0},
  // The in-game day for the anime style's horizon towers (TOWER_GLSL), kept
  // small (day % 997) so the shader's noise math stays precise
  uCloudDay: {value: 0},
  // Where storms bring snow rather than rain (set in game-loop.js)
  uSnowDeck: {value: 0},
  uAuroraIntensity: {value: 0.0}, // 0 = off, 1 = full intensity; driven by latitude + night
  uNoiseTex: {value: skyNoiseTexture},
  uCameraPos: {value: new THREE.Vector3()},
  uMoonDir: moonlightUniforms.uMoonDir,
  uMoonBright: moonlightUniforms.uMoonBright,
};
