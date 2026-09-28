import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {
  _daySky,
  applyCustomSkyColors,
  camera,
  currentPaletteSeed,
  isCustomPalette,
  nextSkyPalette,
  renderer,
  selectedPalette,
} from './sky.js';
import {
  activePlaneType,
  planeGroup,
  planeMat,
  planeWhiteMat,
  setActivePlane,
} from './airplane.js';
import {updateChunks} from './terrain-chunks.js';
import {_lastChunkUpdatePos} from './game-input-bindings.js';
import {applyGraphicsPreset, initDebugUI} from './debug-ui.js';
import {state} from './state.js';
import {updateUrlParams} from './constants.js';
import {detectGraphicsPreset} from './native-adapter.js';
import {initLighthouse} from './terrain-geometry.js';

typeof state.daySpeedMultiplier !== 'undefined' ? state.daySpeedMultiplier : 1;

// --- GAME LOOP, INPUT & CONTROLS ---
// Dependencies: THREE, scene, camera, renderer, planeGroup, propGroup, skyGroup,
//               sunMesh, moonMesh, dirLight, hemiLight, starsMat, timeOfDay, daySpeedMultiplier,
//               houseWindowMats, chunks, updateChunks, getElevation,
//               CHUNK_SIZE, WATER_LEVEL, BASE_FLIGHT_SPEED, TURN_SPEED, flightSpeedMultiplier,
//               pontoonGroup, pontoonL, pontoonR, hingeLF, hingeLB, hingeRF, hingeRB,
//               headlight, headlightGlow,
//               musicEnabled, setMusicEnabled

// --- Distance Tracking ---
state.lifetimeDistanceTravelled = parseFloat(
  localStorage.getItem('chill_flight_lifetime_distance') || '0'
);

// Intro Cinematic Transition
export var _introCameraPosStart = new THREE.Vector3();
export var _introLookTargetStart = new THREE.Vector3();
export var _virtualCameraPos = new THREE.Vector3();
export var _virtualLookTarget = new THREE.Vector3();

export const CINEMATIC_CONFIGS = [
  {
    offset: new THREE.Vector3(40, 10, 40),
    lookOffset: new THREE.Vector3(0, 5, -10),
    fov: 65,
  }, // Side-on follow
  {
    offset: new THREE.Vector3(0, -15, -60),
    lookOffset: new THREE.Vector3(0, 0, 5),
    fov: 80,
  }, // From below-front (low angle)
  {
    offset: new THREE.Vector3(-50, 20, 30),
    lookOffset: new THREE.Vector3(0, 0, -20),
    fov: 60,
  }, // Front-quarter
  {
    offset: new THREE.Vector3(0, 80, 20),
    lookOffset: new THREE.Vector3(0, 0, -30),
    fov: 75,
  }, // High-angle vertical
  {
    offset: new THREE.Vector3(80, 5, -20),
    lookOffset: new THREE.Vector3(0, 0, 10),
    fov: 50,
  }, // Wing-tip view
];

export const _idealCameraPos_Cinematic = new THREE.Vector3();
export const _idealLookTarget_Cinematic = new THREE.Vector3();

