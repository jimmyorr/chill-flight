// --- TREES ---
// Polyfork trees and roots (polyfork.dev, free licence; sources unchanged in
// third-party/polyfork), split at load into trunk and canopy geometries so
// canopies sway in the wind and take per-tree colour variation and snow
// tinting (terrain-geometry.js, terrain-gen.js).
import * as THREE from 'three';
import {mergeAsset, POLYFORK_SCALE} from './boat-models.js';
import {
  averageColor,
  bareTree,
  joinColored,
  bentTrunk,
  coneTiers,
  frondRosette,
  limbsTo,
  lumpCrown,
  prismTrunk,
} from './low-poly.js';
import * as palmTree from './third-party/polyfork/palm-tree-a307da.mjs';
import * as cherryBlossom from './third-party/polyfork/cherry-blossom-tree-3f7ab7.mjs';
import * as japaneseMaple from './third-party/polyfork/japanese-maple-d2fb29.mjs';
import * as sculptedPine from './third-party/polyfork/sculpted-pine-e45d4f.mjs';
import * as exposedRoots from './third-party/polyfork/exposed-tree-roots-e1409c.mjs';
import * as birchTree from './third-party/polyfork/birch-tree-181b33.mjs';
import * as broadleafOak from './third-party/polyfork/broadleaf-oak-997c22.mjs';
import * as oakTree from './third-party/polyfork/oak-tree-50ee7c.mjs';
import * as floweringMagnolia from './third-party/polyfork/flowering-magnolia-dd76cb.mjs';
import * as appleTree from './third-party/polyfork/apple-tree-ef0ba0.mjs';
import * as orchardAppleTree from './third-party/polyfork/orchard-apple-tree-b21f85.mjs';
import * as plumTree from './third-party/polyfork/plum-tree-565179.mjs';
import * as fruitTree from './third-party/polyfork/fruit-tree-4bb1af.mjs';
import * as snowLadenSpruce from './third-party/polyfork/snow-laden-spruce-36716e.mjs';
import * as bareMountainRowan from './third-party/polyfork/bare-mountain-rowan-10e72e.mjs';
import * as deadCottonwood from './third-party/polyfork/dead-cottonwood-edbde8.mjs';
import * as twistedDeadOak from './third-party/polyfork/twisted-dead-oak-49457b.mjs';

// Brightest foliage shade of each Polyfork tree's palette. Canopy vertex
// colours are divided by this shade so the brightest clumps sit at (1, 1, 1)
// and darker clumps keep their relative shading; multiplying by instanceColor
// (seeded from the same hex in terrain-gen.js) restores the multi-tone palette
// while letting each tree vary slightly and fade toward white in the snow.
export const PALM_LEAF_COLOR = 0x8fbf5a;
export const CHERRY_BLOSSOM_LEAF_COLOR = 0xf7c9d6;
export const JAPANESE_MAPLE_LEAF_COLOR = 0xb5433a;
export const SCULPTED_PINE_LEAF_COLOR = 0x7fa95c;
export const BIRCH_LEAF_COLOR = 0xb3d47f;
export const BROADLEAF_OAK_LEAF_COLOR = 0x77b258;
export const OAK_LEAF_COLOR = 0x7d8a5a;
// Neutral base tint for canopies that carry both green leaves and contrasting
// blossoms, fruit or snow caps (magnolia, apple, plum, orchard fruit, snow
// spruce, mountain rowan), keeping both hues intact while still taking subtle
// per-tree variation and snow tinting.
export const MULTI_TONE_LEAF_COLOR = 0xf2f2f2;

