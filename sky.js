// --- CAMERA, RENDERER, LIGHTS, SKY ---
// The scene itself lives in scene.js. timeOfDay and daySpeedMultiplier live
// in state.js (other files write them).

import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {log} from './logger.js';
import {ART_POST} from './art-style.js';
import {
  CLOUD_GLSL,
  moonlightUniforms,
  SKY_COLOR_GLSL,
  TOWER_GLSL,
} from './constants.js';
import {scene} from './scene.js';
import skyVertexShader from './src/shaders/sky.vert.glsl?raw';
import skyFragmentShader from './src/shaders/sky.frag.glsl?raw';
import sunMoonVertShader from './src/shaders/sunMoon.vert.glsl?raw';
import moonFragShader from './src/shaders/moon.frag.glsl?raw';
import rainbowVertShader from './src/shaders/rainbow.vert.glsl?raw';
import rainbowFragShader from './src/shaders/rainbow.frag.glsl?raw';
import moonMapUrl from './assets/moon-lroc-512.jpg';
import {state} from './state.js';
import {skyNoiseTexture, skyUniforms} from './sky-uniforms.js';
import {t} from './i18n.js';

export {skyUniforms};

// --- SKY SHADER MATERIAL ---

// --- DYNAMIC ATMOSPHERE PALETTE GENERATOR ---
// Replaces the static ATMOSPHERE_PALETTES array

// Curated horizon colors (derived from preset palettes) grouped by complementary zenith hues
const CURATED_HORIZONS = {
  cyan: [
    {name: 'Coral', color: 0xff7e67}, // Soft, vibrant pinkish-orange
    {name: 'Peach', color: 0xffb08a}, // Light, warm pastel orange
    {name: 'Rose', color: 0xffa3af}, // Delicate, cool-toned sunset pink
  ],
  blue: [
    {name: 'Sunset', color: 0xff8260}, // Warm, natural sunset pink-orange
    {name: 'Mango', color: 0xffb347}, // Bright, clean golden yellow-orange
    {name: 'Cowneck', color: 0xff9542}, // Bold, fiery saturated orange
  ],
  purple: [
    {name: 'Tropical', color: 0xe27a5e}, // Warm, earthy terracotta sunrise
    {name: 'Lavender', color: 0xe2b6cf}, // Soft, dreamy pastel purple-pink
  ],
};

function generateDynamicPalette(rng) {
  // Helper to get random value between min and max using the seeded RNG
  const rand = (min, max) => min + rng() * (max - min);

  // --- ZENITH (Top Color) ---
  // Darker, deeper tones. We bias towards blues, purples, and deep slates.
  // HSL Hue in Three.js is 0.0 to 1.0 (0=Red, 0.33=Green, 0.66=Blue, 1.0=Red)
  // 0.5 to 0.85 covers Cyan -> Blue -> Purple -> Deep Pink
  const topHue = rand(0.5, 0.85);

  // Pick Top Names and matching horizon category based on Top Hue
  let tNames;
  let horizonCategory;
  if (topHue < 0.6) {
    // Cyan/Teal
    tNames = ['Stormy', 'Deep', 'Slate'];
    horizonCategory = 'cyan';
  } else if (topHue < 0.75) {
    // Core Blue
    tNames = ['Midnight', 'Abyssal', 'Deep', 'Abyss'];
    horizonCategory = 'blue';
  } else {
    // Purple/Indigo
    tNames = ['Twilight', 'Cosmic', 'Velvet', 'Starry'];
    horizonCategory = 'purple';
  }

  const topSat = rand(0.3, 0.7); // Medium saturation so it isn't blindingly neon
  const topLight = rand(0.1, 0.35); // Keep it dark and moody

  const topColor = new THREE.Color().setHSL(topHue, topSat, topLight);

  // --- HORIZON (Bottom Color) ---
  // We use our curated presets to guarantee vibrant, beautiful sunsets
  const horizons = CURATED_HORIZONS[horizonCategory];
  const selectedHorizon = horizons[Math.floor(rng() * horizons.length)];
  const bottomColor = selectedHorizon.color;
  const bName = selectedHorizon.name;

  // --- DAY BLUE (Day Sky Base Color) ---
  // Harmonize day hue with the zenith hue / horizon category within natural sky-blue tones:
  // cyan: fresh cerulean / alpine cyan (0.545 - 0.570)
  // blue: vibrant azure / classic sky blue (0.570 - 0.595)
  // purple: rich cobalt / cornflower blue (0.595 - 0.612) - strictly blue, avoiding violet/purple
  let dayHue;
  if (horizonCategory === 'cyan') {
    dayHue = rand(0.545, 0.57);
  } else if (horizonCategory === 'blue') {
    dayHue = rand(0.57, 0.595);
  } else {
    dayHue = rand(0.595, 0.612);
  }

  const daySat = rand(0.7, 0.85);
  const dayLight = rand(0.6, 0.68);
  const dayColor = new THREE.Color().setHSL(dayHue, daySat, dayLight);

  // Use the RNG again to pick names from the narrowed categories
  const tName = tNames[Math.floor(rng() * tNames.length)];

  return {
    name: `${tName} ${bName}`,
    top: topColor.getHex(),
    bottom: bottomColor,
    day: dayColor.getHex(),
  };
}

