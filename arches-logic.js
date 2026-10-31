// --- ARCHES: THE MATHS ---
// Pure functions for arches.js (no three.js or scene), so they can be
// tested in Node (scripts/test-arches.js). The ground is a heightfield, one
// height per spot, so it can't have a roof: an arch is rock laid over it.
// Each one is a slab along a line across its opening (u), so deep (v) either
// side of that line: at each u it's solid from its underside up to its top.
// Where the underside comes down to the ground (the legs, the ends buried in
// the canyon's walls), it's solid all the way down (under = -Infinity).
//
// Three kinds, found per world (archSites):
// - sea: an arch standing in the island sea, one leg toward the nearest
//   island, so the way through runs along its coast
// - canyon: a natural bridge across the canyon at one of its tiers
// - basalt: a fallen hex column lying across a ravine between two columns
//   of the eastern land's honeycomb
//
// Flying, its top is the ground when above it (like the highway's deck),
// its underside is a ceiling when below it, and its sides are walls for the
// wingtips and the nose (archGround, archCeiling). Units are world units
// (1 = 0.51 m).
import {ChillFlightLogic} from './chill-flight-logic.js';

export const ARCH = {
  // Below the underside by this much at most (units)
  CEILING_MARGIN: 4,
  // Up to this far into the underside is still under it, pushed back down
  // (a few frames of a steep climb); deeper, it's in it from the side
  CEILING_CATCH: 10,
  // Profiles are sampled every STEP units across
  STEP: 6,
  // At most this many of each (sea arches are found until this many)
  SEA_COUNT: 4,
  CANYON_COUNT: 2,
  BASALT_COUNT: 6,
  // Arches of a kind stay at least this far apart (units)
  SPACING: 6000,
};

// Below the ground, for the solid legs
const SOLID = -Infinity;

// --- SHAPE ---

// An arch at (x, z) whose u axis faces `angle` (radians from +x toward +z),
// its profiles sampled from uMin to uMax every ARCH.STEP: under, top and
// half depth (depth) at each u, and how much lower the top is at the slab's
// sides than along its middle (round)
function makeArch(kind, x, z, angle, uMin, uMax, profile, extra = {}) {
  const n = Math.max(2, Math.ceil((uMax - uMin) / ARCH.STEP) + 1);
  const under = new Float64Array(n);
  const top = new Float64Array(n);
  const depth = new Float64Array(n);
  const round = new Float64Array(n);
  const p = {under: 0, top: 0, depth: 0, round: 0};
  for (let i = 0; i < n; i++) {
    profile(uMin + i * ARCH.STEP, p);
    under[i] = p.under;
    top[i] = p.top;
    depth[i] = p.depth;
    round[i] = p.round;
  }
  let reach = 0;
  for (let i = 0; i < n; i++) {
    const u = uMin + i * ARCH.STEP;
    reach = Math.max(reach, Math.hypot(u, depth[i]));
  }
  let high = -Infinity;
  for (let i = 0; i < n; i++) high = Math.max(high, top[i]);
  return {
    kind,
    x,
    z,
    angle,
    ux: Math.cos(angle),
    uz: Math.sin(angle),
    uMin,
    uMax: uMin + (n - 1) * ARCH.STEP,
    under,
    top,
    depth,
    round,
    reach,
    high,
    ...extra,
  };
}

// Linear interpolation of a profile at sample position f (fractional index)
function sampleProfile(arr, f) {
  const i = Math.max(0, Math.min(arr.length - 2, Math.floor(f)));
  const t = Math.max(0, Math.min(1, f - i));
  const a = arr[i];
  const b = arr[i + 1];
  if (a === SOLID || b === SOLID) return t < 0.5 ? a : b;
  return a + (b - a) * t;
}

/**
 * How much wider than its depth an arch is at height y, under a slab whose
 * top there is `top`: its sides flare out toward the water (arch.flare at
 * the water, none at the top).
 */
export function flareAt(arch, top, y) {
  if (!arch.flare) return 1;
  const base = arch.water ?? 40;
  const t = Math.max(0, Math.min(1, (top - y) / Math.max(1, top - base)));
  return 1 + arch.flare * t;
}

/**
 * Whether (x, z) is inside `arch`'s footprint (at height y: lower down,
 * a sea arch's sides flare out), filling `out` with the slab
 * there: under (-Infinity for solid to the ground), top, and the way out of
 * it sideways: inside (distance to the footprint's nearest side) and its
 * outward direction (nx, nz).
 */