// Fills a geometry's vertex colour attribute with a uniform colour so
// procedural trunks and canopies can share vertex-coloured materials with
// multi-tone Polyfork trees.
export function paintGeometry(geo, hex = 0xffffff) {
  const c = new THREE.Color(hex);
  const count = geo.attributes.position.count;
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

function normalizeLeafColors(geo, baseHex) {
  const base = new THREE.Color(baseHex);
  const col = geo.attributes.color.array;
  for (let i = 0; i < col.length; i += 3) {
    col[i] = Math.min(1, col[i] / Math.max(base.r, 1e-4));
    col[i + 1] = Math.min(1, col[i + 1] / Math.max(base.g, 1e-4));
    col[i + 2] = Math.min(1, col[i + 2] / Math.max(base.b, 1e-4));
  }
  return geo;
}

// Low-poly stand-ins (low-poly.js) for the split model: crowns of
// LEAF_LUMPS faceted lumps on a one-prism trunk with a limb up to each,
// ~125 triangles a tree
// instead of 300-1,000 (trees are drawn by the hundred)
const LEAF_LUMPS = 4;
function lowPolyTree({trunk, leaves}) {
  leaves.computeBoundingBox();
  const crown = leaves.boundingBox;
  const lumps = lumpCrown(leaves, LEAF_LUMPS);
  return {
    trunk: limbsTo(
      prismTrunk(trunk, crown.min.y + (crown.max.y - crown.min.y) * 0.3),
      lumps
    ),
    leaves: lumps,
  };
}

function splitTreeAsset(
  asset,
  scale,
  trunkColors,
  baseLeafHex = null,
  low = true
) {
  const trunkHexes = new Set(
    trunkColors.map((c) => new THREE.Color(c).getHexString())
  );
  const trunk = mergeAsset(asset, 0, scale, 0, (_y, hex) =>
    trunkHexes.has(hex)
  );
  const rawLeaves = mergeAsset(
    asset,
    0,
    scale,
    0,
    (_y, hex) => !trunkHexes.has(hex)
  );
  const leaves = baseLeafHex
    ? normalizeLeafColors(rawLeaves, baseLeafHex)
    : rawLeaves;
  // (The full model too, drawn close up: setNearGeometry in terrain-chunks.js)
  return low
    ? {...lowPolyTree({trunk, leaves}), fullTrunk: trunk, fullLeaves: leaves}
    : {trunk, leaves};
}

// Palm tree: Polyfork's Palm Tree (cove-palm), curved trunk with flared foot
// and coconuts under a 7-frond rosette, ~26 units tall. A 5-frond version
// without coconuts casts the star-shaped shadow for fewer triangles.
const PALM_SCALE = 4.4;
const PALM_TRUNK_COLORS = ['#6b4526', '#a88458', '#4a2e1b'];
// Drawn as a bent five-sided trunk and seven creased fronds (~200 triangles,
// was ~645): palms line every tropical beach.
const PALM_FRONDS = 7;
export function buildPalmGeos() {
  const {trunk, leaves} = splitTreeAsset(
    palmTree.createAsset({coconuts: 0}),
    PALM_SCALE,
    PALM_TRUNK_COLORS,
    PALM_LEAF_COLOR,
    false
  );
  const lowTrunk = bentTrunk(trunk);
  lowTrunk.computeBoundingBox();
  const top = trunk.boundingBox;
  // The crown sits on the trunk's top
  const p = trunk.attributes.position;
  let cx = 0;
  let cz = 0;
  let n = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < top.max.y - (top.max.y - top.min.y) * 0.08) continue;
    cx += p.getX(i);
    cz += p.getZ(i);
    n++;
  }
  const lowLeaves = frondRosette(leaves, PALM_FRONDS, cx / n, cz / n);
  // Close up, the full model with its coconuts
  const full = splitTreeAsset(
    palmTree.createAsset(),
    PALM_SCALE,
    PALM_TRUNK_COLORS,
    PALM_LEAF_COLOR,
    false
  );
  return {
    trunk: lowTrunk,
    leaves: lowLeaves,
    simpleLeaves: lowLeaves,
    fullTrunk: full.trunk,
    fullLeaves: full.leaves,
  };
}

// Cherry blossom tree: Polyfork's Cherry Blossom Tree (sakura), dark forked
// trunk and three-tone pink blossom dome, ~19 units tall.
const CHERRY_SCALE = 4.2;
export function buildCherryBlossomGeos() {
  return splitTreeAsset(
    cherryBlossom.createAsset({clumps: 7}),
    CHERRY_SCALE,
    ['#42352a'],
    CHERRY_BLOSSOM_LEAF_COLOR
  );
}

// Japanese maple: Polyfork's Japanese Maple in the crimson beni cultivar,
// forked trunk under layered foliage pads, ~13.5 units tall.
const JAPANESE_MAPLE_SCALE = 4.5;
export function buildJapaneseMapleGeos() {
  return splitTreeAsset(
    japaneseMaple.createAsset({colorway: 'beni', stems: 2, crownMasses: 5}),
    JAPANESE_MAPLE_SCALE,
    [0x6e5a45, 0x3b3128],
    JAPANESE_MAPLE_LEAF_COLOR
  );
}

// Sculpted pine: Polyfork's Sculpted Pine (garden-matsu), leaning trunk with
// cloud-pruned needle pads, ~14.3 units tall.
const SCULPTED_PINE_SCALE = 4.5;
export function buildSculptedPineGeos() {
  return splitTreeAsset(
    sculptedPine.createAsset({plates: 7}),
    SCULPTED_PINE_SCALE,
    ['#6e5a45'],
    SCULPTED_PINE_LEAF_COLOR
  );
}

// Birch tree: Polyfork's Birch Tree, white papery bark with grey and dark
// lenticel bands and an airy two-tone crown, ~23.4 units tall.
const BIRCH_SCALE = 3.6;
export function buildBirchGeos() {
  return splitTreeAsset(
    birchTree.createAsset({clumps: 4}),
    BIRCH_SCALE,
    ['#f8f3ec', '#a3a099', '#3a2a1e'],
    BIRCH_LEAF_COLOR
  );
}

// Broadleaf oak: Polyfork's Broadleaf Oak, two-tone furrowed bark and a
// three-limbed dome of faceted foliage clumps, ~22.3 units tall.
const BROADLEAF_OAK_SCALE = 3.2;
export function buildBroadleafOakGeos() {
  return splitTreeAsset(
    broadleafOak.createAsset({limbs: 3}),
    BROADLEAF_OAK_SCALE,
    ['#4a3527', '#75563b'],
    BROADLEAF_OAK_LEAF_COLOR
  );
}

// Oak tree: Polyfork's Oak Tree, sturdy buttressed trunk with three-tone
// bark under a broad spreading crown, ~23.5 units tall.
const OAK_SCALE = 3.8;
export function buildOakGeos() {
  return splitTreeAsset(
    oakTree.createAsset({blobs: 6, trunkFacets: 6}),
    OAK_SCALE,
    ['#8c6a4a', '#6f4e37', '#b89b72'],
    OAK_LEAF_COLOR
  );
}

// Flowering magnolia: Polyfork's Flowering Magnolia, pale grey bark and a
// deep green crown studded with cream and rose-pink blossoms, ~17.1 units tall.
const MAGNOLIA_SCALE = 2.8;
export function buildMagnoliaGeos() {
  return splitTreeAsset(
    floweringMagnolia.createAsset({bloom: 0.3}),
    MAGNOLIA_SCALE,
    ['#7e8286']
  );
}