// Standard parameters are handled by ChillFlightLogic
export let selectedPalette;
// Daytime sky color; final value is set once the initial palette is chosen.
export const _daySky = new THREE.Color(0x4ca1f0);
let currentPaletteCycle = -1;
export let isCustomPalette = false;
export let currentPaletteSeed;

export function applyCustomSkyColors(top, bottom, day) {
  isCustomPalette = true;

  // Convert hex string (from picker) or number to hex if needed
  const topHex =
    typeof top === 'string' ? parseInt(top.replace('#', ''), 16) : top;
  const bottomHex =
    typeof bottom === 'string' ? parseInt(bottom.replace('#', ''), 16) : bottom;

  selectedPalette = {
    name: 'Custom',
    top: topHex,
    bottom: bottomHex,
  };
  if (day !== undefined && day !== null) {
    const dayHex =
      typeof day === 'string' ? parseInt(day.replace('#', ''), 16) : day;
    if (!isNaN(dayHex)) {
      selectedPalette.day = dayHex;
      _daySky.setHex(dayHex);
    }
  }

  skyUniforms.topColor.value.setHex(selectedPalette.top);
  skyUniforms.bottomColor.value.setHex(selectedPalette.bottom);

  window.dispatchEvent(
    new CustomEvent('paletteChanged', {detail: selectedPalette})
  );
}

export function nextSkyPalette() {
  if (currentPaletteSeed === undefined) {
    const CYCLE_DURATION_MS = 300000;
    const clockNow =
      state.worldClockNow || ChillFlightLogic.START_CLOCK || Date.now();
    const cycleNumber = Math.floor(clockNow / CYCLE_DURATION_MS);
    currentPaletteSeed = ChillFlightLogic.WORLD_SEED + cycleNumber;
  }
  currentPaletteSeed++;
  isCustomPalette = false;

  const rng = ChillFlightLogic.mulberry32(currentPaletteSeed);
  selectedPalette = generateDynamicPalette(rng);
  selectedPalette.seed = currentPaletteSeed;

  skyUniforms.topColor.value.setHex(selectedPalette.top);
  skyUniforms.bottomColor.value.setHex(selectedPalette.bottom);

  window.dispatchEvent(
    new CustomEvent('paletteChanged', {detail: selectedPalette})
  );
}