export function solidAt(arch, x, z, out, y = Infinity) {
  const dx = x - arch.x;
  const dz = z - arch.z;
  if (dx * dx + dz * dz > arch.reach * arch.reach) return false;
  const u = dx * arch.ux + dz * arch.uz;
  const v = -dx * arch.uz + dz * arch.ux;
  if (u < arch.uMin || u > arch.uMax) return false;
  const f = (u - arch.uMin) / ARCH.STEP;
  const d =
    sampleProfile(arch.depth, f) * flareAt(arch, sampleProfile(arch.top, f), y);
  if (Math.abs(v) > d) return false;
  const s = v / d;
  out.under = sampleProfile(arch.under, f);
  out.top = sampleProfile(arch.top, f) - sampleProfile(arch.round, f) * s * s;
  // Out the nearest side: either side of the slab (v), or past an end (u)
  const sides = d - Math.abs(v);
  const ends = Math.min(u - arch.uMin, arch.uMax - u);
  if (sides <= ends) {
    const sign = v >= 0 ? 1 : -1;
    out.inside = sides;
    out.nx = -arch.uz * sign;
    out.nz = arch.ux * sign;
  } else {
    const sign = u - arch.uMin < arch.uMax - u ? -1 : 1;
    out.inside = ends;
    out.nx = arch.ux * sign;
    out.nz = arch.uz * sign;
  }
  return true;
}

const _solid = {under: 0, top: 0, inside: 0, nx: 0, nz: 0};

/**
 * The arch rock over (x, z) for something at height y: when y is above
 * its underside (and more than CEILING_CATCH into it, so not just bumping
 * it from below), its top is the ground there. Raises `ground` ({height,
 * slopeX, slopeZ}) to it, sloping it steeply out of the nearest side when
 * that is nearer than climbing out over the top (so a wingtip or the nose
 * at its side is pushed off it like off a cliff, wall-scrape-logic.js), and
 * returns whether it did.
 */
export function archGround(arches, x, z, y, ground) {
  let raised = false;
  for (const arch of arches) {
    if (!solidAt(arch, x, z, _solid, y)) continue;
    if (y <= _solid.under + ARCH.CEILING_CATCH) continue;
    if (_solid.top <= ground.height) continue;
    ground.height = _solid.top;
    const climb = Math.max(0, _solid.top - y);
    // Rise per unit out of the side: steep when the side is near and the
    // top far above, gentle when already near the top
    const slope = climb / (_solid.inside + 1);
    ground.slopeX = -_solid.nx * slope;
    ground.slopeZ = -_solid.nz * slope;
    raised = true;
  }
  return raised;
}

/**
 * The underside over (x, z) for something at height y below it (or up to
 * CEILING_CATCH into it), or null: the most it can be is that less
 * CEILING_MARGIN.
 */
export function archCeiling(arches, x, z, y) {
  let ceiling = null;
  for (const arch of arches) {
    if (!solidAt(arch, x, z, _solid, y)) continue;
    if (_solid.under === SOLID) continue;
    if (y > _solid.under + ARCH.CEILING_CATCH) continue;
    if (ceiling === null || _solid.under < ceiling) ceiling = _solid.under;
  }
  return ceiling;
}

/** The highest arch top over (x, z), or -Infinity: for keeping clear above. */
export function archTop(arches, x, z) {
  let top = -Infinity;
  for (const arch of arches) {
    if (solidAt(arch, x, z, _solid)) top = Math.max(top, _solid.top);
  }
  return top;
}

// --- PLACES ---

// A seeded random number generator for this world and kind
function worldRandom(simplex, salt) {
  const seed =
    (ChillFlightLogic.WORLD_SEED * 31 +
      Math.floor((simplex.noise2D(salt, 7.7) + 1) * 1e6)) |
    0;
  return ChillFlightLogic.mulberry32(seed);
}

function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function farFrom(list, x, z, distance) {
  return list.every((a) => Math.hypot(a.x - x, a.z - z) >= distance);
}

// Smooth 0..1 between edges a and b
function smooth(a, b, t) {
  const s = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return s * s * (3 - 2 * s);
}

