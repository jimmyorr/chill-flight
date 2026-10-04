import * as THREE from 'three';
import {
  STEER_HOLD_THRESHOLD,
  cameraDolly,
  doubleTap,
  getCameraWorldPosition,
  inputManager,
  keyPressStartTime,
  keys,
  tripleTap,
} from './game-input-bindings.js';
import {syncChunkBorders} from './debug-ui.js';
import {
  _daySky,
  camera,
  clock,
  currentPaletteSeed,
  dirLight,
  hemiLight,
  isCustomPalette,
  moonLight,
  moonMesh,
  moonUniforms,
  renderer,
  selectedPalette,
  skyGroup,
  skyUniforms,
  starsMat,
  sunMesh,
  sunUniforms,
  updateSkyPalette,
} from './sky.js';
import {performanceMonitor} from './game-performance.js';
import {
  DELTA_BUFFER_SIZE,
  _cloudyColor,
  _currentGoldenSky,
  _currentLookTarget,
  _currentSunriseSky,
  _dayLightColor,
  _debugCamEuler,
  _deltaRing,
  _finalFogColor,
  _finalSkyColor,
  _goldenSky,
  _goldenSunsetSky,
  _immelmannForward,
  _moonDirNorm,
  _moonMRot,
  _moonPhaseSunDir,
  _moonPhaseX,
  _moonRotMat,
  _moonVMoonDir,
  _moonVX,
  _moonVY,
  _moonVZ,
  _rainbowAntiSunDir,
  _rainbowSunDir,
  _rockArchPos,
  _shadowRight,
  _shadowSunDir,
  _shadowUp,
  _shootingStarHeadPos,
  _shootingStarLookDir,
  _shootingStarStreakDir,
  _shootingStarTailPos,
  _skyBottomCol,
  _stormColor,
  _sunNoonColor,
  _sunSunsetColor,
  _sunriseLightColor,
  _sunriseSky,
  _sunsetLightColor,
  _sunsetSky,
  _targetShadowPos,
  _tempVec,
  _twilightSky,
  _uncloudedFogColor,
  _uncloudedSkyColor,
  _upVector,
  _volcanoPos,
  _warmHorizonColor,
  _waterMoonDirNorm,
  _worldUp,
  shootingStarEnd,
  shootingStarStart,
  targetPaletteBottom,
  targetPaletteTop,
} from './game.js';
import {
  BASE_FLIGHT_SPEED,
  CHUNK_SIZE,
  TURN_SPEED,
  getCachedElement,
  moonlightUniforms,
  terrainUniforms,
  updateDOM,
} from './constants.js';
import {
  getMaxFlightSpeedMult,
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
  manualCloudCover,
  manualCloudHeight,
  manualCloudSpeed,
  rainParticles,
  snowParticles,
  updateWeather,
} from './weather-manager.js';
import {updateVRPauseInteraction} from './vr-manager.js';
import {scene} from './scene.js';
import {clearInputState} from './game-state.js';
import {showStartPlaneTooltip, toggleAutopilot} from './game-ui.js';
import {updateFlightPhysics} from './flight-physics.js';
import {log} from './logger.js';
import {
  chunks,
  getElevation,
  houseWindowMats,
  streetlightBulbMat,
  streetlightDecalMat,
  waterUniforms,
  windUniforms,
} from './terrain-geometry.js';
import {updateFlightCamera} from './flight-camera.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {simplex} from './noise.js';
import {globalInstancer, processChunkQueue} from './terrain-chunks.js';
import {updateFarTerrain} from './far-terrain.js';
import {state} from './state.js';
import {Achievements} from './achievements.js';

let _currentOvercast;
// How slowly the sky follows the weather map's cloud cover (seconds)
const CLOUD_EASE_SECONDS = 12;
let _lastFpsAggUpdate;
let _telemetryCallsAccum;
let _telemetryTrisAccum;
let _telemetryRenderFrames;
let _lastRenderInfoUpdate;
let _debugVirtualClockNow;
// Lingering mist after rain or snow, 0..1 (drives fog density).
let fogAfterRain = 0;
let benchmarkComplete;
let benchmarkStartTime;
let benchmarkFrameTimes;

var isAnimationLoopRunning = false;
function animate() {
  // Sync InputManager state
  inputManager.state.isPaused = state.isPaused;
  inputManager.state.isFreeCamera = state.isFreeCamera;

  const steering = inputManager.getSteering();
  if (state.currentControlScheme !== 'gyro') {
    if (steering.active) {
      state.mouseX = steering.x;
      state.mouseY = steering.y;
      state.mouseControlActive = true;
    } else {
      state.mouseX = 0;
      state.mouseY = 0;
      state.mouseControlActive = false;
    }
  }
  // Handle freeCam
  if (state.isFreeCamera) {
    state.freeCamDeltaX += inputManager.state.freeCam.deltaX;
    state.freeCamDeltaY += inputManager.state.freeCam.deltaY;
    inputManager.state.freeCam.deltaX = 0;
    inputManager.state.freeCam.deltaY = 0;
  }

  const frameStartTime = performance.now(); // Start CPU timer
  if (!isAnimationLoopRunning) {
    requestAnimationFrame(animate);
  }

  // --- FPS CAPPING ---
  // In VR, the headset compositor manages native vsync (72/90/120Hz); bypass manual 60fps throttle
  state.isVRPresenting = renderer && renderer.xr && renderer.xr.isPresenting;
  if (!state.isVRPresenting && state.maxFPS > 0) {
    const timeSinceLastFrame = frameStartTime - state.lastFrameTime;
    if (timeSinceLastFrame < state.frameMinDelay - 1) {
      // 1ms buffer for vsync jitter
      return;
    }
  }
  state.lastFrameTime = frameStartTime;

  const now = performance.now();
  const nowTime = now;
  // If the loading screen is active, give chunk generation a massive time budget (e.g., 33ms)
  // so it finishes in a fraction of a second instead of being artifically throttled for 60fps.
  const isBootLoadingScreen = state.isPaused && !state.isIntroTransitionActive;
  const chunkBudget = isBootLoadingScreen
    ? 33
    : performanceMonitor.getChunkBudget();
  if (processChunkQueue) processChunkQueue(chunkBudget);
  updateFarTerrain(planeGroup.position);
  if (globalInstancer) globalInstancer.rebuildAll();
  clock.update();
  let rawDelta = clock.getDelta();
  if (rawDelta > 0.1) rawDelta = 0.1; // Cap at 100ms to prevent logic blowouts

  // Apply delta smoothing (moving average) to eliminate jitter from OS/browser timing.
  // Uses an O(1) ring buffer running sum to prevent garbage collection pauses from array churn.
  if (state._deltaRingCount < DELTA_BUFFER_SIZE) {
    state._deltaRingSum += rawDelta;
    state._deltaRingCount++;
  } else {
    state._deltaRingSum += rawDelta - _deltaRing[state._deltaRingIndex];
  }
  _deltaRing[state._deltaRingIndex] = rawDelta;
  state._deltaRingIndex = (state._deltaRingIndex + 1) % DELTA_BUFFER_SIZE;
  state.smoothedDelta = state._deltaRingSum / state._deltaRingCount;

  const delta = state.smoothedDelta; // Use smoothed delta for all game logic below
  if (performanceMonitor && typeof performanceMonitor.update === 'function') {
    performanceMonitor.update(rawDelta);
  }

  inputManager.pollGamepad(delta);

  if (state.isPaused) {
    const loadingOverlay = getCachedElement('loading-overlay');
    if (
      loadingOverlay &&
      loadingOverlay.style.display !== 'none' &&
      !state.isIntroTransitionActive
    ) {
      // Intro orbit camera rendering
      if (!state.isFreeCamera) {
        const activeCamTarget = state.isVRPresenting ? cameraDolly : camera;
        const t = now * 0.00015;
        activeCamTarget.position.x = planeGroup.position.x + Math.sin(t) * 150;
        activeCamTarget.position.z = planeGroup.position.z + Math.cos(t) * 150;
        activeCamTarget.position.y = planeGroup.position.y + 80;

        _currentLookTarget.copy(planeGroup.position);
        activeCamTarget.lookAt(_currentLookTarget);
      }

      sunUniforms.uTime.value = now * 0.001;

      updateWeather(delta);
      // During loading screen, always update shadows (simple scene, minimal cost)
      renderer.shadowMap.needsUpdate = true;
    }

    // Always render during pause so VR headset doesn't drop frames.
    if (state.isVRPresenting) {
      if (typeof updateVRPauseInteraction === 'function') {
        updateVRPauseInteraction();
      }
      renderer.render(scene, camera);
    } else if (
      loadingOverlay &&
      loadingOverlay.style.display !== 'none' &&
      !state.isIntroTransitionActive
    ) {
      renderer.render(scene, camera);
    }
    return;
  }

  // One-frame blanket suppression of all input after resuming from pause,
  // to catch any input that slipped through despite clearInputState().
  if (state.justResumed) {
    state.justResumed = false;
    clearInputState();
    if (state.isVRPresenting) renderer.render(scene, camera);
    return;
  }

  // Trigger start plane tooltip if plane is stopped for the first time after a 5 second delay
  if (
    !state.startPlaneTooltipShown &&
    state.targetFlightSpeed === 0 &&
    Math.abs(state.flightSpeedMultiplier) < 0.01
  ) {
    if (state.stoppedStartTime === null) {
      state.stoppedStartTime = now;
    } else if (now - state.stoppedStartTime >= 5000) {
      showStartPlaneTooltip();
    }
  } else {
    state.stoppedStartTime = null;
  }

  // Dismiss start plane tooltip if we start moving
  if (
    state.dismissStartPlaneTooltipFunc &&
    Math.abs(state.targetFlightSpeed) > 0
  ) {
    state.dismissStartPlaneTooltipFunc();
    state.dismissStartPlaneTooltipFunc = null;
  }

  // --- DAY/NIGHT CYCLE ---
  updateDayNightCycle(delta);
  // Spin the propeller
  updatePhysicsAndControls(delta, nowTime);
  // --- MANEUVER & PITCH ACHIEVEMENTS ---
  if (!state.isFreeCamera) {
    // 1. Maneuver completions
    if (state.wasDoingFullLoop && !state.isDoingFullLoop) {
      Achievements.unlock('froot_loops');
    }
    if (state.wasDoingFullBarrelRoll && !state.isDoingFullBarrelRoll) {
      Achievements.unlock('barrel_roll');
    }
    if (state.wasDoingImmelmann && !state.isDoingImmelmann) {
      Achievements.unlock('u_turn');
    }

    // 2. Steep climb / steep dive
    if (planeGroup.rotation.x > Math.PI / 4) {
      Achievements.unlock('to_the_moon');
    } else if (planeGroup.rotation.x < -Math.PI / 4) {
      Achievements.unlock('nose_dive');
    }

    const currentKTS =
      BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;

    // 3. Mach 1
    if (currentKTS > 500) {
      Achievements.unlock('mach_1');
    }

    // 4. Free falling plummet (engine cut/idle, steep pitch down or stalling, high altitude)
    // We recreate the isFreefalling condition here since it is defined later in the file.
    const isFallingOutSky = currentKTS < 50;

    if (
      state.targetFlightSpeed <= 0.05 &&
      (planeGroup.rotation.x < -Math.PI / 6 || isFallingOutSky) &&
      planeGroup.position.y > 80
    ) {
      Achievements.unlock('free_falling');
    }
  }
  state.wasLooping = state.isLooping;
  state.wasDoingFullLoop = state.isDoingFullLoop;
  state.wasBarrelRolling = state.isBarrelRolling;
  state.wasDoingFullBarrelRoll = state.isDoingFullBarrelRoll;
  state.wasDoingImmelmann = state.isDoingImmelmann;

  updateFlightPhysics(delta, nowTime);
  // --- SPATIAL / BIOME ACHIEVEMENTS ---
  if (!state.isFreeCamera) {
    if (!state.previousPosition) {
      state.previousPosition = planeGroup.position.clone();
    } else {
      const distSq = planeGroup.position.distanceToSquared(
        state.previousPosition
      );
      if (distSq > 0) {
        const dist = Math.sqrt(distSq);
        state.sessionDistanceTravelled += dist;
        state.distanceSinceLastSave += dist;
      }

      if (state.distanceSinceLastSave > 1000) {
        state.lifetimeDistanceTravelled += state.distanceSinceLastSave;
        localStorage.setItem(
          'chill_flight_lifetime_distance',
          state.lifetimeDistanceTravelled.toString()
        );

        if (Achievements.updateStats) {
          Achievements.updateStats(state.lifetimeDistanceTravelled);
        }
        state.distanceSinceLastSave = 0;
      }

      state.previousPosition.copy(planeGroup.position);
    }

    // ~2 minutes of cruising flight is roughly 18000-20000 units.
    if (state.sessionDistanceTravelled > 20000) {
      Achievements.unlock('welcome');
    }

    // 1. Volcano (Pura Vida) - Volcano center is X = -5000, Z = 5000
    _volcanoPos.y = planeGroup.position.y;
    const distToVolcanoSq = planeGroup.position.distanceToSquared(_volcanoPos);
    if (distToVolcanoSq < 640000) {
      Achievements.unlock('pura_vida');
    }

    // 2. Alien Lands - East (X > 50000) for Xen, West (X < -50000) for Westworld
    if (planeGroup.position.x > 50000) {
      if (Achievements.unlock('xen')) {
        log.info(
          `[Alien lands entered] Position: X = ${planeGroup.position.x.toFixed(1)}, Z = ${planeGroup.position.z.toFixed(1)} (${(planeGroup.position.x / 5000).toFixed(2)} East, ${(-planeGroup.position.z / 5000).toFixed(2)} ${planeGroup.position.z <= 0 ? 'North' : 'South'})`
        );
      }
    } else if (planeGroup.position.x < -50000) {
      if (Achievements.unlock('westworld')) {
        log.info(
          `[Alien lands entered] Position: X = ${planeGroup.position.x.toFixed(1)}, Z = ${planeGroup.position.z.toFixed(1)} (${(planeGroup.position.x / 5000).toFixed(2)} West, ${(-planeGroup.position.z / 5000).toFixed(2)} ${planeGroup.position.z <= 0 ? 'North' : 'South'})`
        );
      }
    }

    // 3. Rock Arch (Limbo) - Arch center is X = 3000, Z = _rockArchPos.z
    if (_rockArchPos.y === 0) {
      _rockArchPos.y = Math.max(40, getElevation(3000, _rockArchPos.z)) + 80;
    }
    const distToRockArchSq =
      planeGroup.position.distanceToSquared(_rockArchPos);
    if (
      distToRockArchSq < 62500 &&
      planeGroup.position.y < _rockArchPos.y + 120
    ) {
      if (Achievements.unlock('limbo')) {
        log.info(
          `[Limbo unlocked] Position: X = ${planeGroup.position.x.toFixed(1)}, Z = ${planeGroup.position.z.toFixed(1)} (${(planeGroup.position.x / 5000).toFixed(2)} ${planeGroup.position.x >= 0 ? 'East' : 'West'}, ${(-planeGroup.position.z / 5000).toFixed(2)} ${planeGroup.position.z <= 0 ? 'North' : 'South'})`
        );
      }
    }
  }

  // Ensure the plane's matrix is fully updated before camera calculations
  // This prevents the camera from "jittering" or lagging one frame behind.
  planeGroup.updateMatrixWorld();

  updateFlightCamera(delta, nowTime);
  // --- SHADOW TEXEL SNAPPING (View-Space) ---
  updateShadowSnapping(delta);
  // Smoothly interpolate sky shader palettes
  updateEnvironmentLighting(delta, now);
  // Update the particle positions
  updateWeatherAndRendering(delta);
  // --- BENCHMARKING LOGIC ---
  updateBenchmarking(delta, frameStartTime);
  updateDebugTelemetry(delta, now, frameStartTime);
}