// Orchard and hedgerow fruit trees: Polyfork's Apple Tree, Orchard Apple Tree,
// Plum Tree and Fruit Tree, keeping their multi-tone green leaves and red,
// gold and purple fruit un-normalized (~12.6 to 13.6 units tall).
const APPLE_TREE_SCALE = 3.8;
export function buildAppleTreeGeos() {
  return splitTreeAsset(
    appleTree.createAsset({crop: 6, canopyFacets: 6}),
    APPLE_TREE_SCALE,
    ['#764f35']
  );
}

const ORCHARD_APPLE_SCALE = 3.5;
export function buildOrchardAppleGeos() {
  return splitTreeAsset(
    orchardAppleTree.createAsset({overgrowth: 0.2}),
    ORCHARD_APPLE_SCALE,
    ['#856850', '#bdaa93']
  );
}

const PLUM_TREE_SCALE = 4.2;
export function buildPlumTreeGeos() {
  return splitTreeAsset(
    plumTree.createAsset({crop: 6, canopyFacets: 6}),
    PLUM_TREE_SCALE,
    ['#593c2a']
  );
}

const FRUIT_TREE_SCALE = 3.4;
export function buildFruitTreeGeos() {
  return splitTreeAsset(
    fruitTree.createAsset({wear: 'kept', fruitLoad: 4}),
    FRUIT_TREE_SCALE,
    ['#8a6236']
  );
}

// Snow-laden spruce: Polyfork's Snow-Laden Spruce, five tiers of dark green
// spruce needles weighted down by thick snow caps and a root drift, ~22.7
// units tall.
const SNOW_SPRUCE_SCALE = 4.2;
export function buildSnowSpruceGeos() {
  const {trunk, leaves} = splitTreeAsset(
    snowLadenSpruce.createAsset({tiers: 5}),
    SNOW_SPRUCE_SCALE,
    ['#a97c50'],
    null,
    false
  );
  // Five snowy cones (140 triangles, was ~640): spruces fill the north
  return {
    trunk,
    leaves: coneTiers(leaves, 5, 7),
    fullTrunk: trunk,
    fullLeaves: leaves,
  };
}

// Bare mountain rowan: Polyfork's Bare Mountain Rowan, smooth grey bole under
// snow-loafed winter branches and clusters of red-orange berries, ~18.1 units
// tall.
const MOUNTAIN_ROWAN_SCALE = 3.6;
export function buildMountainRowanGeos() {
  return splitTreeAsset(
    bareMountainRowan.createAsset({berry: '#c84b31'}),
    MOUNTAIN_ROWAN_SCALE,
    ['#6b6862']
  );
}

// Dead cottonwood: Polyfork's Dead Cottonwood without the boomtown notice
// board, bleached grey-white snag with peeling bark strips and a rotted
// hollow, ~22.4 units tall.
const DEAD_COTTONWOOD_SCALE = 3.2;
export function buildDeadCottonwoodGeo() {
  return bareTree(
    mergeAsset(
      deadCottonwood.createAsset({boomtown: 0.3, weather: 0.6}),
      0.2,
      DEAD_COTTONWOOD_SCALE
    )
  );
}

// Twisted dead oak: Polyfork's Twisted Dead Oak in dark storm-brown bark with
// gnarled limbs, buttress roots and a hollow knothole, ~20.9 units tall.
const TWISTED_DEAD_OAK_SCALE = 3.0;
export function buildTwistedDeadOakGeo() {
  return bareTree(
    mergeAsset(
      twistedDeadOak.createAsset({
        colorway: 'storm-brown',
        gnarl: 0.75,
        spread: 1.1,
        knothole: true,
        roots: 5,
      }),
      0.2,
      TWISTED_DEAD_OAK_SCALE
    )
  );
}

// Woodland stump: Polyfork's Exposed Tree Roots, a sawn stump with buttress
// roots and stones around its foot, ~8.7 units across.
// (Low poly: a capped six-sided stump in its colours, ~24 triangles)
export function buildStumpGeo() {
  const full = mergeAsset(exposedRoots.createAsset(), 0, POLYFORK_SCALE);
  full.computeBoundingBox();
  const box = full.boundingBox;
  const h = box.max.y - box.min.y;
  const r = Math.min(box.max.x - box.min.x, box.max.z - box.min.z) * 0.22;
  const color = averageColor(full);
  const stump = new THREE.CylinderGeometry(r, r * 1.35, h, 6);
  stump.translate(0, box.min.y + h / 2, 0);
  return joinColored([[stump, color]]);
}

// --- PROCEDURAL DESERT FLORA (SAGUARO CACTUS & JOSHUA TREE) ---

function rgbOf(hex, shade = 1) {
  const c = new THREE.Color(hex);
  return [
    Math.min(1, Math.max(0, c.r * shade)),
    Math.min(1, Math.max(0, c.g * shade)),
    Math.min(1, Math.max(0, c.b * shade)),
  ];
}

