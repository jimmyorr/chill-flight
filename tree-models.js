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
