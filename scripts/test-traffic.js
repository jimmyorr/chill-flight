#!/usr/bin/env node
/**
 * scripts/test-traffic.js
 *
 * Checks the other planes' flight logic (traffic-logic.js): they appear far
 * off on a course across the player's part of the sky, keep clear of the
 * ground (climbing before a ridge), bank into their turns and are removed
 * once they're well past.
 */
import {
  AIM_RADIUS,
  DESPAWN_DISTANCE,
  GROUND_CLEARANCE,
  MIN_CLEARANCE,
  MIN_SPEED,
  PACE_CLOSE,
  PACE_RADIUS,
  SPAWN_DISTANCE_MAX,
  SPAWN_DISTANCE_MIN,
  forwardOf,
  isTrafficPlaneGone,
  spawnTrafficPlane,
  stepTrafficPlane,
  targetSpeed,
} from '../traffic-logic.js';

console.log('Testing air traffic...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

// Seeded so failures reproduce
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const flat = () => 40;
const CX = 1000;
const CZ = -2000;

// Spawning
const rng = mulberry32(1);
const spawned = Array.from({length: 200}, () =>
  spawnTrafficPlane(rng, CX, CZ, flat, 8)
);
const dists = spawned.map((p) => Math.hypot(p.x - CX, p.z - CZ));
check(
  'planes appear between the spawn distances',
  dists.every(
    (d) => d >= SPAWN_DISTANCE_MIN - 1e-6 && d <= SPAWN_DISTANCE_MAX + 1e-6
  ),
  `range ${Math.min(...dists).toFixed(0)}-${Math.max(...dists).toFixed(0)}`
);
// The course passes within AIM_RADIUS of the player: the closest point of the
// heading's line to the center
const missDistances = spawned.map((p) => {
  const f = forwardOf(p.heading);
  const along = (CX - p.x) * f.x + (CZ - p.z) * f.z;
  return {
    along,
    miss: Math.hypot(p.x + f.x * along - CX, p.z + f.z * along - CZ),
  };
});
check(
  "each plane heads across the player's area",
  missDistances.every((m) => m.along > 0 && m.miss <= AIM_RADIUS + 1e-6)
);
check(
  'every type and livery comes up',
  new Set(spawned.map((p) => p.type)).size === 4 &&
    new Set(spawned.map((p) => p.livery)).size === 8
);
check(
  'a plane appears clear of high ground',
  (() => {
    const p = spawnTrafficPlane(mulberry32(2), CX, CZ, () => 2000, 8);
    return p.y >= 2000 + GROUND_CLEARANCE;
  })()
);

// Flying over a steep ridge: from z = -1500 the ground rises 1 in 2 to 1200,
// running east-west, so turning doesn't help
const ridge = (x, z) => Math.min(1200, Math.max(40, (-z - 1500) * 0.5));
const p = spawnTrafficPlane(mulberry32(3), 0, 0, flat, 8);
Object.assign(p, {
  x: 0,
  z: 0,
  y: 500,
  cruiseAlt: 500,
  heading: 0,
  turnAmount: 0,
});
let lowest = Infinity;
for (let i = 0; i < 60 * 60; i++) {
  stepTrafficPlane(p, 1 / 60, ridge);
  lowest = Math.min(lowest, p.y - ridge(p.x, p.z));
}
check(
  'a plane never gets near the ground over a steep ridge',
  lowest >= MIN_CLEARANCE - 1e-6,
  `lowest clearance ${lowest.toFixed(1)}`
);

// A lone mountain ahead, lower to its left: the plane turns away from it
const peak = (x, z) => Math.max(40, 2500 - Math.hypot(x - 300, z + 3000) * 1.5);
const m = spawnTrafficPlane(mulberry32(6), 0, 0, flat, 8);
Object.assign(m, {
  x: 0,
  z: 0,
  y: 500,
  cruiseAlt: 500,
  heading: 0,
  turnAmount: 0,
});
let maxGround = 0;
for (let i = 0; i < 60 * 40; i++) {
  stepTrafficPlane(m, 1 / 60, peak);
  maxGround = Math.max(maxGround, peak(m.x, m.z));
}
check(
  'a plane turns away from a mountain rather than climbing it',
  maxGround < 1200,
  `highest ground passed over ${maxGround.toFixed(0)}`
);
check('it climbs nose up', p.pitch >= 0);

// Turning and banking
const q = spawnTrafficPlane(mulberry32(4), 0, 0, flat, 8);
let sameSign = true;
let turned = 0;
for (let i = 0; i < 60 * 60; i++) {
  const before = q.heading;
  stepTrafficPlane(q, 1 / 60, flat);
  const rate = (q.heading - before) * 60;
  turned = Math.max(turned, Math.abs(rate));
  if (
    Math.abs(rate) > 0.03 &&
    Math.abs(q.bank) > 0.05 &&
    Math.sign(rate) !== Math.sign(q.bank)
  ) {
    sameSign = false;
  }
}
check('planes wander in gentle turns', turned > 0.005 && turned < 0.1);
check('they bank into their turns', sameSign);

// Pacing: a plane flying north (heading 0, toward -z) at 120
const paced = spawnTrafficPlane(mulberry32(7), 0, 0, flat, 8);
Object.assign(paced, {x: 0, y: 500, z: 0, heading: 0, cruiseSpeed: 120});
const at = (dz, speed) => ({x: 0, y: 500, z: dz, speed});
check(
  'a plane keeps its own speed when the player is far',
  targetSpeed(paced, at(PACE_RADIUS + 100, 180)) === 120 &&
    targetSpeed(paced, null) === 120
);
const aheadSpeed = targetSpeed(paced, at(500, 180)); // player 500 behind
check(
  'a plane ahead of the player slows a little, so they catch up',
  aheadSpeed < 180 && aheadSpeed >= 140,
  `target ${aheadSpeed}`
);
const behindSpeed = targetSpeed(paced, at(-500, 180)); // player 500 ahead
check(
  'a plane behind the player speeds up a little',
  behindSpeed > 180 && behindSpeed <= 220,
  `target ${behindSpeed}`
);
check(
  'close in, a plane matches the player exactly',
  targetSpeed(paced, at(PACE_CLOSE - 10, 165)) === 165
);
check(
  'a paced plane never flies below the speed where planes sink',
  targetSpeed(paced, at(100, 60)) === MIN_SPEED
);

// Following one around: the player, at 150, steers straight for a wandering
// plane from 1500 behind it, and should end up close and stay there
const lead = spawnTrafficPlane(mulberry32(8), 0, 0, flat, 8);
Object.assign(lead, {
  x: 0,
  y: 500,
  z: -1500,
  heading: 0,
  turnAmount: 1,
  speed: 120,
  cruiseSpeed: 120,
});
const me = {x: 0, y: 500, z: 0, speed: 150};
let closeFor = 0;
let maxLateGap = 0;
for (let t = 0; t < 120; t += 1 / 30) {
  stepTrafficPlane(lead, 1 / 30, flat, me);
  const dx = lead.x - me.x;
  const dz = lead.z - me.z;
  const d = Math.hypot(dx, dz);
  if (d > 1) {
    me.x += (dx / d) * Math.min(me.speed / 30, Math.max(0, d - 100));
    me.z += (dz / d) * Math.min(me.speed / 30, Math.max(0, d - 100));
  }
  const gap = Math.hypot(lead.x - me.x, lead.z - me.z);
  if (gap < 250) closeFor += 1 / 30;
  if (t > 90) maxLateGap = Math.max(maxLateGap, gap);
}
check(
  'a player following a plane catches up and can stay alongside',
  closeFor > 30 && maxLateGap < 300,
  `close for ${closeFor.toFixed(0)} s, widest gap in the last 30 s ${maxLateGap.toFixed(0)}`
);

// Removal
const r = spawnTrafficPlane(mulberry32(5), 0, 0, flat, 8);
check('a plane is kept while near', !isTrafficPlaneGone(r, 0, 0));
r.x = DESPAWN_DISTANCE + 1;
r.z = 0;
check("a plane is removed once it's well past", isTrafficPlaneGone(r, 0, 0));

if (failed) {
  console.log('Air traffic tests FAILED.');
  process.exit(1);
}
console.log('All air traffic tests passed.');
