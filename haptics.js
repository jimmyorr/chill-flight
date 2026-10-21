// haptics.js
// A tap on the phone (iOS/Android apps, via @capacitor/haptics) when the
// plane meets land or water, harder for a harder landing, a clunk as
// retracting gear locks, a warning as the plane slows toward a stall, and
// thunder. Off by default; the switch lives next to Invert y axis in the
// pause menu.
import {state} from './state.js';
import {activePlaneType, planeGroup, planeHandling} from './airplane.js';
import {BASE_FLIGHT_SPEED} from './constants.js';

const STORAGE_KEY = 'chill_flight_haptics';

// Falling speed at touchdown (world units/s, 1 unit = 0.51 m) for each style
const MEDIUM_FALL = 6;
const HEAVY_FALL = 16;
// The stall warning comes this close above the plane's stall speed (knots,
// just before it starts to fall), and again only once it has sped back up
// past STALL_REARM_KTS above it
const STALL_WARN_KTS = 5;
const STALL_REARM_KTS = 20;
// Only these planes' gear moves (as for the gear sound in sfx-events.js)
const MOVING_GEAR = ['seaplane', 'twin', 'jet'];

let enabled = false;
try {
  enabled = localStorage.getItem(STORAGE_KEY) === 'true';
} catch {
  // Storage blocked; stay off
}

let lastY = null;
let fallRate = 0;
let lastGround = null;
let lastWater = null;
let elapsed = 0;
let lastImpact = -Infinity;
let lastGearExtension = null;
let stallWarned = false;

function plugin() {
  return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()
    ? Capacitor.Plugins?.Haptics
    : null;
}

// style: 'LIGHT', 'MEDIUM' or 'HEAVY'
function pulse(style) {
  plugin()
    ?.impact({style})
    .catch(() => {});
}

// A short double buzz, distinct from the impact taps
function warn() {
  plugin()
    ?.notification({type: 'WARNING'})
    .catch(() => {});
}

export function hapticsAvailable() {
  return !!plugin();
}

export function isHapticsEnabled() {
  return enabled;
}

export function setHapticsEnabled(on) {
  enabled = !!on;
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Not saved; still applies this session
  }
  if (enabled) pulse('LIGHT');
}

// Thunder after a lightning flash, distance 0..1 (overhead to far off),
// timed to arrive with the sound in sfx-events.js playThunder: a near strike
// cracks then rumbles, a far one is a single soft tap
export function thunderHaptic(distance = 0.5) {
  if (!enabled || !plugin()) return;
  const d = Math.min(1, Math.max(0, distance));
  const wait = (0.15 + d * 2.5) * 1000;
  if (d < 0.6) {
    setTimeout(() => pulse('MEDIUM'), wait);
    setTimeout(() => pulse('LIGHT'), wait + 250);
  } else {
    setTimeout(() => pulse('LIGHT'), wait);
  }
}

// Per frame: watches for the plane settling onto land or water
export function updateHaptics(delta) {
  if (delta <= 0) return;
  elapsed += delta;
  const paused = state.isPaused;
  const onGround = state.isOnGround;
  const onWater = state.isOnWater;

  // Vertical speed, units/s (positive falling), smoothed
  const y = planeGroup.position.y;
  if (lastY !== null && !paused) {
    const rate = (lastY - y) / delta;
    fallRate += (rate - fallRate) * Math.min(1, delta * 4);
  }
  lastY = y;

  // Ignore what the spawn looks like for the first moment
  const touched =
    (onGround && lastGround === false) || (onWater && lastWater === false);
  if (
    enabled &&
    touched &&
    elapsed > 2 &&
    elapsed - lastImpact > 0.5 &&
    !paused &&
    !state.isFreeCamera
  ) {
    lastImpact = elapsed;
    pulse(
      fallRate >= HEAVY_FALL
        ? 'HEAVY'
        : fallRate >= MEDIUM_FALL
          ? 'MEDIUM'
          : 'LIGHT'
    );
  }
  lastGround = onGround;
  lastWater = onWater;

  // Gear clunk: a light tap as moving gear locks fully up or down
  const ext = state.gearExtension;
  const locked =
    (ext >= 1 || ext <= 0) &&
    lastGearExtension !== null &&
    lastGearExtension > 0 &&
    lastGearExtension < 1;
  if (
    locked &&
    enabled &&
    elapsed > 2 &&
    MOVING_GEAR.includes(activePlaneType)
  ) {
    pulse('LIGHT');
  }
  lastGearExtension = ext;

  // Stall warning: once per slowdown, while flying (not in a loop). The
  // buggy has no stall speed. Taking off slowly isn't a stall: it only arms
  // once up to speed.
  const kts = BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
  const stallKts = planeHandling()?.stallKts;
  const aerobatic = state.isLooping || state.isDoingImmelmann;
  if (stallKts === undefined || onGround || onWater) {
    stallWarned = true;
  } else if (kts > stallKts + STALL_REARM_KTS) {
    stallWarned = false;
  } else if (kts < stallKts + STALL_WARN_KTS && !stallWarned && !aerobatic) {
    stallWarned = true;
    if (enabled && elapsed > 2 && !paused && !state.isFreeCamera) warn();
  }
}
