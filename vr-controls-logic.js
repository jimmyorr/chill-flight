// Pure WebXR / Quest Touch controller and bare-hand tracking helpers:
// dual-stick steering, virtual flight stick & throttle math, bare-hand pinch
// and fist-grip detection, cardinal stick double/triple-flick maneuvers,
// flight button edge latches, and 3D VR pause menu hit-testing and debouncing.

export const STICK_DEADZONE = 0.15;
// Matches InputManager.JOYSTICK_SENSITIVITY so full physical or virtual stick
// deflection produces 0.5 after game-loop.js stickResponse (37.5 deg cruise
// bank and 22.5 deg pitch, saving 78 deg sharp bank and steep pitch for flicks).
export const STICK_SENSITIVITY = 0.7167;
export const STICK_FLICK_ENTER = 0.78;
export const STICK_FLICK_EXIT = 0.35;
export const STICK_FLICK_DOMINANCE = 1.3;
export const STICK_FLICK_WINDOW_MS = 450;
export const GRIP_ROLL_ENTER = 0.65;
export const GRIP_ROLL_EXIT = 0.4;

// Virtual flight stick, throttle, and bare-hand tracking tuning constants
export const HAND_PINCH_ENTER = 0.022;
export const HAND_PINCH_EXIT = 0.032;
export const HAND_FIST_ENTER_RATIO = 1.25;
export const HAND_FIST_EXIT_RATIO = 1.42;
export const CONTROLLER_GRAB_RADIUS = 0.16;
export const VIRTUAL_STICK_MAX_TILT = 0.44; // ~25 deg wrist tilt for full throw
export const VIRTUAL_STICK_POS_SPAN = 0.14; // 14 cm horizontal translation span
export const VIRTUAL_STICK_VISUAL_MAX_RAD = 0.38;
export const VIRTUAL_STICK_SMOOTH_TAU = 0.035;
export const VIRTUAL_THROTTLE_SPAN = 0.14; // 14 cm idle-to-MAX travel
export const PAUSE_PILL_TOUCH_ENTER = 0.045;
export const PAUSE_PILL_TOUCH_EXIT = 0.065;

// Seated console resting offsets in local seat-yaw space (meters from eyes)
export const VR_STICK_HOME_OFFSET = {x: 0.2, y: -0.3, z: -0.36};
export const VR_THROTTLE_HOME_OFFSET = {x: -0.2, y: -0.3, z: -0.36};
export const VR_PAUSE_PILL_OFFSET = {x: 0.0, y: -0.32, z: -0.4};

/**
 * Builds the WebXR `requestSession('immersive-vr', sessionInit)` options.
 * Stationary `'local'` tracking is a built-in default feature of every
 * `'immersive-vr'` session and matches `renderer.xr.setReferenceSpaceType('local')`
 * in `sky.js`. Omitting `'bounded-floor'` and `'local-floor'` avoids triggering
 * Meta Quest / Horizon OS Roomscale vs. Stationary Guardian boundary prompts,
 * while `'hand-tracking'` in `optionalFeatures` unlocks controller-free play
 * and seamless controller-to-hand switching without requiring hand support.
 */
export function getVRSessionInit() {
  return {
    optionalFeatures: ['hand-tracking'],
  };
}

/**
 * Maps a raw [-1..1] physical or virtual stick axis to 0 inside `deadzone` and
 * linearly from `deadzone` to `maxOut` across the remaining travel so
 * `stickResponse` in game-loop.js starts smoothly from zero with no jump and
 * reaches gentle half-authority (37.5 deg bank, 22.5 deg pitch) at the rim.
 */
export function scaleThumbstickAxis(
  raw,
  deadzone = STICK_DEADZONE,
  maxOut = STICK_SENSITIVITY
) {
  const abs = Math.abs(raw);
  if (abs < deadzone) return 0;
  const span = Math.max(1e-6, 1 - deadzone);
  const u = Math.min(1, (abs - deadzone) / span);
  return Math.sign(raw) * (deadzone + u * (maxOut - deadzone));
}

/**
 * Recovers a full [buggyDeadzone..1] input for ChillFlightLogic's non-joystick
 * buggy curves from a scaled gamepad/VR thumbstick axis so the buggy reaches
 * 100% steering lock and boost/reverse smoothly at 100% stick throw instead of
 * saturating halfway.
 */
export function unscaleThumbstickForBuggy(
  scaled,
  buggyDeadzone,
  deadzone = STICK_DEADZONE,
  maxOut = STICK_SENSITIVITY
) {
  const abs = Math.abs(scaled);
  if (abs < deadzone) return 0;
  const span = Math.max(1e-6, maxOut - deadzone);
  const u = Math.min(1, (abs - deadzone) / span);
  return Math.sign(scaled) * (buggyDeadzone + u * (1 - buggyDeadzone));
}

function buttonValue(btn) {
  if (!btn) return 0;
  if (typeof btn.value === 'number') return btn.value;
  return btn.pressed ? 1 : 0;
}

