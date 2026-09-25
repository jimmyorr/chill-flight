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

function updateUrlParams(updates = {}, removals = []) {
  try {
    const debugMenu =
      typeof getCachedElement === 'function'
        ? getCachedElement('debug-menu')
        : document.getElementById('debug-menu');
    const isDebugActive = debugMenu && debugMenu.style.display === 'block';

    if (!isDebugActive) {
      return;
    }

    const url = new URL(window.location.href);
    if (!removals.includes('debug') && !url.searchParams.has('debug')) {
      url.searchParams.set('debug', 'true');
    }
    removals.forEach((key) => url.searchParams.delete(key));
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, val);
      }
    });
    window.history.replaceState(null, '', url.toString());
  } catch (err) {
    console.error('Failed to update URL parameters:', err);
  }
}
window.updateUrlParams = updateUrlParams;

function applyGraphicsPreset(preset) {
  let segments = 30;
  let dist = 6;
  let propLod = 4000;
  let fps = 60;

  switch (preset) {
    case 'ultra':
      segments = 50;
      dist = 8;
      propLod = 6000;
      fps = 60;
      break;
    case 'high':
      segments = 40;
      dist = 7;
      propLod = 5000;
      fps = 60;
      break;
    case 'mid':
      segments = 30;
      dist = 6;
      propLod = 4000;
      fps = 60;
      break;
    case 'low':
      segments = 20;
      dist = 4;
      propLod = 3000;
      fps = 60;
      break;
    default:
      preset = 'mid';
      segments = 30;
      dist = 6;
      propLod = 4000;
      fps = 60;
      break;
  }

  localStorage.setItem('chill_flight_graphics_preset', preset);
  localStorage.setItem('chill_flight_quality', segments);

  // If the current URL specifies preset or graphics param, keep it in sync
  if (typeof window !== 'undefined' && window.location) {
    try {
      const curUrl = new URL(window.location.href);
      if (
        curUrl.searchParams.has('preset') ||
        curUrl.searchParams.has('graphics')
      ) {
        updateUrlParams({preset}, ['graphics']);
      }
    } catch (_) {}
  }

  // Set global variables
  SEGMENTS = segments;
  RENDER_DISTANCE = dist;
  PROP_LOD_DISTANCE = propLod;
  window.PROP_LOD_DISTANCE = propLod;
  if (typeof maxFPS !== 'undefined') {
    maxFPS = fps;
    frameMinDelay = maxFPS > 0 ? 1000 / maxFPS : 0;
  }

  // Sync UI slider if not manually overridden
  const slider = document.getElementById('debug-prop-lod-slider');
  const sliderVal = document.getElementById('debug-prop-lod-slider-val');
  if (slider && window.manualPropLOD === undefined) {
    slider.value = propLod;
    if (sliderVal) sliderVal.textContent = propLod;
  }

  console.log(
    `Graphics preset applied: ${preset} (SEGMENTS=${segments}, DIST=${dist}, LOD=${propLod}, FPS=${fps})`
  );

  // Update pixel ratio dynamically: baked resolution scale into quality levels
  let pixelRatio = window.devicePixelRatio;
  if (segments <= 20) {
    pixelRatio = 0.5;
  } else if (segments <= 40) {
    pixelRatio = Math.min(window.devicePixelRatio, 2) * 0.75;
  } else if (segments <= 50) {
    pixelRatio = Math.min(window.devicePixelRatio, 1.5);
  } else {
    pixelRatio = Math.min(window.devicePixelRatio, 2.0); // Capped at 2.0 for Ultra
  }

  // Store the preset's base pixel ratio so DRS can scale relative to it
  window._basePixelRatio = pixelRatio;

  if (typeof renderer !== 'undefined' && renderer) {
    renderer.setPixelRatio(pixelRatio);
  }

  // Reset DRS multiplier when preset changes so we start fresh
  if (window.performanceMonitor) {
    window.performanceMonitor.pixelRatioMultiplier = 1.0;
  }

  // Toggle sky clouds dynamically: disable expensive fBm on low mode
  if (window.skyUniforms !== undefined) {
    window.skyUniforms.uShowClouds.value = segments > 20 && showCloudsEnabled;
  }

  // Toggle overdraw optimizations (transparency)
  const isLow = segments <= 20;
  if (typeof waterMaterial !== 'undefined' && typeof cloudMat !== 'undefined') {
    waterMaterial.transparent = !isLow;
    waterMaterial.opacity = isLow ? 1.0 : 0.6;
    waterMaterial.depthWrite = isLow ? true : false;
    waterMaterial.needsUpdate = true;

    cloudMat.transparent = !isLow;
    cloudMat.opacity = isLow ? 1.0 : CLOUD_OPACITY;
    cloudMat.needsUpdate = true;
  }

  const enableShadows = segments > 20;
  if (
    typeof dirLight !== 'undefined' &&
    dirLight.castShadow !== enableShadows
  ) {
    dirLight.castShadow = enableShadows;
    if (typeof scene !== 'undefined') {
      scene.traverse((child) => {
        if (child.isMesh || child.isInstancedMesh) {
          child.castShadow = enableShadows;
          // Keep receiveShadow=false on the player plane to prevent
          // self-shadowing strobe artifacts at low sun angles
          if (!planeGroup || !planeGroup.getObjectById(child.id)) {
            child.receiveShadow = enableShadows;
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => (m.needsUpdate = true));
            } else {
              child.material.needsUpdate = true;
            }
          }
        }
      });
    }
  }

  // Clear all existing chunks to force regeneration
  if (typeof chunks !== 'undefined') {
    chunks.forEach((group, key) => {
      group.traverse((child) => {
        if (child.isMesh || child.isInstancedMesh) {
          if (child.geometry && child.geometry.userData.unique) {
            child.geometry.dispose();
          }
        }
      });
      if (typeof scene !== 'undefined') scene.remove(group);
    });
    chunks.clear();
    if (typeof watercraftChunks !== 'undefined') {
      watercraftChunks.clear();
    }
  }
  if (window.clearChunkQueue) window.clearChunkQueue();
  if (window.clearElevationCache) window.clearElevationCache();
  if (typeof _lastChunkUpdatePos !== 'undefined') {
    _lastChunkUpdatePos.set(Infinity, Infinity, Infinity); // Force chunk rebuild
  }
}

