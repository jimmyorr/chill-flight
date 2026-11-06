// --- TREES ---
// Polyfork trees and roots (polyfork.dev, free licence; sources unchanged in
// third-party/polyfork), split at load into trunk and canopy geometries so
// canopies sway in the wind and take per-tree colour variation and snow
// tinting (terrain-geometry.js, terrain-gen.js).
import * as THREE from 'three';
import {mergeAsset, POLYFORK_SCALE} from './boat-models.js';
import * as palmTree from './third-party/polyfork/palm-tree-a307da.mjs';
import * as cherryBlossom from './third-party/polyfork/cherry-blossom-tree-3f7ab7.mjs';
import * as japaneseMaple from './third-party/polyfork/japanese-maple-d2fb29.mjs';
import * as sculptedPine from './third-party/polyfork/sculpted-pine-e45d4f.mjs';
import * as exposedRoots from './third-party/polyfork/exposed-tree-roots-e1409c.mjs';

// Brightest foliage shade of each Polyfork tree's palette. Canopy vertex
// colours are divided by this shade so the brightest clumps sit at (1, 1, 1)
// and darker clumps keep their relative shading; multiplying by instanceColor
// (seeded from the same hex in terrain-gen.js) restores the multi-tone palette
// while letting each tree vary slightly and fade toward white in the snow.
export const PALM_LEAF_COLOR = 0x8fbf5a;
export const CHERRY_BLOSSOM_LEAF_COLOR = 0xf7c9d6;
export const JAPANESE_MAPLE_LEAF_COLOR = 0xb5433a;
export const SCULPTED_PINE_LEAF_COLOR = 0x7fa95c;

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

function splitTreeAsset(asset, scale, trunkColors, baseLeafHex) {
  const trunkHexes = new Set(
    trunkColors.map((c) => new THREE.Color(c).getHexString())
  );
  const trunk = mergeAsset(asset, 0, scale, 0, (_y, hex) =>
    trunkHexes.has(hex)
  );
  const leaves = normalizeLeafColors(
    mergeAsset(asset, 0, scale, 0, (_y, hex) => !trunkHexes.has(hex)),
    baseLeafHex
  );
  return {trunk, leaves};
}

// Palm tree: Polyfork's Palm Tree (cove-palm), curved trunk with flared foot
// and coconuts under a 7-frond rosette, ~26 units tall. A 5-frond version
// without coconuts casts the star-shaped shadow for fewer triangles.
const PALM_SCALE = 4.4;
const PALM_TRUNK_COLORS = ['#6b4526', '#a88458', '#4a2e1b'];
export function buildPalmGeos() {
  const {trunk, leaves} = splitTreeAsset(
    palmTree.createAsset(),
    PALM_SCALE,
    PALM_TRUNK_COLORS,
    PALM_LEAF_COLOR
  );
  const simpleLeaves = splitTreeAsset(
    palmTree.createAsset({fronds: 5, coconuts: 0}),
    PALM_SCALE,
    PALM_TRUNK_COLORS,
    PALM_LEAF_COLOR
  ).leaves;
  return {trunk, leaves, simpleLeaves};
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

// Woodland stump: Polyfork's Exposed Tree Roots, a sawn stump with buttress
// roots and stones around its foot, ~8.7 units across.
export function buildStumpGeo() {
  return mergeAsset(exposedRoots.createAsset(), 0, POLYFORK_SCALE);
}