function isPressed(gp, index) {
  return Boolean(gp?.buttons?.[index]?.pressed);
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function dist3(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Returns whether an XRSession is actively visible and focused for user input.
 * Meta Horizon OS sets `visibilityState` to `'visible-blurred'` while the
 * system universal menu is open and `'hidden'` when the headset is unmounted
 * (`VRC.Quest.Input.4`): input must be ignored until `'visible'` returns.
 */
export function isXRSessionVisible(session) {
  if (!session) return false;
  return !session.visibilityState || session.visibilityState === 'visible';
}

/**
 * Extracts left/right physical WebXR controller gamepads, bare-hand input
 * flags, and an optional fallback standard gamepad without duplicating XR
 * gamepads across arrays or mistaking synthetic 1-button hand gamepads for
 * analog triggers.
 */
export function extractXRControllers(session, fallbackGamepads = []) {
  if (session && !isXRSessionVisible(session)) {
    return {
      leftGp: null,
      rightGp: null,
      standardGp: null,
      hasXRGamepad: false,
      hasHandInput: false,
      leftHandPinch: false,
      rightHandPinch: false,
      handPinch: false,
    };
  }

  let leftGp = null;
  let rightGp = null;
  let hasHandInput = false;
  let leftHandPinch = false;
  let rightHandPinch = false;
  const xrGamepads = new Set();

  if (session && session.inputSources) {
    for (const source of session.inputSources) {
      if (!source) continue;
      const gp = source.gamepad;
      if (gp) xrGamepads.add(gp);

      if (source.hand) {
        hasHandInput = true;
        const pinched = Boolean(gp?.buttons?.[0]?.pressed);
        if (source.handedness === 'left') {
          leftHandPinch = leftHandPinch || pinched;
        } else {
          rightHandPinch = rightHandPinch || pinched;
        }
        continue;
      }

      if (!gp || gp.connected === false) continue;
      if (source.handedness === 'left') {
        leftGp = gp;
      } else if (source.handedness === 'right') {
        rightGp = gp;
      } else if (!rightGp) {
        rightGp = gp;
      }
    }
  }

  let standardGp = null;
  if (fallbackGamepads) {
    for (let i = 0; i < fallbackGamepads.length; i++) {
      const gp = fallbackGamepads[i];
      if (!gp || !gp.connected || xrGamepads.has(gp)) continue;
      if (
        gp.mapping === 'standard' ||
        (gp.buttons && gp.buttons.length >= 10)
      ) {
        standardGp = gp;
        break;
      }
    }
  }

  return {
    leftGp,
    rightGp,
    standardGp,
    hasXRGamepad: Boolean(leftGp || rightGp),
    hasHandInput,
    leftHandPinch,
    rightHandPinch,
    handPinch: Boolean(leftHandPinch || rightHandPinch),
  };
}

/**
 * Reads an xr-standard controller thumbstick, negating the raw Y axis so
 * pushing forward/up yields +1 (climb / buggy forward) and pulling back
 * yields -1 (dive / buggy reverse), matching mouse, touch, and keyboard.
 */
export function readXRThumbstick(gp) {
  if (!gp || !gp.axes || gp.axes.length < 2) return {x: 0, y: 0};
  if (gp.axes.length >= 4) {
    return {
      x: gp.axes[2] || 0,
      y: -(gp.axes[3] || 0) || 0,
    };
  }
  return {
    x: gp.axes[0] || 0,
    y: -(gp.axes[1] || 0) || 0,
  };
}

/**
 * Reads a standard W3C gamepad's analog sticks (picking whichever of left or
 * right stick is deflected further) with +Y = stick pushed up/forward.
 */
export function readStandardStick(gp) {
  if (!gp || !gp.axes || gp.axes.length < 2) return {x: 0, y: 0};
  const lx = gp.axes[0] || 0;
  const ly = -(gp.axes[1] || 0) || 0;
  if (gp.axes.length >= 4) {
    const rx = gp.axes[2] || 0;
    const ry = -(gp.axes[3] || 0) || 0;
    if (Math.hypot(rx, ry) > Math.hypot(lx, ly)) {
      return {x: rx, y: ry};
    }
  }
  return {x: lx, y: ly};
}

/**
 * Combines left and right VR thumbsticks (plus optional standard gamepad),
 * picking whichever stick currently has the largest radial deflection.
 */
export function readCombinedThumbstick(
  {leftGp, rightGp, standardGp},
  deadzone = STICK_DEADZONE
) {
  const left = readXRThumbstick(leftGp);
  const right = readXRThumbstick(rightGp);
  const std = readStandardStick(standardGp);

  let best = right;
  let bestMag = Math.hypot(right.x, right.y);

  const leftMag = Math.hypot(left.x, left.y);
  if (leftMag > bestMag) {
    best = left;
    bestMag = leftMag;
  }

  const stdMag = Math.hypot(std.x, std.y);
  if (stdMag > bestMag) {
    best = std;
  }

  const rawX = best.x;
  const rawY = best.y;
  const x = scaleThumbstickAxis(rawX, deadzone);
  const y = scaleThumbstickAxis(rawY, deadzone);

  return {
    rawX,
    rawY,
    x,
    y,
    active: x !== 0 || y !== 0,
  };
}

/**
 * Reads right/left analog trigger values (0..1) for throttle up and down.
 */
export function readXRTriggers({leftGp, rightGp, standardGp}) {
  if (leftGp || rightGp) {
    return {
      rt: buttonValue(rightGp?.buttons?.[0]),
      lt: buttonValue(leftGp?.buttons?.[0]),
    };
  }
  if (standardGp && standardGp.buttons) {
    const hasTriggers = standardGp.buttons.length >= 8;
    return {
      rt: buttonValue(
        hasTriggers ? standardGp.buttons[7] : standardGp.buttons[0]
      ),
      lt: buttonValue(
        hasTriggers ? standardGp.buttons[6] : standardGp.buttons[1]
      ),
    };
  }
  return {rt: 0, lt: 0};
}

function jointPos(joints, name) {
  const j = joints?.[name];
  if (!j || j.visible === false || !j.position) return null;
  return j.position;
}

/**
 * Detects whether a bare hand is raised with its palm facing the player's eyes
 * (the Meta Horizon OS system-menu gesture posture), computed purely from
 * wrist, index, and pinky positions so it is independent of joint quaternion
 * conventions across browsers.
 */
export function isPalmFacingHead(
  joints,
  handedness,
  headPos = {x: 0, y: 0, z: 0}
) {
  const wrist = jointPos(joints, 'wrist');
  const indexBase =
    jointPos(joints, 'index-finger-metacarpal') ||
    jointPos(joints, 'index-finger-phalanx-proximal');
  const pinkyBase =
    jointPos(joints, 'pinky-finger-metacarpal') ||
    jointPos(joints, 'pinky-finger-phalanx-proximal');
  if (!wrist || !indexBase || !pinkyBase || !headPos) return false;

  // Hands resting down in the lap are not performing the raised system gesture
  if (wrist.y - headPos.y < -0.26) return false;

  const ax = indexBase.x - wrist.x;
  const ay = indexBase.y - wrist.y;
  const az = indexBase.z - wrist.z;
  const bx = pinkyBase.x - wrist.x;
  const by = pinkyBase.y - wrist.y;
  const bz = pinkyBase.z - wrist.z;

  // Right hand: index x pinky points out of the palm; left hand is mirrored
  const sign = handedness === 'left' ? -1 : 1;
  const nx = sign * (ay * bz - az * by);
  const ny = sign * (az * bx - ax * bz);
  const nz = sign * (ax * by - ay * bx);
  const nLen = Math.hypot(nx, ny, nz);
  if (nLen < 1e-5) return false;

  const hx = headPos.x - wrist.x;
  const hy = headPos.y - wrist.y;
  const hz = headPos.z - wrist.z;
  const hLen = Math.hypot(hx, hy, hz);
  if (hLen < 1e-4) return false;

  const dot = (nx * hx + ny * hy + nz * hz) / (nLen * hLen);
  return dot > 0.72;
}

/**
 * Hysteretic index-to-thumb pinch detector from WebXR hand joints, with
 * fallback to a synthetic gamepad select button when joint tips are unavailable.
 */
export function evaluateHandPinch(
  joints,
  wasPinching = false,
  fallbackPressed = false
) {
  const indexTip = jointPos(joints, 'index-finger-tip');
  const thumbTip = jointPos(joints, 'thumb-tip');
  if (indexTip && thumbTip) {
    const d = dist3(indexTip, thumbTip);
    return d <= (wasPinching ? HAND_PINCH_EXIT : HAND_PINCH_ENTER);
  }
  return Boolean(fallbackPressed);
}

/**
 * Scale-invariant fist / grip curl detector: compares average middle, ring, and
 * pinky fingertip distance to the wrist against palm length so both small and
 * large hands can naturally close around the virtual flight stick or throttle.
 */
export function evaluateHandFist(joints, wasFist = false) {
  const wrist = jointPos(joints, 'wrist');
  const palmRef =
    jointPos(joints, 'middle-finger-metacarpal') ||
    jointPos(joints, 'middle-finger-phalanx-proximal');
  const midTip = jointPos(joints, 'middle-finger-tip');
  const ringTip = jointPos(joints, 'ring-finger-tip');
  const pinkyTip = jointPos(joints, 'pinky-finger-tip');
  if (!wrist || !palmRef || !midTip || !ringTip || !pinkyTip) return false;

  const palmLen = Math.max(0.04, dist3(wrist, palmRef));
  const avgTipDist =
    (dist3(wrist, midTip) + dist3(wrist, ringTip) + dist3(wrist, pinkyTip)) / 3;
  const ratio = avgTipDist / palmLen;
  return ratio <= (wasFist ? HAND_FIST_EXIT_RATIO : HAND_FIST_ENTER_RATIO);
}

/**
 * Unified bare-hand grab detector (accepts either index-thumb pinch or curled
 * fist grip, while rejecting fresh pinches aimed at a raised palm-to-face
 * system-menu posture).
 */
export function evaluateHandGrab(
  joints,
  handedness,
  headPos,
  wasGrabbing = false,
  fallbackPressed = false
) {
  if (!wasGrabbing && isPalmFacingHead(joints, handedness, headPos)) {
    return false;
  }
  return (
    evaluateHandPinch(joints, wasGrabbing, fallbackPressed) ||
    evaluateHandFist(joints, wasGrabbing)
  );
}

function toSeatSpaceVec(dx, dy, dz, seatYaw) {
  const c = Math.cos(seatYaw);
  const s = Math.sin(seatYaw);
  return {
    x: c * dx - s * dz,
    y: dy,
    z: s * dx + c * dz,
  };
}

function fromSeatSpaceVec(origin, localOffset, seatYaw) {
  const c = Math.cos(seatYaw);
  const s = Math.sin(seatYaw);
  return {
    x: origin.x + c * localOffset.x + s * localOffset.z,
    y: origin.y + localOffset.y,
    z: origin.z - s * localOffset.x + c * localOffset.z,
  };
}

function quatMultiply(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function quatNormalize(q) {
  const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return {x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len};
}

function toSeatSpaceQuat(q, seatYaw) {
  const half = -seatYaw * 0.5;
  const qYawInv = {x: 0, y: Math.sin(half), z: 0, w: Math.cos(half)};
  return quatNormalize(quatMultiply(qYawInv, q));
}

/**
 * Computes resting positions in `cameraDolly` space for the virtual flight
 * stick, virtual throttle, and center pause pill from the player's seated head
 * origin and horizontal yaw.
 */
export function computeVRConsolePose(
  seatOrigin = {x: 0, y: 0, z: 0},
  seatYaw = 0
) {
  return {
    stickHomePos: fromSeatSpaceVec(seatOrigin, VR_STICK_HOME_OFFSET, seatYaw),
    throttleHomePos: fromSeatSpaceVec(
      seatOrigin,
      VR_THROTTLE_HOME_OFFSET,
      seatYaw
    ),
    pausePillPos: fromSeatSpaceVec(seatOrigin, VR_PAUSE_PILL_OFFSET, seatYaw),
  };
}

/**
 * Computes normalized [-1..1] virtual flight stick axes from wrist tilt and
 * small hand translation relative to the pose where the player grabbed the
 * stick. Computing `qDelta = qNow * conjugate(qStart)` in seat-yaw space makes
 * pitch and roll invariant to the player's resting wrist angle on a chair
 * armrest or knee, with zero yaw twist cross-coupling.
 *
 * In planes (`!isBuggy`), pulling the 3D stick back (+Z) climbs (+rawY) and
 * pushing forward (-Z) dives (-rawY). In the buggy (`isBuggy`), pushing the
 * stick forward (-Z) accelerates (+rawY) and pulling back (+Z) brakes (-rawY).
 */
export function computeVirtualStickAxes({
  startPos,
  startQuat,
  currentPos,
  currentQuat,
  seatYaw = 0,
  isBuggy = false,
}) {
  let rollAngle = 0;
  let backAngle = 0;

  if (startQuat && currentQuat) {
    const q0 = toSeatSpaceQuat(startQuat, seatYaw);
    const q1 = toSeatSpaceQuat(currentQuat, seatYaw);
    const q0Conj = {x: -q0.x, y: -q0.y, z: -q0.z, w: q0.w};
    const qd = quatNormalize(quatMultiply(q1, q0Conj));

    // qd applied to unit up (0, 1, 0)
    const ux = 2 * (qd.x * qd.y - qd.w * qd.z);
    const uy = 1 - 2 * (qd.x * qd.x + qd.z * qd.z);
    const uz = 2 * (qd.y * qd.z + qd.w * qd.x);

    const safeUp = Math.max(0.15, uy);
    rollAngle = Math.atan2(ux, safeUp);
    backAngle = Math.atan2(uz, safeUp);
  }

  let posRoll = 0;
  let posBack = 0;
  if (startPos && currentPos) {
    const localDelta = toSeatSpaceVec(
      currentPos.x - startPos.x,
      currentPos.y - startPos.y,
      currentPos.z - startPos.z,
      seatYaw
    );
    posRoll = clamp(localDelta.x / VIRTUAL_STICK_POS_SPAN, -0.75, 0.75);
    posBack = clamp(localDelta.z / VIRTUAL_STICK_POS_SPAN, -0.75, 0.75);
  }

  const rawX = clamp(
    rollAngle / VIRTUAL_STICK_MAX_TILT + posRoll * 0.55,
    -1,
    1
  );
  const pullBack = clamp(
    backAngle / VIRTUAL_STICK_MAX_TILT + posBack * 0.55,
    -1,
    1
  );
  const rawY = isBuggy ? -pullBack : pullBack;

  return {
    rawX,
    rawY,
    visualPitch: pullBack * VIRTUAL_STICK_VISUAL_MAX_RAD,
    visualRoll: -rawX * VIRTUAL_STICK_VISUAL_MAX_RAD,
  };
}

/**
 * Computes relative cruise-hold throttle [0..1] by sliding along the seat's
 * forward (-Z) axis from the grab point, so grabbing never jumps current speed
 * and releasing leaves throttle parked at the chosen cruise setting.
 */
export function computeVirtualThrottle({
  startPos,
  currentPos,
  seatYaw = 0,
  startThrottle = 0,
}) {
  if (!startPos || !currentPos) return clamp(startThrottle, 0, 1);
  const localDelta = toSeatSpaceVec(
    currentPos.x - startPos.x,
    currentPos.y - startPos.y,
    currentPos.z - startPos.z,
    seatYaw
  );
  const deltaThrottle = -localDelta.z / VIRTUAL_THROTTLE_SPAN;
  return clamp(startThrottle + deltaThrottle, 0, 1);
}

export function isGripHeld(gp, wasHeld = false) {
  const btn = gp?.buttons?.[1];
  if (!btn) return false;
  const val = buttonValue(btn);
  return (
    Boolean(btn.pressed) || val >= (wasHeld ? GRIP_ROLL_EXIT : GRIP_ROLL_ENTER)
  );
}

/**
 * Stateful tracker for the VR virtual flight stick, off-hand cruise-hold
 * throttle, physical-controller proximity grabbing vs. lap grip maneuvers,
 * subtle haptic cues, and accidental-trigger-safe bare-hand pause button input.
 */
export function createVRVirtualControlsTracker() {
  let stickHolder = null; // 'left' | 'right' | null
  let stickStartPos = null;
  let stickStartQuat = null;
  let stickSmoothX = 0;
  let stickSmoothY = 0;
  let stickAtRim = false;
  let stickOutX = false;
  let stickOutY = false;

  let throttleHolder = null; // 'left' | 'right' | null
  let throttleStartPos = null;
  let throttleStartVal = 0;
  let throttleDetent = -1;

  const prevGrabbing = {left: false, right: false};
  const grabLatched = {left: false, right: false};
  const prevPinching = {left: false, right: false};
  const pinchLatched = {left: false, right: false};
  const fingerTouchLatched = {left: false, right: false};

  function releaseStick(haptics, holderIsController) {
    if (stickHolder && holderIsController) {
      haptics.push({side: stickHolder, intensity: 0.14, durationMs: 12});
    }
    stickHolder = null;
    stickStartPos = null;
    stickStartQuat = null;
    stickSmoothX = 0;
    stickSmoothY = 0;
    stickAtRim = false;
    stickOutX = false;
    stickOutY = false;
  }

  function releaseThrottle(haptics, holderIsController) {
    if (throttleHolder && holderIsController) {
      haptics.push({side: throttleHolder, intensity: 0.14, durationMs: 12});
    }
    throttleHolder = null;
    throttleStartPos = null;
    throttleDetent = -1;
  }

  function inSeatedComfortZone(pos, headPos) {
    if (!pos || !headPos) return false;
    const horiz = Math.hypot(pos.x - headPos.x, pos.z - headPos.z);
    const dy = pos.y - headPos.y;
    return horiz <= 0.85 && dy <= 0.15 && dy >= -0.8;
  }

  return {
    armGrabLatch(
      leftGrab = false,
      rightGrab = false,
      leftPinch = false,
      rightPinch = false
    ) {
      grabLatched.left = Boolean(leftGrab);
      grabLatched.right = Boolean(rightGrab);
      prevGrabbing.left = Boolean(leftGrab);
      prevGrabbing.right = Boolean(rightGrab);
      pinchLatched.left = Boolean(leftPinch);
      pinchLatched.right = Boolean(rightPinch);
      prevPinching.left = Boolean(leftPinch);
      prevPinching.right = Boolean(rightPinch);
      fingerTouchLatched.left = true;
      fingerTouchLatched.right = true;
      stickHolder = null;
      stickStartPos = null;
      stickStartQuat = null;
      stickSmoothX = 0;
      stickSmoothY = 0;
      stickAtRim = false;
      stickOutX = false;
      stickOutY = false;
      throttleHolder = null;
      throttleStartPos = null;
      throttleDetent = -1;
    },

    reset() {
      stickHolder = null;
      stickStartPos = null;
      stickStartQuat = null;
      stickSmoothX = 0;
      stickSmoothY = 0;
      stickAtRim = false;
      stickOutX = false;
      stickOutY = false;
      throttleHolder = null;
      throttleStartPos = null;
      throttleDetent = -1;
      prevGrabbing.left = false;
      prevGrabbing.right = false;
      grabLatched.left = false;
      grabLatched.right = false;
      prevPinching.left = false;
      prevPinching.right = false;
      pinchLatched.left = false;
      fingerTouchLatched.left = false;
      fingerTouchLatched.right = false;
    },

    update({
      left = {},
      right = {},
      headPos = {x: 0, y: 0, z: 0},
      seatOrigin = {x: 0, y: 0, z: 0},
      seatYaw = 0,
      currentThrottle = 0,
      isBuggy = false,
      delta = 1 / 60,
    } = {}) {
      const haptics = [];
      const consolePose = computeVRConsolePose(seatOrigin, seatYaw);
      const hands = {left, right};
      let pauseTriggered = false;

      // 1. Release active stick or throttle if holder disconnected or let go
      if (stickHolder) {
        const h = hands[stickHolder];
        if (!h?.connected || !h.grabbing || !h.gripPos) {
          releaseStick(haptics, Boolean(h && !h.isHand));
        }
      }
      if (throttleHolder) {
        const h = hands[throttleHolder];
        if (!h?.connected || !h.grabbing || !h.gripPos) {
          releaseThrottle(haptics, Boolean(h && !h.isHand));
        }
      }

      // 2. Check bare-hand pause pill (direct fingertip poke OR hover + fresh pinch)
      for (const side of ['left', 'right']) {
        const h = hands[side];
        if (!h?.connected) {
          fingerTouchLatched[side] = false;
          pinchLatched[side] = false;
          prevPinching[side] = false;
          continue;
        }
        const isHoldingControl =
          stickHolder === side || throttleHolder === side;

        if (h.isHand && h.indexTipPos && !isHoldingControl) {
          const dPill = dist3(h.indexTipPos, consolePose.pausePillPos);
          if (fingerTouchLatched[side]) {
            if (dPill > PAUSE_PILL_TOUCH_EXIT) {
              fingerTouchLatched[side] = false;
            }
          } else if (dPill <= PAUSE_PILL_TOUCH_ENTER) {
            fingerTouchLatched[side] = true;
            pauseTriggered = true;
          }
        } else if (!h.indexTipPos) {
          fingerTouchLatched[side] = false;
        }

        const pinching = Boolean(h.pinching);
        if (!pinching) pinchLatched[side] = false;
        const freshPinch =
          pinching && !prevPinching[side] && !pinchLatched[side];
        prevPinching[side] = pinching;

        if (
          h.isHand &&
          !isHoldingControl &&
          h.hoveringPausePill &&
          freshPinch
        ) {
          pauseTriggered = true;
          // Latch grab so this pause pinch never grabs stick or throttle
          grabLatched[side] = true;
        }
      }

      // 3. Process fresh grabs on Stick and Throttle (right first for stick, left first for throttle)
      for (const side of ['right', 'left']) {
        const h = hands[side];
        if (!h?.connected || !h.gripPos) {
          grabLatched[side] = false;
          prevGrabbing[side] = false;
          continue;
        }
        const grabbing = Boolean(h.grabbing);
        if (!grabbing) grabLatched[side] = false;
        const freshGrab = grabbing && !prevGrabbing[side] && !grabLatched[side];
        prevGrabbing[side] = grabbing;

        if (
          !freshGrab ||
          pauseTriggered ||
          stickHolder === side ||
          throttleHolder === side ||
          (h.isHand && h.hoveringPausePill)
        ) {
          continue;
        }

        const dStick = dist3(h.gripPos, consolePose.stickHomePos);
        const dThrottle = dist3(h.gripPos, consolePose.throttleHomePos);

        if (!h.isHand) {
          // Physical controllers grab only when reached onto the virtual handle,
          // preserving lap side-grips for sharp turns and barrel rolls.
          if (
            !stickHolder &&
            dStick <= CONTROLLER_GRAB_RADIUS &&
            dStick <= dThrottle
          ) {
            stickHolder = side;
            stickStartPos = {...h.gripPos};
            stickStartQuat = h.gripQuat ? {...h.gripQuat} : null;
            stickSmoothX = 0;
            stickSmoothY = 0;
            stickAtRim = false;
            stickOutX = false;
            stickOutY = false;
            haptics.push({side, intensity: 0.28, durationMs: 18});
          } else if (!throttleHolder && dThrottle <= CONTROLLER_GRAB_RADIUS) {
            throttleHolder = side;
            throttleStartPos = {...h.gripPos};
            throttleStartVal = clamp(currentThrottle, 0, 1);
            throttleDetent = Math.round(throttleStartVal * 4);
            haptics.push({side, intensity: 0.24, durationMs: 16});
          }
        } else {
          // Bare hands: direct proximity grab works for either hand (supporting
          // left-handed stick reach), while pinching/gripping anywhere in the
          // seated lap/armrest zone centers the right hand on Stick and left on Throttle.
          if (
            !stickHolder &&
            dStick <= CONTROLLER_GRAB_RADIUS &&
            dStick <= dThrottle
          ) {
            stickHolder = side;
            stickStartPos = {...h.gripPos};
            stickStartQuat = h.gripQuat ? {...h.gripQuat} : null;
            stickSmoothX = 0;
            stickSmoothY = 0;
            stickAtRim = false;
          } else if (!throttleHolder && dThrottle <= CONTROLLER_GRAB_RADIUS) {
            throttleHolder = side;
            throttleStartPos = {...h.gripPos};
            throttleStartVal = clamp(currentThrottle, 0, 1);
            throttleDetent = Math.round(throttleStartVal * 4);
          } else if (inSeatedComfortZone(h.gripPos, headPos)) {
            if (side === 'right' && !stickHolder) {
              stickHolder = 'right';
              stickStartPos = {...h.gripPos};
              stickStartQuat = h.gripQuat ? {...h.gripQuat} : null;
              stickSmoothX = 0;
              stickSmoothY = 0;
              stickAtRim = false;
            } else if (side === 'left' && !throttleHolder) {
              throttleHolder = 'left';
              throttleStartPos = {...h.gripPos};
              throttleStartVal = clamp(currentThrottle, 0, 1);
              throttleDetent = Math.round(throttleStartVal * 4);
            }
          }
        }
      }

      // 4. Evaluate active Virtual Stick output & haptics
      let rawX = 0;
      let rawY = 0;
      let x = 0;
      let y = 0;
      let visualPitch = 0;
      let visualRoll = 0;

      if (stickHolder) {
        const h = hands[stickHolder];
        const axes = computeVirtualStickAxes({
          startPos: stickStartPos,
          startQuat: stickStartQuat,
          currentPos: h.gripPos,
          currentQuat: h.gripQuat,
          seatYaw,
          isBuggy,
        });
        rawX = axes.rawX;
        rawY = axes.rawY;
        const alpha =
          delta > 0 ? 1 - Math.exp(-delta / VIRTUAL_STICK_SMOOTH_TAU) : 1;
        stickSmoothX += (rawX - stickSmoothX) * alpha;
        stickSmoothY += (rawY - stickSmoothY) * alpha;
        x = scaleThumbstickAxis(stickSmoothX, STICK_DEADZONE);
        y = scaleThumbstickAxis(stickSmoothY, STICK_DEADZONE);
        visualPitch = axes.visualPitch;
        visualRoll = axes.visualRoll;

        const mag = Math.hypot(rawX, rawY);
        if (!h.isHand) {
          let centeredPulse = false;
          if (!stickOutX && Math.abs(rawX) >= 0.16) {
            stickOutX = true;
          } else if (stickOutX && Math.abs(rawX) < 0.07) {
            stickOutX = false;
            centeredPulse = true;
          }
          if (!stickOutY && Math.abs(rawY) >= 0.16) {
            stickOutY = true;
          } else if (stickOutY && Math.abs(rawY) < 0.07) {
            stickOutY = false;
            centeredPulse = true;
          }
          if (centeredPulse) {
            haptics.push({side: stickHolder, intensity: 0.15, durationMs: 10});
          }
          if (!stickAtRim && mag >= 0.92) {
            stickAtRim = true;
            haptics.push({side: stickHolder, intensity: 0.1, durationMs: 10});
          } else if (stickAtRim && mag < 0.8) {
            stickAtRim = false;
          }
        }
      }

      // 5. Evaluate active Virtual Throttle output & haptics
      let throttleTarget = null;
      if (throttleHolder) {
        const h = hands[throttleHolder];
        throttleTarget = computeVirtualThrottle({
          startPos: throttleStartPos,
          currentPos: h.gripPos,
          seatYaw,
          startThrottle: throttleStartVal,
        });
        if (!h.isHand) {
          const detent = Math.round(throttleTarget * 4);
          if (detent !== throttleDetent) {
            throttleDetent = detent;
            haptics.push({
              side: throttleHolder,
              intensity: 0.1,
              durationMs: 10,
            });
          }
        }
      }

      return {
        pauseTriggered,
        stickHolder,
        stickActive: Boolean(stickHolder),
        stickAnchorPos: stickStartPos || consolePose.stickHomePos,
        rawX,
        rawY,
        x,
        y,
        visualPitch,
        visualRoll,
        throttleHolder,
        throttleAnchorPos: throttleStartPos || consolePose.throttleHomePos,
        throttleStartVal,
        throttleTarget,
        gripConsumedLeft: stickHolder === 'left' || throttleHolder === 'left',
        gripConsumedRight:
          stickHolder === 'right' || throttleHolder === 'right',
        consolePose,
        haptics,
      };
    },
  };
}

/**
 * Detects rapid cardinal double-flick and triple-flick gestures on a physical
 * or virtual stick so VR and gamepad players can trigger sharp turns, steep
 * climbs and dives, barrel rolls, vertical loops, Immelmann turns, and buggy hops.
 */
export function createStickFlickTracker(flickWindowMs = STICK_FLICK_WINDOW_MS) {
  let inZone = null;
  let activeGesture = null;
  const lastFlickTime = {
    ArrowLeft: 0,
    ArrowRight: 0,
    ArrowUp: 0,
    ArrowDown: 0,
  };
  const tapCount = {
    ArrowLeft: 0,
    ArrowRight: 0,
    ArrowUp: 0,
    ArrowDown: 0,
  };

  function isStillInZone(zone, rawX, rawY) {
    if (zone === 'ArrowLeft') return rawX <= -STICK_FLICK_EXIT;
    if (zone === 'ArrowRight') return rawX >= STICK_FLICK_EXIT;
    if (zone === 'ArrowUp') return rawY >= STICK_FLICK_EXIT;
    if (zone === 'ArrowDown') return rawY <= -STICK_FLICK_EXIT;
    return false;
  }

  function detectCardinalEntry(rawX, rawY) {
    const ax = Math.abs(rawX);
    const ay = Math.abs(rawY);
    if (ax >= STICK_FLICK_ENTER && ax > ay * STICK_FLICK_DOMINANCE) {
      return rawX < 0 ? 'ArrowLeft' : 'ArrowRight';
    }
    if (ay >= STICK_FLICK_ENTER && ay > ax * STICK_FLICK_DOMINANCE) {
      return rawY > 0 ? 'ArrowUp' : 'ArrowDown';
    }
    return null;
  }

  return {
    update(rawX, rawY, now) {
      let started = null;
      let released = null;

      if (inZone && !isStillInZone(inZone, rawX, rawY)) {
        inZone = null;
        if (activeGesture) {
          released = activeGesture;
          activeGesture = null;
        }
      }

      if (!inZone) {
        const entry = detectCardinalEntry(rawX, rawY);
        if (entry) {
          inZone = entry;
          const prev = lastFlickTime[entry];
          if (prev > 0 && now - prev < flickWindowMs) {
            tapCount[entry] = (tapCount[entry] || 0) + 1;
          } else {
            tapCount[entry] = 1;
          }
          lastFlickTime[entry] = now;

          if (tapCount[entry] === 2) {
            activeGesture = {action: entry, count: 2};
            started = activeGesture;
          } else if (tapCount[entry] >= 3) {
            activeGesture = {action: entry, count: 3};
            tapCount[entry] = 0;
            started = activeGesture;
          }
        }
      }

      return {
        started,
        released,
        activeAction: activeGesture ? activeGesture.action : null,
        activeCount: activeGesture ? activeGesture.count : 0,
      };
    },

    reset() {
      const released = activeGesture;
      inZone = null;
      activeGesture = null;
      for (const k of Object.keys(tapCount)) {
        tapCount[k] = 0;
        lastFlickTime[k] = 0;
      }
      return released;
    },
  };
}

/**
 * Edge-latched tracker for Quest Touch in-flight face buttons, pause button,
 * and side-grip maneuvers:
 * - Right A (4): Camera (follow <-> first-person)
 * - Right B (5): Headlight
 * - Left X (4): Switch vehicle
 * - Left Y (5): Pause / Resume
 * - Left / Right side grips (1): Single squeeze & hold for sharp turn (+1 / -1);
 *   double squeeze & hold for barrel roll (+1 / -1) when not holding the
 *   virtual stick or throttle
 * Thumbstick clicks (3) are intentionally left unset to avoid accidental
 * inputs while flicking sticks.
 */
export function createVRButtonTracker(gripWindowMs = STICK_FLICK_WINDOW_MS) {
  let pauseHeld = false;
  let cameraHeld = false;
  let headlightHeld = false;
  let planeHeld = false;
  let leftGripHeld = false;
  let rightGripHeld = false;
  let leftGripPauseLatch = false;
  let rightGripPauseLatch = false;
  let leftGripTapCount = 0;
  let rightGripTapCount = 0;
  let leftGripLastSqueeze = -Infinity;
  let rightGripLastSqueeze = -Infinity;

  function defaultNow() {
    return typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function readFlightStates({leftGp, rightGp}) {
    return {
      camera: isPressed(rightGp, 4), // Quest Right A
      headlight: isPressed(rightGp, 5), // Quest Right B
      plane: isPressed(leftGp, 4), // Quest Left X
    };
  }

  return {
    pollPause({leftGp, standardGp}) {
      const pressed =
        isPressed(leftGp, 5) || // Quest Left Y
        isPressed(standardGp, 9); // Standard Start/Menu
      const triggered = pressed && !pauseHeld;
      pauseHeld = pressed;
      return triggered;
    },

    syncFlightHeld(controllers) {
      const next = readFlightStates(controllers);
      cameraHeld = next.camera;
      headlightHeld = next.headlight;
      planeHeld = next.plane;
      leftGripPauseLatch = isGripHeld(
        controllers?.leftGp,
        leftGripHeld || leftGripPauseLatch
      );
      rightGripPauseLatch = isGripHeld(
        controllers?.rightGp,
        rightGripHeld || rightGripPauseLatch
      );
      leftGripHeld = false;
      rightGripHeld = false;
      leftGripTapCount = 0;
      rightGripTapCount = 0;
      leftGripLastSqueeze = -Infinity;
      rightGripLastSqueeze = -Infinity;
    },

    pollFlightButtons(
      controllers,
      now = defaultNow(),
      {suppressLeftGrip = false, suppressRightGrip = false} = {}
    ) {
      const next = readFlightStates(controllers);
      const rawLeftGrip = isGripHeld(
        controllers?.leftGp,
        leftGripHeld || leftGripPauseLatch
      );
      const rawRightGrip = isGripHeld(
        controllers?.rightGp,
        rightGripHeld || rightGripPauseLatch
      );
      if (suppressLeftGrip) leftGripPauseLatch = rawLeftGrip;
      if (suppressRightGrip) rightGripPauseLatch = rawRightGrip;
      if (!rawLeftGrip) leftGripPauseLatch = false;
      if (!rawRightGrip) rightGripPauseLatch = false;

      const nextLeftHeld =
        rawLeftGrip && !leftGripPauseLatch && !suppressLeftGrip;
      const nextRightHeld =
        rawRightGrip && !rightGripPauseLatch && !suppressRightGrip;

      if (nextLeftHeld && !leftGripHeld) {
        leftGripTapCount =
          now - leftGripLastSqueeze < gripWindowMs ? leftGripTapCount + 1 : 1;
        leftGripLastSqueeze = now;
      }
      if (nextRightHeld && !rightGripHeld) {
        rightGripTapCount =
          now - rightGripLastSqueeze < gripWindowMs ? rightGripTapCount + 1 : 1;
        rightGripLastSqueeze = now;
      }

      leftGripHeld = nextLeftHeld;
      rightGripHeld = nextRightHeld;

      let gripTurn = 0;
      let gripRoll = 0;
      if (leftGripHeld !== rightGripHeld) {
        const dir = leftGripHeld ? 1 : -1;
        const count = leftGripHeld ? leftGripTapCount : rightGripTapCount;
        if (count >= 2) {
          gripRoll = dir;
        } else {
          gripTurn = dir;
        }
      }

      const events = {
        camera: next.camera && !cameraHeld,
        headlight: next.headlight && !headlightHeld,
        plane: next.plane && !planeHeld,
        gripTurn,
        gripRoll,
      };
      cameraHeld = next.camera;
      headlightHeld = next.headlight;
      planeHeld = next.plane;
      return events;
    },

    reset() {
      pauseHeld = false;
      cameraHeld = false;
      headlightHeld = false;
      planeHeld = false;
      leftGripHeld = false;
      rightGripHeld = false;
      leftGripPauseLatch = false;
      rightGripPauseLatch = false;
      leftGripTapCount = 0;
      rightGripTapCount = 0;
      leftGripLastSqueeze = -Infinity;
      rightGripLastSqueeze = -Infinity;
    },
  };
}

/**
 * Maps UV coordinates on the 1024x680 VR pause card mesh to button index:
 * 0 = Resume flight, 1 = Map (in-VR 3D world map), 2 = Exit VR,
 * 3 = Camera pill, 4 = Vehicle pill, 5 = Lights pill, 6 = Stick mode pill,
 * -1 = outside.
 */
export function hitTestVRPauseMenuUV(u, v) {
  if (typeof u !== 'number' || typeof v !== 'number') return -1;
  const cx = u * 1024;
  const cy = (1.0 - v) * 680;
  if (cx >= 160 && cx <= 864) {
    if (cy >= 178 && cy <= 260) return 0;
    if (cy >= 272 && cy <= 354) return 1;
    if (cy >= 366 && cy <= 448) return 2;
    if (cy >= 462 && cy <= 526) {
      if (cx <= 328) return 3;
      if (cx >= 340 && cx <= 506) return 4;
      if (cx >= 518 && cx <= 684) return 5;
      if (cx >= 696) return 6;
    }
  }
  return -1;
}

/**
 * Logical 1024x680 coordinate layout shared by VR map card rendering and UV
 * raycast hit-testing so drawn buttons and interactive bounds stay in sync.
 */
export const VR_MAP_LAYOUT = {
  canvasW: 1024,
  canvasH: 680,
  card: {x: 24, y: 14, w: 976, h: 652, r: 30},
  backBtn: {x: 36, y: 24, w: 176, h: 46, r: 14},
  resumeBtn: {x: 752, y: 24, w: 236, h: 46, r: 14},
  viewport: {x: 36, y: 78, w: 952, h: 508, r: 18},
  zoomInBtn: {x: 924, y: 396, w: 52, h: 52, r: 14},
  zoomOutBtn: {x: 924, y: 456, w: 52, h: 52, r: 14},
  recenterBtn: {x: 924, y: 522, w: 52, h: 52, r: 14},
  controlsGuard: {x: 916, y: 390, w: 72, h: 196},
  waypointWithWarpBtn: {x: 526, y: 598, w: 200, h: 52, r: 14},
  warpBtn: {x: 736, y: 598, w: 190, h: 52, r: 14},
  waypointNoWarpBtn: {x: 716, y: 598, w: 210, h: 52, r: 14},
  clearPinBtn: {x: 936, y: 598, w: 52, h: 52, r: 14},
  clearWaypointBtn: {x: 768, y: 598, w: 220, h: 52, r: 14},
};

function pointInRect(cx, cy, rect) {
  return (
    cx >= rect.x &&
    cx <= rect.x + rect.w &&
    cy >= rect.y &&
    cy <= rect.y + rect.h
  );
}

/**
 * Maps UV coordinates on the 1024x680 VR map card mesh to an interactive target:
 * `'back'`, `'resume'`, `'zoomIn'`, `'zoomOut'`, `'recenter'`, `'viewport'`,
 * `'warp'`, `'waypoint'`, `'clearPin'`, or `null`.
 */
export function hitTestVRMapUV(
  u,
  v,
  {hasPin = false, hasWaypoint = false, canWarp = true} = {}
) {
  if (typeof u !== 'number' || typeof v !== 'number') return null;
  const cx = u * VR_MAP_LAYOUT.canvasW;
  const cy = (1.0 - v) * VR_MAP_LAYOUT.canvasH;

  if (pointInRect(cx, cy, VR_MAP_LAYOUT.backBtn)) return 'back';
  if (pointInRect(cx, cy, VR_MAP_LAYOUT.resumeBtn)) return 'resume';
  if (pointInRect(cx, cy, VR_MAP_LAYOUT.zoomInBtn)) return 'zoomIn';
  if (pointInRect(cx, cy, VR_MAP_LAYOUT.zoomOutBtn)) return 'zoomOut';
  if (pointInRect(cx, cy, VR_MAP_LAYOUT.recenterBtn)) return 'recenter';
  if (pointInRect(cx, cy, VR_MAP_LAYOUT.controlsGuard)) return null;
  if (pointInRect(cx, cy, VR_MAP_LAYOUT.viewport)) return 'viewport';

  if (hasPin) {
    if (pointInRect(cx, cy, VR_MAP_LAYOUT.clearPinBtn)) return 'clearPin';
    if (canWarp) {
      if (pointInRect(cx, cy, VR_MAP_LAYOUT.warpBtn)) return 'warp';
      if (pointInRect(cx, cy, VR_MAP_LAYOUT.waypointWithWarpBtn)) {
        return 'waypoint';
      }
    } else if (pointInRect(cx, cy, VR_MAP_LAYOUT.waypointNoWarpBtn)) {
      return 'waypoint';
    }
  } else if (
    hasWaypoint &&
    pointInRect(cx, cy, VR_MAP_LAYOUT.clearWaypointBtn)
  ) {
    return 'waypoint';
  }

  return null;
}

/**
 * Converts card UV coordinates `[0..1]` into normalized map-viewport offsets
 * `[-0.5..0.5]` relative to the center of `VR_MAP_LAYOUT.viewport`.
 */
export function uvToVRMapViewportNorm(u, v) {
  const cx = u * VR_MAP_LAYOUT.canvasW;
  const cy = (1.0 - v) * VR_MAP_LAYOUT.canvasH;
  const vp = VR_MAP_LAYOUT.viewport;
  return {
    normX: (cx - vp.x) / vp.w - 0.5,
    normY: (cy - vp.y) / vp.h - 0.5,
  };
}

function shapeMapPanAxis(raw, deadzone) {
  const abs = Math.abs(raw);
  if (abs < deadzone) return 0;
  const u = Math.min(1, (abs - deadzone) / Math.max(1e-6, 1 - deadzone));
  return Math.sign(raw) * (0.35 * u + 0.65 * u * u);
}

/**
 * Reads either VR thumbstick (or fallback standard gamepad stick) for smooth
 * 2D world-map panning (`+x` = East, `+y` = North) with fine center precision.
 */
export function readVRMapPanStick(
  {leftGp, rightGp, standardGp} = {},
  deadzone = STICK_DEADZONE
) {
  const left = readXRThumbstick(leftGp);
  const right = readXRThumbstick(rightGp);
  const std = readStandardStick(standardGp);

  let best = right;
  let bestMag = Math.hypot(right.x, right.y);

  const leftMag = Math.hypot(left.x, left.y);
  if (leftMag > bestMag) {
    best = left;
    bestMag = leftMag;
  }

  const stdMag = Math.hypot(std.x, std.y);
  if (stdMag > bestMag) {
    best = std;
  }

  const x = shapeMapPanAxis(best.x, deadzone);
  const y = shapeMapPanAxis(best.y, deadzone);
  return {
    x,
    y,
    active: x !== 0 || y !== 0,
  };
}

const GRIP_MAP_DEADZONE = 0.2;

function readMapGripZoom(gp, isLatched) {
  const btn = gp?.buttons?.[1];
  if (!btn) return {rawHeld: false, zoom: 0};
  const val = buttonValue(btn);
  const rawHeld = Boolean(btn.pressed) || val >= GRIP_MAP_DEADZONE;
  if (!rawHeld || isLatched) return {rawHeld, zoom: 0};
  const norm =
    btn.pressed && val <= GRIP_MAP_DEADZONE
      ? 1
      : Math.min(1, (val - GRIP_MAP_DEADZONE) / (1 - GRIP_MAP_DEADZONE));
  return {rawHeld: true, zoom: norm};
}

function resolveHandTarget(hoveredOrByHand, hand) {
  if (
    hoveredOrByHand &&
    typeof hoveredOrByHand === 'object' &&
    ('left' in hoveredOrByHand ||
      'right' in hoveredOrByHand ||
      'any' in hoveredOrByHand)
  ) {
    const specific = hoveredOrByHand[hand];
    return specific !== undefined && specific !== null && specific !== -1
      ? specific
      : hoveredOrByHand.any;
  }
  return hoveredOrByHand;
}

/**
 * State-wide button and bare-hand pinch latch for the 3D VR pause and map cards.
 * Calling `arm(controllers)` when a card opens latches any currently held
 * buttons or bare-hand pinches so they must be released before firing an action
 * on the new card.
 */
export function createVRPauseInputLatch() {
  let leftTriggerLatched = false;
  let rightTriggerLatched = false;
  let resumeLatched = false;
  let exitLatched = false;
  let leftGripLatched = false;
  let rightGripLatched = false;

  function readStates({
    leftGp,
    rightGp,
    standardGp,
    leftHandPinch = false,
    rightHandPinch = false,
    handPinch = false,
  } = {}) {
    return {
      leftTrigger: Boolean(leftHandPinch) || isPressed(leftGp, 0),
      rightTrigger:
        Boolean(rightHandPinch || (!leftHandPinch && handPinch)) ||
        isPressed(rightGp, 0),
      resume:
        isPressed(rightGp, 4) || // Right A
        isPressed(standardGp, 0), // Standard Gamepad A
      exit:
        isPressed(rightGp, 5) || // Right B
        isPressed(standardGp, 1), // Standard Gamepad B
      leftGrip: leftGp,
      rightGrip: rightGp,
    };
  }

  return {
    arm(controllers) {
      const cur = readStates(controllers);
      leftTriggerLatched = cur.leftTrigger;
      rightTriggerLatched = cur.rightTrigger;
      resumeLatched = cur.resume;
      exitLatched = cur.exit;
      leftGripLatched = readMapGripZoom(cur.leftGrip, false).rawHeld;
      rightGripLatched = readMapGripZoom(cur.rightGrip, false).rawHeld;
    },

    poll(controllers, hoveredButton) {
      const cur = readStates(controllers);
      const freshRightTrigger = cur.rightTrigger && !rightTriggerLatched;
      const freshLeftTrigger = cur.leftTrigger && !leftTriggerLatched;
      const freshResume = cur.resume && !resumeLatched;
      const freshExit = cur.exit && !exitLatched;

      leftTriggerLatched = cur.leftTrigger;
      rightTriggerLatched = cur.rightTrigger;
      resumeLatched = cur.resume;
      exitLatched = cur.exit;

      if (freshRightTrigger || freshLeftTrigger) {
        const hand = freshRightTrigger ? 'right' : 'left';
        const btn = resolveHandTarget(hoveredButton, hand);
        if (btn === 0) return 'resume';
        if (btn === 1) return 'map';
        if (btn === 2) return 'exit';
        if (btn === 3) return 'camera';
        if (btn === 4) return 'plane';
        if (btn === 5) return 'headlight';
        if (btn === 6) return 'stickMode';
      }
      if (freshExit) return 'exit';
      if (freshResume) return 'resume';
      return null;
    },

    pollMap(controllers, hoveredTarget) {
      const cur = readStates(controllers);
      const freshRightTrigger = cur.rightTrigger && !rightTriggerLatched;
      const freshLeftTrigger = cur.leftTrigger && !leftTriggerLatched;
      const freshResume = cur.resume && !resumeLatched;
      const freshExit = cur.exit && !exitLatched;

      leftTriggerLatched = cur.leftTrigger;
      rightTriggerLatched = cur.rightTrigger;
      resumeLatched = cur.resume;
      exitLatched = cur.exit;

      const leftG = readMapGripZoom(cur.leftGrip, leftGripLatched);
      const rightG = readMapGripZoom(cur.rightGrip, rightGripLatched);
      if (!leftG.rawHeld) leftGripLatched = false;
      if (!rightG.rawHeld) rightGripLatched = false;
      const gripZoom = rightG.zoom - leftG.zoom;

      let action = null;
      let hand = null;
      if (freshRightTrigger || freshLeftTrigger) {
        hand = freshRightTrigger ? 'right' : 'left';
        const target = resolveHandTarget(hoveredTarget, hand);
        if (target) {
          action = target;
        }
      }
      if (!action && freshExit) {
        action = 'back';
      } else if (!action && freshResume) {
        action = 'resume';
      }

      return {action, hand, gripZoom};
    },

    reset() {
      leftTriggerLatched = false;
      rightTriggerLatched = false;
      resumeLatched = false;
      exitLatched = false;
      leftGripLatched = false;
      rightGripLatched = false;
    },
  };
}

// --- VR SIM STICK FLIGHT MODEL ---
// Rate-command ("sim stick" / Ultrawings style) aircraft attitude model for VR:
// sideways stick controls roll rate (and holds the bank angle when centered),
// pulling back pulls the nose toward the aircraft's roof (carving coordinated
// banked turns or loops), and pushing forward pitches toward the belly.
export const VR_SIM_STICK = {
  CURVE: 0.5,
  PULL_RATE: 1.65,
  PUSH_SHARE: 0.65,
  ROLL_EASE_SECONDS: 0.07,
  PULL_EASE_SECONDS: 0.08,
  // Returning the stick to neutral within NOTCH of wings-level (or inverted)
  // settles cleanly onto that attitude over NOTCH_SECONDS without hunting.
  NOTCH: (8 * Math.PI) / 180,
  NOTCH_SECONDS: 0.28,
  // Gentle longitudinal weathercock trim toward level cruise when elevator is
  // centered, slow enough that steady climbs and runway glides stay planted.
  RELAX: 0.35,
  // Subtle banked lift loss (0.5 * (1 - cos(bank))) tucks the nose slightly
  // in steep banks or inverted flight unless balanced with elevator pressure.
  BANK_NOSE_DROP: 0.16,
  // Coordinated horizontal turn component from tilted cruise wing lift.
  BANK_TURN: 0.35,
  // Optional rudder yaw rate (rad/s) from lap controller side grips.
  RUDDER_RATE: 0.55,
  // Gentle trainer-wing dihedral recovery when hands are completely off all
  // controls for several seconds (never fires while holding the stick).
  RESCUE_SECONDS: 4.0,
  RESCUE_EASE_SECONDS: 1.8,
  RESCUE_RATE: 0.85,
  LOOP_FROM: (60 * Math.PI) / 180,
  LOOP_TO: (45 * Math.PI) / 180,
  LOOP_CARRY: 0.8,
  LIMIT_RATE: 4.0,
};

const SIM_TAU = Math.PI * 2;

function simWrapAngle(a) {
  return a - SIM_TAU * Math.round(a / SIM_TAU);
}

function simSmoothstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  const t = (x - min) / (max - min);
  return t * t * (3 - 2 * t);
}

function quatFromRotVec(rx, ry, rz) {
  const angle = Math.hypot(rx, ry, rz);
  if (angle < 1e-9) {
    return {x: rx * 0.5, y: ry * 0.5, z: rz * 0.5, w: 1};
  }
  const s = Math.sin(angle * 0.5) / angle;
  return {x: rx * s, y: ry * s, z: rz * s, w: Math.cos(angle * 0.5)};
}

/**
 * Unscales a `scaleThumbstickAxis` output `[deadzone..maxOut]` cleanly back to
 * `[-1..1]` with zero step jump at the deadzone edge and applies a cubic
 * fine-control curve near neutral.
 */
export function simStickAxisResponse(
  scaled,
  deadzone = STICK_DEADZONE,
  maxOut = STICK_SENSITIVITY
) {
  const abs = Math.abs(scaled);
  if (abs <= deadzone) return 0;
  const span = Math.max(1e-6, maxOut - deadzone);
  const u = Math.min(1, (abs - deadzone) / span);
  return (
    Math.sign(scaled) *
    ((1 - VR_SIM_STICK.CURVE) * u + VR_SIM_STICK.CURVE * u * u * u)
  );
}

/**
 * Extracts Three.js `'YXZ'` pitch, yaw, roll, and upright cosine (`+1` upright,
 * `-1` inverted) from a unit quaternion `{x, y, z, w}`.
 */
export function attitudeOfQuat(q) {
  const {x, y, z, w} = q;
  const m13 = 2 * (x * z + w * y);
  const m23 = 2 * (y * z - w * x);
  const m33 = 1 - 2 * (x * x + y * y);
  const m21 = 2 * (x * y + w * z);
  const m22 = 1 - 2 * (x * x + z * z);
  const pitch = Math.asin(-clamp(m23, -1, 1));
  let yaw;
  let roll;
  if (Math.abs(m23) < 0.9999999) {
    yaw = Math.atan2(m13, m33);
    roll = Math.atan2(m21, m22);
  } else {
    yaw = Math.atan2(-2 * (x * z - w * y), 1 - 2 * (y * y + z * z));
    roll = 0;
  }
  return {pitch, yaw, roll, upright: m22};
}

/**
 * Builds a unit quaternion `{x, y, z, w}` from Three.js `'YXZ'` Euler angles.
 */
export function quatFromAttitude(pitch, yaw, roll) {
  return quatNormalize(
    quatMultiply(
      quatMultiply(quatFromRotVec(0, yaw, 0), quatFromRotVec(pitch, 0, 0)),
      quatFromRotVec(0, 0, roll)
    )
  );
}

export function createVRSimStickState() {
  return {
    rollRate: 0,
    pullRate: 0,
    yawRate: 0,
    idle: 0,
    notch: null,
    rollWasHeld: false,
    looping: false,
    loopDir: 1,
    rollTurned: 0,
    pullTurned: 0,
    rollStill: 0,
    pullStill: 0,
  };
}

function accumulateFullTurn(s, totalKey, stillKey, rate, dt) {
  if (Math.abs(rate) < 0.3) {
    s[stillKey] += dt;
    if (s[stillKey] > 0.5) s[totalKey] = 0;
    return false;
  }
  s[stillKey] = 0;
  if (s[totalKey] !== 0 && Math.sign(s[totalKey]) !== Math.sign(rate)) {
    s[totalKey] = 0;
  }
  s[totalKey] += rate * dt;
  if (Math.abs(s[totalKey]) >= SIM_TAU) {
    s[totalKey] = 0;
    return true;
  }
  return false;
}

/**
 * Advances one frame of rate-command VR sim-stick flight physics.
 * - `roll` in `[-1..1]` (`+1` = right stick -> right wing down)
 * - `pull` in `[-1..1]` (`+1` = pull back -> nose toward canopy; `-1` = push forward)
 * - `rudder` in `[-1..1]` (`+1` = yaw left, `-1` = yaw right)
 * - `active`: true while the player's hand holds the virtual stick or deflects a stick
 */
export function stepVRSimStickAttitude(s, input) {
  const {
    quat,
    roll = 0,
    pull = 0,
    rudder = 0,
    active = false,
    handling = {agility: 1, rollRate: 2.8, stallKts: 0, levelKts: 60},
    kts = 80,
    climbLimit = Infinity,
    turnScale = 1,
    grounded = false,
    dt = 1 / 60,
  } = input;

  const T = VR_SIM_STICK;
  const rollCmd = grounded ? 0 : clamp(roll, -1, 1);
  const pullCmd = clamp(pull, -1, 1);
  const rollHeld = Math.abs(rollCmd) > 1e-4;
  const pullHeld = Math.abs(pullCmd) > 1e-4;
  const rudderHeld = Math.abs(rudder) > 1e-4;

  const att = attitudeOfQuat(quat);
  const bank = att.roll;
  const steep = Math.abs(att.pitch) > T.LOOP_FROM;

  // Hands-off trainer dihedral recovery (paused whenever holding the stick)
  s.idle = active || rollHeld || pullHeld || rudderHeld ? 0 : s.idle + dt;
  const rescue = simSmoothstep(
    s.idle,
    T.RESCUE_SECONDS,
    T.RESCUE_SECONDS + T.RESCUE_EASE_SECONDS
  );

  // 1. Aileron roll rate & wings-level / inverted detent notch
  const maxRoll = handling.rollRate;
  let notchedJustNow = false;
  if (rollHeld) {
    s.notch = null;
  } else if (s.rollWasHeld && !steep) {
    for (const n of [0, Math.PI]) {
      if (Math.abs(simWrapAngle(n - bank)) < T.NOTCH) {
        s.notch = n;
        notchedJustNow = true;
        break;
      }
    }
  }
  s.rollWasHeld = rollHeld;

  let wantRoll = -rollCmd * maxRoll;
  if (!rollHeld) {
    if (s.notch !== null) {
      const d = simWrapAngle(s.notch - bank);
      if (Math.abs(d) < 0.003 && Math.abs(s.rollRate) < 0.05) {
        s.notch = null;
      } else {
        wantRoll = clamp(d / T.NOTCH_SECONDS, -maxRoll, maxRoll);
      }
    } else if (rescue > 0 || grounded) {
      wantRoll = clamp(
        simWrapAngle(-bank) * T.RESCUE_RATE * (grounded ? 4 : rescue),
        -maxRoll,
        maxRoll
      );
    }
  }
  s.rollRate +=
    (wantRoll - s.rollRate) * (1 - Math.exp(-dt / T.ROLL_EASE_SECONDS));

  // 2. Elevator pull rate & aerodynamic pitch stability
  const authority =
    handling.stallKts > 0
      ? 0.35 + 0.65 * simSmoothstep(kts, handling.stallKts, handling.levelKts)
      : 1;
  const maxPull = T.PULL_RATE * handling.agility * authority;

  if (steep && pullHeld && Math.abs(s.pullRate) > 0.3) {
    s.looping = true;
    s.loopDir = Math.sign(s.pullRate);
  } else if (
    s.looping &&
    att.upright > 0.5 &&
    Math.abs(att.pitch) < T.LOOP_TO
  ) {
    s.looping = false;
  }

  let wantPull =
    pullCmd >= 0 ? pullCmd * maxPull : pullCmd * maxPull * T.PUSH_SHARE;

  let settle = 0;
  if (s.looping && !pullHeld && att.upright < 0) {
    // Releasing stick while inverted over the top of a loop carries cleanly round
    wantPull = s.loopDir * maxPull * T.LOOP_CARRY;
  } else if (!s.looping) {
    // Banked lift loss gently drops the nose toward earth unless supported by
    // elevator back-pressure (or forward push when inverted)
    const bankGravityDrop = grounded
      ? 0
      : T.BANK_NOSE_DROP * 0.5 * (1 - Math.cos(bank)) * Math.cos(att.pitch);
    const trimRelax = pullHeld
      ? 0
      : -att.pitch * Math.max(T.RELAX, rescue * T.RESCUE_RATE);
    settle = trimRelax - bankGravityDrop;
  }

  if (!(s.looping && att.upright < 0) && att.pitch > climbLimit) {
    settle -= (att.pitch - climbLimit) * T.LIMIT_RATE;
    if (att.upright > 0) wantPull = Math.min(wantPull, 0);
  }

  s.pullRate +=
    (wantPull - s.pullRate) * (1 - Math.exp(-dt / T.PULL_EASE_SECONDS));

  // 3. Rudder yaw (from lap controller side-grips when airborne)
  const wantYaw = grounded
    ? 0
    : clamp(rudder, -1, 1) * T.RUDDER_RATE * handling.agility;
  s.yawRate +=
    (wantYaw - s.yawRate) * (1 - Math.exp(-dt / T.ROLL_EASE_SECONDS));

  // 4. Integrate body-space rates + world-horizon coordinated bank turn
  const pitchRate = s.pullRate + settle * Math.cos(bank);
  const bodyYawRate = s.yawRate - settle * Math.sin(bank);
  let q = quatMultiply(
    quat,
    quatFromRotVec(pitchRate * dt, bodyYawRate * dt, s.rollRate * dt)
  );

  if (!grounded) {
    const bankTurn =
      T.BANK_TURN *
      2 *
      Math.sin(bank) *
      Math.max(0, Math.cos(bank)) *
      Math.cos(att.pitch) *
      handling.agility *
      turnScale;
    q = quatMultiply(quatFromRotVec(0, bankTurn * dt, 0), q);
  }
  q = quatNormalize(q);

  const rolled = accumulateFullTurn(
    s,
    'rollTurned',
    'rollStill',
    s.rollRate,
    dt
  );
  const looped = accumulateFullTurn(
    s,
    'pullTurned',
    'pullStill',
    s.pullRate,
    dt
  );

  return {quat: q, rolled, looped, notched: notchedJustNow};
}