export function updateSkyPalette(clockNow) {
  if (isCustomPalette) return;
  // If the user has a manually chosen palette seed (via URL or next preset button), keep it locked
  if (currentPaletteSeed !== undefined && selectedPalette) return;

  const CYCLE_DURATION_MS = 300000;
  const cycleNumber = Math.floor(clockNow / CYCLE_DURATION_MS);

  if (cycleNumber !== currentPaletteCycle) {
    const isFirstLoad = currentPaletteCycle === -1;
    currentPaletteCycle = cycleNumber;

    if (isFirstLoad) {
      if (ChillFlightLogic.PALETTE_INDEX !== null) {
        const rawPalette = String(ChillFlightLogic.PALETTE_INDEX).trim();
        if (rawPalette.includes(',')) {
          const parts = rawPalette.split(',');
          const topHex = parseInt(parts[0].replace('#', ''), 16);
          const bottomHex = parseInt(parts[1].replace('#', ''), 16);
          let dayHex = null;
          if (parts[2]) {
            const parsed = parseInt(parts[2].replace('#', ''), 16);
            if (!isNaN(parsed)) dayHex = parsed;
          } else if (ChillFlightLogic.DAY_COLOR) {
            const parsed = parseInt(
              ChillFlightLogic.DAY_COLOR.replace('#', ''),
              16
            );
            if (!isNaN(parsed)) dayHex = parsed;
          }
          if (!isNaN(topHex) && !isNaN(bottomHex)) {
            applyCustomSkyColors(topHex, bottomHex, dayHex);
            return;
          }
        } else if (!isNaN(parseInt(rawPalette, 10))) {
          currentPaletteSeed = parseInt(rawPalette, 10);
        }
      } else if (
        ChillFlightLogic.ZENITH_COLOR &&
        ChillFlightLogic.HORIZON_COLOR
      ) {
        const topHex = parseInt(
          ChillFlightLogic.ZENITH_COLOR.replace('#', ''),
          16
        );
        const bottomHex = parseInt(
          ChillFlightLogic.HORIZON_COLOR.replace('#', ''),
          16
        );
        let dayHex = null;
        if (ChillFlightLogic.DAY_COLOR) {
          const parsed = parseInt(
            ChillFlightLogic.DAY_COLOR.replace('#', ''),
            16
          );
          if (!isNaN(parsed)) dayHex = parsed;
        }
        if (!isNaN(topHex) && !isNaN(bottomHex)) {
          applyCustomSkyColors(topHex, bottomHex, dayHex);
          return;
        }
      }
    }

    if (currentPaletteSeed === undefined) {
      currentPaletteSeed = ChillFlightLogic.WORLD_SEED + cycleNumber;
    }

    // Generate the colors!
    const rng = ChillFlightLogic.mulberry32(currentPaletteSeed);
    selectedPalette = generateDynamicPalette(rng);
    selectedPalette.seed = currentPaletteSeed;

    log.info(
      `Atmosphere Palette Updated (Cycle ${cycleNumber}, Seed ${currentPaletteSeed}): ${selectedPalette.name}`
    );

    // If uniforms already exist, update them

    skyUniforms.topColor.value.setHex(selectedPalette.top);
    skyUniforms.bottomColor.value.setHex(selectedPalette.bottom);

    // Dispatch an event so game.js can recalculate derived gradient colors
    window.dispatchEvent(
      new CustomEvent('paletteChanged', {detail: selectedPalette})
    );
  }
}

// Initial calculation: the palette follows the world clock (?clock= when
// given), then stays for the visit
updateSkyPalette(ChillFlightLogic.START_CLOCK ?? Date.now());

const skyMat = new THREE.ShaderMaterial({
  vertexShader: skyVertexShader,
  fragmentShader: SKY_COLOR_GLSL + CLOUD_GLSL + TOWER_GLSL + skyFragmentShader,
  uniforms: skyUniforms,
  side: THREE.BackSide,
  depthWrite: false, // Don't block stars/celestials
  fog: false,
});

scene.fog.color.set(selectedPalette.bottom);

export const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  1,
  30000
);

// Antialiasing is expensive; disable it on the 'Low' preset (SEGMENTS <= 20) to prioritize performance.
// Since AA belongs to the WebGL context, this won't change until the next page load.
const _initPreset =
  ChillFlightLogic.GRAPHICS_PRESET ||
  localStorage.getItem('chill_flight_graphics_preset');
const _legacyQuality = localStorage.getItem('chill_flight_quality');
const _isLowQuality =
  _initPreset === 'low' ||
  (!_initPreset && _legacyQuality && parseInt(_legacyQuality) <= 20);

// Update uniforms for initial load
skyUniforms.uShowClouds.value = ChillFlightLogic.SHOW_CLOUDS && !_isLowQuality;