function updateDebugTelemetry(delta, now, frameStartTime) {
  const debugMenu = getCachedElement('debug-menu');
  // Update Debug Telemetry (at the very end of frame)
  if (debugMenu && debugMenu.style.display === 'block') {
    const pullBackVal =
      state.smoothedManeuverFactor *
      20 *
      Math.min(1, state.flightSpeedMultiplier / 2); // Re-calculate or pass from earlier
    updateDOM('debug-fov', Math.round(camera.fov));
    updateDOM('debug-pullback', Math.round(pullBackVal));
    updateDOM(
      'debug-pitch',
      Math.round((planeGroup.rotation.x * 180) / Math.PI)
    );
    const isCustom = isCustomPalette;
    const curSeed =
      typeof currentPaletteSeed !== 'undefined'
        ? currentPaletteSeed
        : currentPaletteSeed;
    const paletteStr = isCustom
      ? 'Custom'
      : curSeed !== undefined
        ? `${selectedPalette.name} (#${curSeed})`
        : selectedPalette.name;
    updateDOM('debug-palette', paletteStr);
    updateDOM('debug-speed-mult', state.flightSpeedMultiplier.toFixed(2));
    updateDOM('debug-day-speed', state.daySpeedMultiplier.toFixed(1));

    updateDOM('debug-target-speed', state.targetFlightSpeed.toFixed(2));
    updateDOM('debug-maneuver', state.smoothedManeuverFactor.toFixed(2));
    updateDOM('debug-world-x', Math.round(planeGroup.position.x));
    updateDOM('debug-world-y', Math.round(planeGroup.position.y));
    updateDOM('debug-world-z', Math.round(planeGroup.position.z));
    updateDOM('debug-camera-x', Math.round(camera.position.x));
    updateDOM('debug-camera-y', Math.round(camera.position.y));
    updateDOM('debug-camera-z', Math.round(camera.position.z));
    _debugCamEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    const camHeadingDegrees = THREE.MathUtils.radToDeg(_debugCamEuler.y);
    const camPitchDegrees = THREE.MathUtils.radToDeg(_debugCamEuler.x);
    updateDOM('debug-camera-heading', Math.round(camHeadingDegrees));
    updateDOM('debug-camera-pitch', Math.round(camPitchDegrees));

    // Weather Telemetry
    const oc = _currentOvercast || 0;
    updateDOM('debug-overcast', oc.toFixed(2));
    updateDOM(
      'debug-storm-noise',
      state._weatherDebug ? state._weatherDebug.stormNoise.toFixed(2) : '-'
    );
    updateDOM(
      'debug-precip',
      snowParticles && rainParticles
        ? Math.max(
            snowParticles.material.opacity / 0.8,
            rainParticles.material.opacity / 0.5
          ).toFixed(2)
        : '-'
    );
    updateDOM(
      'debug-climate-zone',
      state._weatherDebug ? state._weatherDebug.zone : '-'
    );
    updateDOM(
      'debug-snow-opacity',
      snowParticles ? snowParticles.material.opacity.toFixed(2) : '-'
    );
    updateDOM(
      'debug-rain-opacity',
      rainParticles ? rainParticles.material.opacity.toFixed(2) : '-'
    );
    updateDOM('debug-fog-density', scene.fog.density.toFixed(5));
    const _snowOp = snowParticles ? snowParticles.material.opacity : 0;
    const _rainOp = rainParticles ? rainParticles.material.opacity : 0;
    const _precipType =
      _snowOp > 0.01 && _rainOp > 0.01
        ? 'sleet'
        : _snowOp > 0.01
          ? 'snow'
          : _rainOp > 0.01
            ? 'rain'
            : 'none';
    updateDOM('debug-weather-mode', _precipType);

    // Island archetype telemetry
    const _activeIslandPos = state.isFreeCamera
      ? camera.position
      : planeGroup.position;
    const _islandArchetype =
      typeof ChillFlightLogic.getIslandArchetype === 'function'
        ? ChillFlightLogic.getIslandArchetype(
            _activeIslandPos.x,
            _activeIslandPos.z,
            simplex
          )
        : '-';
    const _islandDisplay =
      ChillFlightLogic.FORCE_ISLAND_TYPE &&
      ChillFlightLogic.FORCE_ISLAND_TYPE !== 'auto'
        ? `${_islandArchetype} (forced)`
        : _islandArchetype;
    updateDOM('debug-island-type', _islandDisplay);

    // Aurora telemetry
    const auroraVal =
      skyUniforms !== undefined ? skyUniforms.uAuroraIntensity.value : 0;
    if (auroraVal > state._auroraSessionMax)
      state._auroraSessionMax = auroraVal;
    const _auroraLabelFn = (v) =>
      v < 0.01 ? 'None' : v < 0.03 ? 'Faint' : v < 0.06 ? 'Moderate' : 'Active';
    updateDOM(
      'debug-aurora',
      `${_auroraLabelFn(auroraVal)} (${auroraVal.toFixed(3)})`
    );

    // Rainbow telemetry
    updateDOM(
      'debug-rainbow',
      state.rainbowIntensity > 0
        ? (state.rainbowIntensity * 100).toFixed(0) + '%'
        : '-'
    );
    updateDOM(
      'debug-aurora-peak',
      `${_auroraLabelFn(state._auroraSessionMax)} (${state._auroraSessionMax.toFixed(3)})`
    );
    // Helper function for performance color coding
    function getPerfColor(val, warnThresh, critThresh) {
      if (val >= critThresh) return '#ff4444'; // Red
      if (val >= warnThresh) return '#ffeb3b'; // Yellow
      return ''; // Default (inherits from CSS)
    }

    // Performance Telemetry
    const frameEndTime = performance.now();
    const cpuMs = frameEndTime - frameStartTime;
    const cpuMsEl = getCachedElement('debug-cpu-ms');
    if (cpuMsEl) {
      updateDOM(cpuMsEl, cpuMs.toFixed(1));
      // Warn at 24ms, Critical at 32ms (stuttering on 30fps cap)
      cpuMsEl.style.color = getPerfColor(cpuMs, 24, 32);
    }

    const fpsEl = getCachedElement('debug-fps');
    if (fpsEl && delta > 0) {
      const fps = Math.round(1 / delta);
      updateDOM(fpsEl, fps);
      fpsEl.style.color = getPerfColor(60 - fps, 30, 40);
    }

    const avgFpsEl = getCachedElement('debug-avg-fps');
    const lowFpsEl = getCachedElement('debug-fps-low');
    if ((avgFpsEl || lowFpsEl) && performanceMonitor) {
      if (!_lastFpsAggUpdate || now - _lastFpsAggUpdate > 250) {
        _lastFpsAggUpdate = now;
        const avgFps = performanceMonitor.getAvgFPS();
        const lowFps = performanceMonitor.get1PercentLowFPS();
        if (avgFpsEl) {
          updateDOM(avgFpsEl, avgFps);
          avgFpsEl.style.color = getPerfColor(60 - avgFps, 30, 40);
        }
        if (lowFpsEl) {
          updateDOM(lowFpsEl, lowFps);
          lowFpsEl.style.color = getPerfColor(60 - lowFps, 30, 40);
        }
      }
    }

    const heapEl = getCachedElement('debug-heap');
    if (heapEl) {
      if (performance.memory) {
        const heapMb = performance.memory.usedJSHeapSize / 1048576;
        updateDOM(heapEl, heapMb.toFixed(1));

        // --- GC DETECTION INLINE ---
        if (heapEl._lastHeapMb !== undefined) {
          const drop = heapEl._lastHeapMb - heapMb;
          if (drop > 2.0) {
            // If dropped by more than 2MB, GC likely happened
            const lastGcEl = getCachedElement('debug-last-gc');
            const lastGcVal = getCachedElement('debug-last-gc-val');
            if (lastGcEl && lastGcVal) {
              updateDOM(lastGcVal, `-${drop.toFixed(1)} MB`);

              // Briefly flash the color to gold
              lastGcEl.style.color = 'gold';
              setTimeout(() => {
                if (lastGcEl) lastGcEl.style.color = '';
              }, 300);
            }
          }
        }
        heapEl._lastHeapMb = heapMb;

        // Warn at 150MB, Critical at 250MB
        heapEl.style.color = getPerfColor(heapMb, 150, 250);
      } else {
        updateDOM(heapEl, 'N/A');
        heapEl.style.color = '';
      }
    }

    if (renderer && renderer.info) {
      const calls = renderer.info.render.calls;
      const tris = renderer.info.render.triangles;
      const geos = renderer.info.memory.geometries;
      const texs = renderer.info.memory.textures;

      _telemetryCallsAccum = (_telemetryCallsAccum || 0) + calls;
      _telemetryTrisAccum = (_telemetryTrisAccum || 0) + tris;
      _telemetryRenderFrames = (_telemetryRenderFrames || 0) + 1;

      if (!_lastRenderInfoUpdate || now - _lastRenderInfoUpdate > 250) {
        _lastRenderInfoUpdate = now;
        const avgCalls = Math.round(
          _telemetryCallsAccum / _telemetryRenderFrames
        );
        const avgTris = Math.round(
          _telemetryTrisAccum / _telemetryRenderFrames
        );
        _telemetryCallsAccum = 0;
        _telemetryTrisAccum = 0;
        _telemetryRenderFrames = 0;

        const drawCallsEl = getCachedElement('debug-draw-calls');
        if (drawCallsEl) {
          updateDOM(drawCallsEl, avgCalls);
          drawCallsEl.style.color = getPerfColor(avgCalls, 800, 1200);
        }

        const trianglesEl = getCachedElement('debug-triangles');
        if (trianglesEl) {
          updateDOM(trianglesEl, avgTris);
          trianglesEl.style.color = getPerfColor(avgTris, 2500000, 4000000);
        }

        const geometriesEl = getCachedElement('debug-geometries');
        if (geometriesEl) {
          updateDOM(geometriesEl, geos);
          geometriesEl.style.color = getPerfColor(geos, 400, 600);
        }

        const texturesEl = getCachedElement('debug-textures');
        if (texturesEl) {
          updateDOM(texturesEl, texs);
          texturesEl.style.color = getPerfColor(texs, 15, 30);
        }
      }
    }

    // Update Counters
    let totalTreesPine = 0,
      totalTreesDecid = 0,
      totalTreesPalm = 0,
      totalTreesDead = 0,
      totalTreesAutumn = 0,
      totalTreesCherry = 0,
      totalTreesYellowCortez = 0;
    let totalHouses = 0,
      totalRocks = 0,
      totalBushes = 0;
    let totalSnowmen = 0,
      totalCactus = 0,
      totalLighthouses = 0,
      totalCastles = 0,
      totalPagodas = 0,
      totalChunks = 0;
    let totalWindmills = 0,
      totalCampfires = 0;
    let totalBoats = 0,
      totalPirateShips = 0,
      totalLilyPads = 0,
      totalPiers = 0,
      totalBirds = 0;

    let activeLODChunks = 0;
    let activeHouses = 0,
      activeBoats = 0,
      activePirateShips = 0,
      activePiers = 0,
      activeCastles = 0,
      activeWindmills = 0,
      activePagodas = 0;

    const camPos = state.isFreeCamera ? camera.position : planeGroup.position;
    const maxPropLOD =
      state.manualPropLOD !== undefined
        ? state.manualPropLOD
        : typeof state.PROP_LOD_DISTANCE !== 'undefined'
          ? state.PROP_LOD_DISTANCE
          : 4200;
    const currentPropLOD =
      state.manualPropLOD !== undefined
        ? state.manualPropLOD
        : Math.min(
            state.RENDER_DISTANCE * CHUNK_SIZE - CHUNK_SIZE / 2,
            maxPropLOD
          );
    const lodMultiplier =
      performanceMonitor && typeof performanceMonitor.lodMultiplier === 'number'
        ? performanceMonitor.lodMultiplier
        : 1.0;
    const effectivePropLOD = currentPropLOD * lodMultiplier;
    const lodDistSq = effectivePropLOD * effectivePropLOD;

    const objectsVisible = ChillFlightLogic.SHOW_OBJECTS;
    chunks.forEach((cg) => {
      if (cg.userData.counts) {
        totalChunks += 1;
        const checkPos = cg.userData.worldPosition || cg.position;
        const isLODActive = checkPos.distanceToSquared(camPos) <= lodDistSq;
        if (isLODActive) activeLODChunks += 1;

        if (objectsVisible) {
          totalTreesPine += cg.userData.counts.trees_pine || 0;
          totalTreesDecid += cg.userData.counts.trees_decid || 0;
          totalTreesPalm += cg.userData.counts.trees_palm || 0;
          totalTreesDead += cg.userData.counts.trees_dead || 0;
          totalTreesAutumn += cg.userData.counts.trees_autumn || 0;
          totalTreesCherry += cg.userData.counts.trees_cherry || 0;
          totalTreesYellowCortez += cg.userData.counts.trees_yellow_cortez || 0;
          totalHouses += cg.userData.counts.houses || 0;
          if (isLODActive) activeHouses += cg.userData.counts.houses || 0;

          totalRocks += cg.userData.counts.rocks || 0;
          totalBushes += cg.userData.counts.bushes || 0;
          totalSnowmen += cg.userData.counts.snowmen || 0;
          totalCactus += cg.userData.counts.cactus || 0;
          totalLighthouses += cg.userData.counts.lighthouses || 0;
          totalCastles += cg.userData.counts.castles || 0;
          if (isLODActive) activeCastles += cg.userData.counts.castles || 0;

          totalWindmills += cg.userData.counts.windmills || 0;
          if (isLODActive) activeWindmills += cg.userData.counts.windmills || 0;

          totalCampfires += cg.userData.counts.campfires || 0;
          totalBoats += cg.userData.counts.boats || 0;
          activeBoats += cg.userData.counts.boats || 0;

          totalPirateShips += cg.userData.counts.pirateships || 0;
          activePirateShips += cg.userData.counts.pirateships || 0;

          totalLilyPads += cg.userData.counts.lily_pads || 0;
          totalPiers += cg.userData.counts.piers || 0;
          if (isLODActive) activePiers += cg.userData.counts.piers || 0;

          totalBirds += cg.userData.counts.birds || 0;
          totalPagodas += cg.userData.counts.pagodas || 0;
          if (isLODActive) activePagodas += cg.userData.counts.pagodas || 0;
        }
      }
    });

    const formatCount = (active, total) =>
      total === 0 ? '0' : active === total ? `${total}` : `${active}/${total}`;

    updateDOM('debug-prop-lod-base', Math.round(currentPropLOD));
    updateDOM('debug-prop-lod', Math.round(currentPropLOD));
    updateDOM('debug-prop-lod-final', Math.round(effectivePropLOD));
    updateDOM('debug-prop-lod-effective', Math.round(effectivePropLOD));
    if (performanceMonitor) {
      updateDOM('debug-lod-mult', performanceMonitor.lodMultiplier.toFixed(2));
      updateDOM(
        'debug-avg-ms',
        performanceMonitor.getSmoothedFrameTime().toFixed(2)
      );
      updateDOM(
        'debug-drs-mult',
        performanceMonitor.pixelRatioMultiplier.toFixed(2)
      );
      const cadence = performanceMonitor.shadowCadence;
      updateDOM('debug-shadow-cadence', cadence === 0 ? 'off' : `1/${cadence}`);
      updateDOM(
        'debug-chunk-budget',
        performanceMonitor.getChunkBudget().toFixed(1)
      );
    }
    updateDOM('debug-lod-chunks', `${activeLODChunks}/${totalChunks}`);

    updateDOM('debug-chunks', totalChunks);
    updateDOM('debug-trees-pine', totalTreesPine);
    updateDOM('debug-trees-decid', totalTreesDecid);
    updateDOM('debug-trees-palm', totalTreesPalm);
    updateDOM('debug-trees-dead', totalTreesDead);
    updateDOM('debug-trees-autumn', totalTreesAutumn);
    updateDOM('debug-trees-cherry', totalTreesCherry);
    updateDOM('debug-trees-yellow-cortez', totalTreesYellowCortez);
    updateDOM('debug-houses', formatCount(activeHouses, totalHouses));
    updateDOM('debug-rocks', totalRocks);
    updateDOM('debug-bushes', totalBushes);
    updateDOM('debug-snowmen', totalSnowmen);
    updateDOM('debug-cactus', totalCactus);
    updateDOM('debug-lighthouses', totalLighthouses);
    updateDOM('debug-castles', formatCount(activeCastles, totalCastles));
    updateDOM('debug-windmills', formatCount(activeWindmills, totalWindmills));
    updateDOM('debug-campfires', totalCampfires);
    updateDOM('debug-boats', formatCount(activeBoats, totalBoats));
    updateDOM(
      'debug-pirateships',
      formatCount(activePirateShips, totalPirateShips)
    );
    updateDOM('debug-lily-pads', totalLilyPads);
    updateDOM('debug-piers', formatCount(activePiers, totalPiers));
    updateDOM('debug-birds', totalBirds);
    updateDOM('debug-pagodas', formatCount(activePagodas, totalPagodas));
  }
}