export const _cinematicOffsetCurrent = new THREE.Vector3().copy(
  CINEMATIC_CONFIGS[0].offset
);
export const _cinematicLookTargetCurrent = new THREE.Vector3().copy(
  CINEMATIC_CONFIGS[0].lookOffset
);
export const _cinematicStableMatrix = new THREE.Matrix4();
export const _cinematicStableQuat = new THREE.Quaternion();

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (!renderer.xr || !renderer.xr.isPresenting) {
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

window.addEventListener('resize', onWindowResize);

// Robustness: Force resize check after page load and at intervals to catch late-settling layout
window.addEventListener('load', onWindowResize);
setTimeout(onWindowResize, 100);
setTimeout(onWindowResize, 500);
setTimeout(onWindowResize, 2000); // Final check for very slow loading environments

// --- EXPLOSIONS ---

// --- WEBXR VR SESSION CONTROLS ---
export var vrBtn = document.getElementById('vr-btn');
export var splashVrBtn = document.getElementById('splash-vr-btn');
export var vrBtnLabel = document.getElementById('vr-btn-label');

if (
  typeof navigator !== 'undefined' &&
  navigator.xr &&
  typeof navigator.xr.isSessionSupported === 'function'
) {
  navigator.xr
    .isSessionSupported('immersive-vr')
    .then((supported) => {
      if (supported) {
        if (vrBtn) vrBtn.style.display = '';
        if (splashVrBtn) splashVrBtn.style.display = '';
      }
    })
    .catch(() => {});
}

// --- MAIN GAME LOOP ---
// Performance optimization: Static Float32Array ring buffer with running sum for delta smoothing.
// Eliminates per-frame array allocations (push/shift) and closure functions (.reduce()) in the main loop.
export const DELTA_BUFFER_SIZE = 10;
export const _deltaRing = new Float32Array(DELTA_BUFFER_SIZE);
state.smoothedDelta = 1 / 60;

// --- PERSISTENCE ---
const planeSelectGroupInit = document.getElementById('plane-select-group');
if (planeSelectGroupInit) {
  const currentPlane = activePlaneType || 'classic';
  planeSelectGroupInit.querySelectorAll('.scheme-btn').forEach((btn) => {
    btn.classList.toggle(
      'active',
      btn.getAttribute('data-plane') === currentPlane
    );
  });

  planeSelectGroupInit.addEventListener('click', (e) => {
    const btn = e.target.closest('.scheme-btn');
    if (btn) {
      const planeType = btn.getAttribute('data-plane');

      setActivePlane(planeType);
    }
  });
}

const colorOptionsInit = document.getElementById('plane-color-options');
if (colorOptionsInit && typeof state.planeColor !== 'undefined') {
  colorOptionsInit.innerHTML = ''; // Clear fallback or existing content
  ChillFlightLogic.PLANE_COLORS.forEach((color) => {
    const sw = document.createElement('div');
    sw.className =
      'color-swatch' + (color === state.planeColor ? ' active' : '');
    sw.setAttribute('data-color', color);
    // Ensure hex string is always 6 characters with leading zeros
    sw.style.backgroundColor = '#' + color.toString(16).padStart(6, '0');
    colorOptionsInit.appendChild(sw);
  });

  colorOptionsInit.addEventListener('click', (e) => {
    const target = e.target.closest('.color-swatch');
    if (target) {
      state.planeColor = parseInt(target.getAttribute('data-color'));
      localStorage.setItem('chill_flight_color', state.planeColor.toString());
      if (planeMat) planeMat.color.setHex(state.planeColor);
      if (planeWhiteMat) {
        planeWhiteMat.color.setHex(
          state.planeColor === 0xe8c382 ? 0x1c3144 : 0xffffff
        );
      }
      colorOptionsInit.querySelectorAll('.color-swatch').forEach((sw) => {
        sw.classList.toggle(
          'active',
          parseInt(sw.getAttribute('data-color')) === state.planeColor
        );
      });
    }
  });
}

const savedInvertY = localStorage.getItem('chill_flight_invert_y');
if (savedInvertY !== null) {
  state.invertYAxis = savedInvertY === 'true';
}
const invertYInput = document.getElementById('invert-y-input');
if (invertYInput) {
  invertYInput.checked = state.invertYAxis;
  invertYInput.addEventListener('change', (e) => {
    state.invertYAxis = e.target.checked;
    localStorage.setItem('chill_flight_invert_y', state.invertYAxis);
  });
}

state.gyroEnabled = state.currentControlScheme === 'gyro';

export var gyroSensitivity = 60.0; // Hardcoded to low sensitivity (60 degrees for max control response) as requested

export var controlSchemeToggle = document.getElementById(
  'control-scheme-toggle'
);
export var gyroSchemeBtn = document.getElementById('gyro-scheme-btn');

// --- PERFORMANCE SETTINGS ---
state.frameMinDelay = 1000 / 60;

// Apply initial graphics preset
const urlPreset =
  ChillFlightLogic.GRAPHICS_PRESET &&
  ['low', 'mid', 'high', 'ultra'].includes(ChillFlightLogic.GRAPHICS_PRESET)
    ? ChillFlightLogic.GRAPHICS_PRESET
    : null;

const savedPreset = localStorage.getItem('chill_flight_graphics_preset');
export var initialPreset = urlPreset || savedPreset;
if (typeof window !== 'undefined') window.initialPreset = initialPreset;

if (initialPreset) {
  const presetSelect = document.getElementById('graphics-preset-select');
  if (presetSelect) presetSelect.value = initialPreset;
  applyGraphicsPreset(initialPreset);
} else if (detectGraphicsPreset) {
  detectGraphicsPreset().then((detected) => {
    const presetSelect = document.getElementById('graphics-preset-select');
    if (presetSelect) presetSelect.value = detected;
    applyGraphicsPreset(detected);
  });
} else {
  const defaultPreset = 'mid';
  const presetSelect = document.getElementById('graphics-preset-select');
  if (presetSelect) presetSelect.value = defaultPreset;
  applyGraphicsPreset(defaultPreset);
}

// Setup timeOfDay before chunk gen
const secondsInCycleFirst = (Date.now() % 300000) / 1000;
const currentWarpedProgressFirst =
  ChillFlightLogic.computeTimeOfDay(secondsInCycleFirst);
state.timeOfDay = currentWarpedProgressFirst * Math.PI * 2;

// Initial chunk generation
updateChunks();

_lastChunkUpdatePos.copy(planeGroup.position);

initLighthouse();

// Optimization: Pre-allocate reusable objects for the animate loop to prevent GC stutter
export const _cameraOffset = new THREE.Vector3(0, 0, 0);
export const _cameraAnchorQuat = new THREE.Quaternion();
export const _cameraAnchorMatrix = new THREE.Matrix4();
export var _idealCameraPos = new THREE.Vector3(0, 0, 0);
export const _lookOffset = new THREE.Vector3(0, 0, -20);
export const _idealLookTarget = new THREE.Vector3(0, 0, 0);
export var _currentLookTarget = new THREE.Vector3(0, 0, 0);
export const _idealUp = new THREE.Vector3(0, 1, 0);
export const _upVector = new THREE.Vector3(0, 1, 0);
export const _yAxis = new THREE.Vector3(0, 1, 0);
export const _idealCameraPos_Follow = new THREE.Vector3();
export const _idealCameraPos_FirstPerson = new THREE.Vector3();
export const _idealCameraPos_TopDown = new THREE.Vector3();
export const _idealLookTarget_Follow = new THREE.Vector3();
export const _idealLookTarget_FirstPerson = new THREE.Vector3();
export const _idealLookTarget_TopDown = new THREE.Vector3();
export const _up_Follow = new THREE.Vector3();
export const _up_FirstPerson = new THREE.Vector3();
export const _up_TopDown = new THREE.Vector3();
export const _freeCamFwd = new THREE.Vector3();
export const _freeCamSide = new THREE.Vector3();

// Optimization: Pre-allocate colors for sky gradients
export const _uncloudedSkyColor = new THREE.Color();
export const _uncloudedFogColor = new THREE.Color();
export const _sunriseSky = new THREE.Color();
export const _goldenSky = new THREE.Color();
export const _sunsetSky = new THREE.Color();
export const _goldenSunsetSky = new THREE.Color();

function updateSkyBaseColors(palette) {
  if (palette && palette.day !== undefined) {
    _daySky.setHex(palette.day);
  }
  const top = new THREE.Color(palette.top);
  const bottom = new THREE.Color(palette.bottom);

  // Sunrise/sunset zenith: the palette's zenith color. Mixing in the warm
  // horizon color (complementary to the blue zenith) turns it grey, so the
  // warm colors stay at the horizon (see skyColorAt in constants.js).
  _sunriseSky.copy(top);
  _sunsetSky.copy(top);

  // Golden hour adds a little warmth overhead: a touch brighter in the
  // morning, a touch darker in the evening.
  _goldenSky.copy(top).lerp(bottom, 0.25).lerp(new THREE.Color(0xffffff), 0.05);
  _goldenSunsetSky.copy(top).lerp(bottom, 0.25).multiplyScalar(0.9);

  // Update Splash Screen Background
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    // Keep it dark but clearly influenced by the current colors
    const topHSL = {};
    top.getHSL(topHSL);
    const bottomHSL = {};
    bottom.getHSL(bottomHSL);

    // Keep saturation relatively high, but drastically drop lightness for background
    const darkTop = new THREE.Color()
      .setHSL(topHSL.h, Math.max(topHSL.s, 0.5), 0.18)
      .getStyle();
    const darkBottom = new THREE.Color()
      .setHSL(bottomHSL.h, Math.max(bottomHSL.s, 0.5), 0.08)
      .getStyle();

    overlay.style.background = `radial-gradient(circle at center, ${darkTop} 0%, ${darkBottom} 100%)`;

    // Set Dynamic Accent Colors for the Button
    const accentColor = bottom.clone().multiplyScalar(1.2).getStyle();
    const accentGlow = bottom.clone().multiplyScalar(1.2);
    const glowStyle = `rgba(${Math.round(accentGlow.r * 255)}, ${Math.round(accentGlow.g * 255)}, ${Math.round(accentGlow.b * 255)}, 0.4)`;

    overlay.style.setProperty('--accent-color', accentColor);
    overlay.style.setProperty('--accent-glow', glowStyle);
  }
}
updateSkyBaseColors(selectedPalette);

