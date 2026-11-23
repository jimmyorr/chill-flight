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
import {arches} from './arches.js';
import {archCeiling} from './arches-logic.js';
import {
  ABOVE_CLOUDS,
  CEILING,
  ceilingClimbLimit,
  flightCeiling,
  ROLL_EXIT,
  joystickResponse,
  rollExitHandOver,
  rollExitTurns,
  sagClimbCap,
  stepRollExit,
  thinAirAt,
} from './flight-physics-logic.js';
import {LANDMARKS} from './landmarks.js';
import {
  _daySky,
  camera,
  clock,
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
  updateSkyPalette,
  updateShootingStar,
} from './sky.js';
import {renderFrame} from './outline-pass.js';
import {newPropSpin, propSpinTarget, stepPropSpin} from './prop-spin-logic.js';
import {updatePlaneShadow} from './plane-shadow.js';
import {performanceMonitor} from './game-performance.js';
import {updatePerfHud} from './perf-hud.js';
import {updateDebugTelemetry} from './debug-telemetry.js';
import {noteMove} from './tap-moves.js';
import {
  _cloudyColor,
  _currentGoldenSky,
  _currentLookTarget,
  _currentSunriseSky,
  _dayLightColor,
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
  _skyBottomCol,
  _stormColor,
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
  targetPaletteBottom,
  targetPaletteTop,
} from './game.js';
import {
  BASE_FLIGHT_SPEED,
  CHUNK_SIZE,
  MACH_1_KTS,
  TURN_SPEED,
  WATER_LEVEL,
  displaySpeed,
  getCachedElement,
  moonlightUniforms,
  terrainUniforms,
} from './constants.js';
import {
  activePlaneType,
  getMaxFlightSpeedMult,
  planeGroup,
  planeHandling,
  poseGear,
  updateHeadlightBeam,
} from './airplane.js';
import {
  manualCloudCover,
  manualCloudHeight,
  manualCloudSpeed,
  precipitation,
  rainParticles,
  snowParticles,
  updateWeather,
} from './weather-manager.js';
import {pulseXRControllers, updateVRPauseInteraction} from './vr-manager.js';
import {
  createVRSimStickState,
  simStickAxisResponse,
  stepVRSimStickAttitude,
} from './vr-controls-logic.js';
import {scene} from './scene.js';
import {clearInputState} from './game-state.js';
import {toggleAutopilot, updateThrottle} from './game-ui.js';
import {updateAutopilot, updateDrivingAutopilot} from './autopilot.js';
import {updateFlightPhysics} from './flight-physics.js';
import {updateBuggy} from './buggy.js';
import {log} from './logger.js';
import {
  getElevation,
  houseWindowGlow,
  houseWindowMats,
  streetlightBulbMat,
  lighthouseLampMat,
  streetlightDecalMat,
  fireGlowMat,
  waterUniforms,
  windUniforms,
} from './terrain-geometry.js';
import {updateFlightCamera} from './flight-camera.js';
import {updateTraffic} from './traffic.js';
import {updateBeacons} from './beacons.js';
import {updateRoadTraffic} from './road-traffic.js';
import {updateParticles} from './particles.js';
import {updateTireTracks} from './tire-tracks.js';
import {updateWhales} from './whales.js';
import {updateDolphins} from './dolphins.js';
import {updateGrass} from './grass.js';
import {updateTreeWash} from './tree-wash.js';
import {updateFireflies} from './fireflies.js';
import {updateFireworks} from './fireworks.js';
import {updateMultiplayer} from './multiplayer.js';
import {updateBreakables} from './breakables.js';
import {applyTrip, restoreTrip, updateTrip} from './mushroom-trip.js';
import {updateRush} from './crystal-rush.js';
import {applyBumps, updateBumps} from './bumps.js';
import {updateWallScrape} from './wall-scrape.js';
import {updateCrash} from './crash.js';
import {updateWaypoint} from './waypoint.js';
import {updateJobs} from './jobs.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {ART_CLOUDS} from './art-style.js';
import {updateAirportLights, updateWindsocks} from './airports.js';
import {updateTowerSlices} from './sky-uniforms.js';
import {updateCloudDeck, updateCloudVeil} from './cloud-deck.js';
import {simplex} from './noise.js';
import {globalInstancer, processChunkQueue} from './terrain-chunks.js';
import {FAR_RADIUS, updateFarTerrain} from './far-terrain.js';
import {hooks} from './hooks.js';
import {portalVeilMat} from './building-models.js';
import {state} from './state.js';
import {updateSfx} from './sfx.js';
import {playPortalWarp, updateSfxEvents} from './sfx-events.js';
import {updateHaptics} from './haptics.js';
import {Achievements} from './achievements.js';
import {
  applyPromoReplay,
  configurePromoDirector,
  updatePromoDirector,
} from './promo-director.js';
import {t} from './i18n.js';
import {xmasGlowMat} from './xmas-models.js';

let scriptedStartYaw = 0;
let scriptedStartSpeed = 1;
const immelmann = {
  pitch: 0,
  pitchRate: 0,
  roll: 0,
  yaw: 0,
  speed: 0,
  duration: 2.4,
};
// Promo clips: filming starts with a promo-script event (promo.js, shorts.js),
// and the clip's keyframes fly the plane, camera, wingmen, or replay from then on
window.addEventListener('promo-script', (event) => {
  scriptedStartYaw = planeGroup.rotation.y;
  scriptedStartSpeed = state.flightSpeedMultiplier;
  configurePromoDirector(event.detail, performance.now());
});

let _currentOvercast;
const _meteorMoonDir = new THREE.Vector3();
// How slowly the sky follows the weather map's cloud cover (seconds)
const CLOUD_EASE_SECONDS = 12;
let _debugVirtualClockNow;
// Lingering mist after rain or snow, 0..1 (drives fog density).
let fogAfterRain = 0;
let benchmarkComplete;
let benchmarkStartTime;
let benchmarkFrameTimes;

var isAnimationLoopRunning = false;
let hasCrashed = false;
// After a loop or Immelmann, how long before a steep climb or dive counts
// for To the moon / Nose dive (seconds)
const STUNT_PITCH_GRACE = 2;
let stuntPitchGrace = 0;
// Frequent flyer: lifetime distance travelled (units; 1000 to a km)
const FREQUENT_FLYER_DISTANCE = 100000;
// Tomb raider: within this of the middle pyramid, across the ground (units)
const PYRAMIDS = LANDMARKS.find((l) => l.name === 'Pyramids');
const TOMB_RAIDER_RANGE = 900;
const PORTAL_SITES = ChillFlightLogic.portalSites(simplex, {WATER_LEVEL});
let portalCooldown = 0;
let portalFlash = 0;
let portalFlashEl = null;

function updatePortalFlash(delta, nowTime) {
  if (portalVeilMat) {
    portalVeilMat.opacity =
      0.16 + 0.06 * Math.sin(nowTime * 0.0025) + portalFlash * 0.35;
  }
  if (portalCooldown > 0) portalCooldown = Math.max(0, portalCooldown - delta);
  if (portalFlash <= 0) return;
  portalFlash = Math.max(0, portalFlash - delta / 0.85);
  if (!portalFlashEl && typeof document !== 'undefined') {
    portalFlashEl = document.createElement('div');
    portalFlashEl.id = 'portal-flash';
    portalFlashEl.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:900;background:radial-gradient(circle at 50% 50%, rgba(255,255,255,0.92) 0%, rgba(196,148,255,0.68) 45%, rgba(108,52,224,0.28) 100%);opacity:0;mix-blend-mode:screen;';
    document.body.appendChild(portalFlashEl);
  }
  if (portalFlashEl) {
    const ease = portalFlash * portalFlash;
    portalFlashEl.style.opacity = (ease * 0.85).toFixed(3);
  }
}

function animate(timestamp) {
  if (hasCrashed || !renderer) return;
  try {
    performFrame(timestamp);
  } catch (err) {
    if (hasCrashed) return;
    hasCrashed = true;
    log.error('Game crashed in animation loop:', err);
    if (renderer && typeof renderer.setAnimationLoop === 'function') {
      renderer.setAnimationLoop(null);
    }
    const crashDiv = document.createElement('div');
    crashDiv.id = 'crash-screen';
    crashDiv.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(100,0,0,0.85);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;font-family:monospace;padding:20px;box-sizing:border-box;text-align:center;';

    const h1 = document.createElement('h1');
    h1.style.cssText = 'font-size:2em;margin-bottom:0.5em;';
    h1.textContent = t('Game crashed');

    const p = document.createElement('p');
    p.style.cssText = 'margin-bottom:1em;font-size:1.2em;';
    p.textContent = t('A fatal error occurred in the game loop.');

    const preContainer = document.createElement('div');
    preContainer.style.cssText =
      'background:rgba(0,0,0,0.6);padding:15px;border-radius:8px;max-width:800px;width:100%;overflow-x:auto;text-align:left;';

    const pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-all;';
    pre.textContent = err && err.stack ? err.stack : err;
    preContainer.appendChild(pre);

    const btn = document.createElement('button');
    btn.style.cssText =
      'margin-top:20px;padding:10px 20px;font-size:1.2em;cursor:pointer;background:#fff;color:#900;border:none;border-radius:5px;font-weight:bold;';
    btn.textContent = t('Reload game');
    btn.onclick = () => location.reload();

    crashDiv.appendChild(h1);
    crashDiv.appendChild(p);
    crashDiv.appendChild(preContainer);
    crashDiv.appendChild(btn);

    document.body.appendChild(crashDiv);
  }
}