function mixRgb(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function vSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vScale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function vDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vNorm(a) {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

function makePlantBuilder(withColors = true) {
  const pos = [];
  const col = [];
  function pushVert(p, c) {
    pos.push(p[0], p[1], p[2]);
    if (withColors) col.push(c[0], c[1], c[2]);
  }
  function tri(a, b, c, ca, cb = ca, cc = ca) {
    pushVert(a, ca);
    pushVert(b, cb);
    pushVert(c, cc);
  }
  function quad(a, b, c, d, ca, cb = ca, cc = cb, cd = ca) {
    tri(a, b, c, ca, cb, cc);
    tri(a, c, d, ca, cc, cd);
  }
  function build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (withColors) {
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    }
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
  return {tri, quad, build};
}

// Twist-free parallel-transport frame along a 3D station polyline:
// each station is [x, y, z, r, crestRgb, valleyRgb].
function computeTubeFrames(stations) {
  const n = stations.length;
  const tangents = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tangents.push(vNorm(vSub(stations[1], stations[0])));
    } else if (i === n - 1) {
      tangents.push(vNorm(vSub(stations[n - 1], stations[n - 2])));
    } else {
      const t0 = vNorm(vSub(stations[i], stations[i - 1]));
      const t1 = vNorm(vSub(stations[i + 1], stations[i]));
      tangents.push(vNorm(vAdd(t0, t1)));
    }
  }
  const frames = [];
  let u = null;
  for (let i = 0; i < n; i++) {
    const t = tangents[i];
    if (i === 0) {
      const ref = Math.abs(t[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0];
      u = vNorm(vSub(ref, vScale(t, vDot(ref, t))));
    } else {
      const proj = vSub(u, vScale(t, vDot(u, t)));
      u = Math.hypot(proj[0], proj[1], proj[2]) > 1e-5 ? vNorm(proj) : u;
    }
    const v = vNorm(vCross(t, u));
    frames.push({t, u, v});
  }
  return frames;
}

function addLoftedTube(
  B,
  stations,
  {
    vertsPerRing = 10,
    fluted = false,
    crestMul = 1.09,
    valleyMul = 0.78,
    twist = 0,
    gnarl = 0,
    capLift = 0,
    capColor = null,
  } = {}
) {
  const frames = computeTubeFrames(stations);
  const rings = [];
  const ringCols = [];
  for (let i = 0; i < stations.length; i++) {
    const [cx, cy, cz, r, crestRgb = [1, 1, 1], valleyRgb = crestRgb] =
      stations[i];
    const {u, v} = frames[i];
    const pts = [];
    const cols = [];
    for (let k = 0; k < vertsPerRing; k++) {
      const a = twist + i * gnarl * 0.22 + (k / vertsPerRing) * Math.PI * 2;
      const mul = fluted
        ? k % 2 === 0
          ? crestMul
          : valleyMul
        : 1 + gnarl * Math.sin(k * 2.3 + i * 1.7);
      const rk = r * mul;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      pts.push([
        cx + rk * (ca * u[0] + sa * v[0]),
        cy + rk * (ca * u[1] + sa * v[1]),
        cz + rk * (ca * u[2] + sa * v[2]),
      ]);
      const shade = 0.96 + 0.06 * Math.sin(k * 1.9 + i * 0.8);
      const baseRgb = fluted && k % 2 === 1 ? valleyRgb : crestRgb;
      cols.push([
        Math.min(1, baseRgb[0] * shade),
        Math.min(1, baseRgb[1] * shade),
        Math.min(1, baseRgb[2] * shade),
      ]);
    }
    rings.push(pts);
    ringCols.push(cols);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = rings[i];
    const r1 = rings[i + 1];
    const c0 = ringCols[i];
    const c1 = ringCols[i + 1];
    for (let k = 0; k < vertsPerRing; k++) {
      const k1 = (k + 1) % vertsPerRing;
      B.quad(r0[k], r0[k1], r1[k1], r1[k], c0[k], c0[k1], c1[k1], c1[k]);
    }
  }
  if (capLift > 0) {
    const lastIdx = stations.length - 1;
    const [cx, cy, cz, , crestRgb = [1, 1, 1]] = stations[lastIdx];
    const {t} = frames[lastIdx];
    const apex = [
      cx + t[0] * capLift,
      cy + t[1] * capLift,
      cz + t[2] * capLift,
    ];
    const topRing = rings[lastIdx];
    const topCols = ringCols[lastIdx];
    const apexCol = capColor || crestRgb;
    for (let k = 0; k < vertsPerRing; k++) {
      const k1 = (k + 1) % vertsPerRing;
      B.tri(topRing[k], topRing[k1], apex, topCols[k], topCols[k1], apexCol);
    }
  }
  return frames[frames.length - 1];
}

// Waxy 5-petal Sonoran saguaro crown blossom (creamy-ivory petals, olive
// hypanthium tube, golden stamen cup)
function addSaguaroBlossom(B, center, axis, scale = 1) {
  const t = vNorm(axis);
  const ref = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = vNorm(vSub(ref, vScale(t, vDot(ref, t))));
  const v = vNorm(vCross(t, u));
  const ptAt = (along, rad, ang) => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    return [
      center[0] + t[0] * along + rad * (ca * u[0] + sa * v[0]),
      center[1] + t[1] * along + rad * (ca * u[1] + sa * v[1]),
      center[2] + t[2] * along + rad * (ca * u[2] * 1 + sa * v[2]),
    ];
  };
  const cupDark = rgbOf(0x56733b);
  const cupRim = rgbOf(0x7d9952);
  const petalBack = rgbOf(0xe9e1c8);
  const petalFront = rgbOf(0xfbf7e8);
  const stamenRim = rgbOf(0xf0bc2e);
  const stamenCore = rgbOf(0xd99016);

  const N = 5;
  const basePts = [];
  const throatPts = [];
  const stamenPts = [];
  const tipPts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const aMid = ((i + 0.5) / N) * Math.PI * 2;
    basePts.push(ptAt(-0.08 * scale, 0.2 * scale, a));
    throatPts.push(ptAt(0.28 * scale, 0.38 * scale, a));
    stamenPts.push(ptAt(0.32 * scale, 0.28 * scale, a));
    tipPts.push(ptAt(0.56 * scale, 0.86 * scale, aMid));
  }
  const heart = ptAt(0.38 * scale, 0, 0);
  for (let i = 0; i < N; i++) {
    const i1 = (i + 1) % N;
    B.quad(
      basePts[i],
      basePts[i1],
      throatPts[i1],
      throatPts[i],
      cupDark,
      cupDark,
      cupRim,
      cupRim
    );
    B.tri(throatPts[i], throatPts[i1], tipPts[i], cupRim, cupRim, petalBack);
    B.tri(
      stamenPts[i],
      tipPts[i],
      stamenPts[i1],
      stamenRim,
      petalFront,
      stamenRim
    );
    B.tri(stamenPts[i], stamenPts[i1], heart, stamenRim, stamenRim, stamenCore);
  }
}