function showWebGLErrorNotice() {
  const container = document.getElementById('splash-interactive-area');
  if (!container) return;

  const progress = document.getElementById('splash-progress-container');
  if (progress) progress.style.display = 'none';

  const btnContainer = document.getElementById('splash-btn-container');
  if (btnContainer) btnContainer.style.display = 'none';

  const errorEl = document.createElement('div');
  errorEl.id = 'webgl-error-notice';
  errorEl.setAttribute('role', 'alert');
  errorEl.style.cssText =
    'display: flex; flex-direction: column; align-items: center; justify-content: center; max-width: 320px; margin: 0 auto; padding: 16px; text-align: center; color: #ffffff;';

  const titleEl = document.createElement('div');
  titleEl.style.cssText =
    'font-size: 14px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; color: #ff6b6b; font-family: Inter, -apple-system, sans-serif;';
  titleEl.textContent = t('WebGL 2 not supported');

  const msgEl = document.createElement('div');
  msgEl.style.cssText =
    'font-size: 12px; line-height: 18px; color: rgba(255, 255, 255, 0.8); font-family: Inter, -apple-system, sans-serif; margin-bottom: 16px;';
  msgEl.textContent = t(
    'Chill Flight requires WebGL 2, which is unavailable or disabled in your browser. Please try enabling hardware acceleration or updating your browser.'
  );

  const reloadBtn = document.createElement('button');
  reloadBtn.className = 'btn';
  reloadBtn.style.cssText = 'font-size: 12px; padding: 8px 18px;';
  reloadBtn.textContent = t('Reload');
  reloadBtn.onclick = () => window.location.reload();

  errorEl.appendChild(titleEl);
  errorEl.appendChild(msgEl);
  errorEl.appendChild(reloadBtn);
  container.appendChild(errorEl);
}

function initRenderer() {
  let r = null;
  const opts = {
    antialias: !_isLowQuality,
    alpha: false,
    powerPreference: 'high-performance',
  };
  try {
    r = new THREE.WebGLRenderer(opts);
  } catch (err) {
    if (!_isLowQuality) {
      try {
        r = new THREE.WebGLRenderer({
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
        });
      } catch {
        // Fallback also failed
      }
    }
    if (!r) {
      log.warn('WebGL 2 context creation failed:', err);
    }
  }
  return r;
}

export const renderer = initRenderer();
if (renderer) {
  // This project was tuned against the three.js r128 rendering pipeline. r152+
  // enables color management and sRGB output by default; restore the legacy
  // behavior so the established art direction is preserved.
  THREE.ColorManagement.enabled = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(
    _isLowQuality ? 1 : Math.min(window.devicePixelRatio, 2)
  );
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  if (renderer.xr) {
    renderer.xr.enabled = true;
    if (typeof renderer.xr.setReferenceSpaceType === 'function') {
      renderer.xr.setReferenceSpaceType('local');
    }
  }
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    log.warn('WebGL context lost');
  });
  document.body.appendChild(renderer.domElement);
} else {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showWebGLErrorNotice);
  } else {
    showWebGLErrorNotice();
  }
}

// Lights
export const hemiLight = new THREE.HemisphereLight(
  0xffffff,
  0x444444,
  0.6 * Math.PI
);
hemiLight.position.set(0, 500, 0);
scene.add(hemiLight);

export const dirLight = new THREE.DirectionalLight(0xfff0dd, 0.8 * Math.PI);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 10;
dirLight.shadow.camera.far = 8000; // Increased so distant shadows aren't clipped
dirLight.shadow.camera.left = -2048; // Massively expanded coverage
dirLight.shadow.camera.right = 2048;
dirLight.shadow.camera.top = 2048;
dirLight.shadow.camera.bottom = -2048;
dirLight.shadow.bias = -0.0007;
dirLight.shadow.normalBias = 2.0;
scene.add(dirLight);
scene.add(dirLight.target);

// Fade directional shadows out near the edge of the shadow map, so shadows
// grow in gradually as terrain enters it instead of popping into existence.
// Patches three.js's directional getShadow() (point light shadows untouched).
{
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  const split = chunk.indexOf('float getPointShadow');
  const head = split < 0 ? chunk : chunk.slice(0, split);
  const tail = split < 0 ? '' : chunk.slice(split);
  const faded = head.replaceAll(
    'return mix( 1.0, shadow, shadowIntensity );',
    `vec2 shadowEdge = abs( shadowCoord.xy * 2.0 - 1.0 );
			float shadowFade = 1.0 - smoothstep( 0.8, 1.0, max( shadowEdge.x, shadowEdge.y ) );
			return mix( 1.0, shadow, shadowIntensity * shadowFade );`
  );
  if (faded === head) {
    log.warn('Shadow edge fade not applied: three.js shadow shader changed');
  }
  THREE.ShaderChunk.shadowmap_pars_fragment = faded + tail;
}

