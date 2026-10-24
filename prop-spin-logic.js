// --- PROPELLER SPIN: LOGIC ---
// How a propeller turns. The engine drives it toward a target spin; with the
// engine off it coasts down, quickly at first and then lingering on the last
// slow turns (each a little lumpy as the cylinders compress), and then
// catches on compression: it stops just past where it rests, rocks back and
// settles. No three.js, so scripts/test-prop-spin.js runs this same code.

export const PROP_SPIN = {
  // How quickly the engine brings the prop up to speed (per second)
  SPIN_UP: 2.5,
  // Air drag on a coasting prop (per second, the exponential part of the
  // coast-down) and the engine's own friction (rad/s²)
  DRAG: 0.3,
  FRICTION: 0.25,
  // The cylinders' compression (rad/s²) and strokes per turn: the last turns
  // slow and hurry a little rather than winding down evenly
  COMPRESSION: 0.6,
  STROKES: 2,
  // Below this spin (rad/s) compression catches it: it heads for a rest
  // SETTLE_REACH radians on, swings a little past and rocks back to it on a
  // spring (rad/s, and its damping ratio)
  SETTLE_SPEED: 1.6,
  SETTLE_REACH: 0.7,
  SETTLE_FREQ: 3.2,
  SETTLE_DAMPING: 0.38,
  // Close enough to rest to stop (rad and rad/s)
  REST_ANGLE: 0.01,
  REST_SPIN: 0.04,
  // rad/s: beyond about 90 degrees a frame (at 30 fps), a 2-blade prop looks
  // like it's turning backwards
  MAX: 40,
  STEP: 1 / 120, // seconds per integration step
};

/**
 * The spin (rad/s) the engine drives the prop toward, or 0 with the engine
 * off. The engine runs while the plane moves or the throttle is open.
 * spinScale: props with fewer blades spin faster, so their blades sweep past
 * as often.
 */
export function propSpinTarget(speedMult, throttleTarget, spinScale = 1) {
  const moving = Math.abs(speedMult) > 0.001;
  if (!moving && !(throttleTarget > 0.001)) return 0;
  const spin = Math.max(4, Math.min(25, 15 * Math.abs(speedMult)));
  return Math.min(PROP_SPIN.MAX, spin * spinScale);
}

/** A prop at rest, for stepPropSpin. */
export function newPropSpin(angle = 0) {
  return {spin: 0, angle, rest: null};
}

/**
 * Advances a prop (from newPropSpin: spin in rad/s, angle in rad, and the
 * angle it's settling to, or null) by delta seconds toward target spin
 * (0: the engine is off).
 */
export function stepPropSpin(prop, target, delta) {
  const P = PROP_SPIN;
  let left = Math.min(delta, 0.25);
  while (left > 1e-9) {
    const dt = Math.min(P.STEP, left);
    left -= dt;
    if (target > 0) {
      prop.rest = null;
      prop.spin += (target - prop.spin) * P.SPIN_UP * dt;
    } else if (prop.rest !== null) {
      // Caught on compression: a damped spring onto the rest angle
      const x = prop.angle - prop.rest;
      const w = P.SETTLE_FREQ;
      prop.spin += (-w * w * x - 2 * P.SETTLE_DAMPING * w * prop.spin) * dt;
      if (Math.abs(x) < P.REST_ANGLE && Math.abs(prop.spin) < P.REST_SPIN) {
        prop.angle = prop.rest;
        prop.spin = 0;
        prop.rest = null;
        return prop;
      }
    } else if (prop.spin !== 0) {
      // Coasting down
      const lump = P.COMPRESSION * Math.sin(P.STROKES * prop.angle);
      const slow = P.DRAG * Math.abs(prop.spin) + P.FRICTION + lump;
      prop.spin -= Math.sign(prop.spin) * Math.max(0, slow) * dt;
      if (Math.abs(prop.spin) < P.SETTLE_SPEED) {
        prop.rest = prop.angle + Math.sign(prop.spin) * P.SETTLE_REACH;
      }
    } else {
      return prop; // at rest
    }
    prop.spin = Math.max(-P.MAX, Math.min(P.MAX, prop.spin));
    prop.angle += prop.spin * dt;
  }
  return prop;
}
