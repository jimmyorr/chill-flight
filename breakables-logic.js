// --- KNOCKING PROPS OVER: THE MATHS ---
// Pure functions for breakables.js (no three.js or scene), so the hit test,
// a tree's fall and the slowdown can be tested in Node
// (scripts/test-breakables.js). Units are world units (1 = 0.51 m) and
// seconds.

export const BREAK = {
  // How far around its centre the plane and buggy reach
  PLANE_RADIUS: 6,
  BUGGY_RADIUS: 3,
  // A wing's half thickness (units): how near a wingtip has to pass a thin
  // prop (a streetlight's pole or its arm over the road) to knock it over
  WING_THICK: 1.2,
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
  // Gravity on bits of house (units/s², about 2 g, so they don't float)
  GRAVITY: -40,
  // How long a house's walls take to fold down (s), how low they end up
  // (fraction of their height) and how far they lean over (rad)
  COLLAPSE_TIME: 0.9,
  COLLAPSE_HEIGHT: 0.22,
  COLLAPSE_LEAN: 0.35,
  // How far a sinking boat rolls (rad), how long that takes (s), how fast it
  // goes down after (units/s, growing), delay before dropping (s), and when
  // it's gone (s)
  SINK_ROLL: 1.3,
  SINK_ROLL_TIME: 1.6,
  SINK_DELAY: 0.6,
  SINK_RATE: 3,
  SINK_GONE: 7,
  // A penguin's hops: how long each takes (s), how high (units), and its dive
  // into the water: how long (s), how far out, and how deep it goes before
  // it's gone (units)
  HOP_TIME: 0.36,
  HOP_HEIGHT: 1.1,
  DIVE_TIME: 0.8,
  DIVE_OUT: 5,
  DIVE_DEPTH: 6,
  // A sheep: hit cylinder when the buggy runs into it and punts it into the
  // air, and the distance at which it bounds out of the way of the buggy or a
  // low-flying plane
  SHEEP_HIT_RADIUS: 3.5,
  SHEEP_HIT_HEIGHT: 5,
  SHEEP_BUGGY_SCARE: 35,
  SHEEP_PLANE_SCARE: 90,
  SHEEP_SCARE_HEIGHT: 80,
  PUNT_SPEED_MIN: 28,
  PUNT_SPEED_MAX: 65,
  PUNT_UP: 22,
  PUNT_UP_PER_KT: 0.18,
  PUNT_SPIN: 9,
  PUNT_BOUNCE: 0.35,
  // Rubble blocks thrown out of each kind of building or prop
  RUBBLE: {
    house: 9,
    two_story_house: 13,
    straw_hut: 6,
    barn: 16,
    monastery: 22,
    castle: 26,
    windmill: 10,
    hangar: 22,
    lighthouse: 9,
    pier: 14,
    rock: 7,
    stone_wall: 10,
    iceberg: 10,
    iceFloe: 6,
  },
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

// Squared distance between segments p0-p1 and q0-q1 ({x, y, z}, 3D)
export function segmentDistSq(p0, p1, q0, q1) {
  const d1x = p1.x - p0.x;
  const d1y = p1.y - p0.y;
  const d1z = p1.z - p0.z;
  const d2x = q1.x - q0.x;
  const d2y = q1.y - q0.y;
  const d2z = q1.z - q0.z;
  const rx = p0.x - q0.x;
  const ry = p0.y - q0.y;
  const rz = p0.z - q0.z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  let s = 0;
  let t = 0;
  if (a <= 1e-9 && e <= 1e-9) {
    s = 0;
    t = 0;
  } else if (a <= 1e-9) {
    t = clamp(f / e);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-9) {
      s = clamp(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      s = denom > 1e-9 ? clamp((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a);
      }
    }
  }
  const x = rx + d1x * s - d2x * t;
  const y = ry + d1y * s - d2y * t;
  const z = rz + d1z * s - d2z * t;
  return x * x + y * y + z * z;
}

const _wl = {x: 0, y: 0, z: 0};
const _wr = {x: 0, y: 0, z: 0};

// Whether a plane's wing, from tip to tip (halfSpan either side of its
// centre along the unit vector `right`, which leans with its roll), moving
// from a to b, comes within `reach` of the segment q0-q1 (a thin prop: a
// pole, or an arm reaching out over the road). The wing is checked every
// couple of units along the way, so a fast frame can't skip past it.
export function wingSweptHit(a, b, right, halfSpan, q0, q1, reach) {
  const step = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const n = Math.min(32, Math.max(1, Math.ceil(step / 2)));
  const hx = right.x * halfSpan;
  const hy = right.y * halfSpan;
  const hz = right.z * halfSpan;
  const reachSq = reach * reach;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const z = a.z + (b.z - a.z) * t;
    _wl.x = x - hx;
    _wl.y = y - hy;
    _wl.z = z - hz;
    _wr.x = x + hx;
    _wr.y = y + hy;
    _wr.z = z + hz;
    if (segmentDistSq(_wl, _wr, q0, q1) <= reachSq) return true;
  }
  return false;
}

