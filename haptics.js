// haptics.js
// A tap on the phone (iOS/Android apps, via @capacitor/haptics) when the
// plane meets land or water, harder for a harder landing, a tap when flying
// under a waterfall as water hits the plane, a clunk as retracting gear locks,
// a warning as the plane slows toward a stall, and thunder. Off by default;
// the switch lives next to Invert y axis in the pause menu.
import {state} from './state.js';
import {activePlaneType, planeGroup, planeHandling} from './airplane.js';
import {BASE_FLIGHT_SPEED} from './constants.js';
import {waterfallFeet} from './terrain-chunks.js';

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
let underWaterfall = false;
let lastWaterfallHit = -Infinity;

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

// Checks whether the plane is flying under or through a waterfall ribbon,
// where falling water strikes the canopy and airframe.
export function checkWaterfallContact(pos) {
  for (const fall of waterfallFeet.values()) {
    if (!fall.segments || fall.segments.length === 0) continue;
    const dx = pos.x - fall.x;
    const dz = pos.z - fall.z;
    if (dx * dx + dz * dz > 350 * 350) continue;
    if (pos.y > fall.top + 5 || pos.y < 38) continue;

    const segs = fall.segments;
    for (let j = 0; j < segs.length; j++) {
      const s = segs[j];
      // Fast AABB rejection per segment
      if (pos.y < s.minY || pos.y > s.maxY) continue;
      if (pos.z < s.minZ || pos.z > s.maxZ) continue;
      if (pos.x < s.minX || pos.x > s.maxX) continue;

      const t = Math.max(
        0,
        Math.min(
          1,
          ((pos.x - s.p0.x) * s.vx +
            (pos.y - s.p0.y) * s.vy +
            (pos.z - s.p0.z) * s.vz) /
            s.lenSq
        )
      );
      const cx = s.p0.x + t * s.vx;
      const cy = s.p0.y + t * s.vy;
      const cz = s.p0.z + t * s.vz;
      const half = s.half0 + t * s.dHalf;

      // Lateral distance across the waterfall width
      const lateral = (pos.x - cx) * s.sx + (pos.z - cz) * s.sz;
      if (Math.abs(lateral) > half + 4) continue;

      // Normal perpendicular to the falling water sheet
      const distNormal =
        (pos.x - cx) * s.unx + (pos.y - cy) * s.uny + (pos.z - cz) * s.unz;

      // Water hits top of plane: plane is penetrating or immediately beneath the sheet
      if (Math.abs(distNormal) <= 10 && pos.y <= cy + 3 && pos.y >= cy - 20) {
        return true;
      }
    }
  }
  return false;
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

  // Waterfall: a single impact tap when flying through or under falling water
  const inWaterfall = checkWaterfallContact(planeGroup.position);
  if (inWaterfall) {
    if (
      !underWaterfall &&
      elapsed - lastWaterfallHit > 0.5 &&
      enabled &&
      elapsed > 2 &&
      !paused &&
      !state.isFreeCamera
    ) {
      lastWaterfallHit = elapsed;
      pulse('MEDIUM');
    }
    underWaterfall = true;
  } else {
    underWaterfall = false;
  }

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
