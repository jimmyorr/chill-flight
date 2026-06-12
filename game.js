// --- GAME LOOP, INPUT & CONTROLS ---
// Dependencies: THREE, scene, camera, renderer, planeGroup, propGroup, skyGroup,
//               sunMesh, moonMesh, dirLight, hemiLight, starsMat, timeOfDay, daySpeedMultiplier,
//               houseWindowMats, chunks, updateChunks, getElevation,
//               CHUNK_SIZE, WATER_LEVEL, BASE_FLIGHT_SPEED, TURN_SPEED, flightSpeedMultiplier,
//               pontoonGroup, pontoonL, pontoonR, hingeLF, hingeLB, hingeRF, hingeRB,
//               headlight, headlightGlow, otherPlayers (set by multiplayer.js),
//               musicEnabled, setMusicEnabled

// --- INPUT ---
if (ChillFlightLogic.START_TOD !== null) {
  window.manualTimeOfDay = ChillFlightLogic.START_TOD;
}

let mouseX = 0;
let mouseY = 0;
const _lastChunkUpdatePos = new THREE.Vector3(Infinity, Infinity, Infinity);
let mouseControlActive = false; // becomes true once the mouse moves; cleared by arrow-key presses
let windowJustFocused = false; // absorbs the first mousemove after returning to the tab

// Control scheme state ('touch', 'joystick', or 'gyro')
let currentControlScheme =
  localStorage.getItem('chill_flight_control_scheme') || 'joystick';

// Joystick state
let joystickActive = false;
let joystickTouchId = null;
let joystickStartX = 0;
let joystickStartY = 0;
const JOYSTICK_MAX_RADIUS = 50;
const JOYSTICK_SENSITIVITY = 0.5;

let startPlaneTooltipShown =
  localStorage.getItem('chill_flight_stopped_tooltip_shown') === 'true';
let dismissStartPlaneTooltipFunc = null;
let stoppedStartTime = null;
let targetPitch = 0;
let targetRoll = 0;
targetFlightSpeed = flightSpeedMultiplier; // Initialize based on current vehicle speed multiplier
let smoothedManeuverFactor = 0; // Ensures smooth cinematic transitions
let manualPitch = 0;
verticalVelocity = 0; // units/sec, negative = falling
let keyPressStartTime = {ArrowLeft: 0, ArrowRight: 0, ArrowUp: 0, ArrowDown: 0};
let cameraMode = 'follow'; // 'follow', 'first-person', 'birds-eye-close', 'birds-eye-far', or 'cinematic'
let cameraTransitionProgress = 0; // 0 = follow/cinematic, 1 = bird's eye
let currentBirdEyeHeight = 2000;
let cinematicTimer = 0;
let currentCinematicIndex = 0;
let _cinematicStableHeading = 0;

let isDoingImmelmann = false;
let immelmannProgress = 0;

// Intro Cinematic Transition
let isIntroTransitionActive = false;
let introTransitionStartTime = 0;
const _introCameraPosStart = new THREE.Vector3();
const _introLookTargetStart = new THREE.Vector3();
const _virtualCameraPos = new THREE.Vector3();
const _virtualLookTarget = new THREE.Vector3();

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

/**
 * Throttles DOM updates by only writing if the value has changed.
 */
function updateDOM(element, newValue) {
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

let isFreeCameraDragging = false;
let freeCamDeltaX = 0;
let freeCamDeltaY = 0;
let lastFreeCamTouchX = 0;
let lastFreeCamTouchY = 0;

window.addEventListener('contextmenu', (e) => {
  if (
    e.target.tagName !== 'INPUT' ||
    e.target.type === 'range' ||
    e.target.type === 'checkbox'
  ) {
    e.preventDefault();
  }
});

window.addEventListener('mousedown', (e) => {
  if (isFreeCamera) {
    if (
      !e.target.closest('#loading-overlay') &&
      !e.target.closest('#cockpit-ui') &&
      !e.target.closest('#debug-menu') &&
      !e.target.closest('#debug-telemetry') &&
      !e.target.closest('.title') &&
      !e.target.closest('#mobile-controls') &&
      !e.target.closest('#online-players')
    ) {
      isFreeCameraDragging = true;
    }
  }
});

window.addEventListener('mouseup', () => {
  isFreeCameraDragging = false;
});

window.addEventListener('mousemove', (e) => {
  if (isFreeCameraDragging && isFreeCamera) {
    freeCamDeltaX += e.movementX || 0;
    freeCamDeltaY += e.movementY || 0;
  }

  if (
    !e.target.closest('#loading-overlay') &&
    !e.target.closest('#cockpit-ui') &&
    !e.target.closest('#debug-menu') &&
    !e.target.closest('#debug-telemetry') &&
    !e.target.closest('.title') &&
    !e.target.closest('#mobile-controls') &&
    !e.target.closest('#online-players')
  ) {
    updateInputPosition(e.clientX, e.clientY);
    if (windowJustFocused) {
      // Silently sync position without steering — swallows the spurious
      // move event browsers fire when the window regains focus.
      windowJustFocused = false;
      return;
    }
    mouseControlActive = true;
    gamepadSteeringActive = false;
  }
});
// --- MOBILE SPECIAL MOVES GESTURE STATE ---
let activeGestureTouchId = null;
let activeGestureAction = null;

window.addEventListener(
  'touchstart',
  (e) => {
    if (e.touches.length > 0) {
      const target = e.target;
      const isPauseOverlay = target.closest('#pause-overlay');
      const isUI =
        isPauseOverlay ||
        target.closest('#loading-overlay') ||
        target.closest('#cockpit-ui') ||
        target.closest('#debug-menu') ||
        target.closest('#debug-telemetry') ||
        target.closest('.title') ||
        target.closest('#mobile-controls') ||
        target.closest('#player-list') ||
        target.closest('.color-swatch');
      if (!isUI) {
        if (e.cancelable) e.preventDefault(); // Stop iOS from starting a selection gesture

        if (isFreeCamera) {
          isFreeCameraDragging = true;
          lastFreeCamTouchX = e.touches[0].clientX;
          lastFreeCamTouchY = e.touches[0].clientY;
          return;
        }

        // --- Gyro mode: skip all screen-drag steering ---
        if (currentControlScheme === 'gyro') {
          // Don't update mouseX/mouseY from touch; gyro handles steering.
          // But still process gesture detection (double/triple-tap) for barrel rolls etc.
          const touch = e.touches[0];
          const now = performance.now();
          const x = touch.clientX / window.innerWidth;
          const y = touch.clientY / window.innerHeight;

          let action = null;
          if (x < 0.33) action = 'ArrowLeft';
          else if (x > 0.66) action = 'ArrowRight';
          else if (y < 0.33) action = 'ArrowUp';
          else if (y > 0.66) action = 'ArrowDown';

          if (action) {
            const timeSinceLastTap = now - lastArrowTap[action];
            if (timeSinceLastTap < DOUBLE_TAP_MS) {
              tapCount[action] = (tapCount[action] || 0) + 1;
            } else {
              tapCount[action] = 1;
            }
            lastArrowTap[action] = now;

            if (tapCount[action] === 2) {
              doubleTap[action] = true;
              keys[action] = true;
              keyPressStartTime[action] = now;
              activeGestureTouchId = touch.identifier;
              activeGestureAction = action;
            } else if (tapCount[action] >= 3) {
              if (y < 0.33) {
                tripleTap.ArrowUp = true;
                keys.ArrowUp = true;
                keyPressStartTime.ArrowUp = now;
                activeGestureTouchId = touch.identifier;
                activeGestureAction = 'ArrowUp';
              } else {
                tripleTap[action] = true;
                keys[action] = true;
                keyPressStartTime[action] = now;
                activeGestureTouchId = touch.identifier;
                activeGestureAction = action;
              }
            }
          }
          // Do NOT set mouseControlActive or update mouseX/mouseY
        } else if (currentControlScheme === 'joystick') {
          // --- Joystick mode ---
          const touch = e.touches[0];

          if (!joystickActive) {
            // Activate joystick centered at touch position
            joystickActive = true;
            joystickTouchId = touch.identifier;
            joystickStartX = touch.clientX;
            joystickStartY = touch.clientY;
            mouseControlActive = true;

            // Show and position joystick dynamically
            const joystickBase = document.getElementById(
              'virtual-joystick-base'
            );
            if (joystickBase) {
              joystickBase.style.left = `${touch.clientX}px`;
              joystickBase.style.top = `${touch.clientY}px`;
              joystickBase.classList.remove('joystick-hidden');
              joystickBase.classList.add('joystick-visible');
            }
          }

          // --- Gesture Detection ---
          const now = performance.now();
          const x = touch.clientX / window.innerWidth;
          const y = touch.clientY / window.innerHeight;

          let action = null;
          if (x < 0.33) action = 'ArrowLeft';
          else if (x > 0.66) action = 'ArrowRight';
          else if (y < 0.33) action = 'ArrowUp';
          else if (y > 0.66) action = 'ArrowDown';

          if (action) {
            const timeSinceLastTap = now - lastArrowTap[action];
            if (timeSinceLastTap < DOUBLE_TAP_MS) {
              tapCount[action] = (tapCount[action] || 0) + 1;
            } else {
              tapCount[action] = 1;
            }
            lastArrowTap[action] = now;

            if (tapCount[action] === 2) {
              doubleTap[action] = true;
              keys[action] = true;
              keyPressStartTime[action] = now;
              activeGestureTouchId = touch.identifier;
              activeGestureAction = action;
            } else if (tapCount[action] >= 3) {
              if (y < 0.33) {
                tripleTap.ArrowUp = true;
                keys.ArrowUp = true;
                keyPressStartTime.ArrowUp = now;
                activeGestureTouchId = touch.identifier;
                activeGestureAction = 'ArrowUp';
              } else {
                tripleTap[action] = true;
                keys[action] = true;
                keyPressStartTime[action] = now;
                activeGestureTouchId = touch.identifier;
                activeGestureAction = action;
              }
            }
          }

          // Suppress steering and hide joystick if gesture is active
          if (activeGestureTouchId !== null) {
            mouseControlActive = false;
            mouseX = 0;
            mouseY = 0;
            joystickActive = false;
            joystickTouchId = null;
            const joystickBase = document.getElementById(
              'virtual-joystick-base'
            );
            if (joystickBase) {
              joystickBase.classList.remove('joystick-visible');
              joystickBase.classList.add('joystick-hidden');
            }
            const stick = document.getElementById('virtual-joystick-stick');
            if (stick) {
              stick.style.transform = 'translate(-50%, -50%)';
            }
          }
        } else {
          // --- Touch mode (original absolute-positioning) ---
          const touch = e.touches[0];
          updateInputPosition(touch.clientX, touch.clientY);
          mouseControlActive = true;

          // --- Gesture Detection ---
          const now = performance.now();
          const x = touch.clientX / window.innerWidth;
          const y = touch.clientY / window.innerHeight;

          let action = null;
          if (x < 0.33) action = 'ArrowLeft';
          else if (x > 0.66) action = 'ArrowRight';
          else if (y < 0.33) action = 'ArrowUp';
          else if (y > 0.66) action = 'ArrowDown';

          if (action) {
            const timeSinceLastTap = now - lastArrowTap[action];
            if (timeSinceLastTap < DOUBLE_TAP_MS) {
              tapCount[action] = (tapCount[action] || 0) + 1;
            } else {
              tapCount[action] = 1;
            }
            lastArrowTap[action] = now;

            if (tapCount[action] === 2) {
              doubleTap[action] = true;
              keys[action] = true;
              keyPressStartTime[action] = now;
              activeGestureTouchId = touch.identifier;
              activeGestureAction = action;
            } else if (tapCount[action] >= 3) {
              if (y < 0.33) {
                // Triple tap on top of screen -> Steep climb
                tripleTap.ArrowUp = true;
                keys.ArrowUp = true;
                keyPressStartTime.ArrowUp = now;
                activeGestureTouchId = touch.identifier;
                activeGestureAction = 'ArrowUp';
              } else {
                tripleTap[action] = true;
                keys[action] = true;
                keyPressStartTime[action] = now;
                activeGestureTouchId = touch.identifier;
                activeGestureAction = action;
              }
            }
          }

          // Suppress steering if this touch is an active gesture (double/triple-tap)
          if (activeGestureTouchId !== null) {
            mouseControlActive = false;
            mouseX = 0;
            mouseY = 0;
          }
        }
      } else {
        mouseControlActive = false; // Stop steering if touching UI
        mouseX = 0;
        mouseY = 0;
      }
    }
    windowJustFocused = false;
  },
  {passive: false}
);

window.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 0) {
      const target = e.target;
      const isPauseOverlay = target.closest('#pause-overlay');
      const isUI =
        target.closest('#cockpit-ui') ||
        isPauseOverlay ||
        target.closest('#loading-overlay') ||
        target.closest('#debug-menu') ||
        target.closest('#debug-telemetry') ||
        target.closest('.title') ||
        target.closest('#mobile-controls') ||
        target.closest('#player-list') ||
        target.closest('.color-swatch');

      if (!isUI && !isPaused) {
        e.preventDefault();
      }

      if (!isUI) {
        if (isFreeCameraDragging && isFreeCamera) {
          const touch = e.touches[0];
          freeCamDeltaX += touch.clientX - lastFreeCamTouchX;
          freeCamDeltaY += touch.clientY - lastFreeCamTouchY;
          lastFreeCamTouchX = touch.clientX;
          lastFreeCamTouchY = touch.clientY;
          return;
        }

        // --- Gyro mode: skip all screen-drag steering ---
        if (currentControlScheme === 'gyro') {
          // Do nothing for steering; gyro handles it
        } else if (currentControlScheme === 'joystick' && joystickActive) {
          // --- Joystick mode ---
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === joystickTouchId) {
              const touch = e.touches[i];
              const dx = touch.clientX - joystickStartX;
              const dy = touch.clientY - joystickStartY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const clampedDist = Math.min(dist, JOYSTICK_MAX_RADIUS);
              const angle = Math.atan2(dy, dx);
              const stickX = Math.cos(angle) * clampedDist;
              const stickY = Math.sin(angle) * clampedDist;

              // Move stick knob visually
              const stick = document.getElementById('virtual-joystick-stick');
              if (stick) {
                stick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
              }

              // Write normalized values to mouseX/mouseY
              // X: positive = right, Y: negative = down (matching computeInputPosition convention)
              mouseX = (stickX / JOYSTICK_MAX_RADIUS) * JOYSTICK_SENSITIVITY;
              mouseY = -(stickY / JOYSTICK_MAX_RADIUS) * JOYSTICK_SENSITIVITY;
              mouseControlActive = true;
              break;
            }
          }
        } else if (currentControlScheme === 'touch') {
          // --- Touch mode (original absolute-positioning) ---
          // Find a touch that is not the active gesture touch
          let steeringTouch = null;
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier !== activeGestureTouchId) {
              steeringTouch = e.touches[i];
              break;
            }
          }
          if (steeringTouch) {
            updateInputPosition(steeringTouch.clientX, steeringTouch.clientY);
            mouseControlActive = true;
          } else {
            mouseControlActive = false;
            mouseX = 0;
            mouseY = 0;
          }
        }
      } else {
        mouseControlActive = false;
        mouseX = 0;
        mouseY = 0;
      }
    }
  },
  {passive: false}
);

window.addEventListener('touchend', (e) => {
  // --- Joystick cleanup ---
  if (joystickActive) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        joystickActive = false;
        joystickTouchId = null;
        mouseControlActive = false;
        mouseX = 0;
        mouseY = 0;

        // Hide joystick and reset stick position
        const joystickBase = document.getElementById('virtual-joystick-base');
        if (joystickBase) {
          joystickBase.classList.remove('joystick-visible');
          joystickBase.classList.add('joystick-hidden');
        }
        const stick = document.getElementById('virtual-joystick-stick');
        if (stick) {
          stick.style.transform = 'translate(-50%, -50%)';
        }
        break;
      }
    }
  }

  // --- Gesture cleanup ---
  if (activeGestureTouchId !== null) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeGestureTouchId) {
        if (activeGestureAction) {
          doubleTap[activeGestureAction] = false;
          if (typeof tripleTap !== 'undefined')
            tripleTap[activeGestureAction] = false;
          keys[activeGestureAction] = false;
        }
        activeGestureTouchId = null;
        activeGestureAction = null;
        break;
      }
    }
  }

  if (e.touches.length === 0) {
    mouseControlActive = false;
    mouseX = 0;
    mouseY = 0;
    isFreeCameraDragging = false;
  }
});

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

// Robustness: Force resize check after page load and at intervals to catch late-settling layout
window.addEventListener('load', onWindowResize);
setTimeout(onWindowResize, 100);
setTimeout(onWindowResize, 500);
setTimeout(onWindowResize, 2000); // Final check for very slow loading environments

// --- EXPLOSIONS ---
let explosionParticles = null;
let lastY = 250; // track for ascent/descent detection

// --- PAUSE ---
let isPaused = true;
let justResumed = false; // one-frame guard to suppress any input that bled through from the pause menu

function clearInputState() {
  mouseX = 0;
  mouseY = 0;
  mouseControlActive = false;
  // keys/doubleTap may not exist yet at first call (togglePause runs before key state is declared),
  // so guard with typeof.
  if (typeof keys !== 'undefined') {
    keys.ArrowUp =
      keys.ArrowDown =
      keys.ArrowLeft =
      keys.ArrowRight =
      keys.Shift =
        false;
  }
  if (typeof doubleTap !== 'undefined') {
    doubleTap.ArrowUp =
      doubleTap.ArrowDown =
      doubleTap.ArrowLeft =
      doubleTap.ArrowRight =
        false;
  }
  if (typeof tripleTap !== 'undefined') {
    tripleTap.ArrowUp =
      tripleTap.ArrowDown =
      tripleTap.ArrowLeft =
      tripleTap.ArrowRight =
        false;
  }
  if (typeof tapCount !== 'undefined') {
    tapCount.ArrowUp =
      tapCount.ArrowDown =
      tapCount.ArrowLeft =
      tapCount.ArrowRight =
        0;
  }
  if (typeof activeGestureTouchId !== 'undefined') activeGestureTouchId = null;
  if (typeof activeGestureAction !== 'undefined') activeGestureAction = null;
  if (typeof gyroBasePitch !== 'undefined') {
    gyroBasePitch = null;
    gyroBaseRoll = null;
  }
  // Joystick cleanup
  joystickActive = false;
  joystickTouchId = null;
  const _joystickBase = document.getElementById('virtual-joystick-base');
  if (_joystickBase) {
    _joystickBase.classList.remove('joystick-visible');
    _joystickBase.classList.add('joystick-hidden');
  }
  const _joystickStick = document.getElementById('virtual-joystick-stick');
  if (_joystickStick) {
    _joystickStick.style.transform = 'translate(-50%, -50%)';
  }
}
const pauseOverlay = document.getElementById('pause-overlay');

function togglePause() {
  isPaused = !isPaused;
  if (isPaused) {
    pauseOverlay.style.display = 'flex';

    // Clear all movement keys so they aren't stuck when unpausing
    keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
    doubleTap.ArrowUp =
      doubleTap.ArrowDown =
      doubleTap.ArrowLeft =
      doubleTap.ArrowRight =
        false;
    if (typeof tripleTap !== 'undefined') {
      tripleTap.ArrowUp =
        tripleTap.ArrowDown =
        tripleTap.ArrowLeft =
        tripleTap.ArrowRight =
          false;
    }
    if (typeof tapCount !== 'undefined') {
      tapCount.ArrowUp =
        tapCount.ArrowDown =
        tapCount.ArrowLeft =
        tapCount.ArrowRight =
          0;
    }

    if (typeof updatePauseMenuMusicInfo === 'function')
      updatePauseMenuMusicInfo();
    if (musicEnabled && typeof pauseMusicInternal === 'function')
      pauseMusicInternal();
  } else {
    pauseOverlay.style.display = 'none';

    clock.getDelta(); // clear accumulated time so plane doesn't skip
    clearInputState(); // wipe any input that bled through from the pause overlay
    justResumed = true; // suppress the first animate frame's input application

    if (musicEnabled && typeof playMusicInternal === 'function')
      playMusicInternal();
  }
}

// --- GAMEPAD SUPPORT ---
let gamepadPauseLatched = false;
let gamepadSelectLatched = false;
let gamepadSteeringActive = false;
let lastGamepadButtons = [];

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

function pollGamepad(delta) {
  const gamepads = navigator.getGamepads
    ? navigator.getGamepads()
    : navigator.webkitGetGamepads
      ? navigator.webkitGetGamepads()
      : [];
  let gp = null;
  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i] && gamepads[i].connected) {
      gp = gamepads[i];
      break;
    }
  }

  if (!gp) {
    lastGamepadButtons = [];
    return;
  }

  // 1. Flight Stick: Map Left Analog Stick (Axes 0 and 1) to Pitch and Roll
  // Axis 0: Roll (Left/Right), Axis 1: Pitch (Up/Down)
  let roll = gp.axes[0];
  let pitch = gp.axes[1];

  // Deadzone: 0.15
  const deadzone = 0.15;
  if (Math.abs(roll) < deadzone) roll = 0;
  if (Math.abs(pitch) < deadzone) pitch = 0;

  // Map to global mouseX/mouseY which are used for targetRoll/targetPitch
  if (Math.abs(gp.axes[0]) > deadzone || Math.abs(gp.axes[1]) > deadzone) {
    mouseX = roll;
    mouseY = pitch;
    mouseControlActive = true;
    gamepadSteeringActive = true;
  } else if (gamepadSteeringActive) {
    mouseX = 0;
    mouseY = 0;
    gamepadSteeringActive = false;
  }

  // 2. Throttle: Map Right Trigger (Button 7) to accelerate and Left Trigger (Button 6) to decelerate
  const rt =
    gp.buttons[7].value !== undefined
      ? gp.buttons[7].value
      : gp.buttons[7].pressed
        ? 1
        : 0;
  const lt =
    gp.buttons[6].value !== undefined
      ? gp.buttons[6].value
      : gp.buttons[6].pressed
        ? 1
        : 0;

  if (rt > 0.1) {
    const throttleRate = (0.2 + rt * 1.0) * delta;
    targetFlightSpeed = Math.min(
      window.MAX_FLIGHT_SPEED_MULT || 3.3333333333333335,
      targetFlightSpeed + throttleRate
    );
  }
  if (lt > 0.1) {
    const throttleRate = (0.2 + lt * 1.0) * delta;
    targetFlightSpeed = Math.max(0, targetFlightSpeed - throttleRate);
  }

  // 3. Pause: Map 'Start' or 'Menu' button (Button 9) to toggle pause
  if (gp.buttons[9].pressed) {
    if (!gamepadPauseLatched) {
      togglePause();
      gamepadPauseLatched = true;
    }
  } else {
    gamepadPauseLatched = false;
  }

  // Toggle Mobile Menu: Map 'Select' or 'Back' button (Button 8)
  if (gp.buttons[8].pressed) {
    if (!gamepadSelectLatched) {
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
      gamepadSelectLatched = true;
    }
  } else {
    gamepadSelectLatched = false;
  }

  // 4. Buttons and D-pad
  const currentButtons = gp.buttons.map((b) => b.pressed);

  // Map D-pad to Arrows
  const dpadMap = [
    {btn: 12, key: 'ArrowUp'},
    {btn: 13, key: 'ArrowDown'},
    {btn: 14, key: 'ArrowLeft'},
    {btn: 15, key: 'ArrowRight'},
  ];

  dpadMap.forEach((map) => {
    const isPressed = gp.buttons[map.btn].pressed;
    const wasPressed = !!lastGamepadButtons[map.btn];

    if (isPressed && !wasPressed) {
      // Dispatch a native keydown for D-pad so it reaches our menu logic
      window.dispatchEvent(new KeyboardEvent('keydown', {key: map.key}));
    } else if (!isPressed && wasPressed) {
      window.dispatchEvent(new KeyboardEvent('keyup', {key: map.key}));
    }
  });

  // Map Button 0 (A) to Enter for selection
  if (gp.buttons[0].pressed && !lastGamepadButtons[0]) {
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
  } else if (!gp.buttons[0].pressed && lastGamepadButtons[0]) {
    window.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter'}));
  }

  // 5. Bumpers: Map LB (4) and RB (5) to ArrowLeft/ArrowRight (handled for barrel rolls)
  const bumperMap = [
    {btn: 4, key: 'ArrowLeft'},
    {btn: 5, key: 'ArrowRight'},
  ];

  bumperMap.forEach((map) => {
    const isPressed = gp.buttons[map.btn].pressed;
    const wasPressed = !!lastGamepadButtons[map.btn];

    if (isPressed && !wasPressed) {
      keys[map.key] = true;
      const now = performance.now();
      if (now - lastArrowTap[map.key] < DOUBLE_TAP_MS) {
        doubleTap[map.key] = true;
      }
      lastArrowTap[map.key] = now;
      keyPressStartTime[map.key] = now;

      // Keyboard/Gamepad takes control from mouse/stick
      mouseControlActive = false;
      mouseX = 0;
      mouseY = 0;
    } else if (!isPressed && wasPressed) {
      keys[map.key] = false;
      doubleTap[map.key] = false;
      lastKeyUpTime[map.key] = performance.now();
    }
    // State is updated for all buttons at the end of pollGamepad
  });

  // Update lastGamepadButtons for all buttons
  gp.buttons.forEach((btn, idx) => {
    lastGamepadButtons[idx] = btn.pressed;
  });
}