// Whether something of radius r moving from a to b ({x, y, z}) touches a
// prop: an upright cylinder at (x, z) of `radius`, from `base` up to `top`
export function sweptHit(a, b, r, x, z, radius, base, top) {
  const reach = radius + r;
  closestOnSegment(a.x, a.z, b.x, b.z, x, z, _closest);
  if (_closest.distSq > reach * reach) return false;
  const y = a.y + (b.y - a.y) * _closest.t;
  return y - r < top && y + r > base;
}

const _wallProj = {t: 0, distSq: 0};

// Whether a vehicle of radius r moving from a to b ({x, y, z}) touches a thin
// sloped dry-stone wall bay encoded in its 16-float instance matrix m (#184):
// midpoint (m[12], m[13], m[14]), span (m[8], m[9], m[10]), vertical scale m[5].
export function sweptWallHit(a, b, r, m, halfWidth = 1.0, height = 2.95) {
  const mx = m[12];
  const my = m[13];
  const mz = m[14];
  const dx = m[8];
  const dy = m[9];
  const dz = m[10];
  const sy = Math.abs(m[5]) || 1;
  const wx0 = mx - 0.5 * dx;
  const wz0 = mz - 0.5 * dz;
  const wx1 = mx + 0.5 * dx;
  const wz1 = mz + 0.5 * dz;
  const reachSq = (r + halfWidth) * (r + halfWidth);

  const ux = b.x - a.x;
  const uz = b.z - a.z;
  const denom = ux * dz - uz * dx;
  let bestU = 0;
  let bestV = 0.5;
  let bestDistSq = Infinity;

  // Check exact 2D segment crossing first
  if (Math.abs(denom) > 1e-8) {
    const rx = wx0 - a.x;
    const rz = wz0 - a.z;
    const u = (rx * dz - rz * dx) / denom;
    const v = (rx * uz - rz * ux) / denom;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
      bestU = u;
      bestV = v;
      bestDistSq = 0;
    }
  }

  if (bestDistSq > 0) {
    // Compare all 4 endpoint-to-segment projections
    closestOnSegment(wx0, wz0, wx1, wz1, a.x, a.z, _wallProj);
    if (_wallProj.distSq < bestDistSq) {
      bestDistSq = _wallProj.distSq;
      bestU = 0;
      bestV = _wallProj.t;
    }
    closestOnSegment(wx0, wz0, wx1, wz1, b.x, b.z, _wallProj);
    if (_wallProj.distSq < bestDistSq) {
      bestDistSq = _wallProj.distSq;
      bestU = 1;
      bestV = _wallProj.t;
    }
    closestOnSegment(a.x, a.z, b.x, b.z, wx0, wz0, _wallProj);
    if (_wallProj.distSq < bestDistSq) {
      bestDistSq = _wallProj.distSq;
      bestU = _wallProj.t;
      bestV = 0;
    }
    closestOnSegment(a.x, a.z, b.x, b.z, wx1, wz1, _wallProj);
    if (_wallProj.distSq < bestDistSq) {
      bestDistSq = _wallProj.distSq;
      bestU = _wallProj.t;
      bestV = 1;
    }
  }

  if (bestDistSq > reachSq) return false;
  const vy = a.y + (b.y - a.y) * bestU;
  const wy = my + (bestV - 0.5) * dy;
  const wTop = wy + height * sy;
  return vy - r < wTop && vy + r > wy - 1.0;
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

// One step of a folding building, s = {t, squash, lean, done}: it folds
// down and leans over COLLAPSE_TIME (s)
export function stepFold(s, dt) {
  if (s.done) return s;
  s.t = Math.min(1, (s.t || 0) + dt / BREAK.COLLAPSE_TIME);
  const e = 1 - (1 - s.t) * (1 - s.t);
  s.squash = 1 - (1 - BREAK.COLLAPSE_HEIGHT) * e;
  s.lean = BREAK.COLLAPSE_LEAN * e;
  if (s.t >= 1) s.done = true;
  return s;
}

