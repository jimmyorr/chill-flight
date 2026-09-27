// --- INPUT ---
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {camera, renderer} from './sky.js';
import {
  HEADLIGHT_GLOW_INTENSITY,
  HEADLIGHT_INTENSITY,
  activePlaneType,
  getMaxFlightSpeedMult,
  headlight,
  headlightGlow,
  setActivePlane,
} from './airplane.js';
import {cycleWeather} from './weather-manager.js';
import {
  musicEnabled,
  purrpleCatAudio,
  setMusicEnabled,
  updateAudioPlayer,
} from './audio.js';
import {InputManager} from './input-manager.js';
import {state} from './state.js';
import {hooks} from './hooks.js';
import {Achievements} from './achievements.js';

if (ChillFlightLogic.START_TOD !== null) {
  state.manualTimeOfDay = ChillFlightLogic.START_TOD;
}

// --- WEBXR / VR DOLLY & CAMERA RIG ---
export function checkVRPresenting() {
  return !!(
    typeof renderer !== 'undefined' &&
    renderer &&
    renderer.xr &&
    renderer.xr.isPresenting
  );
}
export var cameraDolly = new THREE.Group();
cameraDolly.name = 'cameraDolly';
cameraDolly.isCamera = true; // Crucial: Three.js lookAt() points +Z for generic Objects/Groups, but -Z for Cameras
var _worldCamPos = new THREE.Vector3();

export function getCameraWorldPosition(target = _worldCamPos) {
  if (camera && camera.parent) {
    return camera.getWorldPosition(target);
  }
  if (camera) {
    return target.copy(camera.position);
  }
  return target;
}

export var inputManager = new InputManager();
export var keys = inputManager.state.keys;
export var doubleTap = inputManager.state.doubleTap;
export var tripleTap = inputManager.state.tripleTap;
export var STEER_HOLD_THRESHOLD = 100; // ms to wait before a tap becomes a hold for pitch/looping

inputManager.onCameraToggle = () => {
  if (state.cameraMode === 'follow') state.cameraMode = 'first-person';
  else if (state.cameraMode === 'first-person')
    state.cameraMode = 'birds-eye-close';
  else if (state.cameraMode === 'birds-eye-close')
    state.cameraMode = 'birds-eye-far';
  else if (state.cameraMode === 'birds-eye-far') {
    state.cameraMode = 'cinematic';
    currentCinematicIndex = 0;
  } else {
    state.cameraMode = 'follow';
    state.cameraTransitionProgress = 0;
  }
  if (typeof Achievements !== 'undefined') Achievements.unlock('directors_cut');
};
export const hdgtSub = document.getElementById('mobile-hdgt-sub');
inputManager.onHeadlightToggle = () => {
  if (headlight.intensity === 0) {
    headlight.intensity = HEADLIGHT_INTENSITY;
    headlightGlow.intensity = HEADLIGHT_GLOW_INTENSITY;
    if (hdgtSub) hdgtSub.classList.add('active');
    if (typeof Achievements !== 'undefined')
      Achievements.unlock('night_vision');
  } else {
    headlight.intensity = 0;
    headlightGlow.intensity = 0;
    if (hdgtSub) hdgtSub.classList.remove('active');
  }
};
inputManager.onDebugToggle = () => {
  const debugMenu = document.getElementById('debug-menu');
  const debugTelem = document.getElementById('debug-telemetry');
  if (!debugMenu) return;
  const isOpening = debugMenu.style.display !== 'block';
  debugMenu.style.display = isOpening ? 'block' : 'none';
  if (debugTelem) debugTelem.style.display = isOpening ? 'block' : 'none';

  if (isOpening) hooks.resetSteering?.();

  try {
    const url = new URL(window.location.href);
    if (isOpening) {
      url.searchParams.set('debug', 'true');
      if (hooks.fullscreenMap && hooks.fullscreenMap.isOpen()) {
        url.searchParams.set('fullscreenmap', 'true');
      }
      if (hooks.minimap && hooks.minimap.isVisible()) {
        url.searchParams.set('minimap', 'true');
      }
    } else {
      url.searchParams.delete('debug');
    }
    window.history.replaceState(null, '', url.toString());
    if (
      isOpening &&
      hooks.fullscreenMap &&
      hooks.fullscreenMap.isOpen() &&
      typeof hooks.fullscreenMap.syncUrlParams === 'function'
    ) {
      hooks.fullscreenMap.syncUrlParams();
    }
  } catch (err) {
    console.error('Failed to update URL parameters:', err);
  }
};
inputManager.onRainbowToggle = () => {
  if (state.rainbowTimer > 0) state.rainbowTimer = 0;
  else state.forceRainbow = true;
};
inputManager.onShootingStarToggle = () => {
  state.forceShootingStar = true;
};
inputManager.onWeatherToggle = () => {
  if (typeof cycleWeather === 'function') cycleWeather();
};
inputManager.onPlaneToggle = () => {
  if (typeof setActivePlane === 'function') {
    const types = ['classic', 'biplane', 'glider', 'twin'];
    const currentIndex = types.indexOf(activePlaneType);
    const nextPlane = types[(currentIndex + 1) % types.length] || 'classic';
    setActivePlane(nextPlane);
  }
};
inputManager.onMusicToggle = () => {
  if (
    typeof musicEnabled !== 'undefined' &&
    typeof purrpleCatAudio !== 'undefined'
  ) {
    if (musicEnabled && purrpleCatAudio.paused) {
      updateAudioPlayer(true);
    } else if (typeof setMusicEnabled === 'function') {
      setMusicEnabled(!musicEnabled);
    }
  }
};
inputManager.onThrottleChange = (delta) => {
  applyThrottleDelta(delta);
};
inputManager.onKeyRelease = (action, heldTime) => {
  if ((action === 'ArrowLeft' || action === 'ArrowRight') && heldTime < 200) {
    state.manualPitch = 0;
  }
};
let mobileFocusIndex = -1;
function updateMobileMenuFocus() {
  const subMenu = document.getElementById('mobile-sub-menu');
  if (!subMenu) return;
  const items = Array.from(subMenu.querySelectorAll('.sub-btn'));
  document
    .querySelectorAll('#mobile-action-menu .tv-focused')
    .forEach((el) => el.classList.remove('tv-focused'));
  if (mobileFocusIndex >= 0 && mobileFocusIndex < items.length) {
    items[mobileFocusIndex].classList.add('tv-focused');
  }
}

