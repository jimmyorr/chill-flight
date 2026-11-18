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

// The phone joystick's response, from its throw (0 at the centre to 1 at the
// rim, 70 px out, either way) to the controls (1 is what holding an arrow key
// asks for: 75° of bank). Gentle through the middle (a fine middle that
// doesn't feel out of control), then rising faster to the keyboard's hard
// turn at the rim, where the old stick stopped at half (37°). The first
// ~10 px do nothing.
export const JOYSTICK = {
  DEAD_ZONE: 0.15,
  CUBIC: 0.6, // share of the response that's cubic
};
export function joystickResponse(throw_) {
  if (!Number.isFinite(throw_)) return 0;
  const a = Math.abs(throw_);
  if (a < JOYSTICK.DEAD_ZONE) return 0;
  const u = Math.min(1, (a - JOYSTICK.DEAD_ZONE) / (1 - JOYSTICK.DEAD_ZONE));
  return (
    Math.sign(throw_) * ((1 - JOYSTICK.CUBIC) * u + JOYSTICK.CUBIC * u * u * u)
  );
}

// The top of the sky (#176) sits just under the cloud deck (whose flat layer
// would give itself away from above) and moves with it (?cloudHeight=).
// Climbing up to it is "thin air": over the last THIN_AIR units the steepest
// climb fades to level and climbs cost more speed, and over the last
// MUSH_BAND the wings run out of air and the nose sags MUSH_DEG under level,
// so the plane floats along just under the top rather than meeting a lid.
// Under cloud, the cloud base's mist (game-loop.js) fills the same band.
export const CEILING = {
  BELOW_CLOUDS: 100,
  MIN: 600, // a very low ?cloudHeight still leaves room to fly
  THIN_AIR: 600,
  MUSH_BAND: 40,
  MUSH_DEG: 3,
  // A climb up there costs up to this much more speed (pitchedTarget)
  CLIMB_COST: 1,
  // The nose follows the falling limit this late (seconds, at 150 kts;
  // sooner when faster, so every plane floats up about as far): a steep
  // climb floats up past level, the nose sags under it, and the plane
  // settles just under the top (sagClimbCap)
  SAG_SECONDS: 1.5,
};

// Planes fly through and above the cloud deck (cloud-deck.js draws it from
// above), with the top of the sky ABOVE_CLOUDS_ROOM over the deck;
// ?aboveClouds=0 keeps them under it as before
export const ABOVE_CLOUDS = !(
  typeof location !== 'undefined' &&
  ['0', 'false'].includes(
    new URLSearchParams(location.search).get('aboveClouds')
  )
);
export const ABOVE_CLOUDS_ROOM = 1500;
// Just under the cloud deck: the top of the sky, unless ABOVE_CLOUDS lets
// planes on up through it (contrails keep to this height either way)
export function underCloudsCeiling(cloudHeight) {
  return Math.max(CEILING.MIN, cloudHeight - CEILING.BELOW_CLOUDS);
}
// The highest the plane can fly, under clouds at `cloudHeight`
export function flightCeiling(cloudHeight) {
  if (ABOVE_CLOUDS) return cloudHeight + ABOVE_CLOUDS_ROOM;
  return underCloudsCeiling(cloudHeight);
}

// How thin the air is at height y: 0 well below the ceiling, 1 at it
export function thinAirAt(y, ceiling) {
  return smoothstep(y, ceiling - CEILING.THIN_AIR, ceiling);
}

// The steepest climb (radians) allowed at height y, for a plane that can
// climb at `maxClimb` lower down; under level right at the top (the sag)
export function ceilingClimbLimit(y, ceiling, maxClimb) {
  const mush =
    smoothstep(y, ceiling - CEILING.MUSH_BAND, ceiling) *
    ((CEILING.MUSH_DEG * Math.PI) / 180);
  return maxClimb * (1 - thinAirAt(y, ceiling)) - mush;
}

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

// The steepest climb the nose is held to after `delta` seconds at `kts`:
// following ceilingClimbLimit's `limit` down a moment late
// (CEILING.SAG_SECONDS), and back up at once
export function sagClimbCap(cap, limit, kts, delta) {
  if (cap === null || limit >= cap) return limit;
  const seconds = CEILING.SAG_SECONDS * Math.min(1, 150 / Math.max(kts, 1));
  return cap + (limit - cap) * (1 - Math.exp(-delta / seconds));
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
 * of the fall). Near the top of the sky, `thinAir` (thinAirAt) makes a climb
 * cost more. Moving the target rather than the speed keeps it the same at
 * any frame rate.
 */
