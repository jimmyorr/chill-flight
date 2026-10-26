// --- BUMPS: THE MATHS ---
// Pure functions for bumps.js (no three.js or scene), so the hit test and
// the push apart can be tested in Node (scripts/test-bumps.js). Planes and
// buggies don't pass through each other: two that touch are pushed apart
// sideways, lose a little speed and wobble, then pass through each other
// for a moment so they don't stick. Units are world units (1 = 0.51 m) and
// seconds.

export const BUMP = {
  // How far round its centre each reaches (a plane's wings, a buggy)
  RADIUS: {plane: 8, buggy: 4},
  // Speed kept after a bump (fraction)
  KEEP: 0.9,
  // Pushed apart at this speed (units/s), fading by FADE a second, so a
  // bump moves each about PUSH / FADE units off its line
  PUSH: 45,
  FADE: 3,
  // Up and down as a share of the push: mostly sideways
  LIFT: 0.4,
  // A wobble (rad of roll) toward the side pushed
  ROLL: 0.5,
  // Then passes through whatever it bumped for this long (s)
  GHOST: 1.2,
  // Moving further than this in a frame is a warp, not a bump
  MAX_STEP: 400,
};

// Bots keep clear of others: within AVOID.RANGE across (and AVOID.HEIGHT
// up and down) of another and closing within AVOID.AHEAD seconds, a bot
// sidesteps at up to AVOID.SPEED (units/s), harder the closer
export const AVOID = {RANGE: 60, HEIGHT: 30, AHEAD: 1.5, SPEED: 40};

/** How far one of `kind` ('plane' or 'buggy') reaches. */
export function bumpRadius(kind) {
  return kind === 'buggy' ? BUMP.RADIUS.buggy : BUMP.RADIUS.plane;
}

/**
 * The closest two things come while moving a0 -> a1 and b0 -> b1 over the
 * same frame ({x, y, z} each, straight lines at steady speed): the squared
 * distance then, and when (0..1 through the frame).
 */
export function closestApproach(a0, a1, b0, b1, out = {}) {
  // b relative to a: from r0 to r1
  const rx = b0.x - a0.x;
  const ry = b0.y - a0.y;
  const rz = b0.z - a0.z;
  const vx = b1.x - a1.x - rx;
  const vy = b1.y - a1.y - ry;
  const vz = b1.z - a1.z - rz;
  const vv = vx * vx + vy * vy + vz * vz;
  let t = vv > 1e-9 ? -(rx * vx + ry * vy + rz * vz) / vv : 0;
  t = Math.min(1, Math.max(0, t));
  const dx = rx + vx * t;
  const dy = ry + vy * t;
  const dz = rz + vz * t;
  out.t = t;
  out.distSq = dx * dx + dy * dy + dz * dz;
  return out;
}

/**
 * Whether a (radius ra) and b (radius rb) touched over a frame: a0 -> a1
 * and b0 -> b1. A step longer than MAX_STEP (a warp) never counts.
 */
export function touched(a0, a1, ra, b0, b1, rb) {
  const far = (p, q) =>
    Math.abs(q.x - p.x) + Math.abs(q.y - p.y) + Math.abs(q.z - p.z) >
    BUMP.MAX_STEP * 1.8;
  if (far(a0, a1) || far(b0, b1)) return false;
  const r = ra + rb;
  return closestApproach(a0, a1, b0, b1).distSq < r * r;
}

/**
 * Which way `me` is pushed off `other` ({x, y, z} each): a unit vector,
 * mostly sideways (y at most LIFT). Dead level with each other, off to
 * my right as I head along `heading` (forwardOf: 0 is -z).
 */
export function pushAway(me, other, heading = 0, out = {}) {
  let x = me.x - other.x;
  let z = me.z - other.z;
  let y = me.y - other.y;
  let flat = Math.hypot(x, z);
  if (flat < 0.5) {
    // Right on top of each other: off to the right
    x = Math.cos(heading);
    z = -Math.sin(heading);
    flat = 1;
  }
  x /= flat;
  z /= flat;
  y = Math.max(-BUMP.LIFT, Math.min(BUMP.LIFT, y / Math.max(flat, 4)));
  const len = Math.hypot(x, y, z);
  out.x = x / len;
  out.y = y / len;
  out.z = z / len;
  return out;
}

/**
 * The roll (rad) a bump gives one heading `heading` pushed along `push`:
 * toward the side it's pushed.
 */
export function bumpRoll(push, heading) {
  // Right of heading is (cos h, -sin h)
  const right = push.x * Math.cos(heading) - push.z * Math.sin(heading);
  return -Math.sign(right || 1) * BUMP.ROLL;
}

/** A push's speed (units/s) `dt` seconds on, fading. */
export function fadePush(v, dt) {
  return v * Math.exp(-BUMP.FADE * dt);
}

/**
 * Which way (unit {x, z}, scaled 0..1 by how urgent) a bot at `me` ({x, y,
 * z, vx, vz}) should sidestep to keep clear of `others` ({x, y, z, vx?,
 * vz?}); null when nothing's close.
 */
export function avoidStep(me, others) {
  let sx = 0;
  let sz = 0;
  for (const o of others) {
    if (Math.abs(o.y - me.y) > AVOID.HEIGHT) continue;
    const rx = o.x - me.x;
    const rz = o.z - me.z;
    if (Math.abs(rx) > 1000 || Math.abs(rz) > 1000) continue;
    // Closest within AVOID.AHEAD seconds, moving as now
    const vx = (o.vx || 0) - (me.vx || 0);
    const vz = (o.vz || 0) - (me.vz || 0);
    const vv = vx * vx + vz * vz;
    const t =
      vv > 1e-6
        ? Math.min(AVOID.AHEAD, Math.max(0, -(rx * vx + rz * vz) / vv))
        : 0;
    const cx = rx + vx * t;
    const cz = rz + vz * t;
    const d = Math.hypot(cx, cz);
    if (d >= AVOID.RANGE) continue;
    const urgency = 1 - d / AVOID.RANGE;
    // Away from where it'll be closest; dead on, off to the right
    let ax = -cx;
    let az = -cz;
    let len = Math.hypot(ax, az);
    if (len < 0.5) {
      ax = vz;
      az = -vx;
      len = Math.hypot(ax, az);
      if (len < 1e-6) {
        ax = 1;
        az = 0;
        len = 1;
      }
    }
    sx += (ax / len) * urgency;
    sz += (az / len) * urgency;
  }
  const s = Math.hypot(sx, sz);
  if (s < 1e-6) return null;
  const k = Math.min(1, s) / s;
  return {x: sx * k, z: sz * k};
}
