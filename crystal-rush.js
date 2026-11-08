// --- SHATTERED CRYSTALS GIVE A RUSH ---
// Flying into one of the western alien crystals (breakables.js) doesn't
// slow the plane like a tree: it gives it a rush. The plane jumps ahead,
// keeps pulling toward half again its cruising speed for a few seconds,
// then eases back; the view widens while it lasts and a trail in the
// crystal's colour streams off the tail. Another crystal during a rush
// tops it up, so a run through a crystal field chains; a giant gives a
// longer one.
//
// The crystal side of the mushroom trip (mushroom-trip.js). Cheap: a few
// numbers per frame, read by flight-physics.js (speed), flight-camera.js
// (field of view) and particles.js (the trail, rushTrail).
import * as THREE from 'three';
import {state} from './state.js';

// How much faster (fraction of the throttle's speed) the plane heads for at
// the rush's peak, and how much of that it gets at once on the hit
const RUSH_GAIN = 0.5;
const KICK = 0.25;
// How long it holds (s) for a small crystal and for a giant, then eases out
const HOLD_SMALL = 2.5;
const HOLD_GIANT = 5;
const FADE = 2;
// Extra field of view (degrees) at the peak
export const RUSH_FOV = 10;
// The trail shows while the rush is at least this strong
const TRAIL_FROM = 0.15;

// 0-1 how strong, how long it holds, and how far in (s)
let strength = 0;
let hold = 0;
let age = Infinity;
const color = new THREE.Color();
const _trail = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);

/** Starts (or tops up) a rush: `size` 0-1 from a small crystal to a giant,
 * `rgb` the crystal's colour ([r, g, b], 0-1). */
export function startRush(size, rgb) {
  const s = THREE.MathUtils.clamp(size, 0.4, 1);
  const was = rushAmount();
  strength = Math.max(was, s);
  hold = Math.max(
    age < hold ? hold - age : 0,
    THREE.MathUtils.lerp(HOLD_SMALL, HOLD_GIANT, s)
  );
  age = 0;
  color.fromArray(rgb);
  // The jump ahead, less when already rushing (so a chain doesn't run away)
  const kick = 1 + KICK * s * (1 - was);
  state.flightSpeedMultiplier *= kick;
}

/** 0-1 how strong the rush is now (0 when there's none). */
export function rushAmount() {
  if (age < hold) return strength;
  const out = (age - hold) / FADE;
  return out >= 1 ? 0 : strength * (1 - THREE.MathUtils.smoothstep(out, 0, 1));
}

/** The speed the throttle heads for, raised by the rush. */
export function rushTarget(target) {
  const a = rushAmount();
  return a > 0 && target > 0 ? target * (1 + RUSH_GAIN * a) : target;
}

/** Per frame: moves the rush along. */
export function updateRush(delta) {
  if (state.isPaused || delta <= 0) return;
  // A crash or landing ends it
  if (state.isCrashed || state.isOnGround || state.isOnWater) age = Infinity;
  if (age < hold + FADE) age += delta;
}

/** The trail's colour while the rush is strong enough, or null. */
export function rushTrail() {
  if (rushAmount() <= TRAIL_FROM) return null;
  return _trail.copy(color).lerp(WHITE, 0.2);
}