// Bumpiness along an arch: a sum of two sines, seeded
function wobble(rand) {
  const p1 = rand() * 6.3;
  const p2 = rand() * 6.3;
  const f1 = 0.02 + rand() * 0.02;
  const f2 = 0.06 + rand() * 0.04;
  return (u) => Math.sin(u * f1 + p1) * 0.6 + Math.sin(u * f2 + p2) * 0.4;
}

// The island sea (chill-flight-logic.js's ISLAND_SEA: 5 East, 1 South, 7.5
// by 7 degrees), a little inside its edge
const SEA = {x: 25000, z: 5000, rx: 33000, rz: 31000};

// A sea arch at (x, z) off a cliff coast, in the style of Anacapa's Arch
// Rock: a wall of rock running out from the cliff with a hole through it,
// a stack for its seaward leg. Its u axis faces `angle`, toward the land:
// the shore is `shore` along it, and the cliff top behind it at `cliff`.
// groundAlong(u) is the ground's height along that line, to bury its land
// end in the cliff. `desert` (0 to 1) picks the cliff's rock colour.
export function seaArch(x, z, angle, water, rand, coast = {}) {
  const {
    W = 85 + rand() * 40, // Half the opening
    shore = W + 60,
    cliff = water + 230,
    groundAlong = () => -Infinity,
    desert = 0,
  } = coast;
  const T = 30 + rand() * 16; // Rock over the crown
  // The opening is as tall as the cliff allows, its top below the cliff's
  const H = Math.min(110 + rand() * 60, cliff - water - T - 15);
  const seaLeg = 90 + rand() * 50;
  const crownDepth = 30 + rand() * 12;
  const legDepth = 55 + rand() * 25;
  // Wider where it leaves the cliff, merging into the cliff face
  const rootDepth = 90 + rand() * 40;
  const bumpTop = wobble(rand);
  const bumpSide = wobble(rand);
  const crown = water + H + T;
  // It rises toward the cliff's top, but not far over its own crown: under
  // a high cliff it runs into the cliff's face instead
  const root = Math.min(cliff, crown + 50);
  // Into the land until the ground rises over its top, so its end is buried
  let uMax = shore + 40;
  while (uMax < shore + 500 && groundAlong(uMax) < root - 10) uMax += 10;
  uMax += 40;
  return makeArch(
    'sea',
    x,
    z,
    angle,
    -(W + seaLeg),
    uMax,
    (u, p) => {
      const a = Math.abs(u);
      const inOpening = a < W;
      const arc = inOpening ? Math.sqrt(1 - (u / W) ** 2) : 0;
      const under = water + H * arc;
      p.under = inOpening && under > water + 12 ? under : SOLID;
      if (u >= 0) {
        // Rising from the crown to the cliff top by the shore
        const t = smooth(W * 0.5, shore + 40, u);
        p.top = crown + (root - crown) * t + bumpTop(u) * 7;
        p.depth =
          crownDepth +
          (legDepth - crownDepth) * smooth(0, W, u) +
          (rootDepth - legDepth) * smooth(W, shore + 60, u) +
          bumpSide(u) * 8;
      } else {
        // Out to the stack, sloping down and narrowing until it dips under
        // the water at its end, the way the sea wears a headland back, so it
        // never ends in a wall
        const out = Math.max(0, (a - W) / seaLeg);
        p.top =
          crown - smooth(0, 1, out) * (crown - water + 12) + bumpTop(u) * 7;
        const d =
          crownDepth +
          (legDepth - crownDepth) * smooth(0, 1, inOpening ? a / W : 1) +
          bumpSide(u) * 8;
        p.depth = d * (1 - smooth(0.4, 1, out) * 0.5);
      }
      if (p.under !== SOLID) p.top = Math.max(p.top, p.under + T * 0.8);
      p.round = Math.min(
        26,
        (p.top - (p.under === SOLID ? water : p.under)) * 0.3
      );
    },
    {water, flare: 0.55, desert, opening: W}
  );
}

// Whether there's a cliff coast `dir` (radians) from (x, z) out at sea: the
// shore within 120 to 320 units and the land behind it standing at least
// 120 over the water within 200 more, rising steeply: {shore, cliff} or null
function cliffToward(E, x, z, dir, water) {
  const cx = Math.cos(dir);
  const cz = Math.sin(dir);
  let shore = null;
  for (let r = 120; r <= 320; r += 20) {
    if (E(x + cx * r, z + cz * r) > water + 2) {
      shore = r;
      break;
    }
  }
  if (shore === null) return null;
  if (E(x + cx * (shore + 100), z + cz * (shore + 100)) < water + 70) {
    return null;
  }
  let cliff = -Infinity;
  for (let r = shore + 40; r <= shore + 200; r += 40) {
    cliff = Math.max(cliff, E(x + cx * r, z + cz * r));
  }
  return cliff >= water + 120
    ? {shore, cliff: Math.min(cliff, water + 320)}
    : null;
}

