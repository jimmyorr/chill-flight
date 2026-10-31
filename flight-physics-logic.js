// --- FLIGHT PHYSICS: LOGIC ---
// The plane's speed and its sinking and falling (flight-physics.js applies
// them to the plane, with the ground and water under it). No three.js or DOM,
// so scripts/flight-sim.js flies this same code in Node. Each plane's stall
// and level speeds, throttle rates, dive gain and the rest come from
// PLANE_HANDLING in constants.js.
import {BASE_FLIGHT_SPEED} from './constants.js';

export const FLIGHT = {
  // How close the plane gets to the throttle's target before easing in (per
  // second: at 2 the last 25 knots of a climb to speed ease in)
  THROTTLE_EASE: 2,
  // How quickly the sink follows a change of speed (seconds)
  SINK_EASE_SECONDS: 1.0,
  // Slower still, the plane falls out of the sky and tumbles: gravity takes
  // over, blending in from its stall speed down to FALL_BLEND_KTS below it
  // (fallAmount) instead of switching on at one speed
  FALL_BLEND_KTS: 20,
  GRAVITY: 120, // units/sec²: weighty but not instant
  TERMINAL_VELOCITY: -600,
  // How quickly the fall comes on, and fades when powering out of it (seconds)
  FALL_EASE_SECONDS: 0.6,
  // Climbing slows the plane no lower than this above its level speed
  // (knots), and skimming the ground it gains or loses this share of a
  // dive's or climb's speed (pitchedTarget)
  CLIMB_FLOOR_KTS: 20,
  SKIM_SHARE: 0.15,
};

const KTS_PER_MULT = BASE_FLIGHT_SPEED * 60;

function smoothstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  const t = (x - min) / (max - min);
  return t * t * (3 - 2 * t);
}

const lerp = (a, b, t) => a + (b - a) * t;

// Slow flight: how fast the plane sinks (units per second), none at the
// plane's level speed and up, easing in to 15 at 5 knots under its stall
// speed (50 and 100 knots for the seaplane), so landing is a matter of
// slowing down gently
export function sinkRateAt(kts, handling) {
  return 15 * (1 - smoothstep(kts, handling.stallKts - 5, handling.levelKts));
}

/**
 * Whether a plane on its wheels or the water, at `kts` with its nose at
 * `pitch` (radians, up positive), leaves the surface: at its stall speed or
 * faster, and climbing from the nose faster than it sinks at that speed (a
 * knot is a unit per second). Otherwise the surface holds it: a raised nose
 * would lift it for a moment before the sink, or below stall the fall, took
 * back over and dropped it again, bouncing along the runway over and over.
 */
export function canLiftOff(kts, pitch, handling) {
  return (
    kts >= handling.stallKts &&
    kts * Math.sin(pitch) > sinkRateAt(kts, handling)
  );
}

/**
 * The speed (multiplier) the plane heads for at the throttle's `target` with
 * its nose at `pitch` (radians, negative nose down): a dive speeds it up and
 * a climb slows it, by up to `diveGain` of its top speed going straight down
 * or up, so it settles at a faster speed diving and a slower one climbing and
 * eases back once level (throttleSpeed). A climb never takes it below its
 * level speed plus CLIMB_FLOOR_KTS, so climbing alone never stalls it. A lot
 * less while skimming the ground (`avoidingGround`) and none while falling
 * (a nose the tumble tipped down would win back speed and pop the plane out
 * of the fall). Moving the target rather than the speed keeps it the same at
 * any frame rate.
 */
export function pitchedTarget(
  target,
  pitch,
  handling,
  fallAmount,
  avoidingGround
) {
  const share =
    handling.diveGain *
    (avoidingGround ? FLIGHT.SKIM_SHARE : 1) *
    (1 - fallAmount);
  const change = (-Math.sin(pitch) * share * handling.topKts) / KTS_PER_MULT;
  if (change >= 0) return target + change;
  const floor = (handling.levelKts + FLIGHT.CLIMB_FLOOR_KTS) / KTS_PER_MULT;
  return Math.max(Math.min(target, floor), target + change);
}

/**
 * The speed (multiplier) after `delta` seconds heading for the throttle's
 * `target` at a steady rate, like an engine spooling up (or drag slowing
 * the plane), easing in over the last few knots. The throttle slider can
 * jump the target in one go, so the rate here is what the player feels.
 */
export function throttleSpeed(speed, target, handling, delta) {
  const diff = target - speed;
  const maxRate =
    (diff > 0 ? handling.accelKts : handling.decelKts) / KTS_PER_MULT;
  const step = Math.min(Math.abs(diff) * FLIGHT.THROTTLE_EASE, maxRate) * delta;
  speed += Math.sign(diff) * Math.min(step, Math.abs(diff));
  // Easing never quite arrives, so settle once close (a plane stopping on
  // the water or the ground stops, rather than creeping and its prop
  // twitching)
  if (Math.abs(speed - target) < 0.01) speed = target;
  return Math.max(0, Math.min(10, speed));
}

/** How far the plane has fallen out of the sky (0 to 1), eased over time. */
export function fallAmountAt(fallAmount, airborne, kts, handling, delta) {
  return lerp(
    fallAmount,
    airborne
      ? 1 -
          smoothstep(
            kts,
            handling.stallKts - FLIGHT.FALL_BLEND_KTS,
            handling.stallKts
          )
      : 0,
    1 - Math.exp(-delta / FLIGHT.FALL_EASE_SECONDS)
  );
}

/**
 * The vertical velocity (units/s) after `delta` seconds in the air: slow
 * flight sinks, more the slower it goes, and falling, gravity accelerates
 * it. Its fall carries over when it powers out, fading as the sink takes
 * back over, so neither the throttle nor the speed ever jerks it.
 */
export function airborneVerticalVelocity(
  velocity,
  fallAmount,
  kts,
  handling,
  delta
) {
  velocity -= FLIGHT.GRAVITY * fallAmount * delta;
  velocity = lerp(
    velocity,
    -sinkRateAt(kts, handling),
    (1 - fallAmount) * (1 - Math.exp(-delta / FLIGHT.SINK_EASE_SECONDS))
  );
  return Math.max(velocity, FLIGHT.TERMINAL_VELOCITY);
}
