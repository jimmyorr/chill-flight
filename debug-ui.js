// --- DEBUG UI EXTRACTED FROM GAME.JS ---

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
  if (typeof waterMaterial !== 'undefined') {
    waterMaterial.transparent = !isLow;
    waterMaterial.opacity = isLow ? 1.0 : 0.6;
    waterMaterial.depthWrite = isLow ? true : false;
    waterMaterial.needsUpdate = true;
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

var showChunkBorders = false;
var isFreeCamera = false;
const _chunkBorderHelpers = new Map(); // key -> Box3Helper
const _chunkBorderColor = new THREE.Color(0x00ffff);

function syncChunkBorders() {
  if (!showChunkBorders) {
    if (_chunkBorderHelpers.size > 0) {
      _chunkBorderHelpers.forEach((helper) => scene.remove(helper));
      _chunkBorderHelpers.clear();
    }
    return;
  }
  const cs = typeof CHUNK_SIZE !== 'undefined' ? CHUNK_SIZE : 1500;
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
window.syncChunkBorders = syncChunkBorders;

window.initDebugUI = function () {
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
      log.info(`Island type changed to: ${val}`);
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
  isFreeCamera =
    typeof ChillFlightLogic !== 'undefined'
      ? ChillFlightLogic.START_FREE_CAM || false
      : false;
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
              WATER_LEVEL:
                typeof WATER_LEVEL !== 'undefined' ? WATER_LEVEL : 40,
              MAP_WORLD_SIZE:
                typeof MAP_WORLD_SIZE !== 'undefined' ? MAP_WORLD_SIZE : 10000,
              MAP_HEIGHT_SCALE:
                typeof MAP_HEIGHT_SCALE !== 'undefined'
                  ? MAP_HEIGHT_SCALE
                  : 400,
            }
          );
          startCamY = terrainHeight + 400.0;
        } catch {
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

  window.applyGraphicsPreset = applyGraphicsPreset;
};