function startAnimationLoop() {
  if (isAnimationLoopRunning) return;
  if (renderer && typeof renderer.setAnimationLoop === 'function') {
    isAnimationLoopRunning = true;
    renderer.setAnimationLoop(animate);
  } else {
    isAnimationLoopRunning = false;
    requestAnimationFrame(animate);
  }
}

if (document.readyState === 'complete') {
  startAnimationLoop();
} else {
  window.addEventListener('load', startAnimationLoop);
}

// One in-game day; it starts at midnight
const DAY_CYCLE_MS = 360000;
// How slowly the cloud mix follows a new day's mood (seconds)
const CLOUD_MOOD_EASE_SECONDS = 20;
let _cloudMoodDay = null;
let _cloudMood = null;
const _cloudTypesTarget = new THREE.Vector3();

// Eases the sky's cloud types (skyUniforms.uCloudTypes) toward the day's
// mood (ChillFlightLogic.cloudMoodForDay), with that day's extra mackerel and
// cirrus around sunrise and sunset.
function updateCloudMood(delta) {
  const day = Math.floor(state.worldClockNow / DAY_CYCLE_MS);
  const first = _cloudMood === null;
  if (day !== _cloudMoodDay) {
    _cloudMoodDay = day;
    _cloudMood = ChillFlightLogic.cloudMoodForDay(
      ChillFlightLogic.WORLD_SEED,
      day,
      ChillFlightLogic.START_CLOUD_MOOD
    );
    const moodLabel = getCachedElement('debug-cloud-mood');
    if (moodLabel) {
      moodLabel.textContent =
        _cloudMood.name + (_cloudMood.duskBoost > 0 ? ', dusk build-up' : '');
    }
  }
  // 1 with the sun on the horizon, at sunrise and sunset
  const dusk = 1 - THREE.MathUtils.smoothstep(Math.abs(state.sunY), 0, 0.35);
  const boost = _cloudMood.duskBoost * dusk;
  const target = _cloudTypesTarget.set(
    _cloudMood.cumulus,
    Math.min(0.8, _cloudMood.cirrus + boost * 0.5),
    Math.min(1, _cloudMood.mackerel + boost)
  );
  const types = skyUniforms.uCloudTypes.value;
  if (first) {
    types.copy(target);
    skyUniforms.uCloudCover.value = _cloudMood.cover;
  } else {
    const ease = 1 - Math.exp(-delta / CLOUD_MOOD_EASE_SECONDS);
    types.lerp(target, ease);
    skyUniforms.uCloudCover.value = THREE.MathUtils.lerp(
      skyUniforms.uCloudCover.value,
      _cloudMood.cover,
      ease
    );
  }
}