export function pitchedTarget(
  target,
  pitch,
  handling,
  fallAmount,
  avoidingGround,
  thinAir = 0
) {
  const share =
    handling.diveGain *
    (avoidingGround ? FLIGHT.SKIM_SHARE : 1) *
    (1 - fallAmount);
  let change = (-Math.sin(pitch) * share * handling.topKts) / KTS_PER_MULT;
  if (change >= 0) return target + change;
  // Climbing in thin air costs more speed (CEILING.CLIMB_COST)
  change *= 1 + thinAir * CEILING.CLIMB_COST;
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
  let maxRate =
    (diff > 0 ? handling.accelKts : handling.decelKts) / KTS_PER_MULT;
  // Past its top speed (a shattered crystal's rush, crystal-rush.js) the
  // plane sheds the extra quickly once the rush lets go, about half of it
  // a second, rather than coasting down at the throttle's rate
  const top = handling.topKts / KTS_PER_MULT;
  if (diff < 0 && speed > top) maxRate = Math.max(maxRate, (speed - top) * 0.6);
  const step = Math.min(Math.abs(diff) * FLIGHT.THROTTLE_EASE, maxRate) * delta;
  speed += Math.sign(diff) * Math.min(step, Math.abs(diff));
  // Easing never quite arrives, so settle once close (a plane stopping on
  // the water or the ground stops, rather than creeping and its prop
  // twitching)
  if (Math.abs(speed - target) < 0.01) speed = target;
  // (No faster than 10x, unless a rush is taking it there)
  return Math.max(0, Math.min(Math.max(10, target), speed));
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

/**
 * Letting go of a barrel roll: the roll eases to level instead of springing
 * there. The roll stops at about BRAKE times the rate it eases in at
 * (BARREL_ROLL_EASE_IN in game-loop.js, here EASE_OUT seconds from full
 * rate), so it brakes about as firmly as it starts, and its acceleration
 * blends over SMOOTH seconds, so nothing jolts. It rolls on to the level its
 * momentum carries it nearest (rollExitTarget): past halfway it finishes the
 * turn, short of that it rolls back, and it never changes its mind midway.
 * Coming up to level it hands over to a soft spring (SPRING_*) that lets the
 * wings swing a little past and rock back once, the way a plane settles,
 * rather than stopping dead on the level.
 */
export const ROLL_EXIT = {
  EASE_OUT: 0.4,
  BRAKE: 2,
  SMOOTH: 0.06,
  SETTLE: 4,
  // How quickly (1/s) the rate is steered onto the eased one: gentle, so
  // the braking doesn't overshoot it and wobble at the end
  FOLLOW: 10,
  // The settling spring: stiffness (rad/s) and damping ratio, about 8°
  // past level and 2° back. It takes over from SPRING_FROM to SPRING_TO
  // (radians from level)
  SPRING_OMEGA: 5,
  SPRING_DAMPING: 0.5,
  SPRING_FROM: 0.6,
  SPRING_TO: 0.2,
  // Done (hand over to the usual roll) this close, this slow
  DONE_ANGLE: 0.025,
  DONE_RATE: 0.1,
  // Give up after this long (the player steering keeps moving the target)
  MAX_SECONDS: 4,
};

// How hard (rad/s²) a roll at `maxRate` rad/s brakes on its way out
export function rollExitBrake(maxRate) {
  return (Math.max(maxRate, 0.1) / ROLL_EXIT.EASE_OUT) * ROLL_EXIT.BRAKE;
}

/**
 * The winding (whole turns, as an angle) to add to the level bank `level`
 * so the roll, at `roll` rolling at `rate` rad/s, ends on the copy of it
 * nearest where it would come to a stop braking at rollExitBrake(maxRate)
 */
export function rollExitTurns(roll, rate, level, maxRate) {
  const stop = roll + (rate * Math.abs(rate)) / (2 * rollExitBrake(maxRate));
  return Math.PI * 2 * Math.round((stop - level) / (Math.PI * 2));
}

/**
 * One frame of the roll easing to `target` (unwrapped, from rollExitTurns):
 * `s` is {roll, rate, accel} (rad, rad/s, rad/s²) and is updated in place.
 * Returns true once it has settled (within DONE_ANGLE, under DONE_RATE).
 * Steps of at most 1/60 s keep it the same at any frame rate.
 */
export function stepRollExit(s, target, maxRate, delta) {
  const brake = rollExitBrake(maxRate);
  const ease = brake / ROLL_EXIT.BRAKE;
  const steps = Math.max(1, Math.ceil(delta * 60 - 1e-6));
  const dt = delta / steps;
  for (let i = 0; i < steps; i++) {
    const diff = target - s.roll;
    const dist = Math.abs(diff);
    // The rate that stops on the target braking a little gentler than the
    // most it can, and eases in exponentially at the end
    const want =
      Math.sign(diff) *
      Math.min(
        maxRate,
        Math.sqrt(2 * brake * 0.7 * dist),
        ROLL_EXIT.SETTLE * dist
      );
    const change = want - s.rate;
    // Slowing down brakes firmly; speeding up (rolling back) eases in
    const limit = change * s.rate < 0 ? brake : ease;
    const eased = Math.max(-limit, Math.min(limit, change * ROLL_EXIT.FOLLOW));
    const w = ROLL_EXIT.SPRING_OMEGA;
    const spring = Math.max(
      -brake,
      Math.min(brake, w * w * diff - 2 * ROLL_EXIT.SPRING_DAMPING * w * s.rate)
    );
    const t = Math.max(
      0,
      Math.min(
        1,
        (ROLL_EXIT.SPRING_FROM - dist) /
          (ROLL_EXIT.SPRING_FROM - ROLL_EXIT.SPRING_TO)
      )
    );
    const wantAccel = eased + (spring - eased) * t * t * (3 - 2 * t);
    s.accel += (wantAccel - s.accel) * (1 - Math.exp(-dt / ROLL_EXIT.SMOOTH));
    s.rate += s.accel * dt;
    s.roll += s.rate * dt;
  }
  return (
    Math.abs(target - s.roll) < ROLL_EXIT.DONE_ANGLE &&
    Math.abs(s.rate) < ROLL_EXIT.DONE_RATE
  );
}