function* findSeaArches(E, simplex, water, rand) {
  const found = [];
  const candidates = [];
  for (let gx = -1; gx <= 1; gx += 0.03) {
    for (let gz = -1; gz <= 1; gz += 0.032) {
      if (gx * gx + gz * gz <= 1) {
        candidates.push([SEA.x + gx * SEA.rx, SEA.z + gz * SEA.rz]);
      }
    }
  }
  shuffle(candidates, rand);
  // The old rock arch prop (landmarks.js), and the lighthouse
  const rockArchZ =
    ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED)() * 10000 - 5000;
  const busy = [
    [3000, rockArchZ, 3000],
    [7500, 3000, 2500],
  ];
  const deep = (x, z) => E(x, z) < water - 3;
  let tried = 0;
  for (const [px, pz] of candidates) {
    yield;
    if (found.length >= ARCH.SEA_COUNT || tried > 1500) break;
    if (!farFrom(found, px, pz, ARCH.SPACING)) continue;
    if (busy.some(([bx, bz, r]) => Math.hypot(px - bx, pz - bz) < r)) continue;
    if (ChillFlightLogic.isOnAirport(px, pz, 3000)) continue;
    if (ChillFlightLogic.roadClear(px, pz, 700, 900) < 1) continue;
    tried++;
    if (!deep(px, pz)) continue;
    // Quickly: high land close by at all
    let near = false;
    for (let k = 0; k < 8 && !near; k++) {
      const a = (k / 8) * Math.PI * 2;
      near = E(px + Math.cos(a) * 380, pz + Math.sin(a) * 380) > water + 60;
    }
    if (!near) continue;
    // The highest cliff close by
    let best = null;
    for (let k = 0; k < 12; k++) {
      const dir = (k / 12) * Math.PI * 2;
      const c = cliffToward(E, px, pz, dir, water);
      if (c && (!best || c.cliff > best.cliff)) best = {...c, dir};
    }
    if (!best) continue;
    // The arch's middle out from the shore, the shore 60 past the opening
    const W = 85 + rand() * 40;
    const ux = Math.cos(best.dir);
    const uz = Math.sin(best.dir);
    const back = best.shore - (W + 60);
    const x = px + ux * back;
    const z = pz + uz * back;
    // The way through, along the coast, and the stack's spot are open water
    const vx = -uz;
    const vz = ux;
    let through = deep(x - ux * (W + 60), z - uz * (W + 60));
    for (let v = -400; v <= 400 && through; v += 50) {
      for (const u of [-W * 0.5, 0, W * 0.5]) {
        if (!deep(x + vx * v + ux * u, z + vz * v + uz * u)) {
          through = false;
          break;
        }
      }
    }
    if (!through) continue;
    const desert = Math.max(
      0,
      Math.min(
        1,
        Math.max(0, z / 5000) + ChillFlightLogic.desertShift(x, z, simplex) - 2
      )
    );
    found.push(
      seaArch(x, z, best.dir, water, rand, {
        W,
        shore: W + 60,
        cliff: best.cliff,
        groundAlong: (u) => E(x + ux * u, z + uz * u),
        desert,
      })
    );
  }
  return found;
}

// A natural bridge across the canyon at (x, z), its u axis across the gorge:
// its top level with the tier `top`, its ends in the walls at uL and uR
export function canyonBridge(x, z, angle, uL, uR, floor, top, rand) {
  const mid = (uL + uR) / 2;
  const half = (uR - uL) / 2;
  const T = 30 + rand() * 14;
  const spring = floor + (top - floor) * (0.05 + rand() * 0.15);
  const depth = 38 + rand() * 20;
  const bumpSide = wobble(rand);
  const bumpTop = wobble(rand);
  return makeArch('canyon', x, z, angle, uL - 60, uR + 60, (u, p) => {
    const t = Math.abs(u - mid) / half;
    const crownUnder = top - T;
    p.under =
      t < 1
        ? crownUnder - (crownUnder - spring) * (1 - Math.sqrt(1 - t * t))
        : SOLID;
    if (p.under !== SOLID && p.under < floor + 8) p.under = SOLID;
    p.top = top + 2 + bumpTop(u) * 2;
    p.depth = depth + bumpSide(u) * 10 + smooth(0.7, 1.3, t) * 20;
    p.round = 5;
  });
}