function updateDayNightCycle(delta) {
  // --- DAY/NIGHT CYCLE ---
  const debugMenu = getCachedElement('debug-menu');
  const isDebugMode = debugMenu && debugMenu.style.display === 'block';

  const CYCLE_DURATION_MS = DAY_CYCLE_MS;

  const useVirtualClock =
    isDebugMode ||
    state.manualTimeOfDay !== undefined ||
    state.daySpeedMultiplier !== 1 ||
    ChillFlightLogic.START_CLOCK !== null;

  if (useVirtualClock) {
    // In debug mode, we use a virtual clock that we increment ourselves,
    // allowing for speed multipliers while maintaining the same "warped" physics
    // as the wall clock.
    if (_debugVirtualClockNow === undefined) {
      _debugVirtualClockNow = ChillFlightLogic.START_CLOCK ?? Date.now();
    } else {
      _debugVirtualClockNow += delta * 1000 * state.daySpeedMultiplier;
    }
    state.worldClockNow = _debugVirtualClockNow;
    state.secondsInCycle =
      (((state.worldClockNow % CYCLE_DURATION_MS) + CYCLE_DURATION_MS) %
        CYCLE_DURATION_MS) /
      1000;

    // Keep older debug virtual seconds for compat just in case
  } else {
    // In normal mode, time follows the wall clock, so every player sees the
    // same time of day. Reset the virtual clock so it picks up from the wall
    // clock if re-enabled.
    _debugVirtualClockNow = undefined;

    state.worldClockNow = Date.now();
    state.secondsInCycle = (state.worldClockNow % CYCLE_DURATION_MS) / 1000;
  }

  state.latScale = 5000;
  state.currentLatDeg = -planeGroup.position.z / state.latScale;
  state.currentLatRad = (state.currentLatDeg * Math.PI) / 180;

  state.currentWarpedProgress = ChillFlightLogic.computeTimeOfDay(
    state.secondsInCycle,
    state.currentLatRad
  );
  state.timeOfDay = state.currentWarpedProgress * Math.PI * 2;

  if (state.manualTimeOfDay !== undefined) {
    if (state.daySpeedMultiplier !== 0) {
      state.manualTimeOfDay +=
        (delta * state.daySpeedMultiplier) / (CYCLE_DURATION_MS / 1000);
      if (state.manualTimeOfDay > 1.0) state.manualTimeOfDay -= 1.0;
      if (state.manualTimeOfDay < 0.0) state.manualTimeOfDay += 1.0;
    }
    state.timeOfDay = state.manualTimeOfDay * Math.PI * 2;
    state.currentWarpedProgress = state.manualTimeOfDay;
  }

  // Update slider UI if not manual, or if manual but time is flowing, or on initial load
  const timeSlider = getCachedElement('debug-time-slider');
  const timeSliderVal = getCachedElement('debug-time-val');
  if (
    timeSlider &&
    (state.manualTimeOfDay === undefined ||
      state.daySpeedMultiplier !== 0 ||
      timeSlider.dataset.initialized !== 'true')
  ) {
    timeSlider.dataset.initialized = 'true';
    timeSlider.value = state.currentWarpedProgress;
    if (timeSliderVal) {
      const hours = state.currentWarpedProgress * 24;
      const hh = Math.floor(hours).toString().padStart(2, '0');
      const mm = Math.floor((hours % 1) * 60)
        .toString()
        .padStart(2, '0');
      timeSliderVal.textContent = `${hh}:${mm}`;
    }
  }

  // Check and update the sky palette if it's a new cycle

  updateSkyPalette(state.worldClockNow);

  // Window glow
  houseWindowMats.forEach((mat, i) => {
    const offset = i * 0.05;
    const localSunY = -Math.cos(state.timeOfDay - offset);
    const nightValue = Math.max(0, (-localSunY + 0.1) * 2);
    mat.emissiveIntensity = Math.min(2.0, nightValue);
  });

  // Calculate streetlight intensity based on time of day
  const slSunY = -Math.cos(state.timeOfDay);
  const slNightValue = Math.max(0, (-slSunY + 0.1) * 2);

  streetlightBulbMat.emissiveIntensity = Math.min(2.0, slNightValue * 2.0);

  streetlightDecalMat.opacity = Math.min(1.0, slNightValue);
}

