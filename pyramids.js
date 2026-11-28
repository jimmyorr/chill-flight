// --- THE PYRAMIDS ---
// The three pyramids out in the southern desert (chill-flight-logic.js puts
// them in the ground, for landing on and crashing into). The terrain's grid
// can't draw their edges straight, so they're drawn here as well, a little
// outside that ground: four faces each, in courses of sandstone, with a pale
// cap on the great one. They use the terrain's material, so they light,
// fog and fade into the distance with the land.
import * as THREE from 'three';
import {standaloneProps} from './airports.js';
import {BREAK, sweptFerrisHit} from './breakables-logic.js';
import {
  FERRIS_PERIOD_SEC,
  buildingMesh,
  dragonSkeletonGeo,
  ferrisGlowMat,
  ferrisWheelGroup,
  portalGroup,
} from './building-models.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {WATER_LEVEL} from './constants.js';
import {simplex} from './noise.js';
import {scene} from './scene.js';
import {getCameraWorldPosition} from './sky.js';
import {BREAKABLE, WIND_DIR_X, WIND_DIR_Z} from './terrain-gen.js';
import {terrainMaterial} from './terrain-geometry.js';
import {createTownPlazaGroup} from './town-models.js';

// Each course of stone is this tall (units), every other one a shade
// darker; the great one's cap is pale limestone above this height
const COURSE = 12;
const CAP_HEIGHT = 690;
const STONE = new THREE.Color(0xd8b07a);
const CAP = new THREE.Color(0xf0e6cc);
const DRAGON_DRAW_DISTANCE = 12000;
const TOWN_PLAZA_DETAIL_DISTANCE = 3500;
const TOWN_PLAZA_DRAW_DISTANCE = 8500;
const WIND_YAW = Math.atan2(WIND_DIR_X, WIND_DIR_Z);

// The four faces of a pyramid with its base's middle at (x, base, z), in
// horizontal bands one course tall: positions, colours and the terrain
// material's morphY (its own height, so it never morphs)
function addPyramid(out, x, base, z, half, slope) {
  const height = half * slope;
  const courses = Math.ceil(height / COURSE);
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const color = new THREE.Color();
  const point = (corner, t) => {
    // t: 0 at the base, 1 at the tip
    const [cx, cz] = corner;
    const h = Math.min(1, t);
    return [
      x + cx * half * (1 - h),
      base + height * h,
      z + cz * half * (1 - h),
    ];
  };
  for (let f = 0; f < 4; f++) {
    // Wound so the face looks outward
    const a = corners[(f + 1) % 4];
    const b = corners[f];
    for (let c = 0; c < courses; c++) {
      const t0 = (c * COURSE) / height;
      const t1 = ((c + 1) * COURSE) / height;
      const quad = [point(a, t0), point(b, t0), point(b, t1), point(a, t1)];
      color.copy(c * COURSE >= CAP_HEIGHT ? CAP : STONE);
      if (c % 2) color.multiplyScalar(0.93);
      for (const i of [0, 1, 2, 0, 2, 3]) {
        out.positions.push(...quad[i]);
        out.colors.push(color.r, color.g, color.b);
        out.morphY.push(quad[i][1]);
      }
    }
  }
}

const site = ChillFlightLogic.pyramidSite(simplex, {WATER_LEVEL});
if (site && ChillFlightLogic.SHOW_OBJECTS !== false) {
  const out = {positions: [], colors: [], morphY: []};
  for (const p of ChillFlightLogic.PYRAMIDS) {
    addPyramid(
      out,
      site.x + p.dx,
      site.base,
      site.z + p.dz,
      p.half,
      ChillFlightLogic.PYRAMID_SLOPE
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(out.positions, 3)
  );
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(out.colors, 3)
  );
  geometry.setAttribute(
    'morphY',
    new THREE.Float32BufferAttribute(out.morphY, 1)
  );
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, terrainMaterial);
  mesh.name = 'pyramids';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