function* findCanyonBridges(E, water, rand) {
  const path = ChillFlightLogic.CANYON_PATH.map(([lon, lat]) => [
    lon * 5000,
    -lat * 5000,
  ]);
  const options = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const ux = -(bz - az) / len;
    const uz = (bx - ax) / len;
    for (let s = 300; s < len - 300; s += 400) {
      const x = ax + ((bx - ax) * s) / len;
      const z = az + ((bz - az) * s) / len;
      yield;
      const option = canyonSection(E, x, z, ux, uz, water);
      if (option) options.push(option);
    }
  }
  // The deepest first, then the next far enough from it
  options.sort((a, b) => b.score - a.score);
  const found = [];
  for (const o of options) {
    if (found.length >= ARCH.CANYON_COUNT) break;
    if (!farFrom(found, o.x, o.z, ARCH.SPACING)) continue;
    // The way along the gorge under it is clear
    const angle = Math.atan2(o.uz, o.ux);
    found.push(canyonBridge(o.x, o.z, angle, o.uL, o.uR, o.floor, o.top, rand));
  }
  return found;
}

// The gorge across (x, z) along (ux, uz): the tier it's best bridged at
// (high above the floor, and narrow: its walls 160 to 650 apart there, at
// least 80 above the floor), or null. Checked a little either way along the gorge
// too, so the walls are there all along the bridge.
function canyonSection(E, x, z, ux, uz, water) {
  const profile = (offset) => {
    const vx = -uz;
    const vz = ux;
    const row = [];
    for (let u = -500; u <= 500; u += 20) {
      row.push(E(x + ux * u + vx * offset, z + uz * u + vz * offset));
    }
    return row;
  };
  if (E(x, z) > water + 30) return null;
  const rows = [profile(0)];
  const mid = 25;
  let floor = Infinity;
  let at = mid;
  for (let k = mid - 10; k <= mid + 10; k++) {
    if (rows[0][k] < floor) {
      floor = rows[0][k];
      at = k;
    }
  }
  if (floor > water + 30) return null;
  const edges = (row, level) => {
    let l = at;
    while (l > 0 && row[l] < level) l--;
    let r = at;
    while (r < row.length - 1 && row[r] < level) r++;
    if (row[l] < level || row[r] < level) return null;
    return [(l - mid) * 20, (r - mid) * 20];
  };
  let best = null;
  for (let level = floor + 80; level < floor + 320; level += 8) {
    const e = edges(rows[0], level);
    if (!e) break;
    const width = e[1] - e[0];
    if (width > 650) break;
    if (width < 160) continue;
    const score = level - floor - width * 0.15;
    if (best && score < best.score) continue;
    if (rows.length === 1) rows.push(profile(-70), profile(70));
    const ok = rows.slice(1).every((row) => {
      const f = edges(row, level);
      return f && Math.abs(f[0] - e[0]) < 80 && Math.abs(f[1] - e[1]) < 80;
    });
    if (ok) best = {uL: e[0], uR: e[1], top: level, score};
  }
  if (!best) return null;
  return {x, z, ux, uz, floor, ...best};
}

// A fallen hex column lying across a ravine, its u axis along its length,
// resting on the two columns' tops (hA at uA, hB at uB): radius r, its flat
// side down
export function basaltGate(x, z, angle, uA, uB, hA, hB, r, tint) {
  const h = r * Math.sqrt(3) * 0.5;
  return makeArch(
    'basalt',
    x,
    z,
    angle,
    uA,
    uB,
    (u, p) => {
      const t = (u - uA) / (uB - uA);
      const bottom = hA + (hB - hA) * t;
      p.under = bottom;
      p.top = bottom + 2 * h;
      p.depth = r;
      p.round = 0;
    },
    {radius: r, rest: [hA, hB], tint}
  );
}

