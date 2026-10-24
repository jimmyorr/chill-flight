// --- KNOCKING PROPS OVER: THE MATHS ---
// Pure functions for breakables.js (no three.js or scene), so the hit test,
// a tree's fall and the slowdown can be tested in Node
// (scripts/test-breakables.js). Units are world units (1 = 0.51 m) and
// seconds.

export const BREAK = {
  // How far around its centre the plane and buggy reach
  PLANE_RADIUS: 6,
  BUGGY_RADIUS: 3,
  // How much of a prop's widest extent counts as solid: a tree's canopy
  // edge is let through, a house's walls aren't
  TREE_REACH: 0.55,
  HOUSE_REACH: 0.8,
  // Speed kept after a hit (fraction), by what was hit and what hit it
  KEEP: {
    tree: {plane: 0.97, buggy: 0.9},
    house: {plane: 0.85, buggy: 0.75},
    snowman: {plane: 0.99, buggy: 0.95},
  },
  // A toppling tree: spin from the hit (rad/s, plus more for a faster hit,
  // up to TOPPLE_SPIN_MAX), gravity's pull as it leans (rad/s² at 90°), and
  // how much spin is left after bouncing off the ground
  TOPPLE_SPIN: 0.5,
  TOPPLE_SPIN_PER_KT: 1 / 200,
  TOPPLE_SPIN_MAX: 2.2,
  TOPPLE_GRAVITY: 5,
  TOPPLE_BOUNCE: 0.25,
  TOPPLE_SETTLE_SPIN: 0.35,
  // Never lies flatter than this (rad), on a slope falling away
  TOPPLE_MAX_ANGLE: 1.62,
  // Moving further than this in a frame is a teleport, not a hit
  MAX_STEP: 400,
};

// Closest approach of the segment a -> b (x, z) to the point p, as the
// fraction along the segment and the squared distance
export function closestOnSegment(ax, az, bx, bz, px, pz, out = {}) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.min(1, Math.max(0, t));
  const cx = ax + dx * t - px;
  const cz = az + dz * t - pz;
  out.t = t;
  out.distSq = cx * cx + cz * cz;
  return out;
}

const _closest = {t: 0, distSq: 0};

// Whether something of radius r moving from a to b ({x, y, z}) touches a
// prop: an upright cylinder at (x, z) of `radius`, from `base` up to `top`
export function sweptHit(a, b, r, x, z, radius, base, top) {
  const reach = radius + r;
  closestOnSegment(a.x, a.z, b.x, b.z, x, z, _closest);
  if (_closest.distSq > reach * reach) return false;
  const y = a.y + (b.y - a.y) * _closest.t;
  return y - r < top && y + r > base;
}

// The speed kept after hitting a 'tree', 'house' or 'snowman' in the plane or
// the buggy
export function speedKept(kind, buggy) {
  const keep = BREAK.KEEP[kind] || BREAK.KEEP.tree;
  return buggy ? keep.buggy : keep.plane;
}

// How fast a tree starts to tip when hit at `kts`
export function toppleSpin(kts) {
  return Math.min(
    BREAK.TOPPLE_SPIN_MAX,
    BREAK.TOPPLE_SPIN + Math.max(0, kts) * BREAK.TOPPLE_SPIN_PER_KT
  );
}

// The angle (rad from upright) at which a tree of `height` falling along
// one direction comes to rest: where its top, `thickness` above its axis,
// meets the ground. groundAt(d) is the ground's height d units out along
// the fall, relative to the tree's base.
export function restAngle(height, thickness, groundAt) {
  for (let a = 0.05; a < BREAK.TOPPLE_MAX_ANGLE; a += 0.05) {
    const out = height * Math.sin(a);
    const up = height * Math.cos(a);
    if (up - thickness <= groundAt(out)) return a;
  }
  return BREAK.TOPPLE_MAX_ANGLE;
}

// One step of a toppling tree, s = {angle, spin, rest, done}: gravity pulls
// harder as it leans, and it bounces off the ground at `rest` a little until
// it lies still
export function stepTopple(s, dt) {
  if (s.done) return s;
  s.spin += BREAK.TOPPLE_GRAVITY * Math.sin(s.angle) * dt;
  s.angle += s.spin * dt;
  if (s.angle >= s.rest) {
    s.angle = s.rest;
    s.spin = -s.spin * BREAK.TOPPLE_BOUNCE;
    if (Math.abs(s.spin) < BREAK.TOPPLE_SETTLE_SPIN) {
      s.spin = 0;
      s.done = true;
    }
  }
  return s;
}

// One step of a piece flung off a house, p = {x, y, z, vx, vy, vz, angle,
// spin, rest, done}: it flies under `gravity` (negative, units/s²), turning,
// until it comes down on the ground at height `rest`
export function stepFlying(p, dt, gravity) {
  if (p.done) return p;
  p.vy += gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  p.angle += p.spin * dt;
  if (p.y <= p.rest && p.vy < 0) {
    p.y = p.rest;
    p.done = true;
  }
  return p;
}