function updatePhysicsAndControls(delta, nowTime) {
  // Spin the propeller
  if (!state.isFreeCamera && Math.abs(state.flightSpeedMultiplier) > 0.001) {
    const baseSpin = 15 * Math.abs(state.flightSpeedMultiplier);
    const spin = Math.max(4, Math.min(25, baseSpin));
    if (state.propGroups && Array.isArray(state.propGroups)) {
      for (let i = 0; i < state.propGroups.length; i++) {
        if (state.propGroups[i]) state.propGroups[i].rotation.z += spin * delta;
      }
    } else {
      const activeProp = state.propGroup;
      if (activeProp) activeProp.rotation.z += spin * delta;
    }
  }

  // Animate pontoons
  if (
    !state.isFreeCamera &&
    state.isDeployingPontoons &&
    !state.isRetractingPontoons &&
    state.pontoonDeploymentProgress < 1
  ) {
    state.pontoonDeploymentProgress += delta * 0.5;
    if (state.pontoonDeploymentProgress > 1)
      state.pontoonDeploymentProgress = 1;
    const t = state.pontoonDeploymentProgress;
    const easeOut = 1 - Math.pow(1 - t, 3);

    pontoonGroup.scale.setScalar(easeOut);

    const leftRotAngle = (Math.PI / 2) * (1 - easeOut);
    pontoonL.rotation.z = leftRotAngle;
    hingeLF.rotation.z = leftRotAngle;
    hingeLB.rotation.z = leftRotAngle;
    const rightRotAngle = -(Math.PI / 2) * (1 - easeOut);
    pontoonR.rotation.z = rightRotAngle;
    hingeRF.rotation.z = rightRotAngle;
    hingeRB.rotation.z = rightRotAngle;
    pontoonL.position.y = -0.5 - 4.0 * easeOut;
    pontoonR.position.y = -0.5 - 4.0 * easeOut;
  } else if (
    !state.isFreeCamera &&
    state.isRetractingPontoons &&
    state.pontoonDeploymentProgress > 0
  ) {
    state.pontoonDeploymentProgress -= delta * 0.4;
    if (state.pontoonDeploymentProgress < 0) {
      state.pontoonDeploymentProgress = 0;
      state.isRetractingPontoons = false;
      state.isDeployingPontoons = false;
      pontoonGroup.visible = false;
    }
    const t = state.pontoonDeploymentProgress;
    const easeOut = 1 - Math.pow(1 - t, 3);

    pontoonGroup.scale.setScalar(easeOut);

    const leftRotAngle = (Math.PI / 2) * (1 - easeOut);
    pontoonL.rotation.z = leftRotAngle;
    hingeLF.rotation.z = leftRotAngle;
    hingeLB.rotation.z = leftRotAngle;
    const rightRotAngle = -(Math.PI / 2) * (1 - easeOut);
    pontoonR.rotation.z = rightRotAngle;
    hingeRF.rotation.z = rightRotAngle;
    hingeRB.rotation.z = rightRotAngle;
    pontoonL.position.y = -0.5 - 4.0 * easeOut;
    pontoonR.position.y = -0.5 - 4.0 * easeOut;
  }

  // Plane rotation control
  const maxPitch = Math.PI / 4;
  const maxRoll = Math.PI / 3;
  let effMouseX =
    state.mouseControlActive &&
    !state.isFreeCamera &&
    Math.abs(state.mouseX) >= 0.15
      ? state.mouseX
      : 0;
  let effMouseY =
    state.mouseControlActive &&
    !state.isFreeCamera &&
    Math.abs(state.mouseY) >= 0.15
      ? state.mouseY
      : 0;

  // Logical inputs based on Y-axis inversion
  const isUp =
    (state.invertYAxis ? keys.ArrowDown : keys.ArrowUp) && !state.isFreeCamera;
  const isDown =
    (state.invertYAxis ? keys.ArrowUp : keys.ArrowDown) && !state.isFreeCamera;
  const dtUp =
    (state.invertYAxis ? doubleTap.ArrowDown : doubleTap.ArrowUp) &&
    !state.isFreeCamera;
  const dtDown =
    (state.invertYAxis ? doubleTap.ArrowUp : doubleTap.ArrowDown) &&
    !state.isFreeCamera;
  const ttUp =
    (state.invertYAxis ? tripleTap.ArrowDown : tripleTap.ArrowUp) &&
    !state.isFreeCamera;
  const ttDown =
    (state.invertYAxis ? tripleTap.ArrowUp : tripleTap.ArrowDown) &&
    !state.isFreeCamera;
  const startUp = state.invertYAxis
    ? keyPressStartTime.ArrowDown
    : keyPressStartTime.ArrowUp;
  const startDown = state.invertYAxis
    ? keyPressStartTime.ArrowUp
    : keyPressStartTime.ArrowDown;

  const isLeft = keys.ArrowLeft && !state.isFreeCamera;
  const isRight = keys.ArrowRight && !state.isFreeCamera;
  const dtLeft = doubleTap.ArrowLeft && !state.isFreeCamera;
  const dtRight = doubleTap.ArrowRight && !state.isFreeCamera;

  // Auto-disable autopilot on manual steering input: arrow keys, or the touch
  // joystick, drag-steer or a gamepad stick pushed past the deadzone. Gyro
  // tilt and the desktop mouse are always "steering", so they don't count.
  const isDeliberateSteer =
    state.currentControlScheme !== 'gyro' &&
    inputManager.isDeliberateSteering() &&
    (effMouseX !== 0 || effMouseY !== 0);
  if (
    state.autopilotEnabled &&
    !keys.Shift &&
    (isUp || isDown || isLeft || isRight || isDeliberateSteer)
  ) {
    toggleAutopilot();
  }

  // Shift+Up/Down: throttle control
  if (keys.Shift) {
    const rawUp = keys.ArrowUp && !state.isFreeCamera;
    const rawDown = keys.ArrowDown && !state.isFreeCamera;
    const startRawUp = keyPressStartTime.ArrowUp;
    const startRawDown = keyPressStartTime.ArrowDown;

    if (rawUp) {
      const heldTime = nowTime - startRawUp;
      const ramp = Math.min(1.0, heldTime / 2000);
      const throttleRate = (0.2 + ramp * 1.0) * delta;
      state.targetFlightSpeed = Math.min(
        getMaxFlightSpeedMult(),
        state.targetFlightSpeed + throttleRate
      );
    } else if (rawDown) {
      const heldTime = nowTime - startRawDown;
      const ramp = Math.min(1.0, heldTime / 2000);
      const throttleRate = (0.2 + ramp * 1.0) * delta;
      state.targetFlightSpeed = Math.max(
        0,
        state.targetFlightSpeed - throttleRate
      );
    }
  }

  if (
    !state.isFreeCamera &&
    (state.flightSpeedMultiplier > 0 || Math.abs(state.targetFlightSpeed) > 0)
  ) {
    let yMultiplier = state.invertYAxis ? -1 : 1;
    state.targetPitch = effMouseY * maxPitch * yMultiplier;
    state.targetRoll = -effMouseX * (maxRoll * 1.25);

    state.manualPitch = THREE.MathUtils.lerp(
      state.manualPitch,
      0,
      0.1 * delta * 60
    );

    if (keys.Shift) {
      // Throttle already handled above; no pitch changes while Shift is held
    } else if (isUp && !dtUp) {
      const heldTime = nowTime - startUp;
      if (heldTime > STEER_HOLD_THRESHOLD) {
        state.targetPitch = (35 * Math.PI) / 180; // Full climb
      } else {
        const ramp = heldTime / STEER_HOLD_THRESHOLD;
        state.targetPitch = ((5 * Math.PI) / 180) * ramp;
      }
    } else if (isDown) {
      const heldTime = nowTime - startDown;
      if (heldTime > STEER_HOLD_THRESHOLD) {
        state.targetPitch = (-45 * Math.PI) / 180; // Softened full dive
      } else {
        const ramp = heldTime / STEER_HOLD_THRESHOLD;
        state.targetPitch = ((-5 * Math.PI) / 180) * ramp;
      }
    }
  } else if (!state.isFreeCamera) {
    state.targetPitch = 0;
    state.targetRoll = 0;
  }

  state.isBarrelRolling = false;
  state.isDoingFullBarrelRoll = false;
  state.isClampedRoll = false;
  state.isLooping = false;
  state.isDoingFullLoop = false;

  state.manualRollSpeed = 4.0;
  state.manualLoopSpeed = 2.5;

  if (
    !state.isFreeCamera &&
    state.autopilotEnabled &&
    state.flightSpeedMultiplier > 0
  ) {
    state.isDoingImmelmann = false;
    // 1. Maintain cruising speed (150 kts = 1.0 multiplier)
    state.targetFlightSpeed = 1.0;

    // 2. Altitude Control
    const currentRiverZ = ChillFlightLogic.getRiverCenterZ
      ? ChillFlightLogic.getRiverCenterZ(planeGroup.position.x, 0, simplex, 0)
      : 0;

    const distToRiver = Math.abs(currentRiverZ - planeGroup.position.z);
    let targetAltY = 145.5; // 2500 altitude
    if (distToRiver > 1500) {
      targetAltY = 445.5; // 10000 altitude
    } else if (distToRiver > 500) {
      const t = (distToRiver - 500) / 1000;
      targetAltY = 145.5 + t * (445.5 - 145.5);
    }

    const altError = Math.max(0, targetAltY - planeGroup.position.y);
    const maxAutoPitch = Math.PI / 6; // 30 degrees limit
    state.targetPitch = THREE.MathUtils.clamp(
      altError * 0.01,
      -maxAutoPitch,
      maxAutoPitch
    );

    // 3. Direction Control -> Always face the sun along the equator river
    // 1 for East (Sunrise / Morning), -1 for West (Sunset / Afternoon)
    const _sunX = Math.sin(state.timeOfDay);
    const lookDirX = _sunX >= 0 ? 1 : -1;

    // We look ahead a bit to calculate the river's local angle
    const lookAheadX = planeGroup.position.x + lookDirX * 300;
    const targetRiverZ = ChillFlightLogic.getRiverCenterZ
      ? ChillFlightLogic.getRiverCenterZ(lookAheadX, 0, simplex, 0)
      : 0;

    // Calculate the vector pointing down the river
    const dx = lookAheadX - planeGroup.position.x;
    const dz = targetRiverZ - currentRiverZ;

    // In this coordinate system, looking down -Z is rotation.y = 0.
    const riverAngle = Math.atan2(-dx, -dz);

    // Offset to steer back towards the center of the river.
    const zError = currentRiverZ - planeGroup.position.z;
    // If flying East (+X), we need the opposite correction sign to steer correctly towards the river.
    const correctionSign = lookDirX < 0 ? 1 : -1;
    const correctionAngle = THREE.MathUtils.clamp(
      zError * 0.003 * correctionSign,
      -Math.PI / 4,
      Math.PI / 4
    );

    const targetYaw = riverAngle + correctionAngle;

    let yawError = targetYaw - planeGroup.rotation.y;
    while (yawError > Math.PI) yawError -= Math.PI * 2;
    while (yawError < -Math.PI) yawError += Math.PI * 2;

    // Bank (roll) the plane to turn
    const maxAutoRoll = Math.PI / 4;
    state.targetRoll = THREE.MathUtils.clamp(
      yawError * 1.5,
      -maxAutoRoll,
      maxAutoRoll
    );

    // Cancel manual maneuvers
    state.isLooping = false;
    state.isBarrelRolling = false;
    state.isClampedRoll = false;
  } else if (!state.isFreeCamera && state.flightSpeedMultiplier > 0) {
    if (state.isDoingImmelmann) {
      if (state.immelmannProgress < Math.PI) {
        // Stage 1: Half-loop (pull up)
        const step = state.manualLoopSpeed * delta;
        planeGroup.rotation.x += step;
        state.immelmannProgress += step;
        state.isLooping = true;
      } else if (state.immelmannProgress < Math.PI * 2) {
        // Stage 2: Half-roll (roll upright)
        const rollStep = state.manualRollSpeed * delta;
        planeGroup.rotation.z += rollStep;
        state.immelmannProgress += rollStep;
        state.isLooping = true;
        state.isBarrelRolling = true;
      } else {
        state.isDoingImmelmann = false;
        // Snap the Euler rotation to a clean upright heading
        const forward = _immelmannForward
          .set(0, 0, -1)
          .applyEuler(planeGroup.rotation);
        const newYaw = Math.atan2(-forward.x, -forward.z);
        planeGroup.rotation.set(0, newYaw, 0, 'YXZ');
      }
    } else {
      if (
        isUp &&
        ttUp &&
        nowTime - startUp > STEER_HOLD_THRESHOLD &&
        !keys.Shift
      ) {
        // Triple-tap up and hold: loop
        planeGroup.rotation.x += state.manualLoopSpeed * delta;
        state.isLooping = true;
        state.isDoingFullLoop = true;
      } else if (
        isUp &&
        dtUp &&
        nowTime - startUp > STEER_HOLD_THRESHOLD &&
        !keys.Shift
      ) {
        // Double-tap up and hold: steep ascent
        const targetAscent = (Math.PI * 60) / 180; // 60 degrees
        planeGroup.rotation.x = THREE.MathUtils.lerp(
          planeGroup.rotation.x,
          targetAscent,
          0.05 * delta * 60
        );
        state.isLooping = true;
      } else if (
        (ttDown || tripleTap.ArrowDown) &&
        !keys.Shift &&
        !state.isDoingImmelmann
      ) {
        // Triple-tap down: Immelmann turn (automatic maneuver, no hold required)
        state.isDoingImmelmann = true;
        state.immelmannProgress = 0;
        tripleTap.ArrowDown = false;
        tripleTap.ArrowUp = false;
      } else if (
        isDown &&
        dtDown &&
        nowTime - startDown > STEER_HOLD_THRESHOLD &&
        !keys.Shift
      ) {
        // Double-tap down and hold: steep dive
        const targetDive = -(Math.PI * 70) / 180; // 70 degrees
        planeGroup.rotation.x = THREE.MathUtils.lerp(
          planeGroup.rotation.x,
          targetDive,
          0.05 * delta * 60
        );
        state.isLooping = true;
      }
    }

    if (!state.isDoingImmelmann && isLeft) {
      if (!keys.Shift) {
        if (dtLeft) {
          // Double-tap: full barrel roll
          planeGroup.rotation.z += state.manualRollSpeed * delta;
          state.isBarrelRolling = true;
          state.isDoingFullBarrelRoll = true;
        }
      }
    } else if (!state.isDoingImmelmann && isRight) {
      if (!keys.Shift) {
        if (dtRight) {
          // Double-tap: full barrel roll
          planeGroup.rotation.z -= state.manualRollSpeed * delta;
          state.isBarrelRolling = true;
          state.isDoingFullBarrelRoll = true;
        }
      }
    }
  }

  // Taxi steering: allow airplane to yaw when stopped or at very low speed
  if (!state.isFreeCamera && state.flightSpeedMultiplier < 0.4) {
    if (isLeft && !keys.Shift) {
      planeGroup.rotation.y += 1.5 * delta;
    } else if (isRight && !keys.Shift) {
      planeGroup.rotation.y -= 1.5 * delta;
    } else if (Math.abs(effMouseX) > 0.1 && !keys.Shift) {
      planeGroup.rotation.y -= effMouseX * 1.5 * delta;
    }
  }

  if (!state.isFreeCamera) {
    const flightRot = ChillFlightLogic.computeFlightRotation({
      currentPitch: planeGroup.rotation.x,
      currentRoll: planeGroup.rotation.z,
      currentYaw: planeGroup.rotation.y, // We'll compute yaw here too, but apply it later based on speed
      targetPitch: state.targetPitch + state.manualPitch,
      targetRoll: state.targetRoll,
      turningRoll: planeGroup.rotation.z,
      isBarrelRolling: state.isBarrelRolling,
      isLooping: state.isLooping,
      isClampedRoll: state.isClampedRoll,
      turnSpeed: TURN_SPEED,
      delta: delta,
    });

    planeGroup.rotation.x = flightRot.pitch;
    planeGroup.rotation.z = flightRot.roll;

    // Store calculated yaw to be applied later in the physics block
    state._nextYaw = flightRot.yaw;
  }
}

