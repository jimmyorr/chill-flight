// --- ARCHES ---
// Rock arches to fly under (arches-logic.js finds them and has the maths):
// sea arches in the island sea, natural bridges over the canyon and fallen
// basalt columns across the eastern ravines. The ground can't have a roof,
// so each is drawn here, a little outside the rock the plane meets. They use
// the terrain's material, so they light, fog and fade into the distance
// with the land.
import * as THREE from 'three';
import {archSearch, flareAt} from './arches-logic.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {WATER_LEVEL} from './constants.js';
import {simplex} from './noise.js';
import {scene} from './scene.js';
import {terrainMaterial} from './terrain-geometry.js';

// Across the slab's top and bottom in this many steps, and down its sides
const ACROSS = 8;
const DOWN = 8;
// Drawn up to this far outside the rock the plane meets (units)
const ROUGH = 3;
// Every this many of an arch's profile samples is drawn
const STRIDE = 2;

// Sea arch rock: the coast's own cliffs' (terrain-gen.js's cliff colours,
// grey, or red in the south, darkened as steep rock is), the waterline
// darker, and the arch itself white with seabirds over the top
const CLIFF_GREY = new THREE.Color(0x7f8c8d);
const CLIFF_RED = new THREE.Color(0x8b3a3a);
const SEA_WET = new THREE.Color(0x2e2c2a);
const GUANO = new THREE.Color(0xdcd8cc);
// The canyon's sandstone layers (terrain-gen.js's), one per tier
const CANYON_BANDS = [
  0xb5532e, 0xe3b48a, 0xc9683b, 0x8f3b26, 0xd99a64, 0xa84a2c,
].map((c) => new THREE.Color(c));
// The eastern columns' walls and tops (terrain-gen.js's)
const BASALT_WALL = new THREE.Color(0x5a5668);
const BASALT_TOPS = [
  0x1a4d3a, 0x2f6e3a, 0x1f7a72, 0x7a9a2a, 0x2f6e3a, 0x5a4580, 0x7e4a68,
  0x95593a,
].map((c) => new THREE.Color(c));