const graphicsPresetSelect = document.getElementById('graphics-preset-select');
if (graphicsPresetSelect) {
  graphicsPresetSelect.addEventListener('change', (e) => {
    applyGraphicsPreset(e.target.value);
    updateUrlParams({preset: e.target.value}, ['graphics']);
  });
}

// Theme selection
const themeSelect = document.getElementById('theme-select');
if (themeSelect) {
  const currentTheme = ChillFlightLogic.THEME;
  themeSelect.value = currentTheme;
  themeSelect.addEventListener('change', (e) => {
    const newTheme = e.target.value;
    if (!newTheme || newTheme === currentTheme) return;
    const url = new URL(window.location);
    url.searchParams.set('theme', newTheme);
    window.location.assign(url.toString());
  });
}

// Seed selection
const seedInput = document.getElementById('seed-input');
if (seedInput) {
  seedInput.value = ChillFlightLogic.WORLD_SEED;

  const applySeed = (val) => {
    if (!val) return;
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed === ChillFlightLogic.WORLD_SEED) return;
    const url = new URL(window.location);
    url.searchParams.set('seed', parsed);
    window.location.assign(url.toString());
  };

  seedInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applySeed(seedInput.value);
    }
  });

  seedInput.addEventListener('change', (e) => {
    applySeed(e.target.value);
  });
}

// Force Island Type selector
const islandTypeSelect = document.getElementById('island-type-select');
if (islandTypeSelect) {
  islandTypeSelect.value = ChillFlightLogic.START_ISLAND_TYPE || 'auto';
  islandTypeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    ChillFlightLogic.FORCE_ISLAND_TYPE = val;
    if (val !== 'auto') {
      updateUrlParams({islandType: val}, ['island']);
    } else {
      updateUrlParams({}, ['islandType', 'island']);
    }
    // Rebuild terrain chunks so change takes effect immediately
    if (typeof chunks !== 'undefined') {
      chunks.forEach((group) => {
        group.traverse((child) => {
          if (child.isMesh || child.isInstancedMesh) {
            if (child.geometry && child.geometry.userData.unique) {
              child.geometry.dispose();
            }
          }
        });
        if (typeof scene !== 'undefined') scene.remove(group);
      });
      chunks.clear();
      if (typeof watercraftChunks !== 'undefined') {
        watercraftChunks.clear();
      }
    }
    if (window.clearChunkQueue) window.clearChunkQueue();
    if (window.clearElevationCache) window.clearElevationCache();
    if (typeof _lastChunkUpdatePos !== 'undefined') {
      _lastChunkUpdatePos.set(Infinity, Infinity, Infinity);
    }
    if (typeof updateChunks === 'function') {
      updateChunks();
    }
    console.log(`Island type changed to: ${val}`);
  });
}

// Procedural Objects toggle
const objectsToggle = document.getElementById('debug-objects-toggle');
if (objectsToggle) {
  objectsToggle.checked = ChillFlightLogic.SHOW_OBJECTS;
  objectsToggle.addEventListener('change', (e) => {
    if (typeof window.toggleProceduralObjects === 'function') {
      window.toggleProceduralObjects(e.target.checked);
    }
  });
}

// Chunk borders toggle
var showChunkBorders = false;
const _chunkBorderHelpers = new Map(); // key -> Box3Helper
const _chunkBorderColor = new THREE.Color(0x00ffff);

function syncChunkBorders() {
  if (!showChunkBorders) {
    // Remove all helpers when toggled off
    if (_chunkBorderHelpers.size > 0) {
      _chunkBorderHelpers.forEach((helper) => scene.remove(helper));
      _chunkBorderHelpers.clear();
    }
    return;
  }

  const cs = typeof CHUNK_SIZE !== 'undefined' ? CHUNK_SIZE : 1500;
  const halfH = 800; // half-height of the visualized box

  // Add helpers for new chunks
  chunks.forEach((group, key) => {
    if (!_chunkBorderHelpers.has(key)) {
      const wp = group.userData.worldPosition || group.position;
      const box = new THREE.Box3(
        new THREE.Vector3(wp.x - cs / 2, -halfH, wp.z - cs / 2),
        new THREE.Vector3(wp.x + cs / 2, halfH, wp.z + cs / 2)
      );
      const helper = new THREE.Box3Helper(box, _chunkBorderColor);
      helper.material.transparent = true;
      helper.material.opacity = 0.35;
      scene.add(helper);
      _chunkBorderHelpers.set(key, helper);
    }
  });

  // Remove helpers for evicted chunks
  _chunkBorderHelpers.forEach((helper, key) => {
    if (!chunks.has(key)) {
      scene.remove(helper);
      _chunkBorderHelpers.delete(key);
    }
  });
}

