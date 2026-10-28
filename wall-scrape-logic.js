// --- WALL SCRAPES: THE MATHS ---
// Pure functions for wall-scrape.js (no three.js or scene), so they can be
// tested in Node (scripts/test-wall-scrape.js). The ground under the
// plane's middle keeps it a cushion above (flight-physics.js), which lifts
// it straight up. A wingtip or the nose touching a steep wall pushes it off
// sideways instead: a wingtip scrapes along the wall, and the nose glances
// off, turning the plane along it. Units are world units (1 = 0.51 m) and
// seconds; headings are forwardOf-style (0 is -z).

export const SCRAPE = {
  // A wingtip or the nose this close to the ground touches it (units)
  MARGIN: 1.5,
  // Only ground steeper than this (rise per unit, about 35°) is a wall to
  // push off sideways; gentler ground keeps the cushion's lift
  WALL_SLOPE: 0.7,
  // Out of the wall at most this far a frame (units)
  MAX_STEP: 6,
  // Pushed off at up to this speed (units/s), fading by FADE a second
  PUSH: 40,
  FADE: 4,
  // Speed kept per second of scraping (fraction)
  KEEP_PER_SECOND: 0.8,
  // A wobble (rad of roll) away from the wall
  ROLL: 0.3,
  // Head-on: heading against the wall (forward·normal) below this
  HEAD_ON: -0.5,
  // Speed kept after a head-on glance (fraction)
  HEAD_ON_KEEP: 0.75,
  // How fast the heading swings along the wall (rad/s)
  GLANCE_TURN: 3,
  // Still into a wall after this long (s), it's in a corner: turn out
  CORNERED: 0.6,
  // A touch this long after the last is a new hit (s)
  NEW_HIT: 0.3,
};

/** The forward direction ({x, z}) of `heading`. */
export function forwardOf(heading) {
  return {x: -Math.sin(heading), z: -Math.cos(heading)};
}

/** The heading that faces horizontal direction (x, z). */
export function headingOf(x, z) {
  return Math.atan2(-x, -z);
}

/**
 * Whether a probe at (x, y, z) touches the ground (`ground`: {height,
 * slopeX, slopeZ} under it, as drawn): null when it doesn't, or isn't a
 * wall; else {depth (units in), slope, nx, nz (the wall's facing, flat and
 * unit length)}.
 */
export function wallContact(y, ground, waterLevel) {
  if (ground.height <= waterLevel) return null;
  const depth = ground.height + SCRAPE.MARGIN - y;
  if (depth <= 0) return null;
  const slope = Math.hypot(ground.slopeX, ground.slopeZ);
  if (slope < SCRAPE.WALL_SLOPE) return null;
  // The ground y = h(x, z) faces (-slopeX, 1, -slopeZ): flat, downhill
  return {
    depth,
    slope,
    nx: -ground.slopeX / slope,
    nz: -ground.slopeZ / slope,
  };
}

/**
 * How far to move out of a wall touched `depth` deep: sideways down its
 * slope until the probe is clear, at most MAX_STEP.
 */
export function stepOut(depth, slope) {
  return Math.min(SCRAPE.MAX_STEP, depth / slope);
}

/**
 * Whether a plane heading `heading` flies into a wall facing (nx, nz)
 * nose first: forward·normal under `below` (HEAD_ON by default; 0 for any
 * way into it).
 */
export function isHeadOn(heading, nx, nz, below = SCRAPE.HEAD_ON) {
  const f = forwardOf(heading);
  return f.x * nx + f.z * nz < below;
}

/**
 * The heading to glance off along a wall facing (nx, nz): along it, the way
 * nearer `heading`. Dead on, the way the plane is banked (`roll` > 0 is
 * banked left).
 */
export function glanceHeading(heading, nx, nz, roll = 0) {
  const f = forwardOf(heading);
  // Along the wall, to its right as you face it, and the other way
  let tx = -nz;
  let tz = nx;
  const along = f.x * tx + f.z * tz;
  if (Math.abs(along) < 0.05) {
    // Left of heading is (-cos h, sin h) in x, z
    const left = -Math.cos(heading) * tx + Math.sin(heading) * tz;
    if (roll > 0 !== left > 0) {
      tx = -tx;
      tz = -tz;
    }
  } else if (along < 0) {
    tx = -tx;
    tz = -tz;
  }
  return headingOf(tx, tz);
}

/** `from` turned toward `to` (rad) by at most `step`, the short way. */
export function turnToward(from, to, step) {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return from + Math.max(-step, Math.min(step, d));
}

/**
 * The roll wobble (rad) for a plane heading `heading` pushed off along
 * (nx, nz): the wing nearer the wall lifts away from it.
 */
export function scrapeRoll(heading, nx, nz) {
  // Right of heading is (cos h, -sin h)
  const right = nx * Math.cos(heading) - nz * Math.sin(heading);
  return -Math.sign(right || 1) * SCRAPE.ROLL;
}

/** A push's speed (units/s) `dt` seconds on, fading. */
export function fadeScrapePush(v, dt) {
  return v * Math.exp(-SCRAPE.FADE * dt);
}
