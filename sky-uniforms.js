// The sky shader's uniforms and cloud noise texture, in their own module so
// terrain-geometry.js (clouds reflected in the water) and the model debug
// page can share them without loading sky.js, which creates the game's
// renderer and canvas.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {moonlightUniforms, TOWER_SLICES, TOWER_THRESHOLD} from './constants.js';

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
  // The in-game day, for the anime style's horizon towers (TOWER_GLSL)
  uCloudDay: {value: 0},
  // Each slice's tower: size and three random numbers (updateTowerSlices)
  uTowers: {
    value: Array.from({length: TOWER_SLICES}, () => new THREE.Vector4()),
  },
  // Where storms bring snow rather than rain (set in game-loop.js)
  uSnowDeck: {value: 0},
  uAuroraIntensity: {value: 0.0}, // 0 = off, 1 = full intensity; driven by latitude + night
  uNoiseTex: {value: skyNoiseTexture},
  uCameraPos: {value: new THREE.Vector3()},
  uMoonDir: moonlightUniforms.uMoonDir,
  uMoonBright: moonlightUniforms.uMoonBright,
};

// The sky noise texture as the shaders sample it (noise() in CLOUD_GLSL):
// smoothstepped cell coordinates, then the GPU's bilinear filtering between
// texels, wrapping around
function skyNoise(x, y) {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  let ux = x - fx;
  let uy = y - fy;
  ux = ux * ux * (3 - 2 * ux);
  uy = uy * uy * (3 - 2 * uy);
  const texel = (i, j) =>
    _noiseData[(((j % 256) + 256) % 256) * 256 + (((i % 256) + 256) % 256)] /
    255;
  return (
    texel(fx, fy) * (1 - ux) * (1 - uy) +
    texel(fx + 1, fy) * ux * (1 - uy) +
    texel(fx, fy + 1) * (1 - ux) * uy +
    texel(fx + 1, fy + 1) * ux * uy
  );
}

// Lays out the anime style's horizon towers (TOWER_GLSL) for the current
// day, cumulus amount and cover: for each slice of the horizon, its tower's
// size (0 for none) from a slowly varying field around the compass, which
// each day reads from a different place, and three random numbers that
// place and shape its puffs. Done here once a frame rather than per pixel,
// where it cost the sky shader up to ~14 ms a frame (M1 MacBook Air, mid).
export function updateTowerSlices() {
  const day = skyUniforms.uCloudDay.value;
  const cumulus = skyUniforms.uCloudTypes.value.x;
  const start =
    TOWER_THRESHOLD - cumulus * 0.06 - skyUniforms.uCloudCover.value;
  const hash = (n) => {
    const v = Math.sin(n) * 43758.5453;
    return v - Math.floor(v);
  };
  const towers = skyUniforms.uTowers.value;
  for (let c = 0; c < TOWER_SLICES; c++) {
    const a = ((c + 0.5) / TOWER_SLICES) * Math.PI * 2 - Math.PI;
    const sx = Math.sin(a) * 2.2 + 11 + day * 7.31;
    const sy = Math.cos(a) * 2.2 + 3 + day * 3.17;
    const field = 0.65 * skyNoise(sx, sy) + 0.325 * skyNoise(sx * 2, sy * 2);
    const t = Math.min(1, Math.max(0, (field - start) / 0.14));
    const cd = c + (day % 61) * TOWER_SLICES;
    const r2 = hash(cd * 78.233);
    const amt = cumulus > 0 ? t * t * (3 - 2 * t) * (0.55 + 0.45 * r2) : 0;
    towers[c].set(amt, hash(cd * 12.9898), r2, hash(cd * 37.719));
  }
}