const SNOW_MAX_BRIGHTNESS = 0.95;
const SNOW_COOL_TINT = new THREE.Vector3(0.94, 0.99, 1.07);
const SHADOW_LOOK_AHEAD = 1400;
// How much of the hidden sun's light the sky light takes over in twilight
const TWILIGHT_SKY_SHARE = 0.6;
const _shadowAnchor = new THREE.Vector3();
const _shadowForward = new THREE.Vector3();

function updateShadowSnapping(delta) {
  // --- SHADOW TEXEL SNAPPING (View-Space) ---
  // Eliminates "shadow swimming" and depth-band "creeping" by locking the
  // shadow camera in all 3 dimensions to a rigid, sun-aligned grid.

  // Step 1: Compute the sun direction (Forward vector)
  // Clamp sunY to a small positive value so the shadow direction never flips.
  // This makes shadows smoothly stretch toward the horizon at sunset/sunrise
  // and then freeze. The dirLight intensity fades to 0 via sunLightFactor anyway,
  // so the frozen direction is invisible by the time it diverges from reality.
  _shadowSunDir
    .set(state.sunX, Math.max(0.15, state.sunY), state.sunZ)
    .normalize();

  // Step 2: Build a rigid local coordinate system for the light.
  _shadowRight.crossVectors(_worldUp, _shadowSunDir).normalize();
  _shadowUp.crossVectors(_shadowSunDir, _shadowRight).normalize();

  // Use planeGroup instead of camera by default to prevent high-speed camera shake
  // from causing erratic shadow snapping. If in free camera mode, use the camera.
  // Center the shadow box ahead of the anchor (along the camera's heading),
  // since almost nothing behind the plane is on screen. This pushes the
  // shadow edge from ~2 km ahead to ~3.5 km at the same map resolution.
  const anchorPos = _shadowAnchor.copy(
    state.isFreeCamera ? camera.position : planeGroup.position
  );
  camera.getWorldDirection(_shadowForward);
  _shadowForward.y = 0;
  if (_shadowForward.lengthSq() > 1e-6) {
    anchorPos.addScaledVector(_shadowForward.normalize(), SHADOW_LOOK_AHEAD);
  }

  // Step 3: Project the anchor's position onto this rigid light-grid.
  const dotX = anchorPos.dot(_shadowRight);
  const dotY = anchorPos.dot(_shadowUp);
  const dotZ = anchorPos.dot(_shadowSunDir); // Project depth

  // Step 4: Snap the projections to the exact texel size.
  // texelSize = frustum width (4096) / map width (2048) = 2.0
  const _shadowTexelSize = 4096 / 2048;
  const snappedX = Math.floor(dotX / _shadowTexelSize) * _shadowTexelSize;
  const snappedY = Math.floor(dotY / _shadowTexelSize) * _shadowTexelSize;
  const snappedZ = Math.floor(dotZ / _shadowTexelSize) * _shadowTexelSize; // Lock depth to stop creeping

  // Step 5: Calculate the exact offset needed to snap.
  const dx = snappedX - dotX;
  const dy = snappedY - dotY;
  const dz = snappedZ - dotZ;

  // Step 6: Apply the snapped offsets to a target vector, then smoothly lerp the light
  // This "softens" the snapping jumps so they aren't perceivable as jitter.
  _targetShadowPos.copy(anchorPos);
  _targetShadowPos.addScaledVector(_shadowRight, dx);
  _targetShadowPos.addScaledVector(_shadowUp, dy);
  _targetShadowPos.addScaledVector(_shadowSunDir, dz); // Apply depth snap

  dirLight.target.position.lerp(
    _targetShadowPos,
    1 - Math.pow(1 - 0.1, delta * 60)
  );

  // Position the light exactly 4000 units behind the target (must be larger than frustum radius)
  dirLight.position
    .copy(dirLight.target.position)
    .addScaledVector(_shadowSunDir, 4000);

  moonLight.position.copy(moonMesh.position);
  skyGroup.position.copy(getCameraWorldPosition());
}