export var targetPaletteTop = new THREE.Color(selectedPalette.top);
export var targetPaletteBottom = new THREE.Color(selectedPalette.bottom);

const zenithPicker = document.getElementById('sky-zenith-picker');
const dayPicker = document.getElementById('sky-day-picker');
const horizonPicker = document.getElementById('sky-horizon-picker');

function updateColorPickers(palette) {
  if (zenithPicker)
    zenithPicker.value = '#' + palette.top.toString(16).padStart(6, '0');
  if (horizonPicker)
    horizonPicker.value = '#' + palette.bottom.toString(16).padStart(6, '0');
  if (dayPicker) dayPicker.value = '#' + _daySky.getHexString();
}

// Initial sync
updateColorPickers(selectedPalette);

if (zenithPicker && horizonPicker) {
  const handlePickerChange = () => {
    applyCustomSkyColors(
      zenithPicker.value,
      horizonPicker.value,
      dayPicker ? dayPicker.value : undefined
    );
  };
  const handlePickerCommit = () => {
    const topHex = zenithPicker.value.replace('#', '');
    const bottomHex = horizonPicker.value.replace('#', '');
    const dayHex = dayPicker ? dayPicker.value.replace('#', '') : '';
    const paletteStr = dayHex
      ? `${topHex},${bottomHex},${dayHex}`
      : `${topHex},${bottomHex}`;
    updateUrlParams({palette: paletteStr}, [
      'zenith',
      'horizon',
      'day',
      'dayBlue',
    ]);
  };
  zenithPicker.addEventListener('input', handlePickerChange);
  horizonPicker.addEventListener('input', handlePickerChange);
  zenithPicker.addEventListener('change', handlePickerCommit);
  horizonPicker.addEventListener('change', handlePickerCommit);
  if (dayPicker) {
    dayPicker.addEventListener('change', handlePickerCommit);
  }
}

