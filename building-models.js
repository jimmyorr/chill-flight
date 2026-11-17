// --- BUILDINGS ---
// Polyfork buildings (polyfork.dev, free licence; sources unchanged in
// third-party/polyfork), each merged into one vertex-coloured geometry at
// load (boat-models.js mergeAsset) and drawn bigger like the rest of the
// world. Front toward +z, standing on y = 0.
import * as THREE from 'three';
import {createMaterial} from './constants.js';
import {mergeAsset, POLYFORK_SCALE as S} from './boat-models.js';
import * as controlTower from './third-party/polyfork/airfield-control-tower-ab8d3e.mjs';
import * as windsock from './third-party/polyfork/windsock-d5df79.mjs';
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
import * as camperTrailer from './third-party/polyfork/camper-trailer-b2f706.mjs';
import * as teardropTrailer from './third-party/polyfork/teardrop-trailer-580e25.mjs';
import * as rvTrailer from './third-party/polyfork/rv-travel-trailer-bd53d7.mjs';
import * as waterMill from './third-party/polyfork/water-mill-b31972.mjs';
import * as villageTavern from './third-party/polyfork/village-tavern-4e94e3.mjs';
import * as coveTavern from './third-party/polyfork/cove-tavern-5861a6.mjs';
import * as logCabin from './third-party/polyfork/log-cabin-4fac3b.mjs';
import * as porchLogCabin from './third-party/polyfork/porch-log-cabin-d2f3ef.mjs';
import * as thatchedCottage from './third-party/polyfork/thatched-cottage-0e63f5.mjs';
import * as keeperCottage from './third-party/polyfork/crossing-keeper-s-cottage-de49a4.mjs';
import * as pierSection from './third-party/polyfork/pier-deck-section-7047d7.mjs';
import * as pierCorner from './third-party/polyfork/pier-deck-corner-c56248.mjs';
import * as farmhouse from './third-party/polyfork/gabled-farmhouse-c7534f.mjs';
import * as dragonSkeleton from './third-party/polyfork/dragon-skeleton-88de43.mjs';
import * as dinosaurSkull from './third-party/polyfork/dinosaur-skull-4c3a3c.mjs';
import * as portalModel from './third-party/polyfork/portal-60d5e6.mjs';

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

// The airfield windsock: Polyfork's Windsock in orange and white bands on
// its grey mast, scaled up to a 12-unit pole with its foot at y = 0. Two
// meshes so the sock can move (airports.js updateWindsocks): the mast, and
// the sock on its swivel, WINDSOCK_SWIVEL_Y up, streaming toward its +z.
export const WINDSOCK_POLE_H = 12;
const WINDSOCK_MAST_H = 6.33;
const WINDSOCK_SCALE = WINDSOCK_POLE_H / WINDSOCK_MAST_H;
// The asset's swivel rides 0.75 m under the 6 m mast top
export const WINDSOCK_SWIVEL_Y = (6 - 0.75) * WINDSOCK_SCALE;
const WINDSOCK_OPTS = {colorway: 'international-orange'};
let _windsockMastGeo = null;
export function windsockMastGeo() {
  if (!_windsockMastGeo) {
    const asset = windsock.createAsset(WINDSOCK_OPTS);
    asset.remove(asset.getObjectByName('swivel'));
    _windsockMastGeo = mergeAsset(asset, 0, WINDSOCK_SCALE, Math.PI / 2);
  }
  return _windsockMastGeo;
}

// The sock (with its swivel collar and hoop) filled by a breeze, plus two
// morph targets: the same sock drooping in a light air and standing straight
// out in a gale. The asset keeps the sock's vertex order at every wind, so
// blending between them is a smooth fill or sag.
export const WINDSOCK_FILL_BASE = 0.65;
export const WINDSOCK_FILL_LIGHT = 0.3;
export const WINDSOCK_FILL_GALE = 1;
let _windsockSockGeo = null;
function sockPositions(wind) {
  const asset = windsock.createAsset({...WINDSOCK_OPTS, wind});
  const g = asset.getObjectByName('sock-frame').geometry;
  const p = g.attributes.position.clone();
  for (let i = 0; i < p.array.length; i++) p.array[i] *= WINDSOCK_SCALE;
  return {g, p};
}
export function windsockSockGeo() {
  if (!_windsockSockGeo) {
    const {g, p} = sockPositions(WINDSOCK_FILL_BASE);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', p);
    geo.setAttribute('color', g.attributes.color.clone());
    geo.morphAttributes.position = [
      sockPositions(WINDSOCK_FILL_LIGHT).p,
      sockPositions(WINDSOCK_FILL_GALE).p,
    ];
    geo.computeVertexNormals();
    // Bounds cover every shape the sock can take
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      4.6 * WINDSOCK_SCALE
    );
    _windsockSockGeo = geo;
  }
  return _windsockSockGeo;
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