// Sonoran saguaro cactus (`Carnegiea gigantea`): fluted accordion ribs with
// sunlit olive-sage spine crests and deep desert-teal pleats, corky woody
// ankle, three curved 3D arms at natural azimuths, and waxy crown blossoms.
export function buildCactusGeos() {
  const B = makePlantBuilder(true);
  const M = makePlantBuilder(true);
  const S = makePlantBuilder(false);

  const barkBase = rgbOf(0x6e5e47);
  const barkCollar = rgbOf(0x5b6b42);
  const crestMid = rgbOf(0x5e9146);
  const crestUpper = rgbOf(0x6da14f);
  const crestCrown = rgbOf(0x78a856);
  const valleyLow = rgbOf(0x2d5230);
  const valleyMid = rgbOf(0x345e37);
  const valleyHigh = rgbOf(0x3c6b3d);
  const midSage = mixRgb(crestMid, valleyMid, 0.35);
  const midCrown = mixRgb(crestCrown, valleyHigh, 0.3);
  const crownFelt = rgbOf(0x6b5f49);
  const jointCallus = rgbOf(0x5e533e);

  // Main saguaro column: constricted woody ankle -> plump mid-barrel -> dome
  const trunkStations = [
    [0, -0.35, 0, 1.18, barkBase, barkBase],
    [0, 1.25, 0, 1.28, barkCollar, valleyLow],
    [0.04, 6.2, 0.02, 1.58, crestMid, valleyMid],
    [-0.03, 12.1, -0.02, 1.44, crestUpper, valleyHigh],
    [0, 14.45, 0, 0.88, crestCrown, valleyHigh],
  ];
  addLoftedTube(B, trunkStations, {
    vertsPerRing: 12,
    fluted: true,
    crestMul: 1.09,
    valleyMul: 0.77,
    capLift: 0.52,
    capColor: crownFelt,
  });
  addLoftedTube(
    M,
    [
      [0, -0.2, 0, 1.22, barkBase],
      [0, 1.6, 0, 1.32, barkCollar],
      [0, 7.5, 0, 1.54, midSage],
      [0, 14.4, 0, 1.02, midCrown],
    ],
    {vertsPerRing: 6, capLift: 0.55, capColor: rgbOf(0xd9ca86)}
  );
  addLoftedTube(
    S,
    [
      [0, 0, 0, 1.3],
      [0, 7.5, 0, 1.5],
      [0, 14.8, 0, 1.1],
    ],
    {vertsPerRing: 4, capLift: 0.3}
  );

  // Helper to curve an arm along radial azimuth `az`: starts tucked in trunk
  // with a slight downward droop, sweeps around an organic elbow, rises upright
  function addCurvedArm(az, profile, ribs = 5) {
    const ca = Math.cos(az);
    const sa = Math.sin(az);
    const stations = profile.map(([u, y, r, cCrest, cVal]) => [
      u * ca,
      y,
      u * sa,
      r,
      cCrest,
      cVal,
    ]);
    addLoftedTube(B, stations, {
      vertsPerRing: ribs * 2,
      fluted: true,
      crestMul: 1.09,
      valleyMul: 0.78,
      twist: az * 0.5,
      capLift: 0.38,
      capColor: crownFelt,
    });
    const midProfile = [
      [...profile[0].slice(0, 3), jointCallus],
      [...profile[2].slice(0, 3), midSage],
      [...profile[profile.length - 1].slice(0, 3), midCrown],
    ].map(([u, y, r, col]) => [u * ca, y, u * sa, r * 0.98, col]);
    addLoftedTube(M, midProfile, {
      vertsPerRing: 4,
      twist: Math.PI / 4,
      capLift: 0.35,
      capColor: midCrown,
    });
    const shadowProfile = [
      profile[0],
      profile[2],
      profile[profile.length - 1],
    ].map(([u, y, r]) => [u * ca, y, u * sa, r * 0.95]);
    addLoftedTube(S, shadowProfile, {vertsPerRing: 4, capLift: 0.25});
  }

  // Primary tall lower arm (+X/-Z right-quarter silhouette)
  const azRight = -0.36;
  addCurvedArm(
    azRight,
    [
      [0.85, 5.55, 0.68, jointCallus, jointCallus],
      [2.45, 5.32, 0.96, crestMid, valleyLow],
      [3.88, 6.25, 1.06, crestMid, valleyMid],
      [4.05, 9.3, 1.04, crestUpper, valleyMid],
      [3.92, 12.35, 0.72, crestCrown, valleyHigh],
    ],
    5
  );

  // Secondary upper opposite arm (-X/+Z left-quarter silhouette)
  const azLeft = 2.72;
  addCurvedArm(
    azLeft,
    [
      [0.82, 8.25, 0.64, jointCallus, jointCallus],
      [2.2, 8.1, 0.9, crestMid, valleyLow],
      [3.28, 8.95, 0.98, crestUpper, valleyMid],
      [3.42, 11.4, 0.94, crestUpper, valleyHigh],
      [3.32, 13.55, 0.66, crestCrown, valleyHigh],
    ],
    5
  );

  // Shorter young 3rd arm (+Z/+X front-side) for 3D depth from every heading
  const azSide = 1.18;
  addCurvedArm(
    azSide,
    [
      [0.82, 6.95, 0.56, jointCallus, jointCallus],
      [2.05, 7.05, 0.8, crestMid, valleyMid],
      [2.58, 8.15, 0.84, crestUpper, valleyMid],
      [2.48, 10.0, 0.58, crestCrown, valleyHigh],
    ],
    4
  );

  // Crown saguaro blossoms + one ripe ruby-coral cactus fruit
  addSaguaroBlossom(B, [0.16, 14.88, 0.14], [0.2, 1, 0.18], 0.95);
  addSaguaroBlossom(
    B,
    [3.92 * Math.cos(azRight), 12.66, 3.92 * Math.sin(azRight)],
    [0.12, 1, -0.06],
    0.82
  );
  addLoftedTube(
    B,
    [
      [-0.3, 14.74, -0.2, 0.16, crownFelt],
      [-0.5, 15.08, -0.32, 0.28, rgbOf(0xc94234)],
    ],
    {vertsPerRing: 5, capLift: 0.2, capColor: rgbOf(0xe3624d)}
  );

  // Slim 12-triangle tapered saguaro far LOD post with base-to-crown shading
  const F = makePlantBuilder(true);
  addLoftedTube(
    F,
    [
      [0, 0, 0, 1.48, barkCollar],
      [0, 13.8, 0, 1.28, crestMid],
    ],
    {vertsPerRing: 4, twist: Math.PI / 4, capLift: 1.2, capColor: crestUpper}
  );

  return {
    cactusGeo: M.build(),
    cactusNearGeo: B.build(),
    cactusShadowGeo: S.build(),
    cactusFarGeo: F.build(),
  };
}

