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
import * as santa from './third-party/polyfork/santa-0e0332.mjs';
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
// other Polyfork models' scale (Santa a little taller, and the northern
// houses' yard firs at house height)
const BIG_FIR_SCALE = 11;
const YARD_FIR_SCALE = S * 1.25;
const SANTA_SCALE = S * 1.4;
const GINGERBREAD_SCALE = 90;
// The gingerbread house's eave (metres as built, above its cake board): the
// walls fold below it, the roof and gables are thrown off above it
const GINGERBREAD_EAVE = 0.135;
// Its cake board (left off: it would be a grey plaza at this size)
const GINGERBREAD_BOARD = 0.021;

// Poses a rigged Polyfork character (Santa): left arm in its `carryPose`
// holding the sack of toys over his back, right arm raised in a wave
function poseSanta(asset) {
  const deg = Math.PI / 180;
  const pose = asset.userData?.carryPose;
  const bones = {};
  asset.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
  });
  const turn = (name, [rx, ry, rz]) => {
    if (bones[name]) bones[name].rotation.set(rx * deg, ry * deg, rz * deg);
  };
  if (pose) {
    turn('LeftShoulder', pose.shoulder);
    turn('LeftArm', pose.arm);
    turn('LeftForeArm', pose.foreArm);
    turn('LeftHand', pose.hand);
  }
  turn('RightArm', [0, 0, 52]);
  turn('RightForeArm', [0, 72, 0]);
  turn('RightHand', [0, 0, 12]);
  asset.updateMatrixWorld(true);
  asset.traverse((o) => {
    if (o.isSkinnedMesh) o.skeleton.update();
  });
}

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
  {eave = null, drop = null, lift = 0, top = false, pose = null} = {}
) {
  if (pose) pose(asset);
  asset.updateMatrixWorld(true);
  const nightHexes = new Set(
    Object.values(module.night || {}).map((n) =>
      new THREE.Color(n.color).getHexString()
    )
  );
  let dy = lift;
  if (top) dy = -new THREE.Box3().setFromObject(asset).max.y;
  const out = {body: [[], []], glow: [[], []], roof: [[], []]};
  const vertexAt = (o, p, i) => {
    _v.fromBufferAttribute(p, i);
    if (o.isSkinnedMesh) o.applyBoneTransform(i, _v);
    return _v.applyMatrix4(o.matrixWorld);
  };
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
        const y = vertexAt(o, p, i).y;
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
        vertexAt(o, p, i);
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
  // Hung along a house's eave, its wire at y = 0 (multicolour or warm white)
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
  // In northern village front yards in December
  xmasYardFir: [
    yardFir,
    {size: '2.5m', decorations: 'baubles', lights: 'warm-white'},
    YARD_FIR_SCALE,
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
  xmasSanta: [santa, {}, SANTA_SCALE, {pose: poseSanta}],
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
// The roofline string lights (on the village's lane houses and on most
// northern village houses: hundreds in view), built here in low poly rather
// than from the kit's 732-triangle run, which was a fifth of a northern
// village's triangles. One 14-unit run (the kit's 4 m at S), its wire at
// y = 0 sagging between three hooks, and 12 bulbs hanging below it: a
// three-sided wire (72 triangles) and diamond bulbs ('...Glow', 96).
const LIGHT_RUN = 4 * S;
const LIGHT_BULBS = 12;
const LIGHT_SAG = 0.45;
const LIGHT_WIRE = 0.07;
const LIGHT_COLORS = {
  multicolour: ['#ff3b2f', '#2ee860', '#2f9bff', '#ffb300'],
  warm: ['#ffefc2'],
};
function lightRunGeos(bulbs) {
  const body = [[], []];
  const glow = [[], []];
  const tri = (zone, color, a, b, c) => {
    zone[0].push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) zone[1].push(color.r, color.g, color.b);
  };
  // The wire's height along the run: swags between hooks at the ends and
  // a third of the way along
  const wireY = (x) => {
    const u = ((x / LIGHT_RUN + 0.5) * 3) % 1;
    return -LIGHT_SAG * Math.sin(Math.PI * u);
  };
  const wire = new THREE.Color('#445121');
  const steps = 12;
  const ring = (x) => {
    const y = wireY(x);
    return [
      [x, y, -LIGHT_WIRE],
      [x, y, LIGHT_WIRE],
      [x, y - LIGHT_WIRE * 1.7, 0],
    ];
  };
  for (let s = 0; s < steps; s++) {
    const a = ring(LIGHT_RUN * (s / steps - 0.5));
    const b = ring(LIGHT_RUN * ((s + 1) / steps - 0.5));
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3;
      tri(body, wire, a[k], a[k2], b[k2]);
      tri(body, wire, a[k], b[k2], b[k]);
    }
  }
  const colors = LIGHT_COLORS[bulbs].map((hex) => new THREE.Color(hex));
  const r = 0.2;
  const h = 0.32;
  for (let i = 0; i < LIGHT_BULBS; i++) {
    const x = LIGHT_RUN * ((i + 0.5) / LIGHT_BULBS - 0.5);
    const y = wireY(x) - 0.12 - h;
    const color = colors[i % colors.length];
    const top = [x, y + h, 0];
    const bottom = [x, y - h, 0];
    const around = [
      [x + r, y, 0],
      [x, y, r],
      [x - r, y, 0],
      [x, y, -r],
    ];
    for (let k = 0; k < 4; k++) {
      const p = around[k];
      const q = around[(k + 1) % 4];
      tri(glow, color, top, q, p);
      tri(glow, color, bottom, p, q);
    }
  }
  const geo = ([pos, color]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  return {body: geo(body), glow: geo(glow)};
}

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
  for (const [type, bulbs] of [
    ['xmasRoofLights', 'multicolour'],
    ['xmasRoofLightsWarm', 'warm'],
  ]) {
    const parts = lightRunGeos(bulbs);
    geos[type] = parts.body;
    geos[type + 'Glow'] = parts.glow;
  }
  return geos;
}
