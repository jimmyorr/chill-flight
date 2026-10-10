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
  // The towers' skyline: top and slope around the horizon (updateTowerSlices)
  uTowerProfile: {value: null},
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
// The towers' outline texture: TOWER_PROFILE_PER_SLICE samples a slice
// around the horizon, top, its slope, bottom and its slope as half floats
// (linearly filtered)
const TOWER_PROFILE_PER_SLICE = 64;
const _towerProfileWidth = TOWER_SLICES * TOWER_PROFILE_PER_SLICE;
const _towerTop = new Float32Array(_towerProfileWidth);
const _towerBottom = new Float32Array(_towerProfileWidth);
const _towerProfileData = new Uint16Array(_towerProfileWidth * 4);
const _towerProfile = new THREE.DataTexture(
  _towerProfileData,
  _towerProfileWidth,
  1,
  THREE.RGBAFormat,
  THREE.HalfFloatType
);
_towerProfile.wrapS = THREE.RepeatWrapping;
_towerProfile.minFilter = THREE.LinearFilter;
_towerProfile.magFilter = THREE.LinearFilter;
_towerProfile.needsUpdate = true;
skyUniforms.uTowerProfile.value = _towerProfile;
// Each slice's tower: size (0: none) and three random numbers
const _towers = Array.from({length: TOWER_SLICES}, () => new THREE.Vector4());
let _towerKey = '';
// The towers' puffs, matching the shapes the sky used to test per pixel
const TOWER_SCALE = 1.1;

export function updateTowerSlices() {
  const day = skyUniforms.uCloudDay.value;
  const cumulus = skyUniforms.uCloudTypes.value.x;
  const start =
    TOWER_THRESHOLD - cumulus * 0.06 - skyUniforms.uCloudCover.value;
  const hash = (n) => {
    const v = Math.sin(n) * 43758.5453;
    return v - Math.floor(v);
  };
  const towers = _towers;
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
  // Redraw the skyline only when the towers change (the cloud mix eases
  // slowly, so most frames they don't)
  const key = towers.map((t) => t.x.toFixed(4)).join(',') + day;
  if (key === _towerKey) return;
  _towerKey = key;
  // Each sample spans from the lowest bottom to the highest top of the
  // shapes over it (none: both very low, so empty)
  _towerTop.fill(-10);
  _towerBottom.fill(10);
  const cover = (x, bottom, top) => {
    const i =
      ((x % _towerProfileWidth) + _towerProfileWidth) % _towerProfileWidth;
    if (top > _towerTop[i]) _towerTop[i] = top;
    if (bottom < _towerBottom[i]) _towerBottom[i] = bottom;
  };
  for (let c = 0; c < TOWER_SLICES; c++) {
    const [amt, r1, r2, r3] = towers[c].toArray();
    if (amt <= 0) continue;
    // The puffs, in slices: a base puff, one on top and one bulging to the
    // side, over a column down to the horizon
    const cx = c + 0.5 + (r1 - 0.5) * 0.7;
    const rad1 = (0.55 + 0.6 * r2) * amt * TOWER_SCALE;
    const cy1 = rad1 * 0.15;
    const puffs = [
      [cx, cy1, rad1],
      [cx + (r3 - 0.5) * rad1 * 0.6, cy1 + rad1 * 0.9, rad1 * (0.5 + 0.3 * r3)],
      [cx + (r1 < 0.5 ? -0.75 : 0.75) * rad1, cy1 + rad1 * 0.45, rad1 * 0.55],
    ];
    for (const [px, py, r] of puffs) {
      const first = Math.ceil((px - r) * TOWER_PROFILE_PER_SLICE);
      const last = Math.floor((px + r) * TOWER_PROFILE_PER_SLICE);
      for (let i = first; i <= last; i++) {
        const dx = i / TOWER_PROFILE_PER_SLICE - px;
        const half = Math.sqrt(Math.max(0, r * r - dx * dx));
        cover(i, py - half, py + half);
      }
    }
    const colFirst = Math.ceil((cx - rad1 * 0.92) * TOWER_PROFILE_PER_SLICE);
    const colLast = Math.floor((cx + rad1 * 0.92) * TOWER_PROFILE_PER_SLICE);
    for (let i = colFirst; i <= colLast; i++) cover(i, -10, cy1);
  }
  const toHalf = THREE.DataUtils.toHalfFloat;
  // An edge's slope in slices per slice; capped where it steps from no
  // tower straight up a puff's side
  const slopeAt = (edge, i) => {
    const prev = edge[(i + _towerProfileWidth - 1) % _towerProfileWidth];
    const next = edge[(i + 1) % _towerProfileWidth];
    return Math.max(
      -20,
      Math.min(20, ((next - prev) * TOWER_PROFILE_PER_SLICE) / 2)
    );
  };
  for (let i = 0; i < _towerProfileWidth; i++) {
    // Empty samples: a bottom below the top, so the span stays empty
    if (_towerBottom[i] > _towerTop[i]) _towerBottom[i] = -10;
    _towerProfileData[i * 4] = toHalf(_towerTop[i]);
    _towerProfileData[i * 4 + 1] = toHalf(slopeAt(_towerTop, i));
    _towerProfileData[i * 4 + 2] = toHalf(_towerBottom[i]);
    _towerProfileData[i * 4 + 3] = toHalf(slopeAt(_towerBottom, i));
  }
  _towerProfile.needsUpdate = true;
}