const dragon = ChillFlightLogic.dragonSite(simplex, {WATER_LEVEL});
if (dragon && ChillFlightLogic.SHOW_OBJECTS !== false) {
  const bones = buildingMesh(dragonSkeletonGeo());
  const lod = new THREE.LOD();
  lod.name = 'dragon-skeleton';
  lod.addLevel(bones, 0);
  lod.addLevel(new THREE.Group(), DRAGON_DRAW_DISTANCE);
  lod.position.set(dragon.x, dragon.base, dragon.z);
  lod.rotation.y = dragon.yaw;
  lod.updateMatrixWorld(true);
  scene.add(lod);
}

const portals = ChillFlightLogic.portalSites(simplex, {WATER_LEVEL});
if (portals && ChillFlightLogic.SHOW_OBJECTS !== false) {
  for (const portal of [portals.east, portals.west]) {
    if (!portal) continue;
    const lod = new THREE.LOD();
    lod.name = portal.name.toLowerCase().replace(/\s+/g, '-');
    lod.addLevel(portalGroup(portal.colorway), 0);
    lod.addLevel(new THREE.Group(), DRAGON_DRAW_DISTANCE);
    lod.position.set(portal.x, portal.base, portal.z);
    lod.rotation.y = portal.yaw;
    lod.updateMatrixWorld(true);
    scene.add(lod);
  }
}

const _townPlazaEntries = [];
if (ChillFlightLogic.SHOW_OBJECTS !== false) {
  for (const plaza of ChillFlightLogic.townPlazaSites(simplex, {WATER_LEVEL})) {
    const near =
      plaza.kind === 'ferris'
        ? ferrisWheelGroup('sandtray', {withGondolas: true})
        : createTownPlazaGroup(plaza.kind, {detail: true});
    const far =
      plaza.kind === 'ferris'
        ? ferrisWheelGroup('sandtray', {withGondolas: false})
        : createTownPlazaGroup(plaza.kind, {detail: false});
    if (!near || !far) continue;
    const lod = new THREE.LOD();
    lod.name =
      plaza.kind === 'ferris' ? 'ferris-wheel' : `town-plaza-${plaza.kind}`;
    lod.addLevel(near, 0);
    lod.addLevel(far, TOWN_PLAZA_DETAIL_DISTANCE);
    lod.addLevel(new THREE.Group(), TOWN_PLAZA_DRAW_DISTANCE);
    lod.position.set(plaza.x, plaza.base, plaza.z);
    lod.rotation.y = plaza.yaw;
    if (plaza.kind === 'ferris') {
      near.userData.animateFerris(0, 0.7, 0);
    } else {
      near.userData.animatePlaza?.({
        timeSec: 0,
        windStrength: 0.7,
        windYaw: WIND_YAW,
        parentYaw: plaza.yaw,
        dayProgress: 0.5,
      });
    }
    lod.updateMatrixWorld(true);
    scene.add(lod);
    const entry = {site: plaza, near, far, broken: false, adriftAt: null};
    _townPlazaEntries.push(entry);

    if (plaza.kind === 'ferris') {
      const nearParts = near.userData.parts;
      const farParts = far.userData.parts;
      standaloneProps.push({
        userData: {
          breakables: {kinds: []},
          instanceData: {},
          meshProps: [
            {
              kind: BREAKABLE.HOUSE,
              radius: 45,
              rubble: BREAK.RUBBLE.ferris_wheel,
              parts: [
                {
                  type: 'obj',
                  object: nearParts.frameStructure,
                  role: 'fold',
                  rubbleColor: [0.38, 0.61, 0.68],
                },
                {
                  type: 'obj',
                  object: nearParts.wheelRim,
                  role: 'fling',
                  discYaw: plaza.yaw,
                  rubbleColor: [0.92, 0.9, 0.86],
                },
                ...nearParts.gondolas.map((g) => ({
                  type: 'obj',
                  object: g,
                  role: 'fling',
                  radial: true,
                })),
              ],
              hit: (b, r, a = b, wing = null) =>
                sweptFerrisHit(a, b, r, plaza, wing),
              onBreak: () => {
                entry.broken = true;
                farParts.frameStructure.visible = false;
                farParts.wheelRim.visible = false;
              },
            },
          ],
          chunkX: 'ferris',
          chunkZ: 0,
          standalone: true,
        },
      });
    }

    // The other plazas' landmarks (clock tower, bandstand, conservatory,
    // fountain, wind spinner, airship and its mast, mine headframe) each
    // knock over on their own; the paved plaza stays
    const nearBreak = near.userData.breakParts;
    const farBreak = far.userData.breakParts;
    if (plaza.kind !== 'ferris' && nearBreak?.length) {
      // Thrown-off pieces go dark rather than keep glowing (breakables.js)
      near.traverse((o) => {
        if (o.material === ferrisGlowMat) o.userData.goesDark = true;
      });
      standaloneProps.push({
        userData: {
          breakables: {kinds: []},
          instanceData: {},
          meshProps: nearBreak.map((bp, i) => ({
            kind: BREAKABLE.HOUSE,
            rubble: bp.rubble,
            parts: bp.parts.map(([object, role, opts]) => ({
              type: 'obj',
              object,
              role,
              ...opts,
            })),
            // (An airship adrift has left where it was moored)
            hit: bp.freeWhenAdrift ? () => entry.adriftAt === null : undefined,
            onBreak: () => {
              if (bp.cutsLoose && entry.adriftAt === null) {
                entry.adriftAt = _lastAnimSec ?? 0;
              }
              const farPart = farBreak?.[i];
              for (const [object] of farPart?.parts || []) {
                object.visible = false;
              }
              for (const o of [
                ...(bp.alsoHide || []),
                ...(farPart?.alsoHide || []),
              ]) {
                o.visible = false;
              }
            },
          })),
          chunkX: `plaza-${plaza.kind}`,
          chunkZ: 0,
          standalone: true,
        },
      });
    }
  }
}