inputManager.onMenuToggle = () => {
  const menuContainer = document.getElementById('mobile-action-menu');
  if (menuContainer) {
    const expanding = !menuContainer.classList.contains('expanded');
    menuContainer.classList.toggle('expanded');
    if (expanding) {
      mobileFocusIndex = 0;
      updateMobileMenuFocus();
    } else {
      mobileFocusIndex = -1;
      updateMobileMenuFocus();
    }
  }
};
inputManager.onTripleTap = (action) => {
  const downAction = state.invertYAxis ? 'ArrowUp' : 'ArrowDown';
  const isDownAction = action === 'ArrowDown' || action === downAction;
  if (
    isDownAction &&
    !state.isDoingImmelmann &&
    !state.isFreeCamera &&
    state.flightSpeedMultiplier > 0
  ) {
    state.isDoingImmelmann = true;
    state.immelmannProgress = 0;
  }
};

export var _lastChunkUpdatePos = new THREE.Vector3(
  Infinity,
  Infinity,
  Infinity
);

// Control scheme state ('touch', 'joystick', or 'gyro')
state.currentControlScheme =
  localStorage.getItem('chill_flight_control_scheme') || 'joystick';

state.startPlaneTooltipShown =
  localStorage.getItem('chill_flight_stopped_tooltip_shown') === 'true';
state.targetFlightSpeed = state.flightSpeedMultiplier; // Initialize based on current vehicle speed multiplier

// Apply a throttle delta: snap to 0 near rest, and give a minimum kick
// when starting from a standstill so small inputs (e.g. VR trigger taps)
// actually get the plane moving. Shared by all throttle inputs so the
// behavior can't drift between them.
export function applyThrottleDelta(delta) {
  const maxSpeed =
    typeof getMaxFlightSpeedMult === 'function'
      ? getMaxFlightSpeedMult()
      : 3.3333333333333335;
  if (delta > 0) {
    if (state.targetFlightSpeed === 0) {
      state.targetFlightSpeed = Math.max(0.1, delta);
    } else {
      state.targetFlightSpeed += delta;
    }
  } else if (delta < 0) {
    state.targetFlightSpeed += delta;
    if (state.targetFlightSpeed < 0.05) {
      state.targetFlightSpeed = 0;
    }
  }
  state.targetFlightSpeed = Math.max(
    0,
    Math.min(maxSpeed, state.targetFlightSpeed)
  );
}
state.verticalVelocity = 0; // units/sec, negative = falling
export var keyPressStartTime = inputManager.state.keyPressStartTime;
export var currentCinematicIndex = 0;

// Bridge for classic scripts that haven't been converted to ES modules yet.
Object.assign(window, {
  checkVRPresenting,
  cameraDolly,
  getCameraWorldPosition,
  inputManager,
  keys,
  doubleTap,
  tripleTap,
  STEER_HOLD_THRESHOLD,
  _lastChunkUpdatePos,
  applyThrottleDelta,
  keyPressStartTime,
});
// Live bindings: reassigned here, read elsewhere.
Object.defineProperties(window, {
  currentCinematicIndex: {get: () => currentCinematicIndex, configurable: true},
});