const chunkBordersToggle = document.getElementById(
  'debug-chunk-borders-toggle'
);
if (chunkBordersToggle) {
  chunkBordersToggle.addEventListener('change', (e) => {
    showChunkBorders = e.target.checked;
    syncChunkBorders();
  });
}

// Fog slider
const fogSlider = document.getElementById('debug-fog-slider');
const baseFogVal = document.getElementById('debug-base-fog-val');
if (fogSlider) {
  fogSlider.addEventListener('input', (e) => {
    window.manualBaseFogDensity = parseFloat(e.target.value);
    if (baseFogVal)
      baseFogVal.textContent = window.manualBaseFogDensity.toFixed(5);
  });
}

// Prop LOD slider
const propLodSlider = document.getElementById('debug-prop-lod-slider');
const propLodSliderVal = document.getElementById('debug-prop-lod-slider-val');
if (propLodSlider) {
  // Initialize to current PROP_LOD_DISTANCE value or URL START_PROP_LOD
  let initLod =
    typeof PROP_LOD_DISTANCE !== 'undefined' ? PROP_LOD_DISTANCE : 4200;
  if (
    typeof ChillFlightLogic !== 'undefined' &&
    ChillFlightLogic.START_PROP_LOD !== null &&
    !isNaN(ChillFlightLogic.START_PROP_LOD)
  ) {
    initLod = ChillFlightLogic.START_PROP_LOD;
    window.manualPropLOD = initLod;
  }
  propLodSlider.value = initLod;
  if (propLodSliderVal) propLodSliderVal.textContent = Math.round(initLod);

  propLodSlider.addEventListener('input', (e) => {
    window.manualPropLOD = parseFloat(e.target.value);
    if (propLodSliderVal)
      propLodSliderVal.textContent = Math.round(window.manualPropLOD);
    if (window.performanceMonitor) {
      window.performanceMonitor.applyEffectiveLOD();
    }
  });
  propLodSlider.addEventListener('change', (e) => {
    window.manualPropLOD = parseFloat(e.target.value);
    updateUrlParams({propLod: Math.round(window.manualPropLOD)}, ['lod']);
  });
}