function performFrame(timestamp) {
  // Sync InputManager state
  inputManager.state.isPaused = state.isPaused;
  inputManager.state.isFreeCamera = state.isFreeCamera;
  inputManager.state.isCinematic = state.cameraMode === 'cinematic';

  const steering = inputManager.getSteering();
  // In the cinematic camera a gamepad stick frames the shot instead of
  // steering (flight-camera.js); keys, the mouse and one finger still fly
  const framing =
    steering.active &&
    state.cameraMode === 'cinematic' &&
    !state.isFreeCamera &&
    inputManager.state.gamepad.steeringActive;
  state.cinematicSteerX = framing
    ? THREE.MathUtils.clamp(steering.x, -1, 1)
    : 0;
  state.cinematicSteerY = framing
    ? THREE.MathUtils.clamp(steering.y, -1, 1)
    : 0;
  // A mouse drag or a two-finger drag (input-manager.js) swings it too: a
  // screen's height is half a turn
  const drag = inputManager.state.cinematicDrag;
  if (drag.deltaX || drag.deltaY) {
    const perPixel = Math.PI / Math.max(1, window.innerHeight);
    state.cinematicOrbitYaw -= drag.deltaX * perPixel;
    state.cinematicOrbitPitch += drag.deltaY * perPixel;
    drag.deltaX = 0;
    drag.deltaY = 0;
  }
  // A pinch zooms the camera showing (first person doesn't zoom)
  const pinch = inputManager.state.pinch;
  inputManager.state.pinch = 1;
  if (pinch !== 1 && state.cameraZoom[state.cameraMode] !== undefined) {
    state.cameraZoom[state.cameraMode] = ChillFlightLogic.zoomCamera(
      state.cameraMode,
      state.cameraZoom[state.cameraMode],
      pinch
    );
  }
  if (state.currentControlScheme !== 'gyro') {
    if (steering.active && !framing) {
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
  // On VR headsets (both in immersive WebXR and in 72/90/120Hz 2D headset
  // windows), let the headset compositor manage native vsync; a 60fps cap
  // drops every other 72Hz/90Hz vsync and cuts 2D headset framerate to 36/45fps
  state.isVRPresenting = renderer && renderer.xr && renderer.xr.isPresenting;
  const bypassFpsCap =
    state.fastChunkDrain ||
    state.isVRPresenting ||
    (inputManager._isVRHeadset && ChillFlightLogic.MAX_FPS === null);
  if (!bypassFpsCap && state.maxFPS > 0) {
    // Use the browser's display VSync timestamp with a 4ms jitter margin for
    // default 60fps so 120Hz panels still step down to 60Hz (8.3ms < 12.7ms)
    // without ever dropping slightly late 60Hz VSyncs (13-16ms) down to 30fps.
    const vsyncNow = typeof timestamp === 'number' ? timestamp : frameStartTime;
    const jitterMargin =
      ChillFlightLogic.MAX_FPS === null && state.maxFPS === 60 ? 4 : 1;
    const timeSinceLastFrame = vsyncNow - state.lastFrameTime;
    if (
      timeSinceLastFrame > 0 &&
      timeSinceLastFrame < state.frameMinDelay - jitterMargin
    ) {
      return;
    }
    state.lastFrameTime = vsyncNow;
  } else {
    state.lastFrameTime = frameStartTime;
  }

  const now = performance.now();
  const nowTime = now;
  // If the loading screen is active, give chunk generation a massive time budget (e.g., 33ms)
  // so it finishes in a fraction of a second instead of being artifically throttled for 60fps.
  const isBootLoadingScreen = state.isPaused && !state.isIntroTransitionActive;
  const chunkBudget =
    isBootLoadingScreen || state.fastChunkDrain
      ? 33
      : performanceMonitor.getChunkBudget();
  if (processChunkQueue) processChunkQueue(chunkBudget);
  const farTerrainAnchor =
    state.isFreeCamera ||
    (state.cameraMode === 'cinematic' && state.camFrame === 'world-track')
      ? camera.position
      : planeGroup.position;
  updateFarTerrain(farTerrainAnchor);
  if (globalInstancer) globalInstancer.rebuildAll();
  const afterChunksTime = performance.now();
  // Timed by the frame's own timestamp (when the browser will show it), not
  // by when this code got round to running: under load frames alternate
  // between one and two screen refreshes, and moving everything by the time
  // each frame is actually on screen keeps motion even. (An average of the
  // last ten frames used to be used here, which made the view lurch back and
  // forth whenever frames were uneven.)
  clock.update(typeof timestamp === 'number' ? timestamp : undefined);
  let rawDelta = clock.getDelta();
  // Clamp negative deltas (e.g. switching between window.requestAnimationFrame
  // and XRSession.requestAnimationFrame clocks) as well as >100ms stalls
  if (!(rawDelta > 0)) rawDelta = 0;
  else if (rawDelta > 0.1) rawDelta = 0.1;
  state.smoothedDelta = rawDelta;

  const delta = state.smoothedDelta;
  // Paused frames draw nothing, so they look fast and would make adaptive
  // quality raise the resolution; resizing the canvas clears it and the
  // blurred game behind the pause menu turns black. Only measure frames
  // that render (the boot loading screen does)
  const bootOverlay =
    isBootLoadingScreen && getCachedElement('loading-overlay');
  const bootRenders =
    bootOverlay &&
    bootOverlay.style.display !== 'none' &&
    !state.vrSplashSkipRender;
  const rendersWhilePaused = state.isVRPresenting || bootRenders;
  if (
    performanceMonitor &&
    typeof performanceMonitor.update === 'function' &&
    (!state.isPaused || rendersWhilePaused)
  ) {
    performanceMonitor.update(rawDelta);
  }

  inputManager.pollGamepad(delta);
  updateSfx();
  updateSfxEvents(delta, precipitation.rain);
  updateHaptics(delta);
  updateThrottle(now);

  if (state.isPaused) {
    const loadingOverlay = getCachedElement('loading-overlay');
    if (
      loadingOverlay &&
      loadingOverlay.style.display !== 'none' &&
      !state.isIntroTransitionActive &&
      !state.vrSplashSkipRender
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

      updateWeather(delta);
      // During loading screen, always update shadows (simple scene, minimal cost)
      renderer.shadowMap.needsUpdate = true;
    }

    // Always render during pause so VR headset doesn't drop frames.
    if (state.isVRPresenting) {
      if (typeof updateVRPauseInteraction === 'function') {
        updateVRPauseInteraction(delta);
      }
      if (dirLight.castShadow && !dirLight.shadow.map) {
        renderer.shadowMap.needsUpdate = true;
      }
      renderer.render(scene, camera);
    } else if (
      loadingOverlay &&
      loadingOverlay.style.display !== 'none' &&
      !state.isIntroTransitionActive &&
      !state.isWarmingUp &&
      !state.vrSplashSkipRender
    ) {
      // As in flight (with the art style's outline pass), so its shaders
      // and render targets are ready before START
      renderFrame(scene, camera);
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

  // --- DAY/NIGHT CYCLE ---
  updateDayNightCycle(delta);
  const replaying = !state.isFreeCamera && applyPromoReplay(nowTime);
  // The buggy drives in place of the flight model and physics
  const driving = activePlaneType === 'buggy';
  if (!replaying) {
    if (driving) {
      applyShiftThrottle(delta, nowTime);
      if (
        !state.scriptedDrive &&
        state.autopilotEnabled &&
        !state.isFreeCamera
      ) {
        // Steering takes over from the autopilot, as in the planes
        const steering =
          !keys.Shift &&
          (keys.ArrowUp ||
            keys.ArrowDown ||
            keys.ArrowLeft ||
            keys.ArrowRight ||
            keys.KeyW ||
            keys.KeyA ||
            keys.KeyS ||
            keys.KeyD ||
            (inputManager.state.gamepad.gripTurn || 0) !== 0);
        if (steering || deliberateSteer()) toggleAutopilot();
        else updateDrivingAutopilot(delta);
      }
      updateBuggy(delta);
      hooks.resetManeuvers?.();
    } else if (!state.isCrashed) {
      updatePhysicsAndControls(delta, nowTime);
    } else {
      hooks.resetManeuvers?.();
    }
  }
  // --- MANEUVER & PITCH ACHIEVEMENTS ---
  if (!state.isFreeCamera && !driving && !replaying) {
    // 1. Maneuver completions
    if (state.wasDoingFullLoop && !state.isDoingFullLoop) {
      Achievements.unlock('froot_loops');
      noteMove('loop');
    }
    if (state.wasDoingFullBarrelRoll && !state.isDoingFullBarrelRoll) {
      Achievements.unlock('barrel_roll');
      noteMove('roll');
    }
    if (state.wasDoingImmelmann && !state.isDoingImmelmann) {
      Achievements.unlock('u_turn');
      noteMove('immelmann');
    }

    // 2. Steep climb / steep dive: teaches double-tap and hold, so loops
    // and Immelmanns (which pass through both) don't count, nor the
    // moments after one while the plane levels out
    if (state.isLooping || state.isDoingImmelmann) {
      stuntPitchGrace = STUNT_PITCH_GRACE;
    } else if (stuntPitchGrace > 0) {
      stuntPitchGrace -= delta;
    } else if (planeGroup.rotation.x > Math.PI / 4) {
      Achievements.unlock('to_the_moon');
      noteMove('climb');
    } else if (planeGroup.rotation.x < -Math.PI / 4) {
      Achievements.unlock('nose_dive');
      noteMove('dive');
    }

    const currentKTS =
      BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;

    // 3. Mach 1 (661 KTS at sea level)
    if (displaySpeed(currentKTS, activePlaneType) >= MACH_1_KTS) {
      Achievements.unlock('mach_1');
    }

    // 4. Free falling plummet (engine cut/idle, steep pitch down or stalling,
    // high altitude): under its stall speed the plane falls
    // (flight-physics.js)
    const isFallingOutSky = currentKTS < planeHandling().stallKts - 5;

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

  if (!replaying) {
    if (!driving && !state.isCrashed) updateFlightPhysics(delta, nowTime);
    // Wingtips and the nose push off steep walls (and forget them in a crash)
    updateWallScrape(delta);
    updateCrash(delta);
  }
  updateHeadlightBeam(
    driving,
    getElevation(planeGroup.position.x, planeGroup.position.z)
  );
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
        if (state.lifetimeDistanceTravelled >= FREQUENT_FLYER_DISTANCE) {
          Achievements.unlock('frequent_flyer');
        }
        state.distanceSinceLastSave = 0;
      }

      if (portalCooldown <= 0 && !state.isCrashed) {
        const warp = ChillFlightLogic.checkPortalCrossing(
          state.previousPosition,
          planeGroup.position,
          PORTAL_SITES
        );
        if (warp) {
          portalCooldown = 1.5;
          portalFlash = 1;
          scriptedStartYaw += warp.turn;
          immelmann.yaw += warp.turn;
          hooks.movePlane?.(
            warp.x,
            warp.y,
            warp.z,
            planeGroup.rotation.y + warp.turn,
            undefined,
            true
          );
          playPortalWarp();
          log.info(
            `[Portal wormhole] ${warp.from.name} -> ${warp.to.name}: X = ${warp.x.toFixed(0)}, Z = ${warp.z.toFixed(0)} (${(Math.abs(warp.x) / 5000).toFixed(2)} ${warp.x >= 0 ? 'East' : 'West'}, ${(Math.abs(warp.z) / 5000).toFixed(2)} ${warp.z <= 0 ? 'North' : 'South'})`
          );
        }
      }

      state.previousPosition.copy(planeGroup.position);
    }
    updatePortalFlash(delta, nowTime);

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

    // Pyramids (Tomb raider), in worlds that have them
    if (
      PYRAMIDS &&
      Math.hypot(
        planeGroup.position.x - PYRAMIDS.x,
        planeGroup.position.z - PYRAMIDS.z
      ) < TOMB_RAIDER_RANGE
    ) {
      Achievements.unlock('tomb_raider');
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
    // ...or under any of the arches and bridges (arches.js)
    const underAnArch =
      archCeiling(
        arches,
        planeGroup.position.x,
        planeGroup.position.z,
        planeGroup.position.y
      ) !== null;
    if (
      underAnArch ||
      (distToRockArchSq < 62500 && planeGroup.position.y < _rockArchPos.y + 120)
    ) {
      if (Achievements.unlock('limbo')) {
        log.info(
          `[Limbo unlocked] Position: X = ${planeGroup.position.x.toFixed(1)}, Z = ${planeGroup.position.z.toFixed(1)} (${(planeGroup.position.x / 5000).toFixed(2)} ${planeGroup.position.x >= 0 ? 'East' : 'West'}, ${(-planeGroup.position.z / 5000).toFixed(2)} ${planeGroup.position.z <= 0 ? 'North' : 'South'})`
        );
      }
    }
  }

  // A bump's shove, before the camera follows the plane
  if (!replaying) applyBumps(delta);

  // Ensure the plane's matrix is fully updated before camera calculations
  // This prevents the camera from "jittering" or lagging one frame behind.
  planeGroup.updateMatrixWorld();

  updateFlightCamera(delta, nowTime);
  updateJobs();
  updateWaypoint();
  updateTraffic(delta);
  updateRoadTraffic(delta);
  updateBeacons();
  updateMultiplayer(delta);
  updateBumps(delta);
  updateBreakables(delta);
  updateTrip(delta);
  updateRush(delta);
  updatePromoDirector(delta, nowTime);
  updateParticles(delta);
  updateTireTracks(delta);
  updateWhales(delta);
  updateDolphins(delta);
  updateGrass(delta);
  updateTreeWash(delta);
  updateFireflies();
  updateFireworks(delta);
  // --- SHADOW TEXEL SNAPPING (View-Space) ---
  updateShadowSnapping();
  // Smoothly interpolate sky shader palettes
  updateEnvironmentLighting(delta, now);
  // Update the particle positions
  const renderCpuMs = updateWeatherAndRendering(delta);
  // --- BENCHMARKING LOGIC ---
  updateBenchmarking(delta, frameStartTime);
  updateDebugTelemetry({
    frameStartTime,
    overcast: _currentOvercast,
    cloudMood: _cloudMood,
  });
  if (renderer) {
    const t = performance.now();
    updatePerfHud(
      t,
      t - frameStartTime,
      renderer,
      renderCpuMs,
      afterChunksTime - frameStartTime
    );
  }
}

function startAnimationLoop() {
  if (!renderer || isAnimationLoopRunning) return;
  if (typeof renderer.setAnimationLoop === 'function') {
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

// 0 south of where the snow cover starts (storms bring rain), 1 where it is
// full (storms bring snow), sleet in between
function snowZone() {
  return THREE.MathUtils.clamp(
    (state.currentLatDeg - ChillFlightLogic.SNOW_START_LAT) /
      (ChillFlightLogic.SNOW_FULL_LAT - ChillFlightLogic.SNOW_START_LAT),
    0,
    1
  );
}

// One in-game day; it starts at midnight
const DAY_CYCLE_MS = 360000;
// How slowly the cloud mix follows a new day's mood (seconds)
const CLOUD_MOOD_EASE_SECONDS = 20;
let _cloudMoodDay = null;
let _cloudMoodForced = null;
let _cloudMood = null;
const _cloudTypesTarget = new THREE.Vector3();

// Eases the sky's cloud types (skyUniforms.uCloudTypes) toward the day's
// mood (ChillFlightLogic.cloudMoodForDay), with that day's extra mackerel and
// cirrus around sunrise and sunset. As the weather turns overcast (where
// rain and snow fall), it takes over from the mood: full cumulus, no less
// cover than the weather's, and the high clouds hidden behind the deck.
function updateCloudMood(delta, overcast) {
  const day =
    Math.floor(state.worldClockNow / DAY_CYCLE_MS) + state.cloudDayOffset;
  const forced = state.cloudMoodOverride;
  const first = _cloudMood === null;
  if (day !== _cloudMoodDay || forced !== _cloudMoodForced) {
    _cloudMoodDay = day;
    _cloudMoodForced = forced;
    _cloudMood = ChillFlightLogic.cloudMoodForDay(
      ChillFlightLogic.WORLD_SEED,
      day,
      forced
    );
    // The anime style's horizon towers lay out a new skyline each day; the
    // shader gets the day kept small so its noise math stays precise
    skyUniforms.uCloudDay.value = ((day % 997) + 997) % 997;
    const moodLabel = getCachedElement('debug-cloud-mood');
    if (moodLabel) {
      moodLabel.textContent =
        _cloudMood.name +
        (_cloudMood.duskBoost > 0 ? ', dusk build-up' : '') +
        (state.cloudDayOffset
          ? ` (day ${state.cloudDayOffset > 0 ? '+' : ''}${state.cloudDayOffset})`
          : '');
    }
  }
  // 1 with the sun on the horizon, at sunrise and sunset
  const dusk = 1 - THREE.MathUtils.smoothstep(Math.abs(state.sunY), 0, 0.35);
  const boost = _cloudMood.duskBoost * dusk;
  const storm = THREE.MathUtils.smoothstep(overcast, 0.3, 0.6);
  const target = _cloudTypesTarget.set(
    THREE.MathUtils.lerp(_cloudMood.cumulus, 1, storm),
    Math.min(0.8, _cloudMood.cirrus + boost * 0.5) * (1 - storm * 0.8),
    Math.min(1, _cloudMood.mackerel + boost) * (1 - storm * 0.6)
  );
  const cover = THREE.MathUtils.lerp(
    _cloudMood.cover,
    Math.max(0, _cloudMood.cover),
    storm
  );
  const types = skyUniforms.uCloudTypes.value;
  if (first || state.snapEnvironment) {
    types.copy(target);
    skyUniforms.uCloudCover.value = cover;
  } else {
    const ease = 1 - Math.exp(-delta / CLOUD_MOOD_EASE_SECONDS);
    types.lerp(target, ease);
    skyUniforms.uCloudCover.value = THREE.MathUtils.lerp(
      skyUniforms.uCloudCover.value,
      cover,
      ease
    );
  }
}

// How bright window pool i (of n) glows at this hour (0 to 24) and darkness
// (0 in daylight, 2 deep in the night). Each pool lights up at its own
// darkness, goes to bed between 21:30 and 00:30, and gets up between 05:00
// and 06:45 (its lights then on until daylight); the last pool to go to bed
// stays up all night. The three orders are shuffled so early lighters aren't
// always early sleepers.
const WINDOW_SWITCH_HOURS = 0.1;
function windowGlow(i, n, hour, darkness) {
  const lightOrder = i / n;
  const bedOrder = ((i * 3) % n) / n;
  const wakeOrder = ((i * 5) % n) / n;
  const threshold = 0.05 + lightOrder * 0.7;
  const lit = Math.min(1, Math.max(0, (darkness - threshold) / 0.12));
  let awake = 1;
  if (bedOrder < (n - 1) / n) {
    // Hours since bedtime, wrapping past midnight
    const bed = 21.5 + bedOrder * 4;
    const wake = 5 + wakeOrder * 2;
    const sinceBed = (hour - bed + 24) % 24;
    const sleepLength = (wake - bed + 24) % 24;
    if (sinceBed < sleepLength) {
      const ramp = WINDOW_SWITCH_HOURS;
      awake = Math.max(
        0,
        1 - Math.min(sinceBed, sleepLength - sinceBed) / ramp
      );
    }
  }
  return 2 * lit * awake;
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
    state.pendingClockOverride !== null ||
    ChillFlightLogic.START_CLOCK !== null;

  if (useVirtualClock) {
    // In debug mode, we use a virtual clock that we increment ourselves,
    // allowing for speed multipliers while maintaining the same "warped" physics
    // as the wall clock.
    if (state.pendingClockOverride !== null) {
      _debugVirtualClockNow = state.pendingClockOverride;
      state.pendingClockOverride = null;
    } else if (_debugVirtualClockNow === undefined) {
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
    state.secondsInCycle
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

  // Window glow: each pool of houses has its own habits, so lights come on
  // a group at a time as it gets dark, go out a group at a time at bedtime,
  // and come back on for early risers before dawn
  const hour = (state.timeOfDay / (Math.PI * 2)) * 24;
  const darkness = Math.max(0, (Math.cos(state.timeOfDay) + 0.1) * 2);
  houseWindowMats.forEach((mat, i) => {
    mat.emissiveIntensity = windowGlow(
      i,
      houseWindowMats.length,
      hour,
      darkness
    );
    houseWindowGlow.value[i] = mat.emissiveIntensity;
  });

  // Calculate streetlight intensity based on time of day
  const slSunY = -Math.cos(state.timeOfDay);
  const slNightValue = Math.max(0, (-slSunY + 0.1) * 2);

  streetlightBulbMat.emissiveIntensity = Math.min(2.0, slNightValue * 2.0);
  // The lighthouse lantern comes on at dusk, like its beam
  lighthouseLampMat.emissiveIntensity = Math.min(1.0, slNightValue);
  // The Christmas village's lights come on with the streetlights
  xmasGlowMat.emissiveIntensity = Math.min(1.6, slNightValue * 1.6);

  streetlightDecalMat.opacity = Math.min(1.0, slNightValue);
  fireGlowMat.opacity = Math.min(1.0, slNightValue);
  // Fully faded out by day: not drawn at all (each is a draw per chunk)
  streetlightDecalMat.visible = streetlightDecalMat.opacity > 0.001;
  fireGlowMat.visible = fireGlowMat.opacity > 0.001;
  updateAirportLights(slNightValue);
}

// Barrel roll (triple-tap left or right and hold): the roll rate eases in
// over BARREL_ROLL_EASE_IN seconds and the roll lasts as long as the hold
const BARREL_ROLL_EASE_IN = 0.25;
// The roll goes at this share of the plane's rollRate (PLANE_HANDLING), a
// little quicker than the joystick banks it to the rim, just carrying on
// round: a seaplane takes about 3.2 s a turn (half was too slow)
const BARREL_ROLL_SPEED = 0.7;
// The roll in progress: 1 rolling left, -1 right, 0 none; and its rate (rad/s)
let barrelRollDir = 0;
let barrelRollRate = 0;
// Letting go eases the roll to level (stepRollExit): its state, the whole
// turns added to the level bank it is heading for, and how long it has run
const rollExit = {active: false, roll: 0, rate: 0, accel: 0, turns: 0, t: 0};

// Sharp turn (double-tap left or right and hold): steeper bank and faster
// turn rate. It blends in over SHARP_TURN_EASE_IN seconds and back out over
// SHARP_TURN_EASE_OUT on release (smoothstep), so bank, turn rate and
// back-pressure all ramp rather than switching on and off
const SHARP_TURN_BANK_ANGLE = (78 * Math.PI) / 180;
const SHARP_TURN_YAW_MULT = 1.5;
const SHARP_TURN_ROLL_SPEED = 0.045; // roll smoothing at full blend (TURN_SPEED otherwise)
const SHARP_TURN_EASE_IN = 0.8;
const SHARP_TURN_EASE_OUT = 0.6;
// Blend progress 0..1 and the direction of the turn: 1 left, -1 right
let sharpTurnRamp = 0;
let sharpTurnDir = 0;
let sharpTurnAmount = 0; // smoothstep of the ramp: 0 none to 1 full

// Pitch maneuvers: climb and dive ease in and out as a gradual transition,
// heading toward the target pitch at a steady rate and easing in near the
// target angle, rather than snapping abruptly (the same way speed changes
// ease in). Steep climb/dive (double-tap and hold) ramps the pitch rate up
// and down to 60° climb or -70° dive, matching the barrel roll.
const PITCH_EASE_IN = 0.25;
const STEEP_PITCH_EASE_IN = 0.3;
const CLIMB_ANGLE = (35 * Math.PI) / 180;
const DIVE_ANGLE = -(45 * Math.PI) / 180;
const STEEP_CLIMB_ANGLE = (60 * Math.PI) / 180;
const STEEP_DIVE_ANGLE = -(70 * Math.PI) / 180;
const MAX_DIVE_ANGLE = -(75 * Math.PI) / 180;
const MAX_CLIMB_ANGLE = (75 * Math.PI) / 180;
// The steepest climb the thin air near the top of the sky holds the nose to
// (sagClimbCap), or null before the first frame
let ceilingCap = null;
const SLOW_CLIMB_ANGLE = (20 * Math.PI) / 180; // steepest climb at stall speed
// Weighted roll (state.weightedRoll): its spring's stiffness against the
// usual roll's rate, matched so both reach 90% of a new bank together
const WEIGHTED_ROLL_OMEGA = 1.69;
let rollRate = 0; // rad/s
const PITCH_SPEED = 1.0; // rad/s (~57 deg/s)
const STEEP_PITCH_SPEED = 1.6; // rad/s (~92 deg/s)

// Speed-dependent turn rate: for the same bank the plane turns more slowly
// when fast, from full rate at TURN_FADE_FROM_KTS easing to TURN_FAST_SCALE
// of it at TURN_FADE_TO_KTS and up, so a fast plane carves wide arcs
const TURN_FADE_FROM_KTS = 150;
const TURN_FADE_TO_KTS = 450;
const TURN_FAST_SCALE = 0.7;
const PITCH_EASE_OUT = 2.5;

let manualPitchVel = 0; // rad/s, signed (positive pitches up)
let manualPitchActive = false;
let steepPitchActive = false; // persists across steep climb/dive recovery until level
let lastPitchMode = 0; // 1 normal climb, -1 normal dive, 2 steep climb, -2 steep dive, 0 none

// Loop (triple-tap up and hold): the pitch rate eases in from the climb and
// floats over the top, going round for as long as up is held. Letting go
// commits to the level its momentum carries it nearest and settles softly
// (stepRollExit), handing back to key or analog pitch steering once upright.
// Rates scale with the plane's agility (PLANE_HANDLING).
const LOOP_RATE = 2.2; // rad/s
const LOOP_RATE_SWING = 0.35;
const LOOP_ACCEL = 5; // rad/s^2 easing in
// Speed lost over the top, coming back on the way down, so the loop comes
// round to the height it started at (diving alone would speed it up)
const LOOP_SPEED_DIP = 0.15;
let loopActive = false;
let loopPitchRate = 0;
let loopSpeed = 0; // speed going in
let loopRecovering = false; // settling onto level after letting go
const loopExit = {roll: 0, rate: 0, accel: 0, turns: 0, t: 0};

// Immelmann (triple-tap down): a half loop to inverted level over the first
// IMMELMANN_PITCH_END of the maneuver, then a half roll upright
const IMMELMANN_DURATION = 2.4;
const IMMELMANN_PITCH_END = 0.88;
const IMMELMANN_SPEED_DIP = 0.18; // speed lost over the top

// An angle wrapped to -PI..PI
function wrapAngle(a) {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

// Steepest climb allowed right now: thin air near the cloud ceiling and low
// airspeed both cap how high the nose can pitch
function climbLimit(cap, kts, handling) {
  const speedCap =
    handling.stallKts > 0
      ? THREE.MathUtils.lerp(
          SLOW_CLIMB_ANGLE,
          MAX_CLIMB_ANGLE,
          THREE.MathUtils.smoothstep(kts, handling.stallKts, handling.levelKts)
        )
      : MAX_CLIMB_ANGLE;
  return Math.min(cap ?? MAX_CLIMB_ANGLE, speedCap);
}

// Shift+Up/Down: throttle control, for the planes and the buggy
function applyShiftThrottle(delta, nowTime) {
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
}

// Steering on purpose: the touch joystick, drag-steer or a gamepad stick
// pushed past the deadzone. Gyro tilt and the desktop mouse are always
// "steering", so they don't count (turning the autopilot off).
function deliberateSteer() {
  return (
    state.currentControlScheme !== 'gyro' &&
    state.mouseControlActive &&
    !state.isFreeCamera &&
    inputManager.isDeliberateSteering() &&
    (Math.abs(state.mouseX) >= 0.15 || Math.abs(state.mouseY) >= 0.15)
  );
}

// The controls' response to a stick, the mouse, a gamepad or tilt (-1 to
// 1): nothing inside STICK_DEAD_ZONE, then rising from zero (not jumping to
// the dead zone's edge) along a gentle curve, finer near the middle, to the
// same full deflection at 1 (keys, at 1, are unchanged)
// Stick sensitivity (Settings > Controls on touch, state.stickSensitivity):
// the bank the phone joystick gives at its rim, out of an arrow key's 75°
// (pitch scales with it, out of 45°). Drag-steer and gyro, whose full
// response is already the keys', scale their input against Normal instead:
// Gentle tops out lower, Sharp gets there sooner. ?stickBank= sets the
// joystick's rim angle directly, over the setting
const STICK_SENSITIVITY = {gentle: 40, normal: 55, sharp: 75};
function stickBankDegrees() {
  return (
    ChillFlightLogic.STICK_BANK_PARAM ??
    STICK_SENSITIVITY[state.stickSensitivity] ??
    STICK_SENSITIVITY.normal
  );
}
function touchSteerScale() {
  return (
    (STICK_SENSITIVITY[state.stickSensitivity] ?? STICK_SENSITIVITY.normal) /
    STICK_SENSITIVITY.normal
  );
}
const STICK_DEAD_ZONE = 0.15;
const STICK_CURVE = 0.45; // share of the response that's cubic
function stickResponse(v) {
  if (!Number.isFinite(v)) return 0;
  const a = Math.abs(v);
  if (a < STICK_DEAD_ZONE) return 0;
  const u = Math.min(1, (a - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE));
  return Math.sign(v) * ((1 - STICK_CURVE) * u + STICK_CURVE * u * u * u);
}

const _vrSimStickState = createVRSimStickState();
const _vrSimStickQuat = {x: 0, y: 0, z: 0, w: 1};
const _vrSimLastPos = new THREE.Vector3(NaN, NaN, NaN);
let vrSimStickWereFlying = false;

function resetFlightManeuvers() {
  if (barrelRollDir !== 0 || rollExit.active) {
    planeGroup.rotation.z = wrapAngle(planeGroup.rotation.z);
  }
  if (loopActive || loopRecovering) {
    planeGroup.rotation.x = wrapAngle(planeGroup.rotation.x);
  }
  barrelRollDir = 0;
  barrelRollRate = 0;
  rollExit.active = false;
  rollExit.roll = 0;
  rollExit.rate = 0;
  rollExit.accel = 0;
  rollExit.turns = 0;
  rollExit.t = 0;
  sharpTurnRamp = 0;
  sharpTurnDir = 0;
  sharpTurnAmount = 0;
  state.sharpTurnAmount = 0;
  rollRate = 0;
  manualPitchVel = 0;
  manualPitchActive = false;
  steepPitchActive = false;
  lastPitchMode = 0;
  state.manualPitch = 0;
  state.isSteepPitch = false;
  loopActive = false;
  loopPitchRate = 0;
  loopSpeed = 0;
  loopRecovering = false;
  loopExit.roll = 0;
  loopExit.rate = 0;
  loopExit.accel = 0;
  loopExit.turns = 0;
  loopExit.t = 0;
  vrSimStickWereFlying = false;
  state.isDoingImmelmann = false;
  state.immelmannProgress = 0;
  state.isLooping = false;
  state.isDoingFullLoop = false;
  state.isBarrelRolling = false;
  state.isDoingFullBarrelRoll = false;
  state.maneuverBaseSpeed = null;
}
hooks.resetManeuvers = resetFlightManeuvers;

function isVRSimStickFlying() {
  return Boolean(
    state.isVRPresenting &&
    state.vrStickMode === 'sim' &&
    activePlaneType !== 'buggy' &&
    !state.airplaneModel?.isBuggy &&
    state.cameraMode !== 'cinematic'
  );
}

function flyVRSimStick(delta, inAirGripTurn) {
  if (
    !vrSimStickWereFlying ||
    planeGroup.position.distanceToSquared(_vrSimLastPos) > 10000
  ) {
    Object.assign(_vrSimStickState, createVRSimStickState());
  }
  _vrSimLastPos.copy(planeGroup.position);
  vrSimStickWereFlying = true;

  sharpTurnRamp = 0;
  sharpTurnAmount = 0;
  state.sharpTurnAmount = 0;
  state.manualPitch = 0;
  barrelRollDir = 0;
  barrelRollRate = 0;
  rollExit.active = false;
  manualPitchVel = 0;
  manualPitchActive = false;
  steepPitchActive = false;
  lastPitchMode = 0;
  loopActive = false;
  loopRecovering = false;
  rollRate = 0;

  const hasStick = state.mouseControlActive && !state.isFreeCamera;
  const virtualHeld = inputManager.isHoldingVirtualStick();
  const invertY = inputManager.shouldInvertYAxis();
  const roll = hasStick ? simStickAxisResponse(state.mouseX) : 0;
  const rawPull = hasStick ? (invertY ? -state.mouseY : state.mouseY) : 0;
  const pull = hasStick ? simStickAxisResponse(rawPull) : 0;
  const active = Boolean(
    virtualHeld || inputManager.state.gamepad.steeringActive
  );

  // Taxi yaw when rolling slowly on ground or water
  if (
    (state.isOnGround || state.isOnWater) &&
    state.flightSpeedMultiplier < 0.4 &&
    !keys.Shift
  ) {
    const groundGripTurn = inputManager.state.gamepad.gripTurn || 0;
    if (groundGripTurn !== 0) {
      planeGroup.rotation.y += groundGripTurn * 1.5 * delta;
    } else if (Math.abs(roll) > 0.05) {
      planeGroup.rotation.y -= roll * 1.5 * delta;
    }
  }

  const handling = planeHandling();
  const kts = BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
  ceilingCap = sagClimbCap(
    ceilingCap,
    ceilingClimbLimit(
      planeGroup.position.y,
      flightCeiling(manualCloudHeight),
      MAX_CLIMB_ANGLE
    ),
    kts,
    delta
  );
  const maxClimb = Math.min(
    ceilingCap,
    handling.stallKts > 0
      ? THREE.MathUtils.lerp(
          SLOW_CLIMB_ANGLE,
          MAX_CLIMB_ANGLE,
          THREE.MathUtils.smoothstep(kts, handling.stallKts, handling.levelKts)
        )
      : MAX_CLIMB_ANGLE
  );
  const turnScale = THREE.MathUtils.lerp(
    1,
    TURN_FAST_SCALE,
    THREE.MathUtils.smoothstep(kts, TURN_FADE_FROM_KTS, TURN_FADE_TO_KTS)
  );

  const q = planeGroup.quaternion;
  _vrSimStickQuat.x = q.x;
  _vrSimStickQuat.y = q.y;
  _vrSimStickQuat.z = q.z;
  _vrSimStickQuat.w = q.w;

  const out = stepVRSimStickAttitude(_vrSimStickState, {
    quat: _vrSimStickQuat,
    roll,
    pull,
    rudder: !keys.Shift ? inAirGripTurn : 0,
    active,
    handling,
    kts,
    climbLimit: maxClimb < MAX_CLIMB_ANGLE - 0.01 ? maxClimb : Infinity,
    turnScale,
    grounded: state.isOnGround || state.isOnWater,
    dt: delta,
  });

  if (
    Number.isFinite(out.quat.x) &&
    Number.isFinite(out.quat.y) &&
    Number.isFinite(out.quat.z) &&
    Number.isFinite(out.quat.w)
  ) {
    q.set(out.quat.x, out.quat.y, out.quat.z, out.quat.w);
  }
  state._nextYaw = planeGroup.rotation.y;
  state.targetPitch = planeGroup.rotation.x;
  state.targetRoll = planeGroup.rotation.z;
  state.isLooping = _vrSimStickState.looping;
  state.isDoingFullLoop = _vrSimStickState.looping;
  state.isBarrelRolling = Math.abs(_vrSimStickState.rollRate) > 1.2;

  if (out.notched) pulseXRControllers(0.14, 10);
  if (out.rolled) Achievements.unlock('barrel_roll');
  if (out.looped) Achievements.unlock('froot_loops');
}

function updatePhysicsAndControls(delta, nowTime) {
  // Spin the propeller: the engine drives it while the plane moves or the
  // throttle is open, and with the engine off it coasts down, catches on
  // compression and rocks back to rest (prop-spin-logic.js). Props with
  // fewer blades spin faster (spinScale), so their blades sweep past as often.
  if (!state.isFreeCamera && state.propGroups?.length) {
    const spinScale = state.propGroups[0].userData.spinScale ?? 1;
    const prop = (state.propSpin ??= newPropSpin());
    stepPropSpin(
      prop,
      propSpinTarget(
        state.flightSpeedMultiplier,
        state.targetFlightSpeed,
        spinScale
      ),
      delta
    );
    for (const group of state.propGroups) group.rotation.z = prop.angle;
  }

  // Landing gear eases down or up (flight-physics.js decides which); posed
  // every frame, so a plane switched to in flight has its gear right too
  if (!state.isFreeCamera) {
    state.gearExtension = state.gearWanted
      ? Math.min(1, state.gearExtension + delta * 0.5)
      : Math.max(0, state.gearExtension - delta * 0.4);
  }
  poseGear(state.gearExtension);

  // Plane rotation control
  const maxPitch = Math.PI / 4;
  const maxRoll = Math.PI / 3;
  const steeringOn = state.mouseControlActive && !state.isFreeCamera;
  // The phone joystick has its own response (joystickResponse): gentle in
  // the middle like the other sticks, but the keyboard's hard turn at the rim
  const im = inputManager.state;
  const touchStick =
    state.fullStick &&
    im.controlScheme === 'joystick' &&
    im.joystick.active &&
    !im.gamepad.steeringActive;
  const touchSteer =
    !im.gamepad.steeringActive &&
    ((im.controlScheme === 'touch' && im.touch.steeringId !== null) ||
      state.currentControlScheme === 'gyro');
  const rimShare = stickBankDegrees() / 75;
  const steerScale = touchSteerScale();
  const respond = touchStick
    ? (v) => joystickResponse(v / inputManager.JOYSTICK_SENSITIVITY) * rimShare
    : touchSteer
      ? (v) => stickResponse(THREE.MathUtils.clamp(v * steerScale, -1, 1))
      : stickResponse;
  let effMouseX = steeringOn ? respond(state.mouseX) : 0;
  let effMouseY = steeringOn ? respond(state.mouseY) : 0;

  // Logical inputs based on effective Y-axis inversion
  const invertY = inputManager.shouldInvertYAxis();
  const isUp = (invertY ? keys.ArrowDown : keys.ArrowUp) && !state.isFreeCamera;
  const isDown =
    (invertY ? keys.ArrowUp : keys.ArrowDown) && !state.isFreeCamera;
  const dtUp =
    (invertY ? doubleTap.ArrowDown : doubleTap.ArrowUp) && !state.isFreeCamera;
  const dtDown =
    (invertY ? doubleTap.ArrowUp : doubleTap.ArrowDown) && !state.isFreeCamera;
  const ttUp =
    (invertY ? tripleTap.ArrowDown : tripleTap.ArrowUp) && !state.isFreeCamera;
  const startUp = invertY
    ? keyPressStartTime.ArrowDown
    : keyPressStartTime.ArrowUp;

  const isLeft = keys.ArrowLeft && !state.isFreeCamera;
  const isRight = keys.ArrowRight && !state.isFreeCamera;
  const dtLeft = doubleTap.ArrowLeft && !state.isFreeCamera;
  const dtRight = doubleTap.ArrowRight && !state.isFreeCamera;
  const ttLeft = tripleTap.ArrowLeft && !state.isFreeCamera;
  const ttRight = tripleTap.ArrowRight && !state.isFreeCamera;
  const inAirGrip =
    !state.isFreeCamera && !state.isOnGround && !state.isOnWater;
  const inAirGripTurn = inAirGrip
    ? inputManager.state.gamepad.gripTurn || 0
    : 0;
  const inAirGripRoll = inAirGrip
    ? inputManager.state.gamepad.gripRoll || 0
    : 0;

  // Auto-disable autopilot on manual steering input: arrow keys, VR grip
  // turn/roll, or the touch joystick, drag-steer or a gamepad stick pushed past
  // the deadzone (deliberateSteer)
  if (
    state.autopilotEnabled &&
    !keys.Shift &&
    (isUp ||
      isDown ||
      isLeft ||
      isRight ||
      inAirGripTurn !== 0 ||
      inAirGripRoll !== 0 ||
      deliberateSteer())
  ) {
    toggleAutopilot();
  }

  applyShiftThrottle(delta, nowTime);

  if (
    !state.isFreeCamera &&
    (state.flightSpeedMultiplier > 0 || Math.abs(state.targetFlightSpeed) > 0)
  ) {
    let yMultiplier = invertY ? -1 : 1;
    state.targetPitch = effMouseY * maxPitch * yMultiplier;
    state.targetRoll = -effMouseX * (maxRoll * 1.25);

    state.manualPitch = THREE.MathUtils.lerp(
      state.manualPitch,
      0,
      0.1 * delta * 60
    );

    const hasAnalogPitch =
      inputManager.state.mouse.controlActive ||
      inputManager.state.gamepad.steeringActive;
    const effAnalogY = hasAnalogPitch ? effMouseY : 0;

    if (keys.Shift) {
      // Throttle already handled above; no pitch changes while Shift is held
    } else if (isUp) {
      state.targetPitch = Math.min(
        MAX_CLIMB_ANGLE,
        (dtUp ? STEEP_CLIMB_ANGLE : CLIMB_ANGLE) +
          effAnalogY * (maxPitch * 0.4) * yMultiplier
      );
    } else if (isDown) {
      state.targetPitch = Math.max(
        MAX_DIVE_ANGLE,
        (dtDown ? STEEP_DIVE_ANGLE : DIVE_ANGLE) +
          effAnalogY * (maxPitch * 0.4) * yMultiplier
      );
    }

    let sharpHeld = 0;
    if (!keys.Shift && !inAirGripRoll) {
      if (inAirGripTurn !== 0) sharpHeld = inAirGripTurn;
      else if (isLeft && dtLeft) sharpHeld = 1;
      else if (isRight && dtRight) sharpHeld = -1;
    }
    if (sharpHeld) sharpTurnDir = sharpHeld;
    sharpTurnRamp = THREE.MathUtils.clamp(
      sharpTurnRamp +
        (sharpHeld ? delta / SHARP_TURN_EASE_IN : -delta / SHARP_TURN_EASE_OUT),
      0,
      1
    );
    sharpTurnAmount = THREE.MathUtils.smoothstep(sharpTurnRamp, 0, 1);
    state.sharpTurnAmount = sharpTurnAmount;
    // (Tap help: a sharp turn well under way counts as done)
    if (sharpHeld && sharpTurnAmount > 0.8) noteMove('sharp');

    if (sharpTurnAmount > 0) {
      // Analog sticks can trim the bank; keys and touch zones hold it steady
      const effAnalogX = hasAnalogPitch ? effMouseX : 0;
      const sharpRoll =
        sharpTurnDir * SHARP_TURN_BANK_ANGLE - effAnalogX * (maxRoll * 0.15);
      state.targetRoll = THREE.MathUtils.lerp(
        state.targetRoll,
        sharpRoll,
        sharpTurnAmount
      );
      // Elevator back-pressure to hold altitude in the steep bank
      state.targetPitch +=
        0.12 * sharpTurnAmount * Math.sin(Math.abs(planeGroup.rotation.z));
    }
  } else if (!state.isFreeCamera) {
    state.targetPitch = 0;
    state.targetRoll = 0;
    sharpTurnRamp = 0;
    sharpTurnAmount = 0;
    state.sharpTurnAmount = 0;
  }

  state.isBarrelRolling = false;
  state.isDoingFullBarrelRoll = false;
  state.isClampedRoll = false;
  state.isLooping = false;
  state.isSteepPitch = false;
  state.isDoingFullLoop = false;
  state.maneuverBaseSpeed = null;

  state.manualRollSpeed = planeHandling().rollRate * BARREL_ROLL_SPEED;

  // A promo clip's scripted attitude takes over from the controls, the
  // autopilot and the manual maneuvers below (see promo-script.js)
  const scripted = !state.isFreeCamera && state.scriptedFlight?.(nowTime);
  if (!scripted) state.scriptedSpeed = null;
  if (scripted) {
    if (!scripted.loop && (barrelRollDir !== 0 || rollExit.active)) {
      planeGroup.rotation.z = wrapAngle(planeGroup.rotation.z);
    }
    if (!scripted.loop && (loopActive || loopRecovering)) {
      planeGroup.rotation.x = wrapAngle(planeGroup.rotation.x);
    }
    vrSimStickWereFlying = false;
    state.isDoingImmelmann = false;
    state.targetPitch = scripted.pitch;
    state.targetRoll = scripted.roll;
    const baseSpeed = scripted.speed ?? scriptedStartSpeed;
    manualPitchVel = 0;
    manualPitchActive = false;
    steepPitchActive = false;
    lastPitchMode = 0;
    loopActive = false;
    loopRecovering = false;
    barrelRollDir = 0;
    barrelRollRate = 0;
    rollExit.active = false;
    if (scripted.loop) {
      planeGroup.rotation.x = scripted.pitch;
      planeGroup.rotation.z = scripted.roll;
      planeGroup.rotation.y = scriptedStartYaw + scripted.yaw;
      state._nextYaw = planeGroup.rotation.y;
      const dip = scripted.surface
        ? 0
        : (LOOP_SPEED_DIP * (1 - Math.cos(scripted.pitch))) / 2;
      const effSpeed = baseSpeed * (1 - dip);
      state.flightSpeedMultiplier = effSpeed;
      if (scripted.speed !== null || scripted.surface) {
        state.targetFlightSpeed = effSpeed;
        state.scriptedSpeed = effSpeed;
      } else {
        state.scriptedSpeed = null;
      }
      state.isLooping = true;
      state.isDoingFullLoop = !scripted.surface;
      state.isBarrelRolling = true;
      if (!scripted.surface) state.maneuverBaseSpeed = baseSpeed;
    } else if (scripted.speed !== null) {
      state.targetFlightSpeed = scripted.speed;
      state.flightSpeedMultiplier = scripted.speed;
      state.scriptedSpeed = scripted.speed;
    } else {
      state.scriptedSpeed = null;
    }
  } else if (
    !state.isFreeCamera &&
    state.autopilotEnabled &&
    state.flightSpeedMultiplier > 0
  ) {
    if (barrelRollDir !== 0 || rollExit.active) {
      planeGroup.rotation.z = wrapAngle(planeGroup.rotation.z);
    }
    if (loopActive || loopRecovering) {
      planeGroup.rotation.x = wrapAngle(planeGroup.rotation.x);
    }
    vrSimStickWereFlying = false;
    updateAutopilot(delta);
    barrelRollDir = 0;
    barrelRollRate = 0;
    rollExit.active = false;
    manualPitchVel = 0;
    manualPitchActive = false;
    steepPitchActive = false;
    lastPitchMode = 0;
    loopActive = false;
    loopRecovering = false;
  } else if (
    !state.isFreeCamera &&
    state.flightSpeedMultiplier > 0 &&
    !state.isDoingImmelmann &&
    isVRSimStickFlying()
  ) {
    if (barrelRollDir !== 0 || rollExit.active) {
      planeGroup.rotation.z = wrapAngle(planeGroup.rotation.z);
    }
    if (loopActive || loopRecovering) {
      planeGroup.rotation.x = wrapAngle(planeGroup.rotation.x);
    }
    barrelRollDir = 0;
    barrelRollRate = 0;
    rollExit.active = false;
    steepPitchActive = false;
    flyVRSimStick(delta, inAirGripTurn);
    return;
  } else if (!state.isFreeCamera && state.flightSpeedMultiplier > 0) {
    vrSimStickWereFlying = false;
    const handling = planeHandling();
    const agility = handling.agility || 1;
    if (state.isDoingImmelmann) {
      if (state.immelmannProgress === 0) {
        loopActive = false;
        loopRecovering = false;
        steepPitchActive = false;
        immelmann.pitch = wrapAngle(planeGroup.rotation.x);
        immelmann.pitchRate = manualPitchActive ? manualPitchVel : 0;
        immelmann.roll = wrapAngle(planeGroup.rotation.z);
        immelmann.yaw = planeGroup.rotation.y;
        immelmann.speed = state.flightSpeedMultiplier;
        immelmann.duration = IMMELMANN_DURATION / agility;
      }

      state.immelmannProgress += delta;
      const u = Math.min(1.0, state.immelmannProgress / immelmann.duration);

      // Half loop up to inverted level: a Hermite curve from the entry pitch
      // and pitch rate (so a climb or dive carries straight into it) to PI,
      // arriving with no pitch rate
      const s = Math.min(1, u / IMMELMANN_PITCH_END);
      const pitchSeconds = immelmann.duration * IMMELMANN_PITCH_END;
      const s2 = s * s;
      const s3 = s2 * s;
      planeGroup.rotation.x =
        (2 * s3 - 3 * s2 + 1) * immelmann.pitch +
        (s3 - 2 * s2 + s) * immelmann.pitchRate * pitchSeconds +
        (3 * s2 - 2 * s3) * Math.PI;

      // Any bank at entry rolls out early in the pull-up; the half roll
      // upright starts as the aircraft crests past vertical
      planeGroup.rotation.z =
        immelmann.roll * (1 - THREE.MathUtils.smoothstep(u, 0, 0.3)) +
        Math.PI * THREE.MathUtils.smoothstep(u, 0.35, 0.95);

      // Realistic aerodynamic speed float over the apex
      const speedDip = Math.sin(THREE.MathUtils.smoothstep(s, 0, 1) * Math.PI);
      state.flightSpeedMultiplier =
        immelmann.speed * (1 - speedDip * IMMELMANN_SPEED_DIP);
      state.maneuverBaseSpeed = immelmann.speed;

      planeGroup.rotation.y = immelmann.yaw;
      state._nextYaw = immelmann.yaw;
      state.isLooping = true;
      // Roll is set directly here, and must not turn the plane
      state.isBarrelRolling = true;
      state.verticalVelocity = 0;
      manualPitchVel = 0;
      manualPitchActive = false;
      steepPitchActive = false;
      lastPitchMode = 0;

      if (u >= 1.0) {
        state.isDoingImmelmann = false;
        state.isLooping = false;
        state.isBarrelRolling = false;
        state.maneuverBaseSpeed = null;
        const forward = _immelmannForward
          .set(0, 0, -1)
          .applyEuler(planeGroup.rotation);
        const newYaw = Math.atan2(-forward.x, -forward.z);
        planeGroup.rotation.set(0, newYaw, 0, 'YXZ');
        state._nextYaw = newYaw;
        state.immelmannProgress = 0;
      }
    } else {
      const effLoopRate = LOOP_RATE * agility;
      const effLoopSwing = LOOP_RATE_SWING * agility;
      const effLoopAccel = LOOP_ACCEL * agility;
      const loopHeld =
        isUp && ttUp && nowTime - startUp > STEER_HOLD_THRESHOLD && !keys.Shift;
      if (loopHeld && !loopActive) {
        // Triple-tap up and hold: start a loop, carrying on from the climb, or
        // from a settle still under way
        const turn = Math.PI * 2;
        if (!loopRecovering) {
          loopPitchRate = manualPitchActive ? Math.max(0, manualPitchVel) : 0;
          loopSpeed = state.flightSpeedMultiplier;
          planeGroup.rotation.x = wrapAngle(planeGroup.rotation.x);
        } else {
          loopPitchRate = Math.max(0, loopExit.rate);
          planeGroup.rotation.x =
            ((planeGroup.rotation.x % turn) + turn) % turn;
        }
        loopActive = true;
        loopRecovering = false;
        steepPitchActive = false;
        manualPitchActive = false;
        manualPitchVel = 0;
        lastPitchMode = 0;
      }

      if (loopActive || loopRecovering) {
        const turn = Math.PI * 2;
        let x = planeGroup.rotation.x;
        if (loopActive) {
          // Floaty over the top, crisp at the pull-up and pull-out
          const wantRate = effLoopRate + effLoopSwing * Math.cos(x);
          loopPitchRate += THREE.MathUtils.clamp(
            wantRate - loopPitchRate,
            -effLoopAccel * delta,
            effLoopAccel * delta
          );
          x += loopPitchRate * delta;
          if (x >= turn) x -= turn;
          // Letting go commits once to the nearest level by momentum and
          // settles softly (stepRollExit)
          if (!loopHeld) {
            loopActive = false;
            loopRecovering = true;
            loopExit.roll = x;
            loopExit.rate = loopPitchRate;
            loopExit.accel = 0;
            loopExit.turns = rollExitTurns(
              loopExit.roll,
              loopExit.rate,
              0,
              effLoopRate
            );
            loopExit.t = 0;
          }
        } else {
          const wrappedPitch = wrapAngle(x);
          const pitchSteer =
            !keys.Shift && isUp
              ? Math.max(state.targetPitch, 0.1)
              : !keys.Shift && isDown
                ? Math.min(state.targetPitch, -0.1)
                : state.targetPitch;
          if (rollExitHandOver(wrappedPitch, pitchSteer, MAX_CLIMB_ANGLE)) {
            // Key or analog pitch steering takes over at once, from the
            // settle's current rate, once upright (or pitched toward the steer)
            loopRecovering = false;
            x = wrappedPitch;
            manualPitchVel = loopExit.rate;
            manualPitchActive = true;
            lastPitchMode = 0;
          } else {
            loopExit.t += delta;
            loopExit.roll = x;
            const settled = stepRollExit(
              loopExit,
              loopExit.turns,
              effLoopRate,
              delta
            );
            x = loopExit.roll;
            loopPitchRate = loopExit.rate;
            if (settled || loopExit.t > ROLL_EXIT.MAX_SECONDS) {
              // Level: hand over to the normal pitch controls, now at rest
              x = wrapAngle(loopExit.roll);
              loopRecovering = false;
              loopPitchRate = 0;
              manualPitchVel = 0;
              manualPitchActive = false;
              lastPitchMode = 0;
            }
          }
        }
        planeGroup.rotation.x = x;
        if (loopActive || loopRecovering) {
          state.flightSpeedMultiplier =
            loopSpeed * (1 - (LOOP_SPEED_DIP * (1 - Math.cos(x))) / 2);
          state.maneuverBaseSpeed = loopSpeed;
        }

        state.isLooping = loopActive || loopRecovering;
        state.isDoingFullLoop = loopActive;
      }

      if (!loopActive && !loopRecovering) {
        // Pitch maneuvers: climb, dive, steep climb, and steep dive
        let pitchMode = 0;
        if (!keys.Shift) {
          if (isUp) {
            pitchMode = dtUp ? 2 : 1;
          } else if (isDown) {
            pitchMode = dtDown ? -2 : -1;
          }
        }

        if (pitchMode !== lastPitchMode && pitchMode !== 0) {
          if (!manualPitchActive) manualPitchVel = 0;
          manualPitchActive = true;
        }
        lastPitchMode = pitchMode;

        if (manualPitchActive) {
          if (Math.abs(pitchMode) === 2) steepPitchActive = true;
          else if (pitchMode !== 0) steepPitchActive = false;

          let targetAngle;
          const hasAnalogPitch =
            inputManager.state.mouse.controlActive ||
            inputManager.state.gamepad.steeringActive;
          const effAnalogY = hasAnalogPitch ? effMouseY : 0;
          const pitchModulation =
            effAnalogY * (maxPitch * 0.4) * (invertY ? -1 : 1);
          if (pitchMode === 2) {
            targetAngle = STEEP_CLIMB_ANGLE + pitchModulation;
          } else if (pitchMode === 1) {
            targetAngle = CLIMB_ANGLE + pitchModulation;
          } else if (pitchMode === -1) {
            targetAngle = DIVE_ANGLE + pitchModulation;
          } else if (pitchMode === -2) {
            targetAngle = STEEP_DIVE_ANGLE + pitchModulation;
          } else {
            // Returning to level flight (or analog pitch target)
            targetAngle = state.targetPitch;
          }
          const maxSpeed =
            (steepPitchActive ? STEEP_PITCH_SPEED : PITCH_SPEED) * agility;
          const kts =
            BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
          const maxClimb = climbLimit(ceilingCap, kts, handling);
          targetAngle = Math.min(
            maxClimb,
            Math.max(MAX_DIVE_ANGLE, targetAngle)
          );

          const diff = wrapAngle(targetAngle - planeGroup.rotation.x);

          if (
            pitchMode === 0 &&
            Math.abs(diff) <= 0.02 &&
            Math.abs(manualPitchVel) < 0.2
          ) {
            // Leveled out: cleanly hand over to normal flight model
            planeGroup.rotation.x = targetAngle;
            manualPitchActive = false;
            manualPitchVel = 0;
            steepPitchActive = false;
            state.isSteepPitch = false;
          } else {
            // The pitch rate heads for the rate that eases onto the target
            // at a steady acceleration, so switching between climb, dive
            // and level (each tap of a double or triple tap) never jerks
            const easeIn = steepPitchActive
              ? STEEP_PITCH_EASE_IN
              : PITCH_EASE_IN;
            const wantVel =
              Math.sign(diff) *
              Math.min(maxSpeed, Math.abs(diff) * PITCH_EASE_OUT * agility);
            const maxStep = (maxSpeed * delta) / easeIn;
            manualPitchVel += THREE.MathUtils.clamp(
              wantVel - manualPitchVel,
              -maxStep,
              maxStep
            );
            const pitched = planeGroup.rotation.x + manualPitchVel * delta;
            planeGroup.rotation.x = Math.max(
              MAX_DIVE_ANGLE,
              Math.min(MAX_CLIMB_ANGLE, pitched)
            );
            if (planeGroup.rotation.x !== pitched) manualPitchVel = 0;
            state.isSteepPitch = steepPitchActive;
          }
        }
      }
    }

    let rollHeld = 0;
    if (!state.isDoingImmelmann && !keys.Shift) {
      if (inAirGripRoll !== 0) rollHeld = inAirGripRoll;
      else if (isLeft && ttLeft) rollHeld = 1;
      else if (isRight && ttRight) rollHeld = -1;
    }
    if (rollHeld !== barrelRollDir) {
      if (rollHeld !== 0) {
        // Rolling again while easing out carries on from the rate it has
        barrelRollRate = rollExit.active
          ? Math.max(0, rollHeld * rollExit.rate)
          : 0;
        rollExit.active = false;
      } else {
        // Let go: ease to the level bank the roll's momentum carries it
        // nearest, rather than springing there (which jolted, could swap
        // which way it was heading as it passed upside down, and swung the
        // heading round while the plane was still well over)
        rollExit.active = true;
        rollExit.roll = planeGroup.rotation.z;
        rollExit.rate = barrelRollDir * barrelRollRate;
        rollExit.accel = 0;
        rollExit.turns = rollExitTurns(
          rollExit.roll,
          rollExit.rate,
          0,
          state.manualRollSpeed
        );
        rollExit.t = 0;
        barrelRollRate = 0;
      }
      barrelRollDir = rollHeld;
    }
    if (state.isDoingImmelmann) rollExit.active = false;
    if (rollExit.active) {
      const wrapped = wrapAngle(planeGroup.rotation.z);
      if (rollExitHandOver(wrapped, state.targetRoll, SHARP_TURN_BANK_ANGLE)) {
        // Player is steering while upright: hand over straight to the normal
        // bank controller from the current roll rate so yaw and camera follow
        rollExit.active = false;
        planeGroup.rotation.z = wrapped;
        rollRate = rollExit.rate;
      } else {
        rollExit.t += delta;
        rollExit.roll = planeGroup.rotation.z;
        const settled = stepRollExit(
          rollExit,
          rollExit.turns,
          state.manualRollSpeed,
          delta
        );
        planeGroup.rotation.z = rollExit.roll;
        if (settled || rollExit.t > ROLL_EXIT.MAX_SECONDS) {
          // Hand over to the usual roll, in its own range
          rollExit.active = false;
          planeGroup.rotation.z = wrapAngle(rollExit.roll);
          rollRate = rollExit.rate;
        } else {
          // Still rolling: the camera stays with it and the plane doesn't
          // turn until it is back near level
          state.isBarrelRolling = true;
        }
      }
    }
    if (barrelRollDir !== 0) {
      barrelRollRate = Math.min(
        state.manualRollSpeed,
        barrelRollRate + (state.manualRollSpeed * delta) / BARREL_ROLL_EASE_IN
      );
      planeGroup.rotation.z += barrelRollDir * barrelRollRate * delta;
      state.isBarrelRolling = true;
      state.isDoingFullBarrelRoll = true;
    }
  } else {
    if (barrelRollDir !== 0 || rollExit.active) {
      planeGroup.rotation.z = wrapAngle(planeGroup.rotation.z);
    }
    if (loopActive || loopRecovering) {
      planeGroup.rotation.x = wrapAngle(planeGroup.rotation.x);
    }
    vrSimStickWereFlying = false;
    barrelRollDir = 0;
    barrelRollRate = 0;
    rollExit.active = false;
    manualPitchVel = 0;
    manualPitchActive = false;
    steepPitchActive = false;
    lastPitchMode = 0;
    loopActive = false;
    loopRecovering = false;
  }

  // Taxi steering: allow airplane to yaw when stopped or at very low speed,
  // on the ground or the water only (in the air it added to the banked turn,
  // whipping a slow plane round)
  if (
    !state.isFreeCamera &&
    (state.isOnGround || state.isOnWater) &&
    state.flightSpeedMultiplier < 0.4
  ) {
    const groundGripTurn = !keys.Shift
      ? inputManager.state.gamepad.gripTurn || 0
      : 0;
    if ((isLeft || groundGripTurn > 0) && !keys.Shift) {
      planeGroup.rotation.y += 1.5 * delta;
    } else if ((isRight || groundGripTurn < 0) && !keys.Shift) {
      planeGroup.rotation.y -= 1.5 * delta;
    } else if (Math.abs(effMouseX) > 0.1 && !keys.Shift) {
      planeGroup.rotation.y -= effMouseX * 1.5 * delta;
    }
  }

  if (!state.isFreeCamera) {
    // The plane's agility scales how quickly it rolls and pitches toward the
    // controls and how sharply it turns (PLANE_HANDLING in constants.js)
    const {agility} = planeHandling();
    const effTurnSpeed =
      THREE.MathUtils.lerp(TURN_SPEED, SHARP_TURN_ROLL_SPEED, sharpTurnAmount) *
      agility;
    const kts = BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
    const turnRate =
      agility *
      THREE.MathUtils.lerp(
        1,
        TURN_FAST_SCALE,
        THREE.MathUtils.smoothstep(kts, TURN_FADE_FROM_KTS, TURN_FADE_TO_KTS)
      );

    const flightRot = ChillFlightLogic.computeFlightRotation({
      currentPitch: planeGroup.rotation.x,
      currentRoll: planeGroup.rotation.z,
      currentYaw: planeGroup.rotation.y, // We'll compute yaw here too, but apply it later based on speed
      targetPitch: state.targetPitch + state.manualPitch,
      targetRoll: state.targetRoll,
      turningRoll: planeGroup.rotation.z,
      isBarrelRolling: state.isBarrelRolling,
      isLooping: state.isLooping || state.isSteepPitch || manualPitchActive,
      isClampedRoll: state.isClampedRoll,
      turnSpeed: effTurnSpeed,
      delta: delta,
      yawMultiplier:
        THREE.MathUtils.lerp(1.0, SHARP_TURN_YAW_MULT, sharpTurnAmount) *
        turnRate,
      // A stick, mouse or gamepad can steer through a barrel roll; the
      // arrow key (or touch zone) holding the roll doesn't, so the roll goes
      // straight on keys as it does on the phone
      manualYaw:
        state.isBarrelRolling &&
        (inputManager.state.mouse.controlActive ||
          inputManager.state.gamepad.steeringActive)
          ? -effMouseX
          : 0,
    });

    planeGroup.rotation.x = flightRot.pitch;
    if (!state.isLooping && !state.isDoingImmelmann) {
      // Near the top of the sky the thin air eases the steepest climb to
      // level and then a little under (ceilingClimbLimit), a moment late
      // (sagClimbCap), so a climb floats up, the nose sags and the plane
      // settles just under the clouds; and slow, it can't climb as steeply:
      // from any climb at its level speed down to SLOW_CLIMB_ANGLE at its
      // stall speed, still enough to lift off there
      const handling = planeHandling();
      ceilingCap = sagClimbCap(
        ceilingCap,
        ceilingClimbLimit(
          planeGroup.position.y,
          flightCeiling(manualCloudHeight),
          MAX_CLIMB_ANGLE
        ),
        kts,
        delta
      );
      const maxClimb = climbLimit(ceilingCap, kts, handling);
      if (planeGroup.rotation.x > maxClimb) manualPitchVel = 0;
      planeGroup.rotation.x = Math.max(
        MAX_DIVE_ANGLE,
        Math.min(maxClimb, planeGroup.rotation.x)
      );
    }
    const rollBefore = planeGroup.rotation.z;
    if (state.weightedRoll && !state.isBarrelRolling) {
      // Weighted roll (on unless ?weightedRoll=0): the bank eases in and
      // stops cleanly, like a spring with no overshoot, settling about when
      // the usual roll does (WEIGHTED_ROLL_OMEGA)
      // The roll is kept within half a turn either way: a barrel roll leaves
      // it a whole turn or more round, which the turn would read as banked
      // all the way over, spinning the plane
      const omega = WEIGHTED_ROLL_OMEGA * effTurnSpeed * 60;
      const roll = wrapAngle(rollBefore);
      let target = state.targetRoll;
      while (target > roll + Math.PI) target -= Math.PI * 2;
      while (target < roll - Math.PI) target += Math.PI * 2;
      const step = Math.min(delta, 0.05);
      rollRate +=
        (omega * omega * (target - roll) - 2 * omega * rollRate) * step;
      planeGroup.rotation.z = wrapAngle(roll + rollRate * step);
    } else {
      planeGroup.rotation.z = flightRot.roll;
      // Carried over, so switching to the weighted roll (or out of a barrel
      // roll, which turned the plane before this) doesn't jolt
      rollRate =
        barrelRollDir !== 0
          ? barrelRollDir * barrelRollRate
          : rollExit.active
            ? rollExit.rate
            : delta > 0
              ? (flightRot.roll - rollBefore) / delta
              : 0;
    }

    // Store calculated yaw to be applied later in the physics block
    state._nextYaw = flightRot.yaw;
  }
}

// The cloud base's mist (updateEnvironmentLighting): the fog's density at
// the top of the sky under full cloud, thick enough to fade the ground
// without hiding it (twice this was a whiteout), and the daylit cloud colour
// it leans to
const CLOUD_BASE_FOG = 0.0003;
const _mistLit = new THREE.Color(0xdde3ea);
const _mistColor = new THREE.Color();
const _mistCamPos = new THREE.Vector3();
// Inside the deck (flying through it, ABOVE_CLOUDS): the fog's density
const IN_CLOUD_FOG = 0.003;

// How much cumulus deck is overhead (0..1), as the sky draws it
// (cloudsAlong in constants.js): the weather's overcast thickens the deck
// and the day's mood adds its own cover
function cloudBaseCover(overcast) {
  if (!skyUniforms.uShowClouds.value) return 0;
  return (
    skyUniforms.uCloudTypes.value.x *
    THREE.MathUtils.smoothstep(
      (overcast - 0.5) * 0.6 + skyUniforms.uCloudCover.value,
      -0.1,
      0.25
    )
  );
}

const SNOW_MAX_BRIGHTNESS = 0.95;
const SNOW_COOL_TINT = new THREE.Vector3(0.94, 0.99, 1.07);
const SHADOW_LOOK_AHEAD = 1400;
// The shadows follow the sun in steps (see updateShadowSnapping)
const _shadowSunGoal = new THREE.Vector3();
// How much of the hidden sun's light the sky light takes over in twilight
const TWILIGHT_SKY_SHARE = 0.6;
const _shadowAnchor = new THREE.Vector3();
const _shadowForward = new THREE.Vector3();

function updateShadowSnapping() {
  // --- SHADOW TEXEL SNAPPING (View-Space) ---
  // Eliminates "shadow swimming" and depth-band "creeping" by locking the
  // shadow camera in all 3 dimensions to a rigid, sun-aligned grid.

  // Step 1: Compute the sun direction (Forward vector)
  // Clamp sunY to a small positive value so the shadow direction never flips.
  // This makes shadows smoothly stretch toward the horizon at sunset/sunrise
  // and then freeze. The dirLight intensity fades to 0 via sunLightFactor anyway,
  // so the frozen direction is invisible by the time it diverges from reality.
  // The shadows turn with the sun in small steps rather than every frame:
  // each turn redraws every shadow edge a fraction of a texel over, which
  // done every frame makes thin shadows (the plane's wings)
  // shimmer. A step moves a shadow by a negligible amount.
  _shadowSunGoal
    .set(state.sunX, Math.max(0.15, state.sunY), state.sunZ)
    .normalize();
  // A shadow's tip moves by its height times the step over sin^2 of the
  // sun's elevation, so low sun stretches shadows the most: the steps shrink
  // with sin^2, from half a degree with the sun 45 degrees or more up (about
  // every half second of a normal day) to a tenth near the horizon
  const sin2 = _shadowSunGoal.y * _shadowSunGoal.y;
  const stepDeg = THREE.MathUtils.clamp(sin2, 0.1, 0.5);
  const stepCos = Math.cos((stepDeg * Math.PI) / 180);
  if (
    _shadowSunDir.lengthSq() === 0 ||
    _shadowSunDir.dot(_shadowSunGoal) < stepCos
  ) {
    _shadowSunDir.copy(_shadowSunGoal);
  }

  // Step 2: Build a rigid local coordinate system for the light.
  _shadowRight.crossVectors(_worldUp, _shadowSunDir).normalize();
  _shadowUp.crossVectors(_shadowSunDir, _shadowRight).normalize();

  // Use planeGroup instead of camera by default to prevent high-speed camera shake
  // from causing erratic shadow snapping. If in free camera mode, use the camera.
  // Center the shadow box ahead of the anchor (along the camera's heading),
  // since almost nothing behind the plane is on screen. This pushes the
  // shadow edge from ~2 km ahead to ~3.5 km at the same map resolution.
  const shadowAtCamera =
    state.isFreeCamera ||
    (state.cameraMode === 'cinematic' && state.camFrame === 'world-track');
  const anchorPos = _shadowAnchor.copy(
    shadowAtCamera ? camera.position : planeGroup.position
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

  // Step 6: Move the light straight to the snapped position. A whole-texel
  // step leaves every shadow exactly where it was; easing toward it (as this
  // used to) drew the map at in-between offsets for a few frames after each
  // step, which made shadow edges crawl.
  _targetShadowPos.copy(anchorPos);
  _targetShadowPos.addScaledVector(_shadowRight, dx);
  _targetShadowPos.addScaledVector(_shadowUp, dy);
  _targetShadowPos.addScaledVector(_shadowSunDir, dz); // Apply depth snap

  dirLight.target.position.copy(_targetShadowPos);

  // Position the light exactly 4000 units behind the target (must be larger than frustum radius)
  dirLight.position
    .copy(dirLight.target.position)
    .addScaledVector(_shadowSunDir, 4000);

  moonLight.position.copy(moonMesh.position);
  skyGroup.position.copy(getCameraWorldPosition());
}

// The sky light's warm tint in golden light
const _goldenSkyLight = new THREE.Color(0xffc98a);
const _hslA = {h: 0, s: 0, l: 0};
const _hslB = {h: 0, s: 0, l: 0};
// Blends color c toward target, keeping the saturation the two colors have
// between them. A plain RGB blend from the day's blue to a sunset orange
// passes through grey, which turned the whole sky a pale grey in golden light.
function lerpKeepSaturation(c, target, t) {
  c.getHSL(_hslA);
  target.getHSL(_hslB);
  const s = _hslA.s + (_hslB.s - _hslA.s) * t;
  c.lerp(target, t).getHSL(_hslA);
  return c.setHSL(_hslA.h, s, _hslA.l);
}
// Warms the horizon color c (the day's blue) toward the sunset color target.
// A blend that keeps saturation (above) swings the hue from blue through
// indigo, magenta and red in a few game minutes, since blue and orange sit on
// opposite sides of the color wheel. Instead the blue fades to a pale haze
// (brighter, like the glare of a low sun), and the warm color grows out of it,
// golden at first and turning to the target's orange. hueShift (degrees)
// turns the warm side redder after sunset, for the afterglow.
const HORIZON_HAZE_AT = 0.2; // where the blue has faded out
const HORIZON_HAZE_LIFT = 0.15; // how much brighter the haze is
const HORIZON_GOLD_DEGREES = 15; // how golden the warm color starts
function warmHorizon(c, target, t, hueShift) {
  c.getHSL(_hslA);
  target.getHSL(_hslB);
  let l = _hslA.l + (_hslB.l - _hslA.l) * t;
  if (t < 2 * HORIZON_HAZE_AT) {
    l += HORIZON_HAZE_LIFT * Math.sin((Math.PI * t) / (2 * HORIZON_HAZE_AT));
  }
  if (t < HORIZON_HAZE_AT) {
    const s = _hslA.s * (1 - t / HORIZON_HAZE_AT);
    return c.setHSL(_hslA.h, s, Math.min(0.95, l));
  }
  const v = (t - HORIZON_HAZE_AT) / (1 - HORIZON_HAZE_AT);
  const h = _hslB.h + ((1 - v) * HORIZON_GOLD_DEGREES + hueShift) / 360;
  return c.setHSL((h + 1) % 1, _hslB.s * Math.pow(v, 0.4), Math.min(0.95, l));
}
// How warm the sky is: full with the sun on the horizon, none from 24
// degrees up (or down)
function skyWarmth(sunY) {
  return Math.max(0, Math.pow(1.0 - Math.min(1, Math.abs(sunY) * 2.5), 1.5));
}

function updateEnvironmentLighting(delta, now) {
  // Smoothly interpolate sky shader palettes
  if (skyUniforms !== undefined && !isCustomPalette) {
    skyUniforms.topColor.value.lerp(targetPaletteTop, delta * 0.1);
    skyUniforms.bottomColor.value.lerp(targetPaletteBottom, delta * 0.1);
  }

  // 1. Precipitation around the plane, even above the clouds
  let precipIntensity = 0;
  if (state._unfadedRainOpacity !== undefined) {
    precipIntensity = Math.max(
      state._unfadedSnowOpacity / 0.8,
      state._unfadedRainOpacity / 0.5
    );
  }

  // 2. Cloud cover here: the cloud patches and the storms' overcast (see
  // weatherAt in chill-flight-logic.js)
  const weatherNoise = ChillFlightLogic.weatherAt(
    planeGroup.position.x,
    planeGroup.position.z,
    state.worldClockNow || now,
    simplex
  ).cloud;

  // 3. The world is overcast if there are thick clouds (we don't force overcast for snow/rain so we can have beautiful snowy sunsets)
  if (manualCloudCover !== null) {
    _currentOvercast = manualCloudCover;
  } else {
    // Starts at the weather here (not clear skies), then eases toward it
    // slowly, so clouds build and clear gradually (#80): a time constant of
    // CLOUD_EASE_SECONDS, whatever the frame rate
    _currentOvercast =
      _currentOvercast === undefined || state.snapEnvironment
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
  starsMat.visible = starsMat.opacity > 0.001;
  starsMat.uniforms.uTime.value = (performance.now() * 0.001) % 1000;

  // --- SHOOTING STARS ---
  _meteorMoonDir.set(state.moonX, state.moonY, state.moonZ).normalize();
  state.isShootingStarActive = updateShootingStar(
    delta,
    _meteorMoonDir,
    overcast < 0.5 ? starFactor * (1 - overcast) : 0,
    state.forceShootingStar
  );
  state.forceShootingStar = false;

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
  // naturally waxes and wanes - sometimes absent, sometimes a faint shimmer,
  // sometimes blazing. Two samples at different rates give organic variation.
  // Period ~20 min (primary) + ~7 min (secondary). The same for every player.
  const _auroraT1 = state.worldClockNow / 1200000; // ~20-min primary cycle
  const _auroraT2 = state.worldClockNow / 420000; // ~7-min secondary detail
  const _auroraRaw =
    simplex.noise2D(_auroraT1, 0.37) * 0.7 +
    simplex.noise2D(_auroraT2, 1.91) * 0.3; // -1 to 1
  // Map noise to 0..1: quiet (~33% of the time when noise is low/negative),
  // linearly scaling to 1.0 at peak. No pow bias - overcast already suppresses it.
  const auroraActivity = THREE.MathUtils.clamp(_auroraRaw * 0.6 + 0.4, 0, 1);

  const targetAuroraIntensity = Math.min(
    0.08,
    auroraLatFactor * auroraNightFactor * (1.0 - overcast) * auroraActivity
  );
  if (skyUniforms !== undefined) {
    skyUniforms.uAuroraIntensity.value = state.snapEnvironment
      ? targetAuroraIntensity
      : THREE.MathUtils.lerp(
          skyUniforms.uAuroraIntensity.value,
          targetAuroraIntensity,
          1 - Math.pow(1 - 0.002, delta * 60)
        );
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
  // (0 at new moon, 1 at full: the ghost ship's glow follows it too,
  // flight-camera.js)
  state.moonPhase = phaseIntensity;

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
    const dawnDuskFactor = skyWarmth(state.sunY);

    if (state.sunX > 0) {
      _currentSunriseSky.copy(_sunriseSky);
      _currentGoldenSky.copy(_goldenSky);
    } else {
      _currentSunriseSky.copy(_sunsetSky);
      _currentGoldenSky.copy(_goldenSunsetSky);
    }

    _uncloudedSkyColor.lerp(_twilightSky, state.dayFactor * 0.4);

    // Allow sunset colors in the main sky even when overcast (Issue #24)
    lerpKeepSaturation(_uncloudedSkyColor, _currentSunriseSky, dawnDuskFactor);

    if (state.sunY > -0.1 && state.sunY < 0.15) {
      let goldT = 1.0 - Math.abs(state.sunY - 0.02) * 10;
      _uncloudedSkyColor.lerp(_currentGoldenSky, Math.max(0, goldT) * 0.35);
    }

    lerpKeepSaturation(
      _uncloudedSkyColor,
      _daySky,
      state.dayFactor * (1.0 - dawnDuskFactor)
    );

    // Warm up the sunlight in golden light, from about 33 degrees up (higher
    // than the sky's warmth starts), and tint the sky light with it
    const sunsetLightCol =
      state.sunX > 0 ? _sunriseLightColor : _sunsetLightColor;
    const lightWarmth = Math.max(0, 1.0 - Math.abs(state.sunY) * 1.8);
    dirLight.color.copy(_dayLightColor).lerp(sunsetLightCol, lightWarmth);
    hemiLight.color.setHex(0xffffff).lerp(_goldenSkyLight, lightWarmth * 0.5);
  } else {
    dirLight.color.setHex(0xfff0dd);
    hemiLight.color.setHex(0xffffff);
  }

  _cloudyColor.setHex(0x0a0c10).lerp(_stormColor, state.dayFactor);

  // Above the deck (ABOVE_CLOUDS) the sky is clear whatever the weather
  // below
  const aboveDeck =
    ABOVE_CLOUDS && skyUniforms.uShowClouds.value
      ? THREE.MathUtils.smoothstep(
          getCameraWorldPosition(_mistCamPos).y,
          manualCloudHeight,
          manualCloudHeight + 200
        )
      : 0;
  _finalSkyColor
    .copy(_uncloudedSkyColor)
    .lerp(_cloudyColor, overcast * (1 - aboveDeck));
  _finalFogColor.copy(_uncloudedFogColor).lerp(_cloudyColor, overcast);

  // The cloud base (#176): under cloud, the last CEILING.THIN_AIR / 2
  // below the top of the sky fill with mist the colour of the clouds'
  // underside, so climbing to the top is skimming into the cloud deck. Clear
  // skies keep only the thin air (flight-physics-logic.js)
  const top = flightCeiling(manualCloudHeight);
  const camY = getCameraWorldPosition(_mistCamPos).y;
  const deckY = manualCloudHeight;
  const cover = cloudBaseCover(overcast);
  state.thinAir = thinAirAt(planeGroup.position.y, top);
  state.cloudBaseMist =
    THREE.MathUtils.smoothstep(
      camY,
      deckY - CEILING.BELOW_CLOUDS - CEILING.THIN_AIR / 2,
      deckY - CEILING.BELOW_CLOUDS + 20
    ) * cover;
  // Flying through the deck (ABOVE_CLOUDS): a whiteout inside it (the fog
  // here, the veil over the sky in cloud-deck.js), which above it takes the
  // place of the cloud base's mist
  state.inCloud = 0;
  if (ABOVE_CLOUDS) {
    state.inCloud =
      (1 - THREE.MathUtils.smoothstep(Math.abs(camY - deckY), 40, 220)) * cover;
    if (camY > deckY) state.cloudBaseMist = state.inCloud;
  }
  _mistColor
    .copy(_finalFogColor)
    .lerp(_cloudyColor, 0.5)
    .lerp(_mistLit, 0.35 * state.dayFactor);
  _finalFogColor.lerp(_mistColor, Math.max(state.cloudBaseMist, state.inCloud));
  if (state.snapEnvironment) {
    scene.fog.color.copy(_finalFogColor);
  } else {
    scene.fog.color.lerp(_finalFogColor, 1 - Math.pow(1 - 0.05, delta * 60));
  }

  // Fog density follows the conditions: clear skies, morning fog, clouds,
  // precipitation, and mist lingering after rain (see computeFogDensity).
  const baseFogDensity =
    state.manualBaseFogDensity !== undefined
      ? state.manualBaseFogDensity
      : ChillFlightLogic.FOG.CLEAR;
  if (state.snapEnvironment) {
    fogAfterRain = precipIntensity;
  } else if (precipIntensity > fogAfterRain) {
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
  // Low-lying bayou mist when flying or driving low over the swamp
  const swampMist =
    ChillFlightLogic.swampFactorAt(
      planeGroup.position.x,
      planeGroup.position.z,
      simplex
    ) *
    THREE.MathUtils.clamp(
      1 - (planeGroup.position.y - WATER_LEVEL) / 140,
      0,
      1
    );
  const effectiveFogDensity = Math.max(
    targetFogDensity,
    baseFogDensity + swampMist * 0.000085,
    THREE.MathUtils.lerp(targetFogDensity, CLOUD_BASE_FOG, state.cloudBaseMist),
    THREE.MathUtils.lerp(targetFogDensity, IN_CLOUD_FOG, state.inCloud)
  );
  scene.fog.density = state.snapEnvironment
    ? effectiveFogDensity
    : THREE.MathUtils.lerp(
        scene.fog.density,
        effectiveFogDensity,
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
  updateCloudMood(delta, overcast);
  if (state.snapEnvironment) state.snapEnvironment = false;
  if (ART_CLOUDS) updateTowerSlices();
  // Storms bring snow from where the snow cover starts (sleet in between),
  // and their clouds are a lighter grey there
  skyUniforms.uSnowDeck.value = snowZone();
  if (skyUniforms.uCloudHeight) {
    skyUniforms.uCloudHeight.value = manualCloudHeight;
  }
  const _camWorld = getCameraWorldPosition();
  skyUniforms.uCameraPos.value.copy(_camWorld);
  updateCloudDeck(_camWorld);
  updateCloudVeil(scene.fog.color, _camWorld);
  // The anime towers stand on the far edge of the land and sea
  if (ART_CLOUDS) {
    const above = Math.max(0, _camWorld.y);
    skyUniforms.uTowerHorizon.value = -above / Math.hypot(above, FAR_RADIUS);
  }

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
    // And in the airport windsocks
    updateWindsocks(now * 0.001);
    // Whitecaps on the open sea: none on fair days, some as the clouds
    // thicken, the most in rain (both already eased)
    waterUniforms.uWhitecaps.value = THREE.MathUtils.clamp(
      Math.max(
        (overcast - 0.35) / 0.5,
        precipitation.rain,
        precipitation.snow * 0.6
      ),
      0,
      1
    );

    // Moonlight on the clouds and the halo around the moon
    moonlightUniforms.uMoonDir.value
      .set(state.moonX, state.moonY, state.moonZ)
      .normalize();
    moonlightUniforms.uMoonBright.value =
      moonFade * (0.3 + 0.7 * phaseIntensity) * (1.0 - 0.6 * overcast);
  }

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
  // Phase light direction - 29.5 game days per cycle
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

  // Dynamic Moon Sizing (Moon Illusion) - uniform scale only
  const moonElevation = Math.max(0.0, state.moonY);
  const moonScale = 1.0 + Math.pow(1.0 - moonElevation, 3.0) * 1.5;
  moonMesh.scale.setScalar(moonScale);

  if (!isCustomPalette) {
    if (state.dayFactor > 0.0) {
      const dawnDuskFactor = skyWarmth(state.sunY);

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
        // Redder in the afterglow, the sun up to about 9 degrees down
        const afterglow = THREE.MathUtils.clamp(-state.sunY / 0.15, 0, 1);
        warmHorizon(
          _skyBottomCol,
          _warmHorizonColor,
          actualDawnDusk,
          -18 * afterglow
        );
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
  // Sync chunk border helpers if enabled (low cost - only iterates loaded chunks)
  syncChunkBorders();

  // Shadow cadence: DynamicPerformanceMonitor throttles shadow updates under load
  // and disables them entirely at night when dirLight intensity is effectively zero.
  // Always run once if the shadow map hasn't been allocated yet (e.g. switching
  // low -> mid before dawn), or WebGL2 rejects every lit draw on a null depth map.
  renderer.shadowMap.needsUpdate =
    performanceMonitor.shouldUpdateShadows() ||
    (dirLight.castShadow && !dirLight.shadow.map);

  updatePlaneShadow();
  // (A knocked-over mushroom's trippy colours, only while drawing)
  applyTrip();
  const tRender0 = performance.now();
  renderFrame(scene, camera);
  const renderElapsed = performance.now() - tRender0;
  restoreTrip();
  return renderElapsed;
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