let tvFocusRow = 2; // Default to radio section
let tvFocusCol = 0;

function getMenuGrid() {
  const grid = [];

  // Row 0: Callsign input
  const nameInput = document.getElementById('player-name-input');
  if (nameInput) grid.push([nameInput]);

  // Row 1: Livery colors
  const swatches = Array.from(document.querySelectorAll('.color-swatch'));
  if (swatches.length > 0) grid.push(swatches);

  // Row 2: Graphics / Invert Y
  const row2 = [];
  const presetSelect = document.getElementById('graphics-preset-select');
  if (presetSelect) row2.push(presetSelect);
  const invertY = document.getElementById('invert-y-input');
  if (invertY) row2.push(invertY);
  if (row2.length > 0) grid.push(row2);

  // Row 4: Control scheme toggle buttons (if visible)
  const schemeToggle = document.getElementById('control-scheme-toggle');
  if (schemeToggle && schemeToggle.style.display !== 'none') {
    const schemeBtnsArr = Array.from(
      schemeToggle.querySelectorAll('.scheme-btn')
    ).filter((btn) => btn.style.display !== 'none');
    if (schemeBtnsArr.length > 0) grid.push(schemeBtnsArr);
  }

  // Row 5: Resume button
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) grid.push([resumeBtn]);

  return grid;
}

function updateTVFocus() {
  document
    .querySelectorAll('.tv-focused')
    .forEach((el) => el.classList.remove('tv-focused'));
  const grid = getMenuGrid();
  tvFocusRow = Math.min(tvFocusRow, grid.length - 1);
  if (tvFocusRow < 0) return;
  tvFocusCol = Math.min(tvFocusCol, grid[tvFocusRow].length - 1);
  if (tvFocusCol < 0) return;
  const el = grid[tvFocusRow][tvFocusCol];
  if (!el) return;
  el.classList.add('tv-focused');
  el.focus();
}

window.addEventListener('mousemove', (e) => {
  if (isPaused) {
    document
      .querySelectorAll('.tv-focused')
      .forEach((el) => el.classList.remove('tv-focused'));
  }
});

window.addEventListener('keydown', (e) => {
  // 1. Mobile Action Menu Navigation (Priority when expanded)
  const menuContainer = document.getElementById('mobile-action-menu');
  const isMenuExpanded =
    menuContainer && menuContainer.classList.contains('expanded');
  if (isMenuExpanded && !isPaused) {
    const subMenu = document.getElementById('mobile-sub-menu');
    const items = subMenu
      ? Array.from(subMenu.querySelectorAll('.sub-btn'))
      : [];
    if (items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        mobileFocusIndex = (mobileFocusIndex + 1) % items.length;
        updateMobileMenuFocus();
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        mobileFocusIndex = (mobileFocusIndex - 1 + items.length) % items.length;
        updateMobileMenuFocus();
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (mobileFocusIndex >= 0 && mobileFocusIndex < items.length) {
          items[mobileFocusIndex].click();
        }
        return;
      }
    }
  }

  // 2. Toggle Pause: Escape = PC, Backspace = TV Back, MediaPlayPause = TV Play/Pause, Enter = TV Center (if playing)
  const isToggleKey =
    e.key === 'Escape' ||
    e.code === 'MediaPlayPause' ||
    (e.key === 'Backspace' &&
      (!document.activeElement ||
        document.activeElement.tagName !== 'INPUT' ||
        document.activeElement.type === 'checkbox')) ||
    (e.key === 'Enter' &&
      !isPaused &&
      !isMenuExpanded &&
      (!document.activeElement || document.activeElement.id !== 'resume-btn'));

  if (isToggleKey) {
    togglePause();
    if (isPaused) {
      tvFocusRow = 2;
      tvFocusCol = 0;
      document
        .querySelectorAll('.tv-focused')
        .forEach((el) => el.classList.remove('tv-focused'));
    }
    return;
  }

  // 3. Navigation in pause menu
  if (isPaused) {
    // --- START SCREEN OVERRIDE ---
    const overlay = document.getElementById('loading-overlay');
    if (overlay && overlay.style.display !== 'none') {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const btnContainer = document.getElementById('splash-btn-container');
        const beginBtn = document.getElementById('begin-btn');
        if (
          beginBtn &&
          btnContainer &&
          btnContainer.style.visibility === 'visible'
        ) {
          beginBtn.click();
          e.preventDefault();
          return;
        }
      }
      return;
    }

    // Ignore menu navigation if typing in an input field
    if (
      document.activeElement &&
      document.activeElement.tagName === 'INPUT' &&
      document.activeElement.type !== 'checkbox'
    ) {
      return;
    }

    // Prevent arrow keys from scrolling the page (with safety check for e.key)
    if (e.key && e.key.startsWith('Arrow')) {
      e.preventDefault();
    }

    const grid = getMenuGrid();
    let handled = false;

    if (e.key === 'ArrowDown') {
      tvFocusRow = Math.min(tvFocusRow + 1, grid.length - 1);
      tvFocusCol = Math.min(tvFocusCol, grid[tvFocusRow].length - 1);
      handled = true;
    } else if (e.key === 'ArrowUp') {
      tvFocusRow = Math.max(tvFocusRow - 1, 0);
      tvFocusCol = Math.min(tvFocusCol, grid[tvFocusRow].length - 1);
      handled = true;
    } else if (e.key === 'ArrowLeft') {
      if (
        document.activeElement &&
        document.activeElement.tagName === 'SELECT'
      ) {
        const sel = document.activeElement;
        if (sel.selectedIndex > 0) {
          sel.selectedIndex--;
          sel.dispatchEvent(new Event('change'));
        }
      } else if (
        document.activeElement &&
        document.activeElement.tagName === 'INPUT' &&
        document.activeElement.type !== 'checkbox'
      ) {
        return; // Let native cursor move
      } else {
        tvFocusCol = Math.max(tvFocusCol - 1, 0);
      }
      handled = true;
    } else if (e.key === 'ArrowRight') {
      if (
        document.activeElement &&
        document.activeElement.tagName === 'SELECT'
      ) {
        const sel = document.activeElement;
        if (sel.selectedIndex < sel.options.length - 1) {
          sel.selectedIndex++;
          sel.dispatchEvent(new Event('change'));
        }
      } else if (
        document.activeElement &&
        document.activeElement.tagName === 'INPUT' &&
        document.activeElement.type !== 'checkbox'
      ) {
        return; // Let native cursor move
      } else {
        tvFocusCol = Math.min(tvFocusCol + 1, grid[tvFocusRow].length - 1);
      }
      handled = true;
    } else if (e.key === 'Enter') {
      const el = grid[tvFocusRow][tvFocusCol];
      if (el) {
        if (el.tagName === 'INPUT' && el.type !== 'checkbox') {
          el.blur();
          tvFocusRow = 1;
          tvFocusCol = 0;
        } else if (el.id === 'resume-btn') {
          togglePause();
        } else {
          el.click();
        }
      }
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      updateTVFocus();
    }
    return; // Important: don't let pause menu keys leak to flight controls
  }

  // 4. Vehicle Switch Shortcut: 'v' or 'V'
  if (
    ENABLE_VEHICLE_SWITCH &&
    e.key.toLowerCase() === 'v' &&
    !isPaused &&
    (!document.activeElement || document.activeElement.tagName !== 'INPUT')
  ) {
    const nextType =
      vehicleType === 'airplane'
        ? 'helicopter'
        : vehicleType === 'helicopter'
          ? 'boat'
          : vehicleType === 'boat'
            ? 'buggy'
            : 'airplane';
    setVehicle(nextType);
    return;
  }
});

window.addEventListener(
  'wheel',
  (e) => {
    if (isPaused || isFreeCamera) return;

    // Use e.deltaY to scale the throttle change.
    // This handles both fast trackpad scrolls (many small deltas)
    // and standard mouse wheels (few large deltas, e.g. 100 per notch).
    // e.deltaY > 0 -> scrolling down -> throttle down
    // e.deltaY < 0 -> scrolling up -> throttle up
    const throttleDelta = -e.deltaY * 0.005;

    const isBoatOrBuggy = vehicleType === 'boat' || vehicleType === 'buggy';
    const maxSpeed = isBoatOrBuggy
      ? 0.66
      : window.MAX_FLIGHT_SPEED_MULT || 3.3333333333333335;
    const minSpeed = isBoatOrBuggy ? -0.33 : 0;

    targetFlightSpeed += throttleDelta;

    // Snap to 0 if very close to avoid creeping
    if (Math.abs(targetFlightSpeed) < 0.05) {
      targetFlightSpeed = 0;
    }

    targetFlightSpeed = Math.max(
      minSpeed,
      Math.min(maxSpeed, targetFlightSpeed)
    );
  },
  {passive: true}
);

document.getElementById('resume-btn').addEventListener('click', () => {
  togglePause();
});

const cockpitUI = document.getElementById('cockpit-ui');
if (cockpitUI) {
  cockpitUI.addEventListener('click', () => {
    togglePause();
  });
}

function updatePauseMenuMusicInfo() {
  const cpEl = document.getElementById('currently-playing');
  const titleEl = document.getElementById('song-title-text');
  const attrEl = document.getElementById('music-attribution');
  const showMusicInfo =
    musicEnabled && typeof getCurrentTrackName === 'function';

  if (cpEl && titleEl) {
    if (showMusicInfo) {
      cpEl.style.display = 'block';
      titleEl.textContent = getCurrentTrackName();
    } else {
      cpEl.style.display = 'none';
    }
  }

  if (attrEl) {
    attrEl.style.display = showMusicInfo ? 'block' : 'none';
  }
}

// Register for automatic track change updates
if (typeof window !== 'undefined') {
  window.onTrackChange = (name) => {
    updatePauseMenuMusicInfo();
  };
  // Initialize initial visibility based on startup state
  updatePauseMenuMusicInfo();
}

const vehicleToggle = document.getElementById('mobile-vehicle-toggle');
if (vehicleToggle) {
  if (!ENABLE_VEHICLE_SWITCH) {
    vehicleToggle.style.display = 'none';
  } else {
    vehicleToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nextType =
        vehicleType === 'airplane'
          ? 'helicopter'
          : vehicleType === 'helicopter'
            ? 'boat'
            : vehicleType === 'boat'
              ? 'buggy'
              : 'airplane';
      setVehicle(nextType);
    });
  }
}

function applyGraphicsPreset(preset) {
  let segments = 40;
  let dist = 2;
  let fps = 60;

  switch (preset) {
    case 'ultra':
      segments = 120;
      dist = 3;
      fps = 60;
      break;
    case 'high':
      segments = 80;
      dist = 3;
      fps = 60;
      break;
    case 'mid':
      segments = 40;
      dist = 2;
      fps = 60;
      break;
    case 'low':
      segments = 20;
      dist = 2;
      fps = 30;
      break;
    default:
      preset = 'mid';
      segments = 40;
      dist = 2;
      fps = 60;
      break;
  }

  localStorage.setItem('chill_flight_graphics_preset', preset);

  // Set global variables
  SEGMENTS = segments;
  RENDER_DISTANCE = dist;
  if (typeof maxFPS !== 'undefined') {
    maxFPS = fps;
    frameMinDelay = maxFPS > 0 ? 1000 / maxFPS : 0;
  }

  console.log(
    `Graphics preset applied: ${preset} (SEGMENTS=${segments}, DIST=${dist}, FPS=${fps})`
  );

  // Update pixel ratio dynamically: baked resolution scale into quality levels
  let pixelRatio = window.devicePixelRatio;
  if (segments <= 20) {
    pixelRatio = 0.5;
  } else if (segments <= 40) {
    pixelRatio = Math.min(window.devicePixelRatio, 2) * 0.75;
  } else if (segments <= 80) {
    pixelRatio = Math.min(window.devicePixelRatio, 2) * 1.0;
  } else {
    pixelRatio = window.devicePixelRatio; // No cap for Ultra
  }

  if (typeof renderer !== 'undefined' && renderer) {
    renderer.setPixelRatio(pixelRatio);
  }

  // Toggle sky clouds dynamically: disable expensive fBm on low mode
  if (typeof skyUniforms !== 'undefined') {
    skyUniforms.uShowClouds.value =
      segments > 20 && ChillFlightLogic.SHOW_CLOUDS;
  }

  // Toggle overdraw optimizations (transparency)
  const isLow = segments <= 20;
  if (typeof waterMaterial !== 'undefined' && typeof cloudMat !== 'undefined') {
    waterMaterial.transparent = !isLow;
    waterMaterial.opacity = isLow ? 1.0 : 0.6;
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
          child.receiveShadow = enableShadows;
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
  }
  if (typeof _lastChunkUpdatePos !== 'undefined') {
    _lastChunkUpdatePos.set(Infinity, Infinity, Infinity); // Force chunk rebuild
  }
}

const graphicsPresetSelect = document.getElementById('graphics-preset-select');
if (graphicsPresetSelect) {
  graphicsPresetSelect.addEventListener('change', (e) => {
    applyGraphicsPreset(e.target.value);
  });
}

// Theme selection
const themeSelect = document.getElementById('theme-select');
if (themeSelect) {
  const currentTheme = ChillFlightLogic.THEME;
  themeSelect.value = currentTheme;
  themeSelect.addEventListener('change', (e) => {
    const newTheme = e.target.value;
    const confirmReload = window.confirm(
      'Applying a new theme requires a page reload.\n\nReload now?'
    );

    if (confirmReload) {
      const url = new URL(window.location);
      url.searchParams.set('theme', newTheme);
      window.location.assign(url.toString());
    } else {
      // Revert the dropdown selection if they cancel
      themeSelect.value = currentTheme;
    }
  });
}

// Seed selection
const seedInput = document.getElementById('seed-input');
if (seedInput) {
  seedInput.value = ChillFlightLogic.WORLD_SEED;
  seedInput.addEventListener('change', (e) => {
    const newSeed = e.target.value;
    if (!newSeed) return;
    if (parseInt(newSeed, 10) === ChillFlightLogic.WORLD_SEED) return;
    const confirmReload = window.confirm(
      'Applying a new seed requires a page reload.\n\nReload now?'
    );

    if (confirmReload) {
      const url = new URL(window.location);
      url.searchParams.set('seed', newSeed);
      window.location.assign(url.toString());
    } else {
      // Revert to original
      seedInput.value = ChillFlightLogic.WORLD_SEED;
    }
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

// Free Camera toggle
let isFreeCamera = ChillFlightLogic.START_FREE_CAM || false;
const freeCamToggle = document.getElementById('debug-free-cam-toggle');
if (freeCamToggle) {
  if (isFreeCamera) {
    freeCamToggle.checked = true;
    camera.rotation.order = 'YXZ'; // Better for fly-cam

    if (ChillFlightLogic.START_X !== null)
      camera.position.x = ChillFlightLogic.START_X;
    if (ChillFlightLogic.START_Y !== null)
      camera.position.y = ChillFlightLogic.START_Y;
    if (ChillFlightLogic.START_Z !== null)
      camera.position.z = ChillFlightLogic.START_Z;
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
  }
  freeCamToggle.addEventListener('change', (e) => {
    isFreeCamera = e.target.checked;
    if (isFreeCamera) {
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
      camera.rotation.order = 'XYZ'; // Reset to default
    }
  });
}

const copyCamUrlBtn = document.getElementById('debug-copy-cam-url');
if (copyCamUrlBtn) {
  copyCamUrlBtn.addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('freecam', 'true');
    url.searchParams.set('x', Math.round(camera.position.x));
    url.searchParams.set('y', Math.round(camera.position.y));
    url.searchParams.set('z', Math.round(camera.position.z));
    url.searchParams.set(
      'heading',
      Math.round(THREE.MathUtils.radToDeg(camera.rotation.y))
    );
    url.searchParams.set(
      'pitch',
      Math.round(THREE.MathUtils.radToDeg(camera.rotation.x))
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

// --- MOBILE UI ADJUSTMENTS ---
if (window.innerWidth <= 1024) {
  const cockpitUI = document.getElementById('cockpit-ui');
  if (cockpitUI) {
    cockpitUI.style.justifyContent = 'center';
  }

  const radioModule = document.getElementById('cockpit-radio-module');
  if (radioModule) {
    radioModule.style.borderLeft = 'none';
    radioModule.style.paddingLeft = '0';
    radioModule.style.marginLeft = '0';
  }
}

// --- MAIN GAME LOOP ---
const clock = new THREE.Clock();
const deltaBuffer = [];
const DELTA_BUFFER_SIZE = 10;
let smoothedDelta = 1 / 60;

// --- PERSISTENCE ---
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
}

let invertYAxis = false;
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

let gyroEnabled = currentControlScheme === 'gyro';

const gyroSensitivity = 60.0; // Hardcoded to low sensitivity (60 degrees for max control response) as requested

let gyroBasePitch = null;
let gyroBaseRoll = null;

const controlSchemeToggle = document.getElementById('control-scheme-toggle');
const gyroSchemeBtn = document.getElementById('gyro-scheme-btn');

function checkGyroSupport() {
  let supported = false;
  if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
    supported = true;
  } else {
    // On iOS, deviceorientation might not fire until permission is granted.
    // So we check if the API exists AND if it's a mobile/touch device.
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (window.DeviceOrientationEvent && hasTouch) {
      supported = true;
    }
  }

  // Show gyro button if supported
  if (supported && gyroSchemeBtn) {
    gyroSchemeBtn.style.display = '';
  }

  // Show the entire control scheme toggle on touch devices
  if (supported || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
    if (controlSchemeToggle) {
      controlSchemeToggle.style.display = '';
    }
  }
}
checkGyroSupport();

// Set active state on scheme buttons from saved preference
if (controlSchemeToggle) {
  const schemeBtns = controlSchemeToggle.querySelectorAll('.scheme-btn');
  schemeBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.scheme === currentControlScheme);
  });

  schemeBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      let scheme = btn.dataset.scheme;

      // Request gyro permission on iOS if selecting gyro
      if (
        scheme === 'gyro' &&
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        try {
          const permissionState =
            await DeviceOrientationEvent.requestPermission();
          if (permissionState !== 'granted') {
            alert('Gyro permission denied.');
            return; // Don't switch to gyro
          }
        } catch (err) {
          console.error('Error requesting gyro permission', err);
          return;
        }
      }

      currentControlScheme = scheme;
      gyroEnabled = scheme === 'gyro';
      localStorage.setItem('chill_flight_control_scheme', scheme);
      gyroBasePitch = null;
      gyroBaseRoll = null;

      // Update button active states
      schemeBtns.forEach((b) => {
        b.classList.toggle('active', b.dataset.scheme === scheme);
      });

      const recalibrateBtn = document.getElementById('mobile-recalibrate-btn');
      if (recalibrateBtn) {
        recalibrateBtn.style.display = scheme === 'gyro' ? '' : 'none';
      }

      // Reset steering state when switching
      mouseX = 0;
      mouseY = 0;
      mouseControlActive = false;
      joystickActive = false;
      joystickTouchId = null;
      const _jBase = document.getElementById('virtual-joystick-base');
      if (_jBase) {
        _jBase.classList.remove('joystick-visible');
        _jBase.classList.add('joystick-hidden');
      }
      const _jStick = document.getElementById('virtual-joystick-stick');
      if (_jStick) {
        _jStick.style.transform = 'translate(-50%, -50%)';
      }
    });
  });
}

const _zee = new THREE.Vector3(0, 0, 1);
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const _euler = new THREE.Euler();

function getDeviceQuaternion(alpha, beta, gamma, orient) {
  const degToRad = Math.PI / 180;
  _euler.set(
    beta * degToRad,
    (alpha || 0) * degToRad,
    -(gamma || 0) * degToRad,
    'YXZ'
  );
  const q = new THREE.Quaternion();
  q.setFromEuler(_euler);
  q.multiply(_q1);
  q.multiply(_q0.setFromAxisAngle(_zee, -orient * degToRad));
  return q;
}

let gyroBaseQuat = null;
let gyroBaseGravity = null;
const recalibrateBtn = document.getElementById('mobile-recalibrate-btn');
if (recalibrateBtn) {
  recalibrateBtn.style.display = currentControlScheme === 'gyro' ? '' : 'none';
  recalibrateBtn.addEventListener('click', (e) => {
    e.preventDefault();
    gyroBaseQuat = null;
    gyroBaseGravity = null;

    // Provide a little UI feedback (e.g. green icon temporarily)
    recalibrateBtn.style.color = '#4caf50';
    recalibrateBtn.style.borderColor = '#4caf50';
    setTimeout(() => {
      recalibrateBtn.style.color = '';
      recalibrateBtn.style.borderColor = '';
    }, 1500);
  });
}

function handleGyroData(alpha, beta, gamma) {
  if (currentControlScheme !== 'gyro' || isPaused) return;
  if (beta === null || gamma === null) return;

  const orientation =
    window.screen && window.screen.orientation
      ? window.screen.orientation.angle
      : window.orientation || 0;

  const currentQuat = getDeviceQuaternion(alpha, beta, gamma, orientation);

  // Gravity is -Y in the World Frame (Three.js deviceorientation convention)
  const gravityWorld = new THREE.Vector3(0, -1, 0);
  const currentGravity = gravityWorld
    .clone()
    .applyQuaternion(currentQuat.clone().invert());

  if (!gyroBaseQuat) {
    gyroBaseQuat = currentQuat.clone();
    gyroBaseGravity = currentGravity.clone();
  }

  // Pitch is the rotation around the local X axis
  const relQuat = gyroBaseQuat.clone().invert().multiply(currentQuat);
  const relEuler = new THREE.Euler().setFromQuaternion(relQuat, 'XYZ');
  // Removed negation to match original landscape gyro polarity
  let diffPitch = relEuler.x * (180 / Math.PI);

  // Roll is the tilt of the right side of the device towards gravity
  let currentRollAngle =
    Math.asin(THREE.MathUtils.clamp(currentGravity.x, -1, 1)) * (180 / Math.PI);
  let baseRollAngle =
    Math.asin(THREE.MathUtils.clamp(gyroBaseGravity.x, -1, 1)) *
    (180 / Math.PI);
  let diffRoll = currentRollAngle - baseRollAngle;

  let targetX = diffRoll / gyroSensitivity;
  if (targetX > 1) targetX = 1;
  if (targetX < -1) targetX = -1;

  let targetY = diffPitch / gyroSensitivity;
  if (targetY > 1) targetY = 1;
  if (targetY < -1) targetY = -1;

  mouseX = targetX;
  mouseY = targetY;
  mouseControlActive = true;
}