export const moonLight = new THREE.DirectionalLight(0xbad2ff, 0.3 * Math.PI); // Cool moonlight
scene.add(moonLight);

// --- DAY / NIGHT CYCLE SETUP ---
export const BASE_DAY_SPEED = 0.02;

// Sky Objects Group (follows player, hosts celestial bodies)
export const skyGroup = new THREE.Group();
scene.add(skyGroup);

// Skysphere (Backdrop)
const skySphereGeo = new THREE.SphereGeometry(25000, 32, 12);
const skySphereMesh = new THREE.Mesh(skySphereGeo, skyMat);
skyGroup.add(skySphereMesh);

// --- CELESTIAL SHADERS ---

export const sunUniforms = {
  uTime: {value: 0.0},
  overcast: {value: 0.0},
  dayFactor: {value: 1.0},
  uSunColor: {value: new THREE.Color(0xffffff)},
  uNoiseTex: {value: skyNoiseTexture},
};

export const moonUniforms = {
  uTime: {value: 0.0},
  overcast: {value: 0.0},
  dayFactor: {value: 1.0},
  uSunDirectionWorld: {value: new THREE.Vector3(1, 0, 0)},
  uMoonRotMat: {value: new THREE.Matrix3()},
  uNoiseTex: {value: skyNoiseTexture},
  uCloudDensity: {value: 0.5},
  uMoonSkyDir: {value: new THREE.Vector3(0, 0.2, -1)},
  uCameraPos: {value: new THREE.Vector3()},
  // For hiding behind the anime style's horizon towers (TOWER_GLSL)
  uShowClouds: skyUniforms.uShowClouds,
  offset: skyUniforms.offset,
  uSkyTime: skyUniforms.uTime,
  uTowerProfile: skyUniforms.uTowerProfile,
  uTowerHorizon: skyUniforms.uTowerHorizon,
  // The real near side (NASA's LRO albedo map, public domain; via the
  // Nightscape demo), once loaded: until then the moon is procedural
  uMoonMap: {value: null},
  uHasMoonMap: {value: 0},
};
// Bundled with the game, so it never waits on the network
new THREE.TextureLoader().load(moonMapUrl, (tex) => {
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  moonUniforms.uMoonMap.value = tex;
  moonUniforms.uHasMoonMap.value = 1;
});

// Note: The physical sun mesh and glow plane geometries/materials have been removed
// because the sky relies completely on the stunning volumetric shader bloom.
// sunMesh is preserved as a dummy Group to maintain compatibility with animation references.
export const sunMesh = new THREE.Group();
skyGroup.add(sunMesh);

// Moon
const moonGeo = new THREE.SphereGeometry(120, 32, 32);
const moonMat = new THREE.ShaderMaterial({
  vertexShader: sunMoonVertShader,
  fragmentShader: TOWER_GLSL + moonFragShader,
  uniforms: moonUniforms,
  transparent: true,
  // In the art styles the post pass inks breaks in the depth buffer, so
  // a moon written there gets an ink ring even when it's nearly invisible by
  // day. It stays out of the depth buffer and is drawn after the other see-
  // through sky objects (the stars), so none of them show through it.
  depthWrite: !ART_POST,
  fog: false,
});
export const moonMesh = new THREE.Mesh(moonGeo, moonMat);
if (ART_POST) moonMesh.renderOrder = 1;
skyGroup.add(moonMesh);