function updateEnvironmentLighting(delta, now) {
  // Smoothly interpolate sky shader palettes
  if (skyUniforms !== undefined && !isCustomPalette) {
    skyUniforms.topColor.value.lerp(targetPaletteTop, delta * 0.1);
    skyUniforms.bottomColor.value.lerp(targetPaletteBottom, delta * 0.1);
  }

  // 1. Check if forced precipitation is currently visible on screen (or would be, if not above clouds)
  let precipIntensity = 0;
  if (snowParticles && rainParticles) {
    const sInt =
      (state._unfadedSnowOpacity !== undefined
        ? state._unfadedSnowOpacity
        : snowParticles.material.opacity) / 0.8;
    const rInt =
      (state._unfadedRainOpacity !== undefined
        ? state._unfadedRainOpacity
        : rainParticles.material.opacity) / 0.5;
    precipIntensity = Math.max(sInt, rInt);
  }

  // 2. Check for procedural cloudy biomes
  const weatherTimeOffset = (state.worldClockNow || now) / 100000;
  let weatherNoise =
    (simplex.noise2D(
      (planeGroup.position.x / CHUNK_SIZE) * 0.1 + 500 + weatherTimeOffset,
      (planeGroup.position.z / CHUNK_SIZE) * 0.1 + weatherTimeOffset
    ) +
      1) /
    2;
  // Cloud cover from the noise: clear below about 0.65, building smoothly
  // (no hard edge where clouds start) to overcast at 1.0
  weatherNoise = THREE.MathUtils.smoothstep(weatherNoise, 0.65, 1.0);

  // 3. The world is overcast if there are thick clouds (we don't force overcast for snow/rain so we can have beautiful snowy sunsets)
  if (manualCloudCover !== null) {
    _currentOvercast = manualCloudCover;
  } else {
    // Starts at the weather here (not clear skies), then eases toward it
    // slowly, so clouds build and clear gradually (#80): a time constant of
    // CLOUD_EASE_SECONDS, whatever the frame rate
    _currentOvercast =
      _currentOvercast === undefined
        ? weatherNoise
        : THREE.MathUtils.lerp(
            _currentOvercast,
            weatherNoise,
            1 - Math.exp(-delta / CLOUD_EASE_SECONDS)
          );
    const coverValElem = document.getElementById('debug-cloud-cover-val');
    const autoElem = document.getElementById('debug-cloud-auto-toggle');
    if (coverValElem && autoElem && autoElem.checked) {
      coverValElem.textContent = `Auto (${_currentOvercast.toFixed(2)})`;
    }
  }
  const overcast = _currentOvercast;

  // --- APPLY LIGHTING & CELESTIAL BODIES ---
  // Stars disappear when overcast
  let starFactor = Math.max(0, Math.min(1, (state.sunY + 0.2) / -0.3));
  starsMat.opacity = starFactor * (1.0 - overcast);

  // --- SHOOTING STARS ---
  if (
    (starFactor > 0.5 && overcast < 0.5) ||
    state.isShootingStarActive ||
    state.forceShootingStar
  ) {
    if (!state.isShootingStarActive) {
      if (state.forceShootingStar || Math.random() < delta / 30.0) {
        state.forceShootingStar = false;
        state.isShootingStarActive = true;
        state.shootingStarProgress = 0;
        state.shootingStarDuration = 0.8 + Math.random() * 0.4;

        const lookDir = _shootingStarLookDir;
        camera.getWorldDirection(lookDir);

        lookDir.y += 0.3 + Math.random() * 0.4;
        lookDir.x += (Math.random() - 0.5) * 1.5;
        lookDir.z += (Math.random() - 0.5) * 1.5;
        lookDir.normalize();

        const distance = 15000;
        shootingStarStart
          .copy(camera.position)
          .add(lookDir.multiplyScalar(distance));

        const streakDir = _shootingStarStreakDir
          .set(
            (Math.random() - 0.5) * 0.5,
            -0.2 - Math.random() * 0.3,
            (Math.random() - 0.5) * 0.5
          )
          .normalize();

        const streakLength = 4000 + Math.random() * 3000;
        shootingStarEnd
          .copy(shootingStarStart)
          .add(streakDir.multiplyScalar(streakLength));

        const starMesh = skyGroup.getObjectByName('shootingStar');
        if (starMesh) starMesh.visible = true;
      }
    } else {
      state.shootingStarProgress += delta / state.shootingStarDuration;
      const starMesh = skyGroup.getObjectByName('shootingStar');

      if (state.shootingStarProgress >= 1.0) {
        state.isShootingStarActive = false;
        if (starMesh) starMesh.visible = false;
      } else if (starMesh) {
        const headPos = _shootingStarHeadPos.lerpVectors(
          shootingStarStart,
          shootingStarEnd,
          state.shootingStarProgress
        );
        const tailLength = 0.15;
        const tailProgress = Math.max(
          0,
          state.shootingStarProgress - tailLength
        );
        const tailPos = _shootingStarTailPos.lerpVectors(
          shootingStarStart,
          shootingStarEnd,
          tailProgress
        );

        const positions = starMesh.geometry.attributes.position.array;

        headPos.sub(skyGroup.position);
        tailPos.sub(skyGroup.position);

        positions[0] = headPos.x;
        positions[1] = headPos.y;
        positions[2] = headPos.z;
        positions[3] = tailPos.x;
        positions[4] = tailPos.y;
        positions[5] = tailPos.z;
        starMesh.geometry.attributes.position.needsUpdate = true;

        const fadeOut = 1.0 - Math.pow(state.shootingStarProgress, 4);
        const alpha = Math.min(1.0, fadeOut) * (1.0 - overcast);

        const colors = starMesh.geometry.attributes.color.array;
        colors[0] = alpha;
        colors[1] = alpha;
        colors[2] = alpha;
        colors[3] = 0;
        colors[4] = 0;
        colors[5] = 0;
        starMesh.geometry.attributes.color.needsUpdate = true;
      }
    }
  }

  // --- RAINBOW ---
  const isDaytime = state.sunY > 0;

  const rainbowMesh = skyGroup.getObjectByName('rainbow');

  const startRainbow = () => {
    if (state.rainbowTimer <= 0 && rainbowMesh) {
      // Lock position when spawned so it doesn't move across the sky
      const sunDir = _rainbowSunDir
        .set(state.sunX, state.sunY, state.sunZ)
        .normalize();
      const antiSunDir = _rainbowAntiSunDir.copy(sunDir).negate();
      rainbowMesh.position.copy(antiSunDir).multiplyScalar(10000);
      rainbowMesh.lookAt(getCameraWorldPosition());
    }
    state.rainbowTimer = 120.0;
  };

  if (state.forceRainbow) {
    state.forceRainbow = false;
    startRainbow();
  }

  if (rainbowMesh) {
    if (state.rainbowTimer > 0 && isDaytime) {
      state.rainbowTimer -= delta;
      state.rainbowIntensity = Math.min(
        1.0,
        state.rainbowIntensity + delta * 0.2
      );
      rainbowMesh.visible = true;
      rainbowMesh.material.uniforms.uAlpha.value = state.rainbowIntensity;
    } else {
      state.rainbowTimer = 0;
      state.rainbowIntensity = Math.max(
        0.0,
        state.rainbowIntensity - delta * 0.2
      );
      if (state.rainbowIntensity <= 0) {
        rainbowMesh.visible = false;
      } else {
        rainbowMesh.material.uniforms.uAlpha.value = state.rainbowIntensity;
      }
    }
  }

  // --- AURORA BOREALIS ---
  // Aurora is visible only at night AND at high northern latitudes.
  // latVal > 0.5 => player is north of ~0.5°N in our coordinate system.
  // The aurora ramps in from latVal 0.5 to 1.0 (fully visible at 1.0+).
  const auroraLatFactor = THREE.MathUtils.clamp(
    (state.currentLatDeg - 0.5) / 0.5,
    0,
    1
  );
  const auroraNightFactor = starFactor; // reuse: 0 at day, 1 at deep night

  // Geomagnetic activity: slow simplex noise on the world clock so the aurora
  // naturally waxes and wanes — sometimes absent, sometimes a faint shimmer,
  // sometimes blazing. Two samples at different rates give organic variation.
  // Period ~20 min (primary) + ~7 min (secondary). The same for every player.
  const _auroraT1 = state.worldClockNow / 1200000; // ~20-min primary cycle
  const _auroraT2 = state.worldClockNow / 420000; // ~7-min secondary detail
  const _auroraRaw =
    simplex.noise2D(_auroraT1, 0.37) * 0.7 +
    simplex.noise2D(_auroraT2, 1.91) * 0.3; // -1 to 1
  // Map noise to 0..1: quiet (~33% of the time when noise is low/negative),
  // linearly scaling to 1.0 at peak. No pow bias — overcast already suppresses it.
  const auroraActivity = THREE.MathUtils.clamp(_auroraRaw * 0.6 + 0.4, 0, 1);

  const targetAuroraIntensity = Math.min(
    0.08,
    auroraLatFactor * auroraNightFactor * (1.0 - overcast) * auroraActivity
  );
  if (skyUniforms !== undefined) {
    skyUniforms.uAuroraIntensity.value = THREE.MathUtils.lerp(
      skyUniforms.uAuroraIntensity.value,
      targetAuroraIntensity,
      1 - Math.pow(1 - 0.002, delta * 60)
    );
  }

  // Fix: Three.js requires needsUpdate to be true the first time transparency is enabled
  if (sunMesh && sunMesh.material) {
    if (!sunMesh.material.transparent) {
      sunMesh.material.transparent = true;
      sunMesh.material.needsUpdate = true;
    }
    sunMesh.material.opacity = 1.0 - overcast;
  }
  // Fade moon opacity: fully visible at night, subtle silhouette during day
  const moonCycleFactor = THREE.MathUtils.lerp(1.0, 0.08, state.dayFactor);
  if (moonMesh && moonMesh.material) {
    if (!moonMesh.material.transparent) {
      moonMesh.material.transparent = true;
      moonMesh.material.needsUpdate = true;
    }
    moonMesh.material.opacity = moonCycleFactor * (1.0 - overcast);
  }

  // The sun's share of the light before sunrise (and after sunset) goes to
  // the sky light instead, so twilight keeps its brightness without the sun
  // casting shadows from below the horizon (Issue #87)
  const sunLight = THREE.MathUtils.lerp(0.8, 0.05, overcast) * state.dayFactor;
  const twilightLight = sunLight * (1 - state.sunLightFactor);
  let baseHemi = THREE.MathUtils.lerp(0.3, 0.6, state.dayFactor);
  hemiLight.intensity =
    (THREE.MathUtils.lerp(baseHemi, 0.7, overcast * state.dayFactor) +
      twilightLight * TWILIGHT_SKY_SHARE) *
    Math.PI;

  dirLight.intensity = sunLight * state.sunLightFactor * Math.PI;

  const PHASE_CYCLE_MS = 29.5 * 360000;
  const phaseAngle =
    ((state.worldClockNow % PHASE_CYCLE_MS) / PHASE_CYCLE_MS) * Math.PI * 2;
  const phaseIntensity = (-Math.cos(phaseAngle) + 1.0) / 2.0;

  // Moonlight shines when the sun is down, independent of moon's now-fixed elevation
  let moonFactor = Math.max(0, Math.min(1, (-state.sunY - 0.25) / 0.25));
  moonLight.intensity =
    moonFactor * 0.4 * (1.0 - overcast) * phaseIntensity * Math.PI;

  // --- APPLY SKY & FOG ---
  _uncloudedSkyColor.setHex(0x0a0c20);
  if (skyUniforms !== undefined && skyUniforms.bottomColor) {
    _uncloudedFogColor.copy(skyUniforms.bottomColor.value);
  } else {
    _uncloudedFogColor.setHex(0x060815);
  }

  if (state.dayFactor > 0.0) {
    let dawnDuskFactor = 1.0 - Math.min(1, Math.abs(state.sunY) * 2.5);
    dawnDuskFactor = Math.max(0, Math.pow(dawnDuskFactor, 1.5));

    if (state.sunX > 0) {
      _currentSunriseSky.copy(_sunriseSky);
      _currentGoldenSky.copy(_goldenSky);
    } else {
      _currentSunriseSky.copy(_sunsetSky);
      _currentGoldenSky.copy(_goldenSunsetSky);
    }

    _uncloudedSkyColor.lerp(_twilightSky, state.dayFactor * 0.4);

    // Allow sunset colors in the main sky even when overcast (Issue #24)
    _uncloudedSkyColor.lerp(_currentSunriseSky, dawnDuskFactor);

    if (state.sunY > -0.1 && state.sunY < 0.15) {
      let goldT = 1.0 - Math.abs(state.sunY - 0.02) * 10;
      _uncloudedSkyColor.lerp(_currentGoldenSky, Math.max(0, goldT) * 0.35);
    }

    _uncloudedSkyColor.lerp(_daySky, state.dayFactor * (1.0 - dawnDuskFactor));

    // Warm up the directional light during golden hour
    const sunsetLightCol =
      state.sunX > 0 ? _sunriseLightColor : _sunsetLightColor;
    dirLight.color.copy(_dayLightColor).lerp(sunsetLightCol, dawnDuskFactor);
  } else {
    dirLight.color.setHex(0xfff0dd);
  }

  _cloudyColor.setHex(0x0a0c10).lerp(_stormColor, state.dayFactor);

  _finalSkyColor.copy(_uncloudedSkyColor).lerp(_cloudyColor, overcast);
  _finalFogColor.copy(_uncloudedFogColor).lerp(_cloudyColor, overcast);

  scene.fog.color.lerp(_finalFogColor, 1 - Math.pow(1 - 0.05, delta * 60));

  // Fog density follows the conditions: clear skies, morning fog, clouds,
  // precipitation, and mist lingering after rain (see computeFogDensity).
  const baseFogDensity =
    state.manualBaseFogDensity !== undefined
      ? state.manualBaseFogDensity
      : ChillFlightLogic.FOG.CLEAR;
  if (precipIntensity > fogAfterRain) {
    fogAfterRain = precipIntensity;
  } else {
    fogAfterRain *= Math.exp(
      -delta / ChillFlightLogic.FOG.AFTER_RAIN_FADE_SECONDS
    );
  }
  const targetFogDensity = ChillFlightLogic.computeFogDensity({
    overcast,
    precipIntensity,
    hour: (state.timeOfDay / (Math.PI * 2)) * 24,
    afterRain: fogAfterRain,
    clearDensity: baseFogDensity,
  });
  scene.fog.density = THREE.MathUtils.lerp(
    scene.fog.density,
    targetFogDensity,
    1 - Math.pow(1 - 0.01, delta * 60)
  );

  // Update slider UI and values
  const fogSlider = getCachedElement('debug-fog-slider');
  const baseFogVal = getCachedElement('debug-base-fog-val');
  const finalFogVal = getCachedElement('debug-final-fog-val');

  if (fogSlider && state.manualBaseFogDensity === undefined) {
    fogSlider.value = baseFogDensity;
  }
  if (baseFogVal && state.manualBaseFogDensity === undefined) {
    baseFogVal.textContent = baseFogDensity.toFixed(5);
  }
  if (finalFogVal) {
    finalFogVal.textContent = scene.fog.density.toFixed(5);
  }

  // Update Sky Shader Colors
  if (!isCustomPalette) {
    skyUniforms.topColor.value.copy(_finalSkyColor);
  }

  _tempVec.set(state.sunX, state.sunY, state.sunZ).normalize();
  skyUniforms.sunDirection.value.copy(_tempVec);
  const cloudSpeed =
    typeof manualCloudSpeed === 'number' ? manualCloudSpeed : 1.0;
  state.cloudTime =
    (state.cloudTime ?? now * 0.001) +
    delta *
      (typeof state.daySpeedMultiplier !== 'undefined'
        ? state.daySpeedMultiplier
        : 1) *
      cloudSpeed;
  skyUniforms.uTime.value = state.cloudTime;
  skyUniforms.uCloudDensity.value = overcast;
  updateCloudMood(delta);
  if (skyUniforms.uCloudHeight) {
    skyUniforms.uCloudHeight.value = manualCloudHeight;
  }
  const _camWorld = getCameraWorldPosition();
  skyUniforms.uCameraPos.value.copy(_camWorld);

  if (terrainUniforms) {
    terrainUniforms.uCameraPosXZ.value.set(_camWorld.x, _camWorld.z);
    terrainUniforms.uRenderRadius.value = state.RENDER_DISTANCE * CHUNK_SIZE;
    terrainUniforms.uSunDirection.value.copy(_tempVec);
    // Brightest light on flat ground (hemisphere + sun); scale snow so it
    // tops out just under white instead of clipping, shifting it slightly
    // cool as it dims so it doesn't read beige under the warm sun.
    const flatGroundLight =
      (hemiLight.intensity + dirLight.intensity * Math.max(0, _tempVec.y)) /
      Math.PI;
    const snowExposure = Math.min(
      1,
      SNOW_MAX_BRIGHTNESS / Math.max(flatGroundLight, 1e-3)
    );
    const coolShift = Math.min(1, (1 - snowExposure) / 0.3);
    terrainUniforms.uSnowExposure.value
      .copy(SNOW_COOL_TINT)
      .subScalar(1)
      .multiplyScalar(coolShift)
      .addScalar(1)
      .multiplyScalar(snowExposure);
    if (skyUniforms) {
      terrainUniforms.uTopColor.value.copy(skyUniforms.topColor.value);
      terrainUniforms.uBottomColor.value.copy(skyUniforms.bottomColor.value);
    }
  }

  if (waterUniforms && waterUniforms.uSpecularDir) {
    // Fade the sun's glitter path in/out as the sun crosses the horizon
    // (full strength from just above it: sunsets are when it matters most).
    const sunFade = THREE.MathUtils.clamp((state.sunY + 0.01) * 25.0, 0, 1);
    const moonFade = THREE.MathUtils.clamp(-state.sunY * 5.0, 0, 1);

    if (sunFade > moonFade) {
      waterUniforms.uSpecularDir.value.copy(_tempVec);
      waterUniforms.uSunColor.value
        .copy(dirLight.color)
        .multiplyScalar(Math.max(0, 1.0 - overcast) * sunFade);
    } else {
      const moonDirNorm = _waterMoonDirNorm
        .set(state.moonX, state.moonY, state.moonZ)
        .normalize();
      waterUniforms.uSpecularDir.value.copy(moonDirNorm);

      // Silver, and visible even for a thin crescent
      waterUniforms.uSunColor.value
        .setHex(0xbad2ff)
        .multiplyScalar(
          Math.max(0, 1.0 - overcast) *
            (0.3 + 0.7 * phaseIntensity) *
            0.8 *
            moonFade
        );
    }
    waterUniforms.uGlitterWarm.value = sunFade > moonFade ? 1 : 0;

    // Wind in the trees: a breeze, gustier as the weather turns
    windUniforms.uWindStrength.value = 0.7 + overcast * 0.9;

    // Moonlight on the clouds and the halo around the moon
    moonlightUniforms.uMoonDir.value
      .set(state.moonX, state.moonY, state.moonZ)
      .normalize();
    moonlightUniforms.uMoonBright.value =
      moonFade * (0.3 + 0.7 * phaseIntensity) * (1.0 - 0.6 * overcast);
  }

  sunUniforms.uTime.value = now * 0.001;
  sunUniforms.overcast.value = overcast;
  sunUniforms.dayFactor.value = state.dayFactor;

  // Dynamic Sun Sizing (Moon Illusion)
  const sunElevation = Math.max(0.0, state.sunY);
  const sunScale = 1.0 + Math.pow(1.0 - sunElevation, 3.0) * 1.5;
  sunMesh.scale.setScalar(sunScale);

  // Dynamic Sun Color (Golden Hour)
  const colorFactor = 1.0 - Math.pow(1.0 - sunElevation, 3.0);
  sunUniforms.uSunColor.value
    .copy(_sunSunsetColor)
    .lerp(_sunNoonColor, colorFactor);

  moonUniforms.uTime.value = now * 0.001;
  moonUniforms.overcast.value = overcast;
  moonUniforms.dayFactor.value = state.dayFactor;
  moonUniforms.uCloudDensity.value = skyUniforms.uCloudDensity?.value ?? 0.5;
  moonUniforms.uMoonSkyDir.value
    .set(state.moonX, state.moonY, state.moonZ)
    .normalize();
  moonUniforms.uCameraPos.value.copy(getCameraWorldPosition());

  // Update moon direction local to its rotation for consistent phase lighting

  // Build a CAMERA-INDEPENDENT billboard basis so the phase never rotates
  // Z always points from moon toward Earth (camera), X is world-horizontal,
  // Y is approximately world-up on the moon face.
  const vMoonDir = _moonVMoonDir.copy(moonMesh.position).normalize();
  const vZ = _moonVZ.copy(vMoonDir).negate();
  const vX = _moonVX.crossVectors(_upVector, vZ);
  if (vX.lengthSq() < 0.0001) vX.set(1, 0, 0); // fallback if moon is at zenith
  vX.normalize();
  const vY = _moonVY.crossVectors(vZ, vX).normalize();

  const mRot = _moonMRot.makeBasis(vX, vY, vZ);
  moonMesh.quaternion.setFromRotationMatrix(mRot);

  // Pass the rotation matrix so the shader can recover world normals
  const moonRotMat = _moonRotMat.setFromMatrix4(mRot);
  moonUniforms.uMoonRotMat.value.copy(moonRotMat);
  // Phase light direction — 29.5 game days per cycle
  // Ties the moon phase back to the game clock so it advances faster when time is sped up
  const moonDirNorm = _moonDirNorm
    .set(state.moonX, state.moonY, state.moonZ)
    .normalize();
  const phaseX = _moonPhaseX.crossVectors(_upVector, moonDirNorm);
  if (phaseX.lengthSq() < 0.001) phaseX.set(1, 0, 0);
  phaseX.normalize();
  // Sun orbits through the moon-origin axis to create full/new moon phases
  const phaseSunDir = _moonPhaseSunDir
    .copy(moonDirNorm)
    .multiplyScalar(Math.cos(phaseAngle))
    .addScaledVector(phaseX, Math.sin(phaseAngle))
    .normalize();
  moonUniforms.uSunDirectionWorld.value.copy(phaseSunDir);

  // Dynamic Moon Sizing (Moon Illusion) — uniform scale only
  const moonElevation = Math.max(0.0, state.moonY);
  const moonScale = 1.0 + Math.pow(1.0 - moonElevation, 3.0) * 1.5;
  moonMesh.scale.setScalar(moonScale);

  if (!isCustomPalette) {
    if (state.dayFactor > 0.0) {
      let dawnDuskFactor = 1.0 - Math.min(1, Math.abs(state.sunY) * 2.5);
      dawnDuskFactor = Math.max(0, Math.pow(dawnDuskFactor, 1.5));

      _skyBottomCol.copy(_finalSkyColor);
      if (dawnDuskFactor > 0.0) {
        _warmHorizonColor.set(selectedPalette.bottom);
        // LET THE SUNSET HORIZON BLEED THROUGH OVERCAST, ESPECIALLY DURING SNOW
        const isSnowing =
          snowParticles &&
          rainParticles &&
          (state._unfadedSnowOpacity || snowParticles.material.opacity) >
            (state._unfadedRainOpacity || rainParticles.material.opacity);

        const overcastMuteFactor = isSnowing ? 0.3 : 0.6; // Snow only mutes by 30%, rain by 60%
        const actualDawnDusk =
          dawnDuskFactor * 0.8 * (1.0 - overcast * overcastMuteFactor);
        _skyBottomCol.lerp(_warmHorizonColor, actualDawnDusk);
      }

      skyUniforms.bottomColor.value.copy(_skyBottomCol);
    } else {
      _skyBottomCol.copy(_finalSkyColor).multiplyScalar(0.8);
      skyUniforms.bottomColor.value.copy(_skyBottomCol);
    }
  }
}