// Free Camera toggle
var isFreeCamera = ChillFlightLogic.START_FREE_CAM || false;
window.isFreeCamera = isFreeCamera;
const freeCamToggle = document.getElementById('debug-free-cam-toggle');
if (freeCamToggle) {
  if (isFreeCamera) {
    freeCamToggle.checked = true;
    camera.rotation.order = 'YXZ'; // Better for fly-cam
    camera.rotation.z = 0;
    camera.up.set(0, 1, 0);

    let startCamX = planeGroup.position.x;
    let startCamZ = planeGroup.position.z;
    let startCamY = planeGroup.position.y;

    if (ChillFlightLogic.START_X !== null) {
      startCamX = ChillFlightLogic.START_X;
    } else if (
      ChillFlightLogic.parsedLon !== null &&
      ChillFlightLogic.parsedLon !== undefined
    ) {
      startCamX = ChillFlightLogic.parsedLon * 5000;
    }

    if (ChillFlightLogic.START_Z !== null) {
      startCamZ = ChillFlightLogic.START_Z;
    } else if (
      ChillFlightLogic.parsedLat !== null &&
      ChillFlightLogic.parsedLat !== undefined
    ) {
      startCamZ = -ChillFlightLogic.parsedLat * 5000;
    }

    if (ChillFlightLogic.START_Y !== null) {
      startCamY = ChillFlightLogic.START_Y;
    } else if (
      ChillFlightLogic.parsedAlt !== null &&
      ChillFlightLogic.parsedAlt !== undefined
    ) {
      startCamY = ChillFlightLogic.parsedAlt / 25 + 45.5;
    } else if (
      ChillFlightLogic.parsedLon !== null ||
      ChillFlightLogic.parsedLat !== null
    ) {
      try {
        const terrainHeight = ChillFlightLogic.getElevation(
          startCamX,
          startCamZ,
          simplex,
          {
            WATER_LEVEL: typeof WATER_LEVEL !== 'undefined' ? WATER_LEVEL : 40,
            MAP_WORLD_SIZE:
              typeof MAP_WORLD_SIZE !== 'undefined' ? MAP_WORLD_SIZE : 10000,
            MAP_HEIGHT_SCALE:
              typeof MAP_HEIGHT_SCALE !== 'undefined' ? MAP_HEIGHT_SCALE : 400,
          }
        );
        startCamY = terrainHeight + 400.0;
      } catch (e) {
        startCamY = planeGroup.position.y;
      }
    }

    camera.position.set(startCamX, startCamY, startCamZ);
    if (ChillFlightLogic.START_HEADING !== null)
      camera.rotation.y = THREE.MathUtils.degToRad(
        ChillFlightLogic.START_HEADING
      );
    if (ChillFlightLogic.START_PITCH !== null)
      camera.rotation.x = THREE.MathUtils.degToRad(
        ChillFlightLogic.START_PITCH
      );

    // Show the debug menu/telemetry so isDebugMode evaluates to true and freecam doesn't auto-reset
    const debugMenu = document.getElementById('debug-menu');
    const debugTelem = document.getElementById('debug-telemetry');
    if (debugMenu) debugMenu.style.display = 'block';
    if (debugTelem) debugTelem.style.display = 'block';
  } else {
    // Not free camera: spawn the plane at the requested coordinates
    if (ChillFlightLogic.START_X !== null)
      planeGroup.position.x = ChillFlightLogic.START_X;
    if (ChillFlightLogic.START_Y !== null)
      planeGroup.position.y = ChillFlightLogic.START_Y;
    if (ChillFlightLogic.START_Z !== null)
      planeGroup.position.z = ChillFlightLogic.START_Z;

    // Set rotation order to YXZ for proper flight controls
    planeGroup.rotation.order = 'YXZ';

    if (ChillFlightLogic.START_HEADING !== null)
      planeGroup.rotation.y = THREE.MathUtils.degToRad(
        ChillFlightLogic.START_HEADING
      );
    if (ChillFlightLogic.START_PITCH !== null)
      planeGroup.rotation.x = THREE.MathUtils.degToRad(
        ChillFlightLogic.START_PITCH
      );
    if (
      ChillFlightLogic.START_SPEED !== null &&
      !isNaN(ChillFlightLogic.START_SPEED)
    ) {
      const initialSpeed = Math.max(
        0,
        Math.min(10, ChillFlightLogic.START_SPEED)
      );
      flightSpeedMultiplier = initialSpeed;
      targetFlightSpeed = Math.min(
        typeof window.getMaxFlightSpeedMult === 'function'
          ? window.getMaxFlightSpeedMult()
          : 3.3333333333333335,
        initialSpeed
      );
    }

    // Ensure spawn altitude does not submerge the plane below the resting surface
    const spawnElev = getElevation(
      planeGroup.position.x,
      planeGroup.position.z
    );
    const spawnIsWater = spawnElev <= WATER_LEVEL + 0.1;
    const spawnRestingHeight = spawnIsWater
      ? WATER_LEVEL + 4.8
      : spawnElev + 12.0;
    if (planeGroup.position.y < spawnRestingHeight) {
      planeGroup.position.y = spawnRestingHeight;
    }
    if (spawnIsWater && targetFlightSpeed === 0) {
      if (typeof pontoonGroup !== 'undefined' && pontoonGroup) {
        pontoonGroup.visible = true;
        pontoonDeploymentProgress = 1;
        isDeployingPontoons = false;
        isRetractingPontoons = false;
        pontoonGroup.scale.setScalar(1);
        pontoonL.rotation.z = 0;
        pontoonR.rotation.z = 0;
        hingeLF.rotation.z = 0;
        hingeLB.rotation.z = 0;
        hingeRF.rotation.z = 0;
        hingeRB.rotation.z = 0;
        pontoonL.position.y = -4.5;
        pontoonR.position.y = -4.5;
      }
    }
  }

  if (ChillFlightLogic.START_DEBUG) {
    const debugMenu = document.getElementById('debug-menu');
    const debugTelem = document.getElementById('debug-telemetry');
    if (debugMenu) debugMenu.style.display = 'block';
    if (debugTelem) debugTelem.style.display = 'block';
  }
  document
    .getElementById('debug-free-cam-toggle')
    .addEventListener('change', (e) => {
      isFreeCamera = e.target.checked;
      window.isFreeCamera = isFreeCamera;
      if (isFreeCamera) {
        updateUrlParams({freecam: 'true'}, ['freeCamera']);
        // Force camera up vector to vertical
        camera.up.set(0, 1, 0);

        // Re-align camera to face the same forward direction but with zero roll
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
          camera.quaternion
        );
        const target = new THREE.Vector3().copy(camera.position).add(forward);

        camera.rotation.order = 'YXZ'; // Better for fly-cam
        camera.lookAt(target);
        camera.rotation.z = 0;
      } else {
        updateUrlParams({}, ['freecam', 'freeCamera']);
        camera.rotation.order = 'XYZ'; // Reset to default
      }
    });
}