if (
  typeof Capacitor !== 'undefined' &&
  Capacitor.Plugins &&
  Capacitor.Plugins.Motion
) {
  Capacitor.Plugins.Motion.addListener('orientation', (event) => {
    handleGyroData(event.alpha, event.beta, event.gamma);
  });
} else {
  window.addEventListener('deviceorientation', (event) => {
    handleGyroData(event.alpha, event.beta, event.gamma);
  });
}

// --- PERFORMANCE SETTINGS ---
let maxFPS = 60;
let frameMinDelay = 1000 / 60;
let lastFrameTime = 0;

// Apply initial graphics preset
const savedPreset = localStorage.getItem('chill_flight_graphics_preset');
if (savedPreset) {
  if (graphicsPresetSelect) graphicsPresetSelect.value = savedPreset;
  applyGraphicsPreset(savedPreset);
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

// --- WEATHER SYSTEM ---
let weatherType = 'auto'; // 'auto', 'none', 'snow', 'rain'
let snowParticles = null;
let rainParticles = null;

// Scale particles based on quality
const _savedQualityForWeather = localStorage.getItem('chill_flight_quality');
const _currentQualityForWeather = _savedQualityForWeather
  ? parseInt(_savedQualityForWeather)
  : 32;
const WEATHER_PARTICLE_COUNT = _currentQualityForWeather <= 16 ? 1500 : 5000;
const WEATHER_RANGE = 500;

// Generate a soft, glowing circle for snow
function createSnowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(8, 8, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

// Generate a motion-blurred streak for rain
function createRainTexture() {
  const canvas = document.createElement('canvas');
  // The canvas MUST be square for PointsMaterial to prevent stretching
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Vertical gradient to simulate motion blur
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)'); // Brighter core
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = grad;
  // Draw a thin streak directly down the middle (X=31, Y=0, Width=2, Height=64)
  ctx.fillRect(31, 0, 2, 64);

  return new THREE.CanvasTexture(canvas);
}

function initWeather() {
  // Geometries
  const snowGeo = new THREE.BufferGeometry();
  const rainGeo = new THREE.BufferGeometry();

  const snowPos = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
  const snowVel = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
  const rainPos = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
  const rainVel = new Float32Array(WEATHER_PARTICLE_COUNT * 3);

  for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
    // Shared random spawn positions
    const startX = (Math.random() - 0.5) * WEATHER_RANGE;
    const startY = (Math.random() - 0.5) * WEATHER_RANGE;
    const startZ = (Math.random() - 0.5) * WEATHER_RANGE;

    snowPos[i * 3] = startX;
    snowPos[i * 3 + 1] = startY;
    snowPos[i * 3 + 2] = startZ;
    rainPos[i * 3] = startX;
    rainPos[i * 3 + 1] = startY;
    rainPos[i * 3 + 2] = startZ;

    // Snow velocity: gentle drift and slow fall
    snowVel[i * 3] = (Math.random() - 0.5) * 15;
    snowVel[i * 3 + 1] = -(Math.random() * 25 + 30);
    snowVel[i * 3 + 2] = (Math.random() - 0.5) * 15;

    // Rain velocity: fast fall, minimal horizontal drift
    rainVel[i * 3] = (Math.random() - 0.5) * 5;
    rainVel[i * 3 + 1] = -(Math.random() * 200 + 250);
    rainVel[i * 3 + 2] = (Math.random() - 0.5) * 5;
  }

  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  snowGeo.setAttribute('velocity', new THREE.BufferAttribute(snowVel, 3));

  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rainGeo.setAttribute('velocity', new THREE.BufferAttribute(rainVel, 3));

  // Materials
  const snowMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.0,
    map: createSnowTexture(),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const rainMat = new THREE.PointsMaterial({
    color: 0xaaccff,
    size: 15.0, // Increased size to compensate for the larger square canvas
    map: createRainTexture(),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // Meshes
  snowParticles = new THREE.Points(snowGeo, snowMat);
  snowParticles.visible = false;
  snowParticles.frustumCulled = false;
  scene.add(snowParticles);

  rainParticles = new THREE.Points(rainGeo, rainMat);
  rainParticles.visible = false;
  rainParticles.frustumCulled = false;
  scene.add(rainParticles);

  // Bind UI
  const weatherSelect = document.getElementById('weather-select');
  if (weatherSelect) {
    weatherSelect.value = 'auto';
    weatherSelect.addEventListener('change', (e) => {
      weatherType = e.target.value;
      console.log(`Weather changed to: ${weatherType}`);
    });
  }
}

// Reusable physics/wrapping loop for any particle system
function moveAndWrapParticles(
  particles,
  delta,
  minX,
  maxX,
  minY,
  maxY,
  minZ,
  maxZ,
  speedMultiplier = 1.0
) {
  const positions = particles.geometry.attributes.position.array;
  const velocities = particles.geometry.attributes.velocity.array;
  const len = positions.length;

  for (let i = 0; i < len; i += 3) {
    positions[i] += velocities[i] * delta * speedMultiplier;
    positions[i + 1] += velocities[i + 1] * delta * speedMultiplier;
    positions[i + 2] += velocities[i + 2] * delta * speedMultiplier;

    while (positions[i] < minX) positions[i] += WEATHER_RANGE;
    while (positions[i] > maxX) positions[i] -= WEATHER_RANGE;

    while (positions[i + 1] < minY) positions[i + 1] += WEATHER_RANGE;
    while (positions[i + 1] > maxY) positions[i + 1] -= WEATHER_RANGE;

    while (positions[i + 2] < minZ) positions[i + 2] += WEATHER_RANGE;
    while (positions[i + 2] > maxZ) positions[i + 2] -= WEATHER_RANGE;
  }
  particles.geometry.attributes.position.needsUpdate = true;
}

// Reset particles in a 3D box centered around the camera
function resetParticlesAroundCamera(particles) {
  const positions = particles.geometry.attributes.position.array;
  const len = positions.length;
  const camPos = camera.position;

  for (let i = 0; i < len; i += 3) {
    positions[i] = camPos.x + (Math.random() - 0.5) * WEATHER_RANGE;
    positions[i + 1] = camPos.y + (Math.random() - 0.5) * WEATHER_RANGE;
    positions[i + 2] = camPos.z + (Math.random() - 0.5) * WEATHER_RANGE;
  }
  particles.geometry.attributes.position.needsUpdate = true;
}

function updateWeather(delta) {
  if (!snowParticles || !rainParticles) return;

  // Optimization: Skip entire weather simulation and hide particles on Low graphics
  if (SEGMENTS <= 20) {
    snowParticles.visible = false;
    rainParticles.visible = false;
    snowParticles.material.opacity = 0;
    rainParticles.material.opacity = 0;
    return;
  }

  let targetSnowOpacity = 0;
  let targetRainOpacity = 0;

  // Determine target opacities based on active mode
  if (weatherType === 'snow') {
    targetSnowOpacity = 0.8;
  } else if (weatherType === 'rain') {
    targetRainOpacity = 0.5;
  } else if (weatherType === 'auto') {
    const latVal = -planeGroup.position.z / 5000;

    // Continuous snow above 0.9°N, but with occasional breaks (80% duty cycle)
    if (latVal > 0.9) {
      const timeOffset = (window._gameServerNow || performance.now()) / 100000;
      // Use a slow-moving noise wave based on time for global breaks
      const snowBreakNoise = (simplex.noise2D(timeOffset * 0.2, 999) + 1) / 2; // Value between 0 and 1

      // Snows ~80% of the time (when noise is > 0.2)
      if (snowBreakNoise > 0.2) {
        const permanentSnow = THREE.MathUtils.clamp((latVal - 0.9) / 0.6, 0, 1);
        targetSnowOpacity = Math.max(targetSnowOpacity, permanentSnow * 0.15);
      }
    }

    // 1. Sync with the global overcast/cloud noise map
    const timeOffset = (window._gameServerNow || performance.now()) / 100000;
    const chunkSize = typeof CHUNK_SIZE !== 'undefined' ? CHUNK_SIZE : 2000;

    // This math perfectly matches the cloud generation in your animate() loop
    let stormNoise =
      (simplex.noise2D(
        (planeGroup.position.x / chunkSize) * 0.1 + 500 + timeOffset,
        (planeGroup.position.z / chunkSize) * 0.1 + timeOffset
      ) +
        1) /
      2;

    // Only trigger precipitation where the clouds are the thickest (> 0.75)
    if (stormNoise > 0.75) {
      // Normalize storm intensity from 0.0 (just started) to 1.0 (heavy storm)
      const stormIntensity = (stormNoise - 0.75) / 0.25;

      // 2. Distribute the storm intensity based on latitude
      if (latVal > 0.9) {
        // North: Storm intensifies the already-falling snow
        targetSnowOpacity = Math.max(targetSnowOpacity, stormIntensity * 0.4);
      } else if (latVal > 0.7) {
        // Transition Zone (0.7 to 0.9): Sleet (Mix of Rain and Snow)
        const snowRatio = (latVal - 0.7) / 0.2; // 0.0 at 0.7, 1.0 at 0.9
        targetSnowOpacity = Math.max(
          targetSnowOpacity,
          stormIntensity * 0.4 * snowRatio
        );
        targetRainOpacity = stormIntensity * 0.5 * (1.0 - snowRatio);
      } else if (latVal > -0.8) {
        // Temperate/Equator: Full Rain
        targetRainOpacity = stormIntensity * 0.5;
      } else if (latVal > -1.1) {
        // Desert Border (-0.8 to -1.1): Rain dries up quickly
        const fadeOut = 1.0 - (Math.abs(latVal) - 0.8) / 0.3;
        targetRainOpacity = stormIntensity * 0.5 * Math.max(0, fadeOut);
      }
      // If latVal <= -1.1 (Deep Desert), targets remain 0 (Dry Storm)
    }

    // Expose debug data
    window._weatherDebug = {
      stormNoise: stormNoise,
      latVal: latVal,
      zone:
        latVal > 0.9
          ? 'Snow'
          : latVal > 0.7
            ? 'Sleet'
            : latVal > -0.8
              ? 'Rain'
              : latVal > -1.1
                ? 'Dry Edge'
                : 'Desert',
    };
  }

  // Store unfaded opacities to drive cloud density even when above clouds
  window._unfadedSnowOpacity = targetSnowOpacity;
  window._unfadedRainOpacity = targetRainOpacity;

  // Fade out precipitation when flying above the cloud layer
  const cloudCeiling = 3000.0;
  const fadeStart = cloudCeiling - 100.0; // Start fading 100 units below the clouds
  if (camera.position.y > fadeStart) {
    const fadeFactor = Math.max(
      0,
      1.0 - (camera.position.y - fadeStart) / 100.0
    );
    targetRainOpacity *= fadeFactor;
    targetSnowOpacity *= fadeFactor;
  }

  // Reset particle positions around the camera when they start fading in
  if (targetSnowOpacity > 0 && snowParticles.material.opacity === 0) {
    resetParticlesAroundCamera(snowParticles);
  }
  if (targetRainOpacity > 0 && rainParticles.material.opacity === 0) {
    resetParticlesAroundCamera(rainParticles);
  }

  // Smoothly transition the materials
  snowParticles.material.opacity = THREE.MathUtils.lerp(
    snowParticles.material.opacity,
    targetSnowOpacity,
    1 - Math.exp(-0.75 * delta)
  );
  rainParticles.material.opacity = THREE.MathUtils.lerp(
    rainParticles.material.opacity,
    targetRainOpacity,
    1 - Math.exp(-0.75 * delta)
  );

  // Clamp very small values to 0 to enable clean reset detection next time
  if (snowParticles.material.opacity < 0.001) {
    snowParticles.material.opacity = 0;
  }
  if (rainParticles.material.opacity < 0.001) {
    rainParticles.material.opacity = 0;
  }

  // Toggle visibility to save CPU when completely transparent
  snowParticles.visible = snowParticles.material.opacity >= 0.01;
  rainParticles.visible = rainParticles.material.opacity >= 0.01;

  // Natural rainbow trigger
  // Trigger when the target opacity hits 0 (weather is clearing), but rain is still visibly falling
  const isRainClearing = targetRainOpacity === 0;
  const isRainHeavy = rainParticles.material.opacity > 0.1;

  if (isRainClearing && !wasRainClearing && isRainHeavy) {
    // 90% chance to spawn a rainbow when rain starts to clear
    if (Math.random() < 0.9) {
      forceRainbow = true;
    }
  }
  wasRainClearing = isRainClearing;

  if (!snowParticles.visible && !rainParticles.visible) return;

  // Pre-calculate boundaries once per frame
  const camPos = camera.position;
  const halfRange = WEATHER_RANGE / 2;
  const minX = camPos.x - halfRange;
  const maxX = camPos.x + halfRange;
  const minY = camPos.y - halfRange;
  const maxY = camPos.y + halfRange;
  const minZ = camPos.z - halfRange;
  const maxZ = camPos.z + halfRange;

  if (snowParticles.visible) {
    // Snow speed varies subtly: base speed is 0.8x, speeding up to 1.0x during heavy storms
    const snowSpeed = 0.8 + (snowParticles.material.opacity / 0.4) * 0.2;
    moveAndWrapParticles(
      snowParticles,
      delta,
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      snowSpeed
    );
  }
  if (rainParticles.visible)
    moveAndWrapParticles(
      rainParticles,
      delta,
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ
    );
}

// Initialize immediately
initWeather();
if (typeof window.initLighthouse === 'function') {
  window.initLighthouse();
}

const fpsCounterEl = document.getElementById('debug-fps');

// Optimization: Pre-allocate reusable objects for the animate loop to prevent GC stutter
const _targetEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _forward = new THREE.Vector3(0, 0, -1);
const _cameraOffset = new THREE.Vector3(0, 0, 0);
const _idealCameraPos = new THREE.Vector3(0, 0, 0);
const _lookOffset = new THREE.Vector3(0, 0, -20);
const _idealLookTarget = new THREE.Vector3(0, 0, 0);
const _currentLookTarget = new THREE.Vector3(0, 0, 0);
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
let lastPlayerListUpdate = 0;
let _auroraSessionMax = 0; // tracks highest aurora intensity seen this session
const _dirArrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

// Optimization: Pre-allocate colors for sky gradients
const _uncloudedSkyColor = new THREE.Color();
const _uncloudedFogColor = new THREE.Color();
const _daySky = new THREE.Color(0x4ca1f0); // Azure blue
const _sunriseSky = new THREE.Color();
const _goldenSky = new THREE.Color();
const _sunsetSky = new THREE.Color();
const _goldenSunsetSky = new THREE.Color();

function updateSkyBaseColors(palette) {
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

let targetPaletteTop = new THREE.Color(selectedPalette.top);
let targetPaletteBottom = new THREE.Color(selectedPalette.bottom);

const zenithPicker = document.getElementById('sky-zenith-picker');
const dayPicker = document.getElementById('sky-day-picker');
const horizonPicker = document.getElementById('sky-horizon-picker');

function updateColorPickers(palette) {
  if (zenithPicker)
    zenithPicker.value = '#' + palette.top.toString(16).padStart(6, '0');
  if (horizonPicker)
    horizonPicker.value = '#' + palette.bottom.toString(16).padStart(6, '0');
}

// Initial sync
updateColorPickers(selectedPalette);

if (zenithPicker && horizonPicker) {
  const handlePickerChange = () => {
    applyCustomSkyColors(zenithPicker.value, horizonPicker.value);
  };
  zenithPicker.addEventListener('input', handlePickerChange);
  horizonPicker.addEventListener('input', handlePickerChange);
}

window.addEventListener('paletteChanged', (e) => {
  updateSkyBaseColors(e.detail);
  targetPaletteTop.setHex(e.detail.top);
  targetPaletteBottom.setHex(e.detail.bottom);

  // Only update picker UI if NOT in custom mode to avoid fighting the user
  if (!isCustomPalette) {
    updateColorPickers(e.detail);
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

// --- PRE-ALLOCATED SCRATCH OBJECTS FOR SHADOW TEXEL SNAPPING ---
// These must live outside animate() to avoid GC pressure at 60fps.
const _shadowSunDir = new THREE.Vector3();
const _shadowRight = new THREE.Vector3();
const _shadowUp = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _boatDummy = new THREE.Object3D();

let isShootingStarActive = false;
let forceShootingStar = false;
let shootingStarProgress = 0;
let shootingStarStart = new THREE.Vector3();
let shootingStarEnd = new THREE.Vector3();
let shootingStarDuration = 1.0;

let forceRainbow = false;
let rainbowTimer = 0;
let rainbowIntensity = 0;
let wasRainClearing = true;

function animate() {
  const frameStartTime = performance.now(); // Start CPU timer
  requestAnimationFrame(animate);

  // --- FPS CAPPING ---
  if (maxFPS > 0) {
    const timeSinceLastFrame = frameStartTime - lastFrameTime;
    if (timeSinceLastFrame < frameMinDelay - 1) {
      // 1ms buffer for vsync jitter
      return;
    }
  }
  lastFrameTime = frameStartTime;

  const now = performance.now();
  let rawDelta = clock.getDelta();
  if (rawDelta > 0.1) rawDelta = 0.1; // Cap at 100ms to prevent logic blowouts

  // Apply delta smoothing (moving average) to eliminate jitter from OS/browser timing
  deltaBuffer.push(rawDelta);
  if (deltaBuffer.length > DELTA_BUFFER_SIZE) deltaBuffer.shift();
  smoothedDelta = deltaBuffer.reduce((a, b) => a + b, 0) / deltaBuffer.length;

  const delta = smoothedDelta; // Use smoothed delta for all game logic below

  pollGamepad(delta);

  if (isPaused || window.isNamePromptOpen) {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (
      loadingOverlay &&
      loadingOverlay.style.display !== 'none' &&
      !isIntroTransitionActive
    ) {
      // Intro orbit camera rendering
      if (!isFreeCamera) {
        const t = now * 0.00015;
        camera.position.x = planeGroup.position.x + Math.sin(t) * 150;
        camera.position.z = planeGroup.position.z + Math.cos(t) * 150;
        camera.position.y = planeGroup.position.y + 80;

        _currentLookTarget.copy(planeGroup.position);
        camera.lookAt(_currentLookTarget);
      }

      if (typeof sunUniforms !== 'undefined') {
        sunUniforms.uTime.value = now * 0.001;
      }

      updateWeather(delta);
      renderer.render(scene, camera);
    }
    return;
  }

  // One-frame blanket suppression of all input after resuming from pause,
  // to catch any input that slipped through despite clearInputState().
  if (justResumed) {
    justResumed = false;
    clearInputState();
    return;
  }

  // Trigger start plane tooltip if plane is stopped for the first time after a 5 second delay
  const onboardingTooltip = document.getElementById('onboarding-tooltip');
  const isOnboardingVisible =
    onboardingTooltip && onboardingTooltip.classList.contains('visible');
  if (
    !startPlaneTooltipShown &&
    !isOnboardingVisible &&
    targetFlightSpeed === 0 &&
    Math.abs(flightSpeedMultiplier) < 0.01
  ) {
    if (stoppedStartTime === null) {
      stoppedStartTime = now;
    } else if (now - stoppedStartTime >= 5000) {
      showStartPlaneTooltip();
    }
  } else {
    stoppedStartTime = null;
  }

  // Dismiss start plane tooltip if we start moving
  if (dismissStartPlaneTooltipFunc && Math.abs(targetFlightSpeed) > 0) {
    dismissStartPlaneTooltipFunc();
    dismissStartPlaneTooltipFunc = null;
  }

  // --- DAY/NIGHT CYCLE ---
  const debugMenu = document.getElementById('debug-menu');
  const isDebugMode = debugMenu && debugMenu.style.display === 'block';

  const CYCLE_DURATION_MS = 300000;

  let secondsInCycle, currentWarpedProgress;
  let passedServerNow;

  const useVirtualClock =
    isDebugMode ||
    window.manualTimeOfDay !== undefined ||
    daySpeedMultiplier !== 1;

  if (useVirtualClock) {
    // In debug mode, we use a virtual clock that we increment ourselves,
    // allowing for speed multipliers while maintaining the same "warped" physics
    // as the server-synced clock.
    if (window._debugVirtualServerNow === undefined) {
      window._debugVirtualServerNow =
        Date.now() + (window.serverTimeOffset || 0);
    } else {
      window._debugVirtualServerNow += delta * 1000 * daySpeedMultiplier;
    }
    passedServerNow = window._debugVirtualServerNow;
    secondsInCycle = (passedServerNow % CYCLE_DURATION_MS) / 1000;

    // Keep older debug virtual seconds for compat just in case
    window._debugVirtualSeconds = secondsInCycle;
  } else {
    // In normal mode, we always sync to the absolute server time.
    // We reset the virtual clock so it picks up from current server time if re-enabled.
    window._debugVirtualServerNow = undefined;
    window._debugVirtualSeconds = undefined;

    const serverNow = Date.now() + (window.serverTimeOffset || 0);
    passedServerNow = serverNow;
    secondsInCycle = (serverNow % CYCLE_DURATION_MS) / 1000;
  }

  const latScale = 5000;
  const currentLatDeg = -planeGroup.position.z / latScale;
  const currentLatRad = (currentLatDeg * Math.PI) / 180;

  currentWarpedProgress = ChillFlightLogic.computeTimeOfDay(
    secondsInCycle,
    currentLatRad
  );
  timeOfDay = currentWarpedProgress * Math.PI * 2;

  if (window.manualTimeOfDay !== undefined) {
    if (daySpeedMultiplier > 0) {
      window.manualTimeOfDay +=
        (delta * daySpeedMultiplier) / (CYCLE_DURATION_MS / 1000);
      if (window.manualTimeOfDay > 1.0) window.manualTimeOfDay -= 1.0;
    }
    timeOfDay = window.manualTimeOfDay * Math.PI * 2;
    currentWarpedProgress = window.manualTimeOfDay;
  }

  // Update slider UI if not manual, or if manual but time is flowing
  const timeSlider = document.getElementById('debug-time-slider');
  const timeSliderVal = document.getElementById('debug-time-val');
  if (
    timeSlider &&
    (window.manualTimeOfDay === undefined || daySpeedMultiplier > 0)
  ) {
    timeSlider.value = currentWarpedProgress;
    if (timeSliderVal) {
      const hours = currentWarpedProgress * 24;
      const hh = Math.floor(hours).toString().padStart(2, '0');
      const mm = Math.floor((hours % 1) * 60)
        .toString()
        .padStart(2, '0');
      timeSliderVal.textContent = `${hh}:${mm}`;
    }
  }

  window._gameServerNow = passedServerNow;

  // Check and update the sky palette if it's a new cycle
  if (typeof updateSkyPalette === 'function') {
    updateSkyPalette(passedServerNow);
  }
  // Window glow
  houseWindowMats.forEach((mat, i) => {
    const offset = i * 0.05;
    const localSunY = -Math.cos(timeOfDay - offset);
    const nightValue = Math.max(0, (-localSunY + 0.1) * 2);
    mat.emissiveIntensity = Math.min(2.0, nightValue);
  });

  // Update other players (interpolate & dead reckoning)
  if (typeof otherPlayers !== 'undefined') {
    otherPlayers.forEach((p) => {
      const now = Date.now();
      const renderTimestamp = now - 400; // 400ms playback delay avoids extrapolation snapping

      if (p.stateBuffer && p.stateBuffer.length > 0) {
        let state0 = null;
        let state1 = null;

        for (let i = p.stateBuffer.length - 1; i >= 0; i--) {
          if (p.stateBuffer[i].timestamp <= renderTimestamp) {
            state0 = p.stateBuffer[i];
            state1 = p.stateBuffer[i + 1] || null;
            break;
          }
        }

        let idealPos = new THREE.Vector3();
        let idealSpeed = 1;

        if (state0 && state1) {
          const timeDiff = state1.timestamp - state0.timestamp;
          const t =
            timeDiff > 0 ? (renderTimestamp - state0.timestamp) / timeDiff : 0;

          idealPos.lerpVectors(state0.pos, state1.pos, t);
          p.targetQuat.setFromEuler(
            _targetEuler.set(state1.rotX, state1.rotY, state1.rotZ, 'XYZ')
          );
          idealSpeed = THREE.MathUtils.lerp(
            state0.speedMult,
            state1.speedMult,
            t
          );
        } else if (state0 && !state1) {
          const extrapolateTime = Math.min(
            renderTimestamp - state0.timestamp,
            500
          );
          const dtSec = extrapolateTime / 1000;

          _targetEuler.set(state0.rotX, state0.rotY, state0.rotZ, 'XYZ');
          _forward.set(0, 0, -1).applyEuler(_targetEuler);

          const speed = BASE_FLIGHT_SPEED * (state0.speedMult || 1) * 60;
          idealPos.copy(state0.pos).add(_forward.multiplyScalar(speed * dtSec));
          p.targetQuat.setFromEuler(_targetEuler);
          idealSpeed = state0.speedMult;
        } else {
          const s = p.stateBuffer[0];
          idealPos.copy(s.pos);
          p.targetQuat.setFromEuler(
            _targetEuler.set(s.rotX, s.rotY, s.rotZ, 'XYZ')
          );
          idealSpeed = s.speedMult;
        }

        const distToIdeal = p.mesh.position.distanceTo(idealPos);
        if (distToIdeal > 500) {
          p.mesh.position.copy(idealPos);
          p.mesh.quaternion.copy(p.targetQuat);
        } else {
          // Smoothly chase the ideal interpolated path
          p.mesh.position.lerp(idealPos, 1 - Math.pow(1 - 0.4, delta * 60));
          const angle = p.mesh.quaternion.angleTo(p.targetQuat);
          if (angle > 0.001) {
            p.mesh.quaternion.slerp(
              p.targetQuat,
              1 - Math.pow(1 - 0.3, delta * 60)
            );
          }
        }
        p.targetSpeedMult = idealSpeed;
      } else {
        p.mesh.position.copy(p.targetPos);
        p.mesh.rotation.set(
          p.targetRotX || 0,
          p.targetRotY || 0,
          p.targetRotZ || 0
        );
      }

      if (Math.abs(p.targetSpeedMult || 0) > 0.001) {
        const baseSpin = 15 * p.targetSpeedMult;
        if (
          p.mesh.userData.airplaneModel &&
          p.mesh.userData.airplaneModel.visible &&
          p.mesh.userData.propeller
        ) {
          const spin = Math.max(4, Math.min(25, baseSpin));
          p.mesh.userData.propeller.rotation.z += spin * delta;
        } else if (
          p.mesh.userData.helicopterModel &&
          p.mesh.userData.helicopterModel.visible &&
          p.mesh.userData.mainRotor
        ) {
          const heliBase = baseSpin * 1.5;
          // Ensure a higher floor (5.0) even at low speeds so it doesn't look silly, ramping to 7.5 @ 50kts
          const spin =
            Math.abs(p.targetSpeedMult) < 0.33
              ? Math.max(5.0, heliBase)
              : Math.max(7.5, Math.min(18.75, heliBase));
          p.mesh.userData.mainRotor.rotation.y += spin * delta;
          p.mesh.userData.tailRotor.rotation.x += spin * 1.5 * delta;
        } else if (
          p.mesh.userData.boatModel &&
          p.mesh.userData.boatModel.visible &&
          p.mesh.userData.boatPropeller
        ) {
          const spin = Math.max(2, Math.min(20, baseSpin * 0.8));
          p.mesh.userData.boatPropeller.rotation.z += spin * 2 * delta;
        }
      }
    });
  }

  // Spin the propellers/rotors
  if (!isFreeCamera && Math.abs(flightSpeedMultiplier) > 0.001) {
    const baseSpin = 15 * Math.abs(flightSpeedMultiplier);
    if (vehicleType === 'airplane') {
      const spin = Math.max(4, Math.min(25, baseSpin));
      propGroup.rotation.z += spin * delta;
    } else if (vehicleType === 'helicopter') {
      const heliBase = baseSpin * 1.5;
      // Higher floor (5.0) for low speeds so it doesn't look silly, ramping to 7.5 @ 50kts
      // Then clamp between 7.5 and 18.75 (reached at 125 KTS / 0.83 mult)
      const targetSpin =
        Math.abs(flightSpeedMultiplier) < 0.33
          ? Math.max(5.0, heliBase)
          : Math.max(7.5, Math.min(18.75, heliBase));
      const spin = targetSpin * (window._heliRotorPower || 0);

      mainRotorGroup.rotation.y += spin * delta;
      tailRotorGroup.rotation.x += spin * 1.5 * delta;
    } else if (vehicleType === 'boat' && window.boatPropellerGroup) {
      const spin = Math.max(2, Math.min(20, baseSpin * 0.8));
      window.boatPropellerGroup.rotation.z += spin * 2 * delta;
    } else if (vehicleType === 'buggy' && window.buggyWheels) {
      const spin = baseSpin * 2;
      window.buggyWheels.forEach((w) => {
        if (w) w.rotation.x -= Math.sign(flightSpeedMultiplier) * spin * delta;
      });
    }
  }

  // Buggy front wheel steering
  if (
    !isFreeCamera &&
    vehicleType === 'buggy' &&
    window.buggyWheels &&
    window.buggyWheels.length >= 2
  ) {
    let targetSteer = 0;
    if (!keys.Shift) {
      if (keys.ArrowLeft) targetSteer = Math.PI / 6;
      else if (keys.ArrowRight) targetSteer = -Math.PI / 6;
    }
    window.buggyWheels[0].rotation.y = THREE.MathUtils.lerp(
      window.buggyWheels[0].rotation.y,
      targetSteer,
      10 * delta
    );
    window.buggyWheels[1].rotation.y = THREE.MathUtils.lerp(
      window.buggyWheels[1].rotation.y,
      targetSteer,
      10 * delta
    );
  }

  // Animate pontoons
  if (
    !isFreeCamera &&
    isDeployingPontoons &&
    !isRetractingPontoons &&
    pontoonDeploymentProgress < 1
  ) {
    pontoonDeploymentProgress += delta * 0.5;
    if (pontoonDeploymentProgress > 1) pontoonDeploymentProgress = 1;
    const t = pontoonDeploymentProgress;
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
    !isFreeCamera &&
    isRetractingPontoons &&
    pontoonDeploymentProgress > 0
  ) {
    pontoonDeploymentProgress -= delta * 0.4;
    if (pontoonDeploymentProgress < 0) {
      pontoonDeploymentProgress = 0;
      isRetractingPontoons = false;
      isDeployingPontoons = false;
      pontoonGroup.visible = false;
    }
    const t = pontoonDeploymentProgress;
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
    mouseControlActive && !isFreeCamera && Math.abs(mouseX) >= 0.15
      ? mouseX
      : 0;
  let effMouseY =
    mouseControlActive && !isFreeCamera && Math.abs(mouseY) >= 0.15
      ? mouseY
      : 0;

  const nowTime = performance.now();

  // Logical inputs based on Y-axis inversion
  const isUp = (invertYAxis ? keys.ArrowDown : keys.ArrowUp) && !isFreeCamera;
  const isDown = (invertYAxis ? keys.ArrowUp : keys.ArrowDown) && !isFreeCamera;
  const dtUp =
    (invertYAxis ? doubleTap.ArrowDown : doubleTap.ArrowUp) && !isFreeCamera;
  const dtDown =
    (invertYAxis ? doubleTap.ArrowUp : doubleTap.ArrowDown) && !isFreeCamera;
  const ttUp =
    (invertYAxis ? tripleTap.ArrowDown : tripleTap.ArrowUp) && !isFreeCamera;
  const ttDown =
    (invertYAxis ? tripleTap.ArrowUp : tripleTap.ArrowDown) && !isFreeCamera;
  const startUp = invertYAxis
    ? keyPressStartTime.ArrowDown
    : keyPressStartTime.ArrowUp;
  const startDown = invertYAxis
    ? keyPressStartTime.ArrowUp
    : keyPressStartTime.ArrowDown;

  const isLeft = keys.ArrowLeft && !isFreeCamera;
  const isRight = keys.ArrowRight && !isFreeCamera;
  const dtLeft = doubleTap.ArrowLeft && !isFreeCamera;
  const dtRight = doubleTap.ArrowRight && !isFreeCamera;

  // Shift+Up/Down: throttle control (For boat, it is just Up/Down)
  if (
    (keys.Shift && vehicleType !== 'helicopter') ||
    vehicleType === 'boat' ||
    vehicleType === 'buggy'
  ) {
    const rawUp = keys.ArrowUp && !isFreeCamera;
    const rawDown = keys.ArrowDown && !isFreeCamera;
    const startRawUp = keyPressStartTime.ArrowUp;
    const startRawDown = keyPressStartTime.ArrowDown;

    if (rawUp) {
      const heldTime = nowTime - startRawUp;
      const ramp = Math.min(1.0, heldTime / 2000);
      const throttleRate = (0.2 + ramp * 1.0) * delta;
      targetFlightSpeed = targetFlightSpeed + throttleRate;
      if (vehicleType !== 'boat' && vehicleType !== 'buggy') {
        targetFlightSpeed = Math.min(
          window.MAX_FLIGHT_SPEED_MULT || 3.3333333333333335,
          targetFlightSpeed
        );
      } else {
        targetFlightSpeed = Math.min(0.66, targetFlightSpeed); // Cap forward boat/buggy speed
      }
    } else if (rawDown) {
      const heldTime = nowTime - startRawDown;
      const ramp = Math.min(1.0, heldTime / 2000);
      const throttleRate = (0.2 + ramp * 1.0) * delta;

      if (vehicleType === 'boat' || vehicleType === 'buggy') {
        const prevSpeed = targetFlightSpeed;
        targetFlightSpeed = targetFlightSpeed - throttleRate;

        // Safeguard: Stop at zero. User must release and press again to go negative.
        if (prevSpeed > 0 && targetFlightSpeed < 0) {
          targetFlightSpeed = 0;
        } else if (prevSpeed === 0 && heldTime > 100) {
          // Already at zero and holding the button down
          targetFlightSpeed = 0;
        }
        targetFlightSpeed = Math.max(-0.33, targetFlightSpeed);
      } else {
        targetFlightSpeed = Math.max(0, targetFlightSpeed - throttleRate);
      }
    } else if (vehicleType === 'buggy') {
      // Coast to a stop when no keys are pressed for buggy
      targetFlightSpeed = THREE.MathUtils.lerp(
        targetFlightSpeed,
        0,
        2.5 * delta
      );
      if (Math.abs(targetFlightSpeed) < 0.01) targetFlightSpeed = 0;
    }
  }

  if (
    !isFreeCamera &&
    (flightSpeedMultiplier > 0 || Math.abs(targetFlightSpeed) > 0)
  ) {
    let yMultiplier = invertYAxis ? -1 : 1;

    if (vehicleType === 'boat' || vehicleType === 'buggy') {
      targetPitch = 0;
      targetRoll = 0;
    } else {
      targetPitch = effMouseY * maxPitch * yMultiplier;
      targetRoll = -effMouseX * (maxRoll * 1.25);
    }

    manualPitch = THREE.MathUtils.lerp(manualPitch, 0, 0.1 * delta * 60);

    if (
      (keys.Shift && vehicleType !== 'helicopter') ||
      vehicleType === 'boat' ||
      vehicleType === 'buggy'
    ) {
      // Throttle already handled above; no pitch changes while Shift is held or if boat/buggy
    } else if (vehicleType === 'helicopter') {
      if (isUp && !keys.Shift) targetPitch = (-10 * Math.PI) / 180;
      else if (isDown && !keys.Shift) targetPitch = (5 * Math.PI) / 180;
      else targetPitch = 0;
    } else if (isUp && !dtUp) {
      const heldTime = nowTime - startUp;
      if (heldTime > STEER_HOLD_THRESHOLD) {
        targetPitch = (35 * Math.PI) / 180; // Full climb
      } else {
        const ramp = heldTime / STEER_HOLD_THRESHOLD;
        targetPitch = ((5 * Math.PI) / 180) * ramp;
      }
    } else if (isDown) {
      const heldTime = nowTime - startDown;
      if (heldTime > STEER_HOLD_THRESHOLD) {
        targetPitch = (-45 * Math.PI) / 180; // Softened full dive
      } else {
        const ramp = heldTime / STEER_HOLD_THRESHOLD;
        targetPitch = ((-5 * Math.PI) / 180) * ramp;
      }
    }
  } else if (!isFreeCamera) {
    targetPitch = 0;
    targetRoll = 0;
  }

  let isBarrelRolling = false;
  let isClampedRoll = false;
  let isLooping = false;
  const manualRollSpeed = 4.0;
  const manualLoopSpeed = 2.5;

  if (!isFreeCamera && window.autopilotEnabled && flightSpeedMultiplier > 0) {
    isDoingImmelmann = false;
    // 1. Maintain cruising speed (150 kts = 1.0 multiplier)
    targetFlightSpeed = 1.0;

    // 2. Altitude Control
    const currentRiverZ =
      typeof window.ChillFlightLogic !== 'undefined' &&
      window.ChillFlightLogic.getRiverCenterZ
        ? window.ChillFlightLogic.getRiverCenterZ(
            planeGroup.position.x,
            planeGroup.position.z,
            simplex
          )
        : 0;

    const distToRiver = Math.abs(currentRiverZ - planeGroup.position.z);
    let targetAltY = 145.5; // 2500 altitude
    if (distToRiver > 1500) {
      targetAltY = 445.5; // 10000 altitude
    } else if (distToRiver > 500) {
      const t = (distToRiver - 500) / 1000;
      targetAltY = 145.5 + t * (445.5 - 145.5);
    }

    const altError = targetAltY - planeGroup.position.y;
    const maxAutoPitch = Math.PI / 6; // 30 degrees limit
    targetPitch = THREE.MathUtils.clamp(
      altError * 0.01,
      -maxAutoPitch,
      maxAutoPitch
    );

    // 3. Direction Control -> Head towards sunset/sunrise when applicable, otherwise West
    const _sunY = -Math.cos(timeOfDay);
    const _sunX = Math.sin(timeOfDay);
    const dawnDuskFactor = Math.max(0, 1.0 - Math.abs(_sunY) * 2.5);

    // 1 for East (Sunrise), -1 for West (Sunset or default)
    let lookDirX = -1;
    if (dawnDuskFactor > 0.05) {
      lookDirX = _sunX > 0 ? 1 : -1;
    }

    // We look ahead a bit to calculate the river's local angle
    const lookAheadX = planeGroup.position.x + lookDirX * 300;
    const targetRiverZ =
      typeof window.ChillFlightLogic !== 'undefined' &&
      window.ChillFlightLogic.getRiverCenterZ
        ? window.ChillFlightLogic.getRiverCenterZ(
            lookAheadX,
            planeGroup.position.z,
            simplex
          )
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
    targetRoll = THREE.MathUtils.clamp(
      yawError * 1.5,
      -maxAutoRoll,
      maxAutoRoll
    );

    // Cancel manual maneuvers
    isLooping = false;
    isBarrelRolling = false;
    isClampedRoll = false;
  } else if (!isFreeCamera && flightSpeedMultiplier > 0) {
    if (vehicleType !== 'helicopter' && vehicleType !== 'boat') {
      if (isDoingImmelmann) {
        if (immelmannProgress < Math.PI) {
          // Stage 1: Half-loop (pull up)
          const step = manualLoopSpeed * delta;
          planeGroup.rotation.x += step;
          immelmannProgress += step;
          isLooping = true;
        } else if (immelmannProgress < Math.PI * 2) {
          // Stage 2: Half-roll (roll upright)
          const rollStep = manualRollSpeed * delta;
          planeGroup.rotation.z += rollStep;
          immelmannProgress += rollStep;
          isLooping = true;
          isBarrelRolling = true;
        } else {
          isDoingImmelmann = false;
          // Snap the Euler rotation to a clean upright heading
          const forward = new THREE.Vector3(0, 0, -1).applyEuler(
            planeGroup.rotation
          );
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
          planeGroup.rotation.x += manualLoopSpeed * delta;
          isLooping = true;
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
          isLooping = true;
        } else if (isDown && ttDown && !keys.Shift && !isDoingImmelmann) {
          // Triple-tap down: Immelmann turn (automatic maneuver, no hold required)
          isDoingImmelmann = true;
          immelmannProgress = 0;
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
          isLooping = true;
        }
      }
    }

    if (isLeft) {
      if (vehicleType === 'helicopter') {
        if (!keys.Shift) planeGroup.rotation.y += 1.5 * delta;
        const maxRoll = Math.PI / 12; // visual bank
        planeGroup.rotation.z = Math.min(
          maxRoll,
          planeGroup.rotation.z + manualRollSpeed * 0.5 * delta
        );
        isClampedRoll = true;
        isBarrelRolling = true;
      } else if (!keys.Shift) {
        if (vehicleType === 'buggy') {
          planeGroup.rotation.y += 1.5 * delta;
        } else if (vehicleType === 'boat') {
          const maxRoll = MAX_BANK_BOAT;
          planeGroup.rotation.z = Math.min(
            maxRoll,
            planeGroup.rotation.z + manualRollSpeed * 0.5 * delta
          );
          isClampedRoll = true;
          isBarrelRolling = true;
        } else if (dtLeft) {
          // Double-tap: full barrel roll
          planeGroup.rotation.z += manualRollSpeed * delta;
          isBarrelRolling = true;
        } else {
          // Single-tap: bank to 90° and hold
          const target = Math.PI / 2;
          planeGroup.rotation.z = Math.min(
            target,
            planeGroup.rotation.z + manualRollSpeed * delta
          );
          isClampedRoll = true;
          isBarrelRolling = true;
        }
      }
    } else if (isRight) {
      if (vehicleType === 'helicopter') {
        if (!keys.Shift) planeGroup.rotation.y -= 1.5 * delta;
        const maxRoll = -Math.PI / 12; // visual bank
        planeGroup.rotation.z = Math.max(
          maxRoll,
          planeGroup.rotation.z - manualRollSpeed * 0.5 * delta
        );
        isClampedRoll = true;
        isBarrelRolling = true;
      } else if (!keys.Shift) {
        if (vehicleType === 'buggy') {
          planeGroup.rotation.y -= 1.5 * delta;
        } else if (vehicleType === 'boat') {
          const maxRoll = MAX_BANK_BOAT;
          planeGroup.rotation.z = Math.max(
            -maxRoll,
            planeGroup.rotation.z - manualRollSpeed * 0.5 * delta
          );
          isClampedRoll = true;
          isBarrelRolling = true;
        } else if (dtRight) {
          // Double-tap: full barrel roll
          planeGroup.rotation.z -= manualRollSpeed * delta;
          isBarrelRolling = true;
        } else {
          // Single-tap: bank to -90° and hold
          const target = -Math.PI / 2;
          planeGroup.rotation.z = Math.max(
            target,
            planeGroup.rotation.z - manualRollSpeed * delta
          );
          isClampedRoll = true;
          isBarrelRolling = true;
        }
      }
    }
  }

  // Taxi steering: allow airplane to yaw when stopped or at very low speed
  if (
    !isFreeCamera &&
    vehicleType === 'airplane' &&
    flightSpeedMultiplier < 0.4
  ) {
    if (isLeft && !keys.Shift) {
      planeGroup.rotation.y += 1.5 * delta;
    } else if (isRight && !keys.Shift) {
      planeGroup.rotation.y -= 1.5 * delta;
    }
  }

  if (!isLooping && !isFreeCamera) {
    const finalTargetPitch = targetPitch + manualPitch;
    while (planeGroup.rotation.x > finalTargetPitch + Math.PI)
      planeGroup.rotation.x -= 2 * Math.PI;
    while (planeGroup.rotation.x < finalTargetPitch - Math.PI)
      planeGroup.rotation.x += 2 * Math.PI;
    planeGroup.rotation.x = THREE.MathUtils.lerp(
      planeGroup.rotation.x,
      finalTargetPitch,
      1 - Math.pow(1 - TURN_SPEED, delta * 60)
    );
  }
  if (!isBarrelRolling && !isFreeCamera) {
    while (planeGroup.rotation.z > targetRoll + Math.PI)
      planeGroup.rotation.z -= 2 * Math.PI;
    while (planeGroup.rotation.z < targetRoll - Math.PI)
      planeGroup.rotation.z += 2 * Math.PI;
    planeGroup.rotation.z = THREE.MathUtils.lerp(
      planeGroup.rotation.z,
      targetRoll,
      1 - Math.pow(1 - TURN_SPEED, delta * 60)
    );
  }

  // --- FLIGHT PHYSICS & SPEED ---
  const terrainHeight = getElevation(
    planeGroup.position.x,
    planeGroup.position.z
  );
  let isWater =
    terrainHeight <= WATER_LEVEL + (vehicleType === 'boat' ? 0.3 : 0.1);

  if (
    !isFreeCamera &&
    (flightSpeedMultiplier > 0 || Math.abs(targetFlightSpeed) > 0)
  ) {
    let turningRoll =
      isBarrelRolling && !isClampedRoll ? targetRoll : planeGroup.rotation.z;
    const turnFactor = vehicleType === 'boat' ? 0.08 : 0.025; // Boat turns sharper since it banks less
    planeGroup.rotation.y += turningRoll * turnFactor * delta * 60;

    // --- GRAVITY ACCELERATION/DECELERATION ---
    // Nose down = gain speed, Nose up = lose speed
    // planeGroup.rotation.x: negative is diving, positive is climbing
    const pitchRad = planeGroup.rotation.x;
    const gravityEffect = -Math.sin(pitchRad); // positive when diving

    if (gravityEffect > 0 && vehicleType === 'airplane') {
      // Accelerate in dive (reduced for softer feel)
      // Suppress gravity acceleration if we are actively being pushed up by ground avoidance
      const softBuffer = 2.0;
      const isAvoidingGround =
        planeGroup.position.y <
        (isWater ? terrainHeight + 5.5 : terrainHeight + 10.0) + softBuffer;

      if (!isAvoidingGround) {
        flightSpeedMultiplier += gravityEffect * 0.7 * delta;
      } else {
        // Dramatically reduced acceleration when skimming the ground/water
        flightSpeedMultiplier += gravityEffect * 0.1 * delta;
      }
    }
  }

  // --- SPEED RECOVERY (DRAG & THROTTLE) ---
  // Automatically return to the target throttle speed.
  // We update this even at speed 0 so the vehicle can start moving again.
  if (
    Math.abs(flightSpeedMultiplier) > 0.001 ||
    Math.abs(targetFlightSpeed) > 0.001
  ) {
    let recoveryRate =
      vehicleType === 'boat' || vehicleType === 'buggy' ? 3.5 : 0.6; // Boat/Buggy needs snappy throttle

    if (window._isRecoveringFromHeli) {
      if (
        keys.Shift ||
        Math.abs(flightSpeedMultiplier - targetFlightSpeed) < 0.05
      ) {
        window._isRecoveringFromHeli = false;
      }
    }

    if (
      !window._isRecoveringFromHeli &&
      (keys.Shift ||
        vehicleType === 'boat' ||
        vehicleType === 'buggy' ||
        flightSpeedMultiplier < targetFlightSpeed)
    ) {
      recoveryRate = 10.0; // Snappy responsiveness for active control/acceleration
    }
    flightSpeedMultiplier = THREE.MathUtils.lerp(
      flightSpeedMultiplier,
      targetFlightSpeed,
      recoveryRate * delta
    );

    // Keep speed in bounds based on vehicle type
    if (vehicleType === 'boat' || vehicleType === 'buggy') {
      flightSpeedMultiplier = Math.max(
        -0.33,
        Math.min(0.66, flightSpeedMultiplier)
      );
    } else {
      flightSpeedMultiplier = Math.max(0, Math.min(10, flightSpeedMultiplier));
    }
  }

  // Altitude and Speed constants
  const controlBaseAlt = Math.max(0, planeGroup.position.y - 45.5);
  const controlAlt = Math.round(controlBaseAlt * 25);
  const accelRate = 0.8 * delta;

  // Ground avoidance heights
  let minFlightHeight = isWater ? terrainHeight + 3.5 : terrainHeight + 10.0;
  let restingHeight = minFlightHeight + 2.0;

  if (vehicleType === 'helicopter') {
    minFlightHeight = terrainHeight + 3.5;
    restingHeight = terrainHeight + 3.5;

    // Take off / Landing rotor animation
    const isActuallyGrounded = planeGroup.position.y <= restingHeight + 0.5;
    const targetPower = isActuallyGrounded ? 0.0 : 1.0;
    // Use a faster lerp for spin-up/down feel (roughly 2-3 seconds)
    window._heliRotorPower = THREE.MathUtils.lerp(
      window._heliRotorPower || 0,
      targetPower,
      1.5 * delta
    );
  } else if (vehicleType === 'buggy') {
    minFlightHeight = terrainHeight + 1.0;
    restingHeight = terrainHeight + 1.0;
    window._heliRotorPower = 1.0;
  } else {
    window._heliRotorPower = 1.0; // Reset for other vehicles
  }

  if (vehicleType === 'boat') {
    // Boat sits submerged by 0.5 units (like the sailboats)
    // Hull height at 0.8 scale is 1.6 units. Center at 0. Bottom at -0.8.
    // To have bottom at W.L - 0.5, center must be at W.L + 0.3
    restingHeight = isWater ? WATER_LEVEL + 0.3 : terrainHeight + 0.8;
  }

  // Move vehicle
  const currentKTS = BASE_FLIGHT_SPEED * Math.abs(flightSpeedMultiplier) * 60;
  // Lower threshold for isFreefalling to eliminate the "stuck in mid-air" dead zone
  const isFreefalling =
    (vehicleType === 'airplane' &&
      currentKTS < 50 &&
      planeGroup.position.y > restingHeight + 2) ||
    (vehicleType === 'boat' && planeGroup.position.y > restingHeight + 0.1) ||
    (vehicleType === 'buggy' && planeGroup.position.y > restingHeight + 0.5);

  // Calculate actual forward speed factor based on vehicle type
  let moveSpeedFactor = 0;
  if (
    vehicleType === 'airplane' ||
    vehicleType === 'boat' ||
    vehicleType === 'buggy'
  ) {
    moveSpeedFactor = flightSpeedMultiplier;
  }

  // Apply forward/backward movement for non-helicopter vehicles
  if (
    !isFreeCamera &&
    vehicleType !== 'helicopter' &&
    Math.abs(moveSpeedFactor) > 0
  ) {
    let canMove = true;
    if (vehicleType === 'boat' && !isWater && !isFreefalling) canMove = false;

    if (canMove) {
      planeGroup.translateZ(
        -(BASE_FLIGHT_SPEED * moveSpeedFactor * delta * 60)
      );
    }
  }

  if (vehicleType === 'airplane') {
    if (moveSpeedFactor > 0 && !isFreefalling) {
      verticalVelocity = 0; // Reset gravity accumulation while flying normally

      // Low speed stall/sink mechanics
      if (currentKTS < 100 && planeGroup.position.y > minFlightHeight) {
        const stallFactor = Math.max(0, (100 - Math.max(50, currentKTS)) / 50);
        planeGroup.position.y -= 15 * stallFactor * delta;
      }
    }
  } else if (vehicleType === 'helicopter') {
    const isUpAlt =
      (keys.Plus || (keys.Shift && keys.ArrowUp)) && !isFreeCamera;
    const isDownAlt =
      (keys.Minus || (keys.Shift && keys.ArrowDown)) && !isFreeCamera;

    let targetLiftSpeed = 0;
    if (isUpAlt) targetLiftSpeed = 80;
    else if (isDownAlt) targetLiftSpeed = -80;

    verticalVelocity = THREE.MathUtils.lerp(
      verticalVelocity,
      targetLiftSpeed,
      0.05 * delta * 60
    );

    if (!isFreeCamera && Math.abs(verticalVelocity) > 0.1) {
      planeGroup.position.y += verticalVelocity * delta;
    }

    const moveUp = !keys.Shift && keys.ArrowUp && !isFreeCamera;
    const moveDown = !keys.Shift && keys.ArrowDown && !isFreeCamera;

    const strafeLeft = keys.Shift && isLeft;
    const strafeRight = keys.Shift && isRight;

    let targetHeliMove = 0;
    if (moveUp) targetHeliMove = 1.0;
    else if (moveDown) targetHeliMove = -1.0;

    let targetHeliStrafe = 0;
    if (strafeLeft) targetHeliStrafe = -1.0;
    else if (strafeRight) targetHeliStrafe = 1.0;

    window._heliMoveSpeed = THREE.MathUtils.lerp(
      window._heliMoveSpeed || 0,
      targetHeliMove,
      0.05 * delta * 60
    );
    window._heliStrafeSpeed = THREE.MathUtils.lerp(
      window._heliStrafeSpeed || 0,
      targetHeliStrafe,
      0.05 * delta * 60
    );

    if (
      !isFreeCamera &&
      (Math.abs(window._heliMoveSpeed) > 0.01 ||
        Math.abs(window._heliStrafeSpeed) > 0.01)
    ) {
      const savedX = planeGroup.rotation.x;
      const savedZ = planeGroup.rotation.z;
      planeGroup.rotation.x = 0;
      planeGroup.rotation.z = 0;
      planeGroup.translateZ(
        -(BASE_FLIGHT_SPEED * window._heliMoveSpeed * delta * 60)
      );
      planeGroup.translateX(
        BASE_FLIGHT_SPEED * window._heliStrafeSpeed * delta * 60
      );
      planeGroup.rotation.x = savedX;
      planeGroup.rotation.z = savedZ;
    }
  } else if (vehicleType === 'boat') {
    // Apply forward/backward movement
    if (Math.abs(moveSpeedFactor) > 0) {
      planeGroup.translateZ(
        -(BASE_FLIGHT_SPEED * moveSpeedFactor * delta * 60)
      );
    }
  } else if (vehicleType === 'buggy') {
    if (Math.abs(moveSpeedFactor) > 0) {
      planeGroup.translateZ(
        -(BASE_FLIGHT_SPEED * moveSpeedFactor * delta * 60)
      );
    }
  }

  if (!isFreeCamera && isFreefalling) {
    // Freefall tumble & accelerating gravity
    const GRAVITY = 120; // units/sec² — feels weighty but not instant
    verticalVelocity -= GRAVITY * delta;

    // Cap terminal velocity so it doesn't go impossibly fast
    const TERMINAL_VELOCITY = -600;
    verticalVelocity = Math.max(verticalVelocity, TERMINAL_VELOCITY);

    planeGroup.position.y += verticalVelocity * delta;

    // Tumble chaos scales with fall speed for extra drama (Disabled for boat and buggy)
    if (vehicleType !== 'boat' && vehicleType !== 'buggy') {
      const tumbleIntensity = Math.min(1.5, Math.abs(verticalVelocity) / 300);
      planeGroup.rotation.x +=
        (Math.sin(now * 0.002) + Math.cos(now * 0.0011)) *
        0.8 *
        tumbleIntensity *
        delta;
      planeGroup.rotation.z +=
        (Math.cos(now * 0.0025) + Math.sin(now * 0.0017)) *
        0.8 *
        tumbleIntensity *
        delta;
      planeGroup.rotation.y +=
        (Math.sin(now * 0.0015) + Math.cos(now * 0.0009)) *
        0.5 *
        tumbleIntensity *
        delta;
    }

    // Forward movement is now handled by the consolidated block above
  } else if (!isFreeCamera && planeGroup.position.y <= restingHeight + 0.1) {
    // Grounded — rest flat peacefully, kill vertical velocity
    verticalVelocity = 0;
    targetPitch = 0;
    targetRoll = 0;
    while (planeGroup.rotation.x > Math.PI)
      planeGroup.rotation.x -= 2 * Math.PI;
    while (planeGroup.rotation.x < -Math.PI)
      planeGroup.rotation.x += 2 * Math.PI;
    while (planeGroup.rotation.z > Math.PI)
      planeGroup.rotation.z -= 2 * Math.PI;
    while (planeGroup.rotation.z < -Math.PI)
      planeGroup.rotation.z += 2 * Math.PI;

    let finalPitch = 0;
    let finalRoll = 0;

    if (vehicleType === 'buggy') {
      const hDelta = 2.0;
      const fwdX = -Math.sin(planeGroup.rotation.y) * hDelta;
      const fwdZ = -Math.cos(planeGroup.rotation.y) * hDelta;
      const rightX = Math.cos(planeGroup.rotation.y) * hDelta;
      const rightZ = -Math.sin(planeGroup.rotation.y) * hDelta;

      const hFront = getElevation(
        planeGroup.position.x + fwdX,
        planeGroup.position.z + fwdZ
      );
      const hBack = getElevation(
        planeGroup.position.x - fwdX,
        planeGroup.position.z - fwdZ
      );
      const hRight = getElevation(
        planeGroup.position.x + rightX,
        planeGroup.position.z + rightZ
      );
      const hLeft = getElevation(
        planeGroup.position.x - rightX,
        planeGroup.position.z - rightZ
      );

      finalPitch = Math.atan2(hFront - hBack, hDelta * 2);
      finalRoll = Math.atan2(hRight - hLeft, hDelta * 2);
    }

    planeGroup.rotation.x = THREE.MathUtils.lerp(
      planeGroup.rotation.x,
      finalPitch,
      0.1 * delta * 60
    );
    planeGroup.rotation.z = THREE.MathUtils.lerp(
      planeGroup.rotation.z,
      finalRoll,
      0.1 * delta * 60
    );
    planeGroup.position.y = THREE.MathUtils.lerp(
      planeGroup.position.y,
      restingHeight,
      0.1 * delta * 60
    ); // Smooth landing

    if (window.airplaneModel) {
      if (
        isWater &&
        vehicleType === 'airplane' &&
        planeGroup.position.y <= restingHeight + 0.1
      ) {
        const bobTime = performance.now() * 0.001 * 1.2;
        window.airplaneModel.position.y = Math.sin(bobTime) * 0.15;
        window.airplaneModel.rotation.x = Math.cos(bobTime * 1.1) * 0.03;
        window.airplaneModel.rotation.z = Math.sin(bobTime * 0.8) * 0.04;
      } else {
        window.airplaneModel.position.y = 0;
        window.airplaneModel.rotation.x = 0;
        window.airplaneModel.rotation.z = 0;
      }
    }

    // Forward movement is now handled by the consolidated block above
  } else if (window.airplaneModel && vehicleType === 'airplane') {
    // Subtle in-flight turbulence bobbing
    const t = performance.now() * 0.001;
    window.airplaneModel.position.y =
      Math.sin(t * 0.7) * 0.04 + Math.sin(t * 1.3) * 0.02;
    window.airplaneModel.rotation.x =
      Math.cos(t * 0.9) * 0.005 + Math.sin(t * 1.7) * 0.003;
    window.airplaneModel.rotation.z =
      Math.sin(t * 0.6) * 0.008 + Math.cos(t * 1.1) * 0.004;
  } else if (window.airplaneModel) {
    // Reset for non-airplane vehicles
    window.airplaneModel.position.y = 0;
    window.airplaneModel.rotation.x = 0;
    window.airplaneModel.rotation.z = 0;
  }

  // Speed controls

  if (keys.ArrowDown) {
    keys.ArrowUp = false;
  }

  // Apply Ground avoidance — soft cushion + hard clamp + kill velocity on impact (Disabled for boat)
  if (vehicleType !== 'boat') {
    const softBuffer = 2.0;
    if (planeGroup.position.y < minFlightHeight + softBuffer) {
      // Smoothly push up if we're in the "soft" buffer zone
      planeGroup.position.y = THREE.MathUtils.lerp(
        planeGroup.position.y,
        minFlightHeight + softBuffer,
        0.1 * delta * 60
      );

      // Hard clamp at the actual minimum
      if (planeGroup.position.y < minFlightHeight) {
        planeGroup.position.y = minFlightHeight;
        verticalVelocity = 0; // Kill accumulated gravity immediately on ground impact
      }
    }

    if (isWater && planeGroup.position.y < minFlightHeight + 2) {
      if (!pontoonGroup.visible) {
        pontoonGroup.scale.setScalar(0);
        pontoonDeploymentProgress = 0;
        pontoonGroup.visible = true;
        isDeployingPontoons = true;
      }
      if (vehicleType === 'airplane') {
        if (!keys.Shift) {
          // Apply water drag: smoothly reduce targetFlightSpeed to 0
          targetFlightSpeed = Math.max(0, targetFlightSpeed - delta * 0.5);
        }
        if (targetFlightSpeed === 0 && flightSpeedMultiplier < 0.05) {
          flightSpeedMultiplier = 0; // Force full stop to prevent prop twitching
        }
        // When on water, force neutral pitch/roll to ensure a level rest on water
        targetPitch = THREE.MathUtils.lerp(targetPitch, 0, 0.05 * delta * 60);
        targetRoll = THREE.MathUtils.lerp(targetRoll, 0, 0.05 * delta * 60);
      }
    }
  }

  const maxFlightHeight = 4045.5; // ~100,000 ft display altitude ((4045.5 - 45.5) * 25 = 100,000)
  if (planeGroup.position.y > maxFlightHeight) {
    planeGroup.position.y = maxFlightHeight;
  }

  if (controlAlt >= 2000 && pontoonGroup.visible && !isRetractingPontoons) {
    isRetractingPontoons = true;
  }

  const currentY = planeGroup.position.y;
  const isDescending = currentY < lastY;
  lastY = currentY;

  if (isWater && controlAlt < 1500 && isDescending && !pontoonGroup.visible) {
    pontoonGroup.scale.setScalar(0);
    pontoonDeploymentProgress = 0;
    pontoonGroup.visible = true;
    isDeployingPontoons = true;
  }

  // Ensure the plane's matrix is fully updated before camera calculations
  // This prevents the camera from "jittering" or lagging one frame behind.
  planeGroup.updateMatrixWorld();

  // Camera follow
  const isPortrait = window.innerHeight > window.innerWidth;
  const isNative =
    typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  const mobileCameraScale = isPortrait || isNative ? 1.35 : 1.0;

  const speedFactor = (flightSpeedMultiplier - 0.5) / 9.5;
  const diveFactor = Math.max(0, -planeGroup.rotation.x / (Math.PI / 4)); // 1.0 at 45 degree dive

  const zOffset = THREE.MathUtils.lerp(
    40 * mobileCameraScale,
    60 * mobileCameraScale,
    speedFactor
  );
  const yOffset = THREE.MathUtils.lerp(
    12 * mobileCameraScale,
    20 * mobileCameraScale,
    speedFactor
  );

  // FOV expands with speed AND dive/loop steepness, capped at 70 to avoid excessive distortion
  // We use a smoothed factor to prevent "jumping" when entering loops
  const maneuverFactor = Math.max(diveFactor, isLooping ? 3.0 : 0);
  smoothedManeuverFactor = THREE.MathUtils.lerp(
    smoothedManeuverFactor,
    maneuverFactor,
    1 - Math.pow(1 - 0.05, delta * 60)
  );

  // Slightly wider base FOV for mobile to increase peripheral awareness
  const baseFov =
    THREE.MathUtils.lerp(60, 85, speedFactor) +
    (mobileCameraScale > 1.0 ? 5 : 0);
  const targetFov = Math.min(
    75,
    baseFov +
      smoothedManeuverFactor * 15 * Math.min(1, flightSpeedMultiplier / 2)
  );

  camera.fov = THREE.MathUtils.lerp(
    camera.fov,
    targetFov,
    1 - Math.pow(1 - 0.05, delta * 60)
  );
  camera.updateProjectionMatrix();

  // Pull back the camera during high-G maneuvers for extra scale
  const pullBack =
    smoothedManeuverFactor * 20 * Math.min(1, flightSpeedMultiplier / 2);
  _cameraOffset.set(0, yOffset, zOffset + pullBack);

  // Add subtle camera vibration at high speeds/steep dives
  if (flightSpeedMultiplier > 4.0 && diveFactor > 0.5) {
    const shakeIntensity = (flightSpeedMultiplier - 4.0) * 0.05 * diveFactor;
    _cameraOffset.x += (Math.random() - 0.5) * shakeIntensity;
    _cameraOffset.y += (Math.random() - 0.5) * shakeIntensity;
  }

  // --- CAMERA UPDATES ---

  if (isFreeCamera) {
    // Free movement logic
    const moveSpeed = (keys.Shift ? 1000 : 250) * delta;
    const rotateSpeedDrag = 0.005;

    // Rotation from Drag (respecting invertYAxis)
    camera.rotation.y += freeCamDeltaX * rotateSpeedDrag;
    camera.rotation.x +=
      freeCamDeltaY * rotateSpeedDrag * (invertYAxis ? -1 : 1);
    camera.rotation.z = 0;

    freeCamDeltaX = 0;
    freeCamDeltaY = 0;

    // Translation
    _freeCamFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _freeCamSide.set(1, 0, 0).applyQuaternion(camera.quaternion);

    if (keys.ArrowUp) camera.position.addScaledVector(_freeCamFwd, moveSpeed);
    if (keys.ArrowDown)
      camera.position.addScaledVector(_freeCamFwd, -moveSpeed);
    if (keys.ArrowLeft)
      camera.position.addScaledVector(_freeCamSide, -moveSpeed);
    if (keys.ArrowRight)
      camera.position.addScaledVector(_freeCamSide, moveSpeed);
    if (keys.E) camera.position.y += moveSpeed;
    if (keys.Q) camera.position.y -= moveSpeed;

    // Still update chunks based on camera position
    if (camera.position.distanceToSquared(_lastChunkUpdatePos) > 10000) {
      updateChunks();
      _lastChunkUpdatePos.copy(camera.position);
    }
  } else {
    let targetProgress = 0;
    if (cameraMode === 'first-person') targetProgress = 0.5;
    else if (cameraMode === 'birds-eye-close' || cameraMode === 'birds-eye-far')
      targetProgress = 1.0;

    let speed = 0.25; // Slower transitions for all modes

    if (cameraTransitionProgress < targetProgress) {
      cameraTransitionProgress = Math.min(
        targetProgress,
        cameraTransitionProgress + delta * speed
      );
    } else if (cameraTransitionProgress > targetProgress) {
      cameraTransitionProgress = Math.max(
        targetProgress,
        cameraTransitionProgress - delta * speed
      );
    }

    // Smoothly transition between different bird's eye heights
    let targetBirdEyeHeight = 2000;
    if (cameraMode === 'birds-eye-close') targetBirdEyeHeight = 500;

    currentBirdEyeHeight = THREE.MathUtils.lerp(
      currentBirdEyeHeight,
      targetBirdEyeHeight,
      1 - Math.pow(1 - 0.05, delta * 60)
    );

    // Cubic ease-in for the "swoop up" drama: t^3
    // This makes it start slow and accelerate significantly towards the top-down view.
    const easedT =
      cameraTransitionProgress *
      cameraTransitionProgress *
      cameraTransitionProgress;

    // 1. Calculate Follow State
    _idealCameraPos_Follow
      .copy(_cameraOffset)
      .applyMatrix4(planeGroup.matrixWorld);

    _lookOffset.set(0, 0, -20);
    _idealLookTarget_Follow
      .copy(_lookOffset)
      .applyMatrix4(planeGroup.matrixWorld);

    if (isLooping) {
      _up_Follow.set(0, 1, 0).applyQuaternion(planeGroup.quaternion);
    } else {
      _up_Follow.set(0, 1, 0);
    }

    // 1.5 Calculate First Person State
    _idealCameraPos_FirstPerson
      .set(0, 1.0, -50)
      .applyMatrix4(planeGroup.matrixWorld);
    _idealLookTarget_FirstPerson
      .set(0, 1.0, -70)
      .applyMatrix4(planeGroup.matrixWorld);
    _up_FirstPerson.set(0, 1, 0).applyQuaternion(planeGroup.quaternion);

    // 2. Calculate Top-Down State
    _idealCameraPos_TopDown.set(
      planeGroup.position.x,
      planeGroup.position.y + currentBirdEyeHeight,
      planeGroup.position.z
    );
    _idealLookTarget_TopDown.copy(planeGroup.position);
    _up_TopDown.set(0, 0, -1); // North is UP

    // 3. Calculate Cinematic State
    const cinematicConfig = CINEMATIC_CONFIGS[currentCinematicIndex];
    if (cameraMode === 'cinematic') {
      cinematicTimer += delta;
      if (cinematicTimer > 10) {
        // Switch every 6 seconds
        cinematicTimer = 0;
        currentCinematicIndex =
          (currentCinematicIndex + 1) % CINEMATIC_CONFIGS.length;
      }

      // Smoothen the switches between cinematic offsets
      const hasOffsetJumped =
        _cinematicOffsetCurrent.distanceToSquared(cinematicConfig.offset) >
        0.001;
      if (hasOffsetJumped) {
        _cinematicOffsetCurrent.lerp(cinematicConfig.offset, 0.02 * delta * 60);
        _cinematicLookTargetCurrent.lerp(
          cinematicConfig.lookOffset,
          0.02 * delta * 60
        );
      }

      // Optimize: Only recalculate matrix if plane has moved or rotated, or if offset is still transitioning
      const rotationChanged =
        Math.abs(_cinematicStableHeading - planeGroup.rotation.y) > 0.0001;
      // Check position change without expensive extra calculations
      const positionChanged =
        Math.abs(_cinematicStableMatrix.elements[12] - planeGroup.position.x) >
          0.1 ||
        Math.abs(_cinematicStableMatrix.elements[13] - planeGroup.position.y) >
          0.1 ||
        Math.abs(_cinematicStableMatrix.elements[14] - planeGroup.position.z) >
          0.1;

      if (rotationChanged || positionChanged || hasOffsetJumped) {
        _cinematicStableHeading = ChillFlightLogic.lerpAngle(
          _cinematicStableHeading,
          planeGroup.rotation.y,
          0.05 * delta * 60
        );
        _cinematicStableQuat.setFromAxisAngle(_yAxis, _cinematicStableHeading);
        _cinematicStableMatrix.makeRotationFromQuaternion(_cinematicStableQuat);
        _cinematicStableMatrix.setPosition(planeGroup.position);
      }
    } else {
      // Keep heading in sync while not in cinematic mode for smooth entry
      _cinematicStableHeading = planeGroup.rotation.y;
    }

    _idealCameraPos_Cinematic
      .copy(_cinematicOffsetCurrent)
      .applyMatrix4(_cinematicStableMatrix);
    _idealLookTarget_Cinematic
      .copy(_cinematicLookTargetCurrent)
      .applyMatrix4(_cinematicStableMatrix);

    // 4. Blend FOV
    // Follow mode has dynamic FOV, Top-down is fixed at 60, Cinematic is per-config
    const followFov = targetFov;
    const topDownFov = 60;
    const cinematicFov = cinematicConfig.fov;

    let targetBlendedFov;
    if (cameraMode === 'cinematic') {
      targetBlendedFov = THREE.MathUtils.lerp(followFov, cinematicFov, 1.0); // Simple snap for FOV in cinematic
    } else {
      targetBlendedFov = THREE.MathUtils.lerp(followFov, topDownFov, easedT);
    }

    camera.fov = THREE.MathUtils.lerp(
      camera.fov,
      targetBlendedFov,
      1 - Math.pow(1 - 0.1, delta * 60)
    );
    camera.updateProjectionMatrix();

    // 5. Blend Positions & Targets
    if (cameraMode === 'cinematic') {
      _idealCameraPos.copy(_idealCameraPos_Cinematic);
      _idealLookTarget.copy(_idealLookTarget_Cinematic);
      _idealUp.set(0, 1, 0); // Always world-up for cinematic
    } else {
      const p = cameraTransitionProgress;
      if (p < 0.5) {
        const t = p / 0.5;
        const easedSegT = t * t * (3 - 2 * t); // smoothstep
        _idealCameraPos.lerpVectors(
          _idealCameraPos_Follow,
          _idealCameraPos_FirstPerson,
          easedSegT
        );
        _idealLookTarget.lerpVectors(
          _idealLookTarget_Follow,
          _idealLookTarget_FirstPerson,
          easedSegT
        );
        _idealUp.lerpVectors(_up_Follow, _up_FirstPerson, easedSegT);
      } else {
        const t = (p - 0.5) / 0.5;
        const easedSegT = t * t * (3 - 2 * t); // smoothstep
        _idealCameraPos.lerpVectors(
          _idealCameraPos_FirstPerson,
          _idealCameraPos_TopDown,
          easedSegT
        );
        _idealLookTarget.lerpVectors(
          _idealLookTarget_FirstPerson,
          _idealLookTarget_TopDown,
          easedSegT
        );
        _idealUp.lerpVectors(_up_FirstPerson, _up_TopDown, easedSegT);
      }
    }

    // Camera collision avoidance with terrain
    const idealTerrainHeight = getElevation(
      _idealCameraPos.x,
      _idealCameraPos.z
    );
    if (_idealCameraPos.y < idealTerrainHeight + 2.0) {
      _idealCameraPos.y = idealTerrainHeight + 2.0;
    }

    // Apply smooth tracking to the results
    // We use smoothedDelta and a higher lerp factor for a more "locked-in" feel.
    if (isIntroTransitionActive) {
      // Update the virtual tracking camera (steady state lag)
      _virtualCameraPos.lerp(
        _idealCameraPos,
        1 - Math.pow(1 - 0.25, delta * 60)
      );
      _virtualLookTarget.lerp(
        _idealLookTarget,
        1 - Math.pow(1 - 0.25, delta * 60)
      );

      const progress = (now - introTransitionStartTime) / 2500;
      if (progress < 1) {
        // Ease In Out Cubic
        const easedProgress =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Interpolate visual camera between start and virtual tracking camera
        _currentLookTarget.lerpVectors(
          _introLookTargetStart,
          _virtualLookTarget,
          easedProgress
        );
        camera.position.lerpVectors(
          _introCameraPosStart,
          _virtualCameraPos,
          easedProgress
        );
      } else {
        isIntroTransitionActive = false;
        camera.position.copy(_virtualCameraPos);
        _currentLookTarget.copy(_virtualLookTarget);
      }
    } else {
      camera.position.lerp(_idealCameraPos, 1 - Math.pow(1 - 0.25, delta * 60));
      _currentLookTarget.lerp(
        _idealLookTarget,
        1 - Math.pow(1 - 0.25, delta * 60)
      );
    }

    // Hard clamp to prevent dipping below terrain during fast movement
    const actualTerrainHeight = getElevation(
      camera.position.x,
      camera.position.z
    );
    if (camera.position.y < actualTerrainHeight + 1.0) {
      camera.position.y = actualTerrainHeight + 1.0;
    }

    camera.up.lerp(_idealUp, 1 - Math.pow(1 - 0.1, delta * 60)).normalize();

    camera.lookAt(_currentLookTarget);

    // Update terrain chunks (only if the plane has moved ~50 units)
    if (planeGroup.position.distanceToSquared(_lastChunkUpdatePos) > 2500) {
      updateChunks();
      _lastChunkUpdatePos.copy(planeGroup.position);
    }
  }

  // Celestial positions
  const sunOrbitRadius = 8000;
  const moonOrbitRadius = 7500; // Moon is closer so it renders in front of sun during overlaps

  // 1. Realistic Sun Path
  const latitude = currentLatRad;
  const declination = 0.409; // Summer tilt
  const hourAngle = timeOfDay + Math.PI;

  const sunY =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const sunX = -Math.cos(declination) * Math.sin(hourAngle);
  const sunZ =
    Math.cos(latitude) * Math.sin(declination) -
    Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const dayFactor = Math.max(0, Math.min(1, (sunY + 0.5) * 2)); // 0.0 at SunY=-0.5 (4 AM), 1.0 at SunY=0 (6 AM)

  // 2. Realistic Moon Position (Decoupled & Slower)
  // Lunar phase cycle: 2 hours (previously 40 minutes)
  const LUNAR_PHASE_MS = 7200000;
  const lunarPhase = (passedServerNow % LUNAR_PHASE_MS) / LUNAR_PHASE_MS;
  if (typeof moonUniforms !== 'undefined') {
    moonUniforms.moonPhase.value = lunarPhase;
  }

  // Lunar sky cycle: Synced to exactly opposite the sun
  // This ensures the moon is always prominent in the sky at night.
  const moonHourAngle = timeOfDay; // Sun is timeOfDay + Math.PI

  // Slow lunar wobble: path drifts ±10° over ~1.7 hours for orbital diversity
  const moonWobble = Math.sin(passedServerNow * 0.000001) * 0.17;
  const moonDeclination = declination + moonWobble;

  const moonY =
    Math.sin(latitude) * Math.sin(moonDeclination) +
    Math.cos(latitude) * Math.cos(moonDeclination) * Math.cos(moonHourAngle);
  const rawMoonX = -Math.cos(moonDeclination) * Math.sin(moonHourAngle);
  const rawMoonZ =
    Math.cos(latitude) * Math.sin(moonDeclination) -
    Math.sin(latitude) * Math.cos(moonDeclination) * Math.cos(moonHourAngle);

  // Rotate moon orbit by 30 degrees to give it a totally distinct path from the sun
  const moonOrbitRotation = 0.52; // ~30 degrees
  const cosR = Math.cos(moonOrbitRotation);
  const sinR = Math.sin(moonOrbitRotation);
  const moonX = rawMoonX * cosR - rawMoonZ * sinR;
  const moonZ = rawMoonX * sinR + rawMoonZ * cosR;

  // Update water shader uniform — the GPU handles all wave displacement
  window.waterUniforms.uTime.value = now * 0.0015;

  // Update global animation time for GPU-offloaded objects
  if (!window.animationUniforms) window.animationUniforms = {uTime: {value: 0}};
  window.animationUniforms.uTime.value = performance.now() * 0.001;

  // Animate Birds, Lighthouses
  // Note: Windmills, campfires, and smoke particles are animated entirely on the GPU via Material.onBeforeCompile.
  // Birds and Lighthouses remain entirely on the CPU because:
  // 1. Lighthouses require updating an actual THREE.Light target's position for correct shadow/lighting calculations.
  // 2. Birds use complex nested THREE.Group structures with hinges (flapping) and orientation matrices (.lookAt)
  //    which are sparse enough that rewriting a full skeletal/flocking vertex shader introduces unnecessary complexity.
  chunks.forEach((chunkGroup) => {
    // Optimization: Distance culling (6000 units)
    const checkPos = chunkGroup.userData.worldPosition || chunkGroup.position;
    if (checkPos.distanceToSquared(camera.position) > 36000000) return;

    if (chunkGroup.userData.birds) {
      chunkGroup.userData.birds.forEach((bird) => {
        bird.visible = dayFactor > 0.1;
        if (!bird.visible) return;

        const data = bird.userData;
        const flapSpeed = data.flapSpeed || 2;
        const flapPhase = data.flapPhase || 0;
        const flapDuration = data.flapDuration || 4.0;
        const soarDuration = data.soarDuration || 6.0;

        const totalCycle = flapDuration + soarDuration;
        const cycleProgress = (clock.elapsedTime + flapPhase * 10) % totalCycle;
        const isSoaring = cycleProgress > flapDuration;

        let flap = 0;
        if (!isSoaring) {
          let amplitude = 0.5;
          const transitionTime = 0.5; // 0.5s smooth fade envelope
          if (cycleProgress < transitionTime) {
            amplitude *= cycleProgress / transitionTime;
          } else if (flapDuration - cycleProgress < transitionTime) {
            amplitude *= (flapDuration - cycleProgress) / transitionTime;
          }
          flap =
            Math.sin(clock.elapsedTime * flapSpeed + flapPhase) * amplitude;
        }
        if (data.wings) {
          data.wings[0].rotation.z = flap;
          data.wings[1].rotation.z = flap;
        }
        bird.translateZ(-(data.speed * delta * 50));

        if (data.type === 'hawk') {
          data.angle += data.circleSpeed * delta;
          const targetX =
            data.circleCenter.x + Math.cos(data.angle) * data.circleRadius;
          const targetZ =
            data.circleCenter.z + Math.sin(data.angle) * data.circleRadius;
          bird.rotation.z = 0.3;
          bird.lookAt(
            data.circleCenter.x +
              Math.cos(data.angle + 0.1) * data.circleRadius,
            bird.position.y,
            data.circleCenter.z + Math.sin(data.angle + 0.1) * data.circleRadius
          );
          bird.position.set(targetX, bird.position.y, targetZ);
        }
      });
    }

    // Animate Sailboats (Drifting & Bobbing)
    if (
      chunkGroup.userData.boatHulls &&
      chunkGroup.userData.sailboatPositions
    ) {
      const hulls = chunkGroup.userData.boatHulls;
      const masts = chunkGroup.userData.boatMasts;
      const sails = chunkGroup.userData.boatSails;
      const rims = chunkGroup.userData.boatRims;
      const decks = chunkGroup.userData.boatDecks;
      const booms = chunkGroup.userData.boatBooms;
      const positions = chunkGroup.userData.sailboatPositions;

      const hash = (index, seed) => {
        const val = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
        return val - Math.floor(val);
      };

      positions.forEach((pos, index) => {
        const driftPhase = hash(index, 1) * Math.PI * 2;
        const driftSpeed = 0.03 + hash(index, 2) * 0.04; // Extremely slow drifting
        const doesDrift = hash(index, 3) < 0.8; // 80% drift, 20% completely anchored in place
        const isAnchored = doesDrift && hash(index, 4) < 0.6; // 60% of drifting ones are on a tight anchor, 40% are loose

        let driftRadius = 0;
        if (doesDrift) {
          driftRadius = isAnchored
            ? 4 + hash(index, 5) * 4
            : 15 + hash(index, 5) * 15;
        }

        let dx = 0;
        let dz = 0;
        let yawOffset = Math.sin(clock.elapsedTime * 0.4 + driftPhase) * 0.05; // Gentle sway

        if (driftRadius > 0) {
          const t = clock.elapsedTime * driftSpeed + driftPhase;
          dx = Math.sin(t * 1.6) * driftRadius;
          dz = Math.cos(t * 1.0) * driftRadius;

          // Tangent of the slow drift Lissajous trajectory for orientation heading
          const tx = 1.6 * Math.cos(t * 1.6) * driftRadius;
          const tz = -1.0 * Math.sin(t * 1.0) * driftRadius;

          // Compute angle of movement
          const tangentYaw = Math.atan2(tx, tz);
          yawOffset += tangentYaw;
        }

        // Bobbing & Wave dynamics (Roll/Pitch)
        const bobTime = clock.elapsedTime * 1.2 + driftPhase;
        const dy = Math.sin(bobTime) * 0.15;
        const roll = Math.sin(bobTime * 0.8) * 0.04;
        const pitch = Math.cos(bobTime * 1.1) * 0.03;

        _boatDummy.position.set(pos.x + dx, pos.y + dy, pos.z + dz);
        _boatDummy.rotation.set(0, 0, 0);
        _boatDummy.rotation.y = pos.rotY + yawOffset;
        _boatDummy.rotation.x = pitch;
        _boatDummy.rotation.z = roll;
        _boatDummy.scale.set(1, 1, 1);
        _boatDummy.updateMatrix();

        if (Array.isArray(hulls)) {
          const colorIdx = chunkGroup.userData.boatColorIndices[index];
          const instIdx = chunkGroup.userData.boatInstIndices[index];
          hulls[colorIdx].setMatrixAt(instIdx, _boatDummy.matrix);
        } else {
          hulls.setMatrixAt(index, _boatDummy.matrix);
        }

        masts.setMatrixAt(index, _boatDummy.matrix);
        sails.setMatrixAt(index, _boatDummy.matrix);
        if (rims) rims.setMatrixAt(index, _boatDummy.matrix);
        if (decks) decks.setMatrixAt(index, _boatDummy.matrix);
        if (booms) booms.setMatrixAt(index, _boatDummy.matrix);
      });

      if (Array.isArray(hulls)) {
        hulls.forEach((h) => {
          if (h) h.instanceMatrix.needsUpdate = true;
        });
      } else {
        hulls.instanceMatrix.needsUpdate = true;
      }

      masts.instanceMatrix.needsUpdate = true;
      sails.instanceMatrix.needsUpdate = true;
      if (rims) rims.instanceMatrix.needsUpdate = true;
      if (decks) decks.instanceMatrix.needsUpdate = true;
      if (booms) booms.instanceMatrix.needsUpdate = true;
    }

    // Animate Lighthouse Beam
    if (chunkGroup.userData.lighthouseBeam) {
      const beam = chunkGroup.userData.lighthouseBeam;
      beam.rotation.y += delta * 0.15; // Slower sweep

      // Fade on after sunset and fade off before sunrise using dayFactor
      const fadeFactor = 1.0 - dayFactor;
      beam.visible = fadeFactor > 0;

      if (beam.visible) {
        const baseOpacity =
          LIGHTHOUSE_BEAM_OPACITY_MIN +
          (Math.sin(performance.now() * 0.002) * 0.5 + 0.5) *
            (LIGHTHOUSE_BEAM_OPACITY_MAX - LIGHTHOUSE_BEAM_OPACITY_MIN);
        beam.material.opacity = baseOpacity * fadeFactor;
      }

      // Rotate functional light target
      if (
        chunkGroup.userData.lighthouseTarget &&
        chunkGroup.userData.lighthouseLight
      ) {
        const target = chunkGroup.userData.lighthouseTarget;
        const light = chunkGroup.userData.lighthouseLight;

        if (beam.visible) {
          // Align target perfectly with the beam's Z-axis trajectory
          const distance = 600; // Doubled distance for scaled lighthouse
          target.position.set(
            light.position.x + Math.sin(beam.rotation.y) * distance,
            light.position.y - Math.sin(beam.rotation.x) * distance, // Account for downward tilt
            light.position.z + Math.cos(beam.rotation.y) * distance
          );
          light.intensity = LIGHTHOUSE_LIGHT_INTENSITY * fadeFactor;
        } else {
          light.intensity = 0;
        }
      }
    }

    // Global opacity updates for GPU-animated elements
    if (chunkGroup.userData.campfires) {
      const cores = chunkGroup.userData.campfires;
      const smoke = chunkGroup.userData.campfireSmoke;
      if (cores.material)
        cores.material.emissiveIntensity = 2.0 * (1.0 - dayFactor * 0.8);
      if (smoke && smoke.material)
        smoke.material.opacity = 0.4 * (1.0 - dayFactor * 0.5);
    }

    if (chunkGroup.userData.chimneySmoke) {
      const smoke = chunkGroup.userData.chimneySmoke;
      if (smoke.material) smoke.material.opacity = 0.6 - dayFactor * 0.3;
    }
  });

  // Update Cockpit HUD
  const hours = (timeOfDay / (Math.PI * 2)) * 24;
  const hh = Math.floor(hours).toString().padStart(2, '0');
  const mm = Math.floor((hours % 1) * 60)
    .toString()
    .padStart(2, '0');
  const timeStr = `${hh}:${mm}`;

  const dirStr = ChillFlightLogic.computeHeadingDirection(
    planeGroup.rotation.y
  );
  const latVal = currentLatDeg;
  const lonVal = planeGroup.position.x / latScale;
  const latStr =
    Math.abs(latVal).toFixed(3) + '\u00b0 ' + (latVal >= 0 ? 'N' : 'S');
  const lonStr =
    Math.abs(lonVal).toFixed(3) + '\u00b0 ' + (lonVal >= 0 ? 'E' : 'W');
  const coordStr = `${latStr} ${lonStr}`;
  const altStr = `${Math.round(Math.max(0, planeGroup.position.y - 45.5) * 25)}`;
  let spdStr = `${Math.round(BASE_FLIGHT_SPEED * flightSpeedMultiplier * 60)} KTS`;
  if (vehicleType === 'helicopter') {
    spdStr = '-- KTS';
  }

  updateDOM(document.getElementById('cockpit-time'), timeStr);
  updateDOM(document.getElementById('cockpit-dir'), dirStr);
  updateDOM(document.getElementById('cockpit-coords'), coordStr);
  updateDOM(document.getElementById('cockpit-alt'), altStr);
  updateDOM(document.getElementById('cockpit-spd'), spdStr);

  sunMesh.position.set(
    sunX * sunOrbitRadius,
    sunY * sunOrbitRadius,
    sunZ * sunOrbitRadius
  );
  moonMesh.position.set(
    moonX * moonOrbitRadius,
    moonY * moonOrbitRadius,
    moonZ * moonOrbitRadius
  );

  // --- SHADOW TEXEL SNAPPING (View-Space) ---
  // Eliminates "shadow swimming" and depth-band "creeping" by locking the
  // shadow camera in all 3 dimensions to a rigid, sun-aligned grid.

  // Step 1: Compute the sun direction (Forward vector)
  _shadowSunDir.set(sunX, sunY, sunZ).normalize();

  // Step 2: Build a rigid local coordinate system for the light.
  _shadowRight.crossVectors(_worldUp, _shadowSunDir).normalize();
  _shadowUp.crossVectors(_shadowSunDir, _shadowRight).normalize();

  // Use planeGroup instead of camera. This prevents high-speed camera shake
  // (which alters camera.position) from causing erratic shadow snapping.
  const anchorPos = planeGroup.position;

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
  const _targetShadowPos = new THREE.Vector3().copy(anchorPos);
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
  skyGroup.position.copy(camera.position);

  // Smoothly interpolate sky shader palettes
  if (typeof skyUniforms !== 'undefined' && !isCustomPalette) {
    skyUniforms.topColor.value.lerp(targetPaletteTop, delta * 0.1);
    skyUniforms.bottomColor.value.lerp(targetPaletteBottom, delta * 0.1);
  }

  // 1. Check if forced precipitation is currently visible on screen (or would be, if not above clouds)
  let precipIntensity = 0;
  if (snowParticles && rainParticles) {
    const sInt =
      (window._unfadedSnowOpacity !== undefined
        ? window._unfadedSnowOpacity
        : snowParticles.material.opacity) / 0.8;
    const rInt =
      (window._unfadedRainOpacity !== undefined
        ? window._unfadedRainOpacity
        : rainParticles.material.opacity) / 0.5;
    precipIntensity = Math.max(sInt, rInt);
  }

  // 2. Check for procedural cloudy biomes
  const weatherTimeOffset = (window._gameServerNow || now) / 100000;
  let weatherNoise =
    (simplex.noise2D(
      (planeGroup.position.x / CHUNK_SIZE) * 0.1 + 500 + weatherTimeOffset,
      (planeGroup.position.z / CHUNK_SIZE) * 0.1 + weatherTimeOffset
    ) +
      1) /
    2;
  const weatherThreshold = 0.7;
  weatherNoise =
    weatherNoise < weatherThreshold
      ? 0
      : (weatherNoise - weatherThreshold) / (1 - weatherThreshold);

  // 3. The world is overcast if there are thick clouds (we don't force overcast for snow/rain so we can have beautiful snowy sunsets)
  const targetOvercast = weatherNoise;
  window._currentOvercast = THREE.MathUtils.lerp(
    window._currentOvercast || 0,
    targetOvercast,
    0.01
  );
  const overcast = window._currentOvercast;

  // --- APPLY LIGHTING & CELESTIAL BODIES ---
  // Stars disappear when overcast
  let starFactor = Math.max(0, Math.min(1, (sunY + 0.2) / -0.3));
  starsMat.opacity = starFactor * (1.0 - overcast);

  // --- SHOOTING STARS ---
  if (
    (starFactor > 0.5 && overcast < 0.5) ||
    isShootingStarActive ||
    forceShootingStar
  ) {
    if (!isShootingStarActive) {
      if (forceShootingStar || Math.random() < delta / 15.0) {
        forceShootingStar = false;
        isShootingStarActive = true;
        shootingStarProgress = 0;
        shootingStarDuration = 0.8 + Math.random() * 0.4;

        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);

        lookDir.y += 0.3 + Math.random() * 0.4;
        lookDir.x += (Math.random() - 0.5) * 1.5;
        lookDir.z += (Math.random() - 0.5) * 1.5;
        lookDir.normalize();

        const distance = 15000;
        shootingStarStart
          .copy(camera.position)
          .add(lookDir.multiplyScalar(distance));

        const streakDir = new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          -0.2 - Math.random() * 0.3,
          (Math.random() - 0.5) * 0.5
        ).normalize();

        const streakLength = 4000 + Math.random() * 3000;
        shootingStarEnd
          .copy(shootingStarStart)
          .add(streakDir.multiplyScalar(streakLength));

        const starMesh = skyGroup.getObjectByName('shootingStar');
        if (starMesh) starMesh.visible = true;
      }
    } else {
      shootingStarProgress += delta / shootingStarDuration;
      const starMesh = skyGroup.getObjectByName('shootingStar');

      if (shootingStarProgress >= 1.0) {
        isShootingStarActive = false;
        if (starMesh) starMesh.visible = false;
      } else if (starMesh) {
        const headPos = new THREE.Vector3().lerpVectors(
          shootingStarStart,
          shootingStarEnd,
          shootingStarProgress
        );
        const tailLength = 0.15;
        const tailProgress = Math.max(0, shootingStarProgress - tailLength);
        const tailPos = new THREE.Vector3().lerpVectors(
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

        const fadeOut = 1.0 - Math.pow(shootingStarProgress, 4);
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
  } else if (isShootingStarActive) {
    isShootingStarActive = false;
    const starMesh = skyGroup.getObjectByName('shootingStar');
    if (starMesh) starMesh.visible = false;
  }

  // --- RAINBOW ---
  const isRaining = window._unfadedRainOpacity > 0.1;
  const isDaytime = sunY > 0;

  const rainbowMesh = skyGroup.getObjectByName('rainbow');

  const startRainbow = () => {
    if (rainbowTimer <= 0 && rainbowMesh) {
      // Lock position when spawned so it doesn't move across the sky
      const sunDir = new THREE.Vector3(sunX, sunY, sunZ).normalize();
      const antiSunDir = sunDir.clone().negate();
      rainbowMesh.position.copy(antiSunDir).multiplyScalar(10000);
      rainbowMesh.lookAt(camera.position);
    }
    rainbowTimer = 120.0;
  };

  if (forceRainbow) {
    forceRainbow = false;
    startRainbow();
  }

  if (rainbowMesh) {
    if (rainbowTimer > 0 && isDaytime) {
      rainbowTimer -= delta;
      rainbowIntensity = Math.min(1.0, rainbowIntensity + delta * 0.2);
      rainbowMesh.visible = true;
      rainbowMesh.material.uniforms.uAlpha.value = rainbowIntensity;
    } else {
      rainbowTimer = 0;
      rainbowIntensity = Math.max(0.0, rainbowIntensity - delta * 0.2);
      if (rainbowIntensity <= 0) {
        rainbowMesh.visible = false;
      } else {
        rainbowMesh.material.uniforms.uAlpha.value = rainbowIntensity;
      }
    }
  }

  // --- AURORA BOREALIS ---
  // Aurora is visible only at night AND at high northern latitudes.
  // latVal > 0.5 => player is north of ~0.5°N in our coordinate system.
  // The aurora ramps in from latVal 0.5 to 1.0 (fully visible at 1.0+).
  const auroraLatFactor = THREE.MathUtils.clamp(
    (currentLatDeg - 0.5) / 0.5,
    0,
    1
  );
  const auroraNightFactor = starFactor; // reuse: 0 at day, 1 at deep night

  // Geomagnetic activity: slow simplex noise on server time so the aurora
  // naturally waxes and wanes — sometimes absent, sometimes a faint shimmer,
  // sometimes blazing. Two samples at different rates give organic variation.
  // Period ~20 min (primary) + ~7 min (secondary). Server-synced across players.
  const _auroraT1 = passedServerNow / 1200000; // ~20-min primary cycle
  const _auroraT2 = passedServerNow / 420000; // ~7-min secondary detail
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
  if (typeof skyUniforms !== 'undefined') {
    skyUniforms.uAuroraIntensity.value = THREE.MathUtils.lerp(
      skyUniforms.uAuroraIntensity.value,
      targetAuroraIntensity,
      1 - Math.pow(1 - 0.015, delta * 60)
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
  if (moonMesh && moonMesh.material) {
    if (!moonMesh.material.transparent) {
      moonMesh.material.transparent = true;
      moonMesh.material.needsUpdate = true;
    }
    moonMesh.material.opacity = 1.0 - overcast;
  }

  let baseHemi = THREE.MathUtils.lerp(0.3, 0.6, dayFactor);
  hemiLight.intensity = THREE.MathUtils.lerp(
    baseHemi,
    0.7,
    overcast * dayFactor
  );

  let baseDir = THREE.MathUtils.lerp(0, 0.8, dayFactor);
  dirLight.intensity = THREE.MathUtils.lerp(baseDir, 0.05, overcast);

  let moonFactor = Math.max(0, Math.min(1, (-sunY - 0.25) / 0.25));
  moonFactor *= Math.max(0, Math.min(1, moonY * 10.0)); // Only shine when moon is up
  moonLight.intensity = moonFactor * 0.4 * (1.0 - overcast);

  // --- APPLY SKY & FOG ---
  _uncloudedSkyColor.setHex(0x0a0c20);
  _uncloudedFogColor.setHex(0x060815);

  if (dayFactor > 0.0) {
    let dawnDuskFactor = 1.0 - Math.min(1, Math.abs(sunY) * 2.5);
    dawnDuskFactor = Math.max(0, Math.pow(dawnDuskFactor, 1.5));

    if (sunX > 0) {
      _currentSunriseSky.copy(_sunriseSky);
      _currentGoldenSky.copy(_goldenSky);
    } else {
      _currentSunriseSky.copy(_sunsetSky);
      _currentGoldenSky.copy(_goldenSunsetSky);
    }

    _uncloudedSkyColor.lerp(_twilightSky, dayFactor * 0.4);

    // Allow sunset colors in the main sky even when overcast (Issue #24)
    _uncloudedSkyColor.lerp(_currentSunriseSky, dawnDuskFactor);

    if (sunY > -0.1 && sunY < 0.15) {
      let goldT = 1.0 - Math.abs(sunY - 0.02) * 10;
      _uncloudedSkyColor.lerp(_currentGoldenSky, Math.max(0, goldT) * 0.6);
    }

    // --- DYNAMIC REGIONAL DAY SKY ---
    // Calculate local biome factors for the sky based on camera position
    const pX = camera.position.x;
    const pZ = camera.position.z;

    // Desert (South Z > 5000)
    const desertRaw = Math.max(0, Math.min(1, (pZ - 5000) / 3000));
    const desertFactor = desertRaw * desertRaw * (3 - 2 * desertRaw);

    // Snow/Mountain (North Z < -5000)
    const snowRaw = Math.max(0, Math.min(1, (-pZ - 5000) / 3000));
    const snowFactor = snowRaw * snowRaw * (3 - 2 * snowRaw);

    // Start with default azure day sky
    const localDaySky = new THREE.Color(_daySky);

    // Blend in regional sky characteristics
    if (desertFactor > 0) {
      localDaySky.lerp(new THREE.Color(0x6ca3d8), desertFactor * 0.85); // Hazier, lighter blue
    }
    if (snowFactor > 0) {
      localDaySky.lerp(new THREE.Color(0x1a4a8c), snowFactor * 0.85); // Deeper, crisper blue
    }

    _uncloudedSkyColor.lerp(localDaySky, dayFactor * (1.0 - dawnDuskFactor));

    if (dayPicker) {
      const hex = '#' + localDaySky.getHexString();
      if (dayPicker.value !== hex) dayPicker.value = hex;
    }
    _uncloudedFogColor.copy(_uncloudedSkyColor);

    // Warm up the directional light during golden hour
    const dayLightCol = new THREE.Color(0xfff0dd);
    const sunsetLightCol =
      sunX > 0 ? new THREE.Color(0xffd5a0) : new THREE.Color(0xffad60);
    dirLight.color.copy(dayLightCol).lerp(sunsetLightCol, dawnDuskFactor);
  } else {
    dirLight.color.setHex(0xfff0dd);
  }

  const stormColor = new THREE.Color(0x5a6b7c);
  _cloudyColor.setHex(0x0a0c10).lerp(stormColor, dayFactor);

  _finalSkyColor.copy(_uncloudedSkyColor).lerp(_cloudyColor, overcast);
  _finalFogColor.copy(_uncloudedFogColor).lerp(_cloudyColor, overcast);

  scene.fog.color.lerp(_finalFogColor, 1 - Math.pow(1 - 0.05, delta * 60));

  // If it's actively raining or snowing, the fog should be much thicker to obscure the horizon
  let baseFogDensity = 0.75 / (RENDER_DISTANCE * CHUNK_SIZE);
  if (window.manualBaseFogDensity !== undefined) {
    baseFogDensity = window.manualBaseFogDensity;
  }

  const maxFogDensity = Math.max(
    baseFogDensity,
    precipIntensity > 0 ? 0.00025 : 0.0002
  );
  const targetFogDensity = THREE.MathUtils.lerp(
    baseFogDensity,
    maxFogDensity,
    overcast
  );
  scene.fog.density = THREE.MathUtils.lerp(
    scene.fog.density,
    targetFogDensity,
    1 - Math.pow(1 - 0.01, delta * 60)
  );

  // Update slider UI and values
  const fogSlider = document.getElementById('debug-fog-slider');
  const baseFogVal = document.getElementById('debug-base-fog-val');
  const finalFogVal = document.getElementById('debug-final-fog-val');

  if (fogSlider && window.manualBaseFogDensity === undefined) {
    fogSlider.value = baseFogDensity;
  }
  if (baseFogVal && window.manualBaseFogDensity === undefined) {
    baseFogVal.textContent = baseFogDensity.toFixed(5);
  }
  if (finalFogVal) {
    finalFogVal.textContent = scene.fog.density.toFixed(5);
  }

  // Update Sky Shader Colors
  if (!isCustomPalette) {
    skyUniforms.topColor.value.copy(_finalSkyColor);
  }

  _tempVec.set(sunX, sunY, sunZ).normalize();
  skyUniforms.sunDirection.value.copy(_tempVec);
  window._cloudTime =
    (window._cloudTime || now * 0.001) +
    delta *
      (typeof daySpeedMultiplier !== 'undefined' ? daySpeedMultiplier : 1);
  skyUniforms.uTime.value = window._cloudTime;
  skyUniforms.uCloudDensity.value = overcast;
  skyUniforms.uCameraPos.value.copy(camera.position);

  if (window.waterUniforms && window.waterUniforms.uSunDirection) {
    window.waterUniforms.uSunDirection.value.copy(_tempVec);
    window.waterUniforms.uSunColor.value
      .copy(dirLight.color)
      .multiplyScalar(Math.max(0, 1.0 - overcast));
  }

  if (typeof sunUniforms !== 'undefined') {
    sunUniforms.uTime.value = now * 0.001;
    sunUniforms.overcast.value = overcast;
    sunUniforms.dayFactor.value = dayFactor;

    // Dynamic Sun Sizing (Moon Illusion)
    const sunElevation = Math.max(0.0, sunY);
    const sunScale = 1.0 + Math.pow(1.0 - sunElevation, 3.0) * 1.5;
    sunMesh.scale.setScalar(sunScale);

    // Dynamic Sun Color (Golden Hour)
    const noonColor = new THREE.Color(0xfffceb);
    const sunsetColor = new THREE.Color(0xffa542);
    const colorFactor = 1.0 - Math.pow(1.0 - sunElevation, 3.0);
    sunUniforms.uSunColor.value.copy(sunsetColor).lerp(noonColor, colorFactor);
  }
  if (typeof moonUniforms !== 'undefined') {
    moonUniforms.uTime.value = now * 0.001;
    moonUniforms.overcast.value = overcast;
    moonUniforms.dayFactor.value = dayFactor;

    // moonPhase is now updated at the top of animate() with a 4-hour cycle

    // Dynamic Moon Sizing (Moon Illusion)
    const moonElevation = Math.max(0.0, moonY);
    const moonScale = 1.0 + Math.pow(1.0 - moonElevation, 3.0) * 1.5;
    moonMesh.scale.setScalar(moonScale);
  }

  if (!isCustomPalette) {
    if (dayFactor > 0.0) {
      let dawnDuskFactor = 1.0 - Math.min(1, Math.abs(sunY) * 2.5);
      dawnDuskFactor = Math.max(0, Math.pow(dawnDuskFactor, 1.5));

      let bottomCol = _finalSkyColor.clone();
      if (dawnDuskFactor > 0.1) {
        const warmHorizon = new THREE.Color(selectedPalette.bottom);
        // KILL THE SUNSET HORIZON WHEN OVERCAST
        const actualDawnDusk = dawnDuskFactor * 0.8 * (1.0 - overcast);
        bottomCol.lerp(warmHorizon, actualDawnDusk);
      }

      skyUniforms.bottomColor.value.copy(bottomCol);
    } else {
      let bottomCol = _finalSkyColor.clone().multiplyScalar(0.8);
      skyUniforms.bottomColor.value.copy(bottomCol);
    }
  }

  // Update the particle positions
  updateWeather(delta);

  renderer.render(scene, camera);

  // Update Online Players List (Desktop only, throttled to 2Hz)
  if (window.innerWidth > 768 && now - lastPlayerListUpdate > 500) {
    updatePlayerList();
    lastPlayerListUpdate = now;
  }

  // Update Debug Telemetry (at the very end of frame)
  if (debugMenu && debugMenu.style.display === 'block') {
    const pullBackVal =
      smoothedManeuverFactor * 20 * Math.min(1, flightSpeedMultiplier / 2); // Re-calculate or pass from earlier
    updateDOM(document.getElementById('debug-fov'), Math.round(camera.fov));
    updateDOM(
      document.getElementById('debug-pullback'),
      Math.round(pullBackVal)
    );
    updateDOM(
      document.getElementById('debug-pitch'),
      Math.round((planeGroup.rotation.x * 180) / Math.PI)
    );
    updateDOM(document.getElementById('debug-palette'), selectedPalette.name);
    updateDOM(
      document.getElementById('debug-speed-mult'),
      flightSpeedMultiplier.toFixed(2)
    );
    updateDOM(
      document.getElementById('debug-day-speed'),
      daySpeedMultiplier.toFixed(1)
    );

    updateDOM(
      document.getElementById('debug-target-speed'),
      targetFlightSpeed.toFixed(2)
    );
    updateDOM(
      document.getElementById('debug-maneuver'),
      smoothedManeuverFactor.toFixed(2)
    );
    updateDOM(
      document.getElementById('debug-world-x'),
      Math.round(planeGroup.position.x)
    );
    updateDOM(
      document.getElementById('debug-world-y'),
      Math.round(planeGroup.position.y)
    );
    updateDOM(
      document.getElementById('debug-world-z'),
      Math.round(planeGroup.position.z)
    );
    updateDOM(
      document.getElementById('debug-camera-x'),
      Math.round(camera.position.x)
    );
    updateDOM(
      document.getElementById('debug-camera-y'),
      Math.round(camera.position.y)
    );
    updateDOM(
      document.getElementById('debug-camera-z'),
      Math.round(camera.position.z)
    );
    const camHeadingDegrees = THREE.MathUtils.radToDeg(camera.rotation.y);
    const camPitchDegrees = THREE.MathUtils.radToDeg(camera.rotation.x);
    updateDOM(
      document.getElementById('debug-camera-heading'),
      Math.round(camHeadingDegrees)
    );
    updateDOM(
      document.getElementById('debug-camera-pitch'),
      Math.round(camPitchDegrees)
    );

    // Weather Telemetry
    const oc = window._currentOvercast || 0;
    updateDOM(document.getElementById('debug-overcast'), oc.toFixed(2));
    updateDOM(
      document.getElementById('debug-storm-noise'),
      window._weatherDebug ? window._weatherDebug.stormNoise.toFixed(2) : '-'
    );
    updateDOM(
      document.getElementById('debug-precip'),
      snowParticles && rainParticles
        ? Math.max(
            snowParticles.material.opacity / 0.8,
            rainParticles.material.opacity / 0.5
          ).toFixed(2)
        : '-'
    );
    updateDOM(
      document.getElementById('debug-climate-zone'),
      window._weatherDebug ? window._weatherDebug.zone : '-'
    );
    updateDOM(
      document.getElementById('debug-snow-opacity'),
      snowParticles ? snowParticles.material.opacity.toFixed(2) : '-'
    );
    updateDOM(
      document.getElementById('debug-rain-opacity'),
      rainParticles ? rainParticles.material.opacity.toFixed(2) : '-'
    );
    updateDOM(
      document.getElementById('debug-fog-density'),
      scene.fog.density.toFixed(5)
    );
    updateDOM(document.getElementById('debug-weather-mode'), weatherType);

    // Aurora telemetry
    const auroraVal =
      typeof skyUniforms !== 'undefined'
        ? skyUniforms.uAuroraIntensity.value
        : 0;
    if (auroraVal > _auroraSessionMax) _auroraSessionMax = auroraVal;
    const _auroraLabelFn = (v) =>
      v < 0.01 ? 'None' : v < 0.03 ? 'Faint' : v < 0.06 ? 'Moderate' : 'Active';
    updateDOM(
      document.getElementById('debug-aurora'),
      `${_auroraLabelFn(auroraVal)} (${auroraVal.toFixed(3)})`
    );

    // Rainbow telemetry
    updateDOM(
      document.getElementById('debug-rainbow'),
      rainbowIntensity > 0 ? (rainbowIntensity * 100).toFixed(0) + '%' : '-'
    );
    updateDOM(
      document.getElementById('debug-aurora-peak'),
      `${_auroraLabelFn(_auroraSessionMax)} (${_auroraSessionMax.toFixed(3)})`
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
    const cpuMsEl = document.getElementById('debug-cpu-ms');
    if (cpuMsEl) {
      updateDOM(cpuMsEl, cpuMs.toFixed(1));
      // Warn at 24ms, Critical at 32ms (stuttering on 30fps cap)
      cpuMsEl.style.color = getPerfColor(cpuMs, 24, 32);
    }

    const heapEl = document.getElementById('debug-heap');
    if (heapEl) {
      if (performance.memory) {
        const heapMb = performance.memory.usedJSHeapSize / 1048576;
        updateDOM(heapEl, heapMb.toFixed(1));
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

      const drawCallsEl = document.getElementById('debug-draw-calls');
      if (drawCallsEl) {
        updateDOM(drawCallsEl, calls);
        drawCallsEl.style.color = getPerfColor(calls, 800, 1200);
      }

      const trianglesEl = document.getElementById('debug-triangles');
      if (trianglesEl) {
        updateDOM(trianglesEl, tris);
        trianglesEl.style.color = getPerfColor(tris, 800000, 1500000);
      }

      const geometriesEl = document.getElementById('debug-geometries');
      if (geometriesEl) {
        updateDOM(geometriesEl, geos);
        geometriesEl.style.color = getPerfColor(geos, 150, 250);
      }

      const texturesEl = document.getElementById('debug-textures');
      if (texturesEl) {
        updateDOM(texturesEl, texs);
        texturesEl.style.color = getPerfColor(texs, 15, 30);
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
      totalClouds = 0,
      totalRocks = 0,
      totalBushes = 0;
    let totalSnowmen = 0,
      totalCactus = 0,
      totalLighthouses = 0,
      totalCastles = 0,
      totalChunks = 0;
    let totalWindmills = 0,
      totalCampfires = 0;
    let totalBoats = 0,
      totalLilyPads = 0,
      totalPiers = 0,
      totalBirds = 0;
    const objectsVisible = ChillFlightLogic.SHOW_OBJECTS;
    chunks.forEach((cg) => {
      if (cg.userData.counts) {
        totalChunks += 1;
        if (objectsVisible) {
          totalTreesPine += cg.userData.counts.trees_pine || 0;
          totalTreesDecid += cg.userData.counts.trees_decid || 0;
          totalTreesPalm += cg.userData.counts.trees_palm || 0;
          totalTreesDead += cg.userData.counts.trees_dead || 0;
          totalTreesAutumn += cg.userData.counts.trees_autumn || 0;
          totalTreesCherry += cg.userData.counts.trees_cherry || 0;
          totalTreesYellowCortez += cg.userData.counts.trees_yellow_cortez || 0;
          totalHouses += cg.userData.counts.houses;
          totalClouds += cg.userData.counts.clouds;
          totalRocks += cg.userData.counts.rocks;
          totalBushes += cg.userData.counts.bushes;
          totalSnowmen += cg.userData.counts.snowmen || 0;
          totalCactus += cg.userData.counts.cactus || 0;
          totalLighthouses += cg.userData.counts.lighthouses || 0;
          totalCastles += cg.userData.counts.castles || 0;
          totalWindmills += cg.userData.counts.windmills || 0;
          totalCampfires += cg.userData.counts.campfires || 0;
          totalBoats += cg.userData.counts.boats || 0;
          totalLilyPads += cg.userData.counts.lily_pads || 0;
          totalPiers += cg.userData.counts.piers || 0;
          totalBirds += cg.userData.counts.birds || 0;
        }
      }
    });

    updateDOM(document.getElementById('debug-chunks'), totalChunks);
    updateDOM(document.getElementById('debug-trees-pine'), totalTreesPine);
    updateDOM(document.getElementById('debug-trees-decid'), totalTreesDecid);
    updateDOM(document.getElementById('debug-trees-palm'), totalTreesPalm);
    updateDOM(document.getElementById('debug-trees-dead'), totalTreesDead);
    updateDOM(document.getElementById('debug-trees-autumn'), totalTreesAutumn);
    updateDOM(document.getElementById('debug-trees-cherry'), totalTreesCherry);
    updateDOM(
      document.getElementById('debug-trees-yellow-cortez'),
      totalTreesYellowCortez
    );
    updateDOM(document.getElementById('debug-houses'), totalHouses);
    updateDOM(document.getElementById('debug-clouds'), totalClouds);
    updateDOM(document.getElementById('debug-rocks'), totalRocks);
    updateDOM(document.getElementById('debug-bushes'), totalBushes);
    updateDOM(document.getElementById('debug-snowmen'), totalSnowmen);
    updateDOM(document.getElementById('debug-cactus'), totalCactus);
    updateDOM(document.getElementById('debug-lighthouses'), totalLighthouses);
    updateDOM(document.getElementById('debug-castles'), totalCastles);
    updateDOM(document.getElementById('debug-windmills'), totalWindmills);
    updateDOM(document.getElementById('debug-campfires'), totalCampfires);
    updateDOM(document.getElementById('debug-boats'), totalBoats);
    updateDOM(document.getElementById('debug-lily-pads'), totalLilyPads);
    updateDOM(document.getElementById('debug-piers'), totalPiers);
    updateDOM(document.getElementById('debug-birds'), totalBirds);
  }
}

function updatePlayerList() {
  const listEl = document.getElementById('player-list');
  const containerEl = document.getElementById('online-players');
  if (!listEl || !containerEl) return;

  const players = [];
  // Self
  players.push({
    name: playerName,
    dist: 0,
    isSelf: true,
  });

  // Others
  if (typeof otherPlayers !== 'undefined') {
    const playerHeading = planeGroup.rotation.y;

    otherPlayers.forEach((p, uid) => {
      // In Three.js, North is -Z, South is +Z, East is +X, West is -X
      const deltaX = p.mesh.position.x - planeGroup.position.x;
      const deltaZ = p.mesh.position.z - planeGroup.position.z;
      const dist = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ) * 0.3048; // convert to meters roughly

      // Absolute angle from North (-Z), CCW positive
      let absoluteAngle = Math.atan2(-deltaX, -deltaZ);

      // Calculate relative angle (clockwise) for the arrow mapping
      let relativeAngle = playerHeading - absoluteAngle;

      // Normalize to [0, 2PI]
      while (relativeAngle < 0) relativeAngle += Math.PI * 2;
      while (relativeAngle >= Math.PI * 2) relativeAngle -= Math.PI * 2;

      // Map angle to 8 directions (45 deg each)
      // Arrows are ordered clockwise: Up, Up-Right, Right, etc.
      const arrowIdx = Math.floor(
        ((relativeAngle * (180 / Math.PI) + 22.5) % 360) / 45
      );
      const dirEmoji = _dirArrows[arrowIdx];

      players.push({
        uid: uid,
        name: p.name || 'Player',
        dist: dist,
        dir: dirEmoji,
        isSelf: false,
      });
    });
  }

  // Only show if there's more than one player (Self + at least one other)
  if (players.length > 1) {
    containerEl.classList.add('visible');
  } else {
    containerEl.classList.remove('visible');
  }

  // Sort by distance
  players.sort((a, b) => a.dist - b.dist);

  // Take top 5
  const top5 = players.slice(0, 5);

  // Render
  listEl.innerHTML = '';
  top5.forEach((p) => {
    const entry = document.createElement('div');
    entry.className = 'player-entry' + (p.isSelf ? ' player-self' : '');
    if (p.uid) entry.setAttribute('data-uid', p.uid);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = p.name;
    entry.appendChild(nameSpan);

    const info = document.createElement('div');
    info.className = 'player-info';

    const distSpan = document.createElement('span');
    distSpan.className = 'player-dist';
    distSpan.textContent = p.isSelf ? '-' : Math.round(p.dist) + 'm';
    info.appendChild(distSpan);

    const dirSpan = document.createElement('span');
    dirSpan.className = 'player-dir';
    dirSpan.textContent = p.isSelf ? '-' : p.dir;
    info.appendChild(dirSpan);

    entry.appendChild(info);
    listEl.appendChild(entry);
  });
}

// Start loop
window.onload = animate;

// --- KEY STATE ---
const keys = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
  Shift: false,
  Plus: false,
  Minus: false,
  Q: false,
  E: false,
};

// Double-tap detection for barrel roll and loops
const lastArrowTap = {ArrowLeft: 0, ArrowRight: 0, ArrowUp: 0, ArrowDown: 0};
const doubleTap = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
};
const tripleTap = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
};
const tapCount = {ArrowLeft: 0, ArrowRight: 0, ArrowUp: 0, ArrowDown: 0};
const DOUBLE_TAP_MS = 300;
let STEER_HOLD_THRESHOLD = window.STEER_HOLD_THRESHOLD || 100; // ms to wait before a tap becomes a hold for pitch/looping
const STUTTER_BUFFER_MS = window.STUTTER_BUFFER_MS || 0; // Only preserve hold state if configured (TV)
const lastKeyUpTime = {ArrowLeft: 0, ArrowRight: 0, ArrowUp: 0, ArrowDown: 0};

// Mobile controls
const btnUp = document.getElementById('mobile-spd-up');
const btnDown = document.getElementById('mobile-spd-down');

/* --- MOBILE ACTION MENU --- */
const menuContainer = document.getElementById('mobile-action-menu');
const menuTrigger = document.getElementById('mobile-menu-trigger');
const pauseTrigger = document.getElementById('mobile-pause-trigger');
const camToggle = document.getElementById('mobile-cam-toggle');
const radToggle = document.getElementById('mobile-rad-toggle');
const hdgtSub = document.getElementById('mobile-hdgt-sub');
const autoToggle = document.getElementById('mobile-auto-toggle');

function toggleAutopilot() {
  window.autopilotEnabled = !window.autopilotEnabled;
  const msg = window.autopilotEnabled
    ? 'AUTOPILOT ENABLED'
    : 'AUTOPILOT DISABLED';
  console.log(msg);

  const autoToggle = document.getElementById('mobile-auto-toggle');
  if (autoToggle) {
    if (window.autopilotEnabled) {
      autoToggle.classList.add('active');
    } else {
      autoToggle.classList.remove('active');
    }
  }

  const flightStatusEl = document.getElementById('flight-status');
  if (flightStatusEl) {
    if (window.autopilotEnabled) {
      flightStatusEl.textContent = 'A U T O P I L O T';
      flightStatusEl.style.color = '#e74c3c';
    } else {
      flightStatusEl.textContent = 'C H I L L - F L I G H T';
      flightStatusEl.style.color = ''; // Reset to default CSS color
    }
  }

  const centerMsg =
    document.getElementById('debug-fps') || document.querySelector('.title');
  if (centerMsg) {
    const oldText = centerMsg.textContent;
    centerMsg.textContent = msg;
    setTimeout(() => {
      if (centerMsg.textContent === msg) centerMsg.textContent = oldText;
    }, 2000);
  }
}

if (menuTrigger && menuContainer) {
  menuTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    menuContainer.classList.toggle('expanded');
  });
}

if (pauseTrigger) {
  pauseTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePause();
    menuContainer.classList.remove('expanded');
  });
}

if (camToggle) {
  camToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (cameraMode === 'follow') {
      cameraMode = 'first-person';
    } else if (cameraMode === 'first-person') {
      cameraMode = 'birds-eye-close';
    } else if (cameraMode === 'birds-eye-close') {
      cameraMode = 'birds-eye-far';
    } else if (cameraMode === 'birds-eye-far') {
      cameraMode = 'cinematic';
    } else {
      cameraMode = 'follow';
      cameraTransitionProgress = 0; // Reset progress to avoid bounce
    }
  });
}

if (radToggle) {
  radToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // If music is supposed to be on but is paused (likely blocked), try to play it
    if (musicEnabled && purrpleCatAudio.paused) {
      updateAudioPlayer(true);
    } else {
      setMusicEnabled(!musicEnabled);
    }
  });
}

if (hdgtSub) {
  hdgtSub.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (headlight.intensity === 0) {
      headlight.intensity = 2;
      headlightGlow.intensity = 0.1;
      hdgtSub.classList.add('active');
    } else {
      headlight.intensity = 0;
      headlightGlow.intensity = 0;
      hdgtSub.classList.remove('active');
    }
  });
}