// 3-triangle closed V-keeled yucca bayonet dagger blade
function addYuccaDagger(
  B,
  origin,
  dir,
  axisHint,
  len,
  halfW,
  halfK,
  colTop,
  colKeel
) {
  const d = vNorm(dir);
  let wRaw = vCross(axisHint, d);
  if (Math.hypot(wRaw[0], wRaw[1], wRaw[2]) < 1e-4) {
    wRaw = vCross([1, 0, 0], d);
  }
  const w = vNorm(wRaw);
  const k = vNorm(vCross(d, w));
  const bLeft = [
    origin[0] + w[0] * halfW + k[0] * halfK,
    origin[1] + w[1] * halfW + k[1] * halfK,
    origin[2] + w[2] * halfW + k[2] * halfK,
  ];
  const bRight = [
    origin[0] - w[0] * halfW + k[0] * halfK,
    origin[1] - w[1] * halfW + k[1] * halfK,
    origin[2] - w[2] * halfW + k[2] * halfK,
  ];
  const bKeel = [
    origin[0] - k[0] * halfK * 1.15,
    origin[1] - k[1] * halfK * 1.15,
    origin[2] - k[2] * halfK * 1.15,
  ];
  const tip = [
    origin[0] + d[0] * len,
    origin[1] + d[1] * len,
    origin[2] + d[2] * len,
  ];
  const colTip = mixRgb(colTop, [0.95, 0.96, 0.84], 0.22);
  B.tri(bLeft, bRight, tip, colTop, colTop, colTip);
  B.tri(bRight, bKeel, tip, colTop, colKeel, colTip);
  B.tri(bKeel, bLeft, tip, colKeel, colTop, colTip);
}