function* findBasaltGates(E, simplex, water, rand) {
  const cell = ChillFlightLogic.basaltCell;
  const ROW = ChillFlightLogic.BASALT_ROW;
  const pairs = [];
  // Each column with its neighbour east, and the two below it
  for (let row = Math.floor(-40000 / ROW); row <= 40000 / ROW; row++) {
    for (let col = 50; col < 100; col++) {
      const odd = row & 1;
      pairs.push([col, row, col + 1, row]);
      pairs.push([col, row, col + odd, row + 1]);
      pairs.push([col, row, col + odd - 1, row + 1]);
    }
  }
  shuffle(pairs, rand);
  const found = [];
  let tried = 0;
  for (const [col, row, col2, row2] of pairs) {
    yield;
    if (found.length >= ARCH.BASALT_COUNT || tried > 600) break;
    const a = cell(col, row, simplex);
    if (!(a.top > 200) || a.spire > 0) continue;
    const b = cell(col2, row2, simplex);
    if (!(b.top > 200) || b.spire > 0) continue;
    if (Math.abs(a.top - b.top) > 60) continue;
    const mx = (a.cx + b.cx) / 2;
    const mz = (a.cz + b.cz) / 2;
    if (!farFrom(found, mx, mz, ARCH.SPACING)) continue;
    tried++;
    // Both standing tall (where the honeycomb blends into the land before
    // it, they're lower than their own tops)
    const hA = E(a.cx, a.cz);
    const hB = E(b.cx, b.cz);
    if (hA < water + 200 || hB < water + 200) continue;
    if (Math.abs(hA - hB) > 60) continue;
    // Across from one column's middle to the other's: where the ravine is
    const len = Math.hypot(b.cx - a.cx, b.cz - a.cz);
    const ux = (b.cx - a.cx) / len;
    const uz = (b.cz - a.cz) / len;
    const low = Math.min(hA, hB) - 6;
    const at = (u) => E(a.cx + ux * u, a.cz + uz * u);
    // The ravine's floor, and out from it both ways to the tops
    let floor = Infinity;
    let deepest = len / 2;
    for (let u = len * 0.15; u <= len * 0.85; u += 10) {
      const h = at(u);
      if (h < floor) {
        floor = h;
        deepest = u;
      }
    }
    let l = deepest;
    let rr = deepest;
    while (l > 0 && at(l) < low) l -= 10;
    while (rr < len && at(rr) < low) rr += 10;
    if (l <= 0 || rr >= len) continue;
    const gap = rr - l;
    if (gap < 70 || gap > 300) continue;
    if (Math.min(hA, hB) - floor < 120) continue;
    // Lying with its ends 150 onto each top, sunk into them
    const radius = 52 + rand() * 20;
    const uA = l - 150;
    const uB = rr + 150;
    const restA = at(uA) - 14;
    const restB = at(uB) - 14;
    const cx = a.cx + (ux * (uA + uB)) / 2;
    const cz = a.cz + (uz * (uA + uB)) / 2;
    const half = (uB - uA) / 2;
    found.push(
      basaltGate(
        cx,
        cz,
        Math.atan2(uz, ux),
        -half,
        half,
        restA,
        restB,
        radius,
        (a.tint + b.tint) / 2
      )
    );
  }
  return found;
}

const _sites = new WeakMap();

/**
 * Every arch in this world (the world seed and noise), worked out once:
 * sea arches in the island sea, a bridge or two over the canyon and fallen
 * columns in the eastern honeycomb. A generator that yields every few
 * looks at the land, so the search can be spread over frames (arches.js),
 * and returns the arches.
 */
export function* archSearch(simplex, constants = {}) {
  const signature = `${ChillFlightLogic.WORLD_SEED}:${simplex.noise2D(0.123, 0.456)}`;
  const cached = _sites.get(simplex);
  if (cached && cached.signature === signature) return cached.arches;
  const water = constants.WATER_LEVEL || 40;
  const elevationConstants = {...constants, WATER_LEVEL: water};
  const E = (x, z) =>
    ChillFlightLogic.getElevation(x, z, simplex, elevationConstants);
  const arches = [
    ...(yield* findSeaArches(E, simplex, water, worldRandom(simplex, 1.1))),
    ...(yield* findCanyonBridges(E, water, worldRandom(simplex, 2.2))),
    ...(yield* findBasaltGates(E, simplex, water, worldRandom(simplex, 3.3))),
  ];
  _sites.set(simplex, {signature, arches});
  return arches;
}

/** archSearch, all at once. */
export function archSites(simplex, constants = {}) {
  const search = archSearch(simplex, constants);
  let step = search.next();
  while (!step.done) step = search.next();
  return step.value;
}