if (autoToggle) {
  autoToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleAutopilot();
  });
}

// --- INPUT SAFETY GUARD ---
function resetSteering() {
  mouseX = 0;
  mouseY = 0;
  mouseControlActive = false;
}

document
  .querySelectorAll(
    '.mobile-btn, .sub-btn, #debug-menu, #debug-telemetry, #online-players, #cockpit-ui'
  )
  .forEach((btn) => {
    btn.addEventListener('mouseenter', resetSteering);
    btn.addEventListener(
      'touchstart',
      (e) => {
        resetSteering();
        // If it's a button, we might want to prevent default to stop system gestures
        if (
          e.currentTarget.classList.contains('mobile-btn') ||
          e.currentTarget.classList.contains('sub-btn')
        ) {
          // But only if we aren't using pointer events for the same thing elsewhere
        }
      },
      {passive: true}
    );
  });

if (btnUp) {
  const down = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    mouseControlActive = false; // Explicitly stop steering
    mouseX = 0;
    mouseY = 0;
    keys.Shift = true;
    keys.ArrowUp = true;
    keyPressStartTime.ArrowUp = performance.now();
  };
  const up = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const nowTime = performance.now();
    if (
      keyPressStartTime.ArrowUp > 0 &&
      nowTime - keyPressStartTime.ArrowUp < STEER_HOLD_THRESHOLD
    ) {
      const step = vehicleType === 'boat' ? 0.05 : 0.1;
      targetFlightSpeed += step;
      if (vehicleType === 'boat')
        targetFlightSpeed = Math.min(0.33, targetFlightSpeed);
      else
        targetFlightSpeed = Math.min(
          window.MAX_FLIGHT_SPEED_MULT || 3.3333333333333335,
          targetFlightSpeed
        );
    }
    keys.Shift = false;
    keys.ArrowUp = false;
    keyPressStartTime.ArrowUp = 0;
    doubleTap.ArrowUp = false;
  };
  btnUp.addEventListener('pointerdown', down);
  btnUp.addEventListener('pointerup', up);
  btnUp.addEventListener('pointercancel', up);
  btnUp.addEventListener('pointerleave', up);
  btnUp.addEventListener('touchstart', down);
  btnUp.addEventListener('touchend', up);
  btnUp.addEventListener('contextmenu', (e) => e.preventDefault());
}
if (btnDown) {
  const down = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    mouseControlActive = false; // Explicitly stop steering
    mouseX = 0;
    mouseY = 0;
    keys.Shift = true;
    keys.ArrowDown = true;
    keys.ArrowUp = false;
    keyPressStartTime.ArrowDown = performance.now();
  };
  const up = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const nowTime = performance.now();
    if (
      keyPressStartTime.ArrowDown > 0 &&
      nowTime - keyPressStartTime.ArrowDown < 250
    ) {
      const step = vehicleType === 'boat' ? 0.05 : 0.1;
      const prevSpeed = targetFlightSpeed;
      targetFlightSpeed -= step;
      if (vehicleType === 'boat') {
        if (prevSpeed > 0 && targetFlightSpeed < 0) targetFlightSpeed = 0;
        targetFlightSpeed = Math.max(-0.15, targetFlightSpeed);
      } else {
        targetFlightSpeed = Math.max(0, targetFlightSpeed);
      }
    }
    keys.Shift = false;
    keys.ArrowDown = false;
    keyPressStartTime.ArrowDown = 0;
    doubleTap.ArrowDown = false;
  };
  btnDown.addEventListener('pointerdown', down);
  btnDown.addEventListener('pointerup', up);
  btnDown.addEventListener('pointercancel', up);
  btnDown.addEventListener('pointerleave', up);
  btnDown.addEventListener('touchstart', down);
  btnDown.addEventListener('touchend', up);
  btnDown.addEventListener('contextmenu', (e) => e.preventDefault());
}

