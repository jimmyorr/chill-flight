// --- BUILDINGS ---
// Polyfork buildings (polyfork.dev, free licence; sources unchanged in
// third-party/polyfork), each merged into one vertex-coloured geometry at
// load (boat-models.js mergeAsset) and drawn bigger like the rest of the
// world. Front toward +z, standing on y = 0.
import * as THREE from 'three';
import {createMaterial} from './constants.js';
import {mergeAsset, POLYFORK_SCALE as S} from './boat-models.js';
import * as controlTower from './third-party/polyfork/airfield-control-tower-ab8d3e.mjs';
import * as fireLookout from './third-party/polyfork/fire-lookout-tower-714fa1.mjs';
import * as waterTower from './third-party/polyfork/water-tower-7eb7ec.mjs';
import * as windpump from './third-party/polyfork/windpump-tower-1633a9.mjs';
import * as beachHut from './third-party/polyfork/beach-hut-fc7649.mjs';
import * as fishShack from './third-party/polyfork/fisherman-shack-ea9b2b.mjs';
import * as rangerStation from './third-party/polyfork/ranger-station-ef6407.mjs';
import * as leanTo from './third-party/polyfork/lean-to-shelter-f0709f.mjs';
import * as mushroomCottage from './third-party/polyfork/mushroom-cottage-1135d1.mjs';
import * as gardenShed from './third-party/polyfork/backyard-garden-shed-38d79f.mjs';
import * as stoneChapel from './third-party/polyfork/stone-chapel-03e774.mjs';
import * as farmhouse from './third-party/polyfork/gabled-farmhouse-c7534f.mjs';

export const buildingMat = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.85,
});

// The airport control tower: Polyfork's Airfield Control Tower, three brick
// storeys under its glass cab, about 18 units across and 32 tall. Brick by
// default, tan at the desert fields and pale grey at the snowy ones.
const CONTROL_TOWER_SCALE = S;
const _towerGeos = new Map();
export function controlTowerGeo(colorway = 'raf-brick') {
  if (!_towerGeos.has(colorway)) {
    _towerGeos.set(
      colorway,
      mergeAsset(
        controlTower.createAsset({colorway, baseStoreys: 3}),
        0,
        CONTROL_TOWER_SCALE
      )
    );
  }
  return _towerGeos.get(colorway);
}

// A mesh of one of these geometries, casting and taking shadows
export function buildingMesh(geo) {
  const m = new THREE.Mesh(geo, buildingMat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// The chapel standing where the monasteries used to: Polyfork's Stone
// Chapel in grey stone and slate, its nave stretched to a little hall,
// with the cross on its gable left off (the dark iron up top). Split at
// the eave into walls and roof (terrain-geometry.js monasteryBodyGeo).
const CHAPEL_OPTS = {colorway: 'slate-roof', tile: '#56616a', naveLength: 1.22};
const CHAPEL_CROSS_Y = 7;
export function buildChapelGeos() {
  const asset = stoneChapel.createAsset(CHAPEL_OPTS);
  const iron = new THREE.Color(
    stoneChapel.presets['slate-roof'].iron
  ).getHexString();
  const eave = lowestOf(asset, CHAPEL_OPTS.tile) - 0.01;
  const cross = (low, hex) => hex === iron && low > CHAPEL_CROSS_Y;
  return {
    body: mergeAsset(asset, 0, S, 0, (y, hex) => y < eave && !cross(y, hex)),
    roof: mergeAsset(asset, 0, S, 0, (y, hex) => y >= eave && !cross(y, hex)),
  };
}

// --- LANDMARKS ---
// Buildings placed by terrain-gen.js (LANDMARK_RULES), one instanced
// type each (registered in terrain-chunks.js). Towers are one part, toppled
// whole when hit; houses are split at their eaves into walls ('...Body',
// folded) and roof ('...Roof', thrown off). `roof` names the model's roof
// colour, whose lowest point is the eave.
//   type: [module, options, scale (times real size), roof colour or null]
const LANDMARKS = {
  fireLookout: [fireLookout, {colorway: 'sun-bleached', height: 1.18}, S, null],
  waterTower: [waterTower, {colorway: 'turquoise'}, S, null],
  windpump: [windpump, {colorway: 'weathered-pine'}, S, null],
  beachHut0: [beachHut, {colorway: 'mint'}, S, 'roof'],
  beachHut1: [beachHut, {colorway: 'coral'}, S, 'roof'],
  beachHut2: [beachHut, {colorway: 'sky'}, S, 'roof'],
  beachHut3: [beachHut, {colorway: 'buttermilk'}, S, 'roof'],
  fishShack: [fishShack, {colorway: 'driftwood-brown'}, S, 'shake'],
  // A small 6 by 4 m cabin as built: drawn bigger so it doesn't look like a
  // toy among the pines
  rangerStation: [rangerStation, {colorway: 'ranger-cedar'}, 5, 'roof'],
  leanTo: [leanTo, {colorway: 'weathered-pine'}, S, 'roof'],
  mushroomCottage0: [mushroomCottage, {colorway: 'amanita'}, 9, 'cap'],
  mushroomCottage1: [mushroomCottage, {colorway: 'blueberry'}, 9, 'cap'],
  gardenShed0: [gardenShed, {colorway: 'sage-garden'}, S, 'roof'],
  gardenShed1: [gardenShed, {colorway: 'seaside-boards'}, S, 'roof'],
  farmhouse: [farmhouse, {colorway: 'cream-plaster'}, S, 'roof'],
};
// Types toppled whole (the rest are houses)
export const LANDMARK_TOWERS = ['fireLookout', 'waterTower', 'windpump'];
// The houses placed so far (terrain-gen.js LANDMARK_RULES)
export const LANDMARK_HOUSES = [
  'beachHut0',
  'beachHut1',
  'beachHut2',
  'beachHut3',
  'fishShack',
  'rangerStation',
  'leanTo',
];

// The lowest point painted in a colour (the model's eave, for its roof)
function lowestOf(asset, hex) {
  asset.updateMatrixWorld(true);
  const want = new THREE.Color(hex).getHexString();
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  let low = Infinity;
  asset.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.color) return;
    const p = o.geometry.attributes.position;
    const cc = o.geometry.attributes.color;
    for (let i = 0; i < p.count; i++) {
      if (c.fromBufferAttribute(cc, i).getHexString() !== want) continue;
      low = Math.min(
        low,
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).y
      );
    }
  });
  return low;
}

// {fireLookout, waterTower, windpump, beachHut0Body, beachHut0Roof, ...}, for the
// landmarks named (all of them by default)
export function buildLandmarkGeos(types = Object.keys(LANDMARKS)) {
  const geos = {};
  for (const type of types) {
    const [module, opts, scale, roof] = LANDMARKS[type];
    const asset = module.createAsset(opts);
    if (!roof) {
      geos[type] = mergeAsset(asset, 0, scale);
      continue;
    }
    const hex =
      opts[roof] ??
      module.presets?.[opts.colorway]?.[roof] ??
      module.params[roof].default;
    const eave = lowestOf(asset, hex) - 0.01;
    geos[type + 'Body'] = mergeAsset(asset, 0, scale, 0, (y) => y < eave);
    geos[type + 'Roof'] = mergeAsset(asset, 0, scale, 0, (y) => y >= eave);
  }
  return geos;
}