function updateWeatherAndRendering(delta) {
  // Update the particle positions
  updateWeather(delta);
  // Sync chunk border helpers if enabled (low cost — only iterates loaded chunks)
  syncChunkBorders();

  // Shadow cadence: DynamicPerformanceMonitor throttles shadow updates under load
  // and disables them entirely at night when dirLight intensity is effectively zero.
  renderer.shadowMap.needsUpdate = performanceMonitor.shouldUpdateShadows();

  renderer.render(scene, camera);
}

function updateBenchmarking(delta, frameStartTime) {
  // --- BENCHMARKING LOGIC ---
  if (ChillFlightLogic.START_BENCHMARK !== null && !benchmarkComplete) {
    if (!benchmarkStartTime) {
      benchmarkStartTime = performance.now();
      benchmarkFrameTimes = [];
      state.autopilotEnabled = true;

      const overlay = document.createElement('div');
      overlay.id = 'benchmark-overlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '20px';
      overlay.style.left = '50%';
      overlay.style.transform = 'translateX(-50%)';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
      overlay.style.color = '#fff';
      overlay.style.padding = '20px';
      overlay.style.borderRadius = '8px';
      overlay.style.fontFamily = 'monospace';
      overlay.style.zIndex = '9999';
      overlay.style.pointerEvents = 'none';
      overlay.innerText = 'BENCHMARKING...';
      document.body.appendChild(overlay);
    } else {
      const elapsed = performance.now() - benchmarkStartTime;
      const durationMs = ChillFlightLogic.START_BENCHMARK * 1000;

      // Record frame time
      const currentFrameTime = performance.now() - frameStartTime;
      benchmarkFrameTimes.push(currentFrameTime);
      if (currentFrameTime > 50) {
        console.warn(
          `[Spike] ${currentFrameTime.toFixed(1)}ms at t=${(elapsed / 1000).toFixed(1)}s`
        );
      }

      if (elapsed >= durationMs) {
        benchmarkComplete = true;
        state.isPaused = true;

        const times = benchmarkFrameTimes;
        times.sort((a, b) => b - a); // Descending (worst to best)

        const sum = times.reduce((a, b) => a + b, 0);
        const mean = sum / times.length;

        const p1Index = Math.max(1, Math.floor(times.length * 0.01));
        const p1Times = times.slice(0, p1Index);
        const p1Mean = p1Times.reduce((a, b) => a + b, 0) / p1Times.length;

        const p01Index = Math.max(1, Math.floor(times.length * 0.001));
        const p01Times = times.slice(0, p01Index);
        const p01Mean = p01Times.reduce((a, b) => a + b, 0) / p01Times.length;

        const maxSpike = times[0];

        const avgFps = (1000 / mean).toFixed(1);
        const p1Fps = (1000 / p1Mean).toFixed(1);
        const p01Fps = (1000 / p01Mean).toFixed(1);

        const overlay = document.getElementById('benchmark-overlay');
        overlay.style.pointerEvents = 'auto';
        overlay.innerHTML = `
          <h2 style="margin-top:0;font-family:Inter,sans-serif">Benchmark complete</h2>
          <table style="text-align:left; width:100%; border-spacing:8px">
            <tr><td>Duration</td><td>${ChillFlightLogic.START_BENCHMARK}s</td></tr>
            <tr><td>Total frames</td><td>${times.length}</td></tr>
            <tr><td>Mean FPS</td><td>${avgFps}</td></tr>
            <tr><td>1% low FPS</td><td>${p1Fps}</td></tr>
            <tr><td>0.1% low FPS</td><td>${p01Fps}</td></tr>
            <tr><td>Max frame spike</td><td>${maxSpike.toFixed(1)}ms</td></tr>
          </table>
          <button onclick="document.getElementById('benchmark-overlay').remove(); window.isPaused=false;" style="margin-top:15px; width:100%; padding:8px; cursor:pointer; background:#333; color:#fff; border:none; border-radius:4px">Close and resume</button>
        `;
        console.table({
          'Mean FPS': avgFps,
          '1% low FPS': p1Fps,
          '0.1% low FPS': p01Fps,
          'Max spike (ms)': maxSpike.toFixed(1),
        });
      } else {
        const remaining = ((durationMs - elapsed) / 1000).toFixed(1);
        document.getElementById('benchmark-overlay').innerText =
          `BENCHMARKING... ${remaining}s`;
      }
    }
  }
}
