var isVRPresenting = false;
var latScale = 5000;
var currentLatDeg = 0;
var currentLatRad = 0;

var sunX = 0,
  sunY = 0,
  sunZ = 0;
var moonX = 0,
  moonY = 0,
  moonZ = 0;
var dayFactor = 0;

var passedServerNow = 0;
var secondsInCycle = 0;
var currentWarpedProgress = 0;
typeof daySpeedMultiplier !== 'undefined' ? daySpeedMultiplier : 1;

var isBarrelRolling = false;
var isDoingFullBarrelRoll = false;
var isClampedRoll = false;
var isLooping = false;
var isDoingFullLoop = false;
var manualRollSpeed = 4.0;
var manualLoopSpeed = 2.5;
// --- GAME LOOP, INPUT & CONTROLS ---
// Dependencies: THREE, scene, camera, renderer, planeGroup, propGroup, skyGroup,
//               sunMesh, moonMesh, dirLight, hemiLight, starsMat, timeOfDay, daySpeedMultiplier,
//               houseWindowMats, chunks, updateChunks, getElevation,
//               CHUNK_SIZE, WATER_LEVEL, BASE_FLIGHT_SPEED, TURN_SPEED, flightSpeedMultiplier,
//               pontoonGroup, pontoonL, pontoonR, hingeLF, hingeLB, hingeRF, hingeRB,
//               headlight, headlightGlow,
//               musicEnabled, setMusicEnabled

// --- Distance Tracking ---
var sessionDistanceTravelled = 0;
var previousPosition = null;
var lifetimeDistanceTravelled = parseFloat(
  localStorage.getItem('chill_flight_lifetime_distance') || '0'
);
var distanceSinceLastSave = 0;

// Intro Cinematic Transition
var isIntroTransitionActive = false;
var introTransitionStartTime = 0;
var _introCameraPosStart = new THREE.Vector3();
var _introLookTargetStart = new THREE.Vector3();
var _virtualCameraPos = new THREE.Vector3();
var _virtualLookTarget = new THREE.Vector3();

const CINEMATIC_CONFIGS = [
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

const _idealCameraPos_Cinematic = new THREE.Vector3();
const _idealLookTarget_Cinematic = new THREE.Vector3();
const _up_Cinematic = new THREE.Vector3(0, 1, 0);

const _cinematicOffsetCurrent = new THREE.Vector3().copy(
  CINEMATIC_CONFIGS[0].offset
);
const _cinematicLookTargetCurrent = new THREE.Vector3().copy(
  CINEMATIC_CONFIGS[0].lookOffset
);
const _cinematicStableMatrix = new THREE.Matrix4();
const _cinematicStableQuat = new THREE.Quaternion();

const _domCache = new Map();
function getCachedElement(id) {
  let el = _domCache.get(id);
  if (!el) {
    el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (el) _domCache.set(id, el);
  }
  return el;
}

/**
 * Throttles DOM updates by only writing if the value has changed.
 * Accepts either an HTMLElement or an element ID string (cached automatically).
 */
function updateDOM(elementOrId, newValue) {
  const element =
    typeof elementOrId === 'string'
      ? getCachedElement(elementOrId)
      : elementOrId;
  if (!element) return;
  const strValue = String(newValue); // Cast to string for accurate comparison
  if (element.textContent !== strValue) {
    element.textContent = strValue;
  }
}

function updateInputPosition(clientX, clientY) {
  const pos = ChillFlightLogic.computeInputPosition(
    clientX,
    clientY,
    window.innerWidth,
    window.innerHeight
  );
  mouseX = pos.x;
  mouseY = pos.y;
}

var isFreeCameraDragging = false;
var freeCamDeltaX = 0;
var freeCamDeltaY = 0;
var lastFreeCamTouchX = 0;
var lastFreeCamTouchY = 0;

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
var explosionParticles = null;
var lastY = 250; // track for ascent/descent detection

// --- WEBXR VR SESSION CONTROLS ---
var vrBtn = document.getElementById('vr-btn');
var splashVrBtn = document.getElementById('splash-vr-btn');
var vrBtnLabel = document.getElementById('vr-btn-label');

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
var clock = new THREE.Timer();
// Performance optimization: Static Float32Array ring buffer with running sum for delta smoothing.
// Eliminates per-frame array allocations (push/shift) and closure functions (.reduce()) in the main loop.
const DELTA_BUFFER_SIZE = 10;
const _deltaRing = new Float32Array(DELTA_BUFFER_SIZE);
var _deltaRingIndex = 0;
var _deltaRingCount = 0;
var _deltaRingSum = 0;
var smoothedDelta = 1 / 60;

// --- PERSISTENCE ---
const planeSelectGroupInit = document.getElementById('plane-select-group');
if (planeSelectGroupInit) {
  const currentPlane = window.activePlaneType || 'classic';
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
      if (typeof setActivePlane === 'function') {
        setActivePlane(planeType);
      }
    }
  });
}

