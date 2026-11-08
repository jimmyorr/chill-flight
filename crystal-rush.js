// --- SHATTERED CRYSTALS GIVE A RUSH ---
// Flying into one of the western alien crystals (breakables.js) doesn't
// slow the plane like a tree: it gives it a rush. The plane jumps ahead,
// keeps pulling toward up to half again its cruising speed for a few
// seconds, then eases back; the view widens while it lasts and a trail in the
// crystal's colour streams off the tail. Another crystal during a rush
// adds to it, so a run through a crystal field keeps getting faster (up
// to 2.5x); a giant gives a bigger, longer one.
//
// The crystal side of the mushroom trip (mushroom-trip.js). Cheap: a few
// numbers per frame, read by flight-physics.js (speed), flight-camera.js
// (field of view) and particles.js (the trail, rushTrail).
import * as THREE from 'three';
import {state} from './state.js';

// How much faster (fraction of the throttle's speed) the plane heads for
// after a giant (a small crystal gives part of it); crystals hit during a
// rush add theirs on top, up to MAX_BOOST (2.5x). KICK is how much of a
// crystal's boost the plane gets at once on the hit.
const RUSH_GAIN = 0.5;
const MAX_BOOST = 1.5;
const KICK = 0.25;
// How long it holds (s) for a small crystal and for a giant, then eases out
const HOLD_SMALL = 2.5;
const HOLD_GIANT = 5;
const FADE = 2;
// Extra field of view (degrees) for one giant's rush; a stack widens it up
// to half as much again
export const RUSH_FOV = 10;
const MAX_AMOUNT = 1.5;
// The trail shows while the rush is at least this strong
const TRAIL_FROM = 0.15;

// The boost at the peak (fraction above the throttle's speed), how long it
// holds, and how far in (s)
let peak = 0;
let hold = 0;
let age = Infinity;
const color = new THREE.Color();
const _trail = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);

/** Starts (or adds to) a rush: `size` 0-1 from a small crystal to a giant,
 * `rgb` the crystal's colour ([r, g, b], 0-1). */
export function startRush(size, rgb) {
  const s = THREE.MathUtils.clamp(size, 0.4, 1);
  const now = rushBoost();
  peak = Math.min(MAX_BOOST, now + RUSH_GAIN * s);
  hold = Math.max(
    age < hold ? hold - age : 0,
    THREE.MathUtils.lerp(HOLD_SMALL, HOLD_GIANT, s)
  );
  age = 0;
  color.fromArray(rgb);
  // The jump ahead (a smaller one for each crystal stacked on a rush)
  const kick = 1 + KICK * s * (now > 0 ? 0.6 : 1);
  state.flightSpeedMultiplier *= kick;
}

/** The boost now: how much above the throttle's speed the plane heads for
 * (0 when there's no rush). */
export function rushBoost() {
  if (age < hold) return peak;
  const out = (age - hold) / FADE;
  return out >= 1 ? 0 : peak * (1 - THREE.MathUtils.smoothstep(out, 0, 1));
}

/** How strong the rush looks now: 1 for one giant's, up to 1.5 stacked. */
export function rushAmount() {
  return Math.min(MAX_AMOUNT, rushBoost() / RUSH_GAIN);
}

/** The speed the throttle heads for, raised by the rush. */
export function rushTarget(target) {
  const b = rushBoost();
  return b > 0 && target > 0 ? target * (1 + b) : target;
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