const _camPos = new THREE.Vector3();
let _lastAnimSec = null;
let _windRunSec = 0;
export function updateTownPlazas(
  timeSec,
  windStrength = 0.7,
  dayProgress = 0.5,
  animSec = timeSec
) {
  if (!_townPlazaEntries.length) return;
  const rawDt = _lastAnimSec === null ? 0 : animSec - _lastAnimSec;
  _lastAnimSec = animSec;
  const dt = rawDt > 0 && rawDt < 0.5 ? rawDt : 0;
  _windRunSec = (_windRunSec + dt * (0.65 + windStrength * 0.5)) % 86400;
  const localSec = ((animSec % 86400) + 86400) % 86400;
  getCameraWorldPosition(_camPos);
  for (let i = 0; i < _townPlazaEntries.length; i++) {
    const entry = _townPlazaEntries[i];
    if (entry.broken) continue;
    const {site, near, far} = entry;
    const dx = _camPos.x - site.x;
    const dz = _camPos.z - site.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= TOWN_PLAZA_DRAW_DISTANCE * TOWN_PLAZA_DRAW_DISTANCE) continue;
    const active =
      d2 < TOWN_PLAZA_DETAIL_DISTANCE * TOWN_PLAZA_DETAIL_DISTANCE ? near : far;
    if (site.kind === 'ferris') {
      const angle =
        ((timeSec % FERRIS_PERIOD_SEC) / FERRIS_PERIOD_SEC) * Math.PI * 2;
      active.userData.animateFerris(angle, windStrength, localSec);
    } else {
      active.userData.animatePlaza?.({
        timeSec: localSec,
        windTimeSec: _windRunSec,
        windStrength,
        windYaw: WIND_YAW,
        parentYaw: site.yaw,
        dayProgress,
        adriftSec:
          entry.adriftAt === null
            ? null
            : (((animSec - entry.adriftAt) % 86400) + 86400) % 86400,
      });
    }
  }
}

export function updateFerrisWheel(timeSec, windStrength = 0.7) {
  updateTownPlazas(timeSec, windStrength);
}