const colorOptionsInit = document.getElementById('plane-color-options');
if (colorOptionsInit && typeof planeColor !== 'undefined') {
  colorOptionsInit.innerHTML = ''; // Clear fallback or existing content
  ChillFlightLogic.PLANE_COLORS.forEach((color) => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (color === planeColor ? ' active' : '');
    sw.setAttribute('data-color', color);
    // Ensure hex string is always 6 characters with leading zeros
    sw.style.backgroundColor = '#' + color.toString(16).padStart(6, '0');
    colorOptionsInit.appendChild(sw);
  });

  colorOptionsInit.addEventListener('click', (e) => {
    const target = e.target.closest('.color-swatch');
    if (target) {
      planeColor = parseInt(target.getAttribute('data-color'));
      window.planeColor = planeColor;
      localStorage.setItem('chill_flight_color', planeColor.toString());
      if (window.planeMat) window.planeMat.color.setHex(planeColor);
      if (window.planeWhiteMat) {
        window.planeWhiteMat.color.setHex(
          planeColor === 0xe8c382 ? 0x1c3144 : 0xffffff
        );
      }
      colorOptionsInit.querySelectorAll('.color-swatch').forEach((sw) => {
        sw.classList.toggle(
          'active',
          parseInt(sw.getAttribute('data-color')) === planeColor
        );
      });
    }
  });
}

var invertYAxis = false;
const savedInvertY = localStorage.getItem('chill_flight_invert_y');
if (savedInvertY !== null) {
  invertYAxis = savedInvertY === 'true';
}
const invertYInput = document.getElementById('invert-y-input');
if (invertYInput) {
  invertYInput.checked = invertYAxis;
  invertYInput.addEventListener('change', (e) => {
    invertYAxis = e.target.checked;
    localStorage.setItem('chill_flight_invert_y', invertYAxis);
  });
}

var gyroEnabled = currentControlScheme === 'gyro';

var gyroSensitivity = 60.0; // Hardcoded to low sensitivity (60 degrees for max control response) as requested

var gyroBasePitch = null;
var gyroBaseRoll = null;

var controlSchemeToggle = document.getElementById('control-scheme-toggle');
var gyroSchemeBtn = document.getElementById('gyro-scheme-btn');

// --- PERFORMANCE SETTINGS ---
var maxFPS = 60;
var frameMinDelay = 1000 / 60;
var lastFrameTime = 0;

// Apply initial graphics preset
const urlPreset =
  typeof ChillFlightLogic !== 'undefined' &&
  ChillFlightLogic.GRAPHICS_PRESET &&
  ['low', 'mid', 'high', 'ultra'].includes(ChillFlightLogic.GRAPHICS_PRESET)
    ? ChillFlightLogic.GRAPHICS_PRESET
    : null;

const savedPreset = localStorage.getItem('chill_flight_graphics_preset');
const initialPreset = urlPreset || savedPreset;

if (initialPreset) {
  const presetSelect = document.getElementById('graphics-preset-select');
  if (presetSelect) presetSelect.value = initialPreset;
  window.applyGraphicsPreset(initialPreset);
} else if (window.detectGraphicsPreset) {
  window.detectGraphicsPreset().then((detected) => {
    const presetSelect = document.getElementById('graphics-preset-select');
    if (presetSelect) presetSelect.value = detected;
    window.applyGraphicsPreset(detected);
  });
} else {
  const defaultPreset = 'mid';
  const presetSelect = document.getElementById('graphics-preset-select');
  if (presetSelect) presetSelect.value = defaultPreset;
  window.applyGraphicsPreset(defaultPreset);
}