if (dayPicker) {
  dayPicker.addEventListener('input', () => {
    _daySky.set(dayPicker.value);
    if (selectedPalette) {
      selectedPalette.day = _daySky.getHex();
    }
  });
}

const nextPaletteBtn = document.getElementById('debug-next-palette-btn');
if (nextPaletteBtn) {
  nextPaletteBtn.addEventListener('click', () => {
    nextSkyPalette();
  });
}

window.addEventListener('paletteChanged', (e) => {
  updateSkyBaseColors(e.detail);
  targetPaletteTop.setHex(e.detail.top);
  targetPaletteBottom.setHex(e.detail.bottom);

  // Only update picker UI if NOT in custom mode to avoid fighting the user
  if (!isCustomPalette) {
    updateColorPickers(e.detail);
  }

  const curSeed =
    typeof currentPaletteSeed !== 'undefined'
      ? currentPaletteSeed
      : currentPaletteSeed;
  if (!isCustomPalette && curSeed !== undefined) {
    updateUrlParams({palette: curSeed}, [
      'zenith',
      'horizon',
      'day',
      'dayBlue',
    ]);
  }
});

export const _twilightSky = new THREE.Color(0x2c3e50);

export const _currentSunriseSky = new THREE.Color();
export const _currentGoldenSky = new THREE.Color();
export const _cloudyColor = new THREE.Color();
export const _finalSkyColor = new THREE.Color();
export const _finalFogColor = new THREE.Color();
export const _tempVec = new THREE.Vector3();