// One step of a sinking boat, s = {t, roll, drop, done}: it rolls over
// SINK_ROLL_TIME (s), and drops after SINK_DELAY (s)
export function stepSink(s, dt) {
  if (s.done) return s;
  s.t = (s.t || 0) + dt;
  const roll = Math.min(1, s.t / BREAK.SINK_ROLL_TIME);
  s.roll = BREAK.SINK_ROLL * (1 - (1 - roll) ** 2);
  s.drop = Math.max(0, s.t - BREAK.SINK_DELAY) ** 1.5 * BREAK.SINK_RATE;
  if (s.t > BREAK.SINK_GONE) s.done = true;
  return s;
}

// One step of a scattering penguin, s = {t, along, up, pitch, roll, turnAngle,
// swayNow, hops, hopLen, turn, sway, done}
export function stepScatter(s, dt) {
  if (s.done) return s;
  s.t = (s.t || 0) + dt;
  const t = Math.max(0, s.t);
  const hops = s.hops ?? 3;
  const hopLen = s.hopLen ?? 3;
  const hopEnd = hops * BREAK.HOP_TIME;
  let along;
  let up;
  let pitch = 0;
  let roll = 0;
  const u = Math.min(1, t / BREAK.HOP_TIME);
  const e = u * u * (3 - 2 * u);
  const turn = (s.turn ?? Math.PI * 0.45) * e;
  s.swayNow = (s.sway ?? 0) * (1 - e);
  if (t < hopEnd) {
    const h = t / BREAK.HOP_TIME;
    const f = h - Math.floor(h);
    along = Math.floor(h) * hopLen + f * hopLen;
    up = Math.sin(f * Math.PI) * BREAK.HOP_HEIGHT;
    roll = Math.sin(h * Math.PI) * 0.2;
  } else {
    const d = Math.min(1, (t - hopEnd) / BREAK.DIVE_TIME);
    along = hops * hopLen + d * BREAK.DIVE_OUT;
    up = Math.sin(d * Math.PI) * BREAK.HOP_HEIGHT - d * d * BREAK.DIVE_DEPTH;
    pitch = Math.min(1.5, d * 2.5);
  }
  s.along = along;
  s.up = up;
  s.pitch = pitch;
  s.roll = roll;
  s.turnAngle = turn;
  if (t >= hopEnd + BREAK.DIVE_TIME) s.done = true;
  return s;
}

// Whether a vehicle moving from a to b (radius r, unit heading (ux, uz))
// scares a sheep at (sx, sy, sz) into bounding out of the way. When the buggy
// is aimed straight at a sheep at speed, it holds off until close so a fast
// charge connects and punts the sheep into the air instead.
export function shouldScareSheep(a, b, r, ux, uz, sx, sy, sz, buggy) {
  if (!buggy) {
    return sweptHit(
      a,
      b,
      r,
      sx,
      sz,
      BREAK.SHEEP_PLANE_SCARE,
      sy - 10,
      sy + BREAK.SHEEP_SCARE_HEIGHT
    );
  }
  if (!sweptHit(a, b, r, sx, sz, BREAK.SHEEP_BUGGY_SCARE, sy - 20, sy + 25)) {
    return false;
  }
  const dx = sx - b.x;
  const dz = sz - b.z;
  const ahead = dx * ux + dz * uz;
  if (ahead < -r) return false;
  const lateral = Math.abs(dx * -uz + dz * ux);
  if (lateral <= r + BREAK.SHEEP_HIT_RADIUS * 0.75 && ahead > 8) return false;
  return true;
}

// One step of a sheep punted into the air by the buggy, s = {x, y, z, vx, vy,
// vz, angle, spin, bounces, done}: arcs under GRAVITY, tumbles end-over-end,
// bounces once on groundAt(x, z), and lands back on its feet.
export function stepSheepPunt(s, dt, groundAt) {
  if (s.done) return s;
  s.vy += BREAK.GRAVITY * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
  s.angle += s.spin * dt;
  const ground = groundAt(s.x, s.z);
  if (s.y <= ground && s.vy < 0) {
    s.y = ground;
    if ((s.bounces || 0) < 1 && -s.vy * BREAK.PUNT_BOUNCE > 5) {
      s.bounces = (s.bounces || 0) + 1;
      s.vy = -s.vy * BREAK.PUNT_BOUNCE;
      s.vx *= 0.55;
      s.vz *= 0.55;
      const tBounce = Math.max(0.15, (2 * s.vy) / -BREAK.GRAVITY);
      const target = Math.ceil(s.angle / (Math.PI * 2)) * Math.PI * 2;
      s.spin = (target - s.angle) / tBounce;
    } else {
      s.vy = 0;
      s.angle = 0;
      s.spin = 0;
      s.done = true;
    }
  }
  return s;
}