// Spherical urchin starburst Mojave yucca rosette + optional flower panicle
function addJoshuaRosette(L, center, frame, scale = 1, withPanicle = false) {
  const {t, u, v} = frame;
  const skirtTop = rgbOf(0x85814b);
  const skirtKeel = rgbOf(0x646238);
  const midTop = rgbOf(0x6d8b3b);
  const midKeel = rgbOf(0x4c6429);
  const upperTop = rgbOf(0x799943);
  const crownTop = rgbOf(0x88a84e);
  const crownKeel = rgbOf(0x5e7a34);

  const dirAt = (pitch, az) => {
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const ca = Math.cos(az);
    const sa = Math.sin(az);
    return vNorm([
      t[0] * sp + cp * (ca * u[0] + sa * v[0]),
      t[1] * sp + cp * (ca * u[1] + sa * v[1]),
      t[2] * sp + cp * (ca * u[2] + sa * v[2]),
    ]);
  };
  const shiftAlong = (dist) => [
    center[0] + t[0] * dist,
    center[1] + t[1] * dist,
    center[2] + t[2] * dist,
  ];

  // Tier 1: 5 reflexed lower skirt daggers draping over the straw collar
  const oLow = shiftAlong(-0.28 * scale);
  for (let i = 0; i < 5; i++) {
    const az = (i / 5) * Math.PI * 2 + 0.12;
    addYuccaDagger(
      L,
      oLow,
      dirAt(-0.52 + (i % 2) * 0.08, az),
      t,
      2.25 * scale,
      0.38 * scale,
      0.24 * scale,
      skirtTop,
      skirtKeel
    );
  }

  // Tier 2: 6 wide equatorial rosette daggers
  const oMid = shiftAlong(0.05 * scale);
  for (let i = 0; i < 6; i++) {
    const az = ((i + 0.5) / 6) * Math.PI * 2;
    addYuccaDagger(
      L,
      oMid,
      dirAt(0.06 + (i % 2) * 0.1, az),
      t,
      2.6 * scale,
      0.4 * scale,
      0.26 * scale,
      midTop,
      midKeel
    );
  }

  // Tier 3: 5 upper-angled daggers rounding out the spherical urchin crown
  const oUpper = shiftAlong(0.28 * scale);
  for (let i = 0; i < 5; i++) {
    const az = (i / 5) * Math.PI * 2 + 0.45;
    addYuccaDagger(
      L,
      oUpper,
      dirAt(0.58 + (i % 2) * 0.08, az),
      t,
      2.48 * scale,
      0.38 * scale,
      0.24 * scale,
      upperTop,
      midKeel
    );
  }

  if (withPanicle) {
    // Plump pineapple-shaped Mojave flower panicle nestled in the upper spears
    const pBase = shiftAlong(0.35 * scale);
    const pMid = shiftAlong(1.12 * scale);
    const pTop = shiftAlong(1.78 * scale);
    addLoftedTube(
      L,
      [
        [...pBase, 0.38 * scale, rgbOf(0xbab882)],
        [...pMid, 0.74 * scale, rgbOf(0xf2ebd4)],
        [...pTop, 0.44 * scale, rgbOf(0xf8f3e1)],
      ],
      {
        vertsPerRing: 4,
        twist: 0.4,
        gnarl: 0.08,
        capLift: 0.38 * scale,
        capColor: rgbOf(0xe8dec0),
      }
    );
  } else {
    // 3 steep central spear hearts closing the apex of non-flowering crowns
    const oTop = shiftAlong(0.42 * scale);
    for (let i = 0; i < 3; i++) {
      const az = (i / 3) * Math.PI * 2 + 0.25;
      addYuccaDagger(
        L,
        oTop,
        dirAt(1.08, az),
        t,
        2.3 * scale,
        0.34 * scale,
        0.22 * scale,
        crownTop,
        crownKeel
      );
    }
  }
}

// Lightweight 15-triangle mid-LOD spiky rosette for 0.5-3 km Joshua trees
function addJoshuaMidRosette(
  LM,
  center,
  frame,
  scale = 1,
  withPanicle = false
) {
  const {t, u, v} = frame;
  const midTop = rgbOf(0x6d8b3b);
  const midKeel = rgbOf(0x4c6429);
  const crownTop = withPanicle ? rgbOf(0xebe3c8) : rgbOf(0x84a34b);
  const dirAt = (pitch, az) => {
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const ca = Math.cos(az);
    const sa = Math.sin(az);
    return vNorm([
      t[0] * sp + cp * (ca * u[0] + sa * v[0]),
      t[1] * sp + cp * (ca * u[1] + sa * v[1]),
      t[2] * sp + cp * (ca * u[2] + sa * v[2]),
    ]);
  };
  for (let i = 0; i < 4; i++) {
    const az = (i / 4) * Math.PI * 2 + 0.25;
    addYuccaDagger(
      LM,
      center,
      dirAt(i % 2 === 0 ? -0.18 : 0.35, az),
      t,
      2.55 * scale,
      0.56 * scale,
      0.38 * scale,
      midTop,
      midKeel
    );
  }
  addYuccaDagger(
    LM,
    center,
    t,
    u,
    (withPanicle ? 2.15 : 2.35) * scale,
    0.58 * scale,
    0.42 * scale,
    crownTop,
    midTop
  );
}

