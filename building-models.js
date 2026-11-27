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
import * as ferrisWheelModel from './third-party/polyfork/ferris-wheel-ca5b0b.mjs';

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

// The Crossroads fairground Ferris wheel: Polyfork's Ferris Wheel scaled to
// ~95 units tall so its spoked rings and pastel gondolas crown the easternmost
// market town's skyline, with counter-rotating level gondolas and warm/cool
// carnival rim bulbs that come on with the streetlights at dusk.
export const FERRIS_SCALE = 4.75;
export const FERRIS_PERIOD_SEC = 60;
export const FERRIS_COLORWAYS = ['sandtray', 'sweet-shop', 'harbour-dusk'];
const FERRIS_BULB_WARM = '#ffb84d';
const FERRIS_BULB_COOL = '#5cd6ff';
const FERRIS_BULB_HEXES = new Set([
  new THREE.Color(FERRIS_BULB_WARM).getHexString(),
  new THREE.Color(FERRIS_BULB_COOL).getHexString(),
]);
const FERRIS_OPTS = {
  wheelSize: 1.15,
  gondolas: 12,
  legSplay: 0.55,
  deck: true,
  roofs: true,
  bulbA: FERRIS_BULB_WARM,
  bulbB: FERRIS_BULB_COOL,
};

export const ferrisGlowMat = createMaterial({
  vertexColors: true,
  emissive: 0xffffff,
  emissiveIntensity: 0,
  flatShading: true,
  roughness: 0.55,
});
{
  const base = ferrisGlowMat.onBeforeCompile;
  ferrisGlowMat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      totalEmissiveRadiance *= vColor.rgb;`
    );
  };
}

function scaleNonIndexedGeo(
  srcGeo,
  scale,
  keepTri = null,
  extraTris = null,
  sinkBottom = 0
) {
  const g = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo;
  const p = g.attributes.position;
  const c = g.attributes.color;
  const pos = [];
  const col = [];
  const tmpColor = new THREE.Color();
  for (let t = 0; t < p.count; t += 3) {
    if (keepTri) {
      const hex = c ? tmpColor.fromBufferAttribute(c, t).getHexString() : '';
      if (!keepTri(hex)) continue;
    }
    for (let i = t; i < t + 3; i++) {
      const rawY = p.getY(i);
      const y = sinkBottom > 0 && rawY <= 1e-4 ? -sinkBottom : rawY * scale;
      pos.push(p.getX(i) * scale, y, p.getZ(i) * scale);
      if (c) col.push(c.getX(i), c.getY(i), c.getZ(i));
      else col.push(1, 1, 1);
    }
  }
  if (extraTris) extraTris(pos, col);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

function appendOuterRimBulbs(pos, col, scale) {
  const warm = new THREE.Color(FERRIS_BULB_WARM);
  const cool = new THREE.Color(FERRIS_BULB_COOL);
  const rimR = 7.005 * FERRIS_OPTS.wheelSize * scale;
  const bulbR = 0.34 * scale;
  const pushOcta = (color, cx, cy, cz, r) => {
    const top = [cx, cy, cz + r];
    const bot = [cx, cy, cz - r];
    const ring = [
      [cx + r, cy, cz],
      [cx, cy + r, cz],
      [cx - r, cy, cz],
      [cx, cy - r, cz],
    ];
    for (let k = 0; k < 4; k++) {
      const p0 = ring[k];
      const p1 = ring[(k + 1) % 4];
      pos.push(...top, ...p0, ...p1);
      pos.push(...bot, ...p1, ...p0);
      for (let i = 0; i < 6; i++) col.push(color.r, color.g, color.b);
    }
  };
  for (const zs of [-1, 1]) {
    const zRim = zs * 1.66 * scale;
    const zSpoke = zs * 1.56 * scale;
    // 24 outer-rim bulbs per face
    for (let m = 0; m < 24; m++) {
      const a = (m / 24) * Math.PI * 2;
      pushOcta(
        m % 2 ? cool : warm,
        Math.sin(a) * rimR,
        Math.cos(a) * rimR,
        zRim,
        bulbR
      );
    }
    // 2 radial spoke bulbs along each of the 12 spokes per face
    for (let s = 0; s < FERRIS_OPTS.gondolas; s++) {
      const a = (s / FERRIS_OPTS.gondolas) * Math.PI * 2;
      pushOcta(
        warm,
        Math.sin(a) * rimR * 0.36,
        Math.cos(a) * rimR * 0.36,
        zSpoke,
        bulbR * 0.85
      );
      pushOcta(
        cool,
        Math.sin(a) * rimR * 0.74,
        Math.cos(a) * rimR * 0.74,
        zSpoke,
        bulbR * 0.85
      );
    }
  }
}

const _ferrisGeos = new Map();
export function ferrisWheelGeos(colorway = 'sandtray') {
  if (!_ferrisGeos.has(colorway)) {
    const asset = ferrisWheelModel.createAsset({...FERRIS_OPTS, colorway});
    const frameMesh = asset.getObjectByName('frame-static');
    const wheelObj = asset.getObjectByName('wheel');
    const wheelFrame = asset.getObjectByName('wheel-frame');
    const frameStatic = scaleNonIndexedGeo(
      frameMesh.geometry,
      FERRIS_SCALE,
      null,
      null,
      2
    );
    const wheelBody = scaleNonIndexedGeo(
      wheelFrame.geometry,
      FERRIS_SCALE,
      (hex) => !FERRIS_BULB_HEXES.has(hex)
    );
    const wheelGlow = scaleNonIndexedGeo(
      wheelFrame.geometry,
      FERRIS_SCALE,
      (hex) => FERRIS_BULB_HEXES.has(hex),
      (pos, col) => appendOuterRimBulbs(pos, col, FERRIS_SCALE)
    );
    const gondolaGeos = [];
    const gondolaSlots = [];
    const count = FERRIS_OPTS.gondolas;
    for (let k = 0; k < count; k++) {
      const gp = asset.getObjectByName(`gondola-${k}`);
      const slotColor = Math.min(k, count - k) % 4;
      if (!gondolaGeos[slotColor]) {
        const gm = gp.children[0];
        gondolaGeos[slotColor] = scaleNonIndexedGeo(gm.geometry, FERRIS_SCALE);
      }
      gondolaSlots.push({
        x: gp.position.x * FERRIS_SCALE,
        y: gp.position.y * FERRIS_SCALE,
        slotColor,
      });
    }
    _ferrisGeos.set(colorway, {
      hubY: wheelObj.position.y * FERRIS_SCALE,
      frameStatic,
      wheelBody,
      wheelGlow,
      gondolaGeos,
      gondolaSlots,
    });
  }
  return _ferrisGeos.get(colorway);
}

export function ferrisWheelGroup(
  colorway = 'sandtray',
  {withGondolas = true} = {}
) {
  const geos = ferrisWheelGeos(colorway);
  const group = new THREE.Group();
  group.name = 'ferris-wheel';
  group.add(buildingMesh(geos.frameStatic));

  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  wheel.position.set(0, geos.hubY, 0);
  wheel.add(buildingMesh(geos.wheelBody));
  const bulbMesh = new THREE.Mesh(geos.wheelGlow, ferrisGlowMat);
  bulbMesh.name = 'wheel-bulbs';
  wheel.add(bulbMesh);
  group.add(wheel);

  const gondolas = [];
  if (withGondolas) {
    for (let k = 0; k < geos.gondolaSlots.length; k++) {
      const slot = geos.gondolaSlots[k];
      const gm = buildingMesh(geos.gondolaGeos[slot.slotColor]);
      gm.name = `gondola-${k}`;
      gm.position.set(slot.x, slot.y, 0);
      wheel.add(gm);
      gondolas.push(gm);
    }
  }

  group.userData.animateFerris = (angle, wind = 0, timeSec = 0) => {
    wheel.rotation.z = angle;
    for (let k = 0; k < gondolas.length; k++) {
      const sway =
        Math.sin(timeSec * 1.6 + k * 1.15) * 0.032 * (0.35 + wind * 0.65);
      gondolas[k].rotation.z = -angle + sway;
    }
  };
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

// --- VILLAGE HOUSES & CASTLE RUINS ---

function localRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(hex, scale = 1) {
  const c = new THREE.Color(hex);
  return [
    Math.min(1, c.r * scale),
    Math.min(1, c.g * scale),
    Math.min(1, c.b * scale),
  ];
}

function scaleRgb(rgb, k) {
  return [
    Math.min(1, rgb[0] * k),
    Math.min(1, rgb[1] * k),
    Math.min(1, rgb[2] * k),
  ];
}

function createColoredBuilder() {
  const pos = [];
  const col = [];
  const tri = (a, b, c, rgb) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    col.push(
      rgb[0],
      rgb[1],
      rgb[2],
      rgb[0],
      rgb[1],
      rgb[2],
      rgb[0],
      rgb[1],
      rgb[2]
    );
  };
  // Counter-clockwise when viewed from outside: bl -> br -> tr -> tl
  const quad = (bl, br, tr, tl, rgb) => {
    tri(bl, br, tr, rgb);
    tri(bl, tr, tl, rgb);
  };
  const box = (
    x0,
    x1,
    y0,
    y1,
    z0,
    z1,
    rgb,
    {
      top = true,
      bottom = false,
      front = true,
      back = true,
      left = true,
      right = true,
      topRgb = null,
    } = {}
  ) => {
    const sideShade = scaleRgb(rgb, 0.91);
    const backShade = scaleRgb(rgb, 0.86);
    const botShade = scaleRgb(rgb, 0.62);
    const tCol = topRgb || scaleRgb(rgb, 1.05);
    if (front)
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], rgb);
    if (back)
      quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], backShade);
    if (right)
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], sideShade);
    if (left)
      quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], sideShade);
    if (top) quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], tCol);
    if (bottom)
      quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], botShade);
  };
  // Tapered rectangular frustum ring (open top/bottom unless requested)
  const frustum = (
    cx,
    cz,
    hx0,
    hz0,
    y0,
    hx1,
    hz1,
    y1,
    rgb,
    {top = false, topRgb = null} = {}
  ) => {
    const sideShade = scaleRgb(rgb, 0.91);
    const backShade = scaleRgb(rgb, 0.86);
    quad(
      [cx - hx0, y0, cz + hz0],
      [cx + hx0, y0, cz + hz0],
      [cx + hx1, y1, cz + hz1],
      [cx - hx1, y1, cz + hz1],
      rgb
    );
    quad(
      [cx + hx0, y0, cz - hz0],
      [cx - hx0, y0, cz - hz0],
      [cx - hx1, y1, cz - hz1],
      [cx + hx1, y1, cz - hz1],
      backShade
    );
    quad(
      [cx + hx0, y0, cz + hz0],
      [cx + hx0, y0, cz - hz0],
      [cx + hx1, y1, cz - hz1],
      [cx + hx1, y1, cz + hz1],
      sideShade
    );
    quad(
      [cx - hx0, y0, cz - hz0],
      [cx - hx0, y0, cz + hz0],
      [cx - hx1, y1, cz + hz1],
      [cx - hx1, y1, cz - hz1],
      sideShade
    );
    if (top) {
      quad(
        [cx - hx1, y1, cz + hz1],
        [cx + hx1, y1, cz + hz1],
        [cx + hx1, y1, cz - hz1],
        [cx - hx1, y1, cz - hz1],
        topRgb || scaleRgb(rgb, 1.05)
      );
    }
  };
  const build = () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  };
  return {pos, col, tri, quad, box, frustum, build};
}

// Adds one framed story of walls (y0..y1) around [-5..5] x [-5..5] with
// angled corner quoins (2 quads per corner, zero coplanar overlap).
function addFramedStory(B, y0, y1, wallRgb, trimRgb) {
  const w = 5.0;
  const pOut = 5.13;
  const pIn = 4.52;
  const sideWall = scaleRgb(wallRgb, 0.95);
  const backWall = scaleRgb(wallRgb, 0.92);
  const trimSide = scaleRgb(trimRgb, 0.9);

  // 4 recessed plaster panels
  B.quad([-pIn, y0, w], [pIn, y0, w], [pIn, y1, w], [-pIn, y1, w], wallRgb);
  B.quad(
    [pIn, y0, -w],
    [-pIn, y0, -w],
    [-pIn, y1, -w],
    [pIn, y1, -w],
    backWall
  );
  B.quad([w, y0, pIn], [w, y0, -pIn], [w, y1, -pIn], [w, y1, pIn], sideWall);
  B.quad(
    [-w, y0, -pIn],
    [-w, y0, pIn],
    [-w, y1, pIn],
    [-w, y1, -pIn],
    sideWall
  );

  // 4 angled corner quoins (2 quads = 4 tris per corner)
  B.quad(
    [pIn, y0, w],
    [pOut, y0, pOut],
    [pOut, y1, pOut],
    [pIn, y1, w],
    trimRgb
  );
  B.quad(
    [pOut, y0, pOut],
    [w, y0, pIn],
    [w, y1, pIn],
    [pOut, y1, pOut],
    trimSide
  );

  B.quad(
    [-pOut, y0, pOut],
    [-pIn, y0, w],
    [-pIn, y1, w],
    [-pOut, y1, pOut],
    trimRgb
  );
  B.quad(
    [-w, y0, pIn],
    [-pOut, y0, pOut],
    [-pOut, y1, pOut],
    [-w, y1, pIn],
    trimSide
  );

  B.quad(
    [w, y0, -pIn],
    [pOut, y0, -pOut],
    [pOut, y1, -pOut],
    [w, y1, -pIn],
    trimSide
  );
  B.quad(
    [pOut, y0, -pOut],
    [pIn, y0, -w],
    [pIn, y1, -w],
    [pOut, y1, -pOut],
    trimSide
  );

  B.quad(
    [-pIn, y0, -w],
    [-pOut, y0, -pOut],
    [-pOut, y1, -pOut],
    [-pIn, y1, -w],
    trimSide
  );
  B.quad(
    [-pOut, y0, -pOut],
    [-w, y0, -pIn],
    [-w, y1, -pIn],
    [-pOut, y1, -pOut],
    trimSide
  );
}

function buildHouseBodyGeo(eaves, roofRise, twoStory) {
  const B = createColoredBuilder();
  const plinthRgb = [0.54, 0.52, 0.5];
  const ledgeRgb = [0.66, 0.64, 0.61];
  const wallRgb = [0.98, 0.97, 0.95];
  const trimRgb = [0.74, 0.7, 0.65];
  const beamRgb = [0.62, 0.57, 0.52];
  const louverRgb = [0.22, 0.22, 0.24];

  // Grounded stone plinth (buried to y = -1.1 so hillside houses never float)
  B.frustum(0, 0, 5.26, 5.26, -1.1, 5.24, 5.24, 0.84, plinthRgb);
  B.frustum(0, 0, 5.24, 5.24, 0.84, 5.0, 5.0, 1.02, ledgeRgb);

  if (twoStory) {
    addFramedStory(B, 1.02, 7.08, wallRgb, trimRgb);
    // Projecting inter-story string-course / belt band (16 tris)
    B.frustum(0, 0, 5.0, 5.0, 7.08, 5.22, 5.22, 7.28, beamRgb);
    B.frustum(0, 0, 5.22, 5.22, 7.28, 5.0, 5.0, 7.52, scaleRgb(beamRgb, 1.08));
    addFramedStory(B, 7.52, eaves, wallRgb, trimRgb);
  } else {
    addFramedStory(B, 1.02, eaves, wallRgb, trimRgb);
  }

  // Sprocketed gable walls at x = -5 and x = +5 tucked cleanly into roof slab
  const zKnee = 3.55;
  const yWallMeet = eaves + 0.18;
  const yKnee = eaves + (twoStory ? 1.42 : 1.28);
  const yPeak = eaves + roofRise - 0.16;
  const gableRgb = scaleRgb(wallRgb, 0.95);

  for (const sx of [-1, 1]) {
    const x = sx * 5.0;
    const pL = [x, eaves, sx > 0 ? 5.0 : -5.0];
    const pR = [x, eaves, sx > 0 ? -5.0 : 5.0];
    const mL = [x, yWallMeet, sx > 0 ? 5.0 : -5.0];
    const mR = [x, yWallMeet, sx > 0 ? -5.0 : 5.0];
    const kL = [x, yKnee, sx > 0 ? zKnee : -zKnee];
    const kR = [x, yKnee, sx > 0 ? -zKnee : zKnee];
    const pk = [x, yPeak, 0];

    B.quad(pL, pR, mR, mL, gableRgb);
    B.quad(mL, mR, kR, kL, gableRgb);
    B.tri(kL, kR, pk, gableRgb);

    // Gable collar tie-beam across knee line (6 tris)
    const x0 = sx > 0 ? 5.0 : -5.13;
    const x1 = sx > 0 ? 5.13 : -5.0;
    B.box(x0, x1, yKnee - 0.16, yKnee + 0.14, -zKnee, zKnee, beamRgb, {
      left: sx < 0,
      right: sx > 0,
      top: true,
      bottom: true,
      front: false,
      back: false,
    });

    // Framed attic louver vent (10 tris: 4 sloped outer bevels + 1 louver core)
    const vy0 = yKnee + (twoStory ? 1.15 : 0.85);
    const vy1 = vy0 + (twoStory ? 1.4 : 1.2);
    const vz = 0.44;
    const xWallFace = sx * 5.0;
    const xFront = sx * 5.14;
    if (sx > 0) {
      B.quad(
        [xWallFace, vy0 - 0.14, vz + 0.14],
        [xWallFace, vy0 - 0.14, -vz - 0.14],
        [xFront, vy0, -vz],
        [xFront, vy0, vz],
        scaleRgb(trimRgb, 0.82)
      );
      B.quad(
        [xWallFace, vy1 + 0.14, -vz - 0.14],
        [xWallFace, vy1 + 0.14, vz + 0.14],
        [xFront, vy1, vz],
        [xFront, vy1, -vz],
        scaleRgb(trimRgb, 1.04)
      );
      B.quad(
        [xWallFace, vy0 - 0.14, -vz - 0.14],
        [xWallFace, vy1 + 0.14, -vz - 0.14],
        [xFront, vy1, -vz],
        [xFront, vy0, -vz],
        trimRgb
      );
      B.quad(
        [xWallFace, vy1 + 0.14, vz + 0.14],
        [xWallFace, vy0 - 0.14, vz + 0.14],
        [xFront, vy0, vz],
        [xFront, vy1, vz],
        trimRgb
      );
      B.quad(
        [xFront, vy0, vz],
        [xFront, vy0, -vz],
        [xFront, vy1, -vz],
        [xFront, vy1, vz],
        louverRgb
      );
    } else {
      B.quad(
        [xWallFace, vy0 - 0.14, -vz - 0.14],
        [xWallFace, vy0 - 0.14, vz + 0.14],
        [xFront, vy0, vz],
        [xFront, vy0, -vz],
        scaleRgb(trimRgb, 0.82)
      );
      B.quad(
        [xWallFace, vy1 + 0.14, vz + 0.14],
        [xWallFace, vy1 + 0.14, -vz - 0.14],
        [xFront, vy1, -vz],
        [xFront, vy1, vz],
        scaleRgb(trimRgb, 1.04)
      );
      B.quad(
        [xWallFace, vy0 - 0.14, vz + 0.14],
        [xWallFace, vy1 + 0.14, vz + 0.14],
        [xFront, vy1, vz],
        [xFront, vy0, vz],
        trimRgb
      );
      B.quad(
        [xWallFace, vy1 + 0.14, -vz - 0.14],
        [xWallFace, vy0 - 0.14, -vz - 0.14],
        [xFront, vy0, -vz],
        [xFront, vy1, -vz],
        trimRgb
      );
      B.quad(
        [xFront, vy0, -vz],
        [xFront, vy0, vz],
        [xFront, vy1, vz],
        [xFront, vy1, -vz],
        louverRgb
      );
    }
  }

  return B.build();
}

// Pueblo / desert adobe body with battered walls, stepped front parapet, and
// projecting dark cedar vigas (used when house.style === 'adobe').
function buildAdobeHouseBodyGeo(eaves, twoStory) {
  const B = createColoredBuilder();
  const plinthRgb = [0.64, 0.58, 0.52];
  const wallRgb = [0.98, 0.96, 0.93];
  const capRgb = [0.84, 0.78, 0.72];
  const vigaRgb = [0.28, 0.2, 0.15];

  B.frustum(0, 0, 5.25, 5.25, -1.1, 5.12, 5.12, 0.9, plinthRgb);
  B.frustum(0, 0, 5.12, 5.12, 0.9, 4.94, 4.94, eaves, wallRgb);

  // Parapet crown around roof terrace
  const pTop = eaves + 1.05;
  const pIn = 4.25;
  B.box(-4.94, 4.94, eaves, pTop, -4.94, -pIn, wallRgb, {
    bottom: false,
    topRgb: capRgb,
  });
  B.box(-4.94, -pIn, eaves, pTop, -pIn, pIn, wallRgb, {
    bottom: false,
    front: false,
    back: false,
    topRgb: capRgb,
  });
  B.box(pIn, 4.94, eaves, pTop, -pIn, pIn, wallRgb, {
    bottom: false,
    front: false,
    back: false,
    topRgb: capRgb,
  });
  B.box(-4.94, -2.1, eaves, pTop, pIn, 4.94, wallRgb, {
    bottom: false,
    right: false,
    topRgb: capRgb,
  });
  B.box(2.1, 4.94, eaves, pTop, pIn, 4.94, wallRgb, {
    bottom: false,
    left: false,
    topRgb: capRgb,
  });
  B.box(-2.1, 2.1, eaves, pTop + 0.65, pIn, 4.96, wallRgb, {
    bottom: false,
    topRgb: capRgb,
  });

  // Projecting cedar vigas along front and back below parapet
  const vy = eaves - 0.85;
  for (const vx of [-3.3, -1.1, 1.1, 3.3]) {
    B.box(vx - 0.18, vx + 0.18, vy - 0.18, vy + 0.18, 4.9, 5.55, vigaRgb, {
      back: false,
      bottom: true,
    });
    B.box(vx - 0.18, vx + 0.18, vy - 0.18, vy + 0.18, -5.55, -4.9, vigaRgb, {
      front: false,
      bottom: true,
    });
  }
  if (twoStory) {
    const vyLower = 7.15;
    for (const vx of [-3.3, 0, 3.3]) {
      B.box(
        vx - 0.17,
        vx + 0.17,
        vyLower - 0.17,
        vyLower + 0.17,
        4.96,
        5.45,
        vigaRgb,
        {back: false, bottom: true}
      );
      B.box(
        vx - 0.17,
        vx + 0.17,
        vyLower - 0.17,
        vyLower + 0.17,
        -5.45,
        -4.96,
        vigaRgb,
        {front: false, bottom: true}
      );
    }
  }
  return B.build();
}

function buildHouseRoofGeo(eaves, roofRise, twoStory) {
  const B = createColoredBuilder();
  const xWall = 5.0;
  const xVerge = 5.68;
  const zEave = 5.88;
  const zKnee = 3.55;
  const thick = 0.36;

  const yEaveBot = eaves - 0.36;
  const yEaveTop = eaves;
  const yWallBot =
    yEaveBot + ((zEave - 5.0) / (zEave - zKnee)) * (twoStory ? 1.66 : 1.52);
  const yKneeBot = eaves + (twoStory ? 1.3 : 1.16);
  const yKneeTop = yKneeBot + thick;
  const yPeakBot = eaves + roofRise - thick;
  const yPeakTop = eaves + roofRise;

  const upperTile = [1.0, 0.99, 0.98];
  const lowerTile = [0.9, 0.89, 0.88];
  const bargeRgb = [0.72, 0.68, 0.65];
  const fasciaRgb = [0.68, 0.64, 0.61];
  const soffitRgb = [0.46, 0.44, 0.43];
  const ridgeRgb = [0.78, 0.74, 0.71];

  // +Z (front) sprocketed lower & upper slopes
  B.quad(
    [-xVerge, yEaveTop, zEave],
    [xVerge, yEaveTop, zEave],
    [xVerge, yKneeTop, zKnee],
    [-xVerge, yKneeTop, zKnee],
    lowerTile
  );
  B.quad(
    [-xVerge, yKneeTop, zKnee],
    [xVerge, yKneeTop, zKnee],
    [xVerge, yPeakTop, 0],
    [-xVerge, yPeakTop, 0],
    upperTile
  );

  // -Z (back) sprocketed lower & upper slopes
  B.quad(
    [xVerge, yEaveTop, -zEave],
    [-xVerge, yEaveTop, -zEave],
    [-xVerge, yKneeTop, -zKnee],
    [xVerge, yKneeTop, -zKnee],
    scaleRgb(lowerTile, 0.94)
  );
  B.quad(
    [xVerge, yKneeTop, -zKnee],
    [-xVerge, yKneeTop, -zKnee],
    [-xVerge, yPeakTop, 0],
    [xVerge, yPeakTop, 0],
    scaleRgb(upperTile, 0.94)
  );

  // Front & back eave fascia boards
  B.quad(
    [-xVerge, yEaveBot, zEave],
    [xVerge, yEaveBot, zEave],
    [xVerge, yEaveTop, zEave],
    [-xVerge, yEaveTop, zEave],
    fasciaRgb
  );
  B.quad(
    [xVerge, yEaveBot, -zEave],
    [-xVerge, yEaveBot, -zEave],
    [-xVerge, yEaveTop, -zEave],
    [xVerge, yEaveTop, -zEave],
    fasciaRgb
  );

  // Front & back eave soffit underside (downward normal)
  B.quad(
    [-xWall, yWallBot, 5.0],
    [xWall, yWallBot, 5.0],
    [xWall, yEaveBot, zEave],
    [-xWall, yEaveBot, zEave],
    soffitRgb
  );
  B.quad(
    [xWall, yWallBot, -5.0],
    [-xWall, yWallBot, -5.0],
    [-xWall, yEaveBot, -zEave],
    [xWall, yEaveBot, -zEave],
    soffitRgb
  );

  // Gable verge bargeboards & soffit undersides at -X and +X (downward normal)
  const profile = [
    [zEave, yEaveBot, yEaveTop],
    [zKnee, yKneeBot, yKneeTop],
    [0, yPeakBot, yPeakTop],
    [-zKnee, yKneeBot, yKneeTop],
    [-zEave, yEaveBot, yEaveTop],
  ];
  for (let i = 0; i < profile.length - 1; i++) {
    const [z0, yb0, yt0] = profile[i];
    const [z1, yb1, yt1] = profile[i + 1];
    // +X outer bargeboard
    B.quad(
      [xVerge, yb0, z0],
      [xVerge, yb1, z1],
      [xVerge, yt1, z1],
      [xVerge, yt0, z0],
      bargeRgb
    );
    // -X outer bargeboard
    B.quad(
      [-xVerge, yb1, z1],
      [-xVerge, yb0, z0],
      [-xVerge, yt0, z0],
      [-xVerge, yt1, z1],
      bargeRgb
    );
    // +X verge soffit underside (downward normal)
    B.quad(
      [xWall, yb0, z0],
      [xWall, yb1, z1],
      [xVerge, yb1, z1],
      [xVerge, yb0, z0],
      soffitRgb
    );
    // -X verge soffit underside (downward normal)
    B.quad(
      [-xVerge, yb0, z0],
      [-xVerge, yb1, z1],
      [-xWall, yb1, z1],
      [-xWall, yb0, z0],
      soffitRgb
    );
  }

  // Raised V-crested ridge cap along peak
  const rx = xVerge + 0.06;
  const rz = 0.34;
  const ry0 = yPeakTop - 0.08;
  const ry1 = yPeakTop + 0.28;
  B.quad([-rx, ry0, rz], [rx, ry0, rz], [rx, ry1, 0], [-rx, ry1, 0], ridgeRgb);
  B.quad(
    [rx, ry0, -rz],
    [-rx, ry0, -rz],
    [-rx, ry1, 0],
    [rx, ry1, 0],
    scaleRgb(ridgeRgb, 0.92)
  );
  B.tri([rx, ry0, rz], [rx, ry0, -rz], [rx, ry1, 0], bargeRgb);
  B.tri([-rx, ry0, -rz], [-rx, ry0, rz], [-rx, ry1, 0], bargeRgb);

  return B.build();
}

// Local origin sits at (0, 2.25, 5.1) on the house: ground is y = -2.25 and
// the front wall plane is z = -0.10. Streamlined to 38 triangles.
function buildHouseDoorGeo() {
  const B = createColoredBuilder();
  const stoneTop = hexRgb(0x9b9589);
  const stoneSide = hexRgb(0x7c766c);
  const casingRgb = hexRgb(0xe6dfd2);
  const woodMain = hexRgb(0x6e4427);
  const woodPanel = hexRgb(0x53321c);
  const hoodSlate = hexRgb(0x464e56);
  const timberRgb = hexRgb(0x523724);

  // Grounded stone stoop / doorstep (8 tris, buried to y = -3.1)
  B.box(-1.12, 1.12, -3.1, -1.86, -0.18, 0.72, stoneSide, {
    back: false,
    bottom: false,
    topRgb: stoneTop,
  });

  const cx = 0.96;
  const cy0 = -1.86;
  const cy1 = 2.18;
  const zBack = -0.16;
  const zFront = 0.18;
  const zLeaf = 0.06;
  const dx = 0.72;
  const dy1 = 1.94;

  // Outer returns + inward-beveled jambs & lintel (12 tris)
  B.quad(
    [cx, cy0, zFront],
    [cx, cy0, zBack],
    [cx, cy1, zBack],
    [cx, cy1, zFront],
    scaleRgb(casingRgb, 0.9)
  );
  B.quad(
    [-cx, cy0, zBack],
    [-cx, cy0, zFront],
    [-cx, cy1, zFront],
    [-cx, cy1, zBack],
    scaleRgb(casingRgb, 0.9)
  );
  B.quad(
    [-cx, cy1, zFront],
    [cx, cy1, zFront],
    [cx, cy1, zBack],
    [-cx, cy1, zBack],
    scaleRgb(casingRgb, 1.02)
  );
  B.quad(
    [-cx, cy1, zFront],
    [cx, cy1, zFront],
    [dx, dy1, zLeaf],
    [-dx, dy1, zLeaf],
    scaleRgb(casingRgb, 0.86)
  );
  B.quad(
    [-cx, cy0, zFront],
    [-dx, cy0, zLeaf],
    [-dx, dy1, zLeaf],
    [-cx, cy1, zFront],
    casingRgb
  );
  B.quad(
    [dx, cy0, zLeaf],
    [cx, cy0, zFront],
    [cx, cy1, zFront],
    [dx, dy1, zLeaf],
    casingRgb
  );

  // Recessed two-tone oak door leaf (4 tris, partitioned at lock rail)
  B.quad(
    [-dx, cy0, zLeaf],
    [dx, cy0, zLeaf],
    [dx, 0.08, zLeaf],
    [-dx, 0.08, zLeaf],
    woodPanel
  );
  B.quad(
    [-dx, 0.08, zLeaf],
    [dx, 0.08, zLeaf],
    [dx, dy1, zLeaf],
    [-dx, dy1, zLeaf],
    woodMain
  );

  // Pitched bracketed entrance canopy + 2 side bracket cheeks (14 tris)
  const hx = 1.14;
  const hzOut = 0.86;
  const hyEave = 2.26;
  const hyWall = 2.86;
  B.quad(
    [-hx, hyEave + 0.12, hzOut],
    [hx, hyEave + 0.12, hzOut],
    [hx, hyWall, zBack],
    [-hx, hyWall, zBack],
    hoodSlate
  );
  B.quad(
    [-hx, hyEave, hzOut],
    [hx, hyEave, hzOut],
    [hx, hyEave + 0.12, hzOut],
    [-hx, hyEave + 0.12, hzOut],
    timberRgb
  );
  B.quad(
    [-hx, hyWall - 0.16, zBack],
    [hx, hyWall - 0.16, zBack],
    [hx, hyEave, hzOut],
    [-hx, hyEave, hzOut],
    scaleRgb(timberRgb, 0.75)
  );
  B.quad(
    [hx, hyEave, hzOut],
    [hx, hyWall - 0.16, zBack],
    [hx, hyWall, zBack],
    [hx, hyEave + 0.12, hzOut],
    timberRgb
  );
  B.quad(
    [-hx, hyWall - 0.16, zBack],
    [-hx, hyEave, hzOut],
    [-hx, hyEave + 0.12, hzOut],
    [-hx, hyWall, zBack],
    timberRgb
  );
  B.tri(
    [0.92, 1.55, zBack],
    [0.92, hyEave + 0.02, 0.62],
    [0.92, hyWall - 0.14, zBack],
    timberRgb
  );
  B.tri(
    [-0.92, hyEave + 0.02, 0.62],
    [-0.92, 1.55, zBack],
    [-0.92, hyWall - 0.14, zBack],
    timberRgb
  );
  B.tri(
    [0.92, hyEave + 0.02, 0.62],
    [0.92, 1.55, zBack],
    [0.92, hyWall - 0.14, zBack],
    scaleRgb(timberRgb, 0.85)
  );
  B.tri(
    [-0.92, 1.55, zBack],
    [-0.92, hyEave + 0.02, 0.62],
    [-0.92, hyWall - 0.14, zBack],
    scaleRgb(timberRgb, 0.85)
  );

  return B.build();
}

// Streamlined 26-triangle brick chimney with corbelled stone cap & tapered pot.
function buildHouseChimneyGeo(yBase, yTop) {
  const B = createColoredBuilder();
  const brickRgb = hexRgb(0x8e3f34);
  const capStone = hexRgb(0xa49c8f);
  const potRgb = hexRgb(0xba5d40);
  const flueRgb = hexRgb(0x1d1817);

  B.box(-0.78, 0.78, yBase, yTop - 0.96, -0.78, 0.78, brickRgb, {
    top: false,
    bottom: false,
  });
  B.frustum(0, 0, 0.78, 0.78, yTop - 0.96, 0.96, 0.96, yTop - 0.56, capStone, {
    top: true,
    topRgb: scaleRgb(capStone, 1.06),
  });
  B.frustum(0, 0, 0.38, 0.38, yTop - 0.56, 0.3, 0.3, yTop + 0.34, potRgb, {
    top: true,
    topRgb: flueRgb,
  });
  return B.build();
}

// 20-triangle framed cottage window: stone sill (6 tris), outer return + inner
// beveled cream casing (12 tris), and 1 recessed glass quad (2 tris) whose
// aGlassUv drives crisp cross-mullions in houseWindowMat's fragment shader.
function buildHouseWindowGeo() {
  const pos = [];
  const mask = [];
  const trim = [];
  const glassUv = [];

  const frameRgb = hexRgb(0xebe4d7);
  const frameSide = scaleRgb(frameRgb, 0.9);
  const frameUnder = scaleRgb(frameRgb, 0.82);
  const sillTop = hexRgb(0xa39c90);
  const sillSide = hexRgb(0x857f74);

  const pushTri = (
    a,
    b,
    c,
    isTrim,
    rgb,
    uva = [0, 0],
    uvb = [0, 0],
    uvc = [0, 0]
  ) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const m = isTrim ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      mask.push(m);
      trim.push(rgb[0], rgb[1], rgb[2]);
    }
    glassUv.push(uva[0], uva[1], uvb[0], uvb[1], uvc[0], uvc[1]);
  };
  const pushQuad = (bl, br, tr, tl, isTrim, rgb) => {
    pushTri(bl, br, tr, isTrim, rgb);
    pushTri(bl, tr, tl, isTrim, rgb);
  };

  const zBack = -0.15;
  const zOut = 0.24;
  const zGlass = 0.14;
  const wx = 0.82;
  const wy0 = -1.04;
  const wy1 = 1.1;
  const gx = 0.62;
  const gy1 = 0.9;

  // Outer casing returns: left, right, top (6 tris)
  pushQuad(
    [wx, wy0, zOut],
    [wx, wy0, zBack],
    [wx, wy1, zBack],
    [wx, wy1, zOut],
    true,
    frameSide
  );
  pushQuad(
    [-wx, wy0, zBack],
    [-wx, wy0, zOut],
    [-wx, wy1, zOut],
    [-wx, wy1, zBack],
    true,
    frameSide
  );
  pushQuad(
    [-wx, wy1, zOut],
    [wx, wy1, zOut],
    [wx, wy1, zBack],
    [-wx, wy1, zBack],
    true,
    frameRgb
  );

  // Projecting stone windowsill (6 tris: top shelf, front face, 2 triangular cheeks)
  const sx = 0.94;
  const syFront = -1.24;
  const szOut = 0.36;
  pushQuad(
    [-sx, wy0, szOut],
    [sx, wy0, szOut],
    [sx, wy0, zBack],
    [-sx, wy0, zBack],
    true,
    sillTop
  );
  pushQuad(
    [-sx, syFront, szOut],
    [sx, syFront, szOut],
    [sx, wy0, szOut],
    [-sx, wy0, szOut],
    true,
    sillSide
  );
  pushTri(
    [sx, syFront, szOut],
    [sx, wy0, zBack],
    [sx, wy0, szOut],
    true,
    sillSide
  );
  pushTri(
    [-sx, wy0, zBack],
    [-sx, syFront, szOut],
    [-sx, wy0, szOut],
    true,
    sillSide
  );

  // Inward-beveled casing faces: top, left, right resting on stone sill (6 tris)
  pushQuad(
    [-wx, wy1, zOut],
    [wx, wy1, zOut],
    [gx, gy1, zGlass],
    [-gx, gy1, zGlass],
    true,
    frameUnder
  );
  pushQuad(
    [-wx, wy0, zOut],
    [-gx, wy0, zGlass],
    [-gx, gy1, zGlass],
    [-wx, wy1, zOut],
    true,
    frameSide
  );
  pushQuad(
    [gx, wy0, zGlass],
    [wx, wy0, zOut],
    [wx, wy1, zOut],
    [gx, gy1, zGlass],
    true,
    frameSide
  );

  // Single recessed glass quad (2 tris) carrying aGlassUv for shader cross-mullions
  pushTri(
    [-gx, wy0, zGlass],
    [gx, wy0, zGlass],
    [gx, gy1, zGlass],
    false,
    frameRgb,
    [0, 0],
    [1, 0],
    [1, 1]
  );
  pushTri(
    [-gx, wy0, zGlass],
    [gx, gy1, zGlass],
    [-gx, gy1, zGlass],
    false,
    frameRgb,
    [0, 0],
    [1, 1],
    [0, 1]
  );

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aTrimMask', new THREE.Float32BufferAttribute(mask, 1));
  geo.setAttribute('aTrimColor', new THREE.Float32BufferAttribute(trim, 3));
  geo.setAttribute('aGlassUv', new THREE.Float32BufferAttribute(glassUv, 2));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function buildFarHouseBodyGeo(eaves) {
  const B = createColoredBuilder();
  B.box(-5, 5, 0, eaves, -5, 5, [1, 1, 1], {bottom: false});
  return B.build();
}

function buildFarHouseRoofGeo(eaves, roofRise) {
  const B = createColoredBuilder();
  const hw = 5.7;
  const hd = 5.85;
  const y0 = eaves - 0.15;
  const y1 = eaves + roofRise;
  const top = [1, 1, 1];
  const end = [0.88, 0.88, 0.88];
  B.quad([-hw, y0, hd], [hw, y0, hd], [hw, y1, 0], [-hw, y1, 0], top);
  B.quad(
    [hw, y0, -hd],
    [-hw, y0, -hd],
    [-hw, y1, 0],
    [hw, y1, 0],
    scaleRgb(top, 0.94)
  );
  B.tri([hw, y0, hd], [hw, y0, -hd], [hw, y1, 0], end);
  B.tri([-hw, y0, -hd], [-hw, y0, hd], [-hw, y1, 0], end);
  return B.build();
}

function buildFarHouseWindowGeo() {
  const geo = new THREE.PlaneGeometry(1.7, 2.2);
  geo.translate(0, 0, 0.28);
  const count = geo.attributes.position.count;
  geo.setAttribute(
    'aTrimMask',
    new THREE.Float32BufferAttribute(new Float32Array(count), 1)
  );
  geo.setAttribute(
    'aTrimColor',
    new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3)
  );
  // Keep far window UVs away from 0.5 mullion cross so far windows glow solid
  geo.setAttribute(
    'aGlassUv',
    new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2)
  );
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function buildHouseGeos() {
  return {
    houseBody: buildHouseBodyGeo(8, 6.8, false),
    houseAdobeBody: buildAdobeHouseBodyGeo(8, false),
    houseRoof: buildHouseRoofGeo(8, 6.8, false),
    houseDoor: buildHouseDoorGeo(),
    houseChimney: buildHouseChimneyGeo(8.8, 15.6),
    houseWindow: buildHouseWindowGeo(),
    twoStoryBody: buildHouseBodyGeo(14, 7.8, true),
    twoStoryAdobeBody: buildAdobeHouseBodyGeo(14, true),
    twoStoryRoof: buildHouseRoofGeo(14, 7.8, true),
    twoStoryChimney: buildHouseChimneyGeo(15.0, 22.6),
    farHouseBody: buildFarHouseBodyGeo(8),
    farHouseRoof: buildFarHouseRoofGeo(8, 6.8),
    farTwoStoryBody: buildFarHouseBodyGeo(14),
    farTwoStoryRoof: buildFarHouseRoofGeo(14, 7.8),
    farHouseWindow: buildFarHouseWindowGeo(),
  };
}

// --- MEDIEVAL CASTLE RUINS ---

// Faceted 12-triangle polyhedral limestone boulder for breached walls & rubble.
function addCastleBoulder(
  B,
  rand,
  {cx, cy, cz, rx, ry, rz, yaw = 0, roll = 0, rgb, topRgb = null}
) {
  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const xf = (lx, ly, lz) => {
    const x1 = lx * cr - ly * sr;
    const y1 = lx * sr + ly * cr;
    return [cx + x1 * cyaw + lz * syaw, cy + y1, cz - x1 * syaw + lz * cyaw];
  };
  const ring = [];
  const base = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const rad = 0.88 + rand() * 0.22;
    const wx = Math.cos(a) * rx * rad;
    const wz = Math.sin(a) * rz * rad;
    ring.push(xf(wx, ry * (0.52 + (rand() - 0.5) * 0.14), wz));
    base.push(xf(wx * 1.08, -ry * (0.85 + rand() * 0.16), wz * 1.08));
  }
  const apex = xf(
    (rand() - 0.5) * rx * 0.2,
    ry * 0.92,
    (rand() - 0.5) * rz * 0.2
  );
  const shade = scaleRgb(rgb, 0.84);
  const crown = topRgb || scaleRgb(rgb, 1.08);
  for (let k = 0; k < 6; k++) {
    const next = (k + 1) % 6;
    B.tri(ring[next], ring[k], apex, k % 2 === 0 ? crown : rgb);
    B.quad(
      base[next],
      base[k],
      ring[k],
      ring[next],
      k >= 2 && k <= 4 ? shade : rgb
    );
  }
}

// N-sided cylindrical frustum band (outward normals) with optional flat top cap
function addCylinderBand(
  B,
  cx,
  cz,
  r0,
  y0,
  r1,
  y1,
  N,
  paletteFn,
  capTopRgb = null
) {
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * Math.PI * 2;
    const a1 = ((k + 1) / N) * Math.PI * 2;
    const b0 = [cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0];
    const b1 = [cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0];
    const t0 = [cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1];
    const t1 = [cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1];
    B.quad(b1, b0, t0, t1, paletteFn(k));
    if (capTopRgb) {
      B.tri([cx, y1, cz], t1, t0, capTopRgb);
    }
  }
}

// Recessed arrow loop / lancet slit positioned at angle `ang` on a cylinder
function addTowerEmbrasure(
  B,
  cx,
  cz,
  rSurface,
  y0,
  y1,
  halfW,
  ang,
  trimRgb,
  darkRgb
) {
  const ux = Math.cos(ang);
  const uz = Math.sin(ang);
  const tx = -uz;
  const tz = ux;
  const rOut = rSurface + 0.34;
  const rIn = rSurface - 0.15;
  const wOut = halfW + 0.24;
  const pt = (r, w, y) => [cx + ux * r + tx * w, y, cz + uz * r + tz * w];

  const oBL = pt(rOut, -wOut, y0 - 0.2);
  const oBR = pt(rOut, wOut, y0 - 0.2);
  const oTR = pt(rOut, wOut, y1 + 0.22);
  const oTL = pt(rOut, -wOut, y1 + 0.22);
  const wBL = pt(rIn, -wOut, y0 - 0.2);
  const wBR = pt(rIn, wOut, y0 - 0.2);
  const wTR = pt(rIn, wOut, y1 + 0.22);
  const wTL = pt(rIn, -wOut, y1 + 0.22);
  const iBL = pt(rIn + 0.22, -halfW, y0);
  const iBR = pt(rIn + 0.22, halfW, y0);
  const iTR = pt(rIn + 0.22, halfW, y1);
  const iTL = pt(rIn + 0.22, -halfW, y1);

  // Outer surround returns back into tower wall
  B.quad(wBL, oBL, oTL, wTL, scaleRgb(trimRgb, 0.88));
  B.quad(oBR, wBR, wTR, oTR, scaleRgb(trimRgb, 0.88));
  B.quad(oTL, oTR, wTR, wTL, scaleRgb(trimRgb, 1.05));
  B.quad(wBL, wBR, oBR, oBL, scaleRgb(trimRgb, 0.72));
  // Splayed embrasure cheeks & dark slit
  B.quad(oBL, oBR, iBR, iBL, trimRgb);
  B.quad(iTL, iTR, oTR, oTL, scaleRgb(trimRgb, 0.78));
  B.quad(oBL, iBL, iTL, oTL, scaleRgb(trimRgb, 0.9));
  B.quad(iBR, oBR, oTR, iTR, scaleRgb(trimRgb, 0.9));
  B.quad(iBL, iBR, iTR, iTL, darkRgb);
}

export function buildCastleRuinsGeo() {
  const B = createColoredBuilder();
  const rand = localRng(91827);

  // Multi-tone weathered medieval limestone, sandstone quoins, slate, oak & moss
  const STONE_TONES = [
    hexRgb(0x8a8d88), // Weathered warm limestone
    hexRgb(0x7c8284), // Cool greywacke
    hexRgb(0x96958c), // Pale ashlar buff
    hexRgb(0x6e7476), // Dark damp stone
    hexRgb(0x888479), // Lichen sandstone
    hexRgb(0x778076), // Faint mossy grey
  ];
  const pickStone = () => {
    const base = STONE_TONES[Math.floor(rand() * STONE_TONES.length)];
    return scaleRgb(base, 0.94 + rand() * 0.12);
  };
  const ashlar = hexRgb(0xa6a194);
  const ashlarPale = hexRgb(0xb5afa0);
  const plinthStone = hexRgb(0x5d6362);
  const mossyBase = hexRgb(0x526148);
  const mossClump = hexRgb(0x496138);
  const mossBright = hexRgb(0x5a7444);
  const courtyardTurf = hexRgb(0x556944);
  const flagstone = hexRgb(0x7a7c76);
  const darkRecess = hexRgb(0x1b1e22);
  const darkFloor = hexRgb(0x3a3d3f);
  const slateRoof = hexRgb(0x46525d);
  const slateRidge = hexRgb(0x5c6873);
  const oakTimber = hexRgb(0x543a27);
  const ironPortcullis = hexRgb(0x282c31);

  // 0. Grounded bailey courtyard turf tucked inside the walls & towers
  B.frustum(0.4, 4.4, 14.0, 8.6, -2.8, 13.6, 8.2, 0.25, plinthStone, {
    top: true,
    topRgb: courtyardTurf,
  });
  // Flagstone roadway through the gate into the courtyard
  for (let i = 0; i < 6; i++) {
    const fz = 14.5 - i * 2.8 + (rand() - 0.5) * 0.3;
    const fx = -1.0 + (rand() - 0.5) * 0.6;
    const fw = 2.0 + (rand() - 0.5) * 0.35;
    B.box(
      fx - fw,
      fx + fw,
      0.25,
      0.42,
      fz - 1.15,
      fz + 1.15,
      scaleRgb(flagstone, 0.92 + rand() * 0.14),
      {
        bottom: false,
      }
    );
  }

  // 1. GREAT CIRCULAR WATCHTOWER / DONJON at (-11.5, 0, -8.5), height ~38.8
  const tx = -11.5;
  const tz = -8.5;
  const TN = 10;
  addCylinderBand(B, tx, tz, 7.5, -3.4, 6.45, 2.8, TN, (k) =>
    k % 3 === 0 ? mossyBase : plinthStone
  );
  addCylinderBand(B, tx, tz, 6.45, 2.8, 6.12, 11.4, TN, () => pickStone());
  // Lower string-course ring
  addCylinderBand(B, tx, tz, 6.12, 11.4, 6.36, 11.7, TN, () => ashlar);
  addCylinderBand(B, tx, tz, 6.36, 11.7, 6.02, 12.25, TN, () => ashlarPale);
  addCylinderBand(B, tx, tz, 6.02, 12.25, 5.75, 21.6, TN, () => pickStone());
  // Upper string-course ring
  addCylinderBand(B, tx, tz, 5.75, 21.6, 6.02, 21.9, TN, () => ashlar);
  addCylinderBand(B, tx, tz, 6.02, 21.9, 5.66, 22.4, TN, () => ashlarPale);
  addCylinderBand(B, tx, tz, 5.66, 22.4, 5.48, 31.2, TN, () => pickStone());

  // Corbelled machicolation crown & overhanging parapet walk
  addCylinderBand(B, tx, tz, 5.48, 31.2, 6.32, 33.1, TN, (k) =>
    k % 2 === 0 ? ashlar : scaleRgb(plinthStone, 1.12)
  );
  // Outer parapet drum + inner parapet wall + recessed dark stone walk floor
  const rParOut = 6.34;
  const rParIn = 5.28;
  addCylinderBand(B, tx, tz, rParOut, 33.1, rParOut, 35.4, TN, () =>
    pickStone()
  );
  // Inner parapet ring & top coping + dark walk floor at y = 34.4
  for (let k = 0; k < TN; k++) {
    const a0 = (k / TN) * Math.PI * 2;
    const a1 = ((k + 1) / TN) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    // Floor cap at y = 34.3
    B.tri(
      [tx, 34.3, tz],
      [tx + c1 * rParIn, 34.3, tz + s1 * rParIn],
      [tx + c0 * rParIn, 34.3, tz + s0 * rParIn],
      darkFloor
    );
    // Inner parapet face (facing inward toward center)
    B.quad(
      [tx + c0 * rParIn, 34.3, tz + s0 * rParIn],
      [tx + c1 * rParIn, 34.3, tz + s1 * rParIn],
      [tx + c1 * rParIn, 35.4, tz + s1 * rParIn],
      [tx + c0 * rParIn, 35.4, tz + s0 * rParIn],
      scaleRgb(STONE_TONES[1], 0.85)
    );
    // Parapet top rim at y = 35.4
    B.quad(
      [tx + c1 * rParOut, 35.4, tz + s1 * rParOut],
      [tx + c0 * rParOut, 35.4, tz + s0 * rParOut],
      [tx + c0 * rParIn, 35.4, tz + s0 * rParIn],
      [tx + c1 * rParIn, 35.4, tz + s1 * rParIn],
      ashlar
    );

    // Merlons on 8 of the 10 sectors (sectors 0 and 9 breached on east side)
    if (k === 0 || k === 9) continue;
    const mh = k === 1 || k === 8 ? 1.45 : 2.85 + (k % 2) * 0.25;
    const ma0 = a0 + 0.09;
    const ma1 = a1 - 0.09;
    const mc0 = Math.cos(ma0);
    const ms0 = Math.sin(ma0);
    const mc1 = Math.cos(ma1);
    const ms1 = Math.sin(ma1);
    const yM0 = 35.4;
    const yM1 = 35.4 + mh;
    const mCol = pickStone();
    const o0 = [tx + mc0 * rParOut, yM0, tz + ms0 * rParOut];
    const o1 = [tx + mc1 * rParOut, yM0, tz + ms1 * rParOut];
    const o1T = [tx + mc1 * rParOut, yM1, tz + ms1 * rParOut];
    const o0T = [tx + mc0 * rParOut, yM1, tz + ms0 * rParOut];
    const i0 = [tx + mc0 * rParIn, yM0, tz + ms0 * rParIn];
    const i1 = [tx + mc1 * rParIn, yM0, tz + ms1 * rParIn];
    const i1T = [tx + mc1 * rParIn, yM1, tz + ms1 * rParIn];
    const i0T = [tx + mc0 * rParIn, yM1, tz + ms0 * rParIn];
    B.quad(o1, o0, o0T, o1T, mCol);
    B.quad(i0, i1, i1T, i0T, scaleRgb(mCol, 0.86));
    B.quad(o0, i0, i0T, o0T, scaleRgb(mCol, 0.92));
    B.quad(i1, o1, o1T, i1T, scaleRgb(mCol, 0.92));
    B.quad(o1T, o0T, i0T, i1T, ashlarPale);
  }

  // Tower arrow slits & high watch window
  addTowerEmbrasure(
    B,
    tx,
    tz,
    6.0,
    6.2,
    9.8,
    0.28,
    Math.PI * 0.45,
    ashlar,
    darkRecess
  );
  addTowerEmbrasure(
    B,
    tx,
    tz,
    5.82,
    15.2,
    19.2,
    0.3,
    Math.PI * 0.85,
    ashlar,
    darkRecess
  );
  addTowerEmbrasure(
    B,
    tx,
    tz,
    5.78,
    15.5,
    19.2,
    0.3,
    Math.PI * 1.45,
    ashlar,
    darkRecess
  );
  addTowerEmbrasure(
    B,
    tx,
    tz,
    5.54,
    24.6,
    29.0,
    0.58,
    Math.PI * 0.35,
    ashlarPale,
    darkRecess
  );

  // 2. RUINED GREAT HALL / KEEP (x in [-6.5, 14.5], z in [-15.8, -3.2])
  const kx0 = -6.5;
  const kx1 = 14.5;
  const kz0 = -15.8;
  const kz1 = -3.2;
  const kzMid = (kz0 + kz1) * 0.5; // -9.5
  const kwT = 1.9;

  // Keep plinth & dark interior stone floor
  B.frustum(
    (kx0 + kx1) * 0.5,
    kzMid,
    (kx1 - kx0) * 0.5 + 0.65,
    (kz1 - kz0) * 0.5 + 0.65,
    -3.2,
    (kx1 - kx0) * 0.5 + 0.15,
    (kz1 - kz0) * 0.5 + 0.15,
    2.2,
    plinthStone,
    {
      top: true,
      topRgb: darkFloor,
    }
  );

  // North hall wall (z = kz0..-13.9): full height 20.5 on west roofed half, stepped ruin on east half
  B.box(kx0, 4.2, 2.2, 20.5, kz0, kz0 + kwT, pickStone(), {
    bottom: false,
    topRgb: ashlar,
  });
  B.box(4.2, 9.5, 2.2, 18.2, kz0, kz0 + kwT, pickStone(), {
    bottom: false,
    left: false,
    topRgb: ashlar,
  });
  B.box(9.5, kx1 - kwT, 2.2, 15.6, kz0, kz0 + kwT, pickStone(), {
    bottom: false,
    left: false,
    right: false,
    topRgb: ashlar,
  });
  // North exterior ashlar buttresses + 2 recessed lancet windows
  for (const bx of [-1.2, 5.6, 11.8]) {
    const bh = bx < 5 ? 19.2 : bx < 10 ? 16.5 : 14.2;
    B.frustum(bx, kz0 - 0.45, 0.85, 0.65, -2.5, 0.65, 0.45, bh, ashlar, {
      top: true,
      topRgb: ashlarPale,
    });
  }
  for (const wx of [2.2, 8.6]) {
    B.box(wx - 0.95, wx + 0.95, 7.6, 13.4, kz0 - 0.25, kz0 + 0.15, ashlar, {
      front: false,
      bottom: true,
    });
    B.quad(
      [wx + 0.62, 8.0, kz0 - 0.26],
      [wx - 0.62, 8.0, kz0 - 0.26],
      [wx - 0.62, 12.6, kz0 - 0.26],
      [wx + 0.62, 12.6, kz0 - 0.26],
      darkRecess
    );
    B.tri(
      [wx + 0.62, 12.6, kz0 - 0.26],
      [wx - 0.62, 12.6, kz0 - 0.26],
      [wx, 13.35, kz0 - 0.26],
      darkRecess
    );
  }

  // South courtyard hall wall (z = -5.1..kz1) with arched hall doorway opening
  B.box(kx0, -0.4, 2.2, 20.5, kz1 - kwT, kz1, pickStone(), {
    bottom: false,
    topRgb: ashlar,
  });
  // Over-door lintel & upper wall on roofed west bay
  B.box(-0.4, 3.8, 8.6, 20.5, kz1 - kwT, kz1, pickStone(), {
    bottom: true,
    left: false,
    right: false,
    topRgb: ashlar,
  });
  B.box(3.8, 7.2, 2.2, 16.8, kz1 - kwT, kz1, pickStone(), {
    bottom: false,
    topRgb: ashlar,
  });
  B.box(7.2, 11.0, 2.2, 12.4, kz1 - kwT, kz1, pickStone(), {
    bottom: false,
    left: false,
    topRgb: ashlar,
  });
  B.box(11.0, kx1 - kwT, 2.2, 15.2, kz1 - kwT, kz1, pickStone(), {
    bottom: false,
    left: false,
    right: false,
    topRgb: ashlar,
  });
  // Stone doorway surround & courtyard stoop steps at x = 1.7, z = kz1
  B.box(-0.65, -0.35, 2.2, 8.9, kz1 - 0.05, kz1 + 0.32, ashlar, {
    back: false,
    bottom: false,
  });
  B.box(3.75, 4.05, 2.2, 8.9, kz1 - 0.05, kz1 + 0.32, ashlar, {
    back: false,
    bottom: false,
  });
  B.box(-0.75, 4.15, 8.6, 9.25, kz1 - 0.05, kz1 + 0.38, ashlarPale, {
    back: false,
    bottom: true,
  });
  B.box(-0.2, 3.6, 0.25, 1.25, kz1, kz1 + 1.5, flagstone, {
    back: false,
    bottom: false,
  });
  B.box(0.1, 3.3, 1.25, 2.2, kz1, kz1 + 0.8, ashlar, {
    back: false,
    bottom: false,
  });

  // Standing pierced East Gable Wall (x = 12.6..14.5, rising to y = 28.4)
  // Built around a true open-through Gothic pointed-arch window (z in [-11.5, -7.5], y in [8.4, 19.8])!
  const gx0 = kx1 - kwT;
  const gx1 = kx1;
  const wzA = -11.5;
  const wzB = -7.5;
  const wySill = 8.4;
  const wySpring = 16.4;
  const wyCrown = 19.8;
  const gyEave = 20.5;
  const gyPeak = 28.4;

  // Lower solid wall below sill, plus north & south piers beside window
  B.box(gx0, gx1, 2.2, wySill, kz0, kz1, pickStone(), {
    bottom: false,
    top: false,
  });
  B.box(gx0, gx1, wySill, gyEave, kz0, wzA, pickStone(), {
    bottom: false,
    topRgb: ashlar,
  });
  B.box(gx0, gx1, wySill, gyEave, wzB, kz1, pickStone(), {
    bottom: false,
    topRgb: ashlar,
  });
  // Window sill & pointed arch spandrel masonry up to eaves (y = 20.5)
  B.quad(
    [gx0, wySill, wzB],
    [gx1, wySill, wzB],
    [gx1, wySill, wzA],
    [gx0, wySill, wzA],
    ashlarPale
  );
  // Spandrel triangles & over-arch band (wySpring..gyEave) on +X and -X faces, plus arch soffit
  const archPts = [
    [wzB, wySpring],
    [wzB - 0.65, wySpring + 1.95],
    [kzMid, wyCrown],
    [wzA + 0.65, wySpring + 1.95],
    [wzA, wySpring],
  ];
  const spandrelTop = [wzB, wzB - 0.65, kzMid, wzA + 0.65, wzA];
  for (let i = 0; i < archPts.length - 1; i++) {
    const [za, ya] = archPts[i];
    const [zb, yb] = archPts[i + 1];
    const zta = spandrelTop[i];
    const ztb = spandrelTop[i + 1];
    // +X outer spandrel
    B.quad(
      [gx1, ya, za],
      [gx1, yb, zb],
      [gx1, gyEave, ztb],
      [gx1, gyEave, zta],
      ashlar
    );
    // -X inner spandrel
    B.quad(
      [gx0, yb, zb],
      [gx0, ya, za],
      [gx0, gyEave, zta],
      [gx0, gyEave, ztb],
      scaleRgb(ashlar, 0.88)
    );
    // Vaulted arch soffit reveal through the wall thickness
    B.quad(
      [gx1, yb, zb],
      [gx1, ya, za],
      [gx0, ya, za],
      [gx0, yb, zb],
      ashlarPale
    );
  }
  // Window jamb inner reveals (north & south vertical sides of opening)
  B.quad(
    [gx0, wySill, wzA],
    [gx1, wySill, wzA],
    [gx1, wySpring, wzA],
    [gx0, wySpring, wzA],
    ashlarPale
  );
  B.quad(
    [gx1, wySill, wzB],
    [gx0, wySill, wzB],
    [gx0, wySpring, wzB],
    [gx1, wySpring, wzB],
    ashlarPale
  );

  // Slender stone Y-tracery mullion standing inside the open Gothic window
  const mx0 = gx0 + 0.62;
  const mx1 = gx1 - 0.62;
  B.box(
    mx0,
    mx1,
    wySill,
    wySpring + 0.75,
    kzMid - 0.2,
    kzMid + 0.2,
    ashlarPale,
    {bottom: false, top: false}
  );
  // Forked stone Y-tracery arms to north (wzA) and south (wzB) arch haunches
  const yFork0 = wySpring + 0.55;
  const yFork1 = wySpring + 0.9;
  const yArm0 = wySpring + 1.85;
  const yArm1 = wySpring + 2.2;
  // North arm (toward wzA < kzMid)
  B.quad(
    [mx1, yFork0, kzMid],
    [mx1, yArm0, wzA + 0.6],
    [mx1, yArm1, wzA + 0.68],
    [mx1, yFork1, kzMid],
    ashlarPale
  );
  B.quad(
    [mx0, yFork1, kzMid],
    [mx0, yArm1, wzA + 0.68],
    [mx0, yArm0, wzA + 0.6],
    [mx0, yFork0, kzMid],
    scaleRgb(ashlarPale, 0.9)
  );
  B.quad(
    [mx0, yFork0, kzMid],
    [mx1, yFork0, kzMid],
    [mx1, yArm0, wzA + 0.6],
    [mx0, yArm0, wzA + 0.6],
    scaleRgb(ashlarPale, 0.82)
  );
  // South arm (toward wzB > kzMid)
  B.quad(
    [mx1, yArm0, wzB - 0.6],
    [mx1, yFork0, kzMid],
    [mx1, yFork1, kzMid],
    [mx1, yArm1, wzB - 0.68],
    ashlarPale
  );
  B.quad(
    [mx0, yFork0, kzMid],
    [mx0, yArm0, wzB - 0.6],
    [mx0, yArm1, wzB - 0.68],
    [mx0, yFork1, kzMid],
    scaleRgb(ashlarPale, 0.9)
  );
  B.quad(
    [mx1, yFork0, kzMid],
    [mx0, yFork0, kzMid],
    [mx0, yArm0, wzB - 0.6],
    [mx1, yArm0, wzB - 0.6],
    scaleRgb(ashlarPale, 0.82)
  );

  // Upper triangular masonry gable above gyEave (thick 3D stepped gable with coping!)
  B.tri(
    [gx1, gyEave, kz1],
    [gx1, gyEave, kz0],
    [gx1, gyPeak, kzMid],
    pickStone()
  );
  B.tri(
    [gx0, gyEave, kz0],
    [gx0, gyEave, kz1],
    [gx0, gyPeak, kzMid],
    scaleRgb(STONE_TONES[0], 0.9)
  );
  B.quad(
    [gx0, gyEave, kz1],
    [gx1, gyEave, kz1],
    [gx1, gyPeak, kzMid],
    [gx0, gyPeak, kzMid],
    ashlarPale
  );
  B.quad(
    [gx1, gyEave, kz0],
    [gx0, gyEave, kz0],
    [gx0, gyPeak, kzMid],
    [gx1, gyPeak, kzMid],
    ashlarPale
  );
  // East corner clasping buttresses
  B.frustum(gx1 + 0.15, kz0 + 0.4, 0.85, 0.85, -2.5, 0.55, 0.55, 19.5, ashlar, {
    top: true,
    topRgb: ashlarPale,
  });
  B.frustum(gx1 + 0.15, kz1 - 0.4, 0.85, 0.85, -2.5, 0.55, 0.55, 19.5, ashlar, {
    top: true,
    topRgb: ashlarPale,
  });

  // Surviving West Half of Keep Slate Roof (x in [-6.8, 3.8]) + Exposed Oak Rafters (x in [3.8, 12.6])
  const rx0 = -6.8;
  const rx1 = 3.8;
  const rzS = kz1 + 0.55;
  const rzN = kz0 - 0.55;
  const ryE = 20.1;
  const ryP = 28.55;
  // South & north slate slopes + underside + broken stepped edge + ridge crest
  B.quad(
    [rx0, ryE, rzS],
    [rx1, ryE, rzS],
    [rx1 - 0.9, ryP, kzMid],
    [rx0, ryP, kzMid],
    slateRoof
  );
  B.quad(
    [rx1, ryE, rzN],
    [rx0, ryE, rzN],
    [rx0, ryP, kzMid],
    [rx1 - 0.9, ryP, kzMid],
    scaleRgb(slateRoof, 0.9)
  );
  B.quad(
    [rx1, ryE - 0.35, rzS],
    [rx0, ryE - 0.35, rzS],
    [rx0, ryP - 0.35, kzMid],
    [rx1 - 0.9, ryP - 0.35, kzMid],
    oakTimber
  );
  B.quad(
    [rx0, ryE - 0.35, rzN],
    [rx1, ryE - 0.35, rzN],
    [rx1 - 0.9, ryP - 0.35, kzMid],
    [rx0, ryP - 0.35, kzMid],
    oakTimber
  );
  B.quad(
    [rx0, ryE - 0.35, rzS],
    [rx1, ryE - 0.35, rzS],
    [rx1, ryE, rzS],
    [rx0, ryE, rzS],
    slateRidge
  );
  B.quad(
    [rx1, ryE - 0.35, rzN],
    [rx0, ryE - 0.35, rzN],
    [rx0, ryE, rzN],
    [rx1, ryE, rzN],
    slateRidge
  );
  // Broken slate roof verge faces at x = rx1 .. rx1 - 0.9
  B.quad(
    [rx1, ryE - 0.35, rzS],
    [rx1 - 0.9, ryP - 0.35, kzMid],
    [rx1 - 0.9, ryP, kzMid],
    [rx1, ryE, rzS],
    oakTimber
  );
  B.quad(
    [rx1 - 0.9, ryP - 0.35, kzMid],
    [rx1, ryE - 0.35, rzN],
    [rx1, ryE, rzN],
    [rx1 - 0.9, ryP, kzMid],
    oakTimber
  );
  B.box(
    rx0,
    rx1 - 0.8,
    ryP - 0.1,
    ryP + 0.25,
    kzMid - 0.28,
    kzMid + 0.28,
    slateRidge,
    {bottom: false}
  );

  // Exposed oak ridge purlin, floor gallery joists & 3D rafters across unroofed east bay
  B.box(
    rx1 - 1.0,
    gx0 + 0.2,
    ryP - 0.55,
    ryP - 0.15,
    kzMid - 0.22,
    kzMid + 0.22,
    oakTimber,
    {bottom: true}
  );
  const addRafterBeam = (fx, zStart, yStart, zEnd, yEnd) => {
    const xL = fx - 0.18;
    const xR = fx + 0.18;
    const d = 0.34;
    const sideOak = scaleRgb(oakTimber, 0.86);
    const botOak = scaleRgb(oakTimber, 0.74);
    if (zStart < zEnd) {
      // North rafter (zStart < zEnd)
      B.quad(
        [xR, yStart, zStart],
        [xL, yStart, zStart],
        [xL, yEnd, zEnd],
        [xR, yEnd, zEnd],
        oakTimber
      );
      B.quad(
        [xL, yStart - d, zStart],
        [xR, yStart - d, zStart],
        [xR, yEnd - d, zEnd],
        [xL, yEnd - d, zEnd],
        botOak
      );
      B.quad(
        [xR, yEnd - d, zEnd],
        [xR, yStart - d, zStart],
        [xR, yStart, zStart],
        [xR, yEnd, zEnd],
        sideOak
      );
      B.quad(
        [xL, yStart - d, zStart],
        [xL, yEnd - d, zEnd],
        [xL, yEnd, zEnd],
        [xL, yStart, zStart],
        sideOak
      );
    } else {
      // South rafter (zStart > zEnd)
      B.quad(
        [xL, yStart, zStart],
        [xR, yStart, zStart],
        [xR, yEnd, zEnd],
        [xL, yEnd, zEnd],
        oakTimber
      );
      B.quad(
        [xR, yStart - d, zStart],
        [xL, yStart - d, zStart],
        [xL, yEnd - d, zEnd],
        [xR, yEnd - d, zEnd],
        botOak
      );
      B.quad(
        [xR, yStart - d, zStart],
        [xR, yEnd - d, zEnd],
        [xR, yEnd, zEnd],
        [xR, yStart, zStart],
        sideOak
      );
      B.quad(
        [xL, yEnd - d, zEnd],
        [xL, yStart - d, zStart],
        [xL, yStart, zStart],
        [xL, yEnd, zEnd],
        sideOak
      );
    }
  };
  for (const fx of [5.8, 8.4, 11.0]) {
    if (fx < 10) {
      B.box(
        fx - 0.2,
        fx + 0.2,
        19.6,
        20.1,
        kz0 + kwT - 0.1,
        kz1 - kwT + 0.1,
        oakTimber,
        {bottom: true}
      );
    }
    addRafterBeam(fx, kz0 + kwT - 0.2, 20.0, kzMid, ryP - 0.2);
    if (fx !== 8.4) {
      addRafterBeam(fx, kz1 - kwT + 0.2, 20.0, kzMid, ryP - 0.2);
    }
  }
  // Remnant upper timber gallery inside west half of keep
  B.box(kx0 + 1.5, 4.5, 10.6, 11.1, kz0 + kwT, kz1 - kwT, oakTimber, {
    bottom: true,
  });

  // 3. TWIN-BASTION ARCHED GATEHOUSE facing +Z (x in [-8.4, 6.4], z in [10.2, 15.6])
  const gz0 = 10.2;
  const gz1 = 15.4;
  const gOpenL = -3.4;
  const gOpenR = 1.4;
  const gMidX = (gOpenL + gOpenR) * 0.5; // -1.0
  const gSpringY = 7.6;
  const gCrownY = 10.4;

  // Left (taller intact) & Right (partially ruined) octagonal/battered gate bastions
  addCylinderBand(B, -6.0, 13.2, 3.6, -3.2, 3.05, 2.4, 8, () => plinthStone);
  addCylinderBand(
    B,
    -6.0,
    13.2,
    3.05,
    2.4,
    2.8,
    19.6,
    8,
    () => pickStone(),
    ashlar
  );
  addTowerEmbrasure(
    B,
    -6.0,
    13.2,
    2.9,
    8.5,
    12.2,
    0.24,
    Math.PI * 0.5,
    ashlar,
    darkRecess
  );
  // Merlons on left gate bastion
  for (let k = 0; k < 8; k += 2) {
    const a = (k / 8) * Math.PI * 2;
    const mx = -6.0 + Math.cos(a) * 2.35;
    const mz = 13.2 + Math.sin(a) * 2.35;
    B.box(mx - 0.55, mx + 0.55, 19.6, 21.3, mz - 0.55, mz + 0.55, pickStone(), {
      bottom: false,
      topRgb: ashlarPale,
    });
  }

  addCylinderBand(B, 4.0, 13.2, 3.5, -3.2, 2.95, 2.4, 8, () => plinthStone);
  addCylinderBand(
    B,
    4.0,
    13.2,
    2.95,
    2.4,
    2.75,
    15.8,
    8,
    () => pickStone(),
    ashlar
  );
  addTowerEmbrasure(
    B,
    4.0,
    13.2,
    2.82,
    7.8,
    11.2,
    0.24,
    Math.PI * 0.5,
    ashlar,
    darkRecess
  );
  B.box(2.2, 3.6, 15.8, 17.3, 14.4, 15.6, pickStone(), {
    bottom: false,
    topRgb: ashlarPale,
  });

  // Gate passage side piers (x = -5.6..-3.4 and 1.4..3.6)
  B.box(-5.6, gOpenL, -2.5, gSpringY, gz0, gz1, pickStone(), {
    bottom: false,
    top: false,
  });
  B.box(gOpenR, 3.6, -2.5, gSpringY, gz0, gz1, pickStone(), {
    bottom: false,
    top: false,
  });

  // Pointed-arch gate tunnel + projecting front voussoir arch + over-gate wall (y = gSpringY..17.6)
  const gTopY = 17.6;
  const gArch = [
    [gOpenL, gSpringY],
    [gOpenL + 0.75, gSpringY + 1.75],
    [gMidX, gCrownY],
    [gOpenR - 0.75, gSpringY + 1.75],
    [gOpenR, gSpringY],
  ];
  for (let i = 0; i < gArch.length - 1; i++) {
    const [xa, ya] = gArch[i];
    const [xb, yb] = gArch[i + 1];
    // Front (+Z) spandrel wall up to gTopY
    B.quad(
      [xa, ya, gz1],
      [xb, yb, gz1],
      [xb, gTopY, gz1],
      [xa, gTopY, gz1],
      pickStone()
    );
    // Courtyard (-Z) spandrel wall up to gTopY
    B.quad(
      [xb, yb, gz0],
      [xa, ya, gz0],
      [xa, gTopY, gz0],
      [xb, gTopY, gz0],
      pickStone()
    );
    // Vaulted tunnel soffit through gatehouse
    B.quad([xb, yb, gz1], [xa, ya, gz1], [xa, ya, gz0], [xb, yb, gz0], ashlar);
    // Projecting dressed limestone voussoir arch ring on front (+Z)
    const uxA = xa - gMidX;
    const uyA = ya - (gSpringY - 0.6);
    const lA = Math.hypot(uxA, uyA) || 1;
    const uxB = xb - gMidX;
    const uyB = yb - (gSpringY - 0.6);
    const lB = Math.hypot(uxB, uyB) || 1;
    const oxA = xa + (uxA / lA) * 0.85;
    const oyA = ya + (uyA / lA) * 0.85;
    const oxB = xb + (uxB / lB) * 0.85;
    const oyB = yb + (uyB / lB) * 0.85;
    const vCol = i % 2 === 0 ? ashlarPale : ashlar;
    B.quad(
      [xa, ya, gz1 + 0.32],
      [xb, yb, gz1 + 0.32],
      [oxB, oyB, gz1 + 0.32],
      [oxA, oyA, gz1 + 0.32],
      vCol
    );
    B.quad(
      [xb, yb, gz1],
      [xa, ya, gz1],
      [xa, ya, gz1 + 0.32],
      [xb, yb, gz1 + 0.32],
      scaleRgb(vCol, 0.84)
    );
    B.quad(
      [oxA, oyA, gz1],
      [oxB, oyB, gz1],
      [oxB, oyB, gz1 + 0.32],
      [oxA, oyA, gz1 + 0.32],
      scaleRgb(vCol, 1.04)
    );
  }
  // Over-gate top walk & front battlements + machicolation corbels
  B.quad(
    [-5.2, gTopY, gz1],
    [3.2, gTopY, gz1],
    [3.2, gTopY, gz0],
    [-5.2, gTopY, gz0],
    ashlar
  );
  for (const cxCorb of [-3.4, -1.0, 1.4]) {
    B.frustum(cxCorb, gz1 + 0.25, 0.38, 0.25, 15.6, 0.48, 0.48, gTopY, ashlar);
  }
  for (const bx of [-3.6, -1.0, 1.5]) {
    const mh = bx > 1 ? 1.2 : 2.1;
    B.box(
      bx - 0.75,
      bx + 0.75,
      gTopY,
      gTopY + mh,
      gz1 - 0.9,
      gz1 + 0.45,
      pickStone(),
      {
        bottom: false,
        topRgb: ashlarPale,
      }
    );
  }

  // Iron portcullis grille & spikes hanging under gate arch
  const pz = gz1 - 1.35;
  for (const px of [-2.6, -1.8, -1.0, -0.2, 0.6]) {
    B.box(
      px - 0.11,
      px + 0.11,
      6.8,
      gCrownY - 0.4,
      pz - 0.11,
      pz + 0.11,
      ironPortcullis,
      {top: false}
    );
    // Pointed iron spike tip
    B.frustum(px, pz, 0.02, 0.02, 6.25, 0.11, 0.11, 6.8, ironPortcullis);
  }
  B.box(
    gOpenL + 0.1,
    gOpenR - 0.1,
    7.35,
    7.6,
    pz - 0.14,
    pz + 0.14,
    ironPortcullis,
    {bottom: true}
  );
  B.box(
    gOpenL + 0.35,
    gOpenR - 0.35,
    8.45,
    8.7,
    pz - 0.14,
    pz + 0.14,
    ironPortcullis,
    {bottom: true}
  );

  // 4. WEST CURTAIN WALL, ALLURE WALK & COURTYARD STAIRS (x = -14.8..-11.8, z in [-3.2, 11.2])
  B.frustum(-13.4, 4.0, 1.75, 7.4, -3.2, 1.45, 7.2, 12.6, pickStone(), {
    top: true,
    topRgb: ashlar,
  });
  // Timber-and-stone allure walk & stone stairs inside west wall
  B.box(-12.0, -10.4, 9.6, 10.2, -1.5, 9.5, oakTimber, {bottom: true});
  for (let s = 0; s < 5; s++) {
    B.box(
      -11.9,
      -10.3,
      0.25,
      1.9 + s * 1.65,
      6.8 - s * 1.45,
      8.3 - s * 1.45,
      flagstone,
      {
        bottom: false,
      }
    );
  }
  // West curtain merlons
  for (const mz of [-1.2, 2.4, 6.0, 9.2]) {
    if (mz === 6.0) continue; // Chipped breach gap
    B.box(-14.9, -13.7, 12.6, 14.5, mz - 0.85, mz + 0.85, pickStone(), {
      bottom: false,
      topRgb: ashlarPale,
    });
  }

  // 5. BREACHED HOLLOW EAST DRUM TOWER at (+14.6, 0, +10.2)
  // Built as a true thick-walled circular masonry shell with stepped ruined rim!
  const ex = 14.6;
  const ez = 10.2;
  const EN = 10;
  const rEOut = 5.2;
  const rEIn = 3.55;
  addCylinderBand(B, ex, ez, 5.9, -3.2, rEOut, 2.2, EN, (k) =>
    k % 2 === 0 ? mossyBase : plinthStone
  );
  // Dark interior floor inside hollow drum tower
  for (let k = 0; k < EN; k++) {
    const a0 = (k / EN) * Math.PI * 2;
    const a1 = ((k + 1) / EN) * Math.PI * 2;
    B.tri(
      [ex, 4.2, ez],
      [ex + Math.cos(a1) * rEIn, 4.2, ez + Math.sin(a1) * rEIn],
      [ex + Math.cos(a0) * rEIn, 4.2, tz * 0 + ez + Math.sin(a0) * rEIn],
      darkFloor
    );
  }
  const eastSectorH = [7.4, 9.6, 14.8, 17.8, 18.4, 16.5, 13.8, 11.2, 8.6, 6.8];
  for (let k = 0; k < EN; k++) {
    const next = (k + 1) % EN;
    const prev = (k + EN - 1) % EN;
    const a0 = (k / EN) * Math.PI * 2;
    const a1 = (next / EN) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    const h = eastSectorH[k];
    const sCol = pickStone();

    const ob0 = [ex + c0 * rEOut, 2.2, ez + s0 * rEOut];
    const ob1 = [ex + c1 * rEOut, 2.2, ez + s1 * rEOut];
    const ot0 = [ex + c0 * rEOut, h, ez + s0 * rEOut];
    const ot1 = [ex + c1 * rEOut, h, ez + s1 * rEOut];
    const ib0 = [ex + c0 * rEIn, 4.2, ez + s0 * rEIn];
    const ib1 = [ex + c1 * rEIn, 4.2, ez + s1 * rEIn];
    const it0 = [ex + c0 * rEIn, h, ez + s0 * rEIn];
    const it1 = [ex + c1 * rEIn, h, ez + s1 * rEIn];

    // Outer face, inner concave face, and top broken wall thickness cap
    B.quad(ob1, ob0, ot0, ot1, sCol);
    B.quad(ib0, ib1, it1, it0, scaleRgb(sCol, 0.78));
    B.quad(ot1, ot0, it0, it1, k === 3 || k === 4 ? ashlarPale : ashlar);

    // Close radial step cheeks where neighboring sector is lower
    if (eastSectorH[prev] < h) {
      const hPrev = eastSectorH[prev];
      B.quad(
        [ex + c0 * rEOut, hPrev, ez + s0 * rEOut],
        [ex + c0 * rEIn, hPrev, ez + s0 * rEIn],
        it0,
        ot0,
        scaleRgb(sCol, 0.9)
      );
    }
    if (eastSectorH[next] < h) {
      const hNext = eastSectorH[next];
      B.quad(
        [ex + c1 * rEIn, hNext, ez + s1 * rEIn],
        [ex + c1 * rEOut, hNext, ez + s1 * rEOut],
        ot1,
        it1,
        scaleRgb(sCol, 0.9)
      );
    }
  }
  // Broken timber beam inside breached drum tower
  B.box(ex - 3.3, ex + 2.8, 9.2, 9.65, ez - 0.3, ez + 0.3, oakTimber, {
    bottom: true,
  });

  // South-East wall linking gatehouse to east tower & breached East Curtain Wall
  B.frustum(8.2, 12.2, 3.2, 1.45, -2.8, 2.9, 1.2, 11.4, pickStone(), {
    top: true,
    topRgb: ashlar,
  });
  // East breach stubs dipping to a low rubble saddle between Keep and East Tower
  B.frustum(13.8, -1.2, 1.45, 2.2, -2.8, 1.2, 1.9, 10.6, pickStone(), {
    top: true,
    topRgb: ashlar,
  });
  B.frustum(13.8, 2.6, 1.55, 2.4, -2.8, 1.25, 2.1, 4.4, mossyBase, {
    top: true,
    topRgb: mossClump,
  });
  B.frustum(14.0, 5.8, 1.45, 1.8, -2.8, 1.2, 1.5, 8.8, pickStone(), {
    top: true,
    topRgb: ashlar,
  });

  // 6. Tumbled faceted limestone boulders & mossy ivy cushions around breaches
  const rubbleSpots = [
    // East breach spill (inward & outward)
    [16.2, 0.6, 1.4, 1.6, 1.0, 1.4, true],
    [17.8, 0.3, 3.1, 1.3, 0.85, 1.2, false],
    [15.4, 1.4, 3.8, 1.4, 0.95, 1.3, true],
    [11.6, 0.5, 2.2, 1.4, 0.9, 1.2, false],
    [10.2, 0.4, 4.0, 1.1, 0.75, 1.0, true],
    // Around breached East Drum Tower
    [19.6, 0.4, 9.2, 1.5, 0.95, 1.3, true],
    [18.8, 0.3, 12.4, 1.2, 0.8, 1.1, false],
    [15.8, 0.4, 15.6, 1.3, 0.85, 1.2, false],
    // Inside unroofed east half of Great Hall
    [8.2, 2.3, -9.8, 1.3, 0.85, 1.2, false],
    [10.6, 2.4, -7.6, 1.5, 1.0, 1.3, true],
    [6.4, 2.3, -11.8, 1.1, 0.75, 1.0, false],
    // Front gate & watchtower foot
    [6.4, 0.3, 15.8, 1.3, 0.85, 1.1, true],
    [-16.8, 0.3, -4.2, 1.5, 0.95, 1.3, true],
    [-15.6, 0.2, -13.8, 1.4, 0.9, 1.2, false],
    // Moss cushions clinging to wall feet & breach
    [-8.6, 1.2, 14.8, 1.4, 0.8, 1.1, 'moss'],
    [14.8, 4.5, 2.4, 1.5, 0.75, 1.4, 'moss'],
    [-5.8, 2.4, -2.8, 1.4, 0.8, 1.1, 'moss'],
    [13.4, 2.6, 6.8, 1.3, 0.85, 1.2, 'moss'],
  ];
  for (const [bx, by, bz, rx, ry, rz, kind] of rubbleSpots) {
    const isMoss = kind === 'moss';
    const baseRgb = isMoss ? mossClump : pickStone();
    const topRgb = isMoss
      ? mossBright
      : kind === true
        ? mossClump
        : scaleRgb(baseRgb, 1.1);
    addCastleBoulder(B, rand, {
      cx: bx,
      cy: by,
      cz: bz,
      rx,
      ry,
      rz,
      yaw: rand() * Math.PI,
      roll: (rand() - 0.5) * 0.28,
      rgb: baseRgb,
      topRgb,
    });
  }

  return B.build();
}

// --- AIRFIELD HANGAR ---
// Three regional colorways matching controlTowerGeo ('raf-brick', 'desert-tan',
// 'winter-ash'), split into 3 breakable meshes: walls ('fold'), arched roof
// ('fling'), and telescopic sliding doors + glazing ('fling').
export const HANGAR_COLORWAYS = ['raf-brick', 'desert-tan', 'winter-ash'];
const _hangarGeos = new Map();

function hangarPalette(colorway) {
  if (colorway === 'desert-tan') {
    return {
      plinth: hexRgb(0x7c7163),
      dado: hexRgb(0xa67b56),
      sill: hexRgb(0xc9b89b),
      sidingA: hexRgb(0xd9c6a5),
      sidingB: hexRgb(0xccb895),
      pilaster: hexRgb(0x6e6459),
      roofA: hexRgb(0x6d6962),
      roofB: hexRgb(0x79746c),
      skylight: hexRgb(0x5c7d8e),
      trim: hexRgb(0x47413b),
      doorA: hexRgb(0x7c7367),
      doorB: hexRgb(0x887f72),
      accentA: hexRgb(0xc2522b),
      accentB: hexRgb(0xf2e6d0),
      glass: hexRgb(0x283a48),
      drumA: hexRgb(0x9e3b28),
      drumB: hexRgb(0x3a647a),
    };
  }
  if (colorway === 'winter-ash') {
    return {
      plinth: hexRgb(0x5c646c),
      dado: hexRgb(0x6e7882),
      sill: hexRgb(0xaeb6be),
      sidingA: hexRgb(0xd2d8de),
      sidingB: hexRgb(0xc3cad2),
      pilaster: hexRgb(0x4d5660),
      roofA: hexRgb(0x3b444e),
      roofB: hexRgb(0x46505c),
      skylight: hexRgb(0x5b7c93),
      trim: hexRgb(0x2f3740),
      doorA: hexRgb(0x5d6873),
      doorB: hexRgb(0x697580),
      accentA: hexRgb(0xd95826),
      accentB: hexRgb(0xf2f5f8),
      glass: hexRgb(0x243646),
      drumA: hexRgb(0xc94f24),
      drumB: hexRgb(0x2f5873),
    };
  }
  return {
    plinth: hexRgb(0x6f7270),
    dado: hexRgb(0x8f4c3e),
    sill: hexRgb(0xb8b2a4),
    sidingA: hexRgb(0xc8c4b8),
    sidingB: hexRgb(0xbbb7ab),
    pilaster: hexRgb(0x58626a),
    roofA: hexRgb(0x4a5661),
    roofB: hexRgb(0x55626e),
    skylight: hexRgb(0x5b798e),
    trim: hexRgb(0x394149),
    doorA: hexRgb(0x66727b),
    doorB: hexRgb(0x727f89),
    accentA: hexRgb(0xb8372b),
    accentB: hexRgb(0xede8dc),
    glass: hexRgb(0x293c4c),
    drumA: hexRgb(0xa63429),
    drumB: hexRgb(0x2e5b75),
  };
}

export function hangarGeos(colorway = 'raf-brick') {
  const key = HANGAR_COLORWAYS.includes(colorway) ? colorway : 'raf-brick';
  if (_hangarGeos.has(key)) return _hangarGeos.get(key);

  const P = hangarPalette(key);
  const W = createColoredBuilder();
  const R = createColoredBuilder();
  const D = createColoredBuilder();

  const hx = 17.0;
  const zBack = -13.0;
  const zFront = 12.6;
  const yGround = -0.8;
  const yApron = 0.65;
  const yDado = 3.85;
  const ySill = 4.15;
  const yEave = 10.4;
  const archRise = 7.1;
  const archSegs = 12;

  const recessDark = hexRgb(0x1b1f24);
  const recessFloor = hexRgb(0x383b3e);
  const hazardYellow = hexRgb(0xd9a326);
  const hazardDark = hexRgb(0x272b30);
  const beaconRed = hexRgb(0xd92b2b);

  // 1. Foundation plinth around perimeter + front door track apron curb
  W.box(
    -hx - 0.22,
    -13.2,
    yGround,
    yApron,
    zFront - 0.5,
    zFront + 0.2,
    P.plinth
  );
  W.box(13.2, hx + 0.22, yGround, yApron, zFront - 0.5, zFront + 0.2, P.plinth);
  W.box(-13.2, 13.2, yGround, yApron, zBack - 0.22, zFront + 0.45, P.plinth, {
    topRgb: recessFloor,
  });
  // Dark steel floor guide rails across the front threshold
  W.box(
    -18.2,
    18.2,
    yApron,
    yApron + 0.08,
    zFront + 0.12,
    zFront + 0.78,
    P.trim
  );

  // Side walls (x = -hx and x = +hx), partitioned cleanly around 3 clerestory windows
  const winSpans = [
    [-10.2, -5.0],
    [-2.6, 2.6],
    [5.0, 10.2],
  ];
  const wallRunsZ = [
    [zBack, -10.2],
    [-5.0, -2.6],
    [2.6, 5.0],
    [10.2, zFront],
  ];
  const wy0 = 6.75;
  const wy1 = 9.15;

  for (const side of [-1, 1]) {
    const xIn = side > 0 ? hx - 0.45 : -hx;
    const xOut = side > 0 ? hx : -hx + 0.45;
    const pOut = side > 0 ? hx + 0.22 : -hx - 0.22;
    const dOut = side > 0 ? hx + 0.1 : -hx - 0.1;
    const sOut = side > 0 ? hx + 0.18 : -hx - 0.18;

    // Plinth, brick/stone dado, and belt sill along full side wall
    W.box(
      Math.min(xIn, pOut),
      Math.max(xOut, pOut),
      yGround,
      yApron,
      zBack - 0.22,
      zFront + 0.15,
      P.plinth
    );
    W.box(
      Math.min(xIn, dOut),
      Math.max(xOut, dOut),
      yApron,
      yDado,
      zBack,
      zFront,
      P.dado,
      {bottom: false}
    );
    W.box(
      Math.min(xIn, sOut),
      Math.max(xOut, sOut),
      yDado,
      ySill,
      zBack - 0.08,
      zFront + 0.08,
      P.sill,
      {bottom: false}
    );

    // Mid-wall below clerestory windows & header band above clerestory windows
    W.box(xIn, xOut, ySill, wy0, zBack, zFront, P.sidingA, {bottom: false});
    W.box(xIn, xOut, wy1, yEave, zBack, zFront, P.sidingB, {bottom: false});

    // Piers between clerestory windows
    for (let i = 0; i < wallRunsZ.length; i++) {
      const [za, zb] = wallRunsZ[i];
      W.box(xIn, xOut, wy0, wy1, za, zb, i % 2 === 0 ? P.sidingA : P.sidingB, {
        bottom: false,
        top: false,
      });
    }

    // 5 structural steel buttress pilasters along each side wall
    for (const pz of [-12.55, -6.3, 0, 6.3, 12.2]) {
      const bx0 = side > 0 ? hx : -hx - 0.46;
      const bx1 = side > 0 ? hx + 0.46 : -hx;
      W.box(bx0, bx1, yApron, yEave, pz - 0.38, pz + 0.38, P.pilaster, {
        bottom: false,
        left: side < 0,
        right: side > 0,
      });
    }

    // Clerestory window frames, sills & 3-pane dark factory glazing in `doors` mesh
    for (const [za, zb] of winSpans) {
      const sx0 = side > 0 ? hx - 0.05 : -hx - 0.18;
      const sx1 = side > 0 ? hx + 0.18 : -hx + 0.05;
      D.box(sx0, sx1, wy0 - 0.18, wy0, za - 0.12, zb + 0.12, P.sill);
      D.box(sx0, sx1, wy1, wy1 + 0.14, za - 0.1, zb + 0.1, P.trim);
      // Recessed glass plane + 2 vertical mullions
      const gx = side > 0 ? hx - 0.12 : -hx + 0.12;
      if (side > 0) {
        D.quad(
          [gx, wy0, zb],
          [gx, wy0, za],
          [gx, wy1, za],
          [gx, wy1, zb],
          P.glass
        );
      } else {
        D.quad(
          [gx, wy0, za],
          [gx, wy0, zb],
          [gx, wy1, zb],
          [gx, wy1, za],
          P.glass
        );
      }
      const mSpan = (zb - za) / 3;
      for (let m = 1; m <= 2; m++) {
        const mz = za + m * mSpan;
        const mx0 = side > 0 ? hx - 0.14 : -hx - 0.04;
        const mx1 = side > 0 ? hx + 0.04 : -hx + 0.14;
        D.box(mx0, mx1, wy0, wy1, mz - 0.09, mz + 0.09, P.trim, {
          bottom: false,
          top: false,
        });
      }
    }
  }

  // 2. Rear (-Z) service wall with framed double cargo doors
  W.box(-hx, hx, yApron, yDado, zBack - 0.1, zBack + 0.4, P.dado, {
    bottom: false,
  });
  W.box(-hx - 0.1, hx + 0.1, yDado, ySill, zBack - 0.18, zBack + 0.4, P.sill, {
    bottom: false,
  });
  W.box(-hx, -3.2, ySill, yEave, zBack, zBack + 0.45, P.sidingA, {
    bottom: false,
  });
  W.box(3.2, hx, ySill, yEave, zBack, zBack + 0.45, P.sidingA, {bottom: false});
  W.box(-3.2, 3.2, 6.6, yEave, zBack, zBack + 0.45, P.sidingB);
  // Rear service door surround, canopy & twin leaves
  D.box(-3.55, 3.55, 6.55, 6.95, zBack - 0.85, zBack + 0.05, P.trim);
  D.box(-3.45, -3.15, yApron, 6.55, zBack - 0.22, zBack + 0.05, P.trim, {
    bottom: false,
  });
  D.box(3.15, 3.45, yApron, 6.55, zBack - 0.22, zBack + 0.05, P.trim, {
    bottom: false,
  });
  D.box(-3.15, -0.06, yApron, 6.55, zBack - 0.08, zBack + 0.15, P.doorA, {
    bottom: false,
  });
  D.box(0.06, 3.15, yApron, 6.55, zBack - 0.08, zBack + 0.15, P.doorB, {
    bottom: false,
  });

  // 3. Front (+Z) hangar portal piers, shadowed interior bay & striped door-track valance
  for (const s of [-1, 1]) {
    const px0 = s < 0 ? -hx : 13.2;
    const px1 = s < 0 ? -13.2 : hx;
    W.box(px0, px1, yApron, yDado, zFront - 0.5, zFront + 0.1, P.dado, {
      bottom: false,
    });
    W.box(px0, px1, yDado, ySill, zFront - 0.5, zFront + 0.18, P.sill, {
      bottom: false,
    });
    W.box(px0, px1, ySill, yEave, zFront - 0.5, zFront, P.sidingA, {
      bottom: false,
    });
  }

  // Deep shadowed interior hangar bay visible between the parted sliding doors
  const bayZ0 = 9.0;
  // Back interior bulkhead (facing +Z)
  W.quad(
    [-13.2, yApron, bayZ0],
    [13.2, yApron, bayZ0],
    [13.2, 9.5, bayZ0],
    [-13.2, 9.5, bayZ0],
    recessDark
  );
  // Left & right interior cheek walls
  W.quad(
    [-13.2, yApron, zFront],
    [-13.2, yApron, bayZ0],
    [-13.2, 9.5, bayZ0],
    [-13.2, 9.5, zFront],
    scaleRgb(recessDark, 1.25)
  );
  W.quad(
    [13.2, yApron, bayZ0],
    [13.2, yApron, zFront],
    [13.2, 9.5, zFront],
    [13.2, 9.5, bayZ0],
    scaleRgb(recessDark, 1.25)
  );
  // Interior bay ceiling soffit + overhead yellow safety hoist girder
  W.quad(
    [-13.2, 9.48, bayZ0],
    [13.2, 9.48, bayZ0],
    [13.2, 9.48, zFront],
    [-13.2, 9.48, zFront],
    recessDark
  );
  W.box(-8.0, 8.0, 8.75, 9.15, 10.1, 10.55, hazardYellow, {top: false});

  // Outboard sliding-door pocket outrigger posts + overhead track girder + warning stripes
  for (const s of [-1, 1]) {
    const ox0 = s < 0 ? -18.25 : 17.65;
    const ox1 = s < 0 ? -17.65 : 18.25;
    W.box(ox0, ox1, yGround, 9.5, zFront + 0.15, zFront + 0.72, P.pilaster);
    // Safety bollard protecting each door corner
    const bx = s * 14.85;
    W.box(
      bx - 0.24,
      bx + 0.24,
      yGround,
      yApron + 1.05,
      zFront + 0.95,
      zFront + 1.43,
      hazardYellow
    );
    W.box(
      bx - 0.25,
      bx + 0.25,
      yApron + 1.05,
      yApron + 1.32,
      zFront + 0.94,
      zFront + 1.44,
      hazardDark
    );
  }
  // Overhead door track box-girder casing (without front face, which gets warning stripes)
  W.box(-18.35, 18.35, 9.45, 10.52, zFront, zFront + 0.86, P.trim, {
    front: false,
    bottom: true,
  });
  const stripeCount = 12;
  const sxMin = -18.35;
  const sxStep = 36.7 / stripeCount;
  const zValance = zFront + 0.86;
  for (let i = 0; i < stripeCount; i++) {
    const xa = sxMin + i * sxStep;
    const xb = xa + sxStep;
    W.quad(
      [xa, 9.45, zValance],
      [xb, 9.45, zValance],
      [xb, 10.52, zValance],
      [xa, 10.52, zValance],
      i % 2 === 0 ? P.accentA : P.accentB
    );
  }

  // 4. Curved barrel-arch tympanum end-walls on front (+Z) and rear (-Z)
  for (let k = 0; k < archSegs; k++) {
    const t0 = (k / archSegs) * Math.PI;
    const t1 = ((k + 1) / archSegs) * Math.PI;
    const xR = hx * Math.cos(t0);
    const xL = hx * Math.cos(t1);
    const yR = yEave + archRise * Math.sin(t0);
    const yL = yEave + archRise * Math.sin(t1);
    const col = k % 2 === 0 ? P.sidingA : P.sidingB;
    // Front tympanum (+Z normal: bl=left, br=right, tr=topRight, tl=topLeft)
    W.quad(
      [xL, yEave, zFront],
      [xR, yEave, zFront],
      [xR, yR, zFront],
      [xL, yL, zFront],
      col
    );
    // Rear tympanum (-Z normal)
    W.quad(
      [xR, yEave, zBack],
      [xL, yEave, zBack],
      [xL, yL, zBack],
      [xR, yR, zBack],
      scaleRgb(col, 0.9)
    );
  }
  // Upper gable louver vent on front & back tympanums
  D.box(-1.5, 1.5, 13.0, 15.2, zFront - 0.05, zFront + 0.22, P.trim, {
    back: false,
  });
  D.quad(
    [-1.2, 13.25, zFront + 0.23],
    [1.2, 13.25, zFront + 0.23],
    [1.2, 14.95, zFront + 0.23],
    [-1.2, 14.95, zFront + 0.23],
    recessDark
  );

  // 5. Left side mechanics' office / radio annex (x in [-21.2, -17.0], z in [-7.2, 5.2])
  const ax0 = -21.2;
  const ax1 = -hx;
  const az0 = -7.2;
  const az1 = 5.2;
  W.box(ax0 - 0.18, ax1, yGround, yApron, az0 - 0.18, az1 + 0.18, P.plinth);
  W.box(ax0 - 0.08, ax1, yApron, 3.1, az0, az1, P.dado, {
    right: false,
    bottom: false,
  });
  // Sloped monopitch annex walls (y = 6.1 at outer ax0 rising to y = 7.35 at ax1)
  W.quad(
    [ax0, 3.1, az1],
    [ax1, 3.1, az1],
    [ax1, 7.35, az1],
    [ax0, 6.1, az1],
    P.sidingA
  );
  W.quad(
    [ax1, 3.1, az0],
    [ax0, 3.1, az0],
    [ax0, 6.1, az0],
    [ax1, 7.35, az0],
    scaleRgb(P.sidingA, 0.88)
  );
  W.quad(
    [ax0, 3.1, az0],
    [ax0, 3.1, az1],
    [ax0, 6.1, az1],
    [ax0, 6.1, az0],
    P.sidingB
  );
  // Annex personnel door on +Z (az1) + 2 workshop windows on -X (ax0) + fuel drums
  D.box(-19.8, -18.1, yApron, 4.8, az1 - 0.05, az1 + 0.18, P.trim, {
    back: false,
    bottom: false,
  });
  D.quad(
    [-19.58, yApron, az1 + 0.19],
    [-18.32, yApron, az1 + 0.19],
    [-18.32, 4.6, az1 + 0.19],
    [-19.58, 4.6, az1 + 0.19],
    P.doorA
  );
  D.box(-20.05, -17.85, 4.8, 5.1, az1 - 0.05, az1 + 0.75, P.roofA);
  for (const wz of [-4.2, 0.8]) {
    D.box(ax0 - 0.16, ax0 + 0.04, 3.45, 5.15, wz - 1.05, wz + 1.05, P.sill, {
      right: false,
    });
    D.quad(
      [ax0 - 0.17, 3.65, wz - 0.85],
      [ax0 - 0.17, 3.65, wz + 0.85],
      [ax0 - 0.17, 4.95, wz + 0.85],
      [ax0 - 0.17, 4.95, wz - 0.85],
      P.glass
    );
  }
  // Two aviation fuel drums behind the annex
  for (const [dx, dz, col] of [
    [-19.6, -8.35, P.drumA],
    [-18.2, -8.55, P.drumB],
  ]) {
    W.box(
      dx - 0.55,
      dx + 0.55,
      yGround,
      yApron + 1.55,
      dz - 0.55,
      dz + 0.55,
      col
    );
  }

  // 6. Roof mesh (`R`): overhanging 12-segment corrugated barrel vault + annex roof + ridge monitor
  const rOutX = 17.85;
  const rOutY = 7.45;
  const rBaseY = 10.22;
  const rZ0 = -13.75;
  const rZ1 = 13.55;
  const zBays = 8;
  const zStep = (rZ1 - rZ0) / zBays;

  for (let bz = 0; bz < zBays; bz++) {
    const za = rZ0 + bz * zStep;
    const zb = za + zStep;
    const isSkylightBay = bz === 2 || bz === 5;
    for (let k = 0; k < archSegs; k++) {
      const t0 = (k / archSegs) * Math.PI;
      const t1 = ((k + 1) / archSegs) * Math.PI;
      const x0 = rOutX * Math.cos(t0);
      const y0 = rBaseY + rOutY * Math.sin(t0);
      const x1 = rOutX * Math.cos(t1);
      const y1 = rBaseY + rOutY * Math.sin(t1);
      const isSkySector =
        isSkylightBay && (k === 4 || k === 5 || k === 6 || k === 7);
      const panelCol = isSkySector
        ? P.skylight
        : bz % 2 === 0
          ? P.roofA
          : P.roofB;
      // Outward (+Y/+X/-X) normal
      R.quad([x0, y0, zb], [x0, y0, za], [x1, y1, za], [x1, y1, zb], panelCol);
    }
  }

  // Curved front & rear roof fascia bargeboards + underside soffit
  const rThick = 0.34;
  for (let k = 0; k < archSegs; k++) {
    const t0 = (k / archSegs) * Math.PI;
    const t1 = ((k + 1) / archSegs) * Math.PI;
    const x0 = rOutX * Math.cos(t0);
    const y0 = rBaseY + rOutY * Math.sin(t0);
    const x1 = rOutX * Math.cos(t1);
    const y1 = rBaseY + rOutY * Math.sin(t1);
    const xi0 = (rOutX - rThick) * Math.cos(t0);
    const yi0 = rBaseY + (rOutY - rThick) * Math.sin(t0);
    const xi1 = (rOutX - rThick) * Math.cos(t1);
    const yi1 = rBaseY + (rOutY - rThick) * Math.sin(t1);
    // Front (+Z) fascia
    R.quad(
      [xi1, yi1, rZ1],
      [xi0, yi0, rZ1],
      [x0, y0, rZ1],
      [x1, y1, rZ1],
      P.trim
    );
    // Rear (-Z) fascia
    R.quad(
      [xi0, yi0, rZ0],
      [xi1, yi1, rZ0],
      [x1, y1, rZ0],
      [x0, y0, rZ0],
      P.trim
    );
  }
  // Eave soffit strips along +-X
  R.quad(
    [hx, rBaseY, rZ0],
    [hx, rBaseY, rZ1],
    [rOutX, rBaseY, rZ1],
    [rOutX, rBaseY, rZ0],
    scaleRgb(P.trim, 0.75)
  );
  R.quad(
    [-hx, rBaseY, rZ1],
    [-hx, rBaseY, rZ0],
    [-rOutX, rBaseY, rZ0],
    [-rOutX, rBaseY, rZ1],
    scaleRgb(P.trim, 0.75)
  );

  // 5 raised exterior structural arch ribs
  for (const rz of [-13.4, -6.7, 0, 6.7, 13.2]) {
    for (let k = 0; k < archSegs; k++) {
      const t0 = (k / archSegs) * Math.PI;
      const t1 = ((k + 1) / archSegs) * Math.PI;
      const x0 = (rOutX + 0.22) * Math.cos(t0);
      const y0 = rBaseY + (rOutY + 0.22) * Math.sin(t0);
      const x1 = (rOutX + 0.22) * Math.cos(t1);
      const y1 = rBaseY + (rOutY + 0.22) * Math.sin(t1);
      R.quad(
        [x0, y0, rz + 0.26],
        [x0, y0, rz - 0.26],
        [x1, y1, rz - 0.26],
        [x1, y1, rz + 0.26],
        P.trim
      );
    }
  }

  // Raised ridge louver ventilator monitor + front aviation obstruction beacon
  R.box(-2.0, 2.0, 17.45, 18.45, -7.6, 7.6, P.trim, {
    bottom: false,
    topRgb: P.roofB,
  });
  R.box(-2.35, 2.35, 18.45, 18.7, -8.0, 8.0, P.roofA);
  R.box(-0.14, 0.14, 17.6, 19.3, 12.85, 13.13, P.trim);
  R.box(-0.32, 0.32, 19.3, 19.85, 12.71, 13.27, beaconRed);

  // Annex monopitch roof slab (in `R` so it flings with the roof)
  R.quad(
    [ax0 - 0.45, 6.02, az1 + 0.45],
    [ax1 + 0.05, 7.38, az1 + 0.45],
    [ax1 + 0.05, 7.38, az0 - 0.45],
    [ax0 - 0.45, 6.02, az0 - 0.45],
    P.roofB
  );
  R.quad(
    [ax0 - 0.45, 5.78, az0 - 0.45],
    [ax0 - 0.45, 5.78, az1 + 0.45],
    [ax0 - 0.45, 6.02, az1 + 0.45],
    [ax0 - 0.45, 6.02, az0 - 0.45],
    P.trim
  );

  // 7. Telescopic multi-leaf sliding hangar doors in `D` (parted 6.8 units in center!)
  const leafSpecs = [
    [-14.3, -10.5, zFront + 0.18, P.doorA],
    [-10.7, -6.9, zFront + 0.42, P.doorB],
    [-7.1, -3.3, zFront + 0.66, P.doorA],
    [10.5, 14.3, zFront + 0.18, P.doorA],
    [6.9, 10.7, zFront + 0.42, P.doorB],
    [3.3, 7.1, zFront + 0.66, P.doorA],
  ];
  for (const [lx0, lx1, lz, lCol] of leafSpecs) {
    // Leaf steel body
    D.box(lx0, lx1, yApron + 0.08, 9.42, lz, lz + 0.2, lCol);
    // Perimeter stiles & mid rail proud by 0.05 on +Z (non-overlapping bands)
    const fz = lz + 0.25;
    D.box(lx0, lx0 + 0.26, yApron + 0.08, 9.42, lz + 0.2, fz, P.trim, {
      back: false,
    });
    D.box(lx1 - 0.26, lx1, yApron + 0.08, 9.42, lz + 0.2, fz, P.trim, {
      back: false,
    });
    D.box(lx0 + 0.26, lx1 - 0.26, 4.85, 5.18, lz + 0.2, fz, P.trim, {
      back: false,
      left: false,
      right: false,
    });
    // Hazard yellow kickplate band along bottom
    D.quad(
      [lx0 + 0.26, yApron + 0.08, lz + 0.21],
      [lx1 - 0.26, yApron + 0.08, lz + 0.21],
      [lx1 - 0.26, yApron + 0.52, lz + 0.21],
      [lx0 + 0.26, yApron + 0.52, lz + 0.21],
      hazardYellow
    );
    // Upper glazed transom window on each door leaf
    const wxA = lx0 + 0.52;
    const wxB = lx1 - 0.52;
    const wxMid = (wxA + wxB) * 0.5;
    D.quad(
      [wxA, 5.65, lz + 0.21],
      [wxMid - 0.08, 5.65, lz + 0.21],
      [wxMid - 0.08, 8.35, lz + 0.21],
      [wxA, 8.35, lz + 0.21],
      P.glass
    );
    D.quad(
      [wxMid + 0.08, 5.65, lz + 0.21],
      [wxB, 5.65, lz + 0.21],
      [wxB, 8.35, lz + 0.21],
      [wxMid + 0.08, 8.35, lz + 0.21],
      P.glass
    );
  }

  const out = {
    walls: W.build(),
    roof: R.build(),
    doors: D.build(),
  };
  _hangarGeos.set(key, out);
  return out;
}

// --- CLASSIC SLOOP SAILBOAT ---
// Six geometries matching terrain-chunks.js's instanced watercraft slots
// (hull, rim, deck/cabin/cockpit, mast/bowsprit/spreaders, boom/vang, sails).
// Bow points toward -Z, stern toward +Z, waterline near y = 0.08.
export function buildSailboatGeos() {
  // Hull longitudinal stations: [z, hxGunwale, yGunwale, hxWaterline, yWaterline, hxChine, yChine, yKeelLine]
  const STATIONS = [
    [-8.85, 0.04, 2.42, 0.02, 0.55, 0.02, 0.35, 0.32], // Clipper stem
    [-6.9, 0.96, 2.24, 0.68, 0.16, 0.32, -0.18, -0.26],
    [-4.4, 1.72, 2.04, 1.44, 0.1, 0.78, -0.34, -0.44],
    [-1.5, 2.08, 1.9, 1.84, 0.08, 1.04, -0.4, -0.52], // Max beam
    [1.2, 1.98, 1.88, 1.74, 0.08, 0.96, -0.36, -0.46],
    [3.3, 1.66, 1.95, 1.38, 0.12, 0.68, -0.22, -0.3],
    [4.75, 1.28, 2.05, 0.96, 0.26, 0.42, 0.04, 0.0], // Counter transom
  ];

  // 1. Hull (`boatHullGeo` - tinted by `boatHullPalette[i]` with vertex-shaded strakes)
  const H = createColoredBuilder();
  const topStrake = [1.05, 1.05, 1.05];
  const midStrake = [0.9, 0.9, 0.9];
  const bilgeStrake = [0.68, 0.68, 0.68];
  const keelShade = [0.54, 0.54, 0.54];

  for (let i = 0; i < STATIONS.length - 1; i++) {
    const [zA, gxA, gyA, wxA, wyA, cxA, cyA, kyA] = STATIONS[i];
    const [zB, gxB, gyB, wxB, wyB, cxB, cyB, kyB] = STATIONS[i + 1];
    // Rake the bow stem (station 0) from z = -9.1 at sheer back to -7.85 at forefoot
    const gzA = i === 0 ? -9.1 : zA;
    const wzA = i === 0 ? -8.35 : zA;
    const czA = i === 0 ? -7.9 : zA;
    const kzA = i === 0 ? -7.8 : zA;
    const wyA0 = i === 0 ? 0.22 : wyA;
    const cyA0 = i === 0 ? -0.04 : cyA;
    const kyA0 = i === 0 ? -0.1 : kyA;

    // Starboard (+X outward normal)
    H.quad(
      [wxB, wyB, zB],
      [wxA, wyA0, wzA],
      [gxA, gyA, gzA],
      [gxB, gyB, zB],
      topStrake
    );
    H.quad(
      [cxB, cyB, zB],
      [cxA, cyA0, czA],
      [wxA, wyA0, wzA],
      [wxB, wyB, zB],
      midStrake
    );
    H.quad(
      [0, kyB, zB],
      [0, kyA0, kzA],
      [cxA, cyA0, czA],
      [cxB, cyB, zB],
      bilgeStrake
    );

    // Port (-X outward normal)
    H.quad(
      [-wxA, wyA0, wzA],
      [-wxB, wyB, zB],
      [-gxB, gyB, zB],
      [-gxA, gyA, gzA],
      topStrake
    );
    H.quad(
      [-cxA, cyA0, czA],
      [-cxB, cyB, zB],
      [-wxB, wyB, zB],
      [-wxA, wyA0, wzA],
      midStrake
    );
    H.quad(
      [0, kyA0, kzA],
      [0, kyB, zB],
      [-cxB, cyB, zB],
      [-cxA, cyA0, czA],
      bilgeStrake
    );
  }

  // Raked wineglass transom (+Z normal)
  const [, gxT, gyT, wxT, wyT, cxT, cyT, kyT] = STATIONS[STATIONS.length - 1];
  const zTrans = STATIONS[STATIONS.length - 1][0];
  H.quad(
    [-wxT, wyT, zTrans],
    [wxT, wyT, zTrans],
    [gxT, gyT, zTrans + 0.14],
    [-gxT, gyT, zTrans + 0.14],
    midStrake
  );
  H.quad(
    [-cxT, cyT, zTrans - 0.1],
    [cxT, cyT, zTrans - 0.1],
    [wxT, wyT, zTrans],
    [-wxT, wyT, zTrans],
    bilgeStrake
  );
  H.tri(
    [0, kyT, zTrans - 0.16],
    [cxT, cyT, zTrans - 0.1],
    [-cxT, cyT, zTrans - 0.1],
    keelShade
  );

  // Hydrodynamic fin keel + lower rudder blade
  H.frustum(0, -0.55, 0.1, 0.95, -1.35, 0.16, 1.55, -0.35, keelShade, {
    bottom: true,
  });
  H.box(-0.08, 0.08, -0.65, 1.88, zTrans + 0.04, zTrans + 0.56, midStrake, {
    bottom: true,
  });

  // 2. White gunwale rub-rail & sheer trim (`boatRimGeo`)
  const RIM = createColoredBuilder();
  const rimWhite = [1, 1, 1];
  const rimSide = [0.94, 0.95, 0.97];
  for (let i = 0; i < STATIONS.length - 1; i++) {
    const [zA, gxA, gyA] = STATIONS[i];
    const [zB, gxB, gyB] = STATIONS[i + 1];
    const ozA = i === 0 ? -9.2 : zA;
    const ozB = i === STATIONS.length - 2 ? zB + 0.16 : zB;
    const oxA = gxA + 0.09;
    const oxB = gxB + 0.09;
    const ixA = Math.max(0, gxA - 0.12);
    const ixB = Math.max(0, gxB - 0.12);

    // Starboard outer rail, top cap & inner coaming lip
    RIM.quad(
      [oxB, gyB - 0.14, ozB],
      [oxA, gyA - 0.14, ozA],
      [oxA, gyA + 0.1, ozA],
      [oxB, gyB + 0.1, ozB],
      rimSide
    );
    RIM.quad(
      [ixB, gyB + 0.1, ozB],
      [oxB, gyB + 0.1, ozB],
      [oxA, gyA + 0.1, ozA],
      [ixA, gyA + 0.1, ozA],
      rimWhite
    );
    // Port outer rail & top cap
    RIM.quad(
      [-oxA, gyA - 0.14, ozA],
      [-oxB, gyB - 0.14, ozB],
      [-oxB, gyB + 0.1, ozB],
      [-oxA, gyA + 0.1, ozA],
      rimSide
    );
    RIM.quad(
      [-oxB, gyB + 0.1, ozB],
      [-ixB, gyB + 0.1, ozB],
      [-ixA, gyA + 0.1, ozA],
      [-oxA, gyA + 0.1, ozA],
      rimWhite
    );
  }
  // Transom rail cap
  RIM.box(
    -gxT - 0.09,
    gxT + 0.09,
    gyT - 0.12,
    gyT + 0.1,
    zTrans + 0.02,
    zTrans + 0.22,
    rimWhite
  );

  // 3. Teak deck, recessed cockpit, cabin coachroof, tinted windshield/portholes & tiller (`boatDeckGeo`)
  const DK = createColoredBuilder();
  const teak = hexRgb(0xc89d6c);
  const teakBench = hexRgb(0xb88b5a);
  const teakSole = hexRgb(0x8c6239);
  const mahogany = hexRgb(0x6b3d22);
  const cabinWhite = hexRgb(0xf3f0e6);
  const cabinRoof = hexRgb(0xfaf8f2);
  const marineGlass = hexRgb(0x1f3140);

  // Cambered foredeck, side walkways, and aft lazarette deck
  for (let i = 0; i < STATIONS.length - 1; i++) {
    const [zA0, gxA, gyA] = STATIONS[i];
    const zA = i === 0 ? -9.05 : zA0;
    const [zB, gxB, gyB] = STATIONS[i + 1];
    const dxA = Math.max(0, gxA - 0.06);
    const dxB = Math.max(0, gxB - 0.06);
    const dyA = gyA - 0.02;
    const dyB = gyB - 0.02;
    // Leave cockpit opening in stations 4..5 (z in [1.2, 3.3] -> extended to 4.0 below)
    if (i === 4) {
      // Side decks flanking the recessed cockpit (z = 1.2..3.3, cockpit x in [-1.1, 1.1])
      DK.quad(
        [1.1, dyB, zB],
        [dxB, dyB, zB],
        [dxA, dyA, zA],
        [1.1, dyA, zA],
        teak
      );
      DK.quad(
        [-dxB, dyB, zB],
        [-1.1, dyB, zB],
        [-1.1, dyA, zA],
        [-dxA, dyA, zA],
        teak
      );
    } else if (i === 5) {
      // Split station 5 (z = 3.3..4.75) at z = 4.05 so aft deck closes behind cockpit
      const zMid = 4.05;
      const t = (zMid - zA) / (zB - zA);
      const dxM = dxA + (dxB - dxA) * t;
      const dyM = dyA + (dyB - dyA) * t;
      DK.quad(
        [1.1, dyM, zMid],
        [dxM, dyM, zMid],
        [dxA, dyA, zA],
        [1.1, dyA, zA],
        teak
      );
      DK.quad(
        [-dxM, dyM, zMid],
        [-1.1, dyM, zMid],
        [-1.1, dyA, zA],
        [-dxA, dyA, zA],
        teak
      );
      DK.quad(
        [-dxB, dyB, zB + 0.08],
        [dxB, dyB, zB + 0.08],
        [dxM, dyM, zMid],
        [-dxM, dyM, zMid],
        teak
      );
    } else {
      DK.quad(
        [-dxB, dyB, zB],
        [dxB, dyB, zB],
        [dxA, dyA, zA],
        [-dxA, dyA, zA],
        i % 2 === 0 ? teak : scaleRgb(teak, 0.96)
      );
    }
  }

  // True 3D recessed self-bailing cockpit (z in [1.2, 4.05], x in [-1.1, 1.1])
  const cz0 = 1.2;
  const cz1 = 4.05;
  const yDeck = 1.9;
  const yBench = 1.56;
  const ySole = 1.22;
  // Port & starboard benches + footwell walls + grated sole
  DK.quad(
    [0.54, yBench, cz1],
    [1.1, yBench, cz1],
    [1.1, yBench, cz0],
    [0.54, yBench, cz0],
    teakBench
  );
  DK.quad(
    [-1.1, yBench, cz1],
    [-0.54, yBench, cz1],
    [-0.54, yBench, cz0],
    [-1.1, yBench, cz0],
    teakBench
  );
  DK.quad(
    [-0.54, ySole, cz1],
    [0.54, ySole, cz1],
    [0.54, ySole, cz0],
    [-0.54, ySole, cz0],
    teakSole
  );
  // Inner bench risers & upper cockpit walls (facing inward into the cockpit)
  DK.quad(
    [0.54, ySole, cz0],
    [0.54, ySole, cz1],
    [0.54, yBench, cz1],
    [0.54, yBench, cz0],
    scaleRgb(teakBench, 0.82)
  );
  DK.quad(
    [-0.54, ySole, cz1],
    [-0.54, ySole, cz0],
    [-0.54, yBench, cz0],
    [-0.54, yBench, cz1],
    scaleRgb(teakBench, 0.82)
  );
  DK.quad(
    [1.1, yBench, cz0],
    [1.1, yBench, cz1],
    [1.1, yDeck, cz1],
    [1.1, yDeck, cz0],
    mahogany
  );
  DK.quad(
    [-1.1, yBench, cz1],
    [-1.1, yBench, cz0],
    [-1.1, yDeck, cz0],
    [-1.1, yDeck, cz1],
    mahogany
  );
  // Aft cockpit bulkhead (-Z normal facing forward) & forward bulkhead (+Z normal facing aft)
  DK.quad(
    [1.1, ySole, cz1],
    [-1.1, ySole, cz1],
    [-1.1, yDeck + 0.08, cz1],
    [1.1, yDeck + 0.08, cz1],
    mahogany
  );
  DK.quad(
    [-1.1, ySole, cz0],
    [1.1, ySole, cz0],
    [1.1, yDeck, cz0],
    [-1.1, yDeck, cz0],
    mahogany
  );
  // Raised mahogany cockpit coaming lips
  DK.box(-1.22, -1.06, yDeck - 0.02, yDeck + 0.24, cz0, cz1 + 0.08, mahogany, {
    bottom: false,
  });
  DK.box(1.06, 1.22, yDeck - 0.02, yDeck + 0.24, cz0, cz1 + 0.08, mahogany, {
    bottom: false,
  });
  DK.box(-1.22, 1.22, yDeck - 0.02, yDeck + 0.2, cz1, cz1 + 0.14, mahogany, {
    bottom: false,
  });

  // Streamlined cabin coachroof (z in [-4.2, 1.2]), tapered forward with raked dark windshield
  const cabZ0 = -4.2;
  const cabZMid = -2.85;
  const cabZ1 = 1.2;
  const cabY0 = 1.88;
  const cabY1 = 2.66;
  // Aft main cabin body (z in [-2.85, 1.2], x in [-1.22, 1.22] -> [-1.08, 1.08] at roof)
  DK.quad(
    [1.22, cabY0, cabZ1],
    [1.16, cabY0, cabZMid],
    [1.04, cabY1, cabZMid],
    [1.1, cabY1, cabZ1],
    cabinWhite
  );
  DK.quad(
    [-1.16, cabY0, cabZMid],
    [-1.22, cabY0, cabZ1],
    [-1.1, cabY1, cabZ1],
    [-1.04, cabY1, cabZMid],
    cabinWhite
  );
  DK.quad(
    [-1.1, cabY1, cabZ1],
    [1.1, cabY1, cabZ1],
    [1.04, cabY1, cabZMid],
    [-1.04, cabY1, cabZMid],
    cabinRoof
  );
  // Aft cabin bulkhead + dark companionway hatchway
  DK.quad(
    [-1.22, cabY0, cabZ1],
    [1.22, cabY0, cabZ1],
    [1.1, cabY1, cabZ1],
    [-1.1, cabY1, cabZ1],
    scaleRgb(cabinWhite, 0.92)
  );
  DK.box(
    -0.42,
    0.42,
    cabY0 + 0.06,
    cabY1 - 0.06,
    cabZ1 - 0.02,
    cabZ1 + 0.08,
    mahogany,
    {back: false}
  );
  // Raked forward cabin brow & wraparound dark windshield (z in [-4.2, -2.85])
  DK.quad(
    [1.16, cabY0, cabZMid],
    [0.82, cabY0 + 0.08, cabZ0],
    [0.74, cabY0 + 0.42, cabZ0 + 0.35],
    [1.04, cabY1, cabZMid],
    cabinWhite
  );
  DK.quad(
    [-0.82, cabY0 + 0.08, cabZ0],
    [-1.16, cabY0, cabZMid],
    [-1.04, cabY1, cabZMid],
    [-0.74, cabY0 + 0.42, cabZ0 + 0.35],
    cabinWhite
  );
  DK.quad(
    [0.82, cabY0 + 0.08, cabZ0],
    [-0.82, cabY0 + 0.08, cabZ0],
    [-0.74, cabY0 + 0.42, cabZ0 + 0.35],
    [0.74, cabY0 + 0.42, cabZ0 + 0.35],
    cabinWhite
  );
  DK.quad(
    [0.74, cabY0 + 0.42, cabZ0 + 0.35],
    [-0.74, cabY0 + 0.42, cabZ0 + 0.35],
    [-1.04, cabY1, cabZMid],
    [1.04, cabY1, cabZMid],
    marineGlass
  );
  // Twin side portlights on port & starboard coachroof + teak roof grab-rails
  for (const [pzA, pzB] of [
    [-2.45, -1.05],
    [-0.65, 0.75],
  ]) {
    DK.quad(
      [1.19, 2.12, pzB],
      [1.17, 2.12, pzA],
      [1.11, 2.48, pzA],
      [1.13, 2.48, pzB],
      marineGlass
    );
    DK.quad(
      [-1.17, 2.12, pzA],
      [-1.19, 2.12, pzB],
      [-1.13, 2.48, pzB],
      [-1.11, 2.48, pzA],
      marineGlass
    );
  }
  DK.box(-0.92, -0.8, cabY1, cabY1 + 0.11, -2.6, 0.85, mahogany, {
    bottom: false,
  });
  DK.box(0.8, 0.92, cabY1, cabY1 + 0.11, -2.6, 0.85, mahogany, {bottom: false});
  // Foredeck skylight hatch + varnished tiller handle
  DK.box(-0.46, 0.46, 2.02, 2.2, -5.75, -4.85, mahogany, {
    bottom: false,
    topRgb: marineGlass,
  });
  DK.box(-0.07, 0.07, 2.06, 2.19, 2.95, zTrans + 0.25, mahogany);

  // 4. Mast, crosstree spreaders & bowsprit (`boatMastGeo` - drawn with `woodMat`)
  const mastParts = [];
  const mast = new THREE.CylinderGeometry(0.1, 0.18, 13.1, 8);
  mast.translate(0, 8.45, -1.35);
  mastParts.push(mast);
  const mastCap = new THREE.BoxGeometry(0.3, 0.14, 0.42);
  mastCap.translate(0, 15.02, -1.32);
  mastParts.push(mastCap);
  const spreader = new THREE.BoxGeometry(2.5, 0.09, 0.14);
  spreader.translate(0, 9.1, -1.35);
  mastParts.push(spreader);
  const bowsprit = new THREE.CylinderGeometry(0.08, 0.13, 2.55, 6);
  bowsprit.rotateX(Math.PI / 2 - 0.08);
  bowsprit.translate(0, 2.46, -9.05);
  mastParts.push(bowsprit);

  // 5. Main boom & diagonal boom vang (`boatBoomGeo` - drawn with `woodMat`)
  const boomParts = [];
  const boom = new THREE.CylinderGeometry(0.09, 0.12, 6.7, 6);
  boom.rotateX(Math.PI / 2);
  boom.translate(0, 3.12, 2.05);
  boomParts.push(boom);
  const vang = new THREE.CylinderGeometry(0.06, 0.06, 1.95, 5);
  vang.rotateX(1.18);
  vang.translate(0, 2.68, -0.35);
  boomParts.push(vang);

  const mergePlain = (geos) => {
    const pos = [];
    const norm = [];
    const idx = [];
    let off = 0;
    for (const g of geos) {
      pos.push(...g.attributes.position.array);
      norm.push(...g.attributes.normal.array);
      for (let i = 0; i < g.index.array.length; i++) {
        idx.push(g.index.array[i] + off);
      }
      off += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    out.setIndex(idx);
    out.computeBoundingBox();
    out.computeBoundingSphere();
    return out;
  };

  // 6. Aerodynamic roached mainsail + raked forestay genoa jib (`boatSailGeo`)
  const SL = createColoredBuilder();
  const sailCreamA = hexRgb(0xfaf7ef);
  const sailCreamB = hexRgb(0xf1ece0);
  const sailPatch = hexRgb(0xe2d8c3);

  // Mainsail (rows from foot y=3.24 up to head y=14.65, roached leech)
  const mRows = 6;
  const mCols = 4;
  const mGrid = [];
  for (let r = 0; r <= mRows; r++) {
    const v = r / mRows;
    const y = 3.24 + v * (14.65 - 3.24);
    const zLuff = -1.2;
    const roach = Math.sin(v * Math.PI) * 0.65;
    const zLeech = zLuff + (1 - v * 0.94) * (5.32 - zLuff) + roach;
    const row = [];
    for (let c = 0; c <= mCols; c++) {
      const u = c / mCols;
      const z = zLuff + u * (zLeech - zLuff);
      const draft =
        Math.sin(Math.pow(u, 0.78) * Math.PI) *
        Math.sin((1 - v * 0.62) * Math.PI) *
        0.66;
      const twistX = u * v * 0.24;
      row.push([draft + twistX, y, z]);
    }
    mGrid.push(row);
  }
  for (let r = 0; r < mRows; r++) {
    for (let c = 0; c < mCols; c++) {
      const isCorner =
        (r === 0 && (c === 0 || c === mCols - 1)) ||
        (r === mRows - 1 && c === 0);
      const col = isCorner ? sailPatch : r % 2 === 0 ? sailCreamA : sailCreamB;
      SL.quad(
        mGrid[r][c],
        mGrid[r][c + 1],
        mGrid[r + 1][c + 1],
        mGrid[r + 1][c],
        col
      );
    }
  }

  // Forestay Jib: straight luff along forestay from bowsprit tip (0, 2.58, -10.15)
  // up to mast hound (0, 12.85, -1.48), sheeted aft to leeward clew (0.44, 2.86, -1.72)
  const jRows = 6;
  const jCols = 4;
  const jTack = [0, 2.58, -10.15];
  const jHead = [0, 12.85, -1.48];
  const jClew = [0.44, 2.86, -1.72];
  const jGrid = [];
  for (let r = 0; r <= jRows; r++) {
    const v = r / jRows;
    const lx = jTack[0] + v * (jHead[0] - jTack[0]);
    const ly = jTack[1] + v * (jHead[1] - jTack[1]);
    const lz = jTack[2] + v * (jHead[2] - jTack[2]);
    const ex = jClew[0] + v * (jHead[0] - jClew[0]);
    const ey = jClew[1] + v * (jHead[1] - jClew[1]);
    const ez = jClew[2] + v * (jHead[2] - jClew[2]);
    const row = [];
    for (let c = 0; c <= jCols; c++) {
      const u = c / jCols;
      const camber =
        Math.sin(Math.pow(u, 0.75) * Math.PI) *
        Math.sin((1 - v * 0.55) * Math.PI) *
        0.52;
      row.push([
        lx + u * (ex - lx) + camber,
        ly + u * (ey - ly),
        lz + u * (ez - lz),
      ]);
    }
    jGrid.push(row);
  }
  for (let r = 0; r < jRows; r++) {
    for (let c = 0; c < jCols; c++) {
      const isCorner =
        (r === 0 && (c === 0 || c === jCols - 1)) ||
        (r === jRows - 1 && c === 0);
      const col = isCorner ? sailPatch : r % 2 === 0 ? sailCreamB : sailCreamA;
      SL.quad(
        jGrid[r][c],
        jGrid[r][c + 1],
        jGrid[r + 1][c + 1],
        jGrid[r + 1][c],
        col
      );
    }
  }

  return {
    hull: H.build(),
    rim: RIM.build(),
    deck: DK.build(),
    mast: mergePlain(mastParts),
    boom: mergePlain(boomParts),
    sail: SL.build(),
  };
}
