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
import * as campTent from './third-party/polyfork/camp-tent-3c5c89.mjs';
import * as pierSection from './third-party/polyfork/pier-deck-section-7047d7.mjs';
import * as farmhouse from './third-party/polyfork/gabled-farmhouse-c7534f.mjs';
import * as dragonSkeleton from './third-party/polyfork/dragon-skeleton-88de43.mjs';

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

// The ancient dragon skeleton curled in a northern tundra hollow: Polyfork's
// Dragon Skeleton scaled up to a landmark ~290 units across and ~100 tall,
// sunk slightly into the ground bed so every rib tip and claw sits firm.
export const DRAGON_SCALE = 45;
export const DRAGON_COLORWAYS = ['old-ivory', 'fossil', 'ash-grey', 'scorched'];
const _dragonGeos = new Map();
export function dragonSkeletonGeo(colorway = 'old-ivory') {
  if (!_dragonGeos.has(colorway)) {
    _dragonGeos.set(
      colorway,
      mergeAsset(
        dragonSkeleton.createAsset({colorway, curl: 0.45}),
        0.05,
        DRAGON_SCALE
      )
    );
  }
  return _dragonGeos.get(colorway);
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

// The campers' tents by the campfires (terrain-chunks.js): Polyfork's Camp
// Tent in three colours, door open toward +z
export const TENT_COLORWAYS = ['canvas-cream', 'forest-olive', 'ranger-grey'];
export function buildTentGeos() {
  return TENT_COLORWAYS.map((colorway) =>
    mergeAsset(campTent.createAsset({colorway}), 0, S)
  );
}

// The piers (terrain-chunks.js): three of Polyfork's pier deck sections in
// a row, running out from the shore along +z, about 14 wide and 31 long,
// the deck 4.2 up on its posts
const PIER_SECTIONS = 3;
export const PIER_DECK_TOP = 1.2 * S;
export function buildPierGeo() {
  const row = new THREE.Group();
  for (let i = 0; i < PIER_SECTIONS; i++) {
    const section = pierSection.createAsset({
      colorway: 'harbour-oak',
      boards: 9 + i,
    });
    section.position.z = 1.5 + i * 3;
    row.add(section);
  }
  return mergeAsset(row, 0, S);
}

// --- LANDMARKS ---
// Buildings placed by terrain-gen.js (LANDMARK_RULES), one instanced
// type each (registered in terrain-chunks.js). Towers are one part, toppled
// whole when hit; houses are split at their eaves into walls ('...Body',
// folded) and roof ('...Roof', thrown off). `roof` names the model's roof
// colour, whose lowest point is the eave.
//   type: [module, options, scale (times real size), roof colour or null]
const GARDEN_SHED_SCALE = 1.8;
// Big enough to live in among the eastern groves' giant mushrooms
const MUSHROOM_COTTAGE_SCALE = 18;
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
  mushroomCottage0: [
    mushroomCottage,
    {colorway: 'amanita'},
    MUSHROOM_COTTAGE_SCALE,
    'cap',
  ],
  mushroomCottage1: [
    mushroomCottage,
    {colorway: 'blueberry'},
    MUSHROOM_COTTAGE_SCALE,
    'cap',
  ],
  // Behind the village houses, drawn at their size (not S) so a shed
  // isn't bigger than the house
  gardenShed0: [
    gardenShed,
    {colorway: 'sage-garden'},
    GARDEN_SHED_SCALE,
    'roof',
  ],
  gardenShed1: [
    gardenShed,
    {colorway: 'seaside-boards'},
    GARDEN_SHED_SCALE,
    'roof',
  ],
  // By the farmsteads' barns, the cold grey-green one up north (the last)
  farmhouse0: [
    farmhouse,
    {colorway: 'cream-plaster', storeys: 1, dormers: 0, shutters: false},
    S,
    'roof',
  ],
  farmhouse1: [
    farmhouse,
    {colorway: 'ochre-barn', storeys: 1, dormers: 0, shutters: false},
    S,
    'roof',
  ],
  farmhouse2: [
    farmhouse,
    {colorway: 'orchard-plum', storeys: 1, dormers: 0, shutters: false},
    S,
    'roof',
  ],
  farmhouse3: [
    farmhouse,
    {colorway: 'slate-north', storeys: 1, dormers: 0, shutters: false},
    S,
    'roof',
  ],
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
  'farmhouse0',
  'farmhouse1',
  'farmhouse2',
  'farmhouse3',
  'gardenShed0',
  'gardenShed1',
  'mushroomCottage0',
  'mushroomCottage1',
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