// Setup timeOfDay before chunk gen
const serverNowFirst = Date.now() + (window.serverTimeOffset || 0);
const secondsInCycleFirst = (serverNowFirst % 300000) / 1000;
const currentWarpedProgressFirst =
  ChillFlightLogic.computeTimeOfDay(secondsInCycleFirst);
window.timeOfDay = currentWarpedProgressFirst * Math.PI * 2;

// Initial chunk generation
updateChunks();
if (typeof planeGroup !== 'undefined') {
  _lastChunkUpdatePos.copy(planeGroup.position);
}

if (typeof window.initLighthouse === 'function') {
  window.initLighthouse();
}

const fpsCounterEl = document.getElementById('debug-fps');

// Optimization: Pre-allocate reusable objects for the animate loop to prevent GC stutter
const _targetEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _forward = new THREE.Vector3(0, 0, -1);
const _cameraOffset = new THREE.Vector3(0, 0, 0);
const _cameraAnchorQuat = new THREE.Quaternion();
const _cameraAnchorMatrix = new THREE.Matrix4();
var _idealCameraPos = new THREE.Vector3(0, 0, 0);
const _lookOffset = new THREE.Vector3(0, 0, -20);
const _idealLookTarget = new THREE.Vector3(0, 0, 0);
var _currentLookTarget = new THREE.Vector3(0, 0, 0);
const _idealUp = new THREE.Vector3(0, 1, 0);
const _upVector = new THREE.Vector3(0, 1, 0);
const _chunkDummy = new THREE.Object3D();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _hubOffset = new THREE.Vector3(0, 0, 8.5);
const _idealCameraPos_Follow = new THREE.Vector3();
const _idealCameraPos_FirstPerson = new THREE.Vector3();
const _idealCameraPos_TopDown = new THREE.Vector3();
const _idealLookTarget_Follow = new THREE.Vector3();
const _idealLookTarget_FirstPerson = new THREE.Vector3();
const _idealLookTarget_TopDown = new THREE.Vector3();
const _up_Follow = new THREE.Vector3();
const _up_FirstPerson = new THREE.Vector3();
const _up_TopDown = new THREE.Vector3();
const _freeCamFwd = new THREE.Vector3();
const _freeCamSide = new THREE.Vector3();
var _auroraSessionMax = 0; // tracks highest aurora intensity seen this session

// Optimization: Pre-allocate colors for sky gradients
const _uncloudedSkyColor = new THREE.Color();
const _uncloudedFogColor = new THREE.Color();
const _daySky = new THREE.Color(
  typeof selectedPalette !== 'undefined' && selectedPalette.day !== undefined
    ? selectedPalette.day
    : 0x4ca1f0
);
if (typeof ChillFlightLogic !== 'undefined' && ChillFlightLogic.DAY_COLOR) {
  const dayHex = parseInt(ChillFlightLogic.DAY_COLOR.replace('#', ''), 16);
  if (!isNaN(dayHex)) {
    _daySky.setHex(dayHex);
  }
}
window._daySky = _daySky;
const _sunriseSky = new THREE.Color();
const _goldenSky = new THREE.Color();
const _sunsetSky = new THREE.Color();
const _goldenSunsetSky = new THREE.Color();

function updateSkyBaseColors(palette) {
  if (palette && palette.day !== undefined) {
    _daySky.setHex(palette.day);
  }
  const top = new THREE.Color(palette.top);
  const bottom = new THREE.Color(palette.bottom);

  // Sunrise: 80% horizon, 20% zenith -> 60% horizon, 40% zenith
  _sunriseSky.copy(bottom).lerp(top, 0.4);

  // Golden morning: horizon + white highlight -> also blend 20% zenith
  _goldenSky.copy(bottom).lerp(new THREE.Color(0xffffff), 0.1).lerp(top, 0.2);

  // Sunset: Pure horizon -> 50% horizon, 50% zenith
  _sunsetSky.copy(bottom).lerp(top, 0.5);

  // Golden sunset: horizon + black shadow -> also blend 30% zenith
  _goldenSunsetSky
    .copy(bottom)
    .lerp(new THREE.Color(0x000000), 0.2)
    .lerp(top, 0.3);

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

var targetPaletteTop = new THREE.Color(selectedPalette.top);
var targetPaletteBottom = new THREE.Color(selectedPalette.bottom);

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
    if (window.selectedPalette) {
      window.selectedPalette.day = _daySky.getHex();
    }
  });
}

