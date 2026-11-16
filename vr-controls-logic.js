// Pure WebXR / Quest Touch controller input helpers: dual-stick steering,
// cardinal stick double/triple-flick maneuvers, flight button edge latches,
// and 3D VR pause menu hit-testing and button debouncing.

export const STICK_DEADZONE = 0.15;
// Matches InputManager.JOYSTICK_SENSITIVITY so full physical stick deflection
// produces 0.5 after game-loop.js stickResponse (37.5 deg cruise bank and
// 22.5 deg pitch, saving 78 deg sharp bank and steep pitch for double-flicks).
export const STICK_SENSITIVITY = 0.7167;
export const STICK_FLICK_ENTER = 0.78;
export const STICK_FLICK_EXIT = 0.35;
export const STICK_FLICK_DOMINANCE = 1.3;
export const STICK_FLICK_WINDOW_MS = 450;
export const GRIP_ROLL_ENTER = 0.65;
export const GRIP_ROLL_EXIT = 0.4;

/**
 * Builds the WebXR `requestSession('immersive-vr', sessionInit)` options.
 * Stationary `'local'` tracking is a built-in default feature of every
 * `'immersive-vr'` session and matches `renderer.xr.setReferenceSpaceType('local')`
 * in `sky.js`. Omitting `'bounded-floor'` and `'local-floor'` avoids triggering
 * Meta Quest / Horizon OS Roomscale vs. Stationary Guardian boundary prompts,
 * and omitting `'hand-tracking'` ensures Horizon OS prompts for Touch
 * controllers until hand-tracked flight and hand-mesh rendering are added.
 */
export function getVRSessionInit() {
  return {
    optionalFeatures: [],
  };
}

/**
 * Maps a raw [-1..1] physical thumbstick axis to 0 inside `deadzone` and
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
 * 100% steering lock and boost/reverse smoothly at 100% physical stick throw
 * instead of saturating halfway.
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
 * Extracts left/right WebXR inputSource gamepads and an optional fallback
 * standard gamepad without duplicating XR controllers across arrays.
 */
export function extractXRControllers(session, fallbackGamepads = []) {
  if (session && !isXRSessionVisible(session)) {
    return {
      leftGp: null,
      rightGp: null,
      standardGp: null,
      hasXRGamepad: false,
    };
  }

  let leftGp = null;
  let rightGp = null;

  if (session && session.inputSources) {
    for (const source of session.inputSources) {
      const gp = source?.gamepad;
      if (!gp || gp.connected === false) continue;
      if (source.handedness === 'left') {
        leftGp = gp;
      } else if (source.handedness === 'right') {
        rightGp = gp;
      } else if (!rightGp && !source.hand) {
        rightGp = gp;
      }
    }
  }

  let standardGp = null;
  if (fallbackGamepads) {
    for (let i = 0; i < fallbackGamepads.length; i++) {
      const gp = fallbackGamepads[i];
      if (!gp || !gp.connected || gp === leftGp || gp === rightGp) continue;
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

/**
 * Detects rapid cardinal double-flick and triple-flick gestures on a physical
 * thumbstick so VR and gamepad players can trigger sharp turns, steep climbs
 * and dives, barrel rolls, vertical loops, Immelmann turns, and buggy hops.
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

function isGripHeld(gp, wasHeld) {
  const btn = gp?.buttons?.[1];
  if (!btn) return false;
  const val = buttonValue(btn);
  return (
    Boolean(btn.pressed) || val >= (wasHeld ? GRIP_ROLL_EXIT : GRIP_ROLL_ENTER)
  );
}

/**
 * Edge-latched tracker for Quest Touch in-flight face buttons, pause button,
 * and side-grip maneuvers:
 * - Right A (4): Camera (follow <-> first-person)
 * - Right B (5): Headlight
 * - Left X (4): Switch vehicle
 * - Left Y (5): Pause / Resume
 * - Left / Right side grips (1): Single squeeze & hold for sharp turn (+1 / -1);
 *   double squeeze & hold for barrel roll (+1 / -1)
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

    pollFlightButtons(controllers, now = defaultNow()) {
      const next = readFlightStates(controllers);
      const rawLeftGrip = isGripHeld(
        controllers?.leftGp,
        leftGripHeld || leftGripPauseLatch
      );
      const rawRightGrip = isGripHeld(
        controllers?.rightGp,
        rightGripHeld || rightGripPauseLatch
      );
      if (!rawLeftGrip) leftGripPauseLatch = false;
      if (!rawRightGrip) rightGripPauseLatch = false;

      const nextLeftHeld = rawLeftGrip && !leftGripPauseLatch;
      const nextRightHeld = rawRightGrip && !rightGripPauseLatch;

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
 * 0 = Resume flight, 1 = Map (in-VR 3D world map), 2 = Exit VR, -1 = outside.
 */
export function hitTestVRPauseMenuUV(u, v) {
  if (typeof u !== 'number' || typeof v !== 'number') return -1;
  const cx = u * 1024;
  const cy = (1.0 - v) * 680;
  if (cx >= 160 && cx <= 864) {
    if (cy >= 228 && cy <= 324) return 0;
    if (cy >= 344 && cy <= 440) return 1;
    if (cy >= 460 && cy <= 556) return 2;
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
 * State-wide button latch for the 3D VR pause and map cards.
 * Calling `arm(controllers)` when a card opens latches any currently held
 * buttons (such as Trigger, Right B, Right A, or Side Grips) so they must be
 * released before firing an action on the new card.
 */
export function createVRPauseInputLatch() {
  let leftTriggerLatched = false;
  let rightTriggerLatched = false;
  let resumeLatched = false;
  let exitLatched = false;
  let leftGripLatched = false;
  let rightGripLatched = false;

  function readStates({leftGp, rightGp, standardGp} = {}) {
    return {
      leftTrigger: isPressed(leftGp, 0),
      rightTrigger: isPressed(rightGp, 0),
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
