// --- THE CHRISTMAS VILLAGE: MODELS ---
// The Christmas village's props (specs/christmas-village.md; laid out by
// xmas-village-logic.js, placed by terrain-gen.js, registered in
// terrain-chunks.js): Polyfork's Christmas Village kit (polyfork.dev, free
// licence; sources unchanged in third-party/polyfork), each merged into
// vertex-coloured geometry at load like the other Polyfork models. The parts
// that light up at night (each model's `night` colours: bulbs, lantern panes,
// sugar glass) go in a separate '...Glow' geometry drawn with xmasGlowMat,
// which glows in their own colours after dark, with the streetlights
// (game-loop.js).
import * as THREE from 'three';
import {createMaterial} from './constants.js';
import {POLYFORK_SCALE as S} from './boat-models.js';
import * as lampPost from './third-party/polyfork/garland-lamp-post-af02f0.mjs';
import * as roofLights from './third-party/polyfork/roofline-string-light-run-fa1160.mjs';
import * as yardFir from './third-party/polyfork/front-yard-fir-tree-0a278d.mjs';
import * as signPost from './third-party/polyfork/north-pole-sign-post-a91f4d.mjs';
import * as candyCanes from './third-party/polyfork/candy-cane-path-markers-2310e4.mjs';
import * as ornament from './third-party/polyfork/giant-lawn-ornament-ball-a92ef6.mjs';
import * as presentPile from './third-party/polyfork/wrapped-present-pile-b2ddd9.mjs';
import * as bigPresent from './third-party/polyfork/big-wrapped-present-57b639.mjs';
import * as reindeer from './third-party/polyfork/light-up-wireframe-reindeer-8627df.mjs';
import * as cocoaStand from './third-party/polyfork/hot-cocoa-stand-884f36.mjs';
import * as treatTable from './third-party/polyfork/north-pole-treat-table-91a6e4.mjs';
import * as mailbox from './third-party/polyfork/letters-to-santa-mailbox-f223e5.mjs';
import * as snowFort from './third-party/polyfork/kids-snow-fort-c31153.mjs';
import * as shovel from './third-party/polyfork/snow-shovel-4196ff.mjs';
import * as treeRack from './third-party/polyfork/a-frame-cut-tree-7bb743.mjs';
import * as cutFir from './third-party/polyfork/cut-fir-in-a-21d18a.mjs';
import * as sleigh from './third-party/polyfork/santa-s-sleigh-f1a047.mjs';
import * as toySack from './third-party/polyfork/sack-of-toys-c53e9e.mjs';
import * as gingerbread from './third-party/polyfork/gingerbread-house-8b9049.mjs';

// The night parts' material: lit in their own (vertex) colours, brightness
// set each frame with the streetlights' (game-loop.js)
export const xmasGlowMat = createMaterial({
  vertexColors: true,
  emissive: 0xffffff,
  emissiveIntensity: 0,
  flatShading: true,
  roughness: 0.6,
});
{
  const base = xmasGlowMat.onBeforeCompile;
  xmasGlowMat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      totalEmissiveRadiance *= vColor.rgb;`
    );
  };
}

// The big tree in the square and the gingerbread house are drawn far bigger
// than life (times real size), so they show from the air; the rest at the
// other Polyfork models' scale
const BIG_FIR_SCALE = 11;
const GINGERBREAD_SCALE = 90;
// The gingerbread house's eave (metres as built, above its cake board): the
// walls fold below it, the roof and gables are thrown off above it
const GINGERBREAD_EAVE = 0.135;
// Its cake board (left off: it would be a grey plaza at this size)
const GINGERBREAD_BOARD = 0.021;

// One asset's triangles sorted into {body, glow, roof} geometries: glow for
// the colours in its `night` table and meshes with an emissive material (in
// that colour, or their own if it's white), roof for those whose lowest
// corner is at or above `eave` (metres; null for none). `drop(lowY, highY,
// hex)` leaves triangles out; `lift` raises everything (metres, before
// scale), and `top` puts the highest point at y = 0 instead.
const _c = new THREE.Color();
const _e = new THREE.Color();
const _v = new THREE.Vector3();
function splitAsset(
  module,
  asset,
  scale,
  {eave = null, drop = null, lift = 0, top = false} = {}
) {
  asset.updateMatrixWorld(true);
  const nightHexes = new Set(
    Object.values(module.night || {}).map((n) =>
      new THREE.Color(n.color).getHexString()
    )
  );
  let dy = lift;
  if (top) dy = -new THREE.Box3().setFromObject(asset).max.y;
  const out = {body: [[], []], glow: [[], []], roof: [[], []]};
  asset.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const p = g.attributes.position;
    const col = g.attributes.color;
    const em = o.material?.emissive;
    const emissive = em && em.getHex() !== 0;
    const tint = emissive && em.getHex() !== 0xffffff ? em : null;
    for (let t = 0; t < p.count; t += 3) {
      let low = Infinity;
      let high = -Infinity;
      for (let i = t; i < t + 3; i++) {
        const y = _v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).y;
        low = Math.min(low, y);
        high = Math.max(high, y);
      }
      const hex = col ? _c.fromBufferAttribute(col, t).getHexString() : '';
      if (drop && drop(low, high, hex)) continue;
      const glow = emissive || nightHexes.has(hex);
      const zone = glow
        ? out.glow
        : eave !== null && low >= eave
          ? out.roof
          : out.body;
      for (let i = t; i < t + 3; i++) {
        _v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        zone[0].push(_v.x * scale, (_v.y + dy) * scale, _v.z * scale);
        if (tint) _e.copy(tint);
        else if (col) _e.fromBufferAttribute(col, i);
        else _e.setRGB(1, 1, 1);
        zone[1].push(_e.r, _e.g, _e.b);
      }
    }
  });
  const geo = ([pos, color]) => {
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  return {body: geo(out.body), glow: geo(out.glow), roof: geo(out.roof)};
}

