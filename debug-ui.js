// --- DEBUG UI EXTRACTED FROM GAME.JS ---
import * as THREE from 'three';
import {
  CHUNK_SIZE,
  MAP_HEIGHT_SCALE,
  MAP_WORLD_SIZE,
  WATER_LEVEL,
  getCachedElement,
  updateUrlParams,
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
  manualCloudCover,
  manualCloudHeight,
  manualCloudSpeed,
  showCloudsEnabled,
  weatherType,
} from './weather-manager.js';
import {
  chunks,
  clearElevationCache,
  getElevation,
  waterMaterial,
  watercraftChunks,
} from './terrain-geometry.js';
import {scene} from './scene.js';
import {
  activePlaneType,
  getMaxFlightSpeedMult,
  headlight,
  hingeLB,
  hingeLF,
  hingeRB,
  hingeRF,
  planeGroup,
  pontoonGroup,
  pontoonL,
  pontoonR,
} from './airplane.js';
import {
  _lastChunkUpdatePos,
  currentCinematicIndex,
} from './game-input-bindings.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {
  clearChunkQueue,
  toggleProceduralObjects,
  updateChunks,
} from './terrain-chunks.js';
import {simplex} from './noise.js';
import {state} from './state.js';
import {performanceMonitor} from './game-performance.js';
import {hooks} from './hooks.js';

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
    } catch {
      /* ignore */
    }
  }

  // Set global variables
  state.SEGMENTS = segments;
  state.RENDER_DISTANCE = dist;
  state.PROP_LOD_DISTANCE = propLod;
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

  // Update pixel ratio dynamically: baked resolution scale into quality levels
  let pixelRatio;
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
  state._basePixelRatio = pixelRatio;

  if (renderer) {
    renderer.setPixelRatio(pixelRatio);
  }

  // Reset DRS multiplier when preset changes so we start fresh
  if (performanceMonitor) {
    performanceMonitor.pixelRatioMultiplier = 1.0;
  }

  // Toggle sky clouds dynamically: disable expensive fBm on low mode
  if (skyUniforms !== undefined) {
    skyUniforms.uShowClouds.value = segments > 20 && showCloudsEnabled;
  }

  // Toggle overdraw optimizations (transparency)
  const isLow = segments <= 20;
  state.farTerrainEnabled = !isLow;

  waterMaterial.transparent = !isLow;
  waterMaterial.opacity = isLow ? 1.0 : 0.6;
  waterMaterial.depthWrite = isLow ? true : false;
  waterMaterial.needsUpdate = true;

  const enableShadows = segments > 20;
  if (dirLight.castShadow !== enableShadows) {
    dirLight.castShadow = enableShadows;

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

  // Clear all existing chunks to force regeneration

  chunks.forEach((group, key) => {
    group.traverse((child) => {
      if (child.isMesh || child.isInstancedMesh) {
        if (child.geometry && child.geometry.userData.unique) {
          child.geometry.dispose();
        }
        // Water depth texture (see attachWaterDepthTexture in terrain-chunks.js)
        if (child.userData.depthTex) {
          child.userData.depthTex.dispose();
          child.material.dispose();
        }
      }
    });
    scene.remove(group);
  });
  chunks.clear();

  watercraftChunks.clear();

  if (clearChunkQueue) clearChunkQueue();
  if (clearElevationCache) clearElevationCache();

  _lastChunkUpdatePos.set(Infinity, Infinity, Infinity); // Force chunk rebuild
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

export function initDebugUI() {
  const graphicsPresetSelect = document.getElementById(
    'graphics-preset-select'
  );
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

      chunks.forEach((group) => {
        group.traverse((child) => {
          if (child.isMesh || child.isInstancedMesh) {
            if (child.geometry && child.geometry.userData.unique) {
              child.geometry.dispose();
            }
            // Water depth texture (see attachWaterDepthTexture in terrain-chunks.js)
            if (child.userData.depthTex) {
              child.userData.depthTex.dispose();
              child.material.dispose();
            }
          }
        });
        scene.remove(group);
      });
      chunks.clear();

      watercraftChunks.clear();

      if (clearChunkQueue) clearChunkQueue();
      if (clearElevationCache) clearElevationCache();

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
    const spawnRestingHeight = spawnIsWater
      ? WATER_LEVEL + 4.8
      : spawnElev + 12.0;
    if (planeGroup.position.y < spawnRestingHeight) {
      planeGroup.position.y = spawnRestingHeight;
    }
    if (spawnIsWater && state.targetFlightSpeed === 0) {
      if (pontoonGroup) {
        pontoonGroup.visible = true;
        state.pontoonDeploymentProgress = 1;
        state.isDeployingPontoons = false;
        state.isRetractingPontoons = false;
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
      const debugTelem = document.getElementById('debug-telemetry');
      if (debugMenu) debugMenu.style.display = 'block';
      if (debugTelem) debugTelem.style.display = 'block';
    } else {
      placePlaneFromUrl();
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

    const activePreset = graphicsPresetSelect
      ? graphicsPresetSelect.value
      : localStorage.getItem('chill_flight_graphics_preset');
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

    if (activePlaneType && activePlaneType !== 'classic') {
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

    // A custom ?camOffset= view is the first cinematic config (game.js); keep
    // its parameters while it's the one showing.
    const isCustomCinematic =
      state.cameraMode === 'cinematic' &&
      ChillFlightLogic.START_CAM_OFFSET &&
      currentCinematicIndex === 0;
    if (!isCustomCinematic) {
      params.delete('camOffset');
      params.delete('camLook');
      params.delete('fov');
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

  // Copies text and briefly shows "Copied!" on the button.
  const copyWithFeedback = (btn, text) => {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.style.color = '#4caf50';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.color = 'white';
      }, 2000);
    });
  };

  const copyCamUrlBtn = document.getElementById('debug-copy-cam-url');
  if (copyCamUrlBtn) {
    copyCamUrlBtn.addEventListener('click', () =>
      copyWithFeedback(copyCamUrlBtn, buildDebugUrl(true))
    );
  }

  const copyPlaneUrlBtn = document.getElementById('debug-copy-plane-url');
  if (copyPlaneUrlBtn) {
    copyPlaneUrlBtn.addEventListener('click', () =>
      copyWithFeedback(copyPlaneUrlBtn, buildDebugUrl(false))
    );
  }

  window.applyGraphicsPreset = applyGraphicsPreset;
}
