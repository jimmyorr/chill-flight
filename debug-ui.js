// --- DEBUG UI EXTRACTED FROM GAME.JS ---
import * as THREE from 'three';
import {
  CHUNK_SIZE,
  MAP_HEIGHT_SCALE,
  MAP_WORLD_SIZE,
  UNITS_TO_M,
  WATER_LEVEL,
  getCachedElement,
  updateUrlParams,
  waterSwell,
} from './constants.js';
import {log} from './logger.js';
import {
  camera,
  currentPaletteSeed,
  dirLight,
  isCustomPalette,
  renderer,
  selectedPalette,
  skyUniforms,
} from './sky.js';
import {
  applyScriptedWeather,
  manualCloudCover,
  manualCloudHeight,
  manualCloudSpeed,
  showCloudsEnabled,
  weatherType,
} from './weather-manager.js';
import {
  chunks,
  getElevation,
  waterMaterial,
  waterUniforms,
} from './terrain-geometry.js';
import {scene} from './scene.js';
import {
  HEADLIGHT_GLOW_INTENSITY,
  HEADLIGHT_INTENSITY,
  activePlaneType,
  getMaxFlightSpeedMult,
  headlight,
  headlightGlow,
  planeGroup,
  planeMat,
  planeWhiteMat,
  poseGear,
  setActivePlane,
} from './airplane.js';
import {
  _lastChunkUpdatePos,
  currentCinematicIndex,
} from './game-input-bindings.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {
  clearAllChunks,
  setShowLodColors,
  toggleProceduralObjects,
  updateChunks,
} from './terrain-chunks.js';
import {updateFarTerrain} from './far-terrain.js';
import {refreshArchDetail} from './arches.js';
import {simplex} from './noise.js';
import {state} from './state.js';
import {performanceMonitor} from './game-performance.js';
import {hooks} from './hooks.js';
import {setPerfReportUrl} from './perf-hud.js';

// Props as the page asked for them (?objects=none turns them off), before
// any preset hides them
const URL_SHOWS_OBJECTS = ChillFlightLogic.SHOW_OBJECTS;

export function applyGraphicsPreset(preset) {
  let segments;
  let dist;
  let propLod;
  let fps;

  switch (preset) {
    case 'ultra':
      segments = 50;
      dist = 8;
      propLod = 6000;
      fps = 60;
      break;
    case 'high':
      segments = 30;
      dist = 6;
      propLod = 4000;
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
    } catch {
      /* ignore */
    }
  }

  // Set global variables
  state.graphicsPreset = preset;
  state.SEGMENTS = segments;
  refreshArchDetail();
  state.RENDER_DISTANCE = dist;
  state.PROP_LOD_DISTANCE = propLod;
  if (typeof state.maxFPS !== 'undefined') {
    state.maxFPS = ChillFlightLogic.MAX_FPS ?? fps;
    state.frameMinDelay = state.maxFPS > 0 ? 1000 / state.maxFPS : 0;
  }

  // Sync UI slider if not manually overridden
  const slider = document.getElementById('debug-prop-lod-slider');
  const sliderVal = document.getElementById('debug-prop-lod-slider-val');
  if (slider && state.manualPropLOD === undefined) {
    slider.value = propLod;
    if (sliderVal) sliderVal.textContent = propLod;
  }

  log.info(
    `Graphics preset applied: ${preset} (SEGMENTS=${segments}, DIST=${dist}, LOD=${propLod}, FPS=${fps})`
  );

  // Pixel ratio: Low and Mid draw at 3/4 of the screen's (up to 1.5x); High
  // and Ultra at the screen's own, up to 2x. High is Mid's world drawn sharp,
  // Ultra adds the longest view and prop distances (laptops and desktops)
  const pixelRatio =
    preset === 'high' || preset === 'ultra'
      ? Math.min(window.devicePixelRatio, 2)
      : Math.min(window.devicePixelRatio, 2) * 0.75;

  // Store the preset's base pixel ratio so DRS can scale relative to it
  state._basePixelRatio = pixelRatio;

  // Low keeps the props but draws only their cheapest models, and not as
  // far (terrain-chunks.js, LEAN_PROP_RADIUS)
  state.leanProps = preset === 'low';
  if (URL_SHOWS_OBJECTS !== state._enableObjects)
    toggleProceduralObjects(URL_SHOWS_OBJECTS, false);

  if (renderer) {
    renderer.setPixelRatio(pixelRatio);
  }

  // Reset DRS state when preset changes so we start fresh
  if (performanceMonitor) {
    performanceMonitor.reset();
  }

  // Sky clouds on every preset (?clouds=none or the debug toggle hides them)
  if (skyUniforms !== undefined) {
    skyUniforms.uShowClouds.value = showCloudsEnabled;
  }

  // Toggle overdraw optimizations (transparency)
  const isLow = segments <= 20;
  // The distant terrain ring (about 20 draw calls) on every preset: without
  // it Low's horizon was empty sky past 6 km
  state.farTerrainEnabled = true;

  waterMaterial.transparent = !isLow;
  waterMaterial.opacity = isLow ? 1.0 : 0.6;
  waterMaterial.depthWrite = isLow ? true : false;
  waterMaterial.needsUpdate = true;

  const enableShadows = segments > 20;
  if (dirLight.castShadow !== enableShadows) {
    dirLight.castShadow = enableShadows;
    if (enableShadows && renderer) renderer.shadowMap.needsUpdate = true;
  }

  // Clear all existing chunks to force regeneration
  const hadChunks = chunks.size > 0 || state.chunkQueue.length > 0;
  clearAllChunks();
  _lastChunkUpdatePos.set(Infinity, Infinity, Infinity);
  if (hadChunks) {
    updateChunks();
    const target = state.isFreeCamera ? camera : planeGroup;
    _lastChunkUpdatePos.copy(target.position);
  }
}