// Pre-allocated colors and vectors for updateTimeOfDay() hot path
export const _targetShadowPos = new THREE.Vector3();
export const _dayLightColor = new THREE.Color(0xfff0dd);
export const _sunriseLightColor = new THREE.Color(0xffd5a0);
export const _sunsetLightColor = new THREE.Color(0xffad60);
export const _stormColor = new THREE.Color(0x5a6b7c);

// --- PRE-ALLOCATED SCRATCH OBJECTS FOR SHADOW TEXEL SNAPPING ---
// These must live outside animate() to avoid GC pressure at 60fps.
export const _shadowSunDir = new THREE.Vector3();
export const _shadowRight = new THREE.Vector3();
export const _shadowUp = new THREE.Vector3();
export const _worldUp = new THREE.Vector3(0, 1, 0);
export const _boatDummy = new THREE.Object3D();
// Deterministic hash hoisted out of per-frame boat loops to eliminate GC closure allocations
export function _boatHash(index, seed) {
  const val = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return val - Math.floor(val);
}

// --- PRE-ALLOCATED SCRATCH OBJECTS FOR ANIMATE() LOOP TO PREVENT GC CHURN ---
export const _immelmannForward = new THREE.Vector3();
export const _volcanoPos = new THREE.Vector3(-5000, 0, 5000);
export const _rockArchPos = new THREE.Vector3(
  3000,
  0,
  ChillFlightLogic.WORLD_SEED
    ? ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED)() * 10000 - 5000
    : 0
);
export const _pirateSailCounts = [0, 0, 0, 0];
export const _lighthouseBeamWorldPos = new THREE.Vector3();
export const _shootingStarLookDir = new THREE.Vector3();
export const _shootingStarStreakDir = new THREE.Vector3();
export const _shootingStarHeadPos = new THREE.Vector3();
export const _shootingStarTailPos = new THREE.Vector3();
export const _rainbowSunDir = new THREE.Vector3();
export const _rainbowAntiSunDir = new THREE.Vector3();
export const _waterMoonDirNorm = new THREE.Vector3();
export const _sunNoonColor = new THREE.Color(0xfffceb);
export const _sunSunsetColor = new THREE.Color(0xffa542);
export const _moonVMoonDir = new THREE.Vector3();
export const _moonVZ = new THREE.Vector3();
export const _moonVX = new THREE.Vector3();
export const _moonVY = new THREE.Vector3();
export const _moonMRot = new THREE.Matrix4();
export const _moonRotMat = new THREE.Matrix3();
export const _moonDirNorm = new THREE.Vector3();
export const _moonPhaseX = new THREE.Vector3();
export const _moonPhaseSunDir = new THREE.Vector3();
export const _skyBottomCol = new THREE.Color();
export const _warmHorizonColor = new THREE.Color();
export const _debugCamEuler = new THREE.Euler();

export var shootingStarStart = new THREE.Vector3();
export var shootingStarEnd = new THREE.Vector3();

// Mobile controls
export var btnUp = document.getElementById('mobile-spd-up');
export var btnDown = document.getElementById('mobile-spd-down');

initDebugUI();