// The props: instanced type (as xmas-village-logic.js names it) ->
// [module, options, scale, splitAsset settings]. Types ending in 'Body' fold
// flat when hit (breakables.js), the rest topple; a model with night parts
// also gets '<type>Glow', and the gingerbread house '...Body' and '...Roof'.
const PROPS = {
  xmasLampPost: [lampPost, {colorway: 'village-black'}, S],
  // Hung along a farmhouse's eave, its wire at y = 0
  xmasRoofLights: [
    roofLights,
    {colorway: 'fir-green', bulbs: 'multicolour'},
    S,
    {top: true},
  ],
  xmasFir: [
    yardFir,
    {size: '3.5m', decorations: 'full', lights: 'multicolour'},
    BIG_FIR_SCALE,
  ],
  xmasFirBare: [
    yardFir,
    {size: '3.5m', decorations: 'none', lights: 'none'},
    BIG_FIR_SCALE,
  ],
  xmasSign: [signPost, {colorway: 'candy-classic', words: 'village'}, S],
  xmasCandyCanesBody: [candyCanes, {colorway: 'classic', hooks: 'path'}, S],
  xmasOrnamentRedBody: [ornament, {colorway: 'christmas-red'}, S],
  xmasOrnamentGoldBody: [ornament, {colorway: 'gold'}, S],
  xmasPresentsBody: [presentPile, {colorway: 'red-and-gold'}, S],
  xmasBigPresentBody: [bigPresent, {colorway: 'fir-green-and-red'}, S],
  xmasReindeer: [reindeer, {colorway: 'frosted-white', pose: 'standing'}, S],
  xmasReindeerGrazing: [
    reindeer,
    {colorway: 'frosted-white', pose: 'grazing'},
    S,
  ],
  xmasCocoaStand: [cocoaStand, {colorway: 'christmas-red'}, S],
  xmasTreatTableBody: [treatTable, {colorway: 'christmas-red'}, S],
  xmasMailboxBody: [mailbox, {colorway: 'christmas-red'}, S],
  xmasSnowFortBody: [snowFort, {colorway: 'fresh-powder'}, S],
  xmasShovelBody: [shovel, {colorway: 'christmas-red'}, S],
  xmasTreeRackBody: [treeRack, {colorway: 'tree-lot'}, S],
  xmasCutFirBody: [cutFir, {colorway: 'lot-classic'}, S],
  xmasSleighBody: [sleigh, {colorway: 'classic-red', load: 'heaped'}, S],
  xmasToySackBody: [toySack, {colorway: 'santa-red'}, S],
  xmasGingerbread: [
    gingerbread,
    {colorway: 'classic', path: false},
    GINGERBREAD_SCALE,
    {
      eave: GINGERBREAD_EAVE,
      lift: -GINGERBREAD_BOARD,
      drop: (low, high) => high <= GINGERBREAD_BOARD,
    },
  ],
};
// The types drawn far off too (the big tree and the gingerbread house, one
// each and big enough to show from a distance), for terrain-chunks.js
export const XMAS_FAR_TYPES = [
  'xmasFir',
  'xmasFirGlow',
  'xmasFirBare',
  'xmasGingerbreadBody',
  'xmasGingerbreadRoof',
  'xmasGingerbreadGlow',
];

// {type: geometry} for every prop: its body (or '...Body' and '...Roof'
// for the gingerbread house) and '...Glow' where it lights up. The base
// type name of a '...Body' prop keeps its name, and its glow goes on the
// name without 'Body' ('xmasSleighBody' -> 'xmasSleighGlow').
export function buildXmasGeos() {
  const geos = {};
  for (const [type, [module, opts, scale, split]] of Object.entries(PROPS)) {
    const parts = splitAsset(module, module.createAsset(opts), scale, split);
    const name = type.replace(/Body$/, '');
    if (parts.roof) {
      geos[name + 'Body'] = parts.body;
      geos[name + 'Roof'] = parts.roof;
    } else {
      geos[type] = parts.body;
    }
    if (parts.glow) geos[name + 'Glow'] = parts.glow;
  }
  return geos;
}