// The alien wormhole portals in Xen and Westworld: Polyfork's Portal scaled
// up so a plane can thread the opening (~64 wide x ~160 tall under the
// keystone), with the carved rune inlays drawn in a glowing violet material
// and a faint translucent shimmer across the aperture.
export const PORTAL_SCALE = 60;
export const PORTAL_COLORWAYS = ['black-basalt', 'grave-slate', 'bone-ruin'];
const PORTAL_OPTS = {build: 0.15, height: 1.2};
const PORTAL_RUNE_HEX = new THREE.Color(
  portalModel.params.rune.default
).getHexString();

export const portalRuneMat = createMaterial({
  vertexColors: true,
  emissive: 0xb388ff,
  emissiveIntensity: 0.9,
  flatShading: true,
  roughness: 0.4,
});

export const portalVeilMat = createMaterial({
  color: 0xa874ff,
  emissive: 0x7c4dff,
  emissiveIntensity: 0.65,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
  side: THREE.DoubleSide,
  roughness: 0.2,
});
{
  const base = portalVeilMat.onBeforeCompile;
  portalVeilMat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vPortalUv;'
      )
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvPortalUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vPortalUv;'
      )
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        diffuseColor.a *= smoothstep(0.04, 0.32, vPortalUv.y) * (1.0 - smoothstep(0.75, 0.98, vPortalUv.y));`
      );
  };
}

const _portalGeos = new Map();
let _portalVeilGeo = null;
export function portalGeos(colorway = 'black-basalt') {
  if (!_portalGeos.has(colorway)) {
    const asset = portalModel.createAsset({...PORTAL_OPTS, colorway});
    _portalGeos.set(colorway, {
      body: mergeAsset(
        asset,
        0.06,
        PORTAL_SCALE,
        0,
        (_low, hex) => hex !== PORTAL_RUNE_HEX
      ),
      runes: mergeAsset(
        asset,
        0.06,
        PORTAL_SCALE,
        0,
        (_low, hex) => hex === PORTAL_RUNE_HEX
      ),
    });
  }
  if (!_portalVeilGeo) {
    _portalVeilGeo = new THREE.PlaneGeometry(72, 190);
    _portalVeilGeo.translate(3, 83, 0);
  }
  const {body, runes} = _portalGeos.get(colorway);
  return {body, runes, veil: _portalVeilGeo};
}

export function portalGroup(colorway = 'black-basalt') {
  const {body, runes, veil} = portalGeos(colorway);
  const group = new THREE.Group();
  group.add(buildingMesh(body));
  const runeMesh = new THREE.Mesh(runes, portalRuneMat);
  group.add(runeMesh);
  const veilMesh = new THREE.Mesh(veil, portalVeilMat);
  group.add(veilMesh);
  return group;
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
// the deck 4.2 up on its posts. With `ell`, Polyfork's deck corner (its
// 3 m module stretched to the deck's 4 m width) turns the end off to -x
// with two more sections, an arm about 28 long at z 31 to 42.
const PIER_SECTIONS = 3;
export const PIER_DECK_TOP = 1.2 * S;
// Where the L's arm runs (in model units, before rotation): its far end's
// centre, for the pilings and the open-water check
export const PIER_ARM_END = {x: -10 * S, z: 10.5 * S};
export function buildPierGeo(ell = false) {
  const row = new THREE.Group();
  for (let i = 0; i < PIER_SECTIONS; i++) {
    const section = pierSection.createAsset({
      colorway: 'harbour-oak',
      boards: 9 + i,
    });
    section.position.z = 1.5 + i * 3;
    row.add(section);
  }
  if (ell) {
    const corner = pierCorner.createAsset({
      colorway: 'harbour-oak',
      junction: 'corner',
      postHead: 0.36,
    });
    corner.scale.x = 4 / 3;
    corner.position.z = 1.5 + PIER_SECTIONS * 3;
    row.add(corner);
    // The arm: sections in their own way round (4 long along x, 3 wide)
    for (let i = 0; i < 2; i++) {
      const section = pierSection.createAsset({
        colorway: 'harbour-oak',
        boards: 10 - i,
      });
      section.position.set(-4 - i * 4, 0, 1.5 + PIER_SECTIONS * 3);
      row.add(section);
    }
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
// Giant fossil skulls half-buried in the south-west desert: Polyfork's
// Dinosaur Skull in its three species (Tyrannosaurus rex, Triceratops and
// Camarasaurus sauropod), scaled so each reads across the dunes.
export const DINO_SKULL_SPECIES = ['rex', 'triceratops', 'sauropod'];
export const DINO_SKULL_COLORWAYS = [
  'weathered',
  'bleached',
  'river-stained',
  'tar-soaked',
];
const DINO_SKULL_SCALES = {rex: 12, triceratops: 10, sauropod: 16};
export function dinoSkullGeo(species = 'rex', colorway = 'bleached') {
  return mergeAsset(
    dinosaurSkull.createAsset({species, colorway, climate: 'dry'}),
    0,
    DINO_SKULL_SCALES[species] || 12
  );
}
const LANDMARKS = {
  // Campers' trailers parked by some of the campfires: one part each,
  // knocked over whole, not drawn far off (LANDMARK_SMALL)
  trailer0: [camperTrailer, {colorway: 'turquoise'}, S, null],
  trailer1: [camperTrailer, {colorway: 'cherry-red'}, S, null],
  trailer2: [teardropTrailer, {colorway: 'forest-olive'}, S, null],
  trailer3: [rvTrailer, {colorway: 'woodland-brown'}, S, null],
  fireLookout: [fireLookout, {colorway: 'sun-bleached', height: 1.18}, S, null],
  waterTower: [waterTower, {colorway: 'turquoise'}, S, null],
  // Tall 6-bay tower and wide wheel, drawn bigger than S so the rotor clears
  // nearby trees and cacti (~42 units tall)
  windpump: [
    windpump,
    {colorway: 'weathered-pine', towerHeight: 7.5, wheelSpan: 1.8},
    4.4,
    null,
  ],
  dinoSkull0: [
    dinosaurSkull,
    {species: 'rex', colorway: 'bleached', climate: 'dry'},
    DINO_SKULL_SCALES.rex,
    null,
  ],
  dinoSkull1: [
    dinosaurSkull,
    {species: 'triceratops', colorway: 'weathered', climate: 'dry'},
    DINO_SKULL_SCALES.triceratops,
    null,
  ],
  dinoSkull2: [
    dinosaurSkull,
    {species: 'sauropod', colorway: 'river-stained', climate: 'dry'},
    DINO_SKULL_SCALES.sauropod,
    null,
  ],
  beachHut0: [beachHut, {colorway: 'mint'}, S, 'roof'],
  beachHut1: [beachHut, {colorway: 'coral'}, S, 'roof'],
  beachHut2: [beachHut, {colorway: 'sky'}, S, 'roof'],
  beachHut3: [beachHut, {colorway: 'buttermilk'}, S, 'roof'],
  fishShack: [fishShack, {colorway: 'driftwood-brown'}, S, 'shake'],
  // A small 6 by 4 m cabin as built: drawn bigger so it doesn't look like a
  // toy among the pines
  rangerStation: [rangerStation, {colorway: 'ranger-cedar'}, 5, 'roof'],
  // A water mill on a river bank, its wheel in the stream
  waterMill: [waterMill, {colorway: 'mill-oak'}, S, 'thatch'],
  // The inn in some grid villages, in place of one of the two-storey
  // houses, drawn smaller than S so it doesn't tower over them
  villageTavern: [
    villageTavern,
    {colorway: 'cream-oak', width: '10'},
    2.2,
    'tile',
  ],
  // Log cabins in forest clearings
  logCabin0: [logCabin, {colorway: 'pine-cabin', shutters: true}, S, 'shingle'],
  logCabin1: [porchLogCabin, {colorway: 'golden-pine'}, S, 'roof'],
  // A thatched cottage out on the edge of the farm villages
  thatchedCottage: [
    thatchedCottage,
    {colorway: 'lime-oak', chimney: true},
    S,
    'thatch',
  ],
  // A roadside cottage beside the highways, facing the road
  roadCottage: [keeperCottage, {colorway: 'red-brick'}, S, 'slate'],
  // A harbour inn beside some of the piers
  coveTavern: [coveTavern, {colorway: 'weathered-cove'}, S, 'roof'],
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
// One-part landmarks too small to see far off
export const LANDMARK_SMALL = ['trailer0', 'trailer1', 'trailer2', 'trailer3'];
export const LANDMARK_TOWERS = [
  'fireLookout',
  'waterTower',
  'windpump',
  'dinoSkull0',
  'dinoSkull1',
  'dinoSkull2',
];
// The houses placed so far (terrain-gen.js LANDMARK_RULES)
export const LANDMARK_HOUSES = [
  'beachHut0',
  'beachHut1',
  'beachHut2',
  'beachHut3',
  'fishShack',
  'rangerStation',
  'leanTo',
  'waterMill',
  'villageTavern',
  'coveTavern',
  'logCabin0',
  'logCabin1',
  'thatchedCottage',
  'roadCottage',
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