var showChunkBorders = false;
const _chunkBorderHelpers = new Map(); // key -> Box3Helper
const _chunkBorderColor = new THREE.Color(0x00ffff);

export function syncChunkBorders() {
  if (!showChunkBorders) {
    if (_chunkBorderHelpers.size > 0) {
      _chunkBorderHelpers.forEach((helper) => scene.remove(helper));
      _chunkBorderHelpers.clear();
    }
    return;
  }
  const cs = CHUNK_SIZE;
  const halfH = 800;
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
  _chunkBorderHelpers.forEach((helper, key) => {
    if (!chunks.has(key)) {
      scene.remove(helper);
      _chunkBorderHelpers.delete(key);
    }
  });
}

export function syncGraphicsPresetUI(preset) {
  const group = document.getElementById('graphics-preset-group');
  if (!group) return;
  for (const btn of group.querySelectorAll('[data-preset]')) {
    const active = btn.dataset.preset === preset;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', String(active));
  }
}

export function initDebugUI() {
  const graphicsPresetGroup = document.getElementById('graphics-preset-group');
  if (graphicsPresetGroup) {
    graphicsPresetGroup.addEventListener('click', (e) => {
      const btn = e.target.closest?.('[data-preset]');
      if (!btn) return;
      const preset = btn.dataset.preset;
      localStorage.setItem('chill_flight_graphics_preset_manual', '1');
      syncGraphicsPresetUI(preset);
      applyGraphicsPreset(preset);
      updateUrlParams({preset}, ['graphics']);
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
      clearAllChunks();
      _lastChunkUpdatePos.set(Infinity, Infinity, Infinity);
      updateChunks();

      log.info(`Island type changed to: ${val}`);
    });
  }

  // Procedural Objects toggle
  const objectsToggle = document.getElementById('debug-objects-toggle');
  if (objectsToggle) {
    objectsToggle.checked = ChillFlightLogic.SHOW_OBJECTS;
    objectsToggle.addEventListener('change', (e) => {
      toggleProceduralObjects(e.target.checked);
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

  const lodColorsToggle = document.getElementById('debug-lod-colors-toggle');
  const startLodColors =
    typeof window !== 'undefined' &&
    /^(1|true|on)$/i.test(
      new URLSearchParams(window.location.search).get('lodColors') || ''
    );
  if (startLodColors) setShowLodColors(true);
  if (lodColorsToggle) {
    lodColorsToggle.checked = startLodColors;
    lodColorsToggle.addEventListener('change', (e) => {
      setShowLodColors(e.target.checked);
    });
  }

  // Fog slider
  const fogSlider = document.getElementById('debug-fog-slider');
  const baseFogVal = document.getElementById('debug-base-fog-val');
  if (fogSlider) {
    fogSlider.addEventListener('input', (e) => {
      state.manualBaseFogDensity = parseFloat(e.target.value);
      if (baseFogVal)
        baseFogVal.textContent = state.manualBaseFogDensity.toFixed(5);
    });
  }

  // Prop LOD slider
  const propLodSlider = document.getElementById('debug-prop-lod-slider');
  const propLodSliderVal = document.getElementById('debug-prop-lod-slider-val');
  if (propLodSlider) {
    // Initialize to current PROP_LOD_DISTANCE value or URL START_PROP_LOD
    let initLod =
      typeof state.PROP_LOD_DISTANCE !== 'undefined'
        ? state.PROP_LOD_DISTANCE
        : 4200;
    if (
      ChillFlightLogic.START_PROP_LOD !== null &&
      !isNaN(ChillFlightLogic.START_PROP_LOD)
    ) {
      initLod = ChillFlightLogic.START_PROP_LOD;
      state.manualPropLOD = initLod;
    }
    propLodSlider.value = initLod;
    if (propLodSliderVal) propLodSliderVal.textContent = Math.round(initLod);

    propLodSlider.addEventListener('input', (e) => {
      state.manualPropLOD = parseFloat(e.target.value);
      if (propLodSliderVal)
        propLodSliderVal.textContent = Math.round(state.manualPropLOD);
      if (performanceMonitor) {
        performanceMonitor.applyEffectiveLOD();
      }
    });
    propLodSlider.addEventListener('change', (e) => {
      state.manualPropLOD = parseFloat(e.target.value);
      updateUrlParams({propLod: Math.round(state.manualPropLOD)}, ['lod']);
    });
  }

  // Places the plane from the URL: x/y/z (lat/long/alt are applied in
  // airplane.js), heading, pitch, roll and speed, kept above ground or water.
  const placePlaneFromUrl = () => {
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
    if (ChillFlightLogic.START_ROLL !== null)
      planeGroup.rotation.z = THREE.MathUtils.degToRad(
        ChillFlightLogic.START_ROLL
      );
    if (
      ChillFlightLogic.START_SPEED !== null &&
      !isNaN(ChillFlightLogic.START_SPEED)
    ) {
      const initialSpeed = Math.max(
        0,
        Math.min(10, ChillFlightLogic.START_SPEED)
      );
      state.flightSpeedMultiplier = initialSpeed;
      state.targetFlightSpeed = Math.min(getMaxFlightSpeedMult(), initialSpeed);
    }

    // Ensure spawn altitude does not submerge the plane below the resting surface
    const spawnElev = getElevation(
      planeGroup.position.x,
      planeGroup.position.z
    );
    const spawnIsWater = spawnElev <= WATER_LEVEL + 0.1;
    const gearStart = ChillFlightLogic.START_GEAR;
    const wheelDepth = state.airplaneModel?.wheelDepth;
    const waterDepth = state.airplaneModel?.waterDepth ?? 4.8;
    const spawnSwell = spawnIsWater
      ? waterSwell(
          planeGroup.position.x,
          planeGroup.position.z,
          waterUniforms.uTime.value,
          WATER_LEVEL - spawnElev
        ).height
      : 0;
    const spawnRestingHeight = spawnIsWater
      ? WATER_LEVEL + spawnSwell + waterDepth
      : gearStart === true && wheelDepth !== undefined
        ? spawnElev + wheelDepth
        : spawnElev + 12.0;
    if (planeGroup.position.y < spawnRestingHeight) {
      planeGroup.position.y = spawnRestingHeight;
    }
    if (gearStart !== null) {
      state.gearWanted = gearStart;
      state.gearExtension = gearStart ? 1 : 0;
      poseGear(state.gearExtension);
    } else if (spawnIsWater && state.targetFlightSpeed === 0) {
      // Starting stopped on the water: seaplane floats down, retractable wheels stowed
      const wantPontoons = Boolean(state.airplaneModel?.pontoonGroup);
      state.gearWanted = wantPontoons;
      state.gearExtension = wantPontoons ? 1 : 0;
      poseGear(state.gearExtension);
    }
  };

  // Free Camera toggle
  state.isFreeCamera = ChillFlightLogic.START_FREE_CAM || false;
  const freeCamToggle = document.getElementById('debug-free-cam-toggle');
  if (freeCamToggle) {
    if (state.isFreeCamera) {
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
        startCamY = ChillFlightLogic.parsedAlt / UNITS_TO_M + 45.5;
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
              WATER_LEVEL,
              MAP_WORLD_SIZE,
              MAP_HEIGHT_SCALE,
            }
          );
          startCamY = terrainHeight + 400.0;
        } catch {
          startCamY = planeGroup.position.y;
        }
      }

      // camX/camY/camZ/camHeading/camPitch: the plane goes where x/y/z,
      // heading, pitch and roll say, and the camera where these do (anything
      // left out starts at the plane).
      const separateCamera = ChillFlightLogic.HAS_CAM_PLACEMENT;
      if (separateCamera) {
        placePlaneFromUrl();
        startCamX = ChillFlightLogic.START_CAM_X ?? planeGroup.position.x;
        startCamY = ChillFlightLogic.START_CAM_Y ?? planeGroup.position.y;
        startCamZ = ChillFlightLogic.START_CAM_Z ?? planeGroup.position.z;
      }
      const camHeading = separateCamera
        ? ChillFlightLogic.START_CAM_HEADING
        : ChillFlightLogic.START_HEADING;
      const camPitch = separateCamera
        ? ChillFlightLogic.START_CAM_PITCH
        : ChillFlightLogic.START_PITCH;

      camera.position.set(startCamX, startCamY, startCamZ);
      if (camHeading !== null)
        camera.rotation.y = THREE.MathUtils.degToRad(camHeading);
      if (camPitch !== null)
        camera.rotation.x = THREE.MathUtils.degToRad(camPitch);

      // Show the debug menu/telemetry so isDebugMode evaluates to true and freecam doesn't auto-reset
      const debugMenu = document.getElementById('debug-menu');
      if (debugMenu) debugMenu.style.display = 'block';
    } else {
      placePlaneFromUrl();
    }

    if (ChillFlightLogic.START_DEBUG) {
      const debugMenu = document.getElementById('debug-menu');
      if (debugMenu) debugMenu.style.display = 'block';
    }
    document
      .getElementById('debug-free-cam-toggle')
      .addEventListener('change', (e) => {
        state.isFreeCamera = e.target.checked;
        if (state.isFreeCamera) {
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

  // Builds a URL that reopens the game at the camera's (free camera) or the
  // plane's current position, with the current debug settings.
  const buildDebugUrl = (forCamera) => {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    params.set('start', '1');
    params.set('music', '0');

    if (forCamera) {
      params.set('freecam', 'true');
      params.delete('freeCamera');
      params.set('debug', 'true');
    } else {
      params.delete('freecam'); // spawn at the plane
      params.delete('freeCamera');
      const debugMenu = getCachedElement('debug-menu');
      const isDebugOpen =
        (debugMenu && debugMenu.style.display === 'block') ||
        params.get('debug') === 'true' ||
        params.get('debug') === '1' ||
        params.get('debug') === '';
      if (isDebugOpen) {
        params.set('debug', 'true');
      } else {
        params.delete('debug');
      }
    }

    if (ChillFlightLogic.WORLD_SEED) {
      params.set('seed', ChillFlightLogic.WORLD_SEED);
    }
    params.delete('lat');
    params.delete('long');
    params.delete('lon');
    params.delete('alt');
    params.delete('benchmark');
    if (forCamera) params.delete('speed');

    // The plane's pose; with the free camera, the camera's too, separately
    const deg = (rad) => Math.round(THREE.MathUtils.radToDeg(rad));
    const planeEuler = new THREE.Euler().setFromQuaternion(
      planeGroup.quaternion,
      'YXZ'
    );
    params.set('x', Math.round(planeGroup.position.x));
    params.set('y', Math.round(planeGroup.position.y));
    params.set('z', Math.round(planeGroup.position.z));
    params.set('heading', deg(planeEuler.y));
    params.set('pitch', deg(planeEuler.x));
    const camParams = ['camX', 'camY', 'camZ', 'camHeading', 'camPitch'];
    if (forCamera) {
      // The plane holds still under the free camera, so its bank holds too
      params.set('roll', deg(planeEuler.z));
      const camEuler = new THREE.Euler().setFromQuaternion(
        camera.quaternion,
        'YXZ'
      );
      params.set('camX', Math.round(camera.position.x));
      params.set('camY', Math.round(camera.position.y));
      params.set('camZ', Math.round(camera.position.z));
      params.set('camHeading', deg(camEuler.y));
      params.set('camPitch', deg(camEuler.x));
    } else {
      params.delete('roll');
      camParams.forEach((name) => params.delete(name));
    }
    if (!forCamera && typeof state.flightSpeedMultiplier !== 'undefined') {
      params.set('speed', Number(state.flightSpeedMultiplier.toFixed(2)));
    }

    let currentTod;
    if (state.manualTimeOfDay !== undefined) {
      currentTod = state.manualTimeOfDay;
    } else if (typeof state.timeOfDay !== 'undefined') {
      currentTod = state.timeOfDay / (Math.PI * 2);
    }
    if (currentTod !== undefined) {
      params.set('tod', currentTod.toFixed(4));
    }
    if (typeof state.daySpeedMultiplier !== 'undefined') {
      params.set('timeSpeed', state.daySpeedMultiplier);
    }

    if (weatherType !== 'auto') {
      params.set('weather', weatherType);
    } else {
      params.delete('weather');
    }

    params.delete('clouds');
    params.delete('cloudCover');
    params.delete('overcast');
    if (!showCloudsEnabled) {
      params.set('cloud', 'none');
    } else if (manualCloudCover !== null) {
      params.set('clouds', Number(manualCloudCover.toFixed(2)));
      params.delete('cloud');
    } else {
      params.delete('cloud');
    }

    if (Math.round(manualCloudHeight) !== 3000) {
      params.set('cloudHeight', Math.round(manualCloudHeight));
    } else {
      params.delete('cloudHeight');
      params.delete('cloudAlt');
      params.delete('cloudCeiling');
    }

    if (Number(manualCloudSpeed.toFixed(1)) !== 1.0) {
      params.set('cloudSpeed', Number(manualCloudSpeed.toFixed(1)));
    } else {
      params.delete('cloudSpeed');
    }

    if (isCustomPalette && selectedPalette) {
      const topHex = selectedPalette.top.toString(16).padStart(6, '0');
      const bottomHex = selectedPalette.bottom.toString(16).padStart(6, '0');
      params.set('palette', `${topHex},${bottomHex}`);
    } else if (currentPaletteSeed !== undefined) {
      params.set('palette', currentPaletteSeed);
    }

    const activePreset =
      graphicsPresetGroup?.querySelector('[data-preset].active')?.dataset
        .preset || localStorage.getItem('chill_flight_graphics_preset');
    params.delete('graphics');
    if (activePreset) {
      params.set('preset', activePreset);
    }

    const showObjs = objectsToggle
      ? objectsToggle.checked
      : ChillFlightLogic.SHOW_OBJECTS;
    if (!showObjs) {
      params.set('objects', 'none');
    } else {
      params.delete('objects');
    }

    if (state.manualPropLOD !== undefined) {
      params.set('propLod', Math.round(state.manualPropLOD));
      params.delete('lod');
    }

    if (activePlaneType && activePlaneType !== 'biplane') {
      params.set('plane', activePlaneType);
    } else {
      params.delete('plane');
      params.delete('vehicle');
    }

    // Autopilot only carries over when spawning at the plane.
    if (!forCamera && state.autopilotEnabled) {
      params.set('autopilot', 'true');
    } else {
      params.delete('autopilot');
      params.delete('auto');
      params.delete('autoPilot');
    }

    if (hooks.fullscreenMap && hooks.fullscreenMap.isOpen()) {
      params.set('fullscreenmap', 'true');
    } else {
      params.delete('fullscreenmap');
    }

    // --- The rest of the shot: livery, camera, lights, clocks, islands ---
    const liveryIndex = ChillFlightLogic.PLANE_COLORS.indexOf(state.planeColor);
    if (liveryIndex >= 0) {
      params.set('livery', ChillFlightLogic.LIVERY_NAMES[liveryIndex]);
    }

    // A custom ?camOffset= or ?camFrame= view is the first cinematic config
    // (game.js); keep its parameters while it's the one showing.
    const isCustomCinematic =
      state.cameraMode === 'cinematic' &&
      (ChillFlightLogic.START_CAM_OFFSET || ChillFlightLogic.START_CAM_FRAME) &&
      currentCinematicIndex === 0;
    if (!isCustomCinematic) {
      params.delete('camOffset');
      params.delete('camLook');
      params.delete('fov');
    }
    if (
      state.cameraMode === 'cinematic' &&
      state.camFrame &&
      state.camFrame !== 'yaw'
    ) {
      params.set('camFrame', state.camFrame);
    } else {
      params.delete('camFrame');
    }
    if (!forCamera && ChillFlightLogic.START_GEAR !== null) {
      params.set('gear', state.gearWanted ? '1' : '0');
    } else {
      params.delete('gear');
    }
    params.delete('angle');
    if (forCamera || state.cameraMode === 'follow') {
      params.delete('camera');
    } else if (!isCustomCinematic) {
      params.set('camera', state.cameraMode);
      if (state.cameraMode === 'cinematic' && currentCinematicIndex > 0) {
        params.set('angle', currentCinematicIndex);
      }
    }

    if (headlight.intensity > 0) {
      params.set('headlight', '1');
    } else {
      params.delete('headlight');
    }

    // The world clock and cloud drift, so the moon, aurora, weather, sky
    // palette, cloud mood and clouds come out the same
    if (state.worldClockNow) {
      params.set('clock', Math.round(state.worldClockNow));
    }
    if (typeof state.cloudTime === 'number') {
      params.set('cloudTime', Number(state.cloudTime.toFixed(2)));
    }

    params.delete('island');
    if (
      ChillFlightLogic.FORCE_ISLAND_TYPE &&
      ChillFlightLogic.FORCE_ISLAND_TYPE !== 'auto'
    ) {
      params.set('islandType', ChillFlightLogic.FORCE_ISLAND_TYPE);
    } else {
      params.delete('islandType');
    }
    return url.toString();
  };

  // The ?perf=1 report links back to the plane's place, time and weather
  setPerfReportUrl(() => buildDebugUrl(false));

  // Shares the link (the share sheet on phones) or copies it, and briefly
  // says which on the button
  const canShare = !!navigator.share && matchMedia('(pointer: coarse)').matches;
  const copyWithFeedback = async (btn, text) => {
    let done = 'Copied!';
    try {
      if (canShare) {
        await navigator.share({title: 'Chill Flight', url: text});
        done = 'Shared!';
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        done = "Couldn't copy";
      }
    }
    const originalText = btn.textContent;
    btn.textContent = done;
    btn.style.color = '#4caf50';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.color = 'white';
    }, 2000);
  };

  const copyCamUrlBtn = document.getElementById('debug-copy-cam-url');
  if (copyCamUrlBtn && canShare)
    copyCamUrlBtn.textContent = 'Share camera link';
  if (copyCamUrlBtn) {
    copyCamUrlBtn.addEventListener('click', () =>
      copyWithFeedback(copyCamUrlBtn, buildDebugUrl(true))
    );
  }

  const copyPlaneUrlBtn = document.getElementById('debug-copy-plane-url');
  if (copyPlaneUrlBtn && canShare)
    copyPlaneUrlBtn.textContent = 'Share plane link';
  if (copyPlaneUrlBtn) {
    copyPlaneUrlBtn.addEventListener('click', () =>
      copyWithFeedback(copyPlaneUrlBtn, buildDebugUrl(false))
    );
  }

  window.applyGraphicsPreset = applyGraphicsPreset;
}

function parseCoordValue(val, isLatitude) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const cleaned = String(val).trim();
  const match = cleaned.match(
    /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([NnSsEeWw][a-zA-Z]*)?$/
  );
  if (!match) {
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  const num = parseFloat(match[1]);
  const suffix = match[2] ? match[2].charAt(0).toUpperCase() : null;
  if (isNaN(num)) return null;
  if (suffix) {
    if (isLatitude) return suffix === 'S' ? -Math.abs(num) : Math.abs(num);
    return suffix === 'W' ? -Math.abs(num) : Math.abs(num);
  }
  return num;
}

// Warps the active vehicle, camera, time of day, weather and chunk queues in
// place without reloading the page (scripts/dev-browser.js warpGame, shot.js).
// Accepts either a URL query string (declarative view snapshot) or an options
// object (incremental patch).
export function applyViewParams(input) {
  const isQuery = typeof input === 'string';
  const q = isQuery ? new URLSearchParams(input.replace(/^\?/, '')) : null;
  const getRaw = (...names) => {
    for (const n of names) {
      if (isQuery) {
        if (q.has(n)) return q.get(n);
      } else if (input && input[n] !== undefined) {
        return input[n];
      }
    }
    return undefined;
  };
  const getNum = (...names) => {
    const v = getRaw(...names);
    if (v === undefined || v === null || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) ? null : n;
  };
  const getBool = (...names) => {
    const v = getRaw(...names);
    if (v === undefined || v === null) return null;
    if (typeof v === 'boolean') return v;
    return ChillFlightLogic.parseSwitch(String(v));
  };

  const planeVal = getRaw('plane', 'vehicle');
  if (planeVal) {
    setActivePlane(String(planeVal).trim().toLowerCase(), true);
  } else if (isQuery && activePlaneType !== 'biplane') {
    setActivePlane('biplane', true);
  }

  const liveryVal = getRaw('livery');
  if (liveryVal !== undefined && liveryVal !== null && liveryVal !== '') {
    const s = String(liveryVal).trim().toLowerCase();
    const byName = ChillFlightLogic.LIVERY_NAMES.indexOf(s);
    const idx = byName >= 0 ? byName : parseInt(s, 10);
    if (!isNaN(idx) && ChillFlightLogic.PLANE_COLORS[idx] !== undefined) {
      state.planeColor = ChillFlightLogic.PLANE_COLORS[idx];
      if (planeMat?.color) planeMat.color.setHex(state.planeColor);
      if (planeWhiteMat?.color) {
        planeWhiteMat.color.setHex(
          state.planeColor === 0xe8c382 ? 0x1c3144 : 0xffffff
        );
      }
    }
  }

  const tod = getNum('tod');
  if (tod !== null) {
    state.manualTimeOfDay = tod;
    state.timeOfDay = tod * Math.PI * 2;
  } else if (isQuery) {
    state.manualTimeOfDay = undefined;
  }

  const timeSpeed = getNum('timeSpeed');
  if (timeSpeed !== null) {
    state.daySpeedMultiplier = timeSpeed;
  }

  const clockVal = getNum('clock');
  if (clockVal !== null) {
    state.worldClockNow = clockVal;
    state.pendingClockOverride = clockVal;
  }

  const cloudTime = getNum('cloudTime');
  if (cloudTime !== null) {
    state.cloudTime = cloudTime;
  }

  const cloudMood = getRaw('cloudMood');
  if (cloudMood !== undefined) {
    state.cloudMoodOverride =
      !cloudMood || cloudMood === 'auto' ? null : String(cloudMood);
  } else if (isQuery) {
    state.cloudMoodOverride = null;
  }

  const rawClouds = getRaw('cloud', 'clouds', 'cloudCover', 'overcast');
  const rawWeather = getRaw('weather');
  const cloudHeight = getNum('cloudHeight', 'cloudAlt', 'cloudCeiling');
  const cloudSpeed = getNum('cloudSpeed');
  applyScriptedWeather({
    clouds: rawClouds !== undefined ? rawClouds : isQuery ? 'auto' : undefined,
    weather:
      rawWeather !== undefined ? rawWeather : isQuery ? 'auto' : undefined,
    cloudHeight: cloudHeight ?? (isQuery ? 3000 : undefined),
    cloudSpeed: cloudSpeed ?? (isQuery ? 1 : undefined),
  });
  state.snapEnvironment = true;

  const hdgt = getBool('headlight');
  if (hdgt !== null) {
    headlight.intensity = hdgt ? HEADLIGHT_INTENSITY : 0;
    headlightGlow.intensity = hdgt ? HEADLIGHT_GLOW_INTENSITY : 0;
  } else if (isQuery) {
    headlight.intensity = 0;
    headlightGlow.intensity = 0;
  }

  const lat = parseCoordValue(getRaw('lat'), true);
  const lon = parseCoordValue(getRaw('long', 'lon'), false);
  const alt = getNum('alt');
  const x = getNum('x');
  const y = getNum('y');
  const z = getNum('z');
  const heading = getNum('heading');
  const pitch = getNum('pitch');
  const roll = getNum('roll');
  const speed = getNum('speed');
  const gear = getBool('gear');

  const camX = getNum('camX');
  const camY = getNum('camY');
  const camZ = getNum('camZ');
  const camHeading = getNum('camHeading');
  const camPitch = getNum('camPitch');
  const lookAt = !isQuery && Array.isArray(input?.lookAt) ? input.lookAt : null;
  const hasCamPlacement =
    [camX, camY, camZ, camHeading, camPitch].some((v) => v !== null) ||
    Boolean(lookAt);

  const freecamFlag = getBool('freecam', 'freeCamera');
  if (freecamFlag !== null) {
    state.isFreeCamera = freecamFlag;
  } else if (hasCamPlacement) {
    state.isFreeCamera = true;
  }
  const freeCamToggle = document.getElementById('debug-free-cam-toggle');
  if (freeCamToggle) freeCamToggle.checked = state.isFreeCamera;

  const resolvePos = (defX, defY, defZ) => {
    const px = x !== null ? x : lon !== null ? lon * 5000 : defX;
    const pz = z !== null ? z : lat !== null ? -lat * 5000 : defZ;
    let py = defY;
    if (y !== null) {
      py = y;
    } else if (alt !== null) {
      py = alt / UNITS_TO_M + 45.5;
    } else if (x !== null || z !== null || lat !== null || lon !== null) {
      py = getElevation(px, pz) + 400;
    }
    return [px, py, pz];
  };

  const placePlane = (px, py, pz) => {
    planeGroup.position.set(px, py, pz);
    planeGroup.rotation.order = 'YXZ';
    if (heading !== null) {
      planeGroup.rotation.y = THREE.MathUtils.degToRad(heading);
    } else if (isQuery) {
      planeGroup.rotation.y = 0;
    }
    if (pitch !== null) {
      planeGroup.rotation.x = THREE.MathUtils.degToRad(pitch);
    } else if (isQuery) {
      planeGroup.rotation.x = 0;
    }
    if (roll !== null) {
      planeGroup.rotation.z = THREE.MathUtils.degToRad(roll);
    } else if (isQuery) {
      planeGroup.rotation.z = 0;
    }
    if (speed !== null) {
      const s = Math.max(0, Math.min(10, speed));
      state.flightSpeedMultiplier = s;
      state.targetFlightSpeed = Math.min(getMaxFlightSpeedMult(), s);
    }
    const elev = getElevation(px, pz);
    const onWater = elev <= WATER_LEVEL + 0.1;
    const wheelDepth = state.airplaneModel?.wheelDepth;
    const waterDepth = state.airplaneModel?.waterDepth ?? 4.8;
    const swellY = onWater
      ? waterSwell(px, pz, waterUniforms.uTime.value, WATER_LEVEL - elev).height
      : 0;
    const floor = onWater
      ? WATER_LEVEL + swellY + waterDepth
      : gear === true && wheelDepth !== undefined
        ? elev + wheelDepth
        : activePlaneType === 'buggy'
          ? elev
          : elev + 12.0;
    if (planeGroup.position.y < floor) planeGroup.position.y = floor;
    if (gear !== null) {
      state.gearWanted = gear;
      state.gearExtension = gear ? 1 : 0;
      poseGear(state.gearExtension);
    } else if (onWater && planeGroup.position.y <= floor + 0.1) {
      const wantPontoons = Boolean(state.airplaneModel?.pontoonGroup);
      state.gearWanted = wantPontoons;
      state.gearExtension = wantPontoons ? 1 : 0;
      poseGear(state.gearExtension);
    }
  };

  camera.rotation.order = 'YXZ';
  camera.up.set(0, 1, 0);
  camera.rotation.z = 0;
  state.freeCamDeltaX = 0;
  state.freeCamDeltaY = 0;

  if (state.isFreeCamera) {
    if (hasCamPlacement) {
      const [px, py, pz] = resolvePos(
        planeGroup.position.x,
        planeGroup.position.y,
        planeGroup.position.z
      );
      placePlane(px, py, pz);
      camera.position.set(
        camX ?? planeGroup.position.x,
        camY ?? planeGroup.position.y,
        camZ ?? planeGroup.position.z
      );
      if (lookAt && lookAt.length === 3) {
        camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
        camera.rotation.z = 0;
      } else {
        if (camHeading !== null) {
          camera.rotation.y = THREE.MathUtils.degToRad(camHeading);
        } else if (isQuery) {
          camera.rotation.y = planeGroup.rotation.y;
        }
        if (camPitch !== null) {
          camera.rotation.x = THREE.MathUtils.degToRad(camPitch);
        } else if (isQuery) {
          camera.rotation.x = 0;
        }
      }
    } else {
      const [cx, cy, cz] = resolvePos(
        camera.position.x,
        camera.position.y,
        camera.position.z
      );
      camera.position.set(cx, cy, cz);
      if (heading !== null) {
        camera.rotation.y = THREE.MathUtils.degToRad(heading);
      } else if (isQuery) {
        camera.rotation.y = 0;
      }
      if (pitch !== null) {
        camera.rotation.x = THREE.MathUtils.degToRad(pitch);
      } else if (isQuery) {
        camera.rotation.x = 0;
      }
      // Park the reference plane 65 units behind the free camera (frozen when
      // declarative) so prop LOD and the sun shadow box stay centered on the
      // framed view without the wing ever entering low-altitude ground shots.
      const backX = cx + Math.sin(camera.rotation.y) * 65;
      const backZ = cz + Math.cos(camera.rotation.y) * 65;
      const backFloor = Math.max(
        WATER_LEVEL + 6,
        getElevation(backX, backZ) + 16
      );
      planeGroup.position.set(backX, Math.max(backFloor, cy - 20), backZ);
      if (isQuery && speed === null) {
        state.flightSpeedMultiplier = 0;
        state.targetFlightSpeed = 0;
      }
    }
    const debugMenu = document.getElementById('debug-menu');
    if (debugMenu) debugMenu.style.display = 'block';
  } else {
    const [px, py, pz] = resolvePos(
      planeGroup.position.x,
      planeGroup.position.y,
      planeGroup.position.z
    );
    placePlane(px, py, pz);
  }

  _lastChunkUpdatePos.set(Infinity, Infinity, Infinity);
  updateChunks();
  updateFarTerrain(state.isFreeCamera ? camera.position : planeGroup.position);
}