// Mojave Joshua tree (`Yucca brevifolia`): gnarled dichotomous trunk with
// furrowed corky base, shaggy sun-bleached dead-leaf thatch collars, crooked
// upswept limbs, a weathered dead snag, spiky V-keeled starburst dagger
// rosettes, and creamy terminal flower panicles.
export function buildJoshuaTreeGeos() {
  const T = makePlantBuilder(true);
  const L = makePlantBuilder(true);
  const TM = makePlantBuilder(true);
  const LM = makePlantBuilder(true);

  const rootBark = rgbOf(0x57483a);
  const lowerBark = rgbOf(0x6e5c49);
  const midBark = rgbOf(0x826e56);
  const thatchDark = rgbOf(0x8b7454);
  const thatchGold = rgbOf(0xab9168);
  const snagBleach = rgbOf(0xa89982);

  // Flared fibrous root bole rising with a subtle Mojave lean to primary fork
  addLoftedTube(
    T,
    [
      [-0.08, -0.45, 0.04, 1.82, rootBark],
      [0.08, 1.35, 0.06, 1.38, lowerBark],
      [0.2, 3.85, -0.08, 1.24, midBark],
      [0.14, 6.25, -0.04, 1.3, thatchDark],
    ],
    {vertsPerRing: 6, gnarl: 0.09, capLift: 0.4, capColor: thatchDark}
  );
  addLoftedTube(
    TM,
    [
      [-0.08, -0.4, 0.04, 1.72, rootBark],
      [0.14, 6.25, -0.04, 1.26, thatchDark],
    ],
    {vertsPerRing: 4, twist: 0.4, capLift: 0.3, capColor: thatchDark}
  );

  function addCrownLimb(pts, crownScale, withPanicle = false) {
    const stations = pts.map(([x, y, z, r, col]) => [x, y, z, r, col]);
    // Swell the final collar into a shaggy golden-straw reflexed thatch skirt
    const last = stations[stations.length - 1];
    const prev = stations[stations.length - 2];
    const dir = vNorm(vSub(last, prev));
    const skirtMid = [
      last[0] - dir[0] * 0.9,
      last[1] - dir[1] * 0.9,
      last[2] - dir[2] * 0.9,
      last[3] * 1.45,
      thatchGold,
    ];
    stations.splice(stations.length - 1, 0, skirtMid);
    const tipFrame = addLoftedTube(T, stations, {
      vertsPerRing: 5,
      gnarl: 0.08,
      capLift: 0.24,
      capColor: thatchDark,
    });
    addJoshuaRosette(
      L,
      [last[0], last[1], last[2]],
      tipFrame,
      crownScale,
      withPanicle
    );
    const midTipFrame = addLoftedTube(TM, [pts[0], pts[pts.length - 1]], {
      vertsPerRing: 3,
      capLift: 0.2,
      capColor: thatchGold,
    });
    addJoshuaMidRosette(
      LM,
      [last[0], last[1], last[2]],
      midTipFrame,
      crownScale,
      withPanicle
    );
  }

  function addPrimaryBough(pts) {
    addLoftedTube(T, pts, {
      vertsPerRing: 5,
      gnarl: 0.08,
      capLift: 0.28,
      capColor: thatchDark,
    });
    addLoftedTube(TM, [pts[0], pts[pts.length - 1]], {
      vertsPerRing: 3,
      capLift: 0.2,
      capColor: thatchDark,
    });
  }

  // Primary Bough A (+X/-Z): starts upright inside bole, curves out to fork
  addPrimaryBough([
    [0.2, 5.45, -0.08, 0.68, midBark],
    [0.52, 6.55, -0.22, 0.88, midBark],
    [1.65, 8.35, -0.62, 0.84, midBark],
    [2.65, 10.65, -0.85, 0.82, thatchDark],
  ]);
  // Crown A1: tallest crooked Mojave leader + creamy flower panicle
  addCrownLimb(
    [
      [2.6, 10.2, -0.84, 0.54, midBark],
      [3.4, 13.4, -1.5, 0.64, thatchDark],
      [3.85, 16.55, -1.75, 0.62, thatchGold],
    ],
    1.08,
    true
  );
  // Crown A2: wide crooked eastern elbow
  addCrownLimb(
    [
      [2.65, 10.2, -0.8, 0.52, midBark],
      [5.35, 11.4, 0.65, 0.6, thatchDark],
      [6.85, 13.65, 1.45, 0.58, thatchGold],
    ],
    0.96,
    false
  );

  // Primary Bough B (-X/-Z): wide gnarled Mojave arm + weathered dead snag
  addPrimaryBough([
    [0.06, 5.45, -0.08, 0.66, midBark],
    [-0.45, 6.45, -0.26, 0.86, midBark],
    [-2.35, 7.85, -0.92, 0.82, midBark],
    [-4.15, 9.85, -1.48, 0.78, thatchDark],
  ]);
  // Sun-bleached dead snag stub jutting off lower Bough B
  addLoftedTube(
    T,
    [
      [-2.25, 7.75, -0.85, 0.42, midBark],
      [-3.85, 7.55, 1.05, 0.32, snagBleach],
      [-4.65, 8.35, 1.95, 0.18, snagBleach],
    ],
    {vertsPerRing: 4, gnarl: 0.1, capLift: 0.3, capColor: snagBleach}
  );
  // Crown B1: tall western fork + second flower panicle
  addCrownLimb(
    [
      [-4.1, 9.45, -1.46, 0.52, midBark],
      [-4.95, 12.6, -2.45, 0.62, thatchDark],
      [-5.15, 15.4, -2.7, 0.6, thatchGold],
    ],
    1.04,
    true
  );
  // Crown B2: dramatic low wide outreach
  addCrownLimb(
    [
      [-4.15, 9.45, -1.42, 0.48, midBark],
      [-6.45, 10.2, -0.15, 0.56, thatchDark],
      [-7.2, 12.05, 0.65, 0.54, thatchGold],
    ],
    0.9,
    false
  );

  // Primary Bough C (+Z): southern fork into two asymmetrical crowns
  addPrimaryBough([
    [0.14, 5.45, 0.04, 0.64, midBark],
    [0.24, 6.5, 0.55, 0.84, midBark],
    [0.42, 8.1, 2.55, 0.78, midBark],
    [0.55, 9.95, 4.45, 0.75, thatchDark],
  ]);
  // Crown C1: tall southern crown
  addCrownLimb(
    [
      [0.52, 9.55, 4.4, 0.5, midBark],
      [-0.55, 12.3, 5.55, 0.58, thatchDark],
      [-0.95, 14.8, 5.95, 0.56, thatchGold],
    ],
    0.98,
    false
  );
  // Crown C2: lower south-eastern elbow
  addCrownLimb(
    [
      [0.58, 9.55, 4.42, 0.48, midBark],
      [2.35, 10.4, 5.85, 0.54, thatchDark],
      [3.15, 11.85, 6.25, 0.52, thatchGold],
    ],
    0.86,
    false
  );

  return {
    trunk: TM.build(),
    leaves: LM.build(),
    fullTrunk: T.build(),
    fullLeaves: L.build(),
  };
}