const nextPaletteBtn = document.getElementById('debug-next-palette-btn');
if (nextPaletteBtn) {
  nextPaletteBtn.addEventListener('click', () => {
    if (typeof nextSkyPalette === 'function') {
      nextSkyPalette();
    } else if (typeof window.nextSkyPalette === 'function') {
      window.nextSkyPalette();
    }
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
      : window.currentPaletteSeed;
  if (!isCustomPalette && curSeed !== undefined) {
    updateUrlParams({palette: curSeed}, [
      'zenith',
      'horizon',
      'day',
      'dayBlue',
    ]);
  }
});

const _twilightSky = new THREE.Color(0x2c3e50);

const _currentSunriseSky = new THREE.Color();
const _currentGoldenSky = new THREE.Color();
const _cloudyColor = new THREE.Color();
const _finalSkyColor = new THREE.Color();
const _finalFogColor = new THREE.Color();
const _tempVec = new THREE.Vector3();
const _weatherLerpBase = new THREE.Color(0x8899aa);

// Pre-allocated colors and vectors for updateTimeOfDay() hot path
const _targetShadowPos = new THREE.Vector3();
const _dayLightColor = new THREE.Color(0xfff0dd);
const _sunriseLightColor = new THREE.Color(0xffd5a0);
const _sunsetLightColor = new THREE.Color(0xffad60);
const _stormColor = new THREE.Color(0x5a6b7c);

// --- PRE-ALLOCATED SCRATCH OBJECTS FOR SHADOW TEXEL SNAPPING ---
// These must live outside animate() to avoid GC pressure at 60fps.
const _shadowSunDir = new THREE.Vector3();
const _shadowRight = new THREE.Vector3();
const _shadowUp = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _boatDummy = new THREE.Object3D();
// Deterministic hash hoisted out of per-frame boat loops to eliminate GC closure allocations
function _boatHash(index, seed) {
  const val = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return val - Math.floor(val);
}

// --- PRE-ALLOCATED SCRATCH OBJECTS FOR ANIMATE() LOOP TO PREVENT GC CHURN ---
const _immelmannForward = new THREE.Vector3();
const _volcanoPos = new THREE.Vector3(-5000, 0, 5000);
const _rockArchPos = new THREE.Vector3(
  3000,
  0,
  typeof ChillFlightLogic !== 'undefined' && ChillFlightLogic.WORLD_SEED
    ? ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED)() * 10000 - 5000
    : 0
);
const _pirateSailCounts = [0, 0, 0, 0];
const _lighthouseBeamWorldPos = new THREE.Vector3();
const _shootingStarLookDir = new THREE.Vector3();
const _shootingStarStreakDir = new THREE.Vector3();
const _shootingStarHeadPos = new THREE.Vector3();
const _shootingStarTailPos = new THREE.Vector3();
const _rainbowSunDir = new THREE.Vector3();
const _rainbowAntiSunDir = new THREE.Vector3();
const _waterMoonDirNorm = new THREE.Vector3();
const _sunNoonColor = new THREE.Color(0xfffceb);
const _sunSunsetColor = new THREE.Color(0xffa542);
const _moonVMoonDir = new THREE.Vector3();
const _moonVZ = new THREE.Vector3();
const _moonVX = new THREE.Vector3();
const _moonVY = new THREE.Vector3();
const _moonMRot = new THREE.Matrix4();
const _moonRotMat = new THREE.Matrix3();
const _moonDirNorm = new THREE.Vector3();
const _moonPhaseX = new THREE.Vector3();
const _moonPhaseY = new THREE.Vector3();
const _moonPhaseSunDir = new THREE.Vector3();
const _skyBottomCol = new THREE.Color();
const _warmHorizonColor = new THREE.Color();
const _debugCamEuler = new THREE.Euler();

var isShootingStarActive = false;
var forceShootingStar = false;
var shootingStarProgress = 0;
var shootingStarStart = new THREE.Vector3();
var shootingStarEnd = new THREE.Vector3();
var shootingStarDuration = 1.0;

var forceRainbow = false;
var rainbowTimer = 0;
var rainbowIntensity = 0;
var wasRainClearing = true;

var isAnimationLoopRunning = false;

// Mobile controls
var btnUp = document.getElementById('mobile-spd-up');
var btnDown = document.getElementById('mobile-spd-down');

if (typeof window.initDebugUI === 'function') {
  window.initDebugUI();
}