window.addEventListener('keydown', (e) => {
  if (isPaused) return;

  // Block flight controls if mobile action menu is expanded
  const menuContainer = document.getElementById('mobile-action-menu');
  if (menuContainer && menuContainer.classList.contains('expanded')) {
    return;
  }

  const key = e.key.toLowerCase();

  // Secret shooting star trigger
  if (key === 's' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    forceShootingStar = true;
    return;
  }

  // Secret rainbow trigger
  if (key === 'u' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    if (rainbowTimer > 0) {
      rainbowTimer = 0;
    } else {
      forceRainbow = true;
    }
    return;
  }

  // Camera mode toggle
  if (key === 'c' && !e.metaKey && !e.ctrlKey) {
    if (cameraMode === 'follow') {
      cameraMode = 'first-person';
    } else if (cameraMode === 'first-person') {
      cameraMode = 'birds-eye-close';
    } else if (cameraMode === 'birds-eye-close') {
      cameraMode = 'birds-eye-far';
    } else if (cameraMode === 'birds-eye-far') {
      cameraMode = 'cinematic';
      cinematicTimer = 0;
      currentCinematicIndex = 0;
    } else {
      cameraMode = 'follow';
      cameraTransitionProgress = 0; // Reset progress to avoid bounce
    }
    console.log('Camera mode switched to:', cameraMode);
    return;
  }

  // Autopilot toggle
  if (key === 'a' && e.shiftKey) {
    e.preventDefault();
    toggleAutopilot();
    return;
  }

  const keyMap = {
    arrowleft: 'ArrowLeft',
    a: 'ArrowLeft',
    arrowright: 'ArrowRight',
    d: 'ArrowRight',
    arrowup: 'ArrowUp',
    w: 'ArrowUp',
    arrowdown: 'ArrowDown',
    s: 'ArrowDown',
  };

  // Prevent arrow keys from scrolling the page (important on TV WebView)
  if (
    key === 'arrowup' ||
    key === 'arrowdown' ||
    key === 'arrowleft' ||
    key === 'arrowright'
  ) {
    e.preventDefault();
  }

  const action = keyMap[key];
  if (action) {
    // Exclude actions that have other Shift-modifiers (like Shift+A for autopilot, Shift+D for debug) or system modifiers (Cmd/Ctrl)
    const isConflict =
      (key === 'd' && e.shiftKey) ||
      (key === 'a' && e.shiftKey) ||
      e.metaKey ||
      e.ctrlKey;

    if (!isConflict) {
      const wasKeyPressed = keys[action];
      keys[action] = true;
      if (action === 'ArrowDown') keys.ArrowUp = false;

      if (!wasKeyPressed) {
        const now = performance.now();
        if (
          STUTTER_BUFFER_MS === 0 ||
          now - lastKeyUpTime[action] > STUTTER_BUFFER_MS
        ) {
          keyPressStartTime[action] = now;

          // Double-tap detection: only if NOT within stutter window of the previous key release
          const timeSinceLastUp = now - lastKeyUpTime[action];
          if (STUTTER_BUFFER_MS === 0 || timeSinceLastUp > STUTTER_BUFFER_MS) {
            if (now - lastArrowTap[action] < DOUBLE_TAP_MS) {
              tapCount[action] = (tapCount[action] || 0) + 1;
            } else {
              tapCount[action] = 1;
            }

            if (tapCount[action] === 2) {
              doubleTap[action] = true;
            } else if (tapCount[action] >= 3) {
              tripleTap[action] = true;
            }
            lastArrowTap[action] = now;
          }
        }

        // Keyboard taking control
        mouseControlActive = false;
        mouseX = 0;
        mouseY = 0;
      }
    }
  }

  if (e.key === 'Shift') keys.Shift = true;
  if (e.key === '+' || e.key === '=') keys.Plus = true;
  if (e.key === '-' || e.key === '_') keys.Minus = true;
  if (key === 'q') keys.Q = true;
  if (key === 'e') keys.E = true;

  if (
    (e.key === 'l' || e.key === 'L') &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey
  ) {
    if (headlight.intensity === 0) {
      headlight.intensity = 2;
      headlightGlow.intensity = 0.1;
      if (hdgtSub) hdgtSub.classList.add('active');
    } else {
      headlight.intensity = 0;
      headlightGlow.intensity = 0;
      if (hdgtSub) hdgtSub.classList.remove('active');
    }
  }

  if ((e.key === 'd' || e.key === 'D') && e.shiftKey) {
    const debugMenu = document.getElementById('debug-menu');
    const debugTelem = document.getElementById('debug-telemetry');
    const isOpening = debugMenu.style.display !== 'block';
    debugMenu.style.display = isOpening ? 'block' : 'none';
    if (debugTelem) debugTelem.style.display = isOpening ? 'block' : 'none';

    if (isOpening) resetSteering();

    if (window.firebaseDB && window.currentUserUid) {
      const _wp =
        window.currentWorldPrefix ||
        `world/${ChillFlightLogic.WORLD_SEED}_room_1`;
      if (isOpening) {
        import('https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js').then(
          ({remove, ref, goOffline}) => {
            remove(
              ref(window.firebaseDB, `${_wp}/players/` + window.currentUserUid)
            ).then(() => {
              goOffline(window.firebaseDB);
              if (typeof otherPlayers !== 'undefined')
                otherPlayers.forEach((p) => (p.mesh.visible = false));
              console.log(
                'Debug menu opened: Disconnected from Firebase multiplayer.'
              );
            });
          }
        );
      } else {
        import('https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js').then(
          ({goOnline, set, ref}) => {
            goOnline(window.firebaseDB);
            if (typeof otherPlayers !== 'undefined')
              otherPlayers.forEach((p) => (p.mesh.visible = true));
            const profileRef = ref(
              window.firebaseDB,
              `users/` + window.currentUserUid
            );
            const sessionRef = ref(
              window.firebaseDB,
              `${_wp}/players/` + window.currentUserUid
            );
            set(profileRef, {
              name: playerName,
              color: planeColor,
              updatedAt: new Date().toISOString(),
            });
            set(sessionRef, {
              name: playerName,
              color: planeColor,
              lastSeen: new Date().toISOString(),
            });
            const pos = planeGroup.position;
            const rot = planeGroup.rotation;
            set(
              ref(
                window.firebaseDB,
                `${_wp}/players/` + window.currentUserUid + '/position'
              ),
              {
                x: Number(pos.x.toFixed(1)),
                y: Number(pos.y.toFixed(1)),
                z: Number(pos.z.toFixed(1)),
                rotX: Number(rot.x.toFixed(3)),
                rotY: Number(rot.y.toFixed(3)),
                rotZ: Number(rot.z.toFixed(3)),
                speedMult: Number(flightSpeedMultiplier.toFixed(2)),
                headlightsOn: false,
                updatedAt: new Date().toISOString(),
              }
            );
            console.log(
              'Debug menu closed: Reconnected to Firebase multiplayer.'
            );
          }
        );
      }
    }
  }

  if (
    document.activeElement &&
    document.activeElement.tagName !== 'INPUT' &&
    !e.metaKey &&
    !e.ctrlKey
  ) {
    if (e.key === 'p' || e.key === 'P') {
      if (musicEnabled && purrpleCatAudio.paused) {
        updateAudioPlayer(true);
      } else {
        setMusicEnabled(!musicEnabled);
      }
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (isPaused) return;

  // Block flight control releases if menu is open (menu handles its own navigation)
  const menuContainer = document.getElementById('mobile-action-menu');
  if (menuContainer && menuContainer.classList.contains('expanded')) {
    return;
  }

  const key = e.key.toLowerCase();
  const keyMap = {
    arrowleft: 'ArrowLeft',
    a: 'ArrowLeft',
    arrowright: 'ArrowRight',
    d: 'ArrowRight',
    arrowup: 'ArrowUp',
    w: 'ArrowUp',
    arrowdown: 'ArrowDown',
    s: 'ArrowDown',
  };

  const action = keyMap[key];
  if (action) {
    const now = performance.now();
    const TAP_THRESHOLD = 200;

    if (action === 'ArrowLeft' || action === 'ArrowRight') {
      const heldTime = now - keyPressStartTime[action];
      if (heldTime < TAP_THRESHOLD) manualPitch = 0;
    }

    keys[action] = false;
    doubleTap[action] = false;
    if (typeof tripleTap !== 'undefined') tripleTap[action] = false;
    lastKeyUpTime[action] = now;
  }

  if (e.key === 'Shift') keys.Shift = false;
  if (e.key === '+' || e.key === '=') keys.Plus = false;
  if (e.key === '-' || e.key === '_') keys.Minus = false;
  if (key === 'q') keys.Q = false;
  if (key === 'e') keys.E = false;
});

window.addEventListener('blur', () => {
  mouseControlActive = false;
  windowJustFocused = false;
  for (let k in keys) keys[k] = false;
  console.log('Window blur: Resetting all keys and mouse control.');
});

window.addEventListener('focus', () => {
  windowJustFocused = true;
  if (typeof clock !== 'undefined') {
    clock.getDelta(); // This "consumes" the time passed while the tab was hidden
  }
});

// Debug menu speed buttons
document.querySelectorAll('.speed-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document
      .querySelectorAll('.speed-btn')
      .forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
    daySpeedMultiplier = parseFloat(e.target.getAttribute('data-speed'));
  });
});

