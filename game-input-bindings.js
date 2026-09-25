// --- INPUT ---
if (ChillFlightLogic.START_TOD !== null) {
  window.manualTimeOfDay = ChillFlightLogic.START_TOD;
}

// --- WEBXR / VR DOLLY & CAMERA RIG ---
var dismissLoadingScreen; // Hoisted for early XR events
var openVRPauseMenu;
var closeVRPauseMenu;
var updateVRPauseInteraction;
function checkVRPresenting() {
  return !!(
    typeof renderer !== 'undefined' &&
    renderer &&
    renderer.xr &&
    renderer.xr.isPresenting
  );
}
var cameraDolly = new THREE.Group();
cameraDolly.name = 'cameraDolly';
cameraDolly.isCamera = true; // Crucial: Three.js lookAt() points +Z for generic Objects/Groups, but -Z for Cameras
var _worldCamPos = new THREE.Vector3();

function getCameraWorldPosition(target = _worldCamPos) {
  if (camera && camera.parent) {
    return camera.getWorldPosition(target);
  }
  if (camera) {
    return target.copy(camera.position);
  }
  return target;
}

var inputManager = new window.InputManager();
var keys = inputManager.state.keys;
var doubleTap = inputManager.state.doubleTap;
var tripleTap = inputManager.state.tripleTap;
var STEER_HOLD_THRESHOLD = 100; // ms to wait before a tap becomes a hold for pitch/looping

inputManager.onCameraToggle = () => {
  if (cameraMode === 'follow') cameraMode = 'first-person';
  else if (cameraMode === 'first-person') cameraMode = 'birds-eye-close';
  else if (cameraMode === 'birds-eye-close') cameraMode = 'birds-eye-far';
  else if (cameraMode === 'birds-eye-far') {
    cameraMode = 'cinematic';
    cinematicTimer = 0;
    currentCinematicIndex = 0;
  } else {
    cameraMode = 'follow';
    cameraTransitionProgress = 0;
  }
  if (typeof Achievements !== 'undefined') Achievements.unlock('directors_cut');
};
inputManager.onAutopilotToggle = () => {
  if (typeof toggleAutopilot !== 'undefined') toggleAutopilot();
};
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

  if (isOpening && typeof resetSteering === 'function') resetSteering();

  try {
    const url = new URL(window.location.href);
    if (isOpening) {
      url.searchParams.set('debug', 'true');
      if (window.FullscreenMap && window.FullscreenMap.isOpen()) {
        url.searchParams.set('fullscreenmap', 'true');
      }
      if (window.Minimap && window.Minimap.isVisible()) {
        url.searchParams.set('minimap', 'true');
      }
    } else {
      url.searchParams.delete('debug');
    }
    window.history.replaceState(null, '', url.toString());
    if (
      isOpening &&
      window.FullscreenMap &&
      window.FullscreenMap.isOpen() &&
      typeof window.FullscreenMap.syncUrlParams === 'function'
    ) {
      window.FullscreenMap.syncUrlParams();
    }
  } catch (err) {
    console.error('Failed to update URL parameters:', err);
  }
};
inputManager.onRainbowToggle = () => {
  if (rainbowTimer > 0) rainbowTimer = 0;
  else forceRainbow = true;
};
inputManager.onShootingStarToggle = () => {
  forceShootingStar = true;
};
inputManager.onWeatherToggle = () => {
  if (typeof cycleWeather === 'function') cycleWeather();
};
inputManager.onPauseToggle = () => {
  togglePause();
};
inputManager.onPlaneToggle = () => {
  if (typeof setActivePlane === 'function') {
    const types = ['classic', 'biplane', 'glider', 'twin'];
    const currentIndex = types.indexOf(window.activePlaneType);
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
    manualPitch = 0;
  }
};
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
  const downAction = invertYAxis ? 'ArrowUp' : 'ArrowDown';
  const isDownAction = action === 'ArrowDown' || action === downAction;
  if (
    isDownAction &&
    !isDoingImmelmann &&
    !isFreeCamera &&
    flightSpeedMultiplier > 0
  ) {
    isDoingImmelmann = true;
    immelmannProgress = 0;
  }
};

var mouseX = 0;
var mouseY = 0;
var _lastChunkUpdatePos = new THREE.Vector3(Infinity, Infinity, Infinity);
var mouseControlActive = false; // becomes true once the mouse moves; cleared by arrow-key presses
var windowJustFocused = false; // absorbs the first mousemove after returning to the tab

// Control scheme state ('touch', 'joystick', or 'gyro')
var currentControlScheme =
  localStorage.getItem('chill_flight_control_scheme') || 'joystick';

// Joystick state
var joystickActive = false;
var joystickTouchId = null;
var joystickStartX = 0;
var joystickStartY = 0;
var JOYSTICK_MAX_RADIUS = 50;
var JOYSTICK_SENSITIVITY = 0.5;
var steeringTouchId = null; // Track active touch for 'touch' mode

var startPlaneTooltipShown =
  localStorage.getItem('chill_flight_stopped_tooltip_shown') === 'true';
var dismissStartPlaneTooltipFunc = null;
var stoppedStartTime = null;
var targetPitch = 0;
var targetRoll = 0;
targetFlightSpeed = flightSpeedMultiplier; // Initialize based on current vehicle speed multiplier

// Apply a throttle delta: snap to 0 near rest, and give a minimum kick
// when starting from a standstill so small inputs (e.g. VR trigger taps)
// actually get the plane moving. Shared by all throttle inputs so the
// behavior can't drift between them.
function applyThrottleDelta(delta) {
  const maxSpeed =
    typeof window.getMaxFlightSpeedMult === 'function'
      ? window.getMaxFlightSpeedMult()
      : 3.3333333333333335;
  if (delta > 0) {
    if (targetFlightSpeed === 0) {
      targetFlightSpeed = Math.max(0.1, delta);
    } else {
      targetFlightSpeed += delta;
    }
  } else if (delta < 0) {
    targetFlightSpeed += delta;
    if (targetFlightSpeed < 0.05) {
      targetFlightSpeed = 0;
    }
  }
  targetFlightSpeed = Math.max(0, Math.min(maxSpeed, targetFlightSpeed));
}
var smoothedManeuverFactor = 0; // Ensures smooth cinematic transitions
var manualPitch = 0;
verticalVelocity = 0; // units/sec, negative = falling
var keyPressStartTime = inputManager.state.keyPressStartTime;
var cameraMode = 'follow'; // 'follow', 'first-person', 'birds-eye-close', 'birds-eye-far', or 'cinematic'
var cameraTransitionProgress = 0; // 0 = follow/cinematic, 1 = bird's eye
var currentBirdEyeHeight = 2000;
var cinematicTimer = 0;
var currentCinematicIndex = 0;
var _cinematicStableHeading = 0;

var isDoingImmelmann = false;
var immelmannProgress = 0;
var wasLooping = false;
var wasDoingFullLoop = false;
var wasBarrelRolling = false;
var wasDoingFullBarrelRoll = false;
var wasDoingImmelmann = false;