// A hash of a point (0 to 1), for roughness that's the same for every
// triangle sharing it
function hash(x, y, z) {
  let h =
    Math.imul(Math.round(x * 4), 374761393) ^
    Math.imul(Math.round(y * 4), 668265263) ^
    Math.imul(Math.round(z * 4), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// A slab arch's (sea, canyon) rings of points around its cross section at
// each drawn u: over the top, down one side, under and up the other, in the
// arch's own space (u, y, v). Where it's solid to the ground, the bottom is
// below the ground there (groundAt, in world space).
function slabRings(arch, groundAt) {
  const rings = [];
  const n = arch.under.length;
  for (let i = 0; i < n; i += STRIDE) {
    rings.push(slabRing(arch, Math.min(i, n - 1), groundAt));
  }
  if ((n - 1) % STRIDE) rings.push(slabRing(arch, n - 1, groundAt));
  return rings;
}

function slabRing(arch, i, groundAt) {
  const u = arch.uMin + i * 6;
  const d = arch.depth[i];
  const top = arch.top[i];
  const round = arch.round[i];
  const under = arch.under[i];
  // Half the depth at height y, flaring toward the water
  const half = (y) => d * flareAt(arch, top, y);
  const bottom = (v) => {
    if (under !== -Infinity) return under;
    const w = toWorld(arch, u, v);
    return Math.min(top - 10, groundAt(w.x, w.z) - 15);
  };
  const ring = [];
  // Top, from v = d to -d
  for (let k = 0; k <= ACROSS; k++) {
    const s = 1 - (2 * k) / ACROSS;
    ring.push({u, v: s * d, y: top - round * s * s, out: [0, 1, 0]});
  }
  // Down the -v side
  const yTop = top - round;
  const b1 = bottom(-d);
  for (let k = 1; k < DOWN; k++) {
    const y = yTop + (b1 - yTop) * (k / DOWN);
    ring.push({u, v: -half(y), y, out: [0, 0, -1]});
  }
  // Under, from v = -d to d
  for (let k = 0; k <= ACROSS; k++) {
    const s = -1 + (2 * k) / ACROSS;
    const y = bottom(s * d);
    ring.push({u, v: s * half(y), y, out: [0, -1, 0]});
  }
  // Up the +v side
  const b2 = bottom(d);
  for (let k = DOWN - 1; k >= 1; k--) {
    const y = yTop + (b2 - yTop) * (k / DOWN);
    ring.push({u, v: half(y), y, out: [0, 0, 1]});
  }
  return ring;
}

function toWorld(arch, u, v) {
  return {
    x: arch.x + u * arch.ux - v * arch.uz,
    z: arch.z + u * arch.uz + v * arch.ux,
  };
}

// The basalt gate's hex column: rings at its two ends, flat side down
function hexRings(arch) {
  const r = arch.radius;
  const h = (r * Math.sqrt(3)) / 2;
  const ends = [0, arch.under.length - 1];
  return ends.map((i) => {
    const u = arch.uMin + i * 6;
    const c = arch.under[i] + h;
    const ring = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ring.push({
        u,
        v: Math.cos(a) * r,
        y: c + Math.sin(a) * h * (2 / Math.sqrt(3)),
        out: [0, Math.sin(a), Math.cos(a)],
      });
    }
    return ring;
  });
}

// Pushes a point outward by up to ROUGH (not along u for a straight
// column), then into world space
function place(arch, p, rough) {
  const j = rough ? hash(p.u, p.y, p.v) * ROUGH : 0;
  const v = p.v + p.out[2] * j;
  const y = p.y + p.out[1] * j * (p.out[1] < 0 ? 0.3 : 1);
  const w = toWorld(arch, p.u, v);
  return [w.x, y, w.z];
}

const _color = new THREE.Color();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();

// The colour of a triangle with corners a, b, c (world space) on `arch`
function faceColor(arch, a, b, c, out) {
  _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  _n.crossVectors(_a, _b).normalize();
  const y = (a[1] + b[1] + c[1]) / 3;
  const r = hash(a[0] + c[0], y, a[2] + b[2]);
  if (arch.kind === 'sea') {
    const water = arch.water ?? WATER_LEVEL;
    out
      .copy(CLIFF_GREY)
      .lerp(CLIFF_RED, arch.desert ?? 0)
      .multiplyScalar(0.78 + r * 0.14);
    if (y < water + 10) out.lerp(SEA_WET, 0.4);
    // White on the arch's top, and streaking down its sides from it in
    // columns (where the birds sit above); not on the cliff behind
    const u =
      ((a[0] - arch.x) * arch.ux + (a[2] - arch.z) * arch.uz) /
      (arch.opening ?? 100);
    const birds = 1 - Math.max(0, Math.min(1, (Math.abs(u) - 1) / 0.6));
    const high = (y - water) / (arch.high - water);
    const column = hash(Math.round((a[0] + a[2]) / 14), 0, 0);
    const white =
      _n.y > 0.45
        ? 0.55 + 0.35 * r
        : column > 0.6 && high > 0.4
          ? (high - 0.4) * 1.4 * (0.6 + 0.4 * r)
          : 0;
    if (white > 0) out.lerp(GUANO, Math.min(0.85, white * birds));
  } else if (arch.kind === 'canyon') {
    const tier = Math.floor(
      (y - WATER_LEVEL - 14) / ChillFlightLogic.CANYON_TIER_HEIGHT
    );
    const n = CANYON_BANDS.length;
    out.copy(CANYON_BANDS[((tier % n) + n) % n]);
    out.multiplyScalar(0.92 + r * 0.12);
  } else {
    out.copy(BASALT_WALL).multiplyScalar(0.85 + r * 0.3);
    if (_n.y > 0.9) {
      const k = Math.min(
        BASALT_TOPS.length - 1,
        Math.floor((arch.tint ?? 0.5) * BASALT_TOPS.length)
      );
      out.copy(BASALT_TOPS[k]).multiplyScalar(0.9 + r * 0.15);
    }
  }
  return out;
}

/**
 * The geometry of `arch` (arches-logic.js), in world space, for the
 * terrain's material: positions, colours and morphY (its own height, so it
 * never morphs). groundAt(x, z) is the ground's height, to bury its legs in.
 */
export function archGeometry(arch, groundAt) {
  const hex = arch.kind === 'basalt';
  const rings = hex ? hexRings(arch) : slabRings(arch, groundAt);
  const positions = [];
  const colors = [];
  const tri = (a, b, c) => {
    faceColor(arch, a, b, c, _color);
    for (const p of [a, b, c]) {
      positions.push(p[0], p[1], p[2]);
      colors.push(_color.r, _color.g, _color.b);
    }
  };
  const placed = rings.map((ring) => ring.map((p) => place(arch, p, !hex)));
  const m = placed[0].length;
  for (let i = 0; i < placed.length - 1; i++) {
    const A = placed[i];
    const B = placed[i + 1];
    for (let k = 0; k < m; k++) {
      const k2 = (k + 1) % m;
      // Wound so the faces look outward
      tri(A[k], B[k], B[k2]);
      tri(A[k], B[k2], A[k2]);
    }
  }
  // Caps at the two ends, fanned from their middles
  for (const [ring, flip] of [
    [placed[0], false],
    [placed[placed.length - 1], true],
  ]) {
    const mid = [0, 0, 0];
    for (const p of ring) for (let a = 0; a < 3; a++) mid[a] += p[a] / m;
    for (let k = 0; k < m; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % m];
      if (flip) tri(mid, a, b);
      else tri(mid, b, a);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const morphY = [];
  for (let i = 1; i < positions.length; i += 3) morphY.push(positions[i]);
  geometry.setAttribute('morphY', new THREE.Float32BufferAttribute(morphY, 1));
  geometry.computeVertexNormals();
  return geometry;
}

// This world's arches, for the flight physics, wall scrapes, crashes, the
// buggy and the autopilot: empty until the search for them (a few hundred
// milliseconds) has run, a few milliseconds a frame after loading, so it
// never holds up the start
export const arches = [];

const groundAt = (x, z) =>
  ChillFlightLogic.getElevation(x, z, simplex, {WATER_LEVEL});
const SEARCH_MS_PER_FRAME = 4;
function searchSome(search) {
  const until = performance.now() + SEARCH_MS_PER_FRAME;
  while (performance.now() < until) {
    const step = search.next();
    if (!step.done) continue;
    for (const arch of step.value) {
      const mesh = new THREE.Mesh(
        archGeometry(arch, groundAt),
        terrainMaterial
      );
      mesh.name = `arch-${arch.kind}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      arches.push(arch);
    }
    return;
  }
  setTimeout(() => searchSome(search), 16);
}
if (ChillFlightLogic.SHOW_OBJECTS !== false) {
  setTimeout(() => searchSome(archSearch(simplex, {WATER_LEVEL})), 0);
}