const copyCamUrlBtn = document.getElementById('debug-copy-cam-url');
if (copyCamUrlBtn) {
  copyCamUrlBtn.addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('freecam', 'true');
    url.searchParams.delete('freeCamera');
    url.searchParams.set('debug', 'true');
    if (
      typeof ChillFlightLogic !== 'undefined' &&
      ChillFlightLogic.WORLD_SEED
    ) {
      url.searchParams.set('seed', ChillFlightLogic.WORLD_SEED);
    }
    url.searchParams.delete('lat');
    url.searchParams.delete('long');
    url.searchParams.delete('lon');
    url.searchParams.delete('alt');
    url.searchParams.delete('benchmark');
    url.searchParams.delete('speed');

    url.searchParams.set('x', Math.round(camera.position.x));
    url.searchParams.set('y', Math.round(camera.position.y));
    url.searchParams.set('z', Math.round(camera.position.z));
    const camEuler = new THREE.Euler().setFromQuaternion(
      camera.quaternion,
      'YXZ'
    );
    url.searchParams.set(
      'heading',
      Math.round(THREE.MathUtils.radToDeg(camEuler.y))
    );
    url.searchParams.set(
      'pitch',
      Math.round(THREE.MathUtils.radToDeg(camEuler.x))
    );
    let currentTod;
    if (window.manualTimeOfDay !== undefined) {
      currentTod = window.manualTimeOfDay;
    } else if (typeof timeOfDay !== 'undefined') {
      currentTod = timeOfDay / (Math.PI * 2);
    }
    if (currentTod !== undefined) {
      url.searchParams.set('tod', currentTod.toFixed(4));
    }
    if (typeof daySpeedMultiplier !== 'undefined') {
      url.searchParams.set('timeSpeed', daySpeedMultiplier);
    }
    if (typeof weatherType !== 'undefined') {
      if (weatherType !== 'auto') {
        url.searchParams.set('weather', weatherType);
      } else {
        url.searchParams.delete('weather');
      }
    }

    url.searchParams.delete('clouds');
    url.searchParams.delete('cloudCover');
    url.searchParams.delete('overcast');
    if (!showCloudsEnabled) {
      url.searchParams.set('cloud', 'none');
    } else if (manualCloudCover !== null) {
      url.searchParams.set('clouds', Number(manualCloudCover.toFixed(2)));
      url.searchParams.delete('cloud');
    } else {
      url.searchParams.delete('cloud');
    }

    if (Math.round(manualCloudHeight) !== 3000) {
      url.searchParams.set('cloudHeight', Math.round(manualCloudHeight));
    } else {
      url.searchParams.delete('cloudHeight');
      url.searchParams.delete('cloudAlt');
      url.searchParams.delete('cloudCeiling');
    }

    if (Number(manualCloudSpeed.toFixed(1)) !== 1.0) {
      url.searchParams.set('cloudSpeed', Number(manualCloudSpeed.toFixed(1)));
    } else {
      url.searchParams.delete('cloudSpeed');
    }
    const isCustom =
      typeof isCustomPalette !== 'undefined'
        ? isCustomPalette
        : window.isCustomPalette;
    const curPalette =
      typeof selectedPalette !== 'undefined'
        ? selectedPalette
        : window.selectedPalette;
    const curSeed =
      typeof currentPaletteSeed !== 'undefined'
        ? currentPaletteSeed
        : window.currentPaletteSeed;
    if (isCustom && curPalette) {
      const topHex = curPalette.top.toString(16).padStart(6, '0');
      const bottomHex = curPalette.bottom.toString(16).padStart(6, '0');
      url.searchParams.set('palette', `${topHex},${bottomHex}`);
    } else if (curSeed !== undefined) {
      url.searchParams.set('palette', curSeed);
    }

    const activePreset = graphicsPresetSelect
      ? graphicsPresetSelect.value
      : localStorage.getItem('chill_flight_graphics_preset');
    url.searchParams.delete('graphics');
    if (activePreset) {
      url.searchParams.set('preset', activePreset);
    }

    const showObjs = objectsToggle
      ? objectsToggle.checked
      : typeof ChillFlightLogic !== 'undefined'
        ? ChillFlightLogic.SHOW_OBJECTS
        : true;
    if (!showObjs) {
      url.searchParams.set('objects', 'none');
    } else {
      url.searchParams.delete('objects');
    }

    if (window.manualPropLOD !== undefined) {
      url.searchParams.set('propLod', Math.round(window.manualPropLOD));
      url.searchParams.delete('lod');
    }

    if (window.activePlaneType && window.activePlaneType !== 'classic') {
      url.searchParams.set('plane', window.activePlaneType);
    } else {
      url.searchParams.delete('plane');
      url.searchParams.delete('vehicle');
    }

    url.searchParams.delete('autopilot');
    url.searchParams.delete('auto');
    url.searchParams.delete('autoPilot');

    if (window.FullscreenMap && window.FullscreenMap.isOpen()) {
      url.searchParams.set('fullscreenmap', 'true');
    } else {
      url.searchParams.delete('fullscreenmap');
    }

    navigator.clipboard.writeText(url.toString()).then(() => {
      const originalText = copyCamUrlBtn.textContent;
      copyCamUrlBtn.textContent = 'Copied!';
      copyCamUrlBtn.style.color = '#4caf50';
      setTimeout(() => {
        copyCamUrlBtn.textContent = originalText;
        copyCamUrlBtn.style.color = 'white';
      }, 2000);
    });
  });
}