// Time of day slider
const timeSlider = document.getElementById('debug-time-slider');
const timeSliderVal = document.getElementById('debug-time-val');
if (timeSlider) {
  timeSlider.addEventListener('input', (e) => {
    window.manualTimeOfDay = parseFloat(e.target.value);

    // Automatically pause time so the user can observe the time they set
    document
      .querySelectorAll('.speed-btn')
      .forEach((b) => b.classList.remove('active'));
    const zeroBtn = document.querySelector('.speed-btn[data-speed="0"]');
    if (zeroBtn) zeroBtn.classList.add('active');
    daySpeedMultiplier = 0;

    if (timeSliderVal) {
      const hours = window.manualTimeOfDay * 24;
      const hh = Math.floor(hours).toString().padStart(2, '0');
      const mm = Math.floor((hours % 1) * 60)
        .toString()
        .padStart(2, '0');
      timeSliderVal.textContent = `${hh}:${mm}`;
    }
  });
}

// --- DISMISS LOADING SCREEN ---
const overlay = document.getElementById('loading-overlay');
if (overlay) {
  const beginBtn = document.getElementById('begin-btn');

  const dismissLoadingScreen = (instant = false) => {
    if (instant) {
      overlay.style.display = 'none';
    } else {
      overlay.style.transition = 'opacity 2.5s ease-in-out';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      setTimeout(() => (overlay.style.display = 'none'), 2500);

      // Trigger cinematic camera transition
      if (!isFreeCamera) {
        isIntroTransitionActive = true;
        introTransitionStartTime = performance.now();
        _introCameraPosStart.copy(camera.position);
        _introLookTargetStart.copy(_currentLookTarget);
        _virtualCameraPos.copy(camera.position);
        _virtualLookTarget.copy(_currentLookTarget);
      }
    }

    // Unpause the game and clear the clock delta
    isPaused = false;
    justResumed = true;
    if (typeof clock !== 'undefined') clock.getDelta();

    // Start music! (Will respect the musicEnabled state)
    if (typeof setMusicEnabled === 'function') {
      setMusicEnabled(musicEnabled);
    }

    // Initialize onboarding
    initOnboarding(instant ? 0 : 4000);
  };

  const initOnboarding = (delay = 4000) => {
    // If the user has already been onboarded, do nothing
    if (localStorage.getItem('chill_flight_onboarded') === 'true') {
      return;
    }

    setTimeout(() => {
      const tooltip = document.getElementById('onboarding-tooltip');
      const dismissBtn = document.getElementById('onboarding-dismiss-btn');
      const menuTrigger = document.getElementById('mobile-menu-trigger');

      if (!tooltip || !menuTrigger) return;

      // Show onboarding tooltip and apply pulsating glow to caret trigger
      tooltip.classList.remove('hidden');
      tooltip.classList.add('visible');
      menuTrigger.classList.add('onboarding-glow');

      const dismissOnboarding = () => {
        // Save onboarding status
        localStorage.setItem('chill_flight_onboarded', 'true');

        // Fade out onboarding elements
        tooltip.classList.remove('visible');
        tooltip.classList.add('hidden');
        menuTrigger.classList.remove('onboarding-glow');

        // Clean up listeners
        if (dismissBtn) {
          dismissBtn.removeEventListener('click', handleDismiss);
        }
        menuTrigger.removeEventListener('click', handleTriggerClick);
      };

      const handleDismiss = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dismissOnboarding();
      };

      const handleTriggerClick = () => {
        // Direct interaction with caret dismisses onboarding immediately
        dismissOnboarding();
      };

      if (dismissBtn) {
        dismissBtn.addEventListener('click', handleDismiss);
      }
      menuTrigger.addEventListener('click', handleTriggerClick);
    }, delay);
  };

  const progressContainer = document.getElementById(
    'splash-progress-container'
  );
  const progressBar = document.getElementById('splash-progress-bar');
  const btnContainer = document.getElementById('splash-btn-container');
  const loadingAttrEl = document.getElementById('loading-music-attribution');

  if (loadingAttrEl) {
    loadingAttrEl.style.display = musicEnabled ? 'block' : 'none';
  }

  if (beginBtn) {
    beginBtn.addEventListener('click', () => {
      dismissLoadingScreen(false);
    });
  }

  // Always run the progress bar animation first
  if (progressContainer && progressBar) {
    progressContainer.classList.remove('hidden');
    progressContainer.classList.add('visible');

    const msgEl = document.getElementById('splash-loading-msg');
    const messages = [
      'Generating terrain chunks...',
      'Reticulating splines...',
      'Calculating flight paths...',
      'Have a chill flight.',
    ];

    setTimeout(() => {
      progressBar.style.width = '100%';

      if (msgEl) {
        // Cycle through first 3 messages quickly, leaving the final
        // message on screen until the 1500ms timer below hits.
        setTimeout(() => (msgEl.textContent = messages[1]), 300);
        setTimeout(() => (msgEl.textContent = messages[2]), 600);
        setTimeout(() => (msgEl.textContent = messages[3]), 900);
      }
    }, 50);

    // When progress finishes, decide next step
    setTimeout(() => {
      if (typeof musicEnabled !== 'undefined' && !musicEnabled) {
        // Auto-skip
        console.log('🎵 Music was paused last session. Auto-skipping.');
        dismissLoadingScreen(false);
      } else {
        // Start cross-fade: fade out progress, fade in button simultaneously
        const interactiveArea = document.getElementById(
          'splash-interactive-area'
        );
        if (interactiveArea) interactiveArea.classList.add('crossfading');

        progressContainer.classList.remove('visible');
        progressContainer.classList.add('hidden');

        if (btnContainer) {
          btnContainer.classList.remove('hidden');
          btnContainer.classList.add('visible');
          if (beginBtn) {
            // Focus after a short delay to allow transition to start
            setTimeout(() => beginBtn.focus(), 100);
          }
        }
      }
    }, 1500);
  } else {
    // Fallback if elements are missing
    if (typeof musicEnabled !== 'undefined' && !musicEnabled) {
      dismissLoadingScreen(true);
    } else if (btnContainer) {
      btnContainer.style.visibility = 'visible';
      btnContainer.style.opacity = '1';
    }
  }
}

