// --- BUILDINGS ---
// Polyfork buildings (polyfork.dev, free licence; sources unchanged in
// third-party/polyfork), each merged into one vertex-coloured geometry at
// load (boat-models.js mergeAsset) and drawn bigger like the rest of the
// world. Front toward +z, standing on y = 0.
import * as THREE from 'three';
import {createMaterial} from './constants.js';
import {mergeAsset} from './boat-models.js';
import * as controlTower from './third-party/polyfork/airfield-control-tower-ab8d3e.mjs';
import * as fireLookout from './third-party/polyfork/fire-lookout-tower-714fa1.mjs';
import * as waterTower from './third-party/polyfork/water-tower-7eb7ec.mjs';
import * as windpump from './third-party/polyfork/windpump-tower-1633a9.mjs';
import * as diner from './third-party/polyfork/streamline-diner-car-de9777.mjs';
import * as beachHut from './third-party/polyfork/beach-hut-fc7649.mjs';
import * as fishShack from './third-party/polyfork/fisherman-shack-ea9b2b.mjs';
import * as rangerStation from './third-party/polyfork/ranger-station-ef6407.mjs';
import * as leanTo from './third-party/polyfork/lean-to-shelter-f0709f.mjs';
import * as mushroomCottage from './third-party/polyfork/mushroom-cottage-1135d1.mjs';
import * as gardenShed from './third-party/polyfork/backyard-garden-shed-38d79f.mjs';
import * as farmhouse from './third-party/polyfork/gabled-farmhouse-c7534f.mjs';

export const buildingMat = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.85,
});

// The airport control tower: Polyfork's Airfield Control Tower, three brick
// storeys under its glass cab, about 18 units across and 32 tall. Brick by
// default, tan at the desert fields and pale grey at the snowy ones.
const CONTROL_TOWER_SCALE = 2.2;
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

// --- LANDMARKS ---
// Buildings placed by terrain-gen.js (LANDMARK_RULES), one instanced
// type each (registered in terrain-chunks.js). Towers are one part, toppled
// whole when hit; houses are split at their eaves into walls ('...Body',
// folded) and roof ('...Roof', thrown off). `roof` names the model's roof
// colour, whose lowest point is the eave.
//   type: [module, options, scale (times real size), roof colour or null]
const LANDMARKS = {
  fireLookout: [
    fireLookout,
    {colorway: 'sun-bleached', height: 1.18},
    3.6,
    null,
  ],
  waterTower: [waterTower, {colorway: 'turquoise'}, 2, null],
  windpump: [windpump, {colorway: 'weathered-pine'}, 3, null],
  diner: [diner, {colorway: 'cherry', word: 'DINER'}, 2, 'chrome'],
  beachHut0: [beachHut, {colorway: 'mint'}, 2.6, 'roof'],
  beachHut1: [beachHut, {colorway: 'coral'}, 2.6, 'roof'],
  beachHut2: [beachHut, {colorway: 'sky'}, 2.6, 'roof'],
  beachHut3: [beachHut, {colorway: 'buttermilk'}, 2.6, 'roof'],
  fishShack: [fishShack, {colorway: 'driftwood-brown'}, 3, 'shake'],
  rangerStation: [rangerStation, {colorway: 'ranger-cedar'}, 3, 'roof'],
  leanTo: [leanTo, {colorway: 'weathered-pine'}, 3, 'roof'],
  mushroomCottage0: [mushroomCottage, {colorway: 'amanita'}, 9, 'cap'],
  mushroomCottage1: [mushroomCottage, {colorway: 'blueberry'}, 9, 'cap'],
  gardenShed0: [gardenShed, {colorway: 'sage-garden'}, 2.2, 'roof'],
  gardenShed1: [gardenShed, {colorway: 'seaside-boards'}, 2.2, 'roof'],
  farmhouse: [farmhouse, {colorway: 'cream-plaster'}, 3, 'roof'],
};
// Types toppled whole (the rest are houses)
export const LANDMARK_TOWERS = ['fireLookout', 'waterTower', 'windpump'];

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

// {fireLookout, waterTower, windpump, dinerBody, dinerRoof, ...}, for the
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