// Stars
const starsGeo = new THREE.BufferGeometry();
const starsCount = 4000;
const starsPos = new Float32Array(starsCount * 3);
const starsColors = new Float32Array(starsCount * 3);
const starsSizes = new Float32Array(starsCount);
const starsPhases = new Float32Array(starsCount);
const _starsRng = ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED + 1);
for (let i = 0; i < starsCount; i++) {
  const i3 = i * 3;
  const u = _starsRng();
  const v = _starsRng();
  const theta = u * 2.0 * Math.PI;
  const phi = Math.acos(2.0 * v - 1.0);
  const r = 20000 + _starsRng() * 4000;
  starsPos[i3] = r * Math.sin(phi) * Math.cos(theta);
  starsPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starsPos[i3 + 2] = r * Math.cos(phi);

  const sizeRand = _starsRng();
  if (sizeRand < 0.8) starsSizes[i] = 1.0 + _starsRng() * 1.5;
  else if (sizeRand < 0.98) starsSizes[i] = 3.0 + _starsRng() * 2.0;
  else starsSizes[i] = 6.0 + _starsRng() * 4.0;

  const colorType = _starsRng();
  let rC, gC, bC;
  if (colorType < 0.6) {
    rC = 1;
    gC = 1;
    bC = 1;
  } else if (colorType < 0.8) {
    rC = 0.8;
    gC = 0.9;
    bC = 1;
  } else if (colorType < 0.95) {
    rC = 1;
    gC = 0.9;
    bC = 0.8;
  } else {
    rC = 1;
    gC = 0.8;
    bC = 0.8;
  }

  const brightness = 0.5 + _starsRng() * 0.5;
  starsColors[i3] = rC * brightness;
  starsColors[i3 + 1] = gC * brightness;
  starsColors[i3 + 2] = bC * brightness;

  starsPhases[i] = _starsRng() * Math.PI * 2.0;
}
// The last one is a planet like Mars: low in the sky, reddish and steady (a
// negative phase stops it twinkling)
{
  const i3 = (starsCount - 1) * 3;
  const theta = _starsRng() * 2.0 * Math.PI;
  const elev = 0.12 + _starsRng() * 0.08;
  const r = 21000;
  starsPos[i3] = r * Math.cos(elev) * Math.cos(theta);
  starsPos[i3 + 1] = r * Math.sin(elev);
  starsPos[i3 + 2] = r * Math.cos(elev) * Math.sin(theta);
  starsSizes[starsCount - 1] = 7.0;
  starsColors[i3] = 1.0;
  starsColors[i3 + 1] = 0.72;
  starsColors[i3 + 2] = 0.55;
  starsPhases[starsCount - 1] = -1;
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
starsGeo.setAttribute('color', new THREE.BufferAttribute(starsColors, 3));
starsGeo.setAttribute('size', new THREE.BufferAttribute(starsSizes, 1));
starsGeo.setAttribute('phase', new THREE.BufferAttribute(starsPhases, 1));

export const starsMat = new THREE.ShaderMaterial({
  uniforms: {
    uOpacity: {value: 1.0},
    // Seconds, wrapped every 1000 s so the sines keep their precision (the
    // jump is lost in the flicker); set in game-loop.js
    uTime: {value: 0},
    uMoonDir: moonlightUniforms.uMoonDir,
    uMoonBright: moonlightUniforms.uMoonBright,
  },
  vertexShader: `
    uniform float uTime;
    uniform vec3 uMoonDir;
    uniform float uMoonBright;
    attribute float size;
    attribute vec3 color;
    attribute float phase;
    varying vec3 vColor;
    void main() {
      vec3 d = normalize(position);
      // Low stars shine through more air: dimmer, warmer and twinkling more
      float air = 1.0 - smoothstep(0.0, 0.35, d.y);
      vec3 c = color * mix(vec3(1.0), vec3(1.0, 0.72, 0.52), air * 0.6)
             * (1.0 - air * 0.4);
      // Twinkling: air turbulence flickers each star a few times a second,
      // irregularly (three sines at the star's own rates), deeper low down.
      // Planets (phase < 0) shine steadily.
      if (phase >= 0.0) {
        float s = phase;
        float n = 0.5 * sin(uTime * (11.0 + 7.0 * fract(s * 1.37)) + s * 40.0)
                + 0.3 * sin(uTime * (17.0 + 9.0 * fract(s * 2.11)) + s * 13.0)
                + 0.2 * sin(uTime * (5.0 + 3.0 * fract(s * 3.70)) + s * 7.0);
        c *= 1.0 - mix(0.22, 0.5, air) * (0.5 + 0.5 * n);
      }
      // The moon's glare hides the faint stars around it
      float glare = smoothstep(0.94, 0.995, dot(d, uMoonDir)) * uMoonBright;
      c *= 1.0 - min(glare * 1.2, 0.9);
      vColor = c;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying vec3 vColor;
    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      float alpha = pow((0.5 - dist) * 2.0, 1.5);
      gl_FragColor = vec4(vColor, alpha * uOpacity);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false,
});
Object.defineProperty(starsMat, 'opacity', {
  get: function () {
    return this.uniforms.uOpacity.value;
  },
  set: function (v) {
    this.uniforms.uOpacity.value = v;
  },
});
const starsMesh = new THREE.Points(starsGeo, starsMat);
skyGroup.add(starsMesh);

// Shooting stars (after the Nightscape demo, github.com/WeebLabs/Nightscape):
// both ends of the path are picked on screen so the whole streak is seen,
// clear of the moon and above the horizon. Speed and length vary (0.3-2 s),
// and about one in twelve is a brighter, longer fireball. A hot blue-white
// head draws a warmer trail that fades behind it. updateShootingStar() runs
// it from game-loop.js.
const METEOR_POINTS = 12;
const METEOR_RADIUS = 15000;
const meteorPos = new Float32Array(METEOR_POINTS * 3);
const meteorColors = new Float32Array(METEOR_POINTS * 3);
const shootingStarGeo = new THREE.BufferGeometry();
shootingStarGeo.setAttribute(
  'position',
  new THREE.BufferAttribute(meteorPos, 3)
);
shootingStarGeo.setAttribute(
  'color',
  new THREE.BufferAttribute(meteorColors, 3)
);
const shootingStarMat = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  blending: THREE.AdditiveBlending,
  fog: false,
  depthWrite: false,
});
const shootingStarMesh = new THREE.Line(shootingStarGeo, shootingStarMat);
shootingStarMesh.name = 'shootingStar';
shootingStarMesh.visible = false;
shootingStarMesh.frustumCulled = false; // Vertices move every frame
skyGroup.add(shootingStarMesh);
// The glowing head
const meteorHeadGeo = new THREE.BufferGeometry();
meteorHeadGeo.setAttribute(
  'position',
  new THREE.BufferAttribute(new Float32Array(3), 3)
);
const meteorHeadMat = new THREE.ShaderMaterial({
  uniforms: {uColor: {value: new THREE.Color()}, uSize: {value: 4}},
  vertexShader: `
    uniform float uSize;
    void main() {
      gl_PointSize = uSize;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
      if (d > 1.0) discard;
      gl_FragColor = vec4(uColor * pow(1.0 - d, 2.0), 1.0);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  fog: false,
});
const meteorHead = new THREE.Points(meteorHeadGeo, meteorHeadMat);
meteorHead.visible = false;
meteorHead.frustumCulled = false;
skyGroup.add(meteorHead);

const meteor = {on: false, t: 0, dur: 1, L: 0.2, trail: 0.25, bright: 1};
const _metA = new THREE.Vector3();
const _metT = new THREE.Vector3();
const _metP = new THREE.Vector3();
const _metE = new THREE.Vector3();
const _metU = new THREE.Vector3();
const _metNdc = new THREE.Vector3();
const _metCam = new THREE.Vector3();
const _metHot = new THREE.Color(0.82, 0.9, 1.0);
const _metWarm = new THREE.Color(1.0, 0.72, 0.42);
const _metC = new THREE.Color();

function onScreen(dir) {
  _metNdc.copy(dir).add(_metCam).project(camera);
  return (
    _metNdc.z < 1 && Math.abs(_metNdc.x) < 0.92 && Math.abs(_metNdc.y) < 0.92
  );
}

// The point on the path at fraction f (0 start, 1 end), as a unit vector
function meteorAt(f, out) {
  const a = meteor.L * f;
  return out
    .copy(_metA)
    .multiplyScalar(Math.cos(a))
    .addScaledVector(_metT, Math.sin(a));
}

// Try to launch a meteor across the view; false if too little sky shows
function launchMeteor(moonDir, fireball) {
  camera.getWorldPosition(_metCam);
  for (let i = 0; i < 40; i++) {
    _metNdc.set(Math.random() * 1.7 - 0.85, Math.random() * 1.7 - 0.85, 0.5);
    _metA.copy(_metNdc).unproject(camera).sub(_metCam).normalize();
    if (_metA.y < 0.1 || _metA.dot(moonDir) > Math.cos(0.25)) continue;
    // Heading: always somewhat downward across the sky
    _metE.set(_metA.z, 0, -_metA.x).normalize();
    _metU.crossVectors(_metA, _metE);
    const th = -Math.PI * (0.12 + Math.random() * 0.76);
    _metT
      .copy(_metE)
      .multiplyScalar(Math.cos(th))
      .addScaledVector(_metU, Math.sin(th));
    meteor.L = (fireball ? 0.25 : 0.12) + Math.random() * 0.25;
    meteorAt(1, _metP);
    if (
      _metP.y > 0.04 &&
      _metP.dot(moonDir) < Math.cos(0.15) &&
      onScreen(_metP)
    ) {
      meteor.dur = meteor.L * (2.5 + Math.random() * 3) * (fireball ? 1.5 : 1);
      meteor.trail = fireball ? 0.35 : 0.2 + Math.random() * 0.1;
      meteor.bright = fireball ? 1.6 : 0.55 + Math.random() * 0.45;
      meteorHeadMat.uniforms.uSize.value =
        (fireball ? 9 : 3 + Math.random() * 2) * renderer.getPixelRatio();
      meteor.t = 0;
      meteor.on = true;
      return true;
    }
  }
  return false;
}

// Called every frame: launches a meteor now and then (about every 30 s) while
// the stars show (sky 0..1), or right away with force, and moves it along.
// Returns whether one is in flight.
export function updateShootingStar(delta, moonDir, sky, force = false) {
  if (!meteor.on) {
    if (force || (sky > 0.5 && Math.random() < delta / 30)) {
      launchMeteor(moonDir, force === 'fireball' || Math.random() < 1 / 12);
    }
    if (!meteor.on) return false;
  }
  meteor.t += delta;
  const p = meteor.t / meteor.dur;
  if (p >= 1) {
    meteor.on = false;
    shootingStarMesh.visible = meteorHead.visible = false;
    return false;
  }
  // Flares up quickly, burns out toward the end
  const life =
    Math.min(1, p / 0.08) * (1 - Math.pow(p, 3)) * meteor.bright * sky;
  for (let i = 0; i < METEOR_POINTS; i++) {
    const k = i / (METEOR_POINTS - 1); // 0 head .. 1 tail end
    const f = Math.max(0, p - k * meteor.trail);
    meteorAt(f, _metP).multiplyScalar(METEOR_RADIUS);
    meteorPos[i * 3] = _metP.x;
    meteorPos[i * 3 + 1] = _metP.y;
    meteorPos[i * 3 + 2] = _metP.z;
    _metC
      .copy(_metHot)
      .lerp(_metWarm, Math.min(1, k * 2))
      .multiplyScalar(life * Math.pow(1 - k, 1.6));
    meteorColors[i * 3] = _metC.r;
    meteorColors[i * 3 + 1] = _metC.g;
    meteorColors[i * 3 + 2] = _metC.b;
  }
  meteorHeadGeo.attributes.position.array.set(meteorPos.subarray(0, 3));
  meteorHeadGeo.attributes.position.needsUpdate = true;
  meteorHeadMat.uniforms.uColor.value.copy(_metHot).multiplyScalar(life);
  shootingStarGeo.attributes.position.needsUpdate = true;
  shootingStarGeo.attributes.color.needsUpdate = true;
  shootingStarMesh.visible = meteorHead.visible = true;
  return true;
}

// Rainbow

const rainbowUniforms = {
  uAlpha: {value: 0.0},
};

const rainbowGeo = new THREE.RingGeometry(11000, 13000, 128, 1, 0, Math.PI * 2);
const rainbowMat = new THREE.ShaderMaterial({
  vertexShader: rainbowVertShader,
  fragmentShader: rainbowFragShader,
  uniforms: rainbowUniforms,
  transparent: true,
  blending: THREE.NormalBlending,
  depthWrite: false,
  depthTest: true,
  fog: false,
  side: THREE.DoubleSide,
});

const rainbowMesh = new THREE.Mesh(rainbowGeo, rainbowMat);
rainbowMesh.name = 'rainbow';
rainbowMesh.visible = false;
rainbowMesh.frustumCulled = false;
skyGroup.add(rainbowMesh);

// Daytime sky color: the palette's, overridable via URL param.
_daySky.setHex(
  selectedPalette.day !== undefined ? selectedPalette.day : 0x4ca1f0
);
if (ChillFlightLogic.DAY_COLOR) {
  const dayHex = parseInt(ChillFlightLogic.DAY_COLOR.replace('#', ''), 16);
  if (!isNaN(dayHex)) {
    _daySky.setHex(dayHex);
  }
}

// Frame timer for the game loop.
export const clock = new THREE.Timer();