function showStartPlaneTooltip() {
  if (startPlaneTooltipShown) return;
  startPlaneTooltipShown = true;
  localStorage.setItem('chill_flight_stopped_tooltip_shown', 'true');

  const tooltip = document.getElementById('start-plane-tooltip');
  const dismissBtn = document.getElementById('start-plane-dismiss-btn');
  const spdUpBtn = document.getElementById('mobile-spd-up');

  if (!tooltip || !spdUpBtn) return;

  // Show onboarding tooltip and apply pulsating glow to + trigger
  tooltip.classList.remove('hidden');
  tooltip.classList.add('visible');
  spdUpBtn.classList.add('onboarding-glow');

  const dismissStartPlaneTooltip = () => {
    tooltip.classList.remove('visible');
    tooltip.classList.add('hidden');
    spdUpBtn.classList.remove('onboarding-glow');

    // Clean up listeners
    if (dismissBtn) {
      dismissBtn.removeEventListener('click', handleDismiss);
    }
    spdUpBtn.removeEventListener('pointerdown', handleSpdUpInteraction);
    spdUpBtn.removeEventListener('touchstart', handleSpdUpInteraction);
    window.removeEventListener('keydown', handleKeyInteraction);
  };

  dismissStartPlaneTooltipFunc = dismissStartPlaneTooltip;

  const handleDismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dismissStartPlaneTooltip();
    dismissStartPlaneTooltipFunc = null;
  };

  const handleSpdUpInteraction = () => {
    dismissStartPlaneTooltip();
    dismissStartPlaneTooltipFunc = null;
  };

  const handleKeyInteraction = (e) => {
    const key = e.key.toLowerCase();
    // Dismiss on any keyboard interaction that increases speed
    if (
      e.key === '+' ||
      e.key === '=' ||
      e.key === 'Shift' ||
      key === 'arrowup' ||
      key === 'w'
    ) {
      dismissStartPlaneTooltip();
      dismissStartPlaneTooltipFunc = null;
    }
  };

  if (dismissBtn) {
    dismissBtn.addEventListener('click', handleDismiss);
  }
  spdUpBtn.addEventListener('pointerdown', handleSpdUpInteraction);
  spdUpBtn.addEventListener('touchstart', handleSpdUpInteraction);
  window.addEventListener('keydown', handleKeyInteraction);
}