const copyPlaneUrlBtn = document.getElementById('debug-copy-plane-url');
if (copyPlaneUrlBtn) {
  copyPlaneUrlBtn.addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('freecam'); // ensure freecam is disabled to spawn at plane
    url.searchParams.delete('freeCamera');

    const debugMenu =
      typeof getCachedElement === 'function'
        ? getCachedElement('debug-menu')
        : document.getElementById('debug-menu');
    const isDebugOpen =
      (debugMenu && debugMenu.style.display === 'block') ||
      url.searchParams.get('debug') === 'true' ||
      url.searchParams.get('debug') === '1' ||
      url.searchParams.get('debug') === '';
    if (isDebugOpen) {
      url.searchParams.set('debug', 'true');
    } else {
      url.searchParams.delete('debug');
    }

    if (
      typeof ChillFlightLogic !== 'undefined' &&
      ChillFlightLogic.WORLD_SEED
    ) {
      url.searchParams.set('seed', ChillFlightLogic.WORLD_SEED);
    }
    url.searchParams.delete('lat');
    url.searchParams.delete('long');
    url.searchParams.delete('lon');
    url.searchParams.delete('alt');
    url.searchParams.delete('benchmark');

    url.searchParams.set('x', Math.round(planeGroup.position.x));
    url.searchParams.set('y', Math.round(planeGroup.position.y));
    url.searchParams.set('z', Math.round(planeGroup.position.z));
    const planeEuler = new THREE.Euler().setFromQuaternion(
      planeGroup.quaternion,
      'YXZ'
    );
    url.searchParams.set(
      'heading',
      Math.round(THREE.MathUtils.radToDeg(planeEuler.y))
    );
    url.searchParams.set(
      'pitch',
      Math.round(THREE.MathUtils.radToDeg(planeEuler.x))
    );
    if (typeof flightSpeedMultiplier !== 'undefined') {
      url.searchParams.set('speed', Number(flightSpeedMultiplier.toFixed(2)));
    }
    let currentTod;
    if (window.manualTimeOfDay !== undefined) {
      currentTod = window.manualTimeOfDay;
    } else if (typeof timeOfDay !== 'undefined') {
      currentTod = timeOfDay / (Math.PI * 2);
    }
    if (currentTod !== undefined) {
      url.searchParams.set('tod', currentTod.toFixed(4));
    }
    if (typeof daySpeedMultiplier !== 'undefined') {
      url.searchParams.set('timeSpeed', daySpeedMultiplier);
    }
    if (typeof weatherType !== 'undefined') {
      if (weatherType !== 'auto') {
        url.searchParams.set('weather', weatherType);
      } else {
        url.searchParams.delete('weather');
      }
    }

    url.searchParams.delete('clouds');
    url.searchParams.delete('cloudCover');
    url.searchParams.delete('overcast');
    if (!showCloudsEnabled) {
      url.searchParams.set('cloud', 'none');
    } else if (manualCloudCover !== null) {
      url.searchParams.set('clouds', Number(manualCloudCover.toFixed(2)));
      url.searchParams.delete('cloud');
    } else {
      url.searchParams.delete('cloud');
    }

    if (Math.round(manualCloudHeight) !== 3000) {
      url.searchParams.set('cloudHeight', Math.round(manualCloudHeight));
    } else {
      url.searchParams.delete('cloudHeight');
      url.searchParams.delete('cloudAlt');
      url.searchParams.delete('cloudCeiling');
    }

    if (Number(manualCloudSpeed.toFixed(1)) !== 1.0) {
      url.searchParams.set('cloudSpeed', Number(manualCloudSpeed.toFixed(1)));
    } else {
      url.searchParams.delete('cloudSpeed');
    }
    const isCustom =
      typeof isCustomPalette !== 'undefined'
        ? isCustomPalette
        : window.isCustomPalette;
    const curPalette =
      typeof selectedPalette !== 'undefined'
        ? selectedPalette
        : window.selectedPalette;
    const curSeed =
      typeof currentPaletteSeed !== 'undefined'
        ? currentPaletteSeed
        : window.currentPaletteSeed;
    if (isCustom && curPalette) {
      const topHex = curPalette.top.toString(16).padStart(6, '0');
      const bottomHex = curPalette.bottom.toString(16).padStart(6, '0');
      url.searchParams.set('palette', `${topHex},${bottomHex}`);
    } else if (curSeed !== undefined) {
      url.searchParams.set('palette', curSeed);
    }

    const activePreset = graphicsPresetSelect
      ? graphicsPresetSelect.value
      : localStorage.getItem('chill_flight_graphics_preset');
    url.searchParams.delete('graphics');
    if (activePreset) {
      url.searchParams.set('preset', activePreset);
    }

    const showObjs = objectsToggle
      ? objectsToggle.checked
      : typeof ChillFlightLogic !== 'undefined'
        ? ChillFlightLogic.SHOW_OBJECTS
        : true;
    if (!showObjs) {
      url.searchParams.set('objects', 'none');
    } else {
      url.searchParams.delete('objects');
    }

    if (window.manualPropLOD !== undefined) {
      url.searchParams.set('propLod', Math.round(window.manualPropLOD));
      url.searchParams.delete('lod');
    }

    if (window.activePlaneType && window.activePlaneType !== 'classic') {
      url.searchParams.set('plane', window.activePlaneType);
    } else {
      url.searchParams.delete('plane');
      url.searchParams.delete('vehicle');
    }

    if (window.autopilotEnabled) {
      url.searchParams.set('autopilot', 'true');
    } else {
      url.searchParams.delete('autopilot');
      url.searchParams.delete('auto');
      url.searchParams.delete('autoPilot');
    }

    if (window.FullscreenMap && window.FullscreenMap.isOpen()) {
      url.searchParams.set('fullscreenmap', 'true');
    } else {
      url.searchParams.delete('fullscreenmap');
    }

    navigator.clipboard.writeText(url.toString()).then(() => {
      const originalText = copyPlaneUrlBtn.textContent;
      copyPlaneUrlBtn.textContent = 'Copied!';
      copyPlaneUrlBtn.style.color = '#4caf50';
      setTimeout(() => {
        copyPlaneUrlBtn.textContent = originalText;
        copyPlaneUrlBtn.style.color = 'white';
      }, 2000);
    });
  });
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
  if (graphicsPresetSelect) graphicsPresetSelect.value = initialPreset;
  applyGraphicsPreset(initialPreset);
} else if (window.detectGraphicsPreset) {
  window.detectGraphicsPreset().then((detected) => {
    if (graphicsPresetSelect) graphicsPresetSelect.value = detected;
    applyGraphicsPreset(detected);
  });
} else {
  const defaultPreset = 'mid';
  if (graphicsPresetSelect) graphicsPresetSelect.value = defaultPreset;
  applyGraphicsPreset(defaultPreset);
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

// --- DYNAMIC PERFORMANCE SCALING ---
class DynamicPerformanceMonitor {
  constructor() {
    this.windowSize = 30;
    this.frameTimeRing = new Float32Array(this.windowSize);
    this.ringIndex = 0;
    this.ringSum = 0;
    this.ringCount = 0;

    // Config (in ms/frame)
    this.targetFrameTime = 16.67; // 60 FPS
    this.slightlyOverloaded = 20; // 50 FPS
    this.moderatelyOverloaded = 25; // 40 FPS
    this.severelyOverloaded = 33.33; // 30 FPS

    // LOD state
    this.lodMultiplier = 1.0;
    this.cooldownFrames = 0;
    this.cooldownMax = 30; // Wait 30 frames between adjustments

    // Dynamic resolution scaling (DRS) state
    this.pixelRatioMultiplier = 1.0;
    this._minPixelRatioMult = 0.8; // Floor: never drop below 80% of base resolution

    // Shadow throttling state
    this.shadowCadence = 1; // 1 = every frame, 2 = every other, 4 = every 4th, 0 = off
    this._frameCount = 0;
    this._nightCulling = false; // True when dayFactor < 0.05

    // Chunk budget state
    this._chunkBudgetMs = 4.0; // Default 4ms per frame
  }

  update(delta) {
    const frameTimeMs = delta * 1000;
    this._frameCount++;

    if (this.ringCount < this.windowSize) {
      this.ringSum += frameTimeMs;
      this.ringCount++;
    } else {
      this.ringSum += frameTimeMs - this.frameTimeRing[this.ringIndex];
    }
    this.frameTimeRing[this.ringIndex] = frameTimeMs;
    this.ringIndex = (this.ringIndex + 1) % this.windowSize;

    if (this.cooldownFrames > 0) {
      this.cooldownFrames--;
      return;
    }

    if (this.ringCount >= this.windowSize) {
      const avgFrameTime = this.ringSum / this.ringCount;
      let changed = false;

      // --- LOD scaling ---
      if (avgFrameTime > this.severelyOverloaded) {
        if (this.lodMultiplier > 0.2) {
          this.lodMultiplier = Math.max(0.2, this.lodMultiplier - 0.2);
          changed = true;
        }
      } else if (avgFrameTime > this.moderatelyOverloaded) {
        if (this.lodMultiplier > 0.4) {
          this.lodMultiplier = Math.max(0.4, this.lodMultiplier - 0.1);
          changed = true;
        }
      } else if (avgFrameTime > this.slightlyOverloaded) {
        if (this.lodMultiplier > 0.6) {
          this.lodMultiplier = Math.max(0.6, this.lodMultiplier - 0.1);
          changed = true;
        }
      } else if (avgFrameTime <= this.targetFrameTime * 1.05) {
        if (this.lodMultiplier < 1.0) {
          this.lodMultiplier = Math.min(1.0, this.lodMultiplier + 0.1);
          changed = true;
        }
      }

      // --- Dynamic resolution scaling (DRS) ---
      // Reserve DRS for moderate/severe load (< 40 FPS); let LOD and shadows handle slight dips.
      if (avgFrameTime > this.severelyOverloaded) {
        if (this.pixelRatioMultiplier > this._minPixelRatioMult) {
          this.pixelRatioMultiplier = Math.max(
            this._minPixelRatioMult,
            this.pixelRatioMultiplier - 0.1
          );
          changed = true;
        }
      } else if (avgFrameTime > this.moderatelyOverloaded) {
        if (this.pixelRatioMultiplier > this._minPixelRatioMult) {
          this.pixelRatioMultiplier = Math.max(
            this._minPixelRatioMult,
            this.pixelRatioMultiplier - 0.05
          );
          changed = true;
        }
      } else if (avgFrameTime <= this.targetFrameTime * 1.05) {
        if (this.pixelRatioMultiplier < 1.0) {
          this.pixelRatioMultiplier = Math.min(
            1.0,
            this.pixelRatioMultiplier + 0.05
          );
          changed = true;
        }
      }

      // --- Shadow cadence scaling ---
      let newCadence = this.shadowCadence;
      if (this._nightCulling) {
        newCadence = 0;
      } else if (avgFrameTime > this.severelyOverloaded) {
        newCadence = 4;
      } else if (avgFrameTime > this.moderatelyOverloaded) {
        newCadence = 3;
      } else if (avgFrameTime > this.slightlyOverloaded) {
        newCadence = 2;
      } else if (avgFrameTime <= this.targetFrameTime * 1.05) {
        newCadence = 1;
      }
      if (newCadence !== this.shadowCadence) {
        this.shadowCadence = newCadence;
        changed = true;
      }

      // --- Chunk budget scaling ---
      if (avgFrameTime > this.severelyOverloaded) {
        this._chunkBudgetMs = 1.0;
      } else if (avgFrameTime > this.moderatelyOverloaded) {
        this._chunkBudgetMs = 2.0;
      } else if (avgFrameTime > this.slightlyOverloaded) {
        this._chunkBudgetMs = 3.0;
      } else {
        this._chunkBudgetMs = 4.0;
      }

      if (changed) {
        this.applyEffectiveLOD();
        this.applyDRS();
        this.cooldownFrames = this.cooldownMax;
      }
    }
  }

  /**
   * Update night culling state. Call each frame with the current dayFactor.
   * When dayFactor < 0.05, shadows are entirely skipped (no shadow pass at all).
   */
  updateDayFactor(dayFactor) {
    this._nightCulling = dayFactor < 0.05;
    // If we just entered night, immediately disable shadows without waiting for cooldown
    if (this._nightCulling && this.shadowCadence !== 0) {
      this.shadowCadence = 0;
    }
  }

  /**
   * Returns true if the shadow map should be updated this frame.
   * When cadence is 0 (night culling), always returns false.
   */
  shouldUpdateShadows() {
    if (this.shadowCadence === 0) return false;
    return this._frameCount % this.shadowCadence === 0;
  }

  /**
   * Returns the chunk generation time budget in ms for this frame.
   * During the loading screen, the caller should use 33ms instead.
   */
  getChunkBudget() {
    return this._chunkBudgetMs;
  }

  /**
   * Apply DRS by adjusting the renderer's pixel ratio relative to the base.
   */
  applyDRS() {
    if (
      typeof renderer !== 'undefined' &&
      renderer &&
      renderer.xr &&
      renderer.xr.isPresenting
    ) {
      return; // Do not manipulate pixel ratio while WebXR manages stereo framebuffers
    }
    const baseRatio =
      typeof window._basePixelRatio !== 'undefined'
        ? window._basePixelRatio
        : 1.0;
    const effectiveRatio = baseRatio * this.pixelRatioMultiplier;
    if (typeof renderer !== 'undefined' && renderer) {
      renderer.setPixelRatio(effectiveRatio);
    }
  }

  getEffectiveLOD() {
    const baseLOD =
      window.manualPropLOD !== undefined
        ? window.manualPropLOD
        : typeof PROP_LOD_DISTANCE !== 'undefined'
          ? PROP_LOD_DISTANCE
          : 4200;
    return baseLOD * this.lodMultiplier;
  }

  getSmoothedFrameTime() {
    return this.ringCount > 0 ? this.ringSum / this.ringCount : 0;
  }

  getAvgFPS() {
    if (this.ringCount === 0) return 0;
    const avgMs = this.ringSum / this.ringCount;
    return avgMs > 0 ? Math.round(1000 / avgMs) : 0;
  }

  get1PercentLowFPS() {
    if (this.ringCount === 0) return 0;
    const count = this.ringCount;
    const slice = new Float32Array(count);
    slice.set(this.frameTimeRing.subarray(0, count));
    slice.sort();
    const p1Count = Math.max(1, Math.floor(count * 0.05));
    let sum = 0;
    for (let i = count - p1Count; i < count; i++) {
      sum += slice[i];
    }
    const worstMs = sum / p1Count;
    return worstMs > 0 ? Math.round(1000 / worstMs) : 0;
  }

  applyEffectiveLOD() {
    const newLOD = this.getEffectiveLOD();
    // Use the global chunks map from terrain.js if available
    const chunkMap =
      typeof window.chunks !== 'undefined'
        ? window.chunks
        : typeof chunks !== 'undefined'
          ? chunks
          : null;
    if (chunkMap) {
      chunkMap.forEach((chunk) => {
        if (
          chunk.userData.objectsGroup &&
          chunk.userData.objectsGroup.levels &&
          chunk.userData.objectsGroup.levels.length > 1
        ) {
          chunk.userData.objectsGroup.levels[1].distance = newLOD;
        }
      });
    }
  }
}

const performanceMonitor = new DynamicPerformanceMonitor();
window.performanceMonitor = performanceMonitor;

// Disable automatic shadow map updates; DynamicPerformanceMonitor controls the cadence
if (typeof renderer !== 'undefined' && renderer) {
  renderer.shadowMap.autoUpdate = false;
}

// Start loop
var isAnimationLoopRunning = false;

// Mobile controls
var btnUp = document.getElementById('mobile-spd-up');
var btnDown = document.getElementById('mobile-spd-down');
